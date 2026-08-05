"""Run the frozen SASRec-versus-GRU storefront robustness experiment."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v3/model-protocol.json"
V2_PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
OUTPUT = ROOT / "public/results/online-storefront-model-robustness/v1"
ARTIFACTS = ROOT / "artifacts/online-storefront-model-robustness"
CHECKPOINTS = ROOT / "artifacts/models/amazon-gru4rec"
TOP_K = 10


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v2 = load_module("online_storefront_v2_base", ROOT / "scripts/run-online-storefront-v2.py")
gru = load_module("gru4rec_baseline", ROOT / "scripts/recommender_gru4rec.py")
delegate = v2.delegate
cross = v2.cross
sas = v2.sas


def rounded(value: float) -> float:
    return round(float(value), 6)


def mean(values) -> float:
    rows = list(values)
    return float(sum(rows) / len(rows)) if rows else 0.0


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


class ModelScorer:
    def __init__(self, model, score_context_batch):
        self.model = model
        self.score_context_batch = score_context_batch
        self.cache: dict[tuple[int, ...], np.ndarray] = {}

    def raw(self, context: list[int]) -> np.ndarray:
        key = tuple(context[-sas.MAX_LEN :])
        if key not in self.cache:
            self.cache[key] = self.score_context_batch(self.model, [list(key)])[0]
        return self.cache[key]

    def top(self, context: list[int], masked: set[int], limit: int = TOP_K) -> list[int]:
        return sas.top_all(self.raw(context), masked, limit)


def validation_summary(family: str, model, data: dict, seed: int) -> dict:
    if family == "sasrec":
        result = sas.evaluate_model(
            model,
            data["testHistories"],
            data["test"],
            data["interacted"],
            data["itemCount"],
            seed,
            data["popularity"],
            data["transitions"],
            limit=800,
        )
        learned = result["sasrec"]
    else:
        result = gru.evaluate_model(
            model,
            data["testHistories"],
            data["test"],
            data["interacted"],
            data["itemCount"],
            seed,
            data["popularity"],
            data["transitions"],
            sas,
            limit=800,
        )
        learned = result["gru4rec"]
    return {
        "modelFamily": family,
        "modelSeed": seed,
        "evaluatedUserCount": learned["count"],
        "ndcgAt10": learned["ndcgAt10"],
        "hitRateAt10": learned["hitRateAt10"],
        "popularityNdcgAt10": result["popularity"]["ndcgAt10"],
        "transitionNdcgAt10": result["firstOrderTransition"]["ndcgAt10"],
        "orderChangedTop10Rate": result["orderSensitivity"]["changedTop10Rate"],
        "meanReverseOrderDisplacement": result["orderSensitivity"][
            "meanTop10Displacement"
        ],
    }


def run_family(
    family: str,
    models: dict,
    score_context_batch,
    category_slug: str,
    tasks: list[dict],
    products: dict[int, dict],
    condition_specs: dict,
    condition_order: list[str],
    configs: list[dict],
) -> tuple[list[dict], list[dict]]:
    rows: list[dict] = []
    contrasts: list[dict] = []
    for seed, model in models.items():
        model.eval()
        scorer = ModelScorer(model, score_context_batch)
        for task in tasks:
            for config in configs:
                config_id = config["id"]
                fixed_trace = v2.frozen_agent_trace(task, products, config)
                fixed_mask = (
                    set(task["interacted"])
                    | set(fixed_trace["viewed"])
                    | {task["nextTaskItem"]}
                )
                if fixed_trace["selected"] is not None:
                    fixed_mask.add(fixed_trace["selected"])
                fixed_results = {
                    condition: v2.condition_result(
                        task,
                        condition_specs[condition],
                        fixed_trace,
                        scorer,
                        fixed_mask,
                    )
                    for condition in condition_order
                }
                fixed_contrast = v2.make_contrast(
                    category_slug,
                    task,
                    seed,
                    config_id,
                    "fixed-trace",
                    fixed_results,
                )
                fixed_contrast["modelFamily"] = family
                contrasts.append(fixed_contrast)
                fixed_baseline = fixed_results["no-memory"]
                for condition, result in fixed_results.items():
                    row = v2.public_condition_row(
                        category_slug,
                        task,
                        seed,
                        config_id,
                        "fixed-trace",
                        condition,
                        result,
                        fixed_baseline,
                    )
                    row["modelFamily"] = family
                    rows.append(row)

                free_traces = {
                    condition: v2.free_run(
                        task,
                        products,
                        scorer,
                        condition_specs[condition],
                        config,
                    )
                    for condition in condition_order
                }
                free_mask = set(task["interacted"]) | {task["nextTaskItem"]}
                for trace in free_traces.values():
                    free_mask.update(trace["viewed"])
                    if trace["selected"] is not None:
                        free_mask.add(trace["selected"])
                free_results = {
                    condition: v2.condition_result(
                        task,
                        condition_specs[condition],
                        free_traces[condition],
                        scorer,
                        free_mask,
                    )
                    for condition in condition_order
                }
                free_contrast = v2.make_contrast(
                    category_slug,
                    task,
                    seed,
                    config_id,
                    "free-running",
                    free_results,
                )
                free_contrast["modelFamily"] = family
                contrasts.append(free_contrast)
                free_baseline = free_results["no-memory"]
                for condition, result in free_results.items():
                    row = v2.public_condition_row(
                        category_slug,
                        task,
                        seed,
                        config_id,
                        "free-running",
                        condition,
                        result,
                        free_baseline,
                    )
                    row["modelFamily"] = family
                    rows.append(row)
    return rows, contrasts


def summarize_validation(rows: list[dict]) -> list[dict]:
    payloads = []
    for family in sorted({row["modelFamily"] for row in rows}):
        for category in sorted({row["category"] for row in rows}):
            selected = [
                row
                for row in rows
                if row["modelFamily"] == family and row["category"] == category
            ]
            payloads.append(
                {
                    "modelFamily": family,
                    "category": category,
                    "seedCount": len(selected),
                    "meanNdcgAt10": rounded(mean(row["ndcgAt10"] for row in selected)),
                    "meanPopularityNdcgAt10": rounded(
                        mean(row["popularityNdcgAt10"] for row in selected)
                    ),
                    "meanTransitionNdcgAt10": rounded(
                        mean(row["transitionNdcgAt10"] for row in selected)
                    ),
                    "meanOrderChangedTop10Rate": rounded(
                        mean(row["orderChangedTop10Rate"] for row in selected)
                    ),
                    "seeds": selected,
                }
            )
    return payloads


def family_result(family: str, contrasts: list[dict], bootstrap_protocol: dict) -> dict:
    selected = [row for row in contrasts if row["modelFamily"] == family]
    uncertainty = v2.bootstrap_contrasts(selected, bootstrap_protocol)
    fixed = uncertainty["fixed-trace"]
    free = uncertainty["free-running"]
    return {
        "modelFamily": family,
        "pairedContrastRowCount": len(selected),
        "fixedTrace": {
            "t1ImmediateHeldDisplacement": fixed["t1ImmediateHeldDisplacement"],
            "t2ImmediateHeldDisplacement": fixed["t2ImmediateHeldDisplacement"],
            "t3ImmediateHeldDisplacement": fixed["t3ImmediateHeldDisplacement"],
        },
        "freeRunning": {
            "t1ImmediateHeldDisplacement": free["t1ImmediateHeldDisplacement"],
            "traceDivergenceRate": free["traceDiverged"],
            "heldMinusImmediateDecisionAccuracy": free[
                "heldMinusImmediateDecisionAccuracy"
            ],
            "heldMinusImmediateSelectedUtility": free[
                "heldMinusImmediateSelectedUtility"
            ],
        },
        "inertLoggingMatched": all(
            row["noMemoryLoggedMaxDisplacement"] == 0
            and row["noMemoryLoggedTraceMatched"]
            for row in selected
        ),
        "nullFixedPrimaryPairCount": sum(
            row["mode"] == "fixed-trace"
            and row["t1ImmediateHeldDisplacement"] == 0
            for row in selected
        ),
    }


def main() -> None:
    protocol_text = PROTOCOL_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    protocol_hash = sha256(protocol_text.encode("utf-8"))
    v2_protocol = json.loads(V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    v2_protocol["uncertainty"] = protocol["uncertainty"]
    delegate.TASKS_PER_CATEGORY = protocol["tasksPerCategory"]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)

    condition_specs = {row["id"]: row for row in v2_protocol["conditions"]}
    condition_order = protocol["conditions"]
    configs = v2_protocol["agentConfigurations"]
    all_rows: list[dict] = []
    all_contrasts: list[dict] = []
    validation_rows: list[dict] = []
    training_runs: list[dict] = []

    for category in cross.CATEGORIES:
        slug = category["slug"]
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        tasks = delegate.build_tasks(category, data, products)
        sas_models, sas_runs = cross.load_or_train_models(data)
        gru_models, gru_runs = gru.load_or_train_models(data, slug, CHECKPOINTS, sas)
        for family, models, runs, scoring in [
            ("sasrec", sas_models, sas_runs, sas.score_context_batch),
            ("gru4rec", gru_models, gru_runs, gru.score_context_batch),
        ]:
            for run in runs:
                training_runs.append({"category": slug, "modelFamily": family, **run})
            for seed, model in models.items():
                validation = validation_summary(family, model, data, seed)
                validation["category"] = slug
                validation_rows.append(validation)
                print(
                    f"validation category={slug} family={family} seed={seed} "
                    f"ndcg@10={validation['ndcgAt10']}",
                    flush=True,
                )
            family_rows, family_contrasts = run_family(
                family,
                models,
                scoring,
                slug,
                tasks,
                products,
                condition_specs,
                condition_order,
                configs,
            )
            all_rows.extend(family_rows)
            all_contrasts.extend(family_contrasts)
            print(
                f"storefront category={slug} family={family} "
                f"rows={len(family_rows)} contrasts={len(family_contrasts)}",
                flush=True,
            )

    validation = summarize_validation(validation_rows)
    family_results = {
        model_spec["id"]: family_result(
            model_spec["id"], all_contrasts, v2_protocol
        )
        for model_spec in protocol["models"]
    }
    validation_gate = all(
        row["meanNdcgAt10"] > row["meanPopularityNdcgAt10"]
        and row["meanOrderChangedTop10Rate"] >= 0.50
        for row in validation
    )
    family_gates = {
        family: {
            "primaryRecurrence": result["fixedTrace"][
                "t1ImmediateHeldDisplacement"
            ]["lower95"]
            > 0.15,
            "t2Equivalent": result["fixedTrace"][
                "t2ImmediateHeldDisplacement"
            ]["upper95"]
            < 0.05,
            "t3Equivalent": result["fixedTrace"][
                "t3ImmediateHeldDisplacement"
            ]["upper95"]
            < 0.05,
            "inertLoggingMatched": result["inertLoggingMatched"],
        }
        for family, result in family_results.items()
    }
    all_gates = validation_gate and all(all(row.values()) for row in family_gates.values())
    summary = {
        "schemaVersion": "online-storefront-model-robustness-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "design": {
            "taskCount": protocol["tasksPerCategory"] * len(protocol["categories"]),
            "tasksPerCategory": protocol["tasksPerCategory"],
            "modelFamilies": [row["id"] for row in protocol["models"]],
            "modelSeeds": protocol["checkpointSeeds"],
            "categories": protocol["categories"],
            "conditions": protocol["conditions"],
            "agentConfigurations": protocol["agentConfigurations"],
            "modes": protocol["modes"],
            "conditionRowCount": len(all_rows),
            "pairedContrastRowCount": len(all_contrasts),
        },
        "validation": validation,
        "trainingRuns": training_runs,
        "results": family_results,
        "gates": {
            "learnedAndOrderSensitiveInEveryCategory": validation_gate,
            "byFamily": family_gates,
            "allPassed": all_gates,
        },
        "claims": {
            "observed": [
                "Both learned families were evaluated on identical category splits, tasks, conditions, seeds, and analysis rules.",
                "The recurrent family used the same sampled next-item loss as SASRec to isolate encoder architecture.",
            ],
            "notEstablished": [
                "Two sequence encoders do not establish architecture independence.",
                "The recurrent implementation does not reproduce every session-parallel optimization detail of the original GRU4Rec paper.",
                "The study remains an offline research-owned replay rather than a production-platform experiment.",
            ],
        },
    }
    rows_payload = {
        "schemaVersion": "online-storefront-model-robustness-rows.v1",
        "protocolSha256": protocol_hash,
        "privacy": {
            "originalUserIdsIncluded": False,
            "originalItemIdsIncluded": False,
            "productTitlesIncluded": False,
            "reviewTextIncluded": False,
        },
        "rows": all_rows,
    }
    contrasts_payload = {
        "schemaVersion": "online-storefront-model-robustness-contrasts.v1",
        "protocolSha256": protocol_hash,
        "rows": all_contrasts,
    }
    outputs = {
        "summary.json": summary,
        "rows.json": rows_payload,
        "contrasts.json": contrasts_payload,
    }
    for filename, payload in outputs.items():
        write_json(OUTPUT / filename, payload, pretty=filename == "summary.json")
    manifest = {
        "schemaVersion": "online-storefront-model-robustness-manifest.v1",
        "protocolSha256": protocol_hash,
        "files": {
            filename: {
                "sha256": sha256((OUTPUT / filename).read_bytes()),
                "bytes": (OUTPUT / filename).stat().st_size,
            }
            for filename in outputs
        },
    }
    write_json(OUTPUT / "manifest.json", manifest, pretty=True)
    write_json(
        ARTIFACTS / "run.json",
        {
            "generatedAt": summary["generatedAt"],
            "protocolSha256": protocol_hash,
            "publicManifestSha256": sha256((OUTPUT / "manifest.json").read_bytes()),
        },
        pretty=True,
    )
    print(json.dumps({"gates": summary["gates"], "results": family_results}, indent=2))


if __name__ == "__main__":
    torch.set_grad_enabled(False)
    main()
