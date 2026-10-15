"""Evaluate a frozen downstream-agent feedback experiment."""

from __future__ import annotations

import hashlib
import json
import argparse
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v8/downstream-action-protocol.json"


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2 if pretty else None, separators=None if pretty else (",", ":")) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def bootstrap(rows: list[dict], field: str, replicates: int, seed: int) -> dict:
    generator = np.random.default_rng(seed)
    by_category = defaultdict(lambda: defaultdict(list))
    for row in rows:
        by_category[row["category"]][row["taskId"]].append(row)

    def task_balanced(category_map, sampled=None):
        ids = list(category_map) if sampled is None else sampled
        return float(np.mean([value for task_id in ids for value in [np.mean([row[field] for row in category_map[str(task_id)]])]]))

    estimate = float(np.mean([task_balanced(category_map) for category_map in by_category.values()]))
    draws = []
    for _ in range(replicates):
        category_values = []
        for category_map in by_category.values():
            ids = list(category_map)
            sampled = generator.choice(ids, size=len(ids), replace=True)
            category_values.append(task_balanced(category_map, sampled))
        draws.append(float(np.mean(category_values)))
    return {"estimate": round(estimate, 6), "ci95": [round(float(np.quantile(draws, 0.025)), 6), round(float(np.quantile(draws, 0.975)), 6)]}


def observed_change_counts(rows: list[dict]) -> dict:
    raw_changes = sum(int(row["matchedCrossArmActionChangeCount"]) for row in rows)
    return {
        "matchedRepeatPairChangeCount": raw_changes,
        "matchedRepeatPairComparisonCount": 2 * len(rows),
        "unitWithAnyMatchedChangeCount": sum(
            int(row["matchedCrossArmActionChangeCount"]) > 0 for row in rows
        ),
        "unitCount": len(rows),
    }


def identical_control_position_diagnostic(rows: list[dict]) -> dict:
    if not rows or not all("callOrder" in row for row in rows):
        return {"available": False}
    pair_counts = {}
    for left in range(4):
        for right in range(left + 1, 4):
            changes = 0
            for row in rows:
                left_action = row["actions"][row["callOrder"][left]]
                right_action = row["actions"][row["callOrder"][right]]
                changes += int(left_action != right_action)
            pair_counts[f"position-{left + 1}-vs-{right + 1}"] = {
                "changeCount": changes,
                "comparisonCount": len(rows),
                "changeRate": round(changes / len(rows), 6),
            }
    return {"available": True, "pairwisePositionChanges": pair_counts}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(PROTOCOL_PATH.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    text = protocol_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(text)
    protocol_hash = sha256(text.encode("utf-8"))
    output = ROOT / protocol["outputs"]["publicRoot"]
    run_summary = json.loads((output / "run-summary.json").read_text(encoding="utf-8"))
    if run_summary["protocolSha256"] != protocol_hash:
        raise RuntimeError("Run summary does not match the frozen protocol")
    rows = json.loads((output / "rows.json").read_text(encoding="utf-8"))["rows"]
    for row in rows:
        row["matchedActionChangeRate"] = row["matchedCrossArmActionChangeCount"] / 2
        values = [value for value in row["decisionQualities"].values() if value is not None]
        row["meanDecisionQuality"] = float(np.mean(values)) if values else 0.0
        row["failureRate"] = sum(value == "__FAILURE__" for value in row["actions"].values()) / 4
        row["abandonRate"] = sum(value == "__ABANDON__" for value in row["actions"].values()) / 4

    replicates = int(protocol["uncertainty"]["replicates"])
    seed = int(protocol["uncertainty"]["seed"])
    results = {}
    for mode in ["primary-feedback", "identical-control"]:
        subset = [row for row in rows if row["mode"] == mode]
        results[mode] = {
            "unitCount": len(subset),
            "observedChangeCounts": observed_change_counts(subset),
            "categoricalEnergyDistance": bootstrap(subset, "actionDistributionDistance", replicates, seed),
            "matchedActionChangeRate": bootstrap(subset, "matchedActionChangeRate", replicates, seed + 1),
            "meanDecisionQuality": bootstrap(subset, "meanDecisionQuality", replicates, seed + 2),
            "abandonRate": bootstrap(subset, "abandonRate", replicates, seed + 3),
            "protocolFailureRate": bootstrap(subset, "failureRate", replicates, seed + 4),
        }
    primary = [row for row in rows if row["mode"] == "primary-feedback"]
    results["primary-feedback"]["byRecommenderFamily"] = {
        family: {
            "unitCount": len(family_rows := [row for row in primary if row["modelFamily"] == family]),
            "categoricalEnergyDistance": bootstrap(family_rows, "actionDistributionDistance", replicates, seed + (11 if family == "sasrec" else 17)),
        }
        for family in protocol["sampling"]["recommenderFamiliesPerTask"]
    }
    if primary and all("conditionOrderIndex" in row for row in primary):
        results["primary-feedback"]["byConditionOrder"] = {
            str(order_index): {
                "unitCount": len(order_rows := [
                    row for row in primary if int(row["conditionOrderIndex"]) == order_index
                ]),
                "categoricalEnergyDistance": bootstrap(
                    order_rows,
                    "actionDistributionDistance",
                    replicates,
                    seed + 101 + order_index,
                ),
                "observedChangeCounts": observed_change_counts(order_rows),
            }
            for order_index in range(4)
        }
    results["identical-control"]["callPositionDiagnostic"] = identical_control_position_diagnostic(
        [row for row in rows if row["mode"] == "identical-control"]
    )
    p = results["primary-feedback"]
    c = results["identical-control"]
    bridge_summary = json.loads((ROOT / protocol["source"]["feedbackBridgeSummary"]).read_text(encoding="utf-8"))
    preflight = json.loads((output / "preflight.json").read_text(encoding="utf-8"))
    counterbalanced = bool(protocol["decisionInstrument"].get("conditionOrderDesign"))
    gates = {
        "feedbackExposurePrerequisitePassed": bool(bridge_summary["gates"]["feedbackExposureGatePassed"]),
        "downstreamActionLowerBoundAboveZero": p["categoricalEnergyDistance"]["ci95"][0] > 0,
        "identicalControlUpperBoundBelow005": c["categoricalEnergyDistance"]["ci95"][1] < 0.05,
        "primaryFailureRateBelow005": p["protocolFailureRate"]["estimate"] < 0.05,
        "controlFailureRateBelow005": c["protocolFailureRate"]["estimate"] < 0.05,
        "bothRecommenderFamilyPointEstimatesAboveZero": all(
            p["byRecommenderFamily"][family]["categoricalEnergyDistance"]["estimate"] > 0
            for family in protocol["sampling"]["recommenderFamiliesPerTask"]
        ),
    }
    if counterbalanced:
        gates["conditionOrderBalancePassed"] = bool(
            preflight.get("passed")
            and preflight.get("protocolSha256") == protocol_hash
            and preflight.get("conditionOrderCounts")
        )
    gates["oneStepAgentRecommenderAgentFeedbackGatePassed"] = all(gates.values())
    summary = {
        "schemaVersion": "online-storefront-feedback-action-evaluation.v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "evidenceStatus": "one-step-feedback-gate-passed" if gates["oneStepAgentRecommenderAgentFeedbackGatePassed"] else "one-step-feedback-gate-failed",
        "results": results,
        "gates": gates,
        "claimBoundary": protocol["claimBoundary"],
        "interpretation": (
            "The research storefront exhibits a measurable one-step recommendation-order to model-selection to recommender-exposure to later-model-selection feedback path for this provider."
            if gates["oneStepAgentRecommenderAgentFeedbackGatePassed"]
            else "The complete one-step behavioral propagation claim is not supported; retain only the links whose frozen gates passed."
        ),
    }
    write_json(output / "evaluation.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
