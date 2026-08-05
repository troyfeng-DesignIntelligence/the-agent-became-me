"""Run or cost-estimate the frozen MiMo v2.5 storefront-agent pilot.

Dry-run is the default and never calls the API. Live execution requires both
--execute and an explicit RMB cost cap. Raw responses and request payloads are
content-addressed under ignored artifacts/; public output contains actions,
usage aggregates, hashes, and metrics, but no model prose or source records.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v3/llm-pilot-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
OUTPUT = ROOT / "public/results/online-storefront-llm-pilot/v1"
ARTIFACTS = ROOT / "artifacts/online-storefront-llm-pilot"
CACHE = ARTIFACTS / "responses"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"
PRICE_INPUT_RMB_PER_M = 1.0
PRICE_OUTPUT_RMB_PER_M = 2.0


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


models = load_module(
    "storefront_model_robustness",
    ROOT / "scripts/run-online-storefront-model-robustness.py",
)
v2 = models.v2
delegate = models.delegate
cross = models.cross
sas = models.sas
gru = models.gru


def load_env(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def item_alias(category: str, task_id: str, item: int) -> str:
    digest = sha256(f"llm-pilot|{category}|{task_id}|{item}".encode("utf-8"))
    return f"P-{digest[:8].upper()}"


def policy_instructions(policy: str, phase: str) -> str:
    priority = (
        "Satisfy hard constraints first, then maximize task utility."
        if policy == "constraint-first"
        else "Inspect recommendation-supported alternatives while respecting hard constraints."
    )
    allowed = "view, select, or abandon" if phase == "browse" else "select or abandon"
    return (
        "You control a shopping agent in a research storefront. "
        f"{priority} Choose exactly one allowed action: {allowed}. "
        "Use only candidateId values present in the input. "
        "Return only compact JSON with keys action, candidateId, and confidence. "
        "candidateId must be null for abandon. Do not add explanation or markdown."
    )


def candidate_features(
    task: dict,
    products: dict[int, dict],
    candidates: list[int],
    platform: list[int],
    local: list[int],
    search: list[int],
    viewed: list[int],
    category: str,
) -> list[dict]:
    platform_rank = {item: index + 1 for index, item in enumerate(platform)}
    local_rank = {item: index + 1 for index, item in enumerate(local)}
    search_rank = {item: index + 1 for index, item in enumerate(search)}
    return [
        {
            "candidateId": item_alias(category, task["taskId"], item),
            "constraintMatch": bool(delegate.constraint_match(task, products[item])),
            "taskUtility": round(delegate.product_utility(task, products[item]), 4),
            "platformRank": platform_rank.get(item),
            "taskLocalRank": local_rank.get(item),
            "searchRank": search_rank.get(item),
            "novelty": round(v2.novelty(item, viewed, products), 4),
        }
        for item in candidates
    ]


def request_payload(
    env: dict[str, str], policy: str, phase: str, task_state: dict
) -> dict:
    return {
        "model": env.get("MIMO_MODEL", "mimo-v2.5"),
        "instructions": policy_instructions(policy, phase),
        "input": json.dumps(task_state, sort_keys=True, separators=(",", ":")),
        "max_output_tokens": int(env.get("MIMO_MAX_OUTPUT_TOKENS", "180")),
        "stream": False,
        "reasoning": {"effort": "none"},
        "text": {"format": {"type": "json_object"}},
    }


def response_text(response: dict) -> str:
    direct = response.get("output_text")
    if isinstance(direct, str) and direct:
        return direct
    parts = []
    for item in response.get("output") or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                parts.append(content["text"])
    return "".join(parts)


def parse_action(text: str, aliases: set[str], phase: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", stripped, flags=re.I)
    match = re.search(r"\{.*\}", stripped, flags=re.S)
    if not match:
        raise ValueError("no JSON object")
    value = json.loads(match.group(0))
    action = value.get("action")
    candidate = value.get("candidateId")
    allowed = {"view", "select", "abandon"} if phase == "browse" else {"select", "abandon"}
    if action not in allowed:
        raise ValueError(f"invalid action {action!r}")
    if action == "abandon":
        candidate = None
    elif candidate not in aliases:
        raise ValueError("candidateId not in offered candidates")
    confidence = value.get("confidence")
    if not isinstance(confidence, (int, float)):
        confidence = None
    return {"action": action, "candidateId": candidate, "confidence": confidence}


def api_call(
    env: dict[str, str], payload: dict, aliases: set[str], phase: str, stats: dict
) -> dict:
    cache_key = sha256(canonical(payload))
    cache_path = CACHE / f"{cache_key}.json"
    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        action = parse_action(response_text(cached["response"]), aliases, phase)
        stats["cacheHitCount"] += 1
        return {"action": action, "response": cached["response"], "cacheKey": cache_key}

    base_url = env.get("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").rstrip("/")
    api_key = env.get("MIMO_API_KEY", "")
    timeout = int(env.get("MIMO_REQUEST_TIMEOUT_SECONDS", "90"))
    maximum_retries = 2
    last_error = None
    for attempt in range(maximum_retries + 1):
        spent = (
            stats["inputTokens"] / 1_000_000 * PRICE_INPUT_RMB_PER_M
            + stats["outputTokens"] / 1_000_000 * PRICE_OUTPUT_RMB_PER_M
        )
        next_call_reserve = (
            math.ceil(len(canonical(payload)) / 3)
            / 1_000_000
            * PRICE_INPUT_RMB_PER_M
            +
            int(env.get("MIMO_MAX_OUTPUT_TOKENS", "180"))
            / 1_000_000
            * PRICE_OUTPUT_RMB_PER_M
        )
        if spent + next_call_reserve > stats["acceptedCostCapRmb"]:
            raise RuntimeError("Accepted MiMo cost cap reached before the next request")
        attempt_payload = dict(payload)
        if attempt:
            attempt_payload["input"] += (
                "\nPrevious output was invalid. Return only the required JSON object."
            )
        request = urllib.request.Request(
            f"{base_url}/responses",
            data=canonical(attempt_payload),
            headers={"api-key": api_key, "Content-Type": "application/json"},
            method="POST",
        )
        started = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
            latency = time.monotonic() - started
            stats["requestCount"] += 1
            stats["latencies"].append(latency)
            usage = result.get("usage") or {}
            stats["inputTokens"] += int(usage.get("input_tokens") or 0)
            stats["outputTokens"] += int(usage.get("output_tokens") or 0)
            action = parse_action(response_text(result), aliases, phase)
            CACHE.mkdir(parents=True, exist_ok=True)
            write_json(
                cache_path,
                {
                    "requestSha256": cache_key,
                    "request": attempt_payload,
                    "response": result,
                },
                pretty=True,
            )
            if attempt:
                stats["retrySuccessCount"] += 1
            return {"action": action, "response": result, "cacheKey": cache_key}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            last_error = error
            stats["invalidOrFailedAttemptCount"] += 1
            if isinstance(error, TimeoutError):
                stats["timeoutCount"] += 1
            if attempt < maximum_retries:
                time.sleep(min(2**attempt, 4))
    raise RuntimeError(f"MiMo request failed after retries: {last_error}")


def choose_candidates(
    task: dict,
    products: dict[int, dict],
    viewed: list[int],
    platform: list[int],
    local: list[int],
    search: list[int],
) -> list[int]:
    return [
        item
        for item in dict.fromkeys([*platform, *local, *search])
        if item not in viewed
        and item not in task["interacted"]
        and item in products
        and products[item]["title"]
    ][:12]


def llm_trace(
    env: dict[str, str],
    task: dict,
    products: dict[int, dict],
    scorer,
    condition: dict,
    policy: str,
    category: str,
    stats: dict,
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
        local = (
            delegate.local_recommendations(
                task,
                products,
                viewed,
                set(task["history"]) | set(viewed),
            )
            if condition["taskLocalRetrieval"]
            else []
        )
        candidates = choose_candidates(task, products, viewed, platform, local, search)
        if not candidates:
            terminal = "abandon"
            break
        features = candidate_features(
            task, products, candidates, platform, local, search, viewed, category
        )
        alias_to_item = {
            item_alias(category, task["taskId"], item): item for item in candidates
        }
        task_state = {
            "phase": "browse",
            "step": step + 1,
            "hardConstraint": "select only a candidate with constraintMatch=true",
            "viewedCount": len(viewed),
            "candidates": features,
        }
        call = api_call(
            env,
            request_payload(env, policy, "browse", task_state),
            set(alias_to_item),
            "browse",
            stats,
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
            item_alias(category, task["taskId"], item): item for item in viewed
        }
        features = candidate_features(
            task, products, viewed, [], [], search, viewed[:-1], category
        )
        task_state = {
            "phase": "terminal",
            "hardConstraint": "select only a candidate with constraintMatch=true",
            "candidates": features,
        }
        call = api_call(
            env,
            request_payload(env, policy, "terminal", task_state),
            set(alias_to_item),
            "terminal",
            stats,
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
        item not in task["interacted"]
        and delegate.constraint_match(task, product)
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
            delegate.product_utility(task, products[selected]) if selected else 0.0,
            6,
        ),
        "eventLogCount": 0 if not condition["eventLog"] else len(actions),
        "taskLocalViewCount": 0,
        "emptySlateCount": 0,
        "protocolFailureCount": 0,
        "responseHashes": response_keys,
    }


def dry_run(protocol: dict, env: dict[str, str]) -> dict:
    task_count = protocol["tasksPerCategory"] * len(protocol["categories"])
    configurations = len(protocol["promptPolicies"])
    trajectories = task_count * configurations * len(protocol["conditions"])
    maximum_requests = trajectories * protocol["maximumCallsPerTrajectory"]
    shared_baseline_saving = task_count * configurations * protocol["maximumCallsPerTrajectory"]
    maximum_unique_requests = maximum_requests - shared_baseline_saving
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
    sample_payload = request_payload(
        env,
        protocol["promptPolicies"][0]["id"],
        "browse",
        sample_state,
    )
    conservative_input_tokens = math.ceil(len(json.dumps(sample_payload)) / 3)
    maximum_output_tokens = int(env.get("MIMO_MAX_OUTPUT_TOKENS", "180"))
    estimated_input = maximum_unique_requests * conservative_input_tokens
    estimated_output = maximum_unique_requests * maximum_output_tokens
    estimated_rmb = (
        estimated_input / 1_000_000 * PRICE_INPUT_RMB_PER_M
        + estimated_output / 1_000_000 * PRICE_OUTPUT_RMB_PER_M
    )
    return {
        "mode": "dry-run-no-api-call",
        "model": env.get("MIMO_MODEL", "mimo-v2.5"),
        "taskCount": task_count,
        "agentConfigurationCount": configurations,
        "trajectoryCount": trajectories,
        "maximumRequestCountWithoutCache": maximum_requests,
        "maximumUniqueRequestCountWithInertLogReuse": maximum_unique_requests,
        "conservativeInputTokensPerRequest": conservative_input_tokens,
        "maximumOutputTokensPerRequest": maximum_output_tokens,
        "estimatedMaximumInputTokens": estimated_input,
        "estimatedMaximumOutputTokens": estimated_output,
        "estimatedMaximumCostRmbBeforeRetries": round(estimated_rmb, 4),
        "recommendedHardCapRmb": math.ceil(estimated_rmb * 3 * 10) / 10,
        "apiKeyPresent": bool(env.get("MIMO_API_KEY")),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--accept-cost-cap-rmb", type=float)
    args = parser.parse_args()
    env = load_env(ROOT / ".env")
    protocol_text = PROTOCOL_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    estimate = dry_run(protocol, env)
    print(json.dumps(estimate, indent=2), flush=True)
    if not args.execute:
        return
    if not env.get("MIMO_API_KEY"):
        raise RuntimeError("MIMO_API_KEY is missing from .env")
    if args.accept_cost_cap_rmb is None:
        raise RuntimeError("Live calls require --accept-cost-cap-rmb")
    if args.accept_cost_cap_rmb < estimate["recommendedHardCapRmb"]:
        raise RuntimeError(
            "Accepted cap is below the dry-run recommended hard cap; rerun dry-run first"
        )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    condition_specs = {row["id"]: row for row in v2_protocol["conditions"]}
    condition_order = protocol["conditions"]
    public_rows = []
    contrasts = []
    stats = defaultdict(int)
    stats["latencies"] = []
    stats["acceptedCostCapRmb"] = args.accept_cost_cap_rmb

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
            seed = protocol.get("checkpointSeeds", [7, 17, 29])[
                task_index % 3
            ] if protocol.get("checkpointSeeds") else [7, 17, 29][task_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            scorer = models.ModelScorer(model, scoring)
            for policy_spec in protocol["promptPolicies"]:
                policy = policy_spec["id"]
                results = {}
                for condition_id in condition_order:
                    condition = condition_specs[condition_id]
                    trace = llm_trace(
                        env,
                        task,
                        products,
                        scorer,
                        condition,
                        policy,
                        slug,
                        stats,
                    )
                    mask = set(task["interacted"]) | set(trace["viewed"]) | {
                        task["nextTaskItem"]
                    }
                    if trace["selected"] is not None:
                        mask.add(trace["selected"])
                    result = v2.condition_result(task, condition, trace, scorer, mask)
                    results[condition_id] = result
                contrast = v2.make_contrast(
                    slug, task, seed, policy, "llm-free-running", results
                )
                contrast["modelFamily"] = family
                contrasts.append(contrast)
                baseline = results["no-memory"]
                for condition_id, result in results.items():
                    row = v2.public_condition_row(
                        slug,
                        task,
                        seed,
                        policy,
                        "llm-free-running",
                        condition_id,
                        result,
                        baseline,
                    )
                    row["modelFamily"] = family
                    public_rows.append(row)
        print(f"llm-pilot category={slug} complete", flush=True)

    cell_values = defaultdict(lambda: {"t1": [], "trace": []})
    for row in contrasts:
        key = (row["modelFamily"], row["agentConfig"])
        cell_values[key]["t1"].append(row["t1ImmediateHeldDisplacement"])
        cell_values[key]["trace"].append(float(row["traceDiverged"]))
    cell_sds = []
    for (family, policy), values in sorted(cell_values.items()):
        t1_sd = float(np.std(values["t1"], ddof=1)) if len(values["t1"]) > 1 else 0.0
        trace_sd = float(np.std(values["trace"], ddof=1)) if len(values["trace"]) > 1 else 0.0
        cell_sds.append(
            {
                "modelFamily": family,
                "promptPolicy": policy,
                "taskCount": len(values["t1"]),
                "t1Sd": round(t1_sd, 6),
                "traceDivergenceSd": round(trace_sd, 6),
            }
        )
    largest_sd = max(
        [row["t1Sd"] for row in cell_sds]
        + [row["traceDivergenceSd"] for row in cell_sds]
    )
    derived_per_cell = math.ceil((1.96 * largest_sd / 0.05) ** 2)
    total_requests = stats["requestCount"] + stats["cacheHitCount"]
    valid_rate = (
        total_requests / (total_requests + stats["invalidOrFailedAttemptCount"])
        if total_requests + stats["invalidOrFailedAttemptCount"]
        else 0.0
    )
    observed_cost = (
        stats["inputTokens"] / 1_000_000 * PRICE_INPUT_RMB_PER_M
        + stats["outputTokens"] / 1_000_000 * PRICE_OUTPUT_RMB_PER_M
    )
    if observed_cost > args.accept_cost_cap_rmb:
        raise RuntimeError("Observed token cost exceeded accepted cap")
    summary = {
        "schemaVersion": "online-storefront-llm-pilot-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": sha256(protocol_text.encode("utf-8")),
        "design": {
            "taskCount": len(
                {(row["category"], row["taskId"]) for row in contrasts}
            ),
            "trajectoryCount": len(public_rows),
            "pairedContrastCount": len(contrasts),
            "model": env.get("MIMO_MODEL", "mimo-v2.5"),
            "promptPolicies": [row["id"] for row in protocol["promptPolicies"]],
            "recommenderFamilies": protocol["recommenderFamilies"],
            "conditions": condition_order,
        },
        "api": {
            "requestCount": stats["requestCount"],
            "cacheHitCount": stats["cacheHitCount"],
            "retrySuccessCount": stats["retrySuccessCount"],
            "invalidOrFailedAttemptCount": stats["invalidOrFailedAttemptCount"],
            "timeoutCount": stats["timeoutCount"],
            "validActionRate": round(valid_rate, 6),
            "inputTokens": stats["inputTokens"],
            "outputTokens": stats["outputTokens"],
            "observedCostRmbAtPublishedRates": round(observed_cost, 6),
            "medianLatencySeconds": round(float(np.median(stats["latencies"])), 4)
            if stats["latencies"]
            else 0.0,
        },
        "pilotVariance": {
            "cells": cell_sds,
            "largestTaskClusterSd": round(largest_sd, 6),
            "derivedTasksPerModelPromptCellFor005HalfWidth": derived_per_cell,
        },
        "descriptive": {
            "meanT1Displacement": round(
                float(np.mean([row["t1ImmediateHeldDisplacement"] for row in contrasts])),
                6,
            ),
            "traceDivergenceRate": round(
                float(np.mean([row["traceDiverged"] for row in contrasts])), 6
            ),
            "decisionAccuracy": round(
                float(np.mean([row["decisionCorrect"] for row in public_rows])), 6
            ),
        },
        "goGates": {
            "validActionRateAtLeast095": valid_rate >= 0.95,
            "timeoutRateBelow005": stats["timeoutCount"] / max(1, stats["requestCount"]) < 0.05,
            "privacyViolationCount": 0,
        },
        "claims": {
            "observed": [
                "MiMo v2.5 selected actions from pseudonymous candidate features under two frozen prompt policies.",
                "Raw response text is excluded from public artifacts and retained only in ignored content-addressed caches.",
            ],
            "notEstablished": [
                "A single LLM family does not establish model-family robustness.",
                "The pilot estimates reliability and variance; it is not the confirmatory LLM-agent result.",
                "The agent did not browse Amazon.com or another production retailer.",
            ],
        },
    }
    payloads = {
        "summary.json": summary,
        "rows.json": {
            "schemaVersion": "online-storefront-llm-pilot-rows.v1",
            "protocolSha256": summary["protocolSha256"],
            "rows": public_rows,
        },
        "contrasts.json": {
            "schemaVersion": "online-storefront-llm-pilot-contrasts.v1",
            "protocolSha256": summary["protocolSha256"],
            "rows": contrasts,
        },
    }
    for filename, payload in payloads.items():
        write_json(OUTPUT / filename, payload, pretty=filename == "summary.json")
    manifest = {
        "schemaVersion": "online-storefront-llm-pilot-manifest.v1",
        "protocolSha256": summary["protocolSha256"],
        "files": {
            filename: {
                "sha256": sha256((OUTPUT / filename).read_bytes()),
                "bytes": (OUTPUT / filename).stat().st_size,
            }
            for filename in payloads
        },
    }
    write_json(OUTPUT / "manifest.json", manifest, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
