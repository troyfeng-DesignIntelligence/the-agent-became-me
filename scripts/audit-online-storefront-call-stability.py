"""Publish aggregate temporal diagnostics without exposing provider payloads."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "artifacts/online-storefront-natural-action-v2"
PUBLIC_ROOT = ROOT / "public/results/online-storefront-natural-action-v2/v1"


def quantiles(values: list[float]) -> dict[str, float]:
    array = np.asarray(values, dtype=float)
    return {
        "min": round(float(np.min(array)), 6),
        "p25": round(float(np.quantile(array, 0.25)), 6),
        "median": round(float(np.median(array)), 6),
        "p75": round(float(np.quantile(array, 0.75)), 6),
        "max": round(float(np.max(array)), 6),
    }


def load_call_times(provider: str) -> tuple[dict[tuple[str, str, str, str], datetime], dict]:
    calls = {}
    models = set()
    fingerprints = set()
    response_root = ARTIFACT_ROOT / provider / "responses"
    attempt_root = ARTIFACT_ROOT / provider / "attempts"
    for path in sorted(response_root.glob("*.json")):
        response = json.loads(path.read_text(encoding="utf-8"))
        scope = response["cacheScope"].split("/")
        if len(scope) < 5 or scope[0] != "natural-action":
            continue
        _, category, task_id, family, condition = scope[:5]
        # Older cache scopes can include an additional terminal component.
        if condition not in {"immediate-a", "held-a", "immediate-b", "held-b"}:
            condition = scope[-1]
        request_hash = response["requestSha256"]
        attempt = json.loads(
            (attempt_root / f"{request_hash}-0.json").read_text(encoding="utf-8")
        )
        calls[(category, task_id, family, condition)] = datetime.fromisoformat(
            attempt["recordedAt"]
        )
        models.add(str(response["response"].get("model", response["request"].get("model"))))
        fingerprint = response["response"].get("system_fingerprint") or attempt.get("fingerprint")
        if fingerprint:
            fingerprints.add(str(fingerprint))
    return calls, {
        "providerModelIds": sorted(models),
        "systemFingerprints": sorted(fingerprints),
    }


def provider_audit(provider: str) -> dict:
    calls, model_metadata = load_call_times(provider)
    payload = json.loads(
        (PUBLIC_ROOT / provider / "rows.json").read_text(encoding="utf-8")
    )
    rows = payload["rows"]
    unit_times = []
    unit_times_by_category = defaultdict(list)
    same_arm_lags = []
    matched_cross_arm_lags = []
    order_groups = defaultdict(list)
    for row in rows:
        key = (row["category"], row["taskId"], row["modelFamily"])
        times = {
            condition: calls[(*key, condition)]
            for condition in ["immediate-a", "held-a", "immediate-b", "held-b"]
        }
        epoch = [value.timestamp() for value in times.values()]
        timed_effect = (float(np.mean(epoch)), row["actionDistributionDistance"])
        unit_times.append((row["category"], *timed_effect))
        unit_times_by_category[row["category"]].append(timed_effect)
        same_arm_lags.extend(
            [
                abs((times["immediate-a"] - times["immediate-b"]).total_seconds()),
                abs((times["held-a"] - times["held-b"]).total_seconds()),
            ]
        )
        matched_cross_arm_lags.extend(
            [
                abs((times["immediate-a"] - times["held-a"]).total_seconds()),
                abs((times["immediate-b"] - times["held-b"]).total_seconds()),
            ]
        )
        order_groups[" / ".join(row["callOrder"])].append(
            row["actionDistributionDistance"]
        )
    unit_times.sort(key=lambda row: row[1])
    quartiles = []
    for index, chunk in enumerate(np.array_split(np.asarray(unit_times, dtype=object), 4), start=1):
        categories, counts = np.unique(chunk[:, 0], return_counts=True)
        quartiles.append(
            {
                "chronologicalQuartile": index,
                "unitCount": len(chunk),
                "meanActionDistributionDistance": round(
                    float(np.mean(chunk[:, 2].astype(float))), 6
                ),
                "categoryComposition": {
                    str(category): int(count)
                    for category, count in zip(categories, counts, strict=True)
                },
            }
        )
    within_category_quartiles = defaultdict(list)
    for category in sorted(unit_times_by_category):
        ordered = np.asarray(sorted(unit_times_by_category[category]), dtype=float)
        for index, chunk in enumerate(np.array_split(ordered, 4), start=1):
            within_category_quartiles[index].extend(chunk[:, 1].tolist())
    timestamps = [value.timestamp() for value in calls.values()]
    return {
        "provider": provider,
        "callCount": len(calls),
        "runStart": datetime.fromtimestamp(min(timestamps), tz=next(iter(calls.values())).tzinfo).isoformat(),
        "runEnd": datetime.fromtimestamp(max(timestamps), tz=next(iter(calls.values())).tzinfo).isoformat(),
        "runDurationHours": round((max(timestamps) - min(timestamps)) / 3600, 6),
        **model_metadata,
        "lagSeconds": {
            "sameArmRepeat": quantiles(same_arm_lags),
            "matchedCrossArm": quantiles(matched_cross_arm_lags),
        },
        "effectByChronologicalQuartile": quartiles,
        "effectByWithinCategoryChronologicalQuartile": [
            {
                "withinCategoryQuartile": index,
                "unitCount": len(within_category_quartiles[index]),
                "meanActionDistributionDistance": round(
                    float(np.mean(within_category_quartiles[index])), 6
                ),
            }
            for index in sorted(within_category_quartiles)
        ],
        "effectByLatinSquareOrder": {
            order: {
                "unitCount": len(values),
                "meanActionDistributionDistance": round(float(np.mean(values)), 6),
            }
            for order, values in sorted(order_groups.items())
        },
        "interpretation": (
            "The raw chronological quartiles are confounded with the sequential category "
            "run order; within-category quartiles are the relevant drift diagnostic. "
            "Neither diagnostic proves independence, exchangeability, or stationarity."
        ),
    }


def main() -> None:
    output = {
        "schemaVersion": "online-storefront-call-stability-audit.v1",
        "providers": {
            provider: provider_audit(provider) for provider in ["deepseek", "mimo"]
        },
        "privacy": (
            "Only aggregate timestamps, model identifiers, fingerprints, lags, and "
            "derived effects are published. Prompts and raw responses remain local."
        ),
    }
    path = PUBLIC_ROOT / "call-stability-audit.json"
    path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
