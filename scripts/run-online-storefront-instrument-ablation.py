"""Run the frozen v7 recommendation-instrument ablation pilot.

Dry-run is the default. ``--preflight`` constructs every state without calling
a provider. Live calls require a provider-specific cost cap and are cached so
an interrupted run can be resumed without repeating completed network calls.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v7/instrument-ablation-pilot-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"


def load_module(name: str, path: Path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


base = load_module(
    "storefront_natural_action_v6",
    ROOT / "scripts/run-online-storefront-natural-action.py",
)
legacy = base.legacy
pilot = base.pilot
models = base.models
v2 = base.v2
delegate = base.delegate
cross = base.cross
sas = base.sas
gru = base.gru

MODES = ["rank-only", "inspection-only", "masked-control", "served-order"]
CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]


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


def protocol_and_text(path: Path = PROTOCOL_PATH) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), text


def load_selection(protocol: dict) -> list[dict]:
    path = (ROOT / protocol["sampling"]["taskSelectionPath"]).resolve()
    if ROOT not in path.parents:
        raise RuntimeError("Task-selection path must remain inside the repository")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("selectionSha256") != protocol["sampling"]["taskSelectionSha256"]:
        raise RuntimeError("Task-selection semantic hash differs from the frozen protocol")
    rows = payload.get("tasks")
    if not isinstance(rows, list) or len(rows) != protocol["sampling"]["taskModelUnitCount"]:
        raise RuntimeError("Task-selection manifest has the wrong unit count")
    return rows


def stable_rotation(values: list, key: str) -> list:
    offset = int(sha256(key.encode("utf-8"))[:16], 16) % len(values)
    return [*values[offset:], *values[:offset]]


def mode_order(protocol: dict, provider: str, category: str, task_id: str, family: str) -> list[str]:
    orders = protocol["callOrder"]["modeOrders"]
    index = int(sha256(f"mode/{provider}/{category}/{task_id}/{family}".encode())[:16], 16) % len(orders)
    return list(orders[index])


def condition_order(protocol: dict, provider: str, category: str, task_id: str, family: str, mode: str) -> list[str]:
    orders = protocol["callOrder"]["conditionOrders"]
    index = int(sha256(f"condition/{provider}/{category}/{task_id}/{family}/{mode}".encode())[:16], 16) % len(orders)
    return list(orders[index])


def normalized_rank_displacement(left: list[str], right: list[str]) -> float:
    if left == right:
        return 0.0
    if set(left) != set(right) or not left:
        raise RuntimeError("Rank displacement requires identical non-empty candidate sets")
    ranks = {item: index for index, item in enumerate(right)}
    denominator = max(1, len(left) * (len(left) - 1))
    return float(sum(abs(index - ranks[item]) for index, item in enumerate(left)) / denominator)


def study_units(protocol: dict):
    selected = {
        (row["category"], row["taskId"]): row
        for row in load_selection(protocol)
    }
    for category in cross.CATEGORIES:
        slug = category["slug"]
        category_rows = {task_id: row for (cat, task_id), row in selected.items() if cat == slug}
        if not category_rows:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = 115
        tasks = sorted(delegate.build_tasks(category, data, products), key=lambda row: row["taskId"])
        tasks_by_id = {task["taskId"]: task for task in tasks}
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task_id in sorted(category_rows):
            selection = category_rows[task_id]
            task = tasks_by_id.get(task_id)
            if task is None:
                raise RuntimeError(f"Selected task missing from regenerated frame: {slug}/{task_id}")
            family = selection["modelFamily"]
            seed = int(selection["modelSeed"])
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            model.eval()
            yield slug, task, products, family, seed, models.ModelScorer(model, scoring)


def prepared_unit(protocol: dict, category: str, task: dict, products: dict[int, dict], scorer) -> dict:
    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    conditions = {row["id"]: row for row in v2_protocol["conditions"]}
    search = delegate.search_catalog(task, products)
    initial_viewed = list(search[:2])
    mask = set(task["interacted"]) | set(initial_viewed) | {task["nextTaskItem"]}
    platforms = {}
    for arm, condition_id in [("immediate", "immediate-remove"), ("held", "held-outcome")]:
        context = v2.condition_context(task, condition_id, initial_viewed, None, "task-in-progress")
        platforms[arm] = scorer.top(context, mask)
    local = delegate.local_recommendations(
        task, products, initial_viewed, set(task["history"]) | set(initial_viewed)
    )
    candidates = base.pooled_candidates(
        task,
        products,
        platforms["immediate"],
        platforms["held"],
        local,
        search,
        int(protocol["decisionInstrument"]["candidateLimit"]),
    )
    if not candidates:
        raise RuntimeError(f"Empty common candidates for {category}/{task['taskId']}")

    baseline_features = pilot.candidate_features(
        task, products, candidates, [], local, search, initial_viewed, category
    )
    feature_by_item = {
        item: {**feature, "decisionQuality": base.candidate_quality(feature)}
        for item, feature in zip(candidates, baseline_features, strict=True)
    }
    shared_order = base.frozen_layout(candidates, f"{category}/{task['taskId']}/v7-shared")
    platform_ranks = {
        arm: {item: (platforms[arm].index(item) + 1 if item in platforms[arm] else None) for item in candidates}
        for arm in ["immediate", "held"]
    }
    inspected = {
        arm: next((item for item in platforms[arm] if item in candidates), shared_order[0])
        for arm in ["immediate", "held"]
    }
    served_orders = {
        arm: sorted(
            shared_order,
            key=lambda item: (
                platform_ranks[arm][item] is None,
                platform_ranks[arm][item] if platform_ranks[arm][item] is not None else math.inf,
                shared_order.index(item),
            ),
        )
        for arm in ["immediate", "held"]
    }

    states = {}
    for mode in MODES:
        states[mode] = {}
        for condition in CONDITIONS:
            arm = "immediate" if condition.startswith("immediate") else "held"
            order = served_orders[arm] if mode == "served-order" else shared_order
            rows = []
            for item in order:
                row = dict(feature_by_item[item])
                if mode == "rank-only":
                    row["platformRank"] = platform_ranks[arm][item]
                    row["inspected"] = False
                elif mode == "inspection-only":
                    row["platformRank"] = None
                    row["inspected"] = item == inspected[arm]
                else:
                    row.pop("platformRank", None)
                    row["inspected"] = False
                rows.append(row)
            states[mode][condition] = {
                "phase": "terminal",
                "decision": "select one offered candidate or abandon",
                "hardConstraint": "select only a candidate with constraintMatch=true",
                "inspectionRule": "an inspected candidate remains selectable when an inspected marker is present",
                "candidates": rows,
            }

    post_hashes = {}
    for arm in ["immediate", "held"]:
        condition_id = "immediate-remove" if arm == "immediate" else "held-outcome"
        context = v2.condition_context(
            task, conditions[condition_id]["id"], [*initial_viewed, inspected[arm]], None, "outcome-resolved"
        )
        post_hashes[arm] = sha256(canonical(context))

    return {
        "states": states,
        "platformRanks": {
            arm: {
                pilot.item_alias(category, task["taskId"], item): rank
                for item, rank in platform_ranks[arm].items()
            }
            for arm in ["immediate", "held"]
        },
        "inspectedAliases": {
            arm: pilot.item_alias(category, task["taskId"], item)
            for arm, item in inspected.items()
        },
        "servedOrders": {
            arm: [pilot.item_alias(category, task["taskId"], item) for item in served_orders[arm]]
            for arm in ["immediate", "held"]
        },
        "sharedOrder": [pilot.item_alias(category, task["taskId"], item) for item in shared_order],
        "postResolutionInputHashes": post_hashes,
    }


def state_without_quality(state: dict) -> dict:
    return {
        **state,
        "candidates": [
            {key: value for key, value in row.items() if key != "decisionQuality"}
            for row in state["candidates"]
        ],
    }


def action_label(action: dict) -> str:
    if action["action"] == "failure":
        return "__PROTOCOL_FAILURE__"
    return "__ABANDON__" if action["action"] == "abandon" else action["candidateId"]


def action_quality(state: dict, action: dict) -> float | None:
    if action["action"] == "failure":
        return None
    if action["action"] == "abandon":
        return 0.0 if any(row["constraintMatch"] for row in state["candidates"]) else 1.0
    row = next(row for row in state["candidates"] if row["candidateId"] == action["candidateId"])
    return float(row["decisionQuality"])


def contrast(actions: dict[str, dict]) -> dict:
    labels = {condition: action_label(action) for condition, action in actions.items()}
    cross = [
        labels["immediate-a"] != labels["held-a"],
        labels["immediate-a"] != labels["held-b"],
        labels["immediate-b"] != labels["held-a"],
        labels["immediate-b"] != labels["held-b"],
    ]
    immediate_within = int(labels["immediate-a"] != labels["immediate-b"])
    held_within = int(labels["held-a"] != labels["held-b"])
    distance = 2 * float(np.mean(cross)) - immediate_within - held_within
    matched_changes = sum(
        labels[f"immediate-{replicate}"] != labels[f"held-{replicate}"]
        for replicate in ["a", "b"]
    )
    return {
        "actions": labels,
        "actionDistributionDistance": round(distance, 6),
        "immediateWithinDivergence": immediate_within,
        "heldWithinDivergence": held_within,
        "matchedCrossArmActionChangeCount": matched_changes,
    }


def dry_run(protocol: dict, provider: str, env: dict[str, str]) -> dict:
    spec = legacy.provider_spec(protocol, provider)
    requests = int(protocol["sampling"]["taskModelUnitCount"]) * int(protocol["decisionInstrument"]["callsPerUnit"])
    sample = {
        "phase": "terminal",
        "decision": "select one offered candidate or abandon",
        "hardConstraint": "select only a candidate with constraintMatch=true",
        "candidates": [
            {
                "candidateId": f"P-{index:08X}",
                "constraintMatch": index % 3 != 0,
                "taskUtility": round(1 - index / 20, 4),
                "taskLocalRank": index + 1,
                "searchRank": index + 1,
                "novelty": round(index / 12, 4),
                "inspected": False,
            }
            for index in range(12)
        ],
    }
    payload = legacy.request_payload(env, provider, "forced-inspection", "terminal", sample)
    token_limit = int(protocol["decisionInstrument"]["maximumOutputTokens"])
    payload["max_output_tokens" if provider == "mimo" else "max_tokens"] = token_limit
    input_tokens = math.ceil(len(canonical(payload)) / 3)
    maximum_cost = (
        requests * input_tokens / 1_000_000 * spec["inputPricePerMillion"]
        + requests * token_limit / 1_000_000 * spec["outputPricePerMillion"]
    )
    return {
        "mode": "dry-run-no-api-call",
        "provider": spec["provider"],
        "model": legacy.model_id(env, provider),
        "taskModelUnitCount": protocol["sampling"]["taskModelUnitCount"],
        "requestCountBeforeRetries": requests,
        "currency": spec["priceCurrency"],
        "estimatedMaximumCostBeforeRetries": round(maximum_cost, 6),
        "recommendedHardCap": math.ceil(maximum_cost * 1.5 * 100) / 100,
        "apiKeyPresent": bool(legacy.api_key(env, provider)),
    }


def run_preflight(protocol: dict, protocol_hash: str) -> dict:
    counts = Counter()
    failures = []
    displacement = []
    for category, task, products, family, seed, scorer in study_units(protocol):
        unit = prepared_unit(protocol, category, task, products, scorer)
        counts["units"] += 1
        immediate_order = unit["servedOrders"]["immediate"]
        held_order = unit["servedOrders"]["held"]
        counts["servedOrderChanged"] += int(immediate_order != held_order)
        displacement.append(normalized_rank_displacement(immediate_order, held_order))
        for mode in MODES:
            layouts = {
                condition: [row["candidateId"] for row in unit["states"][mode][condition]["candidates"]]
                for condition in CONDITIONS
            }
            if len({frozenset(layout) for layout in layouts.values()}) != 1:
                failures.append(f"candidate-set:{category}:{task['taskId']}:{family}:{mode}")
            if sha256(canonical(unit["states"][mode]["immediate-a"])) != sha256(canonical(unit["states"][mode]["immediate-b"])):
                failures.append(f"immediate-repeat:{category}:{task['taskId']}:{family}:{mode}")
            if sha256(canonical(unit["states"][mode]["held-a"])) != sha256(canonical(unit["states"][mode]["held-b"])):
                failures.append(f"held-repeat:{category}:{task['taskId']}:{family}:{mode}")
        masked = unit["states"]["masked-control"]
        if len({sha256(canonical(masked[condition])) for condition in CONDITIONS}) != 1:
            failures.append(f"masked-not-identical:{category}:{task['taskId']}:{family}")
        if unit["postResolutionInputHashes"]["immediate"] != unit["postResolutionInputHashes"]["held"]:
            failures.append(f"post-resolution:{category}:{task['taskId']}:{family}")
    expected = int(protocol["sampling"]["taskModelUnitCount"])
    passed = counts["units"] == expected and not failures and counts["servedOrderChanged"] / expected >= 0.75
    result = {
        "schemaVersion": "online-storefront-instrument-ablation-preflight.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "passed": passed,
        "taskModelUnitCount": counts["units"],
        "servedOrderChangeCount": counts["servedOrderChanged"],
        "servedOrderChangeRate": round(counts["servedOrderChanged"] / max(1, counts["units"]), 6),
        "meanNormalizedRankDisplacement": round(float(np.mean(displacement)), 6),
        "failureCount": len(failures),
        "failures": failures,
    }
    write_json(ROOT / protocol["outputs"]["publicRoot"] / "preflight.json", result, pretty=True)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["mimo", "deepseek"])
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--accept-cost-cap", type=float)
    parser.add_argument("--protocol", default=str(PROTOCOL_PATH.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol, protocol_text = protocol_and_text(protocol_path)
    protocol_hash = sha256(protocol_text.encode("utf-8"))
    if args.preflight:
        result = run_preflight(protocol, protocol_hash)
        print(json.dumps(result, indent=2), flush=True)
        if not result["passed"]:
            raise SystemExit(1)
        return
    if not args.provider:
        raise RuntimeError("--provider is required unless --preflight is used")

    env = legacy.provider_env(args.provider)
    estimate = dry_run(protocol, args.provider, env)
    estimate["protocolSha256"] = protocol_hash
    print(json.dumps(estimate, indent=2), flush=True)
    if not args.execute:
        return
    if not legacy.api_key(env, args.provider):
        raise RuntimeError(f"{args.provider} API key is missing")
    if args.accept_cost_cap is None or args.accept_cost_cap < estimate["recommendedHardCap"]:
        raise RuntimeError("Live calls require --accept-cost-cap at or above the dry-run hard cap")

    spec = legacy.provider_spec(protocol, args.provider)
    output = ROOT / protocol["outputs"]["publicRoot"] / args.provider
    artifact_root = ROOT / protocol["outputs"]["artifactRoot"] / args.provider
    stats = defaultdict(int)
    stats["latencies"] = []
    stats["fingerprints"] = set()
    stats["returnedModels"] = set()
    stats["acceptedCostCap"] = args.accept_cost_cap
    rows = []
    token_limit = int(protocol["decisionInstrument"]["maximumOutputTokens"])

    units = list(study_units(protocol))
    for unit_index, (category, task, products, family, seed, scorer) in enumerate(units, 1):
        unit = prepared_unit(protocol, category, task, products, scorer)
        mode_rows = []
        for mode in mode_order(protocol, args.provider, category, task["taskId"], family):
            actions = {}
            qualities = {}
            response_hashes = {}
            order = condition_order(protocol, args.provider, category, task["taskId"], family, mode)
            for condition in order:
                state = unit["states"][mode][condition]
                sent_state = state_without_quality(state)
                aliases = {row["candidateId"] for row in state["candidates"]}
                payload = legacy.request_payload(env, args.provider, "forced-inspection", "terminal", sent_state)
                payload["max_output_tokens" if args.provider == "mimo" else "max_tokens"] = token_limit
                try:
                    call = legacy.provider_call(
                        env,
                        args.provider,
                        spec,
                        payload,
                        aliases,
                        "terminal",
                        f"instrument-ablation/{category}/{task['taskId']}/{family}/{mode}/{condition}",
                        stats,
                        artifact_root,
                    )
                    actions[condition] = call["action"]
                    response_hashes[condition] = call["cacheKey"]
                except RuntimeError as error:
                    if "cost cap" in str(error).lower():
                        raise
                    actions[condition] = {"action": "failure", "candidateId": None}
                    response_hashes[condition] = sha256(str(error).encode("utf-8"))
                    stats["terminalFailureCount"] += 1
                qualities[condition] = action_quality(state, actions[condition])
            row = {
                "category": category,
                "taskId": task["taskId"],
                "modelFamily": family,
                "modelSeed": seed,
                "provider": args.provider,
                "mode": mode,
                **contrast(actions),
                "decisionQualities": qualities,
                "callOrder": order,
                "responseHashes": response_hashes,
                "auditPrimitives": {
                    "stateHashes": {condition: sha256(canonical(unit["states"][mode][condition])) for condition in CONDITIONS},
                    "candidateLayouts": {
                        condition: [candidate["candidateId"] for candidate in unit["states"][mode][condition]["candidates"]]
                        for condition in CONDITIONS
                    },
                },
            }
            mode_rows.append(row)
        rows.extend(mode_rows)
        print(f"instrument-ablation provider={args.provider} units={unit_index}/{len(units)}", flush=True)

    observed_cost = (
        stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"]
        + stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
    )
    summary = {
        "schemaVersion": "online-storefront-instrument-ablation-run-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "provider": args.provider,
        "model": legacy.model_id(env, args.provider),
        "taskModelUnitCount": len(units),
        "modeRowCount": len(rows),
        "api": {
            "requestCount": stats["requestCount"],
            "cacheHitCount": stats["cacheHitCount"],
            "attemptCount": stats["attemptCount"],
            "validActionCount": stats["validActionCount"],
            "invalidOrFailedAttemptCount": stats["invalidOrFailedAttemptCount"],
            "timeoutCount": stats["timeoutCount"],
            "terminalFailureCount": stats["terminalFailureCount"],
            "inputTokens": stats["inputTokens"],
            "outputTokens": stats["outputTokens"],
            "currency": spec["priceCurrency"],
            "observedCostAtPublishedRates": round(observed_cost, 6),
            "systemFingerprints": sorted(stats["fingerprints"]),
            "returnedModels": sorted(stats["returnedModels"]),
        },
        "claimBoundary": protocol["claimBoundary"],
    }
    write_json(output / "rows.json", {"schemaVersion": "online-storefront-instrument-ablation-rows.v1", "rows": rows})
    write_json(output / "summary.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
