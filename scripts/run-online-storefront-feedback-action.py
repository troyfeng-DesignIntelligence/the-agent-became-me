"""Run a frozen downstream-agent feedback experiment.

Dry-run is the default. Live execution requires an explicit provider-currency
cost cap. Only pseudonymous candidate IDs and derived scalar features are sent.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v8/downstream-action-protocol.json"
BRIDGE_RUNNER_PATH = ROOT / "scripts/evaluate-online-storefront-feedback-bridge.py"
CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]


def load_module(name: str, path: Path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


bridge = load_module("storefront_feedback_bridge_source", BRIDGE_RUNNER_PATH)
v7 = bridge.v7
legacy = v7.legacy


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


def load_protocol(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), text


def provider_spec(protocol: dict) -> dict:
    row = protocol["provider"]
    return {
        "provider": provider_name(protocol),
        "inputPricePerMillion": float(row["inputPricePerMillion"]),
        "outputPricePerMillion": float(row["outputPricePerMillion"]),
        "priceCurrency": row["priceCurrency"],
    }


def provider_name(protocol: dict) -> str:
    value = protocol["provider"]["provider"]
    return "mimo" if value == "xiaomi-mimo" else value


def control_selected(category: str, task_id: str, family: str) -> bool:
    key = f"{category}/{task_id}/{family}/downstream-control"
    return int(sha256(key.encode("utf-8"))[:16], 16) % 4 == 0


def assign_call_orders(units: list[dict], protocol: dict) -> None:
    """Assign semantic conditions to positions without changing the estimand.

    Legacy protocols retain their historical fixed order. Counterbalanced
    protocols supply a four-row cyclic Latin square. Within every
    category-by-recommender-by-mode stratum, units are hash-sorted and assigned
    round-robin with a deterministic stratum offset, so order counts differ by
    at most one.
    """
    design = protocol["decisionInstrument"].get("conditionOrderDesign")
    for unit in units:
        unit["callOrders"] = {}
        unit["conditionOrderIndices"] = {}
    if not design:
        for unit in units:
            for mode in ["primary-feedback", "identical-control"]:
                if mode == "primary-feedback" or unit["controlSelected"]:
                    unit["callOrders"][mode] = list(CONDITIONS)
                    unit["conditionOrderIndices"][mode] = 0
        return

    orders = design.get("orders")
    if not isinstance(orders, list) or len(orders) != len(CONDITIONS):
        raise RuntimeError("Counterbalanced protocols require four condition orders")
    if any(sorted(order) != sorted(CONDITIONS) for order in orders):
        raise RuntimeError("Every condition order must contain each semantic condition exactly once")
    for position in range(len(CONDITIONS)):
        if sorted(order[position] for order in orders) != sorted(CONDITIONS):
            raise RuntimeError("Condition orders are not a Latin square")

    salt = str(design.get("assignmentSalt", "feedback-action-counterbalance-v1"))
    for mode in ["primary-feedback", "identical-control"]:
        eligible = [
            unit for unit in units
            if mode == "primary-feedback" or unit["controlSelected"]
        ]
        strata: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for unit in eligible:
            strata[(unit["category"], unit["modelFamily"])].append(unit)
        for (category, family), rows in strata.items():
            rows.sort(
                key=lambda unit: sha256(
                    f"{salt}/{mode}/{category}/{family}/{unit['taskId']}".encode("utf-8")
                )
            )
            offset = int(
                sha256(f"{salt}/{mode}/{category}/{family}/offset".encode("utf-8"))[:16],
                16,
            ) % len(orders)
            for index, unit in enumerate(rows):
                order_index = (index + offset) % len(orders)
                unit["callOrders"][mode] = list(orders[order_index])
                unit["conditionOrderIndices"][mode] = order_index


def assigned_modes(unit: dict, protocol: dict) -> list[str]:
    modes = ["primary-feedback"] + (["identical-control"] if unit["controlSelected"] else [])
    design = protocol["decisionInstrument"].get("conditionOrderDesign")
    if len(modes) == 2 and design and design.get("counterbalanceModeOrder"):
        salt = str(design.get("assignmentSalt", "feedback-action-counterbalance-v1"))
        key = f"{salt}/mode-order/{unit['category']}/{unit['taskId']}/{unit['modelFamily']}"
        if int(sha256(key.encode("utf-8"))[:16], 16) % 2:
            modes.reverse()
    return modes


def response_metadata(artifact_root: Path, cache_key: str) -> dict:
    response_path = artifact_root / "responses" / f"{cache_key}.json"
    if not response_path.exists():
        return {"returnedModel": None, "systemFingerprint": None, "attemptCount": 0}
    payload = json.loads(response_path.read_text(encoding="utf-8"))
    response = payload.get("response") or {}
    attempts = list((artifact_root / "attempts").glob(f"{cache_key}-*.json"))
    return {
        "returnedModel": response.get("model") if isinstance(response.get("model"), str) else None,
        "systemFingerprint": legacy.response_fingerprint(response),
        "attemptCount": len(attempts),
    }


def price_similarity(left: float | None, right: float | None) -> float:
    if left is None or right is None or left <= 0 or right <= 0:
        return 0.5
    return float(math.exp(-abs(math.log(left / right))))


def intent_features(
    target: dict,
    candidate_item: int,
    candidate: dict,
    history_items: list[int],
    products: dict[int, dict],
) -> dict:
    target_tokens = set(target["tokens"])
    candidate_tokens = set(candidate["tokens"])
    union = target_tokens | candidate_tokens
    similarity = len(target_tokens & candidate_tokens) / len(union) if union else 0.0
    price = price_similarity(target["price"], candidate["price"])
    recent = [item for item in history_items[-5:] if item in products]
    history_novelty = bridge.v7.v2.novelty(
        candidate_item,
        recent,
        products,
    ) if recent else 1.0
    return {
        "constraintMatch": bool(target_tokens & candidate_tokens),
        "taskUtility": round(0.8 * similarity + 0.2 * price, 4),
        "intentSimilarity": round(similarity, 4),
        "priceSimilarity": round(price, 4),
        "historyNovelty": round(history_novelty, 4),
    }


def state_for_slate(
    category: str,
    task: dict,
    products: dict[int, dict],
    slate: list[int],
) -> tuple[dict, dict[str, float]]:
    target = products[task["nextTaskItem"]]
    rows = []
    qualities = {}
    aliases = set()
    for item in slate:
        alias = bridge.public_item(category, task["taskId"], item)
        if alias in aliases:
            raise RuntimeError(f"Downstream candidate alias collision: {category}/{task['taskId']}/{alias}")
        aliases.add(alias)
        feature = intent_features(target, item, products[item], list(task["history"]), products)
        rows.append({"candidateId": alias, **feature})
        qualities[alias] = float(feature["taskUtility"]) if feature["constraintMatch"] else 0.0
    state = {
        "phase": "next-task-terminal",
        "decision": "select one offered candidate or abandon",
        "hardConstraint": "select only a candidate with constraintMatch=true",
        "candidates": rows,
    }
    return state, qualities


def next_slates(
    task: dict,
    scorer,
    actions: dict[str, str],
    aliases: dict[str, int],
    size: int,
) -> dict[str, list[int]]:
    resolved = {condition: bridge.resolve_action(actions[condition], aliases) for condition in CONDITIONS}
    selected_union = {item for item in resolved.values() if item is not None}
    mask = set(task["interacted"]) | selected_union | {task["nextTaskItem"]}
    slates = {}
    for condition in CONDITIONS:
        context = list(task["history"])
        if resolved[condition] is not None:
            context.append(resolved[condition])
        context.append(task["nextTaskItem"])
        slates[condition] = scorer.top(context, mask, size)
    return slates


def primary_units(protocol: dict):
    v7_protocol = json.loads((ROOT / protocol["source"]["v7Protocol"]).read_text(encoding="utf-8"))
    candidate_limit = int(v7_protocol["decisionInstrument"]["candidateLimit"])
    action_path = protocol["source"].get("v7ActionRows", protocol["source"].get("v7DeepSeekRows"))
    if not action_path:
        raise RuntimeError("Protocol source must define v7ActionRows or v7DeepSeekRows")
    action_payload = json.loads((ROOT / action_path).read_text(encoding="utf-8"))
    action_rows = {
        (row["category"], row["taskId"], row["modelFamily"]): row
        for row in action_payload["rows"]
        if row["mode"] == "served-order"
    }
    size = int(protocol["decisionInstrument"]["candidateLimit"])
    for category, task, products, family, seed, scorer in v7.study_units(v7_protocol):
        aliases = bridge.action_item_map(
            category,
            task["taskId"],
            bridge.v7_candidate_items(task, products, scorer, candidate_limit),
        )
        action_row = action_rows[(category, task["taskId"], family)]
        slates = next_slates(task, scorer, action_row["actions"], aliases, size)
        states = {}
        qualities = {}
        for condition in CONDITIONS:
            states[condition], qualities[condition] = state_for_slate(
                category, task, products, slates[condition]
            )
        yield {
            "category": category,
            "taskId": task["taskId"],
            "modelFamily": family,
            "modelSeed": seed,
            "states": states,
            "qualities": qualities,
            "nextSlateChanged": any(
                slates[f"immediate-{replicate}"] != slates[f"held-{replicate}"]
                for replicate in ["a", "b"]
            ),
            "controlSelected": control_selected(category, task["taskId"], family),
        }


def sent_state(state: dict) -> dict:
    return state


def payload_for_state(env: dict[str, str], protocol: dict, state: dict) -> dict:
    provider = provider_name(protocol)
    payload = legacy.request_payload(env, provider, "forced-inspection", "terminal", sent_state(state))
    if provider == "mimo":
        payload["instructions"] += (
            ' Return JSON shaped exactly like {"action":"select|abandon",'
            '"candidateId":"P-XXXXXXXX or null","confidence":0.0}.'
        )
    token_limit = int(protocol["decisionInstrument"]["maximumOutputTokens"])
    payload["max_output_tokens" if provider == "mimo" else "max_tokens"] = token_limit
    payload["temperature"] = 0
    return payload


def action_label(action: dict) -> str:
    if action["action"] == "failure":
        return "__FAILURE__"
    return "__ABANDON__" if action["action"] == "abandon" else action["candidateId"]


def action_quality(state: dict, qualities: dict[str, float], action: dict) -> float | None:
    if action["action"] == "failure":
        return None
    if action["action"] == "abandon":
        return 1.0 if not any(row["constraintMatch"] for row in state["candidates"]) else 0.0
    return qualities[action["candidateId"]]


def contrast(actions: dict[str, dict]) -> dict:
    labels = {condition: action_label(action) for condition, action in actions.items()}
    immediate = [labels["immediate-a"], labels["immediate-b"]]
    held = [labels["held-a"], labels["held-b"]]
    cross = [float(left != right) for left in immediate for right in held]
    distance = 2 * float(np.mean(cross)) - float(immediate[0] != immediate[1]) - float(held[0] != held[1])
    return {
        "actions": labels,
        "actionDistributionDistance": round(distance, 6),
        "matchedCrossArmActionChangeCount": int(immediate[0] != held[0]) + int(immediate[1] != held[1]),
        "immediateWithinDivergence": int(immediate[0] != immediate[1]),
        "heldWithinDivergence": int(held[0] != held[1]),
    }


def preflight(protocol: dict, protocol_hash: str) -> dict:
    bridge_summary = json.loads((ROOT / protocol["source"]["feedbackBridgeSummary"]).read_text(encoding="utf-8"))
    failures = []
    counts = defaultdict(int)
    state_hashes = set()
    units = list(primary_units(protocol))
    assign_call_orders(units, protocol)
    order_counts: dict[str, int] = defaultdict(int)
    mode_order_counts: dict[str, int] = defaultdict(int)
    for unit in units:
        counts["units"] += 1
        counts["controlUnits"] += int(unit["controlSelected"])
        counts["nextSlateChangedUnits"] += int(unit["nextSlateChanged"])
        for condition, state in unit["states"].items():
            counts["states"] += 1
            aliases = [row["candidateId"] for row in state["candidates"]]
            if len(aliases) != protocol["decisionInstrument"]["candidateLimit"] or len(set(aliases)) != len(aliases):
                failures.append(f"candidate-layout:{unit['category']}:{unit['taskId']}:{unit['modelFamily']}:{condition}")
            if not all(set(row) == {"candidateId", "constraintMatch", "taskUtility", "intentSimilarity", "priceSimilarity", "historyNovelty"} for row in state["candidates"]):
                failures.append(f"feature-schema:{unit['category']}:{unit['taskId']}:{unit['modelFamily']}:{condition}")
            state_hashes.add(sha256(canonical(state)))
        modes = assigned_modes(unit, protocol)
        mode_order_counts["->".join(modes)] += 1
        for mode, order_index in unit["conditionOrderIndices"].items():
            key = f"{mode}/{unit['category']}/{unit['modelFamily']}/order-{order_index}"
            order_counts[key] += 1
    expected = int(protocol["sampling"]["taskModelUnitCount"])
    if counts["units"] != expected:
        failures.append(f"unit-count:{counts['units']}!=expected:{expected}")
    if not bridge_summary.get("gates", {}).get("feedbackExposureGatePassed"):
        failures.append("feedback-exposure-prerequisite-failed")
    design = protocol["decisionInstrument"].get("conditionOrderDesign")
    if design:
        for mode in ["primary-feedback", "identical-control"]:
            relevant = [unit for unit in units if mode == "primary-feedback" or unit["controlSelected"]]
            for category in protocol["sampling"]["categories"]:
                for family in protocol["sampling"]["recommenderFamiliesPerTask"]:
                    stratum = [
                        order_counts[f"{mode}/{category}/{family}/order-{index}"]
                        for index in range(len(CONDITIONS))
                    ]
                    expected_units = sum(
                        unit["category"] == category and unit["modelFamily"] == family
                        for unit in relevant
                    )
                    if sum(stratum) != expected_units or (stratum and max(stratum) - min(stratum) > 1):
                        failures.append(
                            f"condition-order-balance:{mode}:{category}:{family}:{stratum}"
                        )
    counts["primaryCalls"] = counts["units"] * int(protocol["decisionInstrument"]["primaryCallsPerUnit"])
    counts["controlCalls"] = counts["controlUnits"] * int(protocol["decisionInstrument"]["controlCallsPerSelectedUnit"])
    counts["maximumCalls"] = counts["primaryCalls"] + counts["controlCalls"]
    result = {
        "schemaVersion": "online-storefront-feedback-action-preflight.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "passed": not failures,
        "counts": dict(counts),
        "distinctPrimaryStateCount": len(state_hashes),
        "conditionOrderCounts": dict(sorted(order_counts.items())),
        "modeOrderCounts": dict(sorted(mode_order_counts.items())),
        "failures": failures,
        "privacy": "Only pseudonymous candidate IDs and derived scalar features enter provider payloads.",
    }
    output = ROOT / protocol["outputs"]["publicRoot"]
    write_json(output / "preflight.json", result, pretty=True)
    return result


def dry_run(protocol: dict, env: dict[str, str], preflight_result: dict) -> dict:
    spec = provider_spec(protocol)
    sample = {
        "phase": "next-task-terminal",
        "decision": "select one offered candidate or abandon",
        "hardConstraint": "select only a candidate with constraintMatch=true",
        "candidates": [
            {
                "candidateId": f"P-{index:08X}",
                "constraintMatch": index % 3 != 0,
                "taskUtility": round(1 - index / 14, 4),
                "intentSimilarity": round(index / 20, 4),
                "priceSimilarity": round(1 - index / 20, 4),
                "historyNovelty": round(index / 12, 4),
            }
            for index in range(10)
        ],
    }
    payload = payload_for_state(env, protocol, sample)
    requests = int(preflight_result["counts"]["maximumCalls"])
    input_tokens = math.ceil(len(canonical(payload)) / 3) * requests
    output_tokens = int(protocol["decisionInstrument"]["maximumOutputTokens"]) * requests
    cost = input_tokens / 1_000_000 * spec["inputPricePerMillion"] + output_tokens / 1_000_000 * spec["outputPricePerMillion"]
    provider = provider_name(protocol)
    return {
        "mode": "dry-run-no-api-call",
        "provider": provider,
        "model": legacy.model_id(env, provider),
        "apiKeyPresent": bool(legacy.api_key(env, provider)),
        "maximumRequestCount": requests,
        "estimatedMaximumInputTokens": input_tokens,
        "estimatedMaximumOutputTokens": output_tokens,
        "estimatedMaximumCostBeforeRetries": round(cost, 6),
        "currency": spec["priceCurrency"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(PROTOCOL_PATH.relative_to(ROOT)))
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--accept-cost-cap", type=float)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol, text = load_protocol(protocol_path)
    protocol_hash = sha256(text.encode("utf-8"))
    preflight_path = ROOT / protocol["outputs"]["publicRoot"] / "preflight.json"
    if args.preflight or not preflight_path.exists():
        preflight_result = preflight(protocol, protocol_hash)
    else:
        preflight_result = json.loads(preflight_path.read_text(encoding="utf-8"))
    if args.preflight:
        print(json.dumps(preflight_result, indent=2), flush=True)
        if not preflight_result["passed"]:
            raise SystemExit(1)
        return
    if preflight_result["protocolSha256"] != protocol_hash or not preflight_result["passed"]:
        raise RuntimeError("A passing preflight for the exact frozen protocol is required")

    provider = provider_name(protocol)
    if provider not in {"deepseek", "mimo"}:
        raise RuntimeError(f"Unsupported provider: {provider}")
    env = legacy.provider_env(provider)
    estimate = dry_run(protocol, env, preflight_result)
    estimate["protocolSha256"] = protocol_hash
    print(json.dumps(estimate, indent=2), flush=True)
    if not args.execute:
        return
    if not legacy.api_key(env, provider):
        raise RuntimeError(f"{provider} API key is missing")
    if args.accept_cost_cap is None or args.accept_cost_cap <= 0:
        raise RuntimeError("Live calls require a positive --accept-cost-cap")
    if not 1 <= args.workers <= 16:
        raise RuntimeError("--workers must be between 1 and 16")

    units = list(primary_units(protocol))
    assign_call_orders(units, protocol)
    spec = provider_spec(protocol)
    artifact_root = ROOT / protocol["outputs"]["artifactRoot"]
    output = ROOT / protocol["outputs"]["publicRoot"]
    total_calls = int(preflight_result["counts"]["maximumCalls"])
    global_stats = defaultdict(int)
    global_stats["latencies"] = []
    global_stats["fingerprints"] = set()
    global_stats["returnedModels"] = set()
    rows = []

    def execute_unit(unit: dict):
        modes = assigned_modes(unit, protocol)
        unit_call_count = len(modes) * len(CONDITIONS)
        local = defaultdict(int)
        local["latencies"] = []
        local["fingerprints"] = set()
        local["returnedModels"] = set()
        local["acceptedCostCap"] = args.accept_cost_cap * unit_call_count / total_calls
        unit_rows = []
        for mode in modes:
            states = unit["states"] if mode == "primary-feedback" else {condition: unit["states"]["immediate-a"] for condition in CONDITIONS}
            qualities = unit["qualities"] if mode == "primary-feedback" else {condition: unit["qualities"]["immediate-a"] for condition in CONDITIONS}
            actions = {}
            hashes = {}
            decision_qualities = {}
            call_order = unit["callOrders"][mode]
            call_audit = {}
            for position, condition in enumerate(call_order, 1):
                state = states[condition]
                aliases = {row["candidateId"] for row in state["candidates"]}
                payload = payload_for_state(env, protocol, state)
                cache_scope = f"feedback-action/{mode}/{unit['category']}/{unit['taskId']}/{unit['modelFamily']}/{condition}"
                expected_cache_key = sha256(canonical({"provider": provider, "scope": cache_scope, "payload": payload}))
                cache_existed_before = (artifact_root / "responses" / f"{expected_cache_key}.json").exists()
                started_at = datetime.now(timezone.utc).isoformat()
                started_monotonic = time.monotonic()
                try:
                    call = legacy.provider_call(
                        env,
                        provider,
                        spec,
                        payload,
                        aliases,
                        "terminal",
                        cache_scope,
                        local,
                        artifact_root,
                    )
                    actions[condition] = call["action"]
                    hashes[condition] = call["cacheKey"]
                except RuntimeError as error:
                    if "cost cap" in str(error).lower():
                        raise
                    actions[condition] = {"action": "failure", "candidateId": None}
                    hashes[condition] = sha256(str(error).encode("utf-8"))
                    local["terminalFailureCount"] += 1
                completed_at = datetime.now(timezone.utc).isoformat()
                metadata = response_metadata(artifact_root, hashes[condition])
                call_audit[condition] = {
                    "position": position,
                    "startedAt": started_at,
                    "completedAt": completed_at,
                    "elapsedSeconds": round(time.monotonic() - started_monotonic, 6),
                    "cacheHit": cache_existed_before,
                    **metadata,
                }
                decision_qualities[condition] = action_quality(state, qualities[condition], actions[condition])
            unit_rows.append(
                {
                    "provider": provider,
                    "category": unit["category"],
                    "taskId": unit["taskId"],
                    "modelFamily": unit["modelFamily"],
                    "modelSeed": unit["modelSeed"],
                    "mode": mode,
                    "conditionOrderIndex": unit["conditionOrderIndices"][mode],
                    "callOrder": call_order,
                    "callAudit": call_audit,
                    "nextSlateChanged": unit["nextSlateChanged"],
                    **contrast(actions),
                    "decisionQualities": decision_qualities,
                    "responseHashes": hashes,
                    "auditPrimitives": {
                        "stateHashes": {condition: sha256(canonical(states[condition])) for condition in CONDITIONS},
                        "candidateLayouts": {condition: [row["candidateId"] for row in states[condition]["candidates"]] for condition in CONDITIONS},
                    },
                }
            )
        return unit_rows, local

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        for completed, (unit_rows, local) in enumerate(executor.map(execute_unit, units), 1):
            rows.extend(unit_rows)
            for key in ["requestCount", "cacheHitCount", "attemptCount", "validActionCount", "invalidOrFailedAttemptCount", "timeoutCount", "terminalFailureCount", "inputTokens", "outputTokens", "retrySuccessCount"]:
                global_stats[key] += local[key]
            global_stats["latencies"].extend(local["latencies"])
            global_stats["fingerprints"].update(local["fingerprints"])
            global_stats["returnedModels"].update(local["returnedModels"])
            if completed % 10 == 0 or completed == len(units):
                print(f"feedback-action units={completed}/{len(units)}", flush=True)

    rows.sort(key=lambda row: (row["category"], row["taskId"], row["modelFamily"], row["mode"]))
    observed_cost = global_stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"] + global_stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
    summary = {
        "schemaVersion": "online-storefront-feedback-action-run-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "provider": provider,
        "model": legacy.model_id(env, provider),
        "taskModelUnitCount": len(units),
        "rowCount": len(rows),
        "api": {
            "requestCount": global_stats["requestCount"],
            "cacheHitCount": global_stats["cacheHitCount"],
            "attemptCount": global_stats["attemptCount"],
            "validActionCount": global_stats["validActionCount"],
            "invalidOrFailedAttemptCount": global_stats["invalidOrFailedAttemptCount"],
            "timeoutCount": global_stats["timeoutCount"],
            "terminalFailureCount": global_stats["terminalFailureCount"],
            "inputTokens": global_stats["inputTokens"],
            "outputTokens": global_stats["outputTokens"],
            "currency": spec["priceCurrency"],
            "observedCostAtPublishedRates": round(observed_cost, 6),
            "acceptedCostCap": args.accept_cost_cap,
            "systemFingerprints": sorted(global_stats["fingerprints"]),
            "returnedModels": sorted(global_stats["returnedModels"]),
        },
        "claimBoundary": protocol["claimBoundary"],
    }
    write_json(output / "rows.json", {"schemaVersion": "online-storefront-feedback-action-rows.v1", "rows": rows})
    write_json(output / "run-summary.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
