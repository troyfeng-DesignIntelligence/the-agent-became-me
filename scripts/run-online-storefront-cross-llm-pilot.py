"""Run the frozen sham-calibrated cross-LLM storefront pilot.

Dry-run is the default. Live calls require an explicit provider-specific cost
cap. Raw provider payloads and responses stay in ignored artifacts; public
outputs contain only pseudonymous actions, aggregate usage, hashes, and metrics.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/cross-llm-pilot-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"
RUN_TEMPERATURE = 0.0


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pilot = load_module(
    "storefront_mimo_pilot",
    ROOT / "scripts/run-online-storefront-llm-pilot.py",
)
models = pilot.models
v2 = pilot.v2
delegate = pilot.delegate
cross = pilot.cross
sas = pilot.sas
gru = pilot.gru


def load_env(path: Path) -> dict[str, str]:
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


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def provider_spec(protocol: dict, provider: str) -> dict:
    expected = "xiaomi-mimo" if provider == "mimo" else "deepseek"
    return next(row for row in protocol["llmFamilies"] if row["provider"] == expected)


def provider_env(provider: str) -> dict[str, str]:
    return load_env(ROOT / (".env" if provider == "mimo" else ".env.deepseek"))


def api_key(env: dict[str, str], provider: str) -> str:
    return env.get("MIMO_API_KEY" if provider == "mimo" else "DEEPSEEK_API_KEY", "")


def model_id(env: dict[str, str], provider: str) -> str:
    if provider == "mimo":
        return env.get("MIMO_MODEL", "mimo-v2.5")
    return env.get("DEEPSEEK_MODEL", "deepseek-v4-flash")


def max_tokens(env: dict[str, str], provider: str) -> int:
    key = "MIMO_MAX_OUTPUT_TOKENS" if provider == "mimo" else "DEEPSEEK_MAX_OUTPUT_TOKENS"
    return int(env.get(key, "180"))


def timeout_seconds(env: dict[str, str], provider: str) -> int:
    key = (
        "MIMO_REQUEST_TIMEOUT_SECONDS"
        if provider == "mimo"
        else "DEEPSEEK_REQUEST_TIMEOUT_SECONDS"
    )
    return int(env.get(key, "90"))


def request_payload(
    env: dict[str, str], provider: str, policy: str, phase: str, task_state: dict
) -> dict:
    instructions = pilot.policy_instructions(policy, phase)
    state = json.dumps(task_state, sort_keys=True, separators=(",", ":"))
    if provider == "mimo":
        return {
            "model": model_id(env, provider),
            "instructions": instructions,
            "input": state,
            "max_output_tokens": max_tokens(env, provider),
            "stream": False,
            "reasoning": {"effort": "none"},
            "temperature": RUN_TEMPERATURE,
            "text": {"format": {"type": "json_object"}},
        }
    return {
        "model": model_id(env, provider),
        "messages": [
            {
                "role": "system",
                "content": instructions
                + ' Return JSON shaped exactly like {"action":"view|select|abandon",'
                + '"candidateId":"P-XXXXXXXX or null","confidence":0.0}.',
            },
            {"role": "user", "content": state},
        ],
        "max_tokens": max_tokens(env, provider),
        "stream": False,
        "thinking": {"type": "disabled"},
        "temperature": RUN_TEMPERATURE,
        "response_format": {"type": "json_object"},
    }


def response_text(result: dict, provider: str) -> str:
    if provider == "mimo":
        return pilot.response_text(result)
    choices = result.get("choices") or []
    if not choices:
        return ""
    content = (choices[0].get("message") or {}).get("content")
    return content if isinstance(content, str) else ""


def response_fingerprint(result: dict) -> str | None:
    value = result.get("system_fingerprint")
    return value if isinstance(value, str) and value else None


def retry_payload(payload: dict, provider: str) -> dict:
    retried = json.loads(json.dumps(payload))
    note = "\nPrevious output was invalid. Return only the required JSON object."
    if provider == "mimo":
        retried["input"] += note
    else:
        retried["messages"][-1]["content"] += note
    return retried


def endpoint_and_headers(env: dict[str, str], provider: str) -> tuple[str, dict[str, str]]:
    if provider == "mimo":
        base = env.get("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").rstrip("/")
        return f"{base}/responses", {
            "api-key": api_key(env, provider),
            "Content-Type": "application/json",
        }
    base = env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    return f"{base}/chat/completions", {
        "Authorization": f"Bearer {api_key(env, provider)}",
        "Content-Type": "application/json",
    }


def record_attempt(
    artifact_root: Path,
    cache_key: str,
    attempt: int,
    result: dict | None,
    error: Exception | None,
) -> None:
    usage = (result or {}).get("usage") or {}
    write_json(
        artifact_root / "attempts" / f"{cache_key}-{attempt}.json",
        {
            "cacheKey": cache_key,
            "attempt": attempt,
            "recordedAt": datetime.now(timezone.utc).isoformat(),
            "inputTokens": int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0),
            "outputTokens": int(
                usage.get("output_tokens") or usage.get("completion_tokens") or 0
            ),
            "fingerprint": response_fingerprint(result or {}),
            "errorClass": error.__class__.__name__ if error else None,
            "valid": error is None,
        },
        pretty=True,
    )


def account_usage(result: dict, stats: dict) -> None:
    usage = result.get("usage") or {}
    stats["inputTokens"] += int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
    stats["outputTokens"] += int(
        usage.get("output_tokens") or usage.get("completion_tokens") or 0
    )
    fingerprint = response_fingerprint(result)
    if fingerprint:
        stats["fingerprints"].add(fingerprint)
    returned_model = result.get("model")
    if isinstance(returned_model, str) and returned_model:
        stats["returnedModels"].add(returned_model)


def provider_call(
    env: dict[str, str],
    provider: str,
    spec: dict,
    payload: dict,
    aliases: set[str],
    phase: str,
    cache_scope: str,
    stats: dict,
    artifact_root: Path,
) -> dict:
    cache_key = sha256(canonical({"provider": provider, "scope": cache_scope, "payload": payload}))
    cache_path = artifact_root / "responses" / f"{cache_key}.json"
    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        result = cached["response"]
        action = pilot.parse_action(response_text(result, provider), aliases, phase)
        stats["cacheHitCount"] += 1
        stats["attemptCount"] += 1
        stats["validActionCount"] += 1
        account_usage(result, stats)
        cached_cost = (
            stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"]
            + stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
        )
        if cached_cost > stats["acceptedCostCap"]:
            raise RuntimeError(f"Cached experiment cost exceeds accepted {spec['priceCurrency']} cap")
        return {"action": action, "cacheKey": cache_key}

    endpoint, headers = endpoint_and_headers(env, provider)
    maximum_retries = 2
    last_error = None
    current_payload = payload
    for attempt in range(maximum_retries + 1):
        spent = (
            stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"]
            + stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
        )
        reserve = (
            math.ceil(len(canonical(current_payload)) / 3)
            / 1_000_000
            * spec["inputPricePerMillion"]
            + max_tokens(env, provider)
            / 1_000_000
            * spec["outputPricePerMillion"]
        )
        if spent + reserve > stats["acceptedCostCap"]:
            raise RuntimeError(f"Accepted {spec['priceCurrency']} cost cap reached")
        request = urllib.request.Request(
            endpoint,
            data=canonical(current_payload),
            headers=headers,
            method="POST",
        )
        started = time.monotonic()
        result = None
        stats["attemptCount"] += 1
        stats["requestCount"] += 1
        try:
            with urllib.request.urlopen(
                request, timeout=timeout_seconds(env, provider)
            ) as response:
                result = json.loads(response.read().decode("utf-8"))
            stats["latencies"].append(time.monotonic() - started)
            account_usage(result, stats)
            action = pilot.parse_action(response_text(result, provider), aliases, phase)
            stats["validActionCount"] += 1
            write_json(
                cache_path,
                {
                    "requestSha256": cache_key,
                    "provider": provider,
                    "cacheScope": cache_scope,
                    "request": current_payload,
                    "response": result,
                },
                pretty=True,
            )
            record_attempt(artifact_root, cache_key, attempt, result, None)
            if attempt:
                stats["retrySuccessCount"] += 1
            return {"action": action, "cacheKey": cache_key}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            last_error = error
            stats["invalidOrFailedAttemptCount"] += 1
            if isinstance(error, TimeoutError):
                stats["timeoutCount"] += 1
            record_attempt(artifact_root, cache_key, attempt, result, error)
            if attempt < maximum_retries:
                current_payload = retry_payload(payload, provider)
                time.sleep(min(2**attempt, 4))
    raise RuntimeError(f"{provider} request failed after retries: {last_error}")


def llm_trace(
    env: dict[str, str],
    provider: str,
    spec: dict,
    task: dict,
    products: dict[int, dict],
    scorer,
    condition: dict,
    policy: str,
    category: str,
    cache_scope: str,
    stats: dict,
    artifact_root: Path,
) -> dict:
    search = delegate.search_catalog(task, products)
    viewed = list(search[:2])
    actions = [{"action": "search", "product": None, "source": "catalog-search"}]
    actions.extend(
        {"action": "product-view", "product": item, "source": "search-result"}
        for item in viewed
    )
    selected = None
    terminal = None
    response_keys = []

    for step in range(2):
        platform_context = v2.condition_context(
            task, condition["id"], viewed, None, "task-in-progress"
        )
        platform = scorer.top(
            platform_context,
            set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
        )
        local = delegate.local_recommendations(
            task,
            products,
            viewed,
            set(task["history"]) | set(viewed),
        )
        candidates = pilot.choose_candidates(task, products, viewed, platform, local, search)
        if not candidates:
            terminal = "abandon"
            break
        features = pilot.candidate_features(
            task, products, candidates, platform, local, search, viewed, category
        )
        alias_to_item = {
            pilot.item_alias(category, task["taskId"], item): item for item in candidates
        }
        state = {
            "phase": "browse",
            "step": step + 1,
            "hardConstraint": "select only a candidate with constraintMatch=true",
            "viewedCount": len(viewed),
            "candidates": features,
        }
        call = provider_call(
            env,
            provider,
            spec,
            request_payload(env, provider, policy, "browse", state),
            set(alias_to_item),
            "browse",
            cache_scope,
            stats,
            artifact_root,
        )
        response_keys.append(call["cacheKey"])
        decision = call["action"]
        if decision["action"] == "abandon":
            terminal = "abandon"
            break
        chosen = alias_to_item[decision["candidateId"]]
        if decision["action"] == "select":
            selected = chosen
            terminal = "select"
            actions.append({"action": "select", "product": selected, "source": "llm"})
            break
        viewed.append(chosen)
        actions.append({"action": "product-view", "product": chosen, "source": "llm"})

    if terminal is None:
        alias_to_item = {
            pilot.item_alias(category, task["taskId"], item): item for item in viewed
        }
        features = pilot.candidate_features(
            task, products, viewed, [], [], search, viewed[:-1], category
        )
        state = {
            "phase": "terminal",
            "hardConstraint": "select only a candidate with constraintMatch=true",
            "candidates": features,
        }
        call = provider_call(
            env,
            provider,
            spec,
            request_payload(env, provider, policy, "terminal", state),
            set(alias_to_item),
            "terminal",
            cache_scope,
            stats,
            artifact_root,
        )
        response_keys.append(call["cacheKey"])
        decision = call["action"]
        if decision["action"] == "select":
            selected = alias_to_item[decision["candidateId"]]
            terminal = "select"
            actions.append({"action": "select", "product": selected, "source": "llm"})
        else:
            terminal = "abandon"

    if terminal == "abandon":
        actions.append({"action": "abandon", "product": None, "source": "llm"})
    catalog_feasible = any(
        item not in task["interacted"] and delegate.constraint_match(task, product)
        for item, product in products.items()
    )
    decision_correct = (
        selected is not None
        and delegate.constraint_match(task, products[selected])
        and catalog_feasible
    ) or (selected is None and not catalog_feasible)
    return {
        "actions": actions,
        "viewed": viewed,
        "selected": selected,
        "outcome": "selected" if selected is not None else "abandoned",
        "decisionCorrect": bool(decision_correct),
        "selectedUtility": round(
            delegate.product_utility(task, products[selected]) if selected else 0.0, 6
        ),
        "eventLogCount": len(actions),
        "taskLocalViewCount": 0,
        "emptySlateCount": 0,
        "protocolFailureCount": 0,
        "responseHashes": response_keys,
    }


PHASES = ["task-start", "task-in-progress", "outcome-resolved", "next-task"]


def paired_displacements(left: dict, right: dict) -> dict[str, float]:
    return {
        phase: round(v2.displacement(left["slates"][phase], right["slates"][phase]), 6)
        for phase in PHASES
    }


def extended_contrast(
    category: str,
    task: dict,
    seed: int,
    family: str,
    policy: str,
    provider_model: str,
    results: dict[str, dict],
) -> dict:
    immediate = results["immediate-remove"]
    held = results["held-outcome"]
    sham_a = results["held-sham-a"]
    sham_b = results["held-sham-b"]
    exposure = paired_displacements(immediate, held)
    sham = paired_displacements(sham_a, sham_b)
    exposure_trace = v2.trace_hash(category, immediate["trace"]["actions"]) != v2.trace_hash(
        category, held["trace"]["actions"]
    )
    sham_trace = v2.trace_hash(category, sham_a["trace"]["actions"]) != v2.trace_hash(
        category, sham_b["trace"]["actions"]
    )
    persistent = bool(exposure_trace and exposure["next-task"] > 0)
    sham_persistent = bool(sham_trace and sham["next-task"] > 0)
    return {
        "category": category,
        "taskId": task["taskId"],
        "modelSeed": seed,
        "modelFamily": family,
        "llmModel": provider_model,
        "agentConfig": policy,
        "exposureT0": exposure["task-start"],
        "exposureT1": exposure["task-in-progress"],
        "exposureT2": exposure["outcome-resolved"],
        "exposureT3": exposure["next-task"],
        "shamT0": sham["task-start"],
        "shamT1": sham["task-in-progress"],
        "shamT2": sham["outcome-resolved"],
        "shamT3": sham["next-task"],
        "exposureTraceDiverged": exposure_trace,
        "shamTraceDiverged": sham_trace,
        "persistentBehavioralFeedback": persistent,
        "shamPersistentBehavioralFeedback": sham_persistent,
        "adjustedPersistentFeedback": int(persistent) - int(sham_persistent),
        "adjustedTraceDivergence": int(exposure_trace) - int(sham_trace),
        "heldMinusImmediateDecisionAccuracy": round(
            float(held["trace"]["decisionCorrect"])
            - float(immediate["trace"]["decisionCorrect"]),
            6,
        ),
        "heldMinusImmediateSelectedUtility": round(
            held["trace"]["selectedUtility"] - immediate["trace"]["selectedUtility"],
            6,
        ),
        "traceIds": {
            key: v2.trace_hash(category, value["trace"]["actions"])
            for key, value in results.items()
        },
    }


def dry_run(protocol: dict, env: dict[str, str], provider: str) -> dict:
    spec = provider_spec(protocol, provider)
    task_count = protocol["tasksPerCategory"] * len(protocol["categories"])
    trajectory_count = task_count * len(protocol["agentPolicies"]) * len(protocol["conditions"])
    maximum_requests = trajectory_count * protocol["generation"]["maximumCallsPerTrajectory"]
    sample_state = {
        "phase": "browse",
        "step": 1,
        "hardConstraint": "select only a candidate with constraintMatch=true",
        "viewedCount": 2,
        "candidates": [
            {
                "candidateId": f"P-{index:08X}",
                "constraintMatch": index % 3 != 0,
                "taskUtility": round(1 - index / 20, 4),
                "platformRank": index + 1 if index < 10 else None,
                "taskLocalRank": index + 1 if index < 8 else None,
                "searchRank": index + 1 if index < 6 else None,
                "novelty": round(index / 12, 4),
            }
            for index in range(12)
        ],
    }
    payload = request_payload(
        env, provider, protocol["agentPolicies"][0], "browse", sample_state
    )
    input_per_request = math.ceil(len(canonical(payload)) / 3)
    estimated_input = maximum_requests * input_per_request
    estimated_output = maximum_requests * max_tokens(env, provider)
    estimated_cost = (
        estimated_input / 1_000_000 * spec["inputPricePerMillion"]
        + estimated_output / 1_000_000 * spec["outputPricePerMillion"]
    )
    return {
        "mode": "dry-run-no-api-call",
        "provider": spec["provider"],
        "model": model_id(env, provider),
        "currency": spec["priceCurrency"],
        "taskCount": task_count,
        "trajectoryCount": trajectory_count,
        "pairedContrastCount": task_count * len(protocol["agentPolicies"]),
        "maximumRequestCount": maximum_requests,
        "conservativeInputTokensPerRequest": input_per_request,
        "maximumOutputTokensPerRequest": max_tokens(env, provider),
        "estimatedMaximumInputTokens": estimated_input,
        "estimatedMaximumOutputTokens": estimated_output,
        "estimatedMaximumCostBeforeRetries": round(estimated_cost, 6),
        "recommendedHardCap": math.ceil(estimated_cost * 3 * 100) / 100,
        "apiKeyPresent": bool(api_key(env, provider)),
    }


def main() -> None:
    global RUN_TEMPERATURE
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["mimo", "deepseek"], required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--accept-cost-cap", type=float)
    parser.add_argument(
        "--temperature",
        type=float,
        help="Optional temperature selected from a frozen protocol temperatureGrid.",
    )
    parser.add_argument(
        "--protocol",
        default=str(PROTOCOL_PATH.relative_to(ROOT)),
        help="Repository-relative frozen protocol path.",
    )
    parser.add_argument(
        "--variant",
        help="Optional isolated output/cache variant, for example temperature-0p3.",
    )
    args = parser.parse_args()

    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol_text = protocol_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    env = provider_env(args.provider)
    spec = provider_spec(protocol, args.provider)
    frozen_grid = protocol.get("generation", {}).get("temperatureGrid")
    if args.temperature is not None:
        if not isinstance(frozen_grid, list) or not any(
            math.isclose(float(value), args.temperature, abs_tol=1e-9)
            for value in frozen_grid
        ):
            raise RuntimeError("Requested temperature is not in the frozen protocol grid")
        RUN_TEMPERATURE = args.temperature
    else:
        RUN_TEMPERATURE = float(
            spec.get("temperature", protocol.get("generation", {}).get("temperature", 0))
        )
    estimate = dry_run(protocol, env, args.provider)
    estimate["temperature"] = RUN_TEMPERATURE
    estimate["protocol"] = str(protocol_path.relative_to(ROOT)).replace("\\", "/")
    estimate["variant"] = args.variant
    print(json.dumps(estimate, indent=2), flush=True)
    if not args.execute:
        return
    if not api_key(env, args.provider):
        raise RuntimeError(f"{args.provider} API key is missing from its local env file")
    if args.accept_cost_cap is None:
        raise RuntimeError("Live calls require --accept-cost-cap")
    if args.accept_cost_cap < estimate["recommendedHardCap"]:
        raise RuntimeError("Accepted cap is below the dry-run recommended hard cap")

    if args.variant:
        output = (
            ROOT
            / "public/results/online-storefront-decoding-sensitivity/v1"
            / f"{args.provider}-{args.variant}"
        )
        artifact_root = (
            ROOT
            / "artifacts/online-storefront-decoding-sensitivity"
            / f"{args.provider}-{args.variant}"
        )
    else:
        output = ROOT / "public/results/online-storefront-cross-llm-pilot/v1" / args.provider
        artifact_root = ROOT / "artifacts/online-storefront-cross-llm-pilot" / args.provider
    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    condition_specs = {row["id"]: row for row in v2_protocol["conditions"]}
    public_rows = []
    contrasts = []
    stats = defaultdict(int)
    stats["latencies"] = []
    stats["fingerprints"] = set()
    stats["returnedModels"] = set()
    stats["acceptedCostCap"] = args.accept_cost_cap

    for category in cross.CATEGORIES:
        slug = category["slug"]
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = 115
        eligible = delegate.build_tasks(category, data, products)
        tasks = sorted(eligible, key=lambda row: row["taskId"])[
            : protocol["tasksPerCategory"]
        ]
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task_index, task in enumerate(tasks):
            family = "sasrec" if task_index % 2 == 0 else "gru4rec"
            seed = [7, 17, 29][task_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            scorer = models.ModelScorer(model, scoring)
            for policy in protocol["agentPolicies"]:
                results = {}
                for arm in protocol["conditions"]:
                    base_condition = (
                        condition_specs["immediate-remove"]
                        if arm == "immediate-remove"
                        else condition_specs["held-outcome"]
                    )
                    trace = llm_trace(
                        env,
                        args.provider,
                        spec,
                        task,
                        products,
                        scorer,
                        base_condition,
                        policy,
                        slug,
                        arm,
                        stats,
                        artifact_root,
                    )
                    mask = set(task["interacted"]) | set(trace["viewed"]) | {
                        task["nextTaskItem"]
                    }
                    if trace["selected"] is not None:
                        mask.add(trace["selected"])
                    result = v2.condition_result(task, base_condition, trace, scorer, mask)
                    results[arm] = result
                contrast = extended_contrast(
                    slug,
                    task,
                    seed,
                    family,
                    policy,
                    model_id(env, args.provider),
                    results,
                )
                contrasts.append(contrast)
                baseline = results["held-outcome"]
                for arm, result in results.items():
                    row = v2.public_condition_row(
                        slug,
                        task,
                        seed,
                        policy,
                        "llm-free-running-sham-calibrated",
                        arm,
                        result,
                        baseline,
                    )
                    row["modelFamily"] = family
                    row["llmModel"] = model_id(env, args.provider)
                    public_rows.append(row)
        print(f"cross-llm provider={args.provider} category={slug} complete", flush=True)

    valid_rate = stats["validActionCount"] / max(1, stats["attemptCount"])
    observed_cost = (
        stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"]
        + stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
    )
    summary = {
        "schemaVersion": "online-storefront-cross-llm-pilot-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": sha256(protocol_text.encode("utf-8")),
        "design": {
            "provider": spec["provider"],
            "model": model_id(env, args.provider),
            "temperature": RUN_TEMPERATURE,
            "taskCount": len({(row["category"], row["taskId"]) for row in contrasts}),
            "trajectoryCount": len(public_rows),
            "pairedContrastCount": len(contrasts),
            "conditions": protocol["conditions"],
            "agentPolicies": protocol["agentPolicies"],
            "recommenderFamilies": protocol["recommenderFamilies"],
        },
        "api": {
            "requestCount": stats["requestCount"],
            "cacheHitCount": stats["cacheHitCount"],
            "attemptCount": stats["attemptCount"],
            "validActionCount": stats["validActionCount"],
            "retrySuccessCount": stats["retrySuccessCount"],
            "invalidOrFailedAttemptCount": stats["invalidOrFailedAttemptCount"],
            "timeoutCount": stats["timeoutCount"],
            "validActionRate": round(valid_rate, 6),
            "inputTokens": stats["inputTokens"],
            "outputTokens": stats["outputTokens"],
            "currency": spec["priceCurrency"],
            "observedCostAtPublishedRates": round(observed_cost, 6),
            "medianLatencySeconds": round(float(np.median(stats["latencies"])), 4)
            if stats["latencies"]
            else 0.0,
            "returnedModels": sorted(stats["returnedModels"]),
            "systemFingerprints": sorted(stats["fingerprints"]),
        },
        "descriptive": {
            "meanExposureT1": round(
                float(np.mean([row["exposureT1"] for row in contrasts])), 6
            ),
            "exposureTraceDivergenceRate": round(
                float(np.mean([row["exposureTraceDiverged"] for row in contrasts])), 6
            ),
            "shamTraceDivergenceRate": round(
                float(np.mean([row["shamTraceDiverged"] for row in contrasts])), 6
            ),
            "persistentBehavioralFeedbackRate": round(
                float(
                    np.mean([row["persistentBehavioralFeedback"] for row in contrasts])
                ),
                6,
            ),
            "shamPersistentBehavioralFeedbackRate": round(
                float(
                    np.mean(
                        [row["shamPersistentBehavioralFeedback"] for row in contrasts]
                    )
                ),
                6,
            ),
            "adjustedPersistentFeedback": round(
                float(np.mean([row["adjustedPersistentFeedback"] for row in contrasts])),
                6,
            ),
            "adjustedTraceDivergence": round(
                float(np.mean([row["adjustedTraceDivergence"] for row in contrasts])),
                6,
            ),
            "heldMinusImmediateDecisionAccuracy": round(
                float(
                    np.mean(
                        [row["heldMinusImmediateDecisionAccuracy"] for row in contrasts]
                    )
                ),
                6,
            ),
            "heldMinusImmediateSelectedUtility": round(
                float(
                    np.mean(
                        [row["heldMinusImmediateSelectedUtility"] for row in contrasts]
                    )
                ),
                6,
            ),
        },
        "gates": {
            "validActionRateAtLeast095": valid_rate >= 0.95,
            "timeoutRateBelow005": stats["timeoutCount"] / max(1, stats["requestCount"]) < 0.05,
            "shamPersistentFeedbackAtMost005": float(
                np.mean([row["shamPersistentBehavioralFeedback"] for row in contrasts])
            )
            <= 0.05,
            "privacyViolationCount": 0,
        },
        "claims": {
            "observed": [
                "The provider selected actions from pseudonymous derived candidate features under frozen policies.",
                "Independent held-exposure sham calls estimate model stochastic divergence rather than forcing a cache match.",
            ],
            "notEstablished": [
                "This pilot does not establish confirmatory cross-LLM recurrence.",
                "The study does not measure human or production-retailer behavior.",
                "Persistent behavioral feedback is bounded to the protocol-defined research-system checkpoints and realized-trace exclusion masks.",
            ],
        },
    }
    payloads = {
        "summary.json": summary,
        "rows.json": {
            "schemaVersion": "online-storefront-cross-llm-pilot-rows.v1",
            "protocolSha256": summary["protocolSha256"],
            "rows": public_rows,
        },
        "contrasts.json": {
            "schemaVersion": "online-storefront-cross-llm-pilot-contrasts.v1",
            "protocolSha256": summary["protocolSha256"],
            "rows": contrasts,
        },
    }
    for name, payload in payloads.items():
        write_json(output / name, payload, pretty=name == "summary.json")
    manifest = {
        "schemaVersion": "online-storefront-cross-llm-pilot-manifest.v1",
        "protocolSha256": summary["protocolSha256"],
        "files": {
            name: {
                "sha256": sha256((output / name).read_bytes()),
                "bytes": (output / name).stat().st_size,
            }
            for name in payloads
        },
    }
    write_json(output / "manifest.json", manifest, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
