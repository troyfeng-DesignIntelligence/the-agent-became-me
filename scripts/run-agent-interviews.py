"""Post-study interview probe: interview the study's two providers about a frozen record.

This is a design-research instrument, not an experiment. It adds no number to any
published result. See experiments/agent-interviews/PROTOCOL.md.

Credentials follow the convention the study's own runners use: one dotenv file per
provider at the repository root, both already in .gitignore. An exported shell variable
wins over the file if both are present. Keys are never written to disk by this script
and never appear in a transcript.

    .env.deepseek    DEEPSEEK_API_KEY=...   (optional DEEPSEEK_BASE_URL)
    .env             MIMO_API_KEY=...       (optional MIMO_BASE_URL)

Dry run first — it builds and stores every payload without calling anything:
    python3 scripts/run-agent-interviews.py --dry-run

Then, with keys exported in your own shell:
    python3 scripts/run-agent-interviews.py --repeats 3
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = ROOT / "experiments/agent-interviews"
SUPPLEMENT = ROOT / "experiments/hai-2026-camera-ready/supplement"

MODELS = {"deepseek": "deepseek-v4-flash", "mimo": "mimo-v2.5"}
# 每百万 token 的价格。这两组数能逐位重现 *-summary-original.json 里记录的观测成本，
# check_pricing() 每次启动都验一遍。只用于花费上限，不作为报价。
PRICING = {
    "deepseek": {"currency": "USD", "input": 0.14, "output": 0.28},
    "mimo": {"currency": "CNY", "input": 1.00, "output": 2.00},
}
MAX_OUTPUT_TOKENS = 220


ENV_FILES = {"deepseek": ".env.deepseek", "mimo": ".env"}


def load_env_file(path: pathlib.Path) -> dict[str, str]:
    """和 scripts/run-online-storefront-cross-llm-pilot.py 的 load_env 同一套读法。"""
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
    """先看已导出的环境变量，再看该提供方的 dotenv 文件。"""
    from_environment = os.environ.get(name)
    if from_environment:
        return from_environment
    return load_env_file(ROOT / ENV_FILES[provider]).get(name, default)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def check_pricing() -> None:
    """价格表必须能重现两份 run summary 里记录的观测成本，否则上限就是假的。"""
    for provider, rate in PRICING.items():
        api = json.loads(
            (SUPPLEMENT / f"{provider}-summary-original.json").read_text(encoding="utf-8")
        )["api"]
        implied = (api["inputTokens"] / 1e6 * rate["input"]
                   + api["outputTokens"] / 1e6 * rate["output"])
        recorded = api["observedCostAtPublishedRates"]
        if api["currency"] != rate["currency"] or abs(implied - recorded) > 1e-6:
            raise SystemExit(
                f"{provider}: pricing table no longer reproduces the recorded cost "
                f"({implied:.6f} vs {recorded:.6f} {api['currency']})")


def load_guide() -> dict:
    guide = json.loads((STUDY / "interview-guide.json").read_text(encoding="utf-8"))
    req = json.loads((SUPPLEMENT / "deepseek-served-order-requests.json").read_text())
    if req["unit"] != guide["groundingUnit"]:
        raise SystemExit(f"grounding unit mismatch: {req['unit']}")

    system_prompt = req["requests"]["immediate-a"]["messages"][0]["content"]
    arm_a = json.loads(req["requests"]["immediate-a"]["messages"][1]["content"])
    arm_b = json.loads(req["requests"]["held-a"]["messages"][1]["content"])
    ids_a = [c["candidateId"] for c in arm_a["candidates"]]
    ids_b = [c["candidateId"] for c in arm_b["candidates"]]
    if set(ids_a) != set(ids_b) or ids_a == ids_b:
        raise SystemExit("the two arms must share a candidate set and differ in order")

    false_id = guide["falsePremiseCandidateId"]
    if false_id in ids_a:
        raise SystemExit(f"false-premise id {false_id} was actually offered; pick another")

    guide.update(systemPrompt=system_prompt, armA=arm_a, armB=arm_b, idsA=ids_a, idsB=ids_b)
    return guide


def briefing(guide: dict) -> str:
    """访谈开场：把冻结记录原样放在受访者面前，不假装它就是当时那个 agent。"""
    return (
        "Below is a record from a completed research study.\n\n"
        "A shopping agent was run under this brief:\n"
        f"---\n{guide['systemPrompt']}\n---\n\n"
        "It was shown twelve candidates. The two orderings below contain the same twelve "
        "candidateId values with identical attributes; only the order differs.\n\n"
        f"Ordering A: {', '.join(guide['idsA'])}\n"
        f"Ordering B: {', '.join(guide['idsB'])}\n\n"
        "Full candidate record (identical in both orderings):\n"
        f"{json.dumps(guide['armA']['candidates'], separators=(',', ':'))}\n\n"
        f"Hard constraint sent with the task: {guide['armA']['hardConstraint']}\n\n"
        "Under ordering A the agent selected P-028899B8. Under ordering B it selected "
        "P-297F1137. Both repeats agreed within each ordering.\n\n"
        "You are the same model that produced that record. I am going to ask you about it."
    )


def payload_for(provider: str, instructions: str, turns: list[dict], temperature: float,
                max_tokens: int = MAX_OUTPUT_TOKENS) -> dict:
    model = MODELS[provider]
    if provider == "mimo":
        transcript = "\n\n".join(f"{t['role'].upper()}: {t['content']}" for t in turns)
        return {
            "model": model,
            "instructions": instructions,
            "input": transcript,
            "max_output_tokens": max_tokens,
            "stream": False,
            "reasoning": {"effort": "none"},
            "temperature": temperature,
        }
    return {
        "model": model,
        "messages": [{"role": "system", "content": instructions}] + turns,
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": "disabled"},
        "temperature": temperature,
    }


def api_key(provider: str) -> str:
    return setting(provider, "MIMO_API_KEY" if provider == "mimo" else "DEEPSEEK_API_KEY")


def endpoint_and_headers(provider: str) -> tuple[str, dict[str, str]]:
    if provider == "mimo":
        base = setting(provider, "MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").rstrip("/")
        return f"{base}/responses", {
            "api-key": api_key(provider),
            "Content-Type": "application/json",
        }
    base = setting(provider, "DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    return f"{base}/chat/completions", {
        "Authorization": f"Bearer {api_key(provider)}",
        "Content-Type": "application/json",
    }


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


def account(result: dict, stats: dict) -> None:
    usage = result.get("usage") or {}
    stats["inputTokens"] += int(
        usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    stats["outputTokens"] += int(
        usage.get("completion_tokens") or usage.get("output_tokens") or 0)


def spent(provider: str, stats: dict) -> float:
    p = PRICING[provider]
    return (stats["inputTokens"] / 1e6 * p["input"]
            + stats["outputTokens"] / 1e6 * p["output"])


def call(provider: str, payload: dict, cache_dir: pathlib.Path, stats: dict,
         cap: float, timeout: int, repeat: int) -> tuple[str, str]:
    key = sha256(canonical(
        {"provider": provider, "repeat": repeat, "payload": payload}))
    cached = cache_dir / f"{key}.json"
    if cached.exists():
        result = json.loads(cached.read_text(encoding="utf-8"))["response"]
        stats["cacheHitCount"] += 1
        account(result, stats)
        return response_text(result, provider), key

    if spent(provider, stats) >= cap:
        raise SystemExit(f"{provider}: cost cap {cap} {PRICING[provider]['currency']} reached")

    if not api_key(provider):
        raise SystemExit(
            f"{provider}: no API key. Put "
            f"{'MIMO_API_KEY' if provider == 'mimo' else 'DEEPSEEK_API_KEY'}=... in "
            f"{ENV_FILES[provider]} at the repository root, or export it in your shell.")
    endpoint, headers = endpoint_and_headers(provider)

    last = None
    for attempt in range(3):
        stats["requestCount"] += 1
        try:
            request = urllib.request.Request(
                endpoint, data=canonical(payload), headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
            text = response_text(result, provider).strip()
            if not text:
                raise ValueError("empty response")
            account(result, stats)
            cached.write_text(json.dumps(
                {"requestSha256": key, "provider": provider,
                 "request": payload, "response": result}, indent=2), encoding="utf-8")
            return text, key
        except urllib.error.HTTPError as error:
            body = ""
            try:
                body = error.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
            last = f"HTTP {error.code} {error.reason} {body}".strip()
            stats["failedAttemptCount"] += 1
            time.sleep(min(2 ** attempt, 4))
        except (OSError, http.client.HTTPException, json.JSONDecodeError,
                ValueError) as error:
            last = f"{type(error).__name__}: {error}"
            stats["failedAttemptCount"] += 1
            time.sleep(min(2 ** attempt, 4))
    raise SystemExit(f"{provider}: request failed after retries: {last}")


def run_session(provider: str, guide: dict, temperature: float, repeat: int,
                args, cache_dir: pathlib.Path, stats: dict) -> dict:
    instructions = guide["interviewerRole"]
    turns = [{"role": "user", "content": briefing(guide)}]
    answers = []
    for question in guide["questions"]:
        text = question["text"].replace("{{FALSE_PREMISE}}", guide["falsePremiseCandidateId"])
        turns.append({"role": "user", "content": text})
        limit = question.get("maxOutputTokens", MAX_OUTPUT_TOKENS)
        payload = payload_for(provider, instructions, turns, temperature, limit)
        if args.dry_run:
            reply, key = "", sha256(canonical(
                {"provider": provider, "repeat": repeat, "payload": payload}))
            (cache_dir.parent / "dry-run").mkdir(parents=True, exist_ok=True)
            (cache_dir.parent / "dry-run" /
             f"{provider}-t{temperature}-r{repeat}-{question['id']}.json").write_text(
                json.dumps(payload, indent=2), encoding="utf-8")
        else:
            reply, key = call(provider, payload, cache_dir, stats,
                              args.cost_cap, args.timeout, repeat)
        turns.append({"role": "assistant", "content": reply})
        answers.append({
            "questionId": question["id"],
            "kind": question["kind"],
            "maxOutputTokens": limit,
            "question": text,
            "answer": reply,
            "answerSha256": sha256(reply.encode("utf-8")) if reply else None,
            "requestSha256": key,
        })
    return {
        "provider": provider,
        "model": MODELS[provider],
        "temperature": temperature,
        "repeat": repeat,
        "answers": answers,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--providers", default="deepseek,mimo")
    ap.add_argument("--temperatures", default="0.0,1.0")
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--cost-cap", type=float, default=1.0,
                    help="per provider, in that provider's own currency")
    ap.add_argument("--timeout", type=int, default=90)
    ap.add_argument("--check-env", action="store_true",
                    help="report whether each key was found, without printing it")
    ap.add_argument("--dry-run", action="store_true",
                    help="build and store every payload without calling anything")
    args = ap.parse_args()

    check_pricing()
    if args.check_env:
        ok = True
        for provider, filename in ENV_FILES.items():
            name = "MIMO_API_KEY" if provider == "mimo" else "DEEPSEEK_API_KEY"
            path = ROOT / filename
            if os.environ.get(name):
                where = "exported in the shell"
            elif load_env_file(path).get(name):
                where = f"{filename}"
            else:
                where = (f"MISSING \u2014 put {name}=... in {filename}"
                         + ("" if path.exists() else f" (create {filename} first)"))
                ok = False
            print(f"  {provider:<9} {name:<18} {where}")
        return 0 if ok else 1

    guide = load_guide()
    providers = [p.strip() for p in args.providers.split(",") if p.strip()]
    temperatures = [float(t) for t in args.temperatures.split(",") if t.strip()]

    out = STUDY / "transcripts"
    out.mkdir(parents=True, exist_ok=True)
    cache = STUDY / "cache"
    cache.mkdir(parents=True, exist_ok=True)

    planned = len(providers) * len(temperatures) * args.repeats * len(guide["questions"])
    print(f"guide           {len(guide['questions'])} questions, "
          f"grounded on {guide['groundingUnit']}")
    print(f"false premise   {guide['falsePremiseCandidateId']} (confirmed never offered)")
    print(f"planned calls   {planned}"
          f"{'  [dry run, nothing will be sent]' if args.dry_run else ''}")

    sessions, summary = [], {}
    failure = None
    try:
        for provider in providers:
            stats = {"requestCount": 0, "cacheHitCount": 0, "failedAttemptCount": 0,
                     "inputTokens": 0, "outputTokens": 0}
            try:
                for temperature in temperatures:
                    for repeat in range(1, args.repeats + 1):
                        session = run_session(provider, guide, temperature, repeat,
                                              args, cache, stats)
                        sessions.append(session)
                        print(f"  {provider:<9} t={temperature:<4} repeat {repeat} "
                              f"→ {len(session['answers'])} answers")
            finally:
                summary[provider] = {
                    **stats,
                    "currency": PRICING[provider]["currency"],
                    "observedCostAtListedRates": round(spent(provider, stats), 6),
                }
    except SystemExit as error:
        # 已经跑完的会话照常写盘；缓存也已落地，重跑不会重复花钱。
        failure = str(error)
        print(f"\n  stopped: {failure}")

    record = {
        "schemaVersion": "agent-interview-transcripts.v1",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "dryRun": args.dry_run,
        "complete": failure is None,
        "stoppedBecause": failure,
        "guideSha256": sha256((STUDY / "interview-guide.json").read_bytes()),
        "groundingUnit": guide["groundingUnit"],
        "boundaries": guide["boundaries"],
        "api": summary,
        "sessions": sessions,
    }
    path = out / ("dry-run.json" if args.dry_run else "transcripts.json")
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {path.relative_to(ROOT)}")
    for provider, s in summary.items():
        print(f"  {provider:<9} {s['requestCount']} requests, "
              f"{s['observedCostAtListedRates']} {s['currency']}")
    return 0 if failure is None else 1


if __name__ == "__main__":
    sys.exit(main())
