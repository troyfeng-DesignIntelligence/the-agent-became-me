"""Independent row-level validation for a feedback-action result bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROTOCOL = ROOT / "experiments/online-storefront-v9/mimo-downstream-action-protocol.json"


def mean(values) -> float:
    rows = list(values)
    return sum(rows) / len(rows) if rows else 0.0


def close(left: float, right: float, tolerance: float = 1e-6) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def energy(actions: dict[str, str]) -> float:
    immediate = [actions["immediate-a"], actions["immediate-b"]]
    held = [actions["held-a"], actions["held-b"]]
    cross = mean(float(left != right) for left in immediate for right in held)
    return 2 * cross - float(immediate[0] != immediate[1]) - float(held[0] != held[1])


def task_balanced(rows: list[dict], value) -> float:
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[row["category"]][row["taskId"]].append(row)
    return mean(
        mean(mean(value(row) for row in task_rows) for task_rows in task_map.values())
        for task_map in grouped.values()
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(DEFAULT_PROTOCOL.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol_text = protocol_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    protocol_hash = hashlib.sha256(protocol_text.encode("utf-8")).hexdigest()
    output = ROOT / protocol["outputs"]["publicRoot"]
    preflight = json.loads((output / "preflight.json").read_text(encoding="utf-8"))
    run_summary = json.loads((output / "run-summary.json").read_text(encoding="utf-8"))
    evaluation = json.loads((output / "evaluation.json").read_text(encoding="utf-8"))
    rows = json.loads((output / "rows.json").read_text(encoding="utf-8"))["rows"]
    failures = []
    checks = defaultdict(int)

    for name, artifact in [
        ("preflight", preflight),
        ("run-summary", run_summary),
        ("evaluation", evaluation),
    ]:
        if artifact["protocolSha256"] != protocol_hash:
            failures.append(f"{name}-protocol-hash")
    if not preflight["passed"]:
        failures.append("preflight-not-passed")
    expected_primary = int(protocol["sampling"]["taskModelUnitCount"])
    expected_control = int(preflight["counts"]["controlUnits"])
    if len(rows) != expected_primary + expected_control:
        failures.append("row-count")
    if int(run_summary["rowCount"]) != len(rows):
        failures.append("run-summary-row-count")
    if int(run_summary["api"]["validActionCount"]) != int(preflight["counts"]["maximumCalls"]):
        failures.append("valid-action-count")
    if int(run_summary["api"]["terminalFailureCount"]) != 0:
        failures.append("terminal-failures")
    order_design = protocol["decisionInstrument"].get("conditionOrderDesign")
    if order_design:
        allowed_orders = [tuple(order) for order in order_design["orders"]]
        order_counts: dict[tuple[str, str, str], Counter[int]] = defaultdict(Counter)
        for row in rows:
            order_index = int(row.get("conditionOrderIndex", -1))
            if order_index not in range(len(allowed_orders)):
                failures.append("condition-order-index")
                continue
            if tuple(row.get("callOrder", [])) != allowed_orders[order_index]:
                failures.append("condition-call-order")
            stratum = (row["category"], row["modelFamily"], row["mode"])
            order_counts[stratum][order_index] += 1
        for stratum, counts in order_counts.items():
            values = [counts[index] for index in range(len(allowed_orders))]
            if max(values) - min(values) > 1:
                failures.append(f"condition-order-imbalance:{'/'.join(stratum)}")
        checks["orderStrataAudited"] = len(order_counts)
    recomputed_cost = (
        float(run_summary["api"]["inputTokens"]) / 1_000_000
        * float(protocol["provider"]["inputPricePerMillion"])
        + float(run_summary["api"]["outputTokens"]) / 1_000_000
        * float(protocol["provider"]["outputPricePerMillion"])
    )
    if not close(recomputed_cost, run_summary["api"]["observedCostAtPublishedRates"]):
        failures.append("cost-reconciliation")

    by_mode = defaultdict(list)
    seen = set()
    for row in rows:
        key = (row["category"], row["taskId"], row["modelFamily"], row["mode"])
        if key in seen:
            failures.append(f"duplicate-row:{key}")
        seen.add(key)
        by_mode[row["mode"]].append(row)
        if not close(row["actionDistributionDistance"], energy(row["actions"])):
            failures.append(f"energy:{key}")
        matched = sum(
            row["actions"][f"immediate-{rep}"] != row["actions"][f"held-{rep}"]
            for rep in ["a", "b"]
        )
        if int(row["matchedCrossArmActionChangeCount"]) != matched:
            failures.append(f"matched-change-count:{key}")
        values = [value for value in row["decisionQualities"].values() if value is not None]
        if not values:
            failures.append(f"missing-decision-quality:{key}")
        if row["mode"] == "identical-control":
            state_hashes = set(row["auditPrimitives"]["stateHashes"].values())
            layouts = {tuple(layout) for layout in row["auditPrimitives"]["candidateLayouts"].values()}
            if len(state_hashes) != 1 or len(layouts) != 1:
                failures.append(f"nonidentical-control:{key}")
        serialized = json.dumps(row).lower()
        if '"title"' in serialized or '"brand"' in serialized or "reviewerid" in serialized or "asin" in serialized:
            failures.append(f"private-field-public:{key}")
        checks["rowsAudited"] += 1

    if len(by_mode["primary-feedback"]) != expected_primary:
        failures.append("primary-row-count")
    if len(by_mode["identical-control"]) != expected_control:
        failures.append("control-row-count")

    for mode in ["primary-feedback", "identical-control"]:
        mode_rows = by_mode[mode]
        reported = evaluation["results"][mode]
        observed = reported.get("observedChangeCounts", {})
        recomputed_observed = {
            "matchedRepeatPairChangeCount": sum(
                int(row["matchedCrossArmActionChangeCount"]) for row in mode_rows
            ),
            "matchedRepeatPairComparisonCount": 2 * len(mode_rows),
            "unitWithAnyMatchedChangeCount": sum(
                int(row["matchedCrossArmActionChangeCount"] > 0) for row in mode_rows
            ),
            "unitCount": len(mode_rows),
        }
        if observed != recomputed_observed:
            failures.append(f"observed-change-counts:{mode}")
        checks["observedChangeCountFieldsRecomputed"] += len(recomputed_observed)
        fields = {
            "categoricalEnergyDistance": lambda row: row["actionDistributionDistance"],
            "matchedActionChangeRate": lambda row: row["matchedCrossArmActionChangeCount"] / 2,
            "meanDecisionQuality": lambda row: mean(
                value for value in row["decisionQualities"].values() if value is not None
            ),
            "abandonRate": lambda row: mean(
                value == "__ABANDON__" for value in row["actions"].values()
            ),
            "protocolFailureRate": lambda row: mean(
                value == "__FAILURE__" for value in row["actions"].values()
            ),
        }
        for name, value in fields.items():
            estimate = task_balanced(mode_rows, value)
            if not close(estimate, reported[name]["estimate"]):
                failures.append(f"aggregate:{mode}:{name}")
            checks["headlineAggregatesRecomputed"] += 1

    primary = by_mode["primary-feedback"]
    for family in protocol["sampling"]["recommenderFamiliesPerTask"]:
        family_rows = [row for row in primary if row["modelFamily"] == family]
        estimate = task_balanced(family_rows, lambda row: row["actionDistributionDistance"])
        reported = evaluation["results"]["primary-feedback"]["byRecommenderFamily"][family]
        if len(family_rows) != int(reported["unitCount"]):
            failures.append(f"family-row-count:{family}")
        if not close(estimate, reported["categoricalEnergyDistance"]["estimate"]):
            failures.append(f"family-estimate:{family}")
        checks["familyAggregatesRecomputed"] += 1

    gate_expected = (
        evaluation["results"]["primary-feedback"]["categoricalEnergyDistance"]["ci95"][0] > 0
        and evaluation["results"]["identical-control"]["categoricalEnergyDistance"]["ci95"][1] < 0.05
        and all(
            evaluation["results"]["primary-feedback"]["byRecommenderFamily"][family]["categoricalEnergyDistance"]["estimate"] > 0
            for family in protocol["sampling"]["recommenderFamiliesPerTask"]
        )
    )
    if gate_expected != bool(evaluation["gates"]["oneStepAgentRecommenderAgentFeedbackGatePassed"]):
        failures.append("gate-recomputation")

    provider = rows[0]["provider"] if rows else "provider"
    family_intervals_crossing_zero = [
        family
        for family, family_result in evaluation["results"]["primary-feedback"]["byRecommenderFamily"].items()
        if family_result["categoricalEnergyDistance"]["ci95"][0] <= 0
    ]
    required_caveats = []
    if family_intervals_crossing_zero:
        family_labels = {"sasrec": "SASRec", "gru4rec": "GRU4Rec"}
        families = ", ".join(family_labels.get(family, family) for family in family_intervals_crossing_zero)
        required_caveats.append(
            f"The pooled {provider.capitalize()} endpoint interval excludes zero, but the {families} interval does not."
        )
    required_caveats.extend(
        [
            "The prespecified recurrence gate required positive recommender-family point estimates, not positive family-specific interval bounds.",
            "The endpoint uses pseudonymous derived candidate features and a held-out-item proxy, not natural product language or human utility.",
            "This is a one-step model-recommender-model path and does not establish long-run amplification or production effects.",
        ]
    )
    result = {
        "schemaVersion": "online-storefront-feedback-action-validation.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "assessment": "ready-to-share-with-scope-caveats" if not failures else "needs-revision",
        "checks": dict(checks),
        "recomputedCost": round(recomputed_cost, 6),
        "failureCount": len(failures),
        "failures": failures,
        "requiredCaveats": required_caveats,
    }
    (output / "validation.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(result, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
