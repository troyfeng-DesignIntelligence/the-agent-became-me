"""Evaluate the frozen V9 natural-product-language policy pilot."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v9/natural-language-policy-protocol.json"


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


def bootstrap(rows: list[dict], field: str, replicates: int, seed: int) -> dict:
    generator = np.random.default_rng(seed)
    by_category: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        by_category[row["category"]][row["taskId"]].append(row)

    def category_value(task_map: dict[str, list[dict]], sampled: list[str] | None = None) -> float:
        task_ids = list(task_map) if sampled is None else sampled
        values = [float(np.mean([entry[field] for entry in task_map[str(task_id)]])) for task_id in task_ids]
        return float(np.mean(values))

    estimate = float(np.mean([category_value(task_map) for task_map in by_category.values()]))
    draws = []
    for _ in range(replicates):
        category_draws = []
        for task_map in by_category.values():
            task_ids = list(task_map)
            sampled = generator.choice(task_ids, size=len(task_ids), replace=True)
            category_draws.append(category_value(task_map, list(sampled)))
        draws.append(float(np.mean(category_draws)))
    return {
        "estimate": round(estimate, 6),
        "ci95": [
            round(float(np.quantile(draws, 0.025)), 6),
            round(float(np.quantile(draws, 0.975)), 6),
        ],
    }


def augment(row: dict, horizon: int) -> dict:
    result = dict(row)
    for arm in ["immediate", "held"]:
        for metric in ["success", "failure", "regret", "protocolFailure"]:
            result[f"{arm}_{metric}"] = float(row["armMetrics"][arm][metric])
    for metric in ["success", "failure", "regret", "protocolFailure"]:
        result[f"heldMinusImmediate_{metric}"] = float(row["heldMinusImmediate"][metric])
    for index in range(horizon):
        result[f"observed_step_{index + 1}"] = float(row["multistep"]["observedSlateDisplacement"][index])
        result[f"random_step_{index + 1}"] = float(row["multistep"]["matchedRandomSlateDisplacement"][index])
        result[f"observedMinusRandom_step_{index + 1}"] = float(row["multistep"]["observedMinusRandom"][index])
    return result


def summarize_provider(rows: list[dict], protocol: dict, offset: int) -> dict:
    replicates = int(protocol["uncertainty"]["replicates"])
    seed = int(protocol["uncertainty"]["seed"]) + offset
    horizon = int(protocol["multistep"]["horizon"])
    augmented = [augment(row, horizon) for row in rows]
    fields = {
        "selectionDivergence": "actionDistributionDistance",
        "matchedSelectionChangeRate": "matchedActionChangeRate",
        "immediateTaskSuccess": "immediate_success",
        "heldTaskSuccess": "held_success",
        "heldMinusImmediateTaskSuccess": "heldMinusImmediate_success",
        "immediateRegret": "immediate_regret",
        "heldRegret": "held_regret",
        "heldMinusImmediateRegret": "heldMinusImmediate_regret",
        "immediateTaskFailure": "immediate_failure",
        "heldTaskFailure": "held_failure",
        "heldMinusImmediateTaskFailure": "heldMinusImmediate_failure",
        "protocolFailureRate": "immediate_protocolFailure",
    }
    estimates = {
        name: bootstrap(augmented, field, replicates, seed + index)
        for index, (name, field) in enumerate(fields.items())
    }
    estimates["heldProtocolFailureRate"] = bootstrap(
        augmented, "held_protocolFailure", replicates, seed + 20
    )
    estimates["multistep"] = {
        f"step{index}": {
            "observed": bootstrap(augmented, f"observed_step_{index}", replicates, seed + 30 + index),
            "matchedRandom": bootstrap(augmented, f"random_step_{index}", replicates, seed + 40 + index),
            "observedMinusRandom": bootstrap(
                augmented, f"observedMinusRandom_step_{index}", replicates, seed + 50 + index
            ),
        }
        for index in range(1, horizon + 1)
    }
    estimates["byRecommenderFamily"] = {
        family: {
            "unitCount": len(family_rows := [row for row in augmented if row["modelFamily"] == family]),
            "selectionDivergence": bootstrap(
                family_rows,
                "actionDistributionDistance",
                replicates,
                seed + (71 if family == "sasrec" else 79),
            ),
        }
        for family in protocol["sampling"]["recommenderFamiliesPerTask"]
    }
    failure_rate = max(
        estimates["protocolFailureRate"]["estimate"],
        estimates["heldProtocolFailureRate"]["estimate"],
    )
    gates = {
        "protocolFailureRateBelow005": failure_rate < 0.05,
        "selectionDivergenceLowerBoundAboveZero": estimates["selectionDivergence"]["ci95"][0] > 0,
        "bothRecommenderPointEstimatesAboveZero": all(
            estimates["byRecommenderFamily"][family]["selectionDivergence"]["estimate"] > 0
            for family in protocol["sampling"]["recommenderFamiliesPerTask"]
        ),
        "writebackPatternMatchedForRandomBaseline": all(
            row["multistep"]["matchedWritebackPattern"] for row in rows
        ),
    }
    return {"unitCount": len(rows), "estimates": estimates, "gates": gates}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(PROTOCOL_PATH.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol_text = protocol_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    protocol_hash = sha256(protocol_text.encode("utf-8"))
    output = ROOT / protocol["outputs"]["publicRoot"]
    preflight = json.loads((output / "preflight.json").read_text(encoding="utf-8"))
    if preflight["protocolSha256"] != protocol_hash or not preflight["passed"]:
        raise RuntimeError("A passing preflight for the exact protocol is required")

    providers = []
    all_rows = {}
    for provider in ["deepseek", "mimo"]:
        summary_path = output / provider / "summary.json"
        rows_path = output / provider / "rows.json"
        if not summary_path.exists() or not rows_path.exists():
            continue
        run_summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if run_summary["protocolSha256"] != protocol_hash:
            raise RuntimeError(f"{provider} run summary does not match the frozen protocol")
        rows = json.loads(rows_path.read_text(encoding="utf-8"))["rows"]
        if len(rows) != int(protocol["sampling"]["taskModelUnitCount"]):
            raise RuntimeError(f"{provider} row count differs from the frozen frame")
        providers.append(provider)
        all_rows[provider] = rows
    if not providers:
        raise RuntimeError("No completed provider rows are available")

    results = {
        provider: summarize_provider(all_rows[provider], protocol, 1000 * index)
        for index, provider in enumerate(providers)
    }
    evidence = {
        provider: (
            "natural-language-order-signal-observed"
            if result["gates"]["selectionDivergenceLowerBoundAboveZero"]
            and result["gates"]["protocolFailureRateBelow005"]
            else "natural-language-order-signal-not-established"
        )
        for provider, result in results.items()
    }
    summary = {
        "schemaVersion": "online-storefront-natural-language-policy-evaluation.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "analysisStage": protocol["analysisStage"],
        "providers": providers,
        "evidenceStatus": evidence,
        "results": results,
        "qualityInterpretation": "Success, failure, and regret are protocol-defined pilot outcomes. Their intervals are descriptive and do not establish equivalence or policy safety.",
        "multistepInterpretation": "Steps two and three use a fixed top-item continuation policy. They measure recommendation propagation after the initial model selection, not repeated autonomous model behavior.",
        "claimBoundary": protocol["claimBoundary"],
    }
    write_json(output / "evaluation.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
