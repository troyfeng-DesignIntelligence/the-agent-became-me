"""Independent row-level validation for the V9 public analysis bundle."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL = ROOT / "experiments/online-storefront-v9/natural-language-policy-protocol.json"
PUBLIC = ROOT / "public/results/online-storefront-natural-language-policy/v1"
CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]


def mean(values) -> float:
    rows = list(values)
    return sum(rows) / len(rows) if rows else 0.0


def task_balanced(rows: list[dict], value) -> float:
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[row["category"]][row["taskId"]].append(row)
    return mean(
        mean(mean(value(row) for row in task_rows) for task_rows in task_map.values())
        for task_map in grouped.values()
    )


def energy(actions: dict[str, str]) -> float:
    immediate = [actions["immediate-a"], actions["immediate-b"]]
    held = [actions["held-a"], actions["held-b"]]
    cross = mean(float(left != right) for left in immediate for right in held)
    return 2 * cross - float(immediate[0] != immediate[1]) - float(held[0] != held[1])


def close(left: float, right: float, tolerance: float = 1e-6) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def main() -> None:
    protocol_text = PROTOCOL.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    protocol_hash = hashlib.sha256(protocol_text.encode("utf-8")).hexdigest()
    evaluation = json.loads((PUBLIC / "evaluation.json").read_text(encoding="utf-8"))
    failures = []
    checks = defaultdict(int)
    provider_rows = {}

    if evaluation["protocolSha256"] != protocol_hash:
        failures.append("evaluation-protocol-hash")
    for provider in ["deepseek", "mimo"]:
        summary = json.loads((PUBLIC / provider / "summary.json").read_text(encoding="utf-8"))
        rows = json.loads((PUBLIC / provider / "rows.json").read_text(encoding="utf-8"))["rows"]
        provider_rows[provider] = rows
        if summary["protocolSha256"] != protocol_hash:
            failures.append(f"{provider}-summary-protocol-hash")
        if len(rows) != int(protocol["sampling"]["taskModelUnitCount"]):
            failures.append(f"{provider}-row-count")
        keys = {(row["category"], row["taskId"], row["modelFamily"]) for row in rows}
        if len(keys) != len(rows):
            failures.append(f"{provider}-duplicate-unit")
        category_tasks = defaultdict(set)
        for row in rows:
            category_tasks[row["category"]].add(row["taskId"])
            actions = row["actions"]
            if not close(row["actionDistributionDistance"], energy(actions)):
                failures.append(f"{provider}-energy:{row['taskId']}:{row['modelFamily']}")
            matched = mean(
                actions[f"immediate-{rep}"] != actions[f"held-{rep}"] for rep in ["a", "b"]
            )
            if not close(row["matchedActionChangeRate"], matched):
                failures.append(f"{provider}-matched-rate:{row['taskId']}:{row['modelFamily']}")
            for condition in CONDITIONS:
                outcome = row["outcomes"][condition]
                if not close(outcome["success"] + outcome["failure"], 1.0):
                    failures.append(f"{provider}-outcome-complement:{row['taskId']}:{condition}")
                if not 0 <= outcome["regret"] <= 1:
                    failures.append(f"{provider}-regret-range:{row['taskId']}:{condition}")
            for metric in ["success", "failure", "regret", "protocolFailure"]:
                expected = row["armMetrics"]["held"][metric] - row["armMetrics"]["immediate"][metric]
                if not close(row["heldMinusImmediate"][metric], expected):
                    failures.append(f"{provider}-arm-difference:{row['taskId']}:{metric}")
            audit = row["auditPrimitives"]
            if audit["stateHashes"]["immediate-a"] != audit["stateHashes"]["immediate-b"]:
                failures.append(f"{provider}-immediate-repeat:{row['taskId']}:{row['modelFamily']}")
            if audit["stateHashes"]["held-a"] != audit["stateHashes"]["held-b"]:
                failures.append(f"{provider}-held-repeat:{row['taskId']}:{row['modelFamily']}")
            layouts = audit["candidateLayouts"]
            if len({frozenset(layout) for layout in layouts.values()}) != 1:
                failures.append(f"{provider}-candidate-set:{row['taskId']}:{row['modelFamily']}")
            if not audit["postResolutionInputMatched"]:
                failures.append(f"{provider}-post-resolution:{row['taskId']}:{row['modelFamily']}")
            if not row["multistep"]["matchedWritebackPattern"]:
                failures.append(f"{provider}-random-pattern:{row['taskId']}:{row['modelFamily']}")
            if "title" in json.dumps(row).lower() or '"brand"' in json.dumps(row).lower():
                failures.append(f"{provider}-raw-catalog-text-public:{row['taskId']}:{row['modelFamily']}")
            checks["rowsAudited"] += 1
        if set(category_tasks) != set(protocol["sampling"]["categories"]):
            failures.append(f"{provider}-category-coverage")
        for category, task_ids in category_tasks.items():
            if len(task_ids) != int(protocol["sampling"]["tasksPerCategory"]):
                failures.append(f"{provider}-task-count:{category}")

        reported = evaluation["results"][provider]["estimates"]
        recomputed = {
            "selectionDivergence": task_balanced(rows, lambda row: row["actionDistributionDistance"]),
            "matchedSelectionChangeRate": task_balanced(rows, lambda row: row["matchedActionChangeRate"]),
            "heldMinusImmediateTaskSuccess": task_balanced(rows, lambda row: row["heldMinusImmediate"]["success"]),
            "heldMinusImmediateRegret": task_balanced(rows, lambda row: row["heldMinusImmediate"]["regret"]),
            "heldMinusImmediateTaskFailure": task_balanced(rows, lambda row: row["heldMinusImmediate"]["failure"]),
        }
        for name, value in recomputed.items():
            if not close(reported[name]["estimate"], value):
                failures.append(f"{provider}-aggregate:{name}")
            checks["headlineAggregatesRecomputed"] += 1
        for index in range(int(protocol["multistep"]["horizon"])):
            for label, key in [
                ("observed", "observedSlateDisplacement"),
                ("matchedRandom", "matchedRandomSlateDisplacement"),
                ("observedMinusRandom", "observedMinusRandom"),
            ]:
                value = task_balanced(rows, lambda row, i=index, k=key: row["multistep"][k][i])
                reported_value = reported["multistep"][f"step{index + 1}"][label]["estimate"]
                if not close(reported_value, value):
                    failures.append(f"{provider}-multistep:{index + 1}:{label}")
                checks["multistepAggregatesRecomputed"] += 1

    if {
        (row["category"], row["taskId"], row["modelFamily"])
        for row in provider_rows["deepseek"]
    } != {
        (row["category"], row["taskId"], row["modelFamily"])
        for row in provider_rows["mimo"]
    }:
        failures.append("provider-unit-frame-mismatch")

    result = {
        "schemaVersion": "online-storefront-natural-language-policy-validation.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "assessment": "ready-to-share-with-pilot-caveats" if not failures else "needs-revision",
        "checks": dict(checks),
        "failureCount": len(failures),
        "failures": failures,
        "requiredCaveats": [
            "This is a 64-task mechanism-extension pilot, not a powered policy-equivalence study.",
            "Task success and regret use protocol-defined title-token and price constraints, not human utility.",
            "Steps two and three use a fixed continuation policy, not repeated LLM calls.",
            "The random-writeback comparison tests recommender sensitivity to event identity; it is not a random-agent behavioral baseline.",
        ],
    }
    (PUBLIC / "validation.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(result, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
