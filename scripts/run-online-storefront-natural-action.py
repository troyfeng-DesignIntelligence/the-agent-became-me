"""Run the P0-repaired natural-frame LLM action study.

Dry-run is the default. ``--preflight`` constructs every task/model unit without
calling a provider and checks the frozen candidate and state invariants. Live
calls require an explicit provider-specific cost cap.
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
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v6/natural-action-study-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"


def load_module(name: str, path: Path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


legacy = load_module(
    "storefront_cross_llm_legacy",
    ROOT / "scripts/run-online-storefront-cross-llm-pilot.py",
)
pilot = legacy.pilot
models = legacy.models
v2 = legacy.v2
delegate = legacy.delegate
cross = legacy.cross
sas = legacy.sas
gru = legacy.gru


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def stable_index(value: str, size: int) -> int:
    return int(sha256(value.encode("utf-8"))[:16], 16) % size


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def pooled_candidates(
    task: dict,
    products: dict[int, dict],
    immediate: list[int],
    held: list[int],
    local: list[int],
    search: list[int],
    limit: int,
) -> list[int]:
    sources = [immediate, held, local, search]
    ranks = [{item: index + 1 for index, item in enumerate(source)} for source in sources]
    candidates = {
        item
        for source in sources
        for item in source
        if item not in task["interacted"]
        and item in products
        and bool(products[item]["title"])
    }

    def priority(item: int) -> tuple[float, int, int]:
        available = [rank[item] for rank in ranks if item in rank]
        appearances = sum(item in rank for rank in ranks)
        return (min(available), -appearances, item)

    return sorted(candidates, key=priority)[:limit]


def frozen_layout(items: list[int], key: str) -> list[int]:
    return sorted(items, key=lambda item: sha256(f"{key}/{item}".encode("utf-8")))


def reciprocal(rank: int | None) -> float:
    return 0.0 if rank is None else 1.0 / rank


def candidate_quality(row: dict) -> float:
    if not row["constraintMatch"]:
        return 0.0
    return round(
        0.40 * float(row["taskUtility"])
        + 0.25 * reciprocal(row["taskLocalRank"])
        + 0.20 * reciprocal(row["searchRank"])
        + 0.15 * float(row["novelty"]),
        6,
    )


def call_order(protocol: dict, provider: str, category: str, task_id: str, family: str) -> list[str]:
    orders = protocol["callOrder"]["orders"]
    index = stable_index(f"{provider}/{category}/{task_id}/{family}", len(orders))
    return list(orders[index])


def model_seed(protocol: dict, category: str, task_id: str, family: str) -> int:
    seeds = protocol["sampling"]["modelSeeds"]
    return int(seeds[stable_index(f"{category}/{task_id}/{family}", len(seeds))])


def prepared_unit(
    protocol: dict,
    category: str,
    task: dict,
    products: dict[int, dict],
    scorer,
) -> dict:
    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    conditions = {row["id"]: row for row in v2_protocol["conditions"]}
    search = delegate.search_catalog(task, products)
    initial_viewed = list(search[:2])
    mask = set(task["interacted"]) | set(initial_viewed) | {task["nextTaskItem"]}
    platforms = {}
    for arm, condition_id in [
        ("immediate", "immediate-remove"),
        ("held", "held-outcome"),
    ]:
        context = v2.condition_context(
            task, condition_id, initial_viewed, None, "task-in-progress"
        )
        platforms[arm] = scorer.top(context, mask)
    local = delegate.local_recommendations(
        task,
        products,
        initial_viewed,
        set(task["history"]) | set(initial_viewed),
    )
    candidates = pooled_candidates(
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

    states = {}
    audits = {}
    for arm in ["immediate", "held"]:
        platform = platforms[arm]
        inspected = next((item for item in platform if item in candidates), candidates[0])
        viewed = [*initial_viewed, inspected]
        base_features = pilot.candidate_features(
            task,
            products,
            candidates,
            platform,
            local,
            search,
            viewed,
            category,
        )
        feature_by_item = {
            item: {
                **feature,
                "inspected": item == inspected,
                "decisionQuality": candidate_quality(feature),
            }
            for item, feature in zip(candidates, base_features, strict=True)
        }
        ordered = frozen_layout(candidates, f"{category}/{task['taskId']}/shared")
        for replicate in ["a", "b"]:
            condition = f"{arm}-{replicate}"
            states[condition] = {
                "phase": "terminal",
                "decision": "select one offered candidate or abandon",
                "hardConstraint": "select only a candidate with constraintMatch=true",
                "inspectionRule": "the inspected candidate remains selectable",
                "candidates": [feature_by_item[item] for item in ordered],
            }
        post_context = v2.condition_context(
            task,
            conditions["immediate-remove" if arm == "immediate" else "held-outcome"]["id"],
            viewed,
            None,
            "outcome-resolved",
        )
        audits[arm] = {
            "inspectedAlias": pilot.item_alias(category, task["taskId"], inspected),
            "inspectedConstraintMatch": bool(
                delegate.constraint_match(task, products[inspected])
            ),
            "candidateAliases": sorted(
                pilot.item_alias(category, task["taskId"], item) for item in candidates
            ),
            "postResolutionInputHash": sha256(canonical(post_context)),
            "platformRanks": {
                pilot.item_alias(category, task["taskId"], item): (
                    platform.index(item) + 1 if item in platform else None
                )
                for item in candidates
            },
            "bestFeasiblePlatformAlias": next(
                (
                    pilot.item_alias(category, task["taskId"], item)
                    for item in platform
                    if item in candidates
                    and delegate.constraint_match(task, products[item])
                ),
                None,
            ),
        }

    immediate_a = states["immediate-a"]["candidates"]
    held_a = states["held-a"]["candidates"]
    exposure_changed = (
        audits["immediate"]["platformRanks"] != audits["held"]["platformRanks"]
    )
    opportunity = (
        audits["immediate"]["bestFeasiblePlatformAlias"]
        != audits["held"]["bestFeasiblePlatformAlias"]
    )
    return {
        "states": states,
        "audits": audits,
        "opportunity": bool(opportunity),
        "exposureChanged": bool(exposure_changed),
        "inspectedIdentityChanged": (
            audits["immediate"]["inspectedAlias"]
            != audits["held"]["inspectedAlias"]
        ),
        "candidateAliases": audits["immediate"]["candidateAliases"],
        "candidateSetMatched": audits["immediate"]["candidateAliases"]
        == audits["held"]["candidateAliases"],
        "layoutsMatched": [row["candidateId"] for row in immediate_a]
        == [row["candidateId"] for row in held_a],
        "allFourLayoutsMatched": len(
            {
                tuple(row["candidateId"] for row in states[condition]["candidates"])
                for condition in ["immediate-a", "held-a", "immediate-b", "held-b"]
            }
        )
        == 1,
        "postResolutionMatched": audits["immediate"]["postResolutionInputHash"]
        == audits["held"]["postResolutionInputHash"],
    }


def action_quality(state: dict, action: dict) -> float:
    if action["action"] == "failure":
        return None
    if action["action"] == "abandon":
        feasible = any(row["constraintMatch"] for row in state["candidates"])
        return 0.0 if feasible else 1.0
    row = next(
        candidate
        for candidate in state["candidates"]
        if candidate["candidateId"] == action["candidateId"]
    )
    return float(row["decisionQuality"])


def action_label(action: dict) -> str:
    if action["action"] == "failure":
        return "__PROTOCOL_FAILURE__"
    return "__ABANDON__" if action["action"] == "abandon" else action["candidateId"]


def disagreement(left: str, right: str) -> int:
    return int(left != right)


def contrast_row(metadata: dict, opportunity: bool, actions: dict, qualities: dict) -> dict:
    labels = {key: action_label(value) for key, value in actions.items()}
    cross_pairs = [
        ("immediate-a", "held-a"),
        ("immediate-a", "held-b"),
        ("immediate-b", "held-a"),
        ("immediate-b", "held-b"),
    ]
    cross_mean = float(np.mean([disagreement(labels[a], labels[b]) for a, b in cross_pairs]))
    immediate_sham = disagreement(labels["immediate-a"], labels["immediate-b"])
    held_sham = disagreement(labels["held-a"], labels["held-b"])
    distribution_distance = 2 * cross_mean - immediate_sham - held_sham
    quality_complete = all(value is not None for value in qualities.values())
    immediate_quality = (
        float(np.mean([qualities["immediate-a"], qualities["immediate-b"]]))
        if quality_complete
        else None
    )
    held_quality = (
        float(np.mean([qualities["held-a"], qualities["held-b"]]))
        if quality_complete
        else None
    )
    return {
        **metadata,
        "opportunity": opportunity,
        "actions": labels,
        "decisionQualities": qualities,
        "sameLayoutDivergence": round(
            float(
                np.mean(
                    [
                        disagreement(labels["immediate-a"], labels["held-a"]),
                        disagreement(labels["immediate-b"], labels["held-b"]),
                    ]
                )
            ),
            6,
        ),
        "immediateWithinDivergence": immediate_sham,
        "heldWithinDivergence": held_sham,
        "actionDistributionDistance": round(distribution_distance, 6),
        "decisionQualityComplete": quality_complete,
        "immediateDecisionQuality": round(immediate_quality, 6) if quality_complete else None,
        "heldDecisionQuality": round(held_quality, 6) if quality_complete else None,
        "heldMinusImmediateDecisionQuality": (
            round(held_quality - immediate_quality, 6) if quality_complete else None
        ),
    }


def protocol_and_text(path: Path = PROTOCOL_PATH) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), text


def dry_run(protocol: dict, provider: str, env: dict[str, str]) -> dict:
    spec = legacy.provider_spec(protocol, provider)
    task_count = protocol["sampling"]["tasksPerCategory"] * len(protocol["sampling"]["categories"])
    unit_count = task_count * len(protocol["sampling"]["recommenderFamiliesPerTask"])
    requests = unit_count * int(protocol["decisionInstrument"]["callsPerUnit"])
    sample = {
        "phase": "terminal",
        "hardConstraint": "select only a candidate with constraintMatch=true",
        "inspectionRule": "the inspected candidate remains selectable",
        "candidates": [
            {
                "candidateId": f"P-{index:08X}",
                "constraintMatch": index % 3 != 0,
                "taskUtility": 1.0,
                "platformRank": index + 1 if index < 10 else None,
                "taskLocalRank": index + 1 if index < 8 else None,
                "searchRank": index + 1 if index < 6 else None,
                "novelty": round(index / 12, 4),
                "inspected": index == 0,
            }
            for index in range(12)
        ],
    }
    payload = legacy.request_payload(env, provider, "forced-inspection", "terminal", sample)
    token_limit = int(protocol["decisionInstrument"]["maximumOutputTokens"])
    if provider == "mimo":
        payload["max_output_tokens"] = token_limit
    else:
        payload["max_tokens"] = token_limit
    input_tokens = math.ceil(len(canonical(payload)) / 3)
    maximum_cost = (
        requests * input_tokens / 1_000_000 * spec["inputPricePerMillion"]
        + requests * token_limit / 1_000_000 * spec["outputPricePerMillion"]
    )
    return {
        "mode": "dry-run-no-api-call",
        "provider": spec["provider"],
        "model": legacy.model_id(env, provider),
        "taskCount": task_count,
        "taskModelUnitCount": unit_count,
        "requestCountBeforeRetries": requests,
        "currency": spec["priceCurrency"],
        "estimatedMaximumCostBeforeRetries": round(maximum_cost, 6),
        "recommendedHardCap": math.ceil(maximum_cost * 1.5 * 100) / 100,
        "apiKeyPresent": bool(legacy.api_key(env, provider)),
    }


def study_units(protocol: dict):
    expected_categories = set(protocol["sampling"]["categories"])
    for category in cross.CATEGORIES:
        slug = category["slug"]
        if slug not in expected_categories:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = int(protocol["sampling"]["tasksPerCategory"])
        tasks = sorted(delegate.build_tasks(category, data, products), key=lambda row: row["taskId"])
        tasks = tasks[: int(protocol["sampling"]["tasksPerCategory"])]
        if len(tasks) != int(protocol["sampling"]["tasksPerCategory"]):
            raise RuntimeError(f"Natural frame incomplete for {slug}")
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task in tasks:
            for family in protocol["sampling"]["recommenderFamiliesPerTask"]:
                seed = model_seed(protocol, slug, task["taskId"], family)
                model = sas_models[seed] if family == "sasrec" else gru_models[seed]
                scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
                model.eval()
                scorer = models.ModelScorer(model, scoring)
                yield slug, task, products, family, seed, scorer


def run_preflight(protocol: dict, protocol_hash: str) -> dict:
    counts = Counter()
    order_counts = Counter()
    source_history_counts = Counter()
    quality_values = []
    failures = []
    for slug, task, products, family, seed, scorer in study_units(protocol):
        unit = prepared_unit(protocol, slug, task, products, scorer)
        source_history_counts[(slug, task["user"])] += 1
        counts["units"] += 1
        counts["opportunities"] += int(unit["opportunity"])
        counts["exposureChanged"] += int(unit["exposureChanged"])
        counts["inspectedIdentityChanged"] += int(unit["inspectedIdentityChanged"])
        counts["candidateSetMatched"] += int(unit["candidateSetMatched"])
        counts["layoutsMatched"] += int(unit["layoutsMatched"])
        counts["allFourLayoutsMatched"] += int(unit["allFourLayoutsMatched"])
        counts["postResolutionMatched"] += int(unit["postResolutionMatched"])
        counts["withinArmStateMatched"] += int(
            sha256(canonical(unit["states"]["immediate-a"]))
            == sha256(canonical(unit["states"]["immediate-b"]))
            and sha256(canonical(unit["states"]["held-a"]))
            == sha256(canonical(unit["states"]["held-b"]))
        )
        for arm in ["immediate", "held"]:
            inspected = unit["audits"][arm]["inspectedAlias"]
            present = inspected in unit["audits"][arm]["candidateAliases"]
            counts["inspectedSelectable"] += int(present)
            if not present:
                failures.append(f"inspected-not-selectable:{slug}:{task['taskId']}:{family}:{arm}")
        for provider in ["mimo", "deepseek"]:
            order_counts[tuple(call_order(protocol, provider, slug, task["taskId"], family))] += 1
        quality_values.extend(
            row["decisionQuality"]
            for row in unit["states"]["immediate-a"]["candidates"]
            if row["constraintMatch"]
        )
        if (
            not unit["candidateSetMatched"]
            or not unit["layoutsMatched"]
            or not unit["allFourLayoutsMatched"]
            or not unit["postResolutionMatched"]
        ):
            failures.append(f"paired-invariant:{slug}:{task['taskId']}:{family}:{seed}")

    expected = (
        int(protocol["sampling"]["tasksPerCategory"])
        * len(protocol["sampling"]["categories"])
        * len(protocol["sampling"]["recommenderFamiliesPerTask"])
    )
    passed = (
        counts["units"] == expected
        and counts["candidateSetMatched"] == expected
        and counts["layoutsMatched"] == expected
        and counts["allFourLayoutsMatched"] == expected
        and counts["postResolutionMatched"] == expected
        and counts["withinArmStateMatched"] == expected
        and counts["inspectedSelectable"] == expected * 2
        and len(source_history_counts) * len(protocol["sampling"]["recommenderFamiliesPerTask"])
        == expected
        and max(source_history_counts.values())
        == len(protocol["sampling"]["recommenderFamiliesPerTask"])
        and len(set(quality_values)) > 1
        and not failures
    )
    summary = {
        "schemaVersion": "online-storefront-natural-action-preflight.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "passed": passed,
        "taskModelUnitCount": counts["units"],
        "opportunityCount": counts["opportunities"],
        "naturalOpportunityRate": round(counts["opportunities"] / max(1, counts["units"]), 6),
        "exposureManipulationCount": counts["exposureChanged"],
        "exposureManipulationRate": round(counts["exposureChanged"] / max(1, counts["units"]), 6),
        "inspectedIdentityChangeCount": counts["inspectedIdentityChanged"],
        "inspectedIdentityChangeRate": round(counts["inspectedIdentityChanged"] / max(1, counts["units"]), 6),
        "candidateSetMatchCount": counts["candidateSetMatched"],
        "layoutMatchCount": counts["layoutsMatched"],
        "allFourLayoutMatchCount": counts["allFourLayoutsMatched"],
        "inspectedSelectableCount": counts["inspectedSelectable"],
        "postResolutionInputMatchCount": counts["postResolutionMatched"],
        "withinArmByteIdenticalStateCount": counts["withinArmStateMatched"],
        "uniqueSourceHistoryCount": len(source_history_counts),
        "taskCountPerSourceHistory": 1,
        "decisionQualityDistinctValueCount": len(set(quality_values)),
        "decisionQualityStandardDeviation": round(float(np.std(quality_values)), 6),
        "callOrderCounts": {" / ".join(key): value for key, value in order_counts.items()},
        "failureCount": len(failures),
        "failures": failures[:50],
    }
    output = ROOT / protocol["outputs"]["publicRoot"] / "preflight.json"
    write_json(output, summary, pretty=True)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["mimo", "deepseek"])
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--accept-cost-cap", type=float)
    parser.add_argument(
        "--protocol",
        default=str(PROTOCOL_PATH.relative_to(ROOT)),
        help="Repository-relative frozen protocol path.",
    )
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
    order_counts = Counter()
    token_limit = int(protocol["decisionInstrument"]["maximumOutputTokens"])

    for unit_index, (slug, task, products, family, seed, scorer) in enumerate(study_units(protocol), 1):
        unit = prepared_unit(protocol, slug, task, products, scorer)
        if not all(
            [
                unit["candidateSetMatched"],
                unit["layoutsMatched"],
                unit["allFourLayoutsMatched"],
                unit["postResolutionMatched"],
            ]
        ):
            raise RuntimeError("Paired invariant failed after preflight")
        order = call_order(protocol, args.provider, slug, task["taskId"], family)
        order_counts[tuple(order)] += 1
        actions = {}
        qualities = {}
        response_hashes = {}
        for condition in order:
            state = unit["states"][condition]
            aliases = {row["candidateId"] for row in state["candidates"]}
            sent_state = {
                **state,
                "candidates": [
                    {
                        key: value
                        for key, value in row.items()
                        if key != "decisionQuality"
                    }
                    for row in state["candidates"]
                ],
            }
            payload = legacy.request_payload(
                env, args.provider, "forced-inspection", "terminal", sent_state
            )
            if args.provider == "mimo":
                payload["max_output_tokens"] = token_limit
            else:
                payload["max_tokens"] = token_limit
            try:
                call = legacy.provider_call(
                    env,
                    args.provider,
                    spec,
                    payload,
                    aliases,
                    "terminal",
                    f"natural-action/{slug}/{task['taskId']}/{family}/{condition}",
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
        rows.append(
            {
                **contrast_row(
                    {
                        "category": slug,
                        "taskId": task["taskId"],
                        "modelFamily": family,
                        "modelSeed": seed,
                        "provider": args.provider,
                    },
                    unit["opportunity"],
                    actions,
                    qualities,
                ),
                "exposureChanged": unit["exposureChanged"],
                "inspectedIdentityChanged": unit["inspectedIdentityChanged"],
                "callOrder": order,
                "responseHashes": response_hashes,
                "auditPrimitives": {
                    "stateHashes": {
                        condition: sha256(canonical(unit["states"][condition]))
                        for condition in [
                            "immediate-a",
                            "held-a",
                            "immediate-b",
                            "held-b",
                        ]
                    },
                    "candidateLayouts": {
                        condition: [
                            candidate["candidateId"]
                            for candidate in unit["states"][condition]["candidates"]
                        ]
                        for condition in [
                            "immediate-a",
                            "held-a",
                            "immediate-b",
                            "held-b",
                        ]
                    },
                    "platformRanks": {
                        arm: unit["audits"][arm]["platformRanks"]
                        for arm in ["immediate", "held"]
                    },
                    "inspectedAliases": {
                        arm: unit["audits"][arm]["inspectedAlias"]
                        for arm in ["immediate", "held"]
                    },
                    "bestFeasiblePlatformAliases": {
                        arm: unit["audits"][arm]["bestFeasiblePlatformAlias"]
                        for arm in ["immediate", "held"]
                    },
                    "postResolutionInputHashes": {
                        arm: unit["audits"][arm]["postResolutionInputHash"]
                        for arm in ["immediate", "held"]
                    },
                },
                "candidateSetMatched": unit["candidateSetMatched"],
                "allFourLayoutsMatched": unit["allFourLayoutsMatched"],
                "inspectedSelectable": all(
                    unit["audits"][arm]["inspectedAlias"]
                    in unit["audits"][arm]["candidateAliases"]
                    for arm in ["immediate", "held"]
                ),
                "postResolutionInputMatched": unit["postResolutionMatched"],
            }
        )
        if unit_index % 20 == 0:
            print(f"natural-action provider={args.provider} units={unit_index}/920", flush=True)

    observed_cost = (
        stats["inputTokens"] / 1_000_000 * spec["inputPricePerMillion"]
        + stats["outputTokens"] / 1_000_000 * spec["outputPricePerMillion"]
    )
    api_summary = {
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
    }
    generated_at = datetime.now(timezone.utc).isoformat()
    prior_summary_path = output / "summary.json"
    audit_replay = None
    if prior_summary_path.exists() and stats["requestCount"] == 0:
        prior_summary = json.loads(prior_summary_path.read_text(encoding="utf-8"))
        if (
            prior_summary.get("protocolSha256") == protocol_hash
            and prior_summary.get("api", {}).get("requestCount", 0) > 0
        ):
            generated_at = prior_summary["generatedAt"]
            api_summary = prior_summary["api"]
            audit_replay = {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "networkRequestCount": 0,
                "cacheHitCount": stats["cacheHitCount"],
                "purpose": "Republish audit primitives without altering original provider accounting.",
            }
    summary = {
        "schemaVersion": "online-storefront-natural-action-run-summary.v1",
        "generatedAt": generated_at,
        "protocolSha256": protocol_hash,
        "provider": args.provider,
        "model": legacy.model_id(env, args.provider),
        "taskModelUnitCount": len(rows),
        "naturalOpportunityRate": round(float(np.mean([row["opportunity"] for row in rows])), 6),
        "overallActionDistributionDistance": round(
            float(np.mean([row["actionDistributionDistance"] for row in rows])), 6
        ),
        "conditionalActionDistributionDistance": round(
            float(np.mean([row["actionDistributionDistance"] for row in rows if row["opportunity"]])), 6
        ) if any(row["opportunity"] for row in rows) else None,
        "meanHeldMinusImmediateDecisionQuality": round(
            float(
                np.mean(
                    [
                        row["heldMinusImmediateDecisionQuality"]
                        for row in rows
                        if row["heldMinusImmediateDecisionQuality"] is not None
                    ]
                )
            ),
            6,
        ) if any(row["heldMinusImmediateDecisionQuality"] is not None for row in rows) else None,
        "api": api_summary,
        "auditReplay": audit_replay,
        "callOrderCounts": {" / ".join(key): value for key, value in order_counts.items()},
        "claimBoundary": protocol["claimBoundary"],
    }
    write_json(output / "rows.json", {"schemaVersion": "online-storefront-natural-action-rows.v1", "rows": rows})
    write_json(output / "summary.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
