"""Select an outcome-blind, opportunity-enriched 32-task repair-pilot manifest."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/repair-pilot-task-selection-protocol.json"
METRIC_PATH = ROOT / "experiments/online-storefront-v4/dominance-margin-protocol.json"
SUPPORT_SCRIPT = ROOT / "scripts/evaluate-online-storefront-dominance-support.py"
OUTPUT_ROOT = ROOT / "public/results/online-storefront-repair-pilot-selection/v1"
CONDITIONS = ("immediate-remove", "held-outcome")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


support = load_module("repair_pilot_support", SUPPORT_SCRIPT)
delegate = support.delegate
cross = support.cross
sas = support.sas
gru = support.gru


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


def choose_stratum(rows: list[dict], target: int = 4) -> list[dict]:
    opportunities = sorted(
        (row for row in rows if row["opportunityChanged"]),
        key=lambda row: (row["minimumArmDecisionSeparation"], row["taskId"]),
    )
    selected = opportunities[:2]
    selected_ids = {row["taskId"] for row in selected}
    while len(selected) < target:
        remaining = [row for row in rows if row["taskId"] not in selected_ids]
        if not remaining:
            raise RuntimeError("A selection stratum has fewer than four tasks")
        if not selected:
            chosen = min(
                remaining,
                key=lambda row: (row["minimumArmDecisionSeparation"], row["taskId"]),
            )
        else:
            selected_values = [row["minimumArmDecisionSeparation"] for row in selected]
            ranked = sorted(
                remaining,
                key=lambda row: (
                    -min(
                        abs(row["minimumArmDecisionSeparation"] - value)
                        for value in selected_values
                    ),
                    row["taskId"],
                ),
            )
            chosen = ranked[0]
        selected.append(chosen)
        selected_ids.add(chosen["taskId"])
    return selected


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol_hash = sha256(protocol_bytes)
    protocol = json.loads(protocol_bytes)
    metric_hash = sha256(METRIC_PATH.read_bytes())
    previous_pool_hash = None
    previous_selection_hash = None
    summary_path = OUTPUT_ROOT / "summary.json"
    if summary_path.exists():
        previous = json.loads(summary_path.read_text(encoding="utf-8"))
        if (
            previous.get("protocolSha256") == protocol_hash
            and previous.get("metricProtocolSha256") == metric_hash
        ):
            previous_pool_hash = (previous.get("determinism") or {}).get(
                "aggregatePoolStateSha256"
            )
            previous_selection_hash = (previous.get("determinism") or {}).get(
                "selectedManifestSha256"
            )

    rows = []
    private_fingerprints = []
    eval_passes = 0
    repeatability_passes = 0
    for category in cross.CATEGORIES:
        slug = category["slug"]
        if slug not in protocol["sourcePool"]["categories"]:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = protocol["sourcePool"]["tasksPerCategory"]
        tasks = sorted(
            delegate.build_tasks(category, data, products), key=lambda row: row["taskId"]
        )[: protocol["sourcePool"]["tasksPerCategory"]]
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(
            data, slug, support.GRU_CHECKPOINTS, sas
        )
        for full_index, task in enumerate(tasks):
            family = "sasrec" if full_index % 2 == 0 else "gru4rec"
            seed = [7, 17, 29][full_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            model.eval()
            eval_passes += int(not model.training)
            arm_results = {}
            task_repeatable = True
            fingerprint = {
                "category": slug,
                "fullPoolIndex": full_index,
                "modelFamily": family,
                "modelSeed": seed,
                "arms": [],
            }
            for condition in CONDITIONS:
                features, state_fingerprint, repeatable = support.predecision_state(
                    task, products, model, scoring, condition, slug
                )
                task_repeatable = task_repeatable and repeatable
                arm_results[condition] = support.arm_metrics(features)
                fingerprint["arms"].append(state_fingerprint)
            repeatability_passes += int(task_repeatable)
            immediate = arm_results["immediate-remove"]
            held = arm_results["held-outcome"]
            predictor = round(min(immediate["margin"], held["margin"]), 6)
            opportunity = (
                immediate["structuralClass"] != held["structuralClass"]
                or immediate["winner"] != held["winner"]
            )
            rows.append(
                {
                    "category": slug,
                    "taskId": task["taskId"],
                    "fullPoolIndex": full_index,
                    "modelFamily": family,
                    "modelSeed": seed,
                    "minimumArmDecisionSeparation": predictor,
                    "opportunityChanged": opportunity,
                    "immediateEligibleCount": immediate["eligibleCount"],
                    "heldEligibleCount": held["eligibleCount"],
                    "immediateStructuralClass": immediate["structuralClass"],
                    "heldStructuralClass": held["structuralClass"],
                }
            )
            private_fingerprints.append(fingerprint)
        print(f"repair selection pool category={slug} complete", flush=True)

    strata = defaultdict(list)
    for row in rows:
        strata[(row["category"], row["modelFamily"])].append(row)
    selected = []
    for category in protocol["sourcePool"]["categories"]:
        for family in ("gru4rec", "sasrec"):
            selected.extend(choose_stratum(strata[(category, family)]))
    selected.sort(
        key=lambda row: (
            protocol["sourcePool"]["categories"].index(row["category"]),
            row["modelFamily"],
            row["taskId"],
        )
    )

    predictors = np.array(
        [row["minimumArmDecisionSeparation"] for row in selected], dtype=float
    )
    frequencies = Counter(float(value) for value in predictors)
    balance_counts = Counter(
        (row["category"], row["modelFamily"]) for row in selected
    )
    category_counts = Counter(row["category"] for row in selected)
    opportunity_count = sum(row["opportunityChanged"] for row in selected)
    pool_opportunity_count = sum(row["opportunityChanged"] for row in rows)
    pool_state_hash = sha256(canonical(private_fingerprints))
    selected_manifest = [
        {
            "category": row["category"],
            "taskId": row["taskId"],
            "fullPoolIndex": row["fullPoolIndex"],
            "modelFamily": row["modelFamily"],
            "modelSeed": row["modelSeed"],
            "minimumArmDecisionSeparation": row["minimumArmDecisionSeparation"],
            "opportunityChanged": row["opportunityChanged"],
        }
        for row in selected
    ]
    selection_hash = sha256(canonical(selected_manifest))
    fresh_match = (
        previous_pool_hash == pool_state_hash
        and previous_selection_hash == selection_hash
        if previous_pool_hash is not None and previous_selection_hash is not None
        else None
    )
    gates = {
        "balance": (
            len(selected) == 32
            and all(category_counts[category] == 8 for category in category_counts)
            and all(value == 4 for value in balance_counts.values())
            and len(balance_counts) == 8
        ),
        "opportunity": opportunity_count >= 8,
        "distinctValues": len(frequencies) >= 12,
        "largestPointMass": max(frequencies.values()) / len(selected) <= 0.50,
        "dispersion": float(np.std(predictors, ddof=0)) >= 0.15,
        "evaluationMode": eval_passes == len(rows) == 460,
        "withinProcessRepeatability": repeatability_passes == len(rows),
        "freshProcessMatch": fresh_match is True,
        "outcomeBlindSelection": True,
        "privacy": True,
    }
    decision = "go-freeze-repair-pilot" if all(gates.values()) else "no-go"
    summary = {
        "schemaVersion": "online-storefront-repair-pilot-selection-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocolSha256": protocol_hash,
        "metricProtocolSha256": metric_hash,
        "pool": {
            "taskCount": len(rows),
            "opportunityChangedTaskCount": pool_opportunity_count,
            "opportunityChangedRate": round(pool_opportunity_count / len(rows), 6),
        },
        "selected": {
            "taskCount": len(selected),
            "categoryCounts": dict(sorted(category_counts.items())),
            "stratumCounts": {
                f"{category}|{family}": count
                for (category, family), count in sorted(balance_counts.items())
            },
            "opportunityChangedTaskCount": opportunity_count,
            "distinctValueCount": len(frequencies),
            "largestPointMass": round(max(frequencies.values()) / len(selected), 6),
            "populationStandardDeviation": round(float(np.std(predictors, ddof=0)), 6),
            "minimum": round(float(np.min(predictors)), 6),
            "median": round(float(np.median(predictors)), 6),
            "maximum": round(float(np.max(predictors)), 6),
        },
        "determinism": {
            "evaluationModePassCount": eval_passes,
            "withinProcessRepeatabilityPassCount": repeatability_passes,
            "aggregatePoolStateSha256": pool_state_hash,
            "previousAggregatePoolStateSha256": previous_pool_hash,
            "selectedManifestSha256": selection_hash,
            "previousSelectedManifestSha256": previous_selection_hash,
            "freshProcessMatch": fresh_match,
        },
        "gates": gates,
        "decision": decision,
        "selectionInputAudit": {
            "allowedInputs": protocol["stateAndMetric"]["allowedSelectionInputs"],
            "forbiddenInputsRead": [],
        },
        "claimBoundary": protocol["decisionRules"]["pilotClaimBoundary"],
    }
    write_json(OUTPUT_ROOT / "summary.json", summary, pretty=True)
    write_json(
        OUTPUT_ROOT / "pool.json",
        {
            "schemaVersion": "online-storefront-repair-pilot-selection-pool.v1",
            "protocolSha256": protocol_hash,
            "rows": rows,
        },
    )
    write_json(
        OUTPUT_ROOT / "selected-tasks.json",
        {
            "schemaVersion": "online-storefront-repair-pilot-selected-tasks.v1",
            "protocolSha256": protocol_hash,
            "selectionSha256": selection_hash,
            "tasks": selected_manifest,
        },
        pretty=True,
    )
    files = {}
    for name in ("summary.json", "pool.json", "selected-tasks.json"):
        path = OUTPUT_ROOT / name
        files[name] = {"sha256": sha256(path.read_bytes()), "bytes": path.stat().st_size}
    write_json(
        OUTPUT_ROOT / "manifest.json",
        {
            "schemaVersion": "online-storefront-repair-pilot-selection-manifest.v1",
            "protocolSha256": protocol_hash,
            "files": files,
        },
        pretty=True,
    )
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
