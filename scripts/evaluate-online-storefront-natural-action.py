"""Evaluate the frozen natural-frame action study with task-cluster bootstrap."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v6/natural-action-study-protocol.json"


def canonical_protocol() -> tuple[dict, str]:
    text = PROTOCOL_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), hashlib.sha256(text.encode("utf-8")).hexdigest()


def interval(values: list[float]) -> list[float]:
    return [
        round(float(np.quantile(values, 0.025)), 6),
        round(float(np.quantile(values, 0.975)), 6),
    ]


def worst_case_quality(row: dict) -> float:
    qualities = row["decisionQualities"]
    immediate = np.mean(
        [
            1.0 if qualities[key] is None else float(qualities[key])
            for key in ["immediate-a", "immediate-b"]
        ]
    )
    held = np.mean(
        [
            0.0 if qualities[key] is None else float(qualities[key])
            for key in ["held-a", "held-b"]
        ]
    )
    return float(held - immediate)


CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]
FAMILIES = {"sasrec", "gru4rec"}


def recompute_row(row: dict, provider: str) -> dict:
    """Rebuild estimands and invariants from public action/state primitives."""
    if row.get("provider") != provider:
        raise RuntimeError("row provider does not match its public provider directory")
    if set(row.get("actions", {})) != set(CONDITIONS):
        raise RuntimeError("row does not contain exactly the four frozen action cells")
    labels = row["actions"]
    cross_pairs = [
        ("immediate-a", "held-a"),
        ("immediate-a", "held-b"),
        ("immediate-b", "held-a"),
        ("immediate-b", "held-b"),
    ]
    cross_mean = float(np.mean([labels[left] != labels[right] for left, right in cross_pairs]))
    immediate_within = int(labels["immediate-a"] != labels["immediate-b"])
    held_within = int(labels["held-a"] != labels["held-b"])
    same_layout = float(
        np.mean(
            [
                labels["immediate-a"] != labels["held-a"],
                labels["immediate-b"] != labels["held-b"],
            ]
        )
    )
    distance = 2 * cross_mean - immediate_within - held_within

    qualities = row.get("decisionQualities", {})
    if set(qualities) != set(CONDITIONS):
        raise RuntimeError("row does not contain exactly the four frozen quality cells")
    quality_complete = all(qualities[condition] is not None for condition in CONDITIONS)
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
    quality_difference = held_quality - immediate_quality if quality_complete else None

    audit = row.get("auditPrimitives")
    if not audit:
        raise RuntimeError("public row is missing auditPrimitives")
    layouts = audit["candidateLayouts"]
    if set(layouts) != set(CONDITIONS):
        raise RuntimeError("candidate-layout audit is incomplete")
    layout_tuples = {condition: tuple(layouts[condition]) for condition in CONDITIONS}
    if any(len(layout) != len(set(layout)) or not layout for layout in layout_tuples.values()):
        raise RuntimeError("candidate layout is empty or contains duplicate aliases")
    all_layouts_matched = len(set(layout_tuples.values())) == 1
    candidate_sets_matched = len({frozenset(layout) for layout in layout_tuples.values()}) == 1
    state_hashes = audit["stateHashes"]
    within_arm_states_matched = (
        state_hashes["immediate-a"] == state_hashes["immediate-b"]
        and state_hashes["held-a"] == state_hashes["held-b"]
    )
    platform_ranks = audit["platformRanks"]
    exposure_changed = platform_ranks["immediate"] != platform_ranks["held"]
    inspected = audit["inspectedAliases"]
    inspected_selectable = (
        inspected["immediate"] in layout_tuples["immediate-a"]
        and inspected["held"] in layout_tuples["held-a"]
    )
    inspected_changed = inspected["immediate"] != inspected["held"]
    feasible = audit["bestFeasiblePlatformAliases"]
    opportunity = feasible["immediate"] != feasible["held"]
    post = audit["postResolutionInputHashes"]
    post_matched = post["immediate"] == post["held"]

    recomputed = {
        "sameLayoutDivergence": round(same_layout, 6),
        "immediateWithinDivergence": immediate_within,
        "heldWithinDivergence": held_within,
        "actionDistributionDistance": round(distance, 6),
        "decisionQualityComplete": quality_complete,
        "immediateDecisionQuality": round(immediate_quality, 6) if quality_complete else None,
        "heldDecisionQuality": round(held_quality, 6) if quality_complete else None,
        "heldMinusImmediateDecisionQuality": (
            round(quality_difference, 6) if quality_complete else None
        ),
        "opportunity": opportunity,
        "exposureChanged": exposure_changed,
        "inspectedIdentityChanged": inspected_changed,
        "candidateSetMatched": candidate_sets_matched,
        "allFourLayoutsMatched": all_layouts_matched,
        "withinArmStatesMatched": within_arm_states_matched,
        "inspectedSelectable": inspected_selectable,
        "postResolutionInputMatched": post_matched,
    }
    for name, value in recomputed.items():
        if name in row and row[name] != value:
            raise RuntimeError(f"stored field {name} disagrees with public primitives")
    return {**row, **recomputed}


def validate_factorial_frame(rows: list[dict], protocol: dict, provider: str) -> None:
    expected_categories = set(protocol["sampling"]["categories"])
    expected_families = set(protocol["sampling"]["recommenderFamiliesPerTask"])
    expected_seeds = set(protocol["sampling"]["modelSeeds"])
    keys = [(row["category"], row["taskId"], row["modelFamily"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError(f"{provider} contains duplicate task-by-family cells")
    if {row["category"] for row in rows} != expected_categories:
        raise RuntimeError(f"{provider} category set differs from the frozen frame")
    if {row["modelFamily"] for row in rows} != expected_families:
        raise RuntimeError(f"{provider} recommender-family set differs from the frozen frame")
    if not {row["modelSeed"] for row in rows}.issubset(expected_seeds):
        raise RuntimeError(f"{provider} contains an undeclared checkpoint seed")
    tasks_per_category = int(protocol["sampling"]["tasksPerCategory"])
    for category in sorted(expected_categories):
        category_rows = [row for row in rows if row["category"] == category]
        task_ids = {row["taskId"] for row in category_rows}
        if len(task_ids) != tasks_per_category:
            raise RuntimeError(f"{provider}/{category} does not contain the frozen task count")
        for task_id in task_ids:
            families = {
                row["modelFamily"]
                for row in category_rows
                if row["taskId"] == task_id
            }
            if families != expected_families:
                raise RuntimeError(f"{provider}/{category}/{task_id} is not a complete family pair")


def metrics(rows: list[dict]) -> dict[str, float | None]:
    opportunity = [row for row in rows if row["opportunity"]]
    complete_quality = [
        row["heldMinusImmediateDecisionQuality"]
        for row in rows
        if row["heldMinusImmediateDecisionQuality"] is not None
    ]
    failure_actions = sum(
        label == "__PROTOCOL_FAILURE__"
        for row in rows
        for label in row["actions"].values()
    )
    return {
        "exposureManipulationRate": float(np.mean([row["exposureChanged"] for row in rows])),
        "naturalOpportunityRate": float(np.mean([row["opportunity"] for row in rows])),
        "overallActionDistributionDistance": float(
            np.mean([row["actionDistributionDistance"] for row in rows])
        ),
        "conditionalActionDistributionDistance": (
            float(np.mean([row["actionDistributionDistance"] for row in opportunity]))
            if opportunity
            else None
        ),
        "sameLayoutDivergence": float(np.mean([row["sameLayoutDivergence"] for row in rows])),
        "immediateWithinDivergence": float(
            np.mean([row["immediateWithinDivergence"] for row in rows])
        ),
        "heldWithinDivergence": float(
            np.mean([row["heldWithinDivergence"] for row in rows])
        ),
        "completeCaseQualityDifference": (
            float(np.mean(complete_quality)) if complete_quality else None
        ),
        "worstCaseQualityDifference": float(np.mean([worst_case_quality(row) for row in rows])),
        "protocolFailureRate": failure_actions / (4 * len(rows)),
    }


def stratified_cluster_samples(
    rows: list[dict], replicates: int, seed: int
) -> dict[str, list[float]]:
    """Resample task clusters within category so frozen category weights stay fixed."""
    clusters = defaultdict(list)
    for row in rows:
        clusters[(row["category"], row["taskId"])].append(row)
    keys_by_category = defaultdict(list)
    for key in sorted(clusters):
        keys_by_category[key[0]].append(key)
    rng = np.random.default_rng(seed)
    samples = defaultdict(list)
    for _ in range(replicates):
        sampled_rows = []
        for category in sorted(keys_by_category):
            keys = keys_by_category[category]
            indices = rng.integers(0, len(keys), size=len(keys))
            sampled_rows.extend(
                row for index in indices for row in clusters[keys[index]]
            )
        values = metrics(sampled_rows)
        for name, value in values.items():
            if value is not None:
                samples[name].append(value)
    return samples


def unstratified_cluster_samples(
    rows: list[dict], replicates: int, seed: int
) -> dict[str, list[float]]:
    clusters = defaultdict(list)
    for row in rows:
        clusters[(row["category"], row["taskId"])].append(row)
    keys = sorted(clusters)
    rng = np.random.default_rng(seed)
    samples = defaultdict(list)
    for _ in range(replicates):
        indices = rng.integers(0, len(keys), size=len(keys))
        sampled_rows = [row for index in indices for row in clusters[keys[index]]]
        values = metrics(sampled_rows)
        for name, value in values.items():
            if value is not None:
                samples[name].append(value)
    return samples


def estimate_block(
    rows: list[dict], replicates: int, seed: int, *, stratified: bool = False
) -> dict:
    point = metrics(rows)
    samples = (
        stratified_cluster_samples(rows, replicates, seed)
        if stratified
        else unstratified_cluster_samples(rows, replicates, seed)
    )
    return {
        name: {
            "estimate": round(value, 6) if value is not None else None,
            "ci95": interval(samples[name]) if value is not None else None,
        }
        for name, value in point.items()
    }


def transition_diagnostics(rows: list[dict]) -> dict:
    conditions = ["immediate-a", "held-a", "immediate-b", "held-b"]
    abandon_rates = {
        condition: round(
            float(np.mean([row["actions"][condition] == "__ABANDON__" for row in rows])),
            6,
        )
        for condition in conditions
    }
    transitions = defaultdict(int)
    for row in rows:
        for replicate in ["a", "b"]:
            immediate = row["actions"][f"immediate-{replicate}"]
            held = row["actions"][f"held-{replicate}"]
            if immediate == held:
                label = "same"
            elif immediate == "__ABANDON__":
                label = "abandon-to-select"
            elif held == "__ABANDON__":
                label = "select-to-abandon"
            else:
                label = "selected-candidate-swap"
            transitions[label] += 1
    return {
        "conditionAbandonRates": abandon_rates,
        "pairedTransitionCounts": dict(sorted(transitions.items())),
        "actionDistanceValueCounts": {
            str(value): sum(row["actionDistributionDistance"] == value for row in rows)
            for value in sorted({row["actionDistributionDistance"] for row in rows})
        },
        "opportunityTaskCount": len(
            {(row["category"], row["taskId"]) for row in rows if row["opportunity"]}
        ),
        "opportunityTaskModelUnitCount": sum(row["opportunity"] for row in rows),
    }


def subgroup_action_block(rows: list[dict], replicates: int, seed: int) -> dict:
    """Fast descriptive subgroup intervals for the main action estimand."""
    clusters = defaultdict(list)
    for row in rows:
        clusters[(row["category"], row["taskId"])].append(row)
    keys_by_category = defaultdict(list)
    for key in sorted(clusters):
        keys_by_category[key[0]].append(key)
    rng = np.random.default_rng(seed)
    replicate_sums = np.zeros(replicates)
    replicate_counts = np.zeros(replicates)
    opportunity_sums = np.zeros(replicates)
    opportunity_counts = np.zeros(replicates)
    quality_sums = np.zeros(replicates)
    quality_counts = np.zeros(replicates)
    for category in sorted(keys_by_category):
        keys = keys_by_category[category]
        action = np.asarray(
            [sum(row["actionDistributionDistance"] for row in clusters[key]) for key in keys]
        )
        count = np.asarray([len(clusters[key]) for key in keys])
        opportunity_action = np.asarray(
            [
                sum(
                    row["actionDistributionDistance"]
                    for row in clusters[key]
                    if row["opportunity"]
                )
                for key in keys
            ]
        )
        opportunity_count = np.asarray(
            [sum(row["opportunity"] for row in clusters[key]) for key in keys]
        )
        quality = np.asarray(
            [
                sum(
                    row["heldMinusImmediateDecisionQuality"]
                    for row in clusters[key]
                    if row["heldMinusImmediateDecisionQuality"] is not None
                )
                for key in keys
            ]
        )
        quality_count = np.asarray(
            [
                sum(row["heldMinusImmediateDecisionQuality"] is not None for row in clusters[key])
                for key in keys
            ]
        )
        sampled = rng.integers(0, len(keys), size=(replicates, len(keys)))
        replicate_sums += action[sampled].sum(axis=1)
        replicate_counts += count[sampled].sum(axis=1)
        opportunity_sums += opportunity_action[sampled].sum(axis=1)
        opportunity_counts += opportunity_count[sampled].sum(axis=1)
        quality_sums += quality[sampled].sum(axis=1)
        quality_counts += quality_count[sampled].sum(axis=1)
    point = metrics(rows)
    result = {
        "overallActionDistributionDistance": {
            "estimate": round(point["overallActionDistributionDistance"], 6),
            "ci95": interval((replicate_sums / replicate_counts).tolist()),
        },
        "naturalOpportunityRate": {
            "estimate": round(point["naturalOpportunityRate"], 6),
            "ci95": interval((opportunity_counts / replicate_counts).tolist()),
        },
        "completeCaseQualityDifference": {
            "estimate": round(point["completeCaseQualityDifference"], 6),
            "ci95": interval((quality_sums / quality_counts).tolist()),
        },
    }
    valid = opportunity_counts > 0
    result["conditionalActionDistributionDistance"] = {
        "estimate": (
            round(point["conditionalActionDistributionDistance"], 6)
            if point["conditionalActionDistributionDistance"] is not None
            else None
        ),
        "ci95": (
            interval((opportunity_sums[valid] / opportunity_counts[valid]).tolist())
            if point["conditionalActionDistributionDistance"] is not None
            else None
        ),
    }
    return result


def evaluate_provider(protocol: dict, protocol_hash: str, provider: str) -> dict:
    root = ROOT / protocol["outputs"]["publicRoot"] / provider
    run_summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
    payload = json.loads((root / "rows.json").read_text(encoding="utf-8"))
    if run_summary["protocolSha256"] != protocol_hash:
        raise RuntimeError(f"{provider} summary was generated under a different protocol")
    rows = [recompute_row(row, provider) for row in payload["rows"]]
    expected = (
        int(protocol["sampling"]["tasksPerCategory"])
        * len(protocol["sampling"]["categories"])
        * len(protocol["sampling"]["recommenderFamiliesPerTask"])
    )
    if len(rows) != expected:
        raise RuntimeError(f"{provider} has {len(rows)} rows; expected {expected}")
    validate_factorial_frame(rows, protocol, provider)
    if not all(
        row["candidateSetMatched"]
        and row["allFourLayoutsMatched"]
        and row["withinArmStatesMatched"]
        and row["inspectedSelectable"]
        and row["postResolutionInputMatched"]
        for row in rows
    ):
        raise RuntimeError(f"{provider} contains a failed P0 invariant")

    keys = sorted({(row["category"], row["taskId"]) for row in rows})
    replicates = int(protocol["uncertainty"]["replicates"])
    seed = int(protocol["uncertainty"]["seed"])
    frozen_estimates = estimate_block(rows, replicates, seed)
    estimates = estimate_block(rows, replicates, seed, stratified=True)
    subgroup_fields = ["category", "modelFamily", "modelSeed"]
    subgroups = {}
    for field_index, field in enumerate(subgroup_fields, start=1):
        subgroups[field] = {}
        for value_index, value in enumerate(sorted({row[field] for row in rows}), start=1):
            subset = [row for row in rows if row[field] == value]
            subgroups[field][str(value)] = {
                "taskCount": len({(row["category"], row["taskId"]) for row in subset}),
                "taskModelUnitCount": len(subset),
                "estimates": subgroup_action_block(
                    subset, replicates, seed + field_index * 1000 + value_index
                ),
            }
    return {
        "provider": provider,
        "taskCount": len(keys),
        "taskModelUnitCount": len(rows),
        "estimates": estimates,
        "frozenUnstratifiedEstimates": frozen_estimates,
        "sensitivityAnalyses": {
            "categoryStratifiedTaskClusterBootstrap": estimates,
        },
        "subgroups": subgroups,
        "diagnostics": transition_diagnostics(rows),
        "runApi": run_summary["api"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--provider", choices=["mimo", "deepseek", "both"], default="both"
    )
    args = parser.parse_args()
    protocol, protocol_hash = canonical_protocol()
    providers = ["mimo", "deepseek"] if args.provider == "both" else [args.provider]
    results = {provider: evaluate_provider(protocol, protocol_hash, provider) for provider in providers}
    gates = {}
    if "deepseek" in results:
        deepseek = results["deepseek"]["estimates"]
        deepseek_frozen = results["deepseek"]["frozenUnstratifiedEstimates"]
        gates["deepseekOverallEffectLowerBoundAboveZero"] = (
            deepseek["overallActionDistributionDistance"]["ci95"][0] > 0
            and deepseek_frozen["overallActionDistributionDistance"]["ci95"][0] > 0
        )
        gates["deepseekWorstCaseQualityLowerBoundAboveMargin"] = (
            deepseek["worstCaseQualityDifference"]["ci95"][0]
            > float(protocol["decisionQuality"]["guardrailMargin"])
        )
    if "mimo" in results:
        mimo = results["mimo"]["estimates"]
        mimo_frozen = results["mimo"]["frozenUnstratifiedEstimates"]
        gates["mimoSecondProviderIntervalLowerBoundAboveZero"] = (
            mimo["overallActionDistributionDistance"]["ci95"][0] > 0
            and mimo_frozen["overallActionDistributionDistance"]["ci95"][0] > 0
        )
        gates["mimoWorstCaseQualityLowerBoundAboveMargin"] = (
            mimo["worstCaseQualityDifference"]["ci95"][0]
            > float(protocol["decisionQuality"]["guardrailMargin"])
        )
    gates["allProviderFailureRatesBelow005"] = all(
        result["estimates"]["protocolFailureRate"]["estimate"] < 0.05
        for result in results.values()
    )
    payload = {
        "schemaVersion": "online-storefront-natural-action-evaluation.v3",
        "protocolSha256": protocol_hash,
        "providers": results,
        "gates": gates,
        "hypothesisHierarchy": {
            "confirmatory": "DeepSeek overall categorical energy distance is above zero.",
            "secondProviderRobustness": "MiMo overall interval is above zero under both reporting and frozen bootstrap variants.",
            "guardrails": [
                "Worst-case held-minus-immediate offered-candidate surrogate exceeds -0.05 for each provider.",
                "Protocol failure rate remains below 0.05 for each provider.",
            ],
            "descriptive": [
                "Opportunity-conditional distance",
                "same-layout divergence",
                "category, recommender, and checkpoint-seed subgroups",
            ],
            "multiplicity": "No familywise claim is made for guardrail or descriptive outcomes.",
        },
        "inferenceScope": (
            "The frozen analysis used paired task-cluster resampling. A dated P0 audit "
            "amendment makes within-category task resampling the reporting analysis so "
            "the fixed equal category weights remain fixed; the frozen intervals remain "
            "reported separately. Inference is conditional on the frozen task frame, six "
            "recommender checkpoints, provider versions, and two-call-per-arm design."
        ),
        "claimDecision": (
            "eligible-for-bounded-action-distribution-claim"
            if len(results) == 2 and all(gates.values())
            else "do-not-claim-confirmatory-action-effect"
        ),
        "withdrawnAnalyses": [
            "old dominance AUC",
            "next-task displacement as evidence of persistent deletion failure",
            "actor provenance as a causal mechanism",
        ],
        "claimBoundary": protocol["claimBoundary"],
    }
    output = ROOT / protocol["outputs"]["publicRoot"] / "evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
