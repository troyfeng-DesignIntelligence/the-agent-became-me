"""Tie-rule experiment: when the task leaves a tie, can the task (not the shelf) decide the pick,
and can the agent say that a tie exists?

Post-study design experiment (2026-09-25), not part of the HAI '26 paper.
Protocol: experiments/tie-rule/PROTOCOL.md and protocol.json (frozen before any call).

Units are the verified Study 2 shelves from the order-notice experiment
(artifacts/order-notice/units-<provider>.json) that offer at least one eligible candidate.
The only change a condition makes is a task field added to the shelf, and in T2 a larger
output token limit.

    python3 scripts/run-tie-rule.py --prepare              # select + verify units, no calls
    python3 scripts/run-tie-rule.py --dry-run              # build every payload, no calls
    python3 scripts/run-tie-rule.py --execute --provider deepseek --workers 12 [--limit 5]
    python3 scripts/run-tie-rule.py --execute --provider mimo --workers 6 [--limit 5]

HTTP, retries, pricing, credentials and the cost ledger come from scripts/run-order-notice.py
unchanged. Keys are read from .env.deepseek / .env and never written.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("order_notice", ROOT / "scripts/run-order-notice.py")
ON = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ON)

STUDY = ROOT / "experiments/tie-rule"
PROTOCOL = STUDY / "protocol.json"
PRIVATE = ROOT / "artifacts/tie-rule"
SOURCE = ROOT / "artifacts/order-notice"
PROVIDERS = ON.PROVIDERS
SLOTS = ON.SLOTS


def shelf_of(provider: str, request: dict) -> dict:
    return json.loads(ON.shelf_text(provider, request))


def tie_facts(shelf: dict) -> dict:
    eligible = [c for c in shelf["candidates"] if c["constraintMatch"]]
    if not eligible:
        return {"eligible": False}
    best = max(c["taskUtility"] for c in eligible)
    tie_set = sorted(c["candidateId"] for c in eligible if c["taskUtility"] == best)
    return {"eligible": True, "tieSet": tie_set, "isTie": len(tie_set) > 1, "ruleAnswer": tie_set[0]}


# ---------- prepare ----------

def prepare(provider: str, protocol: dict) -> dict:
    units = json.loads((SOURCE / f"units-{provider}.json").read_text(encoding="utf-8"))["units"]
    kept = []
    for u in units:
        facts = {side: tie_facts(shelf_of(provider, u["served"][side])) for side in ("immediate", "held")}
        if facts["immediate"] != facts["held"]:
            raise SystemExit(f"{u['unit']}: tie facts differ between arms")
        ids = {side: sorted(c["candidateId"] for c in shelf_of(provider, u["served"][side])["candidates"])
               for side in ("immediate", "held")}
        if ids["immediate"] != ids["held"]:
            raise SystemExit(f"{u['unit']}: candidate sets differ between arms")
        if facts["immediate"]["eligible"]:
            kept.append({**u, "tie": facts["immediate"]})
    ties = sum(u["tie"]["isTie"] for u in kept)
    expect = protocol["units"]
    if len(kept) != expect["expectedCount"] or ties != expect["expectedTieUnits"]:
        raise SystemExit(f"{provider}: {len(kept)} units / {ties} ties, protocol expects "
                         f"{expect['expectedCount']} / {expect['expectedTieUnits']}")
    out = PRIVATE / f"units-{provider}.json"
    ON.write_json(out, {"provider": provider, "source": str((SOURCE / f'units-{provider}.json').relative_to(ROOT)),
                        "selectedAt": datetime.now(timezone.utc).isoformat(), "units": kept}, pretty=False)
    return {"provider": provider, "units": len(kept), "tieUnits": ties, "file": str(out.relative_to(ROOT))}


# ---------- payloads ----------

def load_protocol() -> tuple:
    text = PROTOCOL.read_text(encoding="utf-8")
    return json.loads(text), ON.sha256(text.encode("utf-8"))


def conditioned(provider: str, request: dict, condition: dict) -> dict:
    shelf = shelf_of(provider, request)
    for key, value in condition["shelfFields"].items():
        if key in shelf:
            raise SystemExit(f"shelf already carries {key}")
        shelf[key] = value
    out = ON.with_shelf(provider, request, ON.canonical(shelf).decode("utf-8"))
    if condition["outputTokenLimit"]:
        out["max_output_tokens" if provider == "mimo" else "max_tokens"] = condition["outputTokenLimit"]
    return out


def plan(provider: str, protocol: dict) -> list:
    units = json.loads((PRIVATE / f"units-{provider}.json").read_text(encoding="utf-8"))["units"]
    calls = []
    for condition in protocol["conditions"]:
        for unit in units:
            payloads = {side: conditioned(provider, unit["served"][side], condition) for side in ("immediate", "held")}
            for slot in SLOTS:
                side = "held" if slot.startswith("held") else "immediate"
                calls.append({"condition": condition["id"], "unit": unit["unit"], "slot": slot,
                              "scope": f"tie-rule/{condition['id']}/{unit['unit']}/{slot}",
                              "payload": payloads[side]})
    random.Random(protocol["execution"]["shuffleSeed"]).shuffle(calls)
    return calls


# ---------- execution ----------

def reported_ids(text: str):
    """T2：从合法的回答里取 equallyGoodIds。缺失或格式不对 = 没有报告（不触发重试）。"""
    try:
        stripped = text.strip()
        match = ON.re.search(r"\{.*\}", stripped, flags=ON.re.S)
        value = json.loads(match.group(0)) if match else {}
    except (ValueError, AttributeError):
        return None
    ids = value.get("equallyGoodIds")
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
        return None
    return ids


def run_call(provider: str, call: dict, ledger, timeout: int) -> dict:
    key = ON.sha256(ON.canonical({"provider": provider, "scope": call["scope"], "payload": call["payload"]}))
    path = PRIVATE / provider / "responses" / f"{key}.json"
    aliases = {c["candidateId"] for c in shelf_of(provider, call["payload"])["candidates"]}
    if path.exists():
        record = json.loads(path.read_text(encoding="utf-8"))
        ledger.bump("cacheHitCount")
        return {**call, "label": record["label"], "reported": record.get("reported")}
    payload, record, result = call["payload"], None, None
    for attempt in range(3):
        result = ON.post(provider, payload, timeout, ledger)
        text = ON.response_text(result, provider)
        try:
            action = ON.parse_action(text, aliases)
            record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"],
                      "retryPrompt": attempt > 0, "request": payload, "response": result,
                      "action": action, "label": ON.label(action),
                      "reported": reported_ids(text) if call["condition"] == "T2-report" else None,
                      "recordedAt": datetime.now(timezone.utc).isoformat()}
            break
        except (ValueError, json.JSONDecodeError):
            ledger.bump("invalidOutputRetryCount")
            payload = ON.with_shelf(provider, call["payload"], ON.shelf_text(provider, call["payload"]) + ON.RETRY_NOTE)
    if record is None:
        ledger.bump("protocolFailureCount")
        record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"], "retryPrompt": True,
                  "request": call["payload"], "response": result, "action": {"action": "failure"},
                  "label": "__PROTOCOL_FAILURE__", "reported": None,
                  "recordedAt": datetime.now(timezone.utc).isoformat()}
    ON.write_json(path, record)
    return {**call, "label": record["label"], "reported": record["reported"]}


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
                rate = done / max(1e-9, time.monotonic() - started)
                print(f"{provider}: {done}/{len(calls)}  {rate:.1f}/s  spent {ledger.spent():.4f} "
                      f"{ON.PRICING[provider]['currency']}", flush=True)
    stats = dict(ledger.stats)
    stats["fingerprints"] = sorted(stats["fingerprints"])
    stats["returnedModels"] = sorted(stats["returnedModels"])
    stats["observedCost"] = round(ledger.spent(), 6)
    stats["currency"] = ON.PRICING[provider]["currency"]
    results.sort(key=lambda r: (r["condition"], r["unit"], r["slot"]))
    suffix = f"-limit{limit}" if limit else ""
    ON.write_json(STUDY / "results" / f"calls-{provider}{suffix}.json",
                  {"provider": provider, "protocolSha256": protocol_sha,
                   "finishedAt": datetime.now(timezone.utc).isoformat(), "api": stats, "calls": results},
                  pretty=False)
    print(json.dumps(stats, indent=1), flush=True)


def dry_run(protocol: dict) -> None:
    for provider in PROVIDERS:
        calls = plan(provider, protocol)
        by = {}
        for c in calls:
            by[c["condition"]] = by.get(c["condition"], 0) + 1
        size = sum(len(ON.canonical(c["payload"])) for c in calls)
        est_tokens = size / 3.1
        p = ON.PRICING[provider]
        est = est_tokens / 1e6 * p["input"] + len(calls) * 40 / 1e6 * p["output"]
        print(f"{provider}: {len(calls)} calls {by}  ~{est_tokens/1e6:.2f}M input tokens  ~{est:.2f} {p['currency']}")
        for cid in ("T1-rule", "T2-report"):
            sample = next(c for c in calls if c["condition"] == cid)
            shelf = shelf_of(provider, sample["payload"])
            limit = sample["payload"].get("max_output_tokens" if provider == "mimo" else "max_tokens")
            print(f"  {cid}: shelf keys {list(shelf)}  output limit {limit}")


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
    protocol, _ = load_protocol()
    if args.prepare:
        for provider in PROVIDERS:
            print(json.dumps(prepare(provider, protocol)), flush=True)
        return 0
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
