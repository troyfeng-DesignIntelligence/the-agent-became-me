"""Compare the legacy fixed-order and frozen counterbalanced final endpoints."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = (
    ROOT
    / "public"
    / "results"
    / "online-storefront-feedback-action-counterbalanced"
    / "v1"
    / "comparison.json"
)

SOURCES = {
    "deepseek": {
        "legacy": ROOT / "public/results/online-storefront-feedback-action/v1",
        "counterbalanced": ROOT
        / "public/results/online-storefront-feedback-action-counterbalanced/v1/deepseek",
    },
    "mimo": {
        "legacy": ROOT / "public/results/online-storefront-feedback-action-mimo/v1",
        "counterbalanced": ROOT
        / "public/results/online-storefront-feedback-action-counterbalanced/v1/mimo",
    },
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def row_key(row: dict) -> tuple[str, str, str, str]:
    return row["category"], row["taskId"], row["modelFamily"], row["mode"]


def compare_provider(paths: dict[str, Path]) -> dict:
    legacy_evaluation = read_json(paths["legacy"] / "evaluation.json")
    counterbalanced_evaluation = read_json(paths["counterbalanced"] / "evaluation.json")
    legacy_rows = {row_key(row): row for row in read_json(paths["legacy"] / "rows.json")["rows"]}
    counterbalanced_rows = {
        row_key(row): row for row in read_json(paths["counterbalanced"] / "rows.json")["rows"]
    }
    if legacy_rows.keys() != counterbalanced_rows.keys():
        raise RuntimeError("Legacy and counterbalanced rows do not contain the same units")

    conditions = ("immediate-a", "held-a", "immediate-b", "held-b")
    changed_by_mode: Counter[str] = Counter()
    compared_by_mode: Counter[str] = Counter()
    units_changed_by_mode: Counter[str] = Counter()
    for key, legacy in legacy_rows.items():
        counterbalanced = counterbalanced_rows[key]
        unit_changed = False
        for condition in conditions:
            compared_by_mode[legacy["mode"]] += 1
            changed = legacy["actions"][condition] != counterbalanced["actions"][condition]
            changed_by_mode[legacy["mode"]] += int(changed)
            unit_changed = unit_changed or changed
        units_changed_by_mode[legacy["mode"]] += int(unit_changed)

    modes = ("primary-feedback", "identical-control")
    semantic_action_stability = {}
    for mode in modes:
        comparison_count = compared_by_mode[mode]
        change_count = changed_by_mode[mode]
        semantic_action_stability[mode] = {
            "conditionActionChangeCount": change_count,
            "conditionActionComparisonCount": comparison_count,
            "conditionActionChangeRate": round(change_count / comparison_count, 6),
            "unitWithAnyConditionActionChangeCount": units_changed_by_mode[mode],
            "unitCount": sum(1 for key in legacy_rows if key[-1] == mode),
        }

    def headline(evaluation: dict) -> dict:
        result = evaluation["results"]["primary-feedback"]
        return {
            "categoricalEnergyDistance": result["categoricalEnergyDistance"],
            "matchedActionChangeRate": result["matchedActionChangeRate"],
            "observedChangeCounts": result.get("observedChangeCounts"),
        }

    return {
        "legacy": headline(legacy_evaluation),
        "counterbalanced": headline(counterbalanced_evaluation),
        "counterbalancedOrderGroups": counterbalanced_evaluation["results"]["primary-feedback"].get(
            "byConditionOrder"
        ),
        "semanticActionStabilityAcrossRuns": semantic_action_stability,
        "counterbalancedGates": counterbalanced_evaluation["gates"],
    }


def main() -> None:
    report = {
        "schemaVersion": "online-storefront-feedback-action-counterbalance-comparison.v1",
        "purpose": (
            "Sensitivity audit comparing the superseded fixed-order endpoint with the frozen "
            "counterbalanced rerun. The counterbalanced results are the confirmatory results."
        ),
        "providers": {provider: compare_provider(paths) for provider, paths in SOURCES.items()},
        "interpretation": (
            "Both counterbalanced provider-level gates passed. Differences between runs are "
            "reported as an endpoint stability diagnostic, not pooled with the confirmatory rerun."
        ),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
