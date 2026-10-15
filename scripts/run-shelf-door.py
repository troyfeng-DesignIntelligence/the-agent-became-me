"""Shelf and door together (2026-10-05): facts on the shelf, a random-order re-ask before the record. One shuffled batch.

Post-study design experiment, not part of the HAI '26 paper.
Protocol: experiments/shelf-door/PROTOCOL.md and protocol.json (frozen before any call).

    python3 scripts/run-shelf-door.py --dry-run
    python3 scripts/run-shelf-door.py --execute --provider deepseek --workers 12 [--limit 5]
    python3 scripts/run-shelf-door.py --execute --provider mimo --workers 8 [--limit 5]

Shelves, facts and random orders come from artifacts/vote-facts/units.json unchanged; payloads, HTTP, retries, pricing
and the cost ledger from scripts/run-vote-facts.py. Every call is new (cache scope 'shelf-door/...').
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


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VF = load("vote_facts", ROOT / "scripts/run-vote-facts.py")
CF, ON = VF.CF, VF.ON
STUDY = ROOT / "experiments/shelf-door"
PROTOCOL = STUDY / "protocol.json"
PRIVATE = ROOT / "artifacts/shelf-door"
UNITS = ROOT / "artifacts/vote-facts/units.json"
UNITS_SHA = "ff5e848799914d856b08fb213f7155ee01f5e5678199d120a830e9fdd473b98a"
VF.PRIVATE = PRIVATE  # 回复缓存放到本实验自己的目录
PROVIDERS = ON.PROVIDERS


def load_protocol():
    text = PROTOCOL.read_text(encoding="utf-8")
    return json.loads(text), ON.sha256(text.encode("utf-8"))


def plan(provider: str, protocol: dict) -> list:
    raw = UNITS.read_bytes()
    if ON.sha256(raw) != UNITS_SHA:
        raise SystemExit("artifacts/vote-facts/units.json changed since the protocol was frozen")
    units = json.loads(raw.decode("utf-8"))["units"]
    plain = {"stateFields": {}, "outputTokenLimit": None}
    calls = []
    for condition in protocol["conditions"]:
        cid = condition["id"]
        for u in units:
            for slot in condition["slots"]:
                state = u["states"][VF.side_of(slot)]
                if cid == "F1-facts":
                    state = VF.with_facts(state, u["facts"])
                calls.append({"condition": cid, "unit": u["unit"], "slot": slot,
                              "scope": f"shelf-door/{cid}/{u['unit']}/{slot}",
                              "payload": CF.payload(provider, state, plain)})
    random.Random(protocol["execution"]["shuffleSeed"]).shuffle(calls)
    return calls


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
        futures = [pool.submit(VF.run_call, provider, call, ledger, timeout) for call in calls]
        try:
            for future in as_completed(futures):
                results.append({k: v for k, v in future.result().items() if k != "payload"})
                done += 1
                if done % 500 == 0 or done == len(calls):
                    print(f"{provider}: {done}/{len(calls)}  {done / max(1e-9, time.monotonic() - started):.1f}/s  "
                          f"spent {ledger.spent():.4f} {ON.PRICING[provider]['currency']}", flush=True)
        except SystemExit as stop:
            # 余额不足等：取消还没开始的调用，已拿到的回复都在缓存里，充值后重跑即可续上
            for f in futures:
                f.cancel()
            print(f"STOPPED after {done} calls: {stop}", flush=True)
            raise
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--cap", type=float)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
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
