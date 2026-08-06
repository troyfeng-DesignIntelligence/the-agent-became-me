"""Verify deterministic SASRec/GRU4Rec inference before future API calls."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/recommender-determinism-protocol.json"
RUNNER_PATH = ROOT / "scripts/run-online-storefront-cross-llm-pilot.py"
OUTPUT_PATH = ROOT / "public/results/online-storefront-recommender-determinism/v1/summary.json"
GRU_CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_module("determinism_runner", RUNNER_PATH)
delegate = runner.delegate
cross = runner.cross
sas = runner.sas
gru = runner.gru


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol = json.loads(protocol_bytes)
    previous_hash = None
    if OUTPUT_PATH.exists():
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        previous_hash = previous.get("shelfStateSha256")

    state_rows = []
    evaluation_mode_passes = 0
    within_process_passes = 0
    for category in cross.CATEGORIES:
        slug = category["slug"]
        if slug not in protocol["categories"]:
            continue
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        delegate.TASKS_PER_CATEGORY = 115
        tasks = sorted(delegate.build_tasks(category, data, products), key=lambda row: row["taskId"])[
            : protocol["tasksPerCategory"]
        ]
        sas_models, _ = cross.load_or_train_models(data)
        gru_models, _ = gru.load_or_train_models(data, slug, GRU_CHECKPOINTS, sas)
        for task_index, task in enumerate(tasks):
            family = "sasrec" if task_index % 2 == 0 else "gru4rec"
            seed = [7, 17, 29][task_index % 3]
            model = sas_models[seed] if family == "sasrec" else gru_models[seed]
            scoring = sas.score_context_batch if family == "sasrec" else gru.score_context_batch
            model.eval()
            evaluation_mode = not model.training
            evaluation_mode_passes += int(evaluation_mode)
            context = list(task["history"])
            repeated = [scoring(model, [context])[0] for _ in range(3)]
            within_process = all(np.array_equal(repeated[0], row) for row in repeated[1:])
            within_process_passes += int(within_process)
            masked = set(task["interacted"]) | {task["nextTaskItem"]}
            top = sas.top_all(repeated[0], masked)
            state_rows.append(
                {
                    "category": slug,
                    "taskOrder": task_index,
                    "modelFamily": family,
                    "modelSeed": seed,
                    "topHash": sha256(canonical(top)),
                }
            )
        print(f"determinism category={slug} complete", flush=True)

    task_count = len(state_rows)
    shelf_hash = sha256(canonical(state_rows))
    fresh_process_match = previous_hash == shelf_hash if previous_hash is not None else None
    passed = (
        task_count == 32
        and evaluation_mode_passes == task_count
        and within_process_passes == task_count
        and fresh_process_match is True
    )
    summary = {
        "schemaVersion": "online-storefront-recommender-determinism-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocolSha256": sha256(protocol_bytes),
        "taskCount": task_count,
        "evaluationModePassCount": evaluation_mode_passes,
        "withinProcessPassCount": within_process_passes,
        "shelfStateSha256": shelf_hash,
        "previousShelfStateSha256": previous_hash,
        "freshProcessMatch": fresh_process_match,
        "passed": passed,
        "claimBoundary": "This preflight verifies deterministic local recommender inference only; it does not validate the decision-margin mechanism or any LLM effect."
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(summary, indent=2))
    if fresh_process_match is False:
        raise RuntimeError("Fresh-process shelf hash did not match")


if __name__ == "__main__":
    main()
