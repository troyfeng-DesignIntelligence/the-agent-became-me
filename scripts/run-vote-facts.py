"""Two follow-up design experiments on the 920 product-language shelves (2026-10-05), run as one shuffled batch.

A · vote  — the door: re-ask in random orders and admit the served pick to the record only if the picks agree.
B · facts — the shelf: give the agent each product's three fit facts (type, attribute, budget) instead of
            prose only; no instructions added.

Post-study design experiments, not part of the HAI '26 paper.
Protocol: experiments/vote-facts/PROTOCOL.md and protocol.json (frozen before any call).

    artifacts/venv/bin/python scripts/run-vote-facts.py --prepare     # facts + random orders, no calls
    python3 scripts/run-vote-facts.py --dry-run
    python3 scripts/run-vote-facts.py --execute --provider deepseek --workers 12 [--limit 5]
    python3 scripts/run-vote-facts.py --execute --provider mimo --workers 8 [--limit 5]

Shelves, payload format, HTTP, retries, pricing and the cost ledger come from scripts/run-check-first.py and
scripts/run-order-notice.py unchanged.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import pathlib
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CF = load("check_first", ROOT / "scripts/run-check-first.py")
ON = CF.ON
STUDY = ROOT / "experiments/vote-facts"
PROTOCOL = STUDY / "protocol.json"
PRIVATE = ROOT / "artifacts/vote-facts"
PROVIDERS = ON.PROVIDERS
# 每个单元：照旧条件 10 次（服务顺序两次、另一臂顺序两次、服务顺序再两次作噪声、两个随机顺序各两次），
# 给事实条件 6 次（同 Study 2 的六个位置）
SLOTS = {"L0-none": ("immediate-a", "immediate-b", "held-a", "held-b", "sham-a", "sham-b",
                     "random1-a", "random1-b", "random2-a", "random2-b"),
         "F1-facts": ("immediate-a", "immediate-b", "held-a", "held-b", "sham-a", "sham-b")}


def side_of(slot: str) -> str:
    if slot.startswith("held"):
        return "held"
    if slot.startswith("random"):
        return slot.split("-")[0]
    return "immediate"


def random_order(unit: str, which: str, aliases: list) -> list:
    """平台自己打乱的顺序：和个性化排序无关，由单元名决定，可复现；不能恰好等于服务顺序。"""
    seed = int(hashlib.sha256(f"vote-facts/{unit}/{which}".encode()).hexdigest()[:16], 16)
    order = list(aliases)
    rng = random.Random(seed)
    while order == aliases:
        rng.shuffle(order)
    return order


# ---------- prepare ----------

def prepare() -> dict:
    v9 = load("v9_runner", ROOT / "scripts/run-online-storefront-natural-language-policy.py")
    proto = copy.deepcopy(json.loads(CF.V9_PROTOCOL.read_text(encoding="utf-8")))
    proto["sampling"].update(tasksPerCategory=115, taskCount=460, taskModelUnitCount=920)
    base = {u["unit"]: u for u in json.loads((CF.PRIVATE / "units.json").read_text(encoding="utf-8"))["units"]}
    units = []
    for unit in v9.study_units(proto):
        key = f"{unit['category']}/{unit['taskId']}/{unit['modelFamily']}"
        b = base[key]
        if (ON.canonical(b["states"]["immediate"]) != ON.canonical(unit["states"]["immediate-a"])
                or ON.canonical(b["states"]["held"]) != ON.canonical(unit["states"]["held-a"])):
            raise SystemExit(f"{key}: rebuilt shelf differs from the check-first unit file")
        task = unit["task"]
        facts = {}
        for alias, item in unit["aliases"].items():
            product = unit["products"][item]
            facts[alias] = {
                "isRequestedType": task["family"] in product["tokens"],
                "hasRequestedAttribute": task["attribute"] in product["tokens"],
                "withinBudget": task["budget"] is None or (product["price"] is not None and product["price"] <= task["budget"]),
            }
            if all(facts[alias].values()) != unit["evaluations"][alias]["constraintMatch"]:
                raise SystemExit(f"{key} {alias}: facts disagree with the frozen constraint evaluation")
        served = [r["candidateId"] for r in b["states"]["immediate"]["candidates"]]
        states = dict(b["states"])
        for which in ("random1", "random2"):
            by_id = {r["candidateId"]: r for r in b["states"]["immediate"]["candidates"]}
            states[which] = {**b["states"]["immediate"],
                             "candidates": [by_id[a] for a in random_order(key, which, served)]}
        units.append({"unit": key, "states": states, "facts": facts, "evaluations": b["evaluations"]})
    if len(units) != 920:
        raise SystemExit(f"{len(units)} units, expected 920")
    ON.write_json(PRIVATE / "units.json", {"builtAt": datetime.now(timezone.utc).isoformat(), "units": units}, pretty=False)
    same = sum(u["states"]["random1"]["candidates"] == u["states"]["random2"]["candidates"] for u in units)
    return {"units": len(units), "random1EqualsRandom2": same, "file": str((PRIVATE / "units.json").relative_to(ROOT))}


# ---------- payloads ----------

def load_protocol():
    text = PROTOCOL.read_text(encoding="utf-8")
    return json.loads(text), ON.sha256(text.encode("utf-8"))


def with_facts(state: dict, facts: dict) -> dict:
    return {**state, "candidates": [{**r, **facts[r["candidateId"]]} for r in state["candidates"]]}


def plan(provider: str, protocol: dict) -> list:
    units = json.loads((PRIVATE / "units.json").read_text(encoding="utf-8"))["units"]
    plain = {"stateFields": {}, "outputTokenLimit": None}
    calls = []
    for condition in protocol["conditions"]:
        cid = condition["id"]
        for u in units:
            for slot in SLOTS[cid]:
                state = u["states"][side_of(slot)]
                if cid == "F1-facts":
                    state = with_facts(state, u["facts"])
                calls.append({"condition": cid, "unit": u["unit"], "slot": slot,
                              "scope": f"vote-facts/{cid}/{u['unit']}/{slot}",
                              "payload": CF.payload(provider, state, plain)})
    random.Random(protocol["execution"]["shuffleSeed"]).shuffle(calls)
    return calls


# ---------- execution（与 run-check-first 相同，只换了目录）----------

def run_call(provider: str, call: dict, ledger, timeout: int) -> dict:
    key = ON.sha256(ON.canonical({"provider": provider, "scope": call["scope"], "payload": call["payload"]}))
    path = PRIVATE / provider / "responses" / f"{key}.json"
    aliases = {c["candidateId"] for c in json.loads(ON.shelf_text(provider, call["payload"]))["candidates"]}
    if path.exists():
        record = json.loads(path.read_text(encoding="utf-8"))
        ledger.bump("cacheHitCount")
        return {**call, "label": record["label"]}
    body, record, result = call["payload"], None, None
    for attempt in range(3):
        result = ON.post(provider, body, timeout, ledger)
        try:
            action = ON.parse_action(ON.response_text(result, provider), aliases)
            record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"],
                      "retryPrompt": attempt > 0, "request": body, "response": result, "action": action,
                      "label": ON.label(action), "recordedAt": datetime.now(timezone.utc).isoformat()}
            break
        except (ValueError, json.JSONDecodeError):
            ledger.bump("invalidOutputRetryCount")
            body = ON.with_shelf(provider, call["payload"], ON.shelf_text(provider, call["payload"]) + ON.RETRY_NOTE)
    if record is None:
        ledger.bump("protocolFailureCount")
        record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"], "retryPrompt": True,
                  "request": call["payload"], "response": result, "action": {"action": "failure"},
                  "label": "__PROTOCOL_FAILURE__", "recordedAt": datetime.now(timezone.utc).isoformat()}
    ON.write_json(path, record)
    return {**call, "label": record["label"]}


def execute(provider: str, workers: int, cap: float, limit, timeout: int) -> None:
    protocol, protocol_sha = load_protocol()
    if not ON.api_key(provider):
        raise SystemExit(f"{provider}: no API key in {ON.ENV_FILES[provider]} or the environment")
    calls = plan(provider, protocol)
    if limit:
        keep = sorted({c["unit"] for c in calls})[:limit]
        calls = [c for c in calls if c["unit"] in keep]
    ledger = ON.Ledger(provider, cap)
    started, done, results = time.monotonic(), 0, []
    print(f"{provider}: {len(calls)} calls, {workers} workers, cap {cap} {ON.PRICING[provider]['currency']}", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(run_call, provider, call, ledger, timeout) for call in calls]
        for future in as_completed(futures):
            results.append({k: v for k, v in future.result().items() if k != "payload"})
            done += 1
            if done % 500 == 0 or done == len(calls):
                print(f"{provider}: {done}/{len(calls)}  {done / max(1e-9, time.monotonic() - started):.1f}/s  "
                      f"spent {ledger.spent():.4f} {ON.PRICING[provider]['currency']}", flush=True)
    stats = dict(ledger.stats)
    stats["fingerprints"] = sorted(stats["fingerprints"])
    stats["returnedModels"] = sorted(stats["returnedModels"])
    stats["observedCost"] = round(ledger.spent(), 6)
    stats["currency"] = ON.PRICING[provider]["currency"]
    results.sort(key=lambda r: (r["condition"], r["unit"], r["slot"]))
    suffix = f"-limit{limit}" if limit else ""
    ON.write_json(STUDY / "results" / f"calls-{provider}{suffix}.json",
                  {"provider": provider, "protocolSha256": protocol_sha,
                   "finishedAt": datetime.now(timezone.utc).isoformat(), "api": stats, "calls": results}, pretty=False)
    print(json.dumps(stats, indent=1), flush=True)


def dry_run(protocol: dict) -> None:
    for provider in PROVIDERS:
        calls = plan(provider, protocol)
        by = {}
        for c in calls:
            by[c["condition"]] = by.get(c["condition"], 0) + 1
        est_in = sum(len(ON.canonical(c["payload"])) for c in calls) / 3.3
        p = ON.PRICING[provider]
        print(f"{provider}: {len(calls)} calls {by}  ~{est_in / 1e6:.1f}M in  "
              f"~{est_in / 1e6 * p['input'] + len(calls) * 25 / 1e6 * p['output']:.2f} {p['currency']}")
        sample = next(c for c in calls if c["condition"] == "F1-facts")
        print("  F1 candidate keys:", sorted(json.loads(ON.shelf_text(provider, sample["payload"]))["candidates"][0]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--cap", type=float)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
    if args.prepare:
        print(json.dumps(prepare()), flush=True)
        return 0
    protocol, _ = load_protocol()
    if args.dry_run:
        dry_run(protocol)
        return 0
    if args.execute:
        if not args.provider:
            raise SystemExit("--execute needs --provider")
        cap = args.cap if args.cap is not None else protocol["execution"]["costCap"][args.provider]
        execute(args.provider, max(1, min(args.workers, 16)), cap, args.limit, args.timeout)
        return 0
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
