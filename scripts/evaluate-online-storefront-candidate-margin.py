"""Evaluate the frozen offline candidate-margin mechanism diagnostic.

The script reconstructs only derived candidate states from the frozen task
catalogs and recommender checkpoints. Public outputs never include item IDs,
titles, reviews, prompts, or provider responses.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/candidate-margin-protocol.json"
SOURCE_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/forced-inspection-protocol.json"
RUNNER_PATH = ROOT / "scripts/run-online-storefront-cross-llm-pilot.py"
OUTPUT_ROOT = ROOT / "public/results/online-storefront-candidate-margin/v1"
SOURCE_ROOT = ROOT / "public/results/online-storefront-decoding-sensitivity/v1"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"
PERMUTATIONS = 100_000
PERMUTATION_SEED = 2026080603


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_module("candidate_margin_runner", RUNNER_PATH)
pilot = runner.pilot
delegate = runner.delegate
cross = runner.cross
v2 = runner.v2
sas = runner.sas
gru = runner.gru
models = runner.models


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def load_contrasts(provider: str) -> tuple[list[dict], Path]:
    path = SOURCE_ROOT / f"{provider}-forced-inspection-t0/contrasts.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("contrasts")
    if not isinstance(rows, list):
        raise RuntimeError(f"Malformed contrast file: {path}")
    return rows, path


def post_inspection_state(
    task: dict,
    products: dict[int, dict],
    scorer,
    condition: dict,
    category: str,
) -> dict:
    search = delegate.search_catalog(task, products)
    viewed = list(search[:2])
    context = v2.condition_context(
        task, condition["id"], viewed, None, "task-in-progress"
    )
    platform = scorer.top(
        context,
        set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
    )
    local = delegate.local_recommendations(
        task, products, viewed, set(task["history"]) | set(viewed)
    )
    candidates = pilot.choose_candidates(task, products, viewed, platform, local, search)
    if not candidates:
        return {
            "forcedItem": None,
            "candidateItems": set(),
            "bestEligibleItem": None,
            "eligibleCount": 0,
            "candidateCount": 0,
            "margin": None,
        }

    forced_item = next((item for item in platform if item in candidates), candidates[0])
    viewed.append(forced_item)
    context = v2.condition_context(
        task, condition["id"], viewed, None, "task-in-progress"
    )
    platform = scorer.top(
        context,
        set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
    )
    local = delegate.local_recommendations(
        task, products, viewed, set(task["history"]) | set(viewed)
    )
    candidates = pilot.choose_candidates(task, products, viewed, platform, local, search)
    features = pilot.candidate_features(
        task, products, candidates, platform, local, search, viewed, category
    )
    eligible = sorted(
        (
            (float(feature["taskUtility"]), item)
            for item, feature in zip(candidates, features, strict=True)
            if feature["constraintMatch"]
        ),
        reverse=True,
    )
    margin = None
    if len(eligible) >= 2:
        margin = round(eligible[0][0] - eligible[1][0], 6)
    return {
        "forcedItem": forced_item,
        "candidateItems": set(candidates),
        "bestEligibleItem": eligible[0][1] if eligible else None,
        "eligibleCount": len(eligible),
        "candidateCount": len(candidates),
        "margin": margin,
    }


def jaccard(left: set[int], right: set[int]) -> float:
    union = left | right
    return 1.0 if not union else len(left & right) / len(union)


def reconstruct_task_states(source_protocol: dict) -> list[dict]:
    v2_protocol = json.loads(runner.V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    condition_specs = {row["id"]: row for row in v2_protocol["conditions"]}
    task_count = int(source_protocol["tasksPerCategory"])
    reconstructed = []
    for category in cross.CATEGORIES:
        slug = category["slug"]
        if slug not in source_protocol["categories"]:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = max(115, task_count)
        eligible = delegate.build_tasks(category, data, products)
        tasks = sorted(eligible, key=lambda row: row["taskId"])[:task_count]
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task_index, task in enumerate(tasks):
            family = "sasrec" if task_index % 2 == 0 else "gru4rec"
            seed = [7, 17, 29][task_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            scorer = models.ModelScorer(model, scoring)
            immediate = post_inspection_state(
                task, products, scorer, condition_specs["immediate-remove"], slug
            )
            held = post_inspection_state(
                task, products, scorer, condition_specs["held-outcome"], slug
            )
            overlap = jaccard(immediate["candidateItems"], held["candidateItems"])
            margins = [immediate["margin"], held["margin"]]
            analyzable = all(value is not None for value in margins)
            reconstructed.append(
                {
                    "category": slug,
                    "taskId": task["taskId"],
                    "modelFamily": family,
                    "modelSeed": seed,
                    "analyzable": analyzable,
                    "immediateEligibleCount": immediate["eligibleCount"],
                    "heldEligibleCount": held["eligibleCount"],
                    "immediateCandidateCount": immediate["candidateCount"],
                    "heldCandidateCount": held["candidateCount"],
                    "immediateTopTwoEligibleUtilityMargin": immediate["margin"],
                    "heldTopTwoEligibleUtilityMargin": held["margin"],
                    "minimumTopTwoEligibleUtilityMargin": (
                        round(min(margins), 6) if analyzable else None
                    ),
                    "forcedItemDifferent": immediate["forcedItem"] != held["forcedItem"],
                    "postInspectionCandidateJaccard": round(overlap, 6),
                    "postInspectionCandidateSetDifferent": overlap < 1.0,
                    "bestEligibleCandidateDifferent": (
                        immediate["bestEligibleItem"] != held["bestEligibleItem"]
                    ),
                    "exposureOpportunityChange": (
                        immediate["forcedItem"] != held["forcedItem"] or overlap < 1.0
                    ),
                }
            )
        print(f"candidate-margin category={slug} reconstructed", flush=True)
    return reconstructed


def margin_auc(rows: list[dict]) -> float | None:
    events = [row["minimumTopTwoEligibleUtilityMargin"] for row in rows if row["event"]]
    controls = [row["minimumTopTwoEligibleUtilityMargin"] for row in rows if not row["event"]]
    if not events or not controls:
        return None
    score = 0.0
    for event in events:
        for control in controls:
            if event < control:
                score += 1.0
            elif event == control:
                score += 0.5
    return score / (len(events) * len(controls))


def permutation_p(rows: list[dict], observed_auc: float | None) -> float | None:
    if observed_auc is None:
        return None
    margins = np.array(
        [row["minimumTopTwoEligibleUtilityMargin"] for row in rows], dtype=float
    )
    labels = np.array([bool(row["event"]) for row in rows], dtype=bool)
    event_count = int(labels.sum())
    if event_count == 0 or event_count == len(labels):
        return None
    rng = np.random.default_rng(PERMUTATION_SEED)
    extreme = 0
    indices = np.arange(len(rows))
    for _ in range(PERMUTATIONS):
        event_indices = set(rng.choice(indices, size=event_count, replace=False).tolist())
        permuted = [
            {"minimumTopTwoEligibleUtilityMargin": float(margins[index]), "event": index in event_indices}
            for index in indices
        ]
        value = margin_auc(permuted)
        if value is not None and value >= observed_auc - 1e-12:
            extreme += 1
    return (extreme + 1) / (PERMUTATIONS + 1)


def provider_summary(rows: list[dict], provider: str) -> dict:
    provider_rows = [row for row in rows if row["provider"] == provider]
    analyzable = [row for row in provider_rows if row["analyzable"]]
    auc = margin_auc(analyzable)
    p_value = permutation_p(analyzable, auc)
    margins = [row["minimumTopTwoEligibleUtilityMargin"] for row in analyzable]
    threshold = float(np.quantile(margins, 1 / 3, method="linear")) if margins else None
    event_rows = [row for row in analyzable if row["event"]]
    bottom_events = (
        sum(row["minimumTopTwoEligibleUtilityMargin"] <= threshold for row in event_rows)
        if threshold is not None
        else 0
    )
    all_events_have_opportunity = bool(event_rows) and all(
        row["exposureOpportunityChange"] for row in event_rows
    )
    return {
        "taskCount": len(provider_rows),
        "analyzableCount": len(analyzable),
        "analyzableRate": round(len(analyzable) / len(provider_rows), 6),
        "persistentResolvedActionEventCount": len(event_rows),
        "shamPersistentResolvedActionEventCount": sum(
            row["shamEvent"] for row in provider_rows
        ),
        "marginAuc": round(auc, 6) if auc is not None else None,
        "oneSidedPermutationP": round(p_value, 6) if p_value is not None else None,
        "bottomTertileThreshold": round(threshold, 6) if threshold is not None else None,
        "eventCountInBottomTertile": bottom_events,
        "eventFractionInBottomTertile": (
            round(bottom_events / len(event_rows), 6) if event_rows else None
        ),
        "allEventsHaveExposureOpportunityChange": all_events_have_opportunity,
        "forcedItemDifferentRate": round(
            sum(row["forcedItemDifferent"] for row in provider_rows) / len(provider_rows), 6
        ),
        "candidateSetDifferentRate": round(
            sum(row["postInspectionCandidateSetDifferent"] for row in provider_rows)
            / len(provider_rows),
            6,
        ),
        "bestEligibleCandidateDifferentRate": round(
            sum(row["bestEligibleCandidateDifferent"] for row in provider_rows)
            / len(provider_rows),
            6,
        ),
    }


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol = json.loads(protocol_bytes)
    source_protocol = json.loads(SOURCE_PROTOCOL_PATH.read_text(encoding="utf-8"))
    reconstructed = reconstruct_task_states(source_protocol)
    reconstructed_by_key = {
        (row["category"], row["taskId"], row["modelFamily"]): row
        for row in reconstructed
    }
    if len(reconstructed_by_key) != 32:
        raise RuntimeError(
            f"Expected 32 unique reconstructed tasks, found {len(reconstructed_by_key)}"
        )

    public_rows = []
    source_files = {}
    provider_keys = {}
    for provider in ("mimo", "deepseek"):
        contrasts, source_path = load_contrasts(provider)
        source_files[provider] = {
            "path": str(source_path.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(source_path),
        }
        keys = set()
        for contrast in contrasts:
            key = (
                contrast["category"],
                contrast["taskId"],
                contrast["modelFamily"],
            )
            if key not in reconstructed_by_key:
                raise RuntimeError(f"Unmatched frozen contrast key: {key}")
            keys.add(key)
            state = reconstructed_by_key[key]
            public_rows.append(
                {
                    **state,
                    "provider": provider,
                    "event": bool(contrast["persistentResolvedActionFeedback"]),
                    "shamEvent": bool(
                        contrast["shamPersistentResolvedActionFeedback"]
                    ),
                    "resolvedActionDiverged": bool(
                        contrast["exposureResolvedActionDiverged"]
                    ),
                }
            )
        provider_keys[provider] = keys
    if provider_keys["mimo"] != provider_keys["deepseek"]:
        raise RuntimeError("Provider task keys do not match exactly")

    providers = {
        provider: provider_summary(public_rows, provider)
        for provider in ("mimo", "deepseek")
    }
    deepseek = providers["deepseek"]
    analyzable_ok = deepseek["analyzableRate"] >= 0.90
    direction_no_go = (
        deepseek["marginAuc"] is None or deepseek["marginAuc"] <= 0.50
    )
    opportunity_ok = deepseek["allEventsHaveExposureOpportunityChange"]
    go = (
        analyzable_ok
        and deepseek["marginAuc"] is not None
        and deepseek["marginAuc"] >= 0.70
        and deepseek["oneSidedPermutationP"] is not None
        and deepseek["oneSidedPermutationP"] <= 0.10
        and deepseek["eventFractionInBottomTertile"] is not None
        and deepseek["eventFractionInBottomTertile"] >= 2 / 3
        and opportunity_ok
    )
    if not analyzable_ok or direction_no_go or not opportunity_ok:
        decision = "no-go"
    elif go:
        decision = "go-near-tie-margin"
    else:
        decision = "pivot-candidate-state-opportunity"

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    summary = {
        "schemaVersion": "online-storefront-candidate-margin-summary.v1",
        "generatedAt": generated_at,
        "protocolSha256": sha256_bytes(protocol_bytes),
        "sourceProtocolSha256": sha256_file(SOURCE_PROTOCOL_PATH),
        "sourceFiles": source_files,
        "predictor": protocol["predictor"],
        "permutationCount": PERMUTATIONS,
        "permutationSeed": PERMUTATION_SEED,
        "providers": providers,
        "decision": decision,
        "decisionRules": protocol["decisionRules"],
        "claimBoundary": protocol["claimBoundary"],
    }
    rows_payload = {
        "schemaVersion": "online-storefront-candidate-margin-rows.v1",
        "protocolSha256": summary["protocolSha256"],
        "rows": public_rows,
    }
    write_json(OUTPUT_ROOT / "summary.json", summary, pretty=True)
    write_json(OUTPUT_ROOT / "rows.json", rows_payload)
    files = {}
    for name in ("summary.json", "rows.json"):
        path = OUTPUT_ROOT / name
        files[name] = {"sha256": sha256_file(path), "bytes": path.stat().st_size}
    manifest = {
        "schemaVersion": "online-storefront-candidate-margin-manifest.v1",
        "protocolSha256": summary["protocolSha256"],
        "files": files,
    }
    write_json(OUTPUT_ROOT / "manifest.json", manifest, pretty=True)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
