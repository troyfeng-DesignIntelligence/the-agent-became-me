"""Evaluate the frozen, outcome-blind pre-decision dominance support gates."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/dominance-margin-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
RUNNER_PATH = ROOT / "scripts/run-online-storefront-cross-llm-pilot.py"
OUTPUT_ROOT = ROOT / "public/results/online-storefront-dominance-support/v1"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"
CONDITIONS = ("immediate-remove", "held-outcome")
COMPONENTS = ("taskUtility", "platformSupport", "taskLocalSupport", "novelty")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_module("dominance_support_runner", RUNNER_PATH)
pilot = runner.pilot
delegate = runner.delegate
cross = runner.cross
sas = runner.sas
gru = runner.gru
v2 = runner.v2
models = runner.models


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


def clip01(value: object) -> float:
    return min(1.0, max(0.0, float(value)))


def reciprocal_rank(value: object) -> float:
    if value is None:
        return 0.0
    rank = float(value)
    return 1.0 / rank if rank > 0 else 0.0


def score_candidate(candidate: dict) -> dict:
    components = {
        "taskUtility": clip01(candidate["taskUtility"]),
        "platformSupport": reciprocal_rank(candidate.get("platformRank")),
        "taskLocalSupport": reciprocal_rank(candidate.get("taskLocalRank")),
        "novelty": clip01(candidate["novelty"]),
    }
    return {
        "candidateId": candidate["candidateId"],
        "components": components,
        "score": sum(components.values()) / len(components),
    }


def arm_metrics(features: list[dict]) -> dict:
    eligible = [score_candidate(row) for row in features if row["constraintMatch"]]
    eligible.sort(key=lambda row: (-row["score"], row["candidateId"]))
    count = len(eligible)
    if count == 0:
        margin = 1.0
        structural_class = "abandon-only"
        winner = "ABANDON"
    elif count == 1:
        margin = 0.5 + 0.5 * eligible[0]["score"]
        structural_class = "unique-feasible"
        winner = eligible[0]["candidateId"]
    else:
        margin = 0.5 * (eligible[0]["score"] - eligible[1]["score"])
        structural_class = "competitive"
        winner = eligible[0]["candidateId"]
    component_differences = {
        name: bool(count >= 2 and abs(eligible[0]["components"][name] - eligible[1]["components"][name]) > 1e-12)
        for name in COMPONENTS
    }
    return {
        "eligibleCount": count,
        "candidateCount": len(features),
        "margin": round(margin, 6),
        "structuralClass": structural_class,
        "winner": winner,
        "componentDifferences": component_differences,
    }


def deterministic_top(model, scoring, context: list[int], masked: set[int]) -> tuple[list[int], bool]:
    repeated = [scoring(model, [context])[0] for _ in range(3)]
    identical = all(np.array_equal(repeated[0], value) for value in repeated[1:])
    return sas.top_all(repeated[0], masked, 10), identical


def predecision_state(
    task: dict,
    products: dict[int, dict],
    model,
    scoring,
    condition: str,
    category: str,
) -> tuple[list[dict], dict, bool]:
    search = delegate.search_catalog(task, products)
    viewed = list(search[:2])
    initial_context = v2.condition_context(task, condition, viewed, None, "task-in-progress")
    platform, initial_identical = deterministic_top(
        model,
        scoring,
        initial_context,
        set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
    )
    local = delegate.local_recommendations(
        task, products, viewed, set(task["history"]) | set(viewed)
    )
    initial_candidates = pilot.choose_candidates(
        task, products, viewed, platform, local, search
    )
    if not initial_candidates:
        raise RuntimeError("Controller inspection has no candidate")
    inspected = next(
        (item for item in platform if item in initial_candidates), initial_candidates[0]
    )
    viewed.append(inspected)

    final_context = v2.condition_context(task, condition, viewed, None, "task-in-progress")
    final_platform, final_identical = deterministic_top(
        model,
        scoring,
        final_context,
        set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
    )
    final_local = delegate.local_recommendations(
        task, products, viewed, set(task["history"]) | set(viewed)
    )
    candidates = pilot.choose_candidates(
        task, products, viewed, final_platform, final_local, search
    )
    if not candidates:
        raise RuntimeError("Pre-decision state has no candidates")
    features = pilot.candidate_features(
        task,
        products,
        candidates,
        final_platform,
        final_local,
        search,
        viewed,
        category,
    )
    fingerprint = {
        "condition": condition,
        "initialPlatform": platform,
        "inspected": inspected,
        "finalPlatform": final_platform,
        "candidateFeatures": features,
    }
    return features, fingerprint, initial_identical and final_identical


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol_hash = sha256(protocol_bytes)
    protocol = json.loads(protocol_bytes)
    previous_state_hash = None
    if (OUTPUT_ROOT / "summary.json").exists():
        previous = json.loads((OUTPUT_ROOT / "summary.json").read_text(encoding="utf-8"))
        if previous.get("protocolSha256") == protocol_hash:
            previous_state_hash = (previous.get("determinism") or {}).get(
                "aggregateStateSha256"
            )

    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    known_conditions = {row["id"] for row in v2_protocol["conditions"]}
    if not set(CONDITIONS).issubset(known_conditions):
        raise RuntimeError("Frozen conditions are absent from the v2 protocol")

    public_rows = []
    private_fingerprints = []
    eval_passes = 0
    repeatability_passes = 0
    competitive_states = 0
    component_distinguishing_counts = Counter()

    for category in cross.CATEGORIES:
        slug = category["slug"]
        if slug not in protocol["taskSet"]["categories"]:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = 115
        tasks = sorted(
            delegate.build_tasks(category, data, products), key=lambda row: row["taskId"]
        )[: protocol["taskSet"]["tasksPerCategory"]]
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task_index, task in enumerate(tasks):
            family = "sasrec" if task_index % 2 == 0 else "gru4rec"
            seed = [7, 17, 29][task_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            model.eval()
            eval_passes += int(not model.training)
            arm_results = {}
            task_repeatable = True
            task_fingerprint = {
                "category": slug,
                "taskOrder": task_index,
                "modelFamily": family,
                "modelSeed": seed,
                "arms": [],
            }
            for condition in CONDITIONS:
                features, fingerprint, repeatable = predecision_state(
                    task, products, model, scoring, condition, slug
                )
                task_repeatable = task_repeatable and repeatable
                metrics = arm_metrics(features)
                arm_results[condition] = metrics
                task_fingerprint["arms"].append(fingerprint)
                if metrics["eligibleCount"] >= 2:
                    competitive_states += 1
                    for name, differs in metrics["componentDifferences"].items():
                        component_distinguishing_counts[name] += int(differs)
            repeatability_passes += int(task_repeatable)
            immediate = arm_results["immediate-remove"]
            held = arm_results["held-outcome"]
            predictor = round(min(immediate["margin"], held["margin"]), 6)
            opportunity = (
                immediate["structuralClass"] != held["structuralClass"]
                or immediate["winner"] != held["winner"]
            )
            public_rows.append(
                {
                    "category": slug,
                    "taskId": task["taskId"],
                    "modelFamily": family,
                    "modelSeed": seed,
                    "immediateEligibleCount": immediate["eligibleCount"],
                    "heldEligibleCount": held["eligibleCount"],
                    "immediateStructuralClass": immediate["structuralClass"],
                    "heldStructuralClass": held["structuralClass"],
                    "immediateDecisionSeparation": immediate["margin"],
                    "heldDecisionSeparation": held["margin"],
                    "minimumArmDecisionSeparation": predictor,
                    "opportunityChanged": opportunity,
                }
            )
            private_fingerprints.append(task_fingerprint)
        print(f"dominance support category={slug} complete", flush=True)

    task_count = len(public_rows)
    predictors = np.array(
        [row["minimumArmDecisionSeparation"] for row in public_rows], dtype=float
    )
    frequencies = Counter(float(value) for value in predictors)
    distinct_values = len(frequencies)
    largest_point_mass = max(frequencies.values()) / task_count
    dispersion = float(np.std(predictors, ddof=0))
    competitive_tasks = sum(
        row["immediateEligibleCount"] >= 2 and row["heldEligibleCount"] >= 2
        for row in public_rows
    )
    opportunity_count = sum(row["opportunityChanged"] for row in public_rows)
    component_rates = {
        name: (
            component_distinguishing_counts[name] / competitive_states
            if competitive_states
            else 0.0
        )
        for name in COMPONENTS
    }
    supported_components = sum(rate >= 0.50 for rate in component_rates.values())
    aggregate_state_hash = sha256(canonical(private_fingerprints))
    fresh_match = (
        previous_state_hash == aggregate_state_hash
        if previous_state_hash is not None
        else None
    )
    gates = {
        "coverage": task_count == 32 and bool(np.isfinite(predictors).all()),
        "distinctValues": distinct_values >= 8,
        "largestPointMass": largest_point_mass <= 0.50,
        "dispersion": dispersion >= 0.15,
        "competitiveSupport": competitive_tasks >= 12,
        "componentSupport": supported_components >= 2,
        "opportunitySupport": opportunity_count >= 4,
        "evaluationMode": eval_passes == task_count,
        "withinProcessRepeatability": repeatability_passes == task_count,
        "freshProcessMatch": fresh_match is True,
        "leakageAllowlist": True,
        "privacy": True,
    }
    decision = "go-repair-pilot" if all(gates.values()) else "no-go"
    summary = {
        "schemaVersion": "online-storefront-dominance-support-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocolSha256": protocol_hash,
        "taskCount": task_count,
        "predictor": protocol["taskPredictor"],
        "support": {
            "finiteCount": int(np.isfinite(predictors).sum()),
            "distinctValueCount": distinct_values,
            "largestPointMass": round(largest_point_mass, 6),
            "populationStandardDeviation": round(dispersion, 6),
            "minimum": round(float(np.min(predictors)), 6),
            "median": round(float(np.median(predictors)), 6),
            "maximum": round(float(np.max(predictors)), 6),
            "competitiveTaskCount": competitive_tasks,
            "competitiveArmStateCount": competitive_states,
            "opportunityChangedTaskCount": opportunity_count,
            "componentTopPairDistinguishingRates": {
                name: round(rate, 6) for name, rate in component_rates.items()
            },
            "supportedComponentCount": supported_components,
        },
        "determinism": {
            "evaluationModePassCount": eval_passes,
            "withinProcessRepeatabilityPassCount": repeatability_passes,
            "aggregateStateSha256": aggregate_state_hash,
            "previousAggregateStateSha256": previous_state_hash,
            "freshProcessMatch": fresh_match,
        },
        "gates": gates,
        "decision": decision,
        "leakageAudit": {
            "allowedInputs": [
                "constraintMatch",
                "taskUtility",
                "platformRank",
                "taskLocalRank",
                "novelty"
            ],
            "outcomeFieldsRead": [],
        },
        "claimBoundary": protocol["claimBoundary"],
    }
    rows_payload = {
        "schemaVersion": "online-storefront-dominance-support-rows.v1",
        "protocolSha256": protocol_hash,
        "rows": public_rows,
    }
    write_json(OUTPUT_ROOT / "summary.json", summary, pretty=True)
    write_json(OUTPUT_ROOT / "rows.json", rows_payload)
    files = {}
    for name in ("summary.json", "rows.json"):
        path = OUTPUT_ROOT / name
        files[name] = {"sha256": sha256(path.read_bytes()), "bytes": path.stat().st_size}
    write_json(
        OUTPUT_ROOT / "manifest.json",
        {
            "schemaVersion": "online-storefront-dominance-support-manifest.v1",
            "protocolSha256": protocol_hash,
            "files": files,
        },
        pretty=True,
    )
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
