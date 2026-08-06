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


def evaluate_provider(protocol: dict, protocol_hash: str, provider: str) -> dict:
    root = ROOT / protocol["outputs"]["publicRoot"] / provider
    run_summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
    payload = json.loads((root / "rows.json").read_text(encoding="utf-8"))
    if run_summary["protocolSha256"] != protocol_hash:
        raise RuntimeError(f"{provider} summary was generated under a different protocol")
    rows = payload["rows"]
    expected = (
        int(protocol["sampling"]["tasksPerCategory"])
        * len(protocol["sampling"]["categories"])
        * len(protocol["sampling"]["recommenderFamiliesPerTask"])
    )
    if len(rows) != expected:
        raise RuntimeError(f"{provider} has {len(rows)} rows; expected {expected}")
    if not all(
        row["candidateSetMatched"]
        and row["allFourLayoutsMatched"]
        and row["inspectedSelectable"]
        and row["postResolutionInputMatched"]
        for row in rows
    ):
        raise RuntimeError(f"{provider} contains a failed P0 invariant")

    clusters = defaultdict(list)
    for row in rows:
        clusters[(row["category"], row["taskId"])].append(row)
    keys = sorted(clusters)
    point = metrics(rows)
    rng = np.random.default_rng(int(protocol["uncertainty"]["seed"]))
    replicates = int(protocol["uncertainty"]["replicates"])
    samples = defaultdict(list)
    for _ in range(replicates):
        indices = rng.integers(0, len(keys), size=len(keys))
        sampled_rows = [row for index in indices for row in clusters[keys[index]]]
        values = metrics(sampled_rows)
        for name, value in values.items():
            if value is not None:
                samples[name].append(value)

    estimates = {}
    for name, value in point.items():
        estimates[name] = {
            "estimate": round(value, 6) if value is not None else None,
            "ci95": interval(samples[name]) if value is not None else None,
        }
    return {
        "provider": provider,
        "taskCount": len(keys),
        "taskModelUnitCount": len(rows),
        "estimates": estimates,
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
        gates["deepseekOverallEffectLowerBoundAboveZero"] = (
            deepseek["overallActionDistributionDistance"]["ci95"][0] > 0
        )
        gates["deepseekWorstCaseQualityLowerBoundAboveMargin"] = (
            deepseek["worstCaseQualityDifference"]["ci95"][0]
            > float(protocol["decisionQuality"]["guardrailMargin"])
        )
    if "mimo" in results:
        gates["mimoReplicationPointEstimatePositive"] = (
            results["mimo"]["estimates"]["overallActionDistributionDistance"]["estimate"]
            > 0
        )
    gates["allProviderFailureRatesBelow005"] = all(
        result["estimates"]["protocolFailureRate"]["estimate"] < 0.05
        for result in results.values()
    )
    payload = {
        "schemaVersion": "online-storefront-natural-action-evaluation.v1",
        "protocolSha256": protocol_hash,
        "providers": results,
        "gates": gates,
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
