"""Order-notice experiment: can a platform warn an agent that the shelf order is its own?

Post-study design experiment (2026-09-23), not part of the HAI '26 paper.
Protocol: experiments/order-notice/PROTOCOL.md and protocol.json (frozen before any call).

It reuses the exact 920 Study 2 served-order shelves from the private research-runtime
cache (artifacts/online-storefront-instrument-ablation-confirmatory/). Nothing is rebuilt:
each payload is taken byte-for-byte from the cache and checked against the published
result rows before use. The only change a condition makes is one added shelf field.

    python3 scripts/run-order-notice.py --prepare              # extract + verify, no calls
    python3 scripts/run-order-notice.py --dry-run              # build every payload, no calls
    python3 scripts/run-order-notice.py --execute --provider deepseek --workers 12
    python3 scripts/run-order-notice.py --execute --provider mimo --workers 6

Credentials follow scripts/run-agent-interviews.py: .env.deepseek and .env at the
repository root (both gitignored); an exported variable wins. Keys are never written.
Full payloads and responses stay under artifacts/ (gitignored, private).
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import pathlib
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = ROOT / "experiments/order-notice"
PROTOCOL = STUDY / "protocol.json"
PRIVATE = ROOT / "artifacts/order-notice"
STUDY2_CACHE = ROOT / "artifacts/online-storefront-instrument-ablation-confirmatory"
STUDY2_ROWS = ROOT / "public/results/online-storefront-instrument-ablation-confirmatory/v1"
SUPPLEMENT = ROOT / "experiments/hai-2026-camera-ready/supplement"

PROVIDERS = ("deepseek", "mimo")
MODES = ("served-order", "masked-control")
ARMS = ("immediate-a", "immediate-b", "held-a", "held-b")
# 每个条件、每个单元 6 次调用。sham 两次和 immediate 用同一份载荷，
# 于是 immediate-a/b + sham-a/b 是同一货架的四次独立调用：噪声底线。
SLOTS = ("immediate-a", "immediate-b", "held-a", "held-b", "sham-a", "sham-b")
PUBLISHED_SWAPS = {
    "deepseek": {"served-order": 88, "masked-control": 3},
    "mimo": {"served-order": 68, "masked-control": 2},
}
PRICING = {
    "deepseek": {"currency": "USD", "input": 0.14, "output": 0.28},
    "mimo": {"currency": "CNY", "input": 1.00, "output": 2.00},
}
ENV_FILES = {"deepseek": ".env.deepseek", "mimo": ".env"}
RETRY_NOTE = "\nPrevious output was invalid. Return only the required JSON object."


# ---------- shared helpers (same conventions as the study's own runners) ----------

def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_env_file(path: pathlib.Path) -> dict:
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def setting(provider: str, name: str, default: str = "") -> str:
    from_environment = os.environ.get(name)
    if from_environment:
        return from_environment
    return load_env_file(ROOT / ENV_FILES[provider]).get(name, default)


def api_key(provider: str) -> str:
    return setting(provider, "MIMO_API_KEY" if provider == "mimo" else "DEEPSEEK_API_KEY")


def endpoint_and_headers(provider: str):
    if provider == "mimo":
        base = setting(provider, "MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").rstrip("/")
        return f"{base}/responses", {"api-key": api_key(provider),
                                     "Content-Type": "application/json"}
    base = setting(provider, "DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    return f"{base}/chat/completions", {"Authorization": f"Bearer {api_key(provider)}",
                                        "Content-Type": "application/json"}


def response_text(result: dict, provider: str) -> str:
    if provider == "mimo":
        direct = result.get("output_text")
        if isinstance(direct, str) and direct:
            return direct
        parts = []
        for item in result.get("output") or []:
            if item.get("type") != "message":
                continue
            for content in item.get("content") or []:
                if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                    parts.append(content["text"])
        return "".join(parts)
    choices = result.get("choices") or []
    if not choices:
        return ""
    content = (choices[0].get("message") or {}).get("content")
    return content if isinstance(content, str) else ""


def parse_action(text: str, aliases: set) -> dict:
    """scripts/run-online-storefront-llm-pilot.py parse_action, terminal phase, unchanged."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", stripped, flags=re.I)
    match = re.search(r"\{.*\}", stripped, flags=re.S)
    if not match:
        raise ValueError("no JSON object")
    value = json.loads(match.group(0))
    action = value.get("action")
    candidate = value.get("candidateId")
    if action not in {"select", "abandon"}:
        raise ValueError(f"invalid action {action!r}")
    if action == "abandon":
        candidate = None
    elif candidate not in aliases:
        raise ValueError("candidateId not in offered candidates")
    confidence = value.get("confidence")
    if not isinstance(confidence, (int, float)):
        confidence = None
    return {"action": action, "candidateId": candidate, "confidence": confidence}


def label(action: dict) -> str:
    if action["action"] == "failure":
        return "__PROTOCOL_FAILURE__"
    return "__ABANDON__" if action["action"] == "abandon" else action["candidateId"]


def shelf_text(provider: str, request: dict) -> str:
    return request["input"] if provider == "mimo" else request["messages"][1]["content"]


def with_shelf(provider: str, request: dict, text: str) -> dict:
    copy = json.loads(json.dumps(request))
    if provider == "mimo":
        copy["input"] = text
    else:
        copy["messages"][1]["content"] = text
    return copy


def consistent_swap(labels: dict, left: str, right: str) -> bool:
    """论文重算口径：两臂各自两次一致，且两臂之间不同。"""
    return (labels[f"{left}-a"] == labels[f"{left}-b"]
            and labels[f"{right}-a"] == labels[f"{right}-b"]
            and labels[f"{left}-a"] != labels[f"{right}-a"])


def write_json(path: pathlib.Path, payload, pretty: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2 if pretty else None, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    tmp.replace(path)


# ---------- prepare: take the 920 shelves out of the Study 2 cache and prove they are the ones ----------

def prepare(provider: str) -> dict:
    responses = STUDY2_CACHE / provider / "responses"
    if not responses.exists():
        raise SystemExit(f"{responses} missing — extract the research-runtime add-on at the repo root")
    cache = {}
    for path in sorted(responses.glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        scope = record["cacheScope"]
        parts = scope.split("/")
        if len(parts) != 6 or parts[0] != "instrument-ablation":
            raise SystemExit(f"unexpected cache scope {scope}")
        _, category, task, family, mode, arm = parts
        if mode not in MODES:
            continue
        expected_key = sha256(canonical({"provider": provider, "scope": scope,
                                         "payload": record["request"]}))
        if expected_key != record["requestSha256"] or path.stem != expected_key:
            raise SystemExit(f"cache key does not match stored request: {path.name}")
        key = (f"{category}/{task}/{family}", mode, arm)
        if key in cache:
            raise SystemExit(f"duplicate cache entry for {key}")
        cache[key] = record

    rows = json.loads((STUDY2_ROWS / provider / "rows.json").read_text(encoding="utf-8"))["rows"]
    masked_actions = {f"{r['category']}/{r['taskId']}/{r['modelFamily']}": r["actions"]
                      for r in rows if r["mode"] == "masked-control"}
    units, swaps = [], {mode: 0 for mode in MODES}
    for row in rows:
        if row["mode"] not in MODES:
            continue
        unit = f"{row['category']}/{row['taskId']}/{row['modelFamily']}"
        labels = {}
        for arm in ARMS:
            record = cache[(unit, row["mode"], arm)]
            text = shelf_text(provider, record["request"])
            shelf = json.loads(text)
            if canonical(shelf).decode("utf-8") != text:
                raise SystemExit(f"{unit} {arm}: shelf does not round-trip byte-for-byte")
            order = [c["candidateId"] for c in shelf["candidates"]]
            if order != row["auditPrimitives"]["candidateLayouts"][arm]:
                raise SystemExit(f"{unit} {row['mode']} {arm}: order differs from published layout")
            action = parse_action(response_text(record["response"], provider), set(order))
            labels[arm] = label(action)
            if labels[arm] != row["actions"][arm]:
                raise SystemExit(f"{unit} {row['mode']} {arm}: cached action differs from published row")
        for side in ("immediate", "held"):
            a = cache[(unit, row["mode"], f"{side}-a")]["request"]
            b = cache[(unit, row["mode"], f"{side}-b")]["request"]
            if canonical(a) != canonical(b):
                raise SystemExit(f"{unit} {row['mode']} {side}: replicates are not byte-identical")
        if consistent_swap(labels, "immediate", "held"):
            swaps[row["mode"]] += 1
        if row["mode"] == "served-order":
            units.append({
                "unit": unit,
                "served": {side: cache[(unit, "served-order", f"{side}-a")]["request"]
                           for side in ("immediate", "held")},
                "masked": cache[(unit, "masked-control", "immediate-a")]["request"],
                "study2": {"served-order": labels, "masked-control": masked_actions[unit]},
            })
    for mode in MODES:
        if swaps[mode] != PUBLISHED_SWAPS[provider][mode]:
            raise SystemExit(f"{provider} {mode}: recomputed {swaps[mode]}/920, "
                             f"expected {PUBLISHED_SWAPS[provider][mode]}/920")
    if len(units) != 920:
        raise SystemExit(f"{provider}: {len(units)} served units, expected 920")
    out = PRIVATE / f"units-{provider}.json"
    write_json(out, {"provider": provider, "source": "Study 2 response cache",
                     "verifiedAt": datetime.now(timezone.utc).isoformat(), "units": units},
               pretty=False)
    changed = sum(1 for u in units
                  if canonical(u["served"]["immediate"]) != canonical(u["served"]["held"]))
    return {"provider": provider, "units": len(units), "orderChangedUnits": changed,
            "swaps": swaps, "file": str(out.relative_to(ROOT))}


# ---------- payloads for a condition ----------

def load_protocol() -> tuple:
    text = PROTOCOL.read_text(encoding="utf-8")
    return json.loads(text), sha256(text.encode("utf-8"))


def noticed(provider: str, request: dict, notice) -> dict:
    if notice is None:
        return request
    shelf = json.loads(shelf_text(provider, request))
    if "aboutOrder" in shelf:
        raise SystemExit("shelf already carries aboutOrder")
    shelf["aboutOrder"] = notice
    return with_shelf(provider, request, canonical(shelf).decode("utf-8"))


def plan(provider: str, protocol: dict) -> list:
    units = json.loads((PRIVATE / f"units-{provider}.json").read_text(encoding="utf-8"))["units"]
    calls = []
    for condition in protocol["conditions"]:
        for unit in units:
            payloads = {side: noticed(provider, unit["served"][side], condition["notice"])
                        for side in ("immediate", "held")}
            for slot in SLOTS:
                side = "held" if slot.startswith("held") else "immediate"
                calls.append({"condition": condition["id"], "unit": unit["unit"], "slot": slot,
                              "scope": f"order-notice/{condition['id']}/{unit['unit']}/{slot}",
                              "payload": payloads[side]})
    random.Random(protocol["execution"]["shuffleSeed"]).shuffle(calls)
    return calls


# ---------- execution ----------

class Ledger:
    def __init__(self, provider: str, cap: float):
        self.provider, self.cap = provider, cap
        self.lock = threading.Lock()
        self.stats = {"requestCount": 0, "cacheHitCount": 0, "transportRetryCount": 0,
                      "invalidOutputRetryCount": 0, "protocolFailureCount": 0,
                      "inputTokens": 0, "outputTokens": 0, "fingerprints": set(),
                      "returnedModels": set()}

    def spent(self) -> float:
        p = PRICING[self.provider]
        return self.stats["inputTokens"] / 1e6 * p["input"] + self.stats["outputTokens"] / 1e6 * p["output"]

    def account(self, result: dict) -> None:
        usage = result.get("usage") or {}
        with self.lock:
            self.stats["inputTokens"] += int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
            self.stats["outputTokens"] += int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
            if isinstance(result.get("system_fingerprint"), str):
                self.stats["fingerprints"].add(result["system_fingerprint"])
            if isinstance(result.get("model"), str):
                self.stats["returnedModels"].add(result["model"])

    def bump(self, key: str) -> None:
        with self.lock:
            self.stats[key] += 1


def post(provider: str, payload: dict, timeout: int, ledger: Ledger) -> dict:
    endpoint, headers = endpoint_and_headers(provider)
    last = None
    for attempt in range(6):
        if ledger.spent() >= ledger.cap:
            raise SystemExit(f"{provider}: cost cap {ledger.cap} {PRICING[provider]['currency']} reached")
        ledger.bump("requestCount")
        try:
            request = urllib.request.Request(endpoint, data=canonical(payload),
                                             headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
            ledger.account(result)
            return result
        except urllib.error.HTTPError as error:
            body = ""
            try:
                body = error.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
            last = f"HTTP {error.code} {error.reason} {body}".strip()
            if error.code in (400, 401, 402, 403, 404):
                raise SystemExit(f"{provider}: {last}")
        except (OSError, http.client.HTTPException, json.JSONDecodeError) as error:
            last = f"{type(error).__name__}: {error}"
        ledger.bump("transportRetryCount")
        time.sleep(min(2 ** attempt, 20) + random.random())
    raise SystemExit(f"{provider}: request failed after transport retries: {last}")


def run_call(provider: str, call: dict, ledger: Ledger, timeout: int) -> dict:
    key = sha256(canonical({"provider": provider, "scope": call["scope"], "payload": call["payload"]}))
    path = PRIVATE / provider / "responses" / f"{key}.json"
    aliases = {c["candidateId"] for c in json.loads(shelf_text(provider, call["payload"]))["candidates"]}
    if path.exists():
        record = json.loads(path.read_text(encoding="utf-8"))
        ledger.bump("cacheHitCount")
        return {**call, "label": record["label"]}
    payload = call["payload"]
    record = None
    for attempt in range(3):  # 与 Study 2 相同：最多两次带提示的重试
        result = post(provider, payload, timeout, ledger)
        try:
            action = parse_action(response_text(result, provider), aliases)
            record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"],
                      "retryPrompt": attempt > 0, "request": payload, "response": result,
                      "action": action, "label": label(action),
                      "recordedAt": datetime.now(timezone.utc).isoformat()}
            break
        except (ValueError, json.JSONDecodeError):
            ledger.bump("invalidOutputRetryCount")
            text = shelf_text(provider, call["payload"]) + RETRY_NOTE
            payload = with_shelf(provider, call["payload"], text)
    if record is None:
        ledger.bump("protocolFailureCount")
        record = {"requestSha256": key, "provider": provider, "cacheScope": call["scope"],
                  "retryPrompt": True, "request": call["payload"], "response": result,
                  "action": {"action": "failure"}, "label": "__PROTOCOL_FAILURE__",
                  "recordedAt": datetime.now(timezone.utc).isoformat()}
    write_json(path, record)
    return {**call, "label": record["label"]}


def execute(provider: str, workers: int, cap: float, limit, timeout: int) -> None:
    protocol, protocol_sha = load_protocol()
    if not api_key(provider):
        raise SystemExit(f"{provider}: no API key in {ENV_FILES[provider]} or the environment")
    calls = plan(provider, protocol)
    if limit:
        keep = sorted({c["unit"] for c in calls})[:limit]
        calls = [c for c in calls if c["unit"] in keep]
    ledger = Ledger(provider, cap)
    started = time.monotonic()
    done, results = 0, []
    print(f"{provider}: {len(calls)} calls, {workers} workers, cap {cap} {PRICING[provider]['currency']}",
          flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(run_call, provider, call, ledger, timeout) for call in calls]
        for future in as_completed(futures):
            results.append({k: v for k, v in future.result().items() if k != "payload"})
            done += 1
            if done % 500 == 0 or done == len(calls):
                rate = done / max(1e-9, time.monotonic() - started)
                print(f"{provider}: {done}/{len(calls)}  {rate:.1f}/s  spent "
                      f"{ledger.spent():.4f} {PRICING[provider]['currency']}", flush=True)
    stats = dict(ledger.stats)
    stats["fingerprints"] = sorted(stats["fingerprints"])
    stats["returnedModels"] = sorted(stats["returnedModels"])
    stats["observedCost"] = round(ledger.spent(), 6)
    stats["currency"] = PRICING[provider]["currency"]
    results.sort(key=lambda r: (r["condition"], r["unit"], r["slot"]))
    suffix = f"-limit{limit}" if limit else ""
    write_json(STUDY / "results" / f"calls-{provider}{suffix}.json",
               {"provider": provider, "protocolSha256": protocol_sha,
                "finishedAt": datetime.now(timezone.utc).isoformat(),
                "api": stats, "calls": results}, pretty=False)
    print(json.dumps({k: v for k, v in stats.items()}, indent=1), flush=True)


def dry_run(protocol: dict) -> None:
    for provider in PROVIDERS:
        calls = plan(provider, protocol)
        by_condition = {}
        for c in calls:
            by_condition.setdefault(c["condition"], 0)
            by_condition[c["condition"]] += 1
        sizes = [len(canonical(c["payload"])) for c in calls]
        est_tokens = sum(sizes) / 3.1  # Study 2: 11.94M tokens over 14,720 calls of the same shelves
        p = PRICING[provider]
        est = est_tokens / 1e6 * p["input"] + len(calls) * 22 / 1e6 * p["output"]
        print(f"{provider}: {len(calls)} calls {by_condition}  ~{est_tokens/1e6:.1f}M input tokens"
              f"  ~{est:.2f} {p['currency']}")
        sample = next(c for c in calls if c["condition"] != protocol["conditions"][0]["id"])
        shelf = json.loads(shelf_text(provider, sample["payload"]))
        print(f"  sample shelf keys: {list(shelf)}  notice: {shelf.get('aboutOrder')!r}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--cap", type=float)
    parser.add_argument("--limit", type=int, help="only the first N units (smoke test)")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
    if args.prepare:
        for provider in PROVIDERS:
            print(json.dumps(prepare(provider)), flush=True)
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
