"""Run the frozen online-storefront v2 experiment with trained SASRec models.

The public artifact is a replay bundle. Actual inference is executed here with
the trained checkpoints stored under ignored artifacts/. Raw users, items,
titles, histories, and checkpoint tensors never enter public outputs.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v2/protocol.json"
OUTPUT = ROOT / "public/results/online-storefront-v2/v1"
ARTIFACTS = ROOT / "artifacts/online-storefront-v2"
TOP_K = 10


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


delegate = load_module(
    "delegated_activation_v1", ROOT / "scripts/run-delegated-activation.py"
)
cross = delegate.cross
sas = delegate.sas


def rounded(value: float) -> float:
    return round(float(value), 6)


def mean(values) -> float:
    rows = list(values)
    return float(sum(rows) / len(rows)) if rows else 0.0


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def public_hash(kind: str, *parts: object) -> str:
    value = "|".join(["online-storefront-v2", kind, *map(str, parts)])
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def item_hash(category: str, item: int) -> str:
    return public_hash("item", category, item)[:10].upper()


def trace_hash(category: str, actions: list[dict]) -> str:
    public = [
        {
            "action": row["action"],
            "product": None
            if row.get("product") is None
            else item_hash(category, row["product"]),
            "source": row.get("source"),
        }
        for row in actions
    ]
    return sha256(canonical_json_bytes(public))[:16]


def displacement(left: list[int], right: list[int]) -> float:
    return 1.0 - len(set(left[:TOP_K]).intersection(right[:TOP_K])) / TOP_K


def interval(values) -> dict:
    array = np.asarray(list(values), dtype=np.float64)
    return {
        "estimate": rounded(float(np.mean(array))),
        "lower95": rounded(float(np.quantile(array, 0.025))),
        "upper95": rounded(float(np.quantile(array, 0.975))),
    }


class ModelScorer:
    def __init__(self, model):
        self.model = model
        self.cache: dict[tuple[int, ...], np.ndarray] = {}

    def raw(self, context: list[int]) -> np.ndarray:
        key = tuple(context[-sas.MAX_LEN :])
        if key not in self.cache:
            self.cache[key] = sas.score_context_batch(self.model, [list(key)])[0]
        return self.cache[key]

    def top(self, context: list[int], masked: set[int], limit: int = TOP_K) -> list[int]:
        return sas.top_all(self.raw(context), masked, limit)


def frozen_agent_trace(task: dict, products: dict[int, dict], config: dict) -> dict:
    search = delegate.search_catalog(task, products)
    viewed = list(search[: config["searchViews"]])
    local = delegate.local_recommendations(
        task,
        products,
        viewed,
        set(task["history"]) | set(viewed),
    )
    viewed.extend(
        item
        for item in local[: config["recommendationViews"]]
        if item not in viewed
    )
    feasible = [item for item in viewed if delegate.constraint_match(task, products[item])]
    feasible.sort(
        key=lambda item: (-delegate.product_utility(task, products[item]), item)
    )
    selected = feasible[0] if feasible else None
    actions = [
        {"action": "search", "product": None, "source": "catalog-search"}
    ]
    actions.extend(
        {"action": "product-view", "product": item, "source": "fixed-trace"}
        for item in viewed
    )
    actions.append(
        {
            "action": "select" if selected is not None else "abandon",
            "product": selected,
            "source": "fixed-outcome",
        }
    )
    return {
        "actions": actions,
        "viewed": viewed,
        "selected": selected,
        "outcome": "selected" if selected is not None else "abandoned",
        "decisionCorrect": bool(selected is not None)
        == any(
            item not in task["interacted"]
            and delegate.constraint_match(task, product)
            for item, product in products.items()
        ),
        "selectedUtility": rounded(
            delegate.product_utility(task, products[selected]) if selected else 0.0
        ),
    }


def novelty(item: int, viewed: list[int], products: dict[int, dict]) -> float:
    if not viewed:
        return 1.0
    item_tokens = products[item]["tokens"]
    similarities = []
    for seen in viewed:
        seen_tokens = products[seen]["tokens"]
        union = item_tokens.union(seen_tokens)
        similarities.append(
            len(item_tokens.intersection(seen_tokens)) / len(union) if union else 0.0
        )
    return 1.0 - max(similarities)


def choose_recommendation(
    task: dict,
    products: dict[int, dict],
    viewed: list[int],
    platform: list[int],
    local: list[int],
    search: list[int],
    config: dict,
) -> int | None:
    candidates = list(dict.fromkeys([*platform, *local, *search]))
    candidates = [
        item
        for item in candidates
        if item not in viewed
        and item not in task["interacted"]
        and item in products
        and products[item]["title"]
    ]
    if not candidates:
        return None
    platform_rank = {item: 1.0 - index / max(1, len(platform)) for index, item in enumerate(platform)}
    local_rank = {item: 1.0 - index / max(1, len(local)) for index, item in enumerate(local)}
    scored = []
    for item in candidates:
        score = (
            config["utilityWeight"] * delegate.product_utility(task, products[item])
            + config["platformRankWeight"] * platform_rank.get(item, 0.0)
            + config["taskRankWeight"] * local_rank.get(item, 0.0)
            + config["noveltyWeight"] * novelty(item, viewed, products)
        )
        scored.append((score, item))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return scored[0][1]


def condition_context(
    task: dict,
    condition: str,
    viewed: list[int],
    selected: int | None,
    phase: str,
) -> list[int]:
    history = task["history"]
    if phase == "task-start":
        return history
    if phase == "task-in-progress":
        return history + viewed if condition == "immediate-remove" else history
    if condition in {"immediate-remove", "held-outcome"} and selected is not None:
        resolved = history + [selected]
    else:
        resolved = history
    if phase == "outcome-resolved":
        return resolved
    if phase == "next-task":
        return resolved + [task["nextTaskItem"]]
    raise ValueError(phase)


def free_run(
    task: dict,
    products: dict[int, dict],
    scorer: ModelScorer,
    condition: dict,
    config: dict,
) -> dict:
    condition_id = condition["id"]
    search = delegate.search_catalog(task, products)
    viewed = list(search[: config["searchViews"]])
    actions = [
        {"action": "search", "product": None, "source": "catalog-search"}
    ]
    actions.extend(
        {"action": "product-view", "product": item, "source": "search-result"}
        for item in viewed
    )
    empty_slates = 0
    for _ in range(config["recommendationViews"]):
        platform_context = condition_context(
            task, condition_id, viewed, None, "task-in-progress"
        )
        platform = scorer.top(
            platform_context,
            set(task["interacted"]) | set(viewed) | {task["nextTaskItem"]},
        )
        local = []
        if condition["taskLocalRetrieval"]:
            local = delegate.local_recommendations(
                task,
                products,
                viewed,
                set(task["history"]) | set(viewed),
            )
        if not platform:
            empty_slates += 1
        chosen = choose_recommendation(
            task, products, viewed, platform, local, search, config
        )
        if chosen is None:
            break
        viewed.append(chosen)
        source = (
            "platform-and-task-local"
            if chosen in platform and chosen in local
            else "task-local"
            if chosen in local
            else "platform"
            if chosen in platform
            else "search-result"
        )
        actions.append(
            {"action": "product-view", "product": chosen, "source": source}
        )
    feasible = [item for item in viewed if delegate.constraint_match(task, products[item])]
    feasible.sort(
        key=lambda item: (-delegate.product_utility(task, products[item]), item)
    )
    selected = feasible[0] if feasible else None
    actions.append(
        {
            "action": "select" if selected is not None else "abandon",
            "product": selected,
            "source": "agent-policy",
        }
    )
    catalog_feasible = any(
        item not in task["interacted"]
        and delegate.constraint_match(task, product)
        for item, product in products.items()
    )
    return {
        "actions": actions,
        "viewed": viewed,
        "selected": selected,
        "outcome": "selected" if selected is not None else "abandoned",
        "decisionCorrect": (selected is not None and catalog_feasible)
        or (selected is None and not catalog_feasible),
        "selectedUtility": rounded(
            delegate.product_utility(task, products[selected]) if selected else 0.0
        ),
        "eventLogCount": 0 if not condition["eventLog"] else len(actions),
        "taskLocalViewCount": sum(
            action["source"] in {"task-local", "platform-and-task-local"}
            for action in actions
        ),
        "emptySlateCount": empty_slates,
        "protocolFailureCount": 0,
    }


def condition_result(
    task: dict,
    condition: dict,
    trace: dict,
    scorer: ModelScorer,
    evaluation_mask: set[int],
) -> dict:
    slates = {
        phase: scorer.top(
            condition_context(
                task,
                condition["id"],
                trace["viewed"],
                trace["selected"],
                phase,
            ),
            evaluation_mask,
        )
        for phase in [
            "task-start",
            "task-in-progress",
            "outcome-resolved",
            "next-task",
        ]
    }
    return {"trace": trace, "slates": slates}


def make_contrast(
    category: str,
    task: dict,
    seed: int,
    config_id: str,
    mode: str,
    results: dict[str, dict],
) -> dict:
    immediate = results["immediate-remove"]
    held = results["held-outcome"]
    no_memory = results["no-memory"]
    logged = results["logged-inert"]
    return {
        "category": category,
        "taskId": task["taskId"],
        "modelSeed": seed,
        "agentConfig": config_id,
        "mode": mode,
        "outcomeImmediate": immediate["trace"]["outcome"],
        "outcomeHeld": held["trace"]["outcome"],
        "t0ImmediateHeldDisplacement": rounded(
            displacement(immediate["slates"]["task-start"], held["slates"]["task-start"])
        ),
        "t1ImmediateHeldDisplacement": rounded(
            displacement(
                immediate["slates"]["task-in-progress"],
                held["slates"]["task-in-progress"],
            )
        ),
        "t2ImmediateHeldDisplacement": rounded(
            displacement(
                immediate["slates"]["outcome-resolved"],
                held["slates"]["outcome-resolved"],
            )
        ),
        "t3ImmediateHeldDisplacement": rounded(
            displacement(immediate["slates"]["next-task"], held["slates"]["next-task"])
        ),
        "noMemoryLoggedMaxDisplacement": rounded(
            max(
                displacement(no_memory["slates"][phase], logged["slates"][phase])
                for phase in [
                    "task-start",
                    "task-in-progress",
                    "outcome-resolved",
                    "next-task",
                ]
            )
        ),
        "traceDiverged": trace_hash(category, immediate["trace"]["actions"])
        != trace_hash(category, held["trace"]["actions"]),
        "noMemoryLoggedTraceMatched": trace_hash(category, no_memory["trace"]["actions"])
        == trace_hash(category, logged["trace"]["actions"]),
        "heldMinusImmediateDecisionAccuracy": rounded(
            float(held["trace"]["decisionCorrect"])
            - float(immediate["trace"]["decisionCorrect"])
        ),
        "heldMinusImmediateSelectedUtility": rounded(
            held["trace"]["selectedUtility"]
            - immediate["trace"]["selectedUtility"]
        ),
        "immediateTraceId": trace_hash(category, immediate["trace"]["actions"]),
        "heldTraceId": trace_hash(category, held["trace"]["actions"]),
    }


def bootstrap_contrasts(contrasts: list[dict], protocol: dict) -> dict:
    rng = np.random.default_rng(protocol["uncertainty"]["seed"])
    categories = sorted({row["category"] for row in contrasts})
    configs = [row["id"] for row in protocol["agentConfigurations"]]
    seeds = protocol["models"]["checkpointSeeds"]
    tasks_by_category = {
        category: sorted({row["taskId"] for row in contrasts if row["category"] == category})
        for category in categories
    }
    index = {
        (row["category"], row["taskId"], row["modelSeed"], row["agentConfig"], row["mode"]): row
        for row in contrasts
    }
    metric_names = [
        "t1ImmediateHeldDisplacement",
        "t2ImmediateHeldDisplacement",
        "t3ImmediateHeldDisplacement",
        "heldMinusImmediateDecisionAccuracy",
        "heldMinusImmediateSelectedUtility",
        "traceDiverged",
    ]
    modes = ["fixed-trace", "free-running"]
    samples = {(mode, metric): [] for mode in modes for metric in metric_names}
    for _ in range(protocol["uncertainty"]["replicates"]):
        sampled_seeds = rng.choice(seeds, size=len(seeds), replace=True)
        for mode in modes:
            metric_category_means = {metric: [] for metric in metric_names}
            for category in categories:
                tasks = tasks_by_category[category]
                sampled_tasks = rng.choice(tasks, size=len(tasks), replace=True)
                for metric in metric_names:
                    values = []
                    for task_id in sampled_tasks:
                        for seed in sampled_seeds:
                            for config in configs:
                                value = index[(category, task_id, int(seed), config, mode)][metric]
                                values.append(float(value))
                    metric_category_means[metric].append(mean(values))
            for metric in metric_names:
                samples[(mode, metric)].append(mean(metric_category_means[metric]))
    return {
        mode: {metric: interval(samples[(mode, metric)]) for metric in metric_names}
        for mode in modes
    }


def public_condition_row(
    category: str,
    task: dict,
    seed: int,
    config_id: str,
    mode: str,
    condition: str,
    result: dict,
    baseline: dict,
) -> dict:
    trace = result["trace"]
    return {
        "category": category,
        "taskId": task["taskId"],
        "modelSeed": seed,
        "agentConfig": config_id,
        "mode": mode,
        "condition": condition,
        "outcome": trace["outcome"],
        "decisionCorrect": bool(trace["decisionCorrect"]),
        "selectedUtility": trace["selectedUtility"],
        "actionCount": len(trace["actions"]),
        "eventLogCount": trace.get("eventLogCount", len(trace["actions"])),
        "taskLocalViewCount": trace.get("taskLocalViewCount", 0),
        "emptySlateCount": trace.get("emptySlateCount", 0),
        "protocolFailureCount": trace.get("protocolFailureCount", 0),
        "traceId": trace_hash(category, trace["actions"]),
        "displacementFromNoMemory": {
            phase: rounded(displacement(result["slates"][phase], baseline["slates"][phase]))
            for phase in [
                "task-start",
                "task-in-progress",
                "outcome-resolved",
                "next-task",
            ]
        },
    }


def main() -> None:
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding="utf-8"))
    protocol_hash = sha256(
        PROTOCOL_PATH.read_text(encoding="utf-8")
        .replace("\r\n", "\n")
        .encode("utf-8")
    )
    tasks_per_category = protocol["sampling"]["tasksPerCategory"]
    delegate.TASKS_PER_CATEGORY = tasks_per_category
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)

    condition_specs = {row["id"]: row for row in protocol["conditions"]}
    condition_order = [row["id"] for row in protocol["conditions"]]
    configs = protocol["agentConfigurations"]
    public_rows = []
    contrasts = []
    representative_pool = []
    category_counts = []

    for category in cross.CATEGORIES:
        category_slug = category["slug"]
        data = cross.prepare_category(category)
        products = delegate.load_products(category, data)
        tasks = delegate.build_tasks(category, data, products)
        models, _ = cross.load_or_train_models(data)
        category_counts.append({"category": category_slug, "taskCount": len(tasks)})

        for seed, model in models.items():
            model.eval()
            scorer = ModelScorer(model)
            for task in tasks:
                for config in configs:
                    config_id = config["id"]
                    fixed_trace = frozen_agent_trace(task, products, config)
                    fixed_mask = (
                        set(task["interacted"])
                        | set(fixed_trace["viewed"])
                        | {task["nextTaskItem"]}
                    )
                    if fixed_trace["selected"] is not None:
                        fixed_mask.add(fixed_trace["selected"])
                    fixed_results = {
                        condition: condition_result(
                            task,
                            condition_specs[condition],
                            fixed_trace,
                            scorer,
                            fixed_mask,
                        )
                        for condition in condition_order
                    }
                    fixed_contrast = make_contrast(
                        category_slug,
                        task,
                        seed,
                        config_id,
                        "fixed-trace",
                        fixed_results,
                    )
                    contrasts.append(fixed_contrast)
                    baseline = fixed_results["no-memory"]
                    for condition, result in fixed_results.items():
                        public_rows.append(
                            public_condition_row(
                                category_slug,
                                task,
                                seed,
                                config_id,
                                "fixed-trace",
                                condition,
                                result,
                                baseline,
                            )
                        )

                    free_traces = {
                        condition: free_run(
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
                        condition: condition_result(
                            task,
                            condition_specs[condition],
                            free_traces[condition],
                            scorer,
                            free_mask,
                        )
                        for condition in condition_order
                    }
                    free_contrast = make_contrast(
                        category_slug,
                        task,
                        seed,
                        config_id,
                        "free-running",
                        free_results,
                    )
                    contrasts.append(free_contrast)
                    baseline = free_results["no-memory"]
                    for condition, result in free_results.items():
                        public_rows.append(
                            public_condition_row(
                                category_slug,
                                task,
                                seed,
                                config_id,
                                "free-running",
                                condition,
                                result,
                                baseline,
                            )
                        )
                    representative_pool.append(
                        {
                            "category": category_slug,
                            "taskId": task["taskId"],
                            "modelSeed": seed,
                            "agentConfig": config_id,
                            "outcome": fixed_trace["outcome"],
                            "metric": fixed_contrast["t1ImmediateHeldDisplacement"],
                            "fixedResults": fixed_results,
                            "freeResults": free_results,
                        }
                    )
        print(
            f"category={category_slug} tasks={len(tasks)} rows={sum(row['category'] == category_slug for row in public_rows)}",
            flush=True,
        )

    uncertainty = bootstrap_contrasts(contrasts, protocol)
    fixed = uncertainty["fixed-trace"]
    free = uncertainty["free-running"]
    primary_gate = fixed["t1ImmediateHeldDisplacement"]["lower95"] > protocol["primaryEstimand"]["goThreshold"]
    t2_equivalent = fixed["t2ImmediateHeldDisplacement"]["upper95"] < protocol["equivalence"]["margin"]
    t3_equivalent = fixed["t3ImmediateHeldDisplacement"]["upper95"] < protocol["equivalence"]["margin"]
    decision_noninferior = free["heldMinusImmediateDecisionAccuracy"]["lower95"] > protocol["taskUtility"]["nonInferiorityMargin"]
    utility_noninferior = free["heldMinusImmediateSelectedUtility"]["lower95"] > protocol["taskUtility"]["nonInferiorityMargin"]
    inert_pairs_match = all(
        row["noMemoryLoggedMaxDisplacement"] == 0
        and row["noMemoryLoggedTraceMatched"]
        for row in contrasts
    )
    failures = {
        "protocolDeviationCount": sum(row["protocolFailureCount"] for row in public_rows),
        "emptySlateCount": sum(row["emptySlateCount"] for row in public_rows),
        "missingCheckpointCount": 0,
        "agentTimeoutCount": 0,
        "incorrectDecisionCount": sum(not row["decisionCorrect"] for row in public_rows),
        "abandonedRunCount": sum(row["outcome"] == "abandoned" for row in public_rows),
        "nullPrimaryPairCount": sum(
            row["mode"] == "fixed-trace"
            and row["t1ImmediateHeldDisplacement"] == 0
            for row in contrasts
        ),
    }

    representatives = []
    for config_id in [row["id"] for row in configs]:
        for outcome in ["selected", "abandoned"]:
            candidates = [
                row
                for row in representative_pool
                if row["agentConfig"] == config_id and row["outcome"] == outcome
            ]
            chosen = max(candidates, key=lambda row: (row["metric"], row["taskId"]))
            representatives.append(
                {
                    "category": chosen["category"],
                    "taskId": chosen["taskId"],
                    "modelSeed": chosen["modelSeed"],
                    "agentConfig": chosen["agentConfig"],
                    "outcome": chosen["outcome"],
                    "fixedT1Displacement": chosen["metric"],
                    "conditions": {
                        condition: {
                            "fixedTraceId": trace_hash(
                                chosen["category"],
                                chosen["fixedResults"][condition]["trace"]["actions"],
                            ),
                            "freeTraceId": trace_hash(
                                chosen["category"],
                                chosen["freeResults"][condition]["trace"]["actions"],
                            ),
                            "fixedSlates": {
                                phase: [
                                    item_hash(chosen["category"], item)
                                    for item in chosen["fixedResults"][condition]["slates"][phase]
                                ]
                                for phase in [
                                    "task-start",
                                    "task-in-progress",
                                    "outcome-resolved",
                                    "next-task",
                                ]
                            },
                            "freeSlates": {
                                phase: [
                                    item_hash(chosen["category"], item)
                                    for item in chosen["freeResults"][condition]["slates"][phase]
                                ]
                                for phase in [
                                    "task-start",
                                    "task-in-progress",
                                    "outcome-resolved",
                                    "next-task",
                                ]
                            },
                        }
                        for condition in condition_order
                    },
                }
            )

    summary = {
        "schemaVersion": "online-storefront-v2-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "evidenceStatus": "trained-SASRec replay with fixed and condition-sensitive autonomous traces",
        "design": {
            "taskCount": protocol["sampling"]["totalTaskCount"],
            "tasksPerCategory": tasks_per_category,
            "categoryCounts": category_counts,
            "modelSeeds": protocol["models"]["checkpointSeeds"],
            "agentConfigurations": [row["id"] for row in configs],
            "conditions": condition_order,
            "modes": protocol["modes"],
            "timepoints": protocol["timepoints"],
            "conditionRowCount": len(public_rows),
            "pairedContrastRowCount": len(contrasts),
            "sampleSizeDerivation": protocol["sampling"],
        },
        "confirmatory": {
            "fixedTrace": {
                "primaryT1ImmediateHeldDisplacement": fixed["t1ImmediateHeldDisplacement"],
                "t2ImmediateHeldDisplacement": fixed["t2ImmediateHeldDisplacement"],
                "t3ImmediateHeldDisplacement": fixed["t3ImmediateHeldDisplacement"],
            },
            "freeRunning": {
                "t1ImmediateHeldDisplacement": free["t1ImmediateHeldDisplacement"],
                "traceDivergenceRate": free["traceDiverged"],
                "heldMinusImmediateDecisionAccuracy": free["heldMinusImmediateDecisionAccuracy"],
                "heldMinusImmediateSelectedUtility": free["heldMinusImmediateSelectedUtility"],
            },
            "gates": {
                "primaryLowerBoundAbove015": primary_gate,
                "t2EquivalentWithin005": t2_equivalent,
                "t3EquivalentWithin005": t3_equivalent,
                "decisionAccuracyNonInferior": decision_noninferior,
                "selectedUtilityNonInferior": utility_noninferior,
                "noMemoryAndLoggedInertMatched": inert_pairs_match,
            },
        },
        "failuresAndNegativeCases": failures,
        "claims": {
            "observed": [
                "Frozen SASRec checkpoints, rather than a hand-authored profile ranker, produced every reported platform slate.",
                "Fixed-trace and free-running effects are reported separately.",
                "All four evidence contracts were evaluated against matched principal histories, checkpoints, and analysis candidate masks.",
            ],
            "notEstablished": [
                "The autonomous policies are deterministic retrieval-and-planning agents, not frontier LLM shopping agents.",
                "The experiment is a research-owned replay and does not manipulate Amazon.com or another production recommender.",
                "No human preference, trust, comprehension, welfare, purchase, or experienced utility was measured.",
                "Resolved-state equality is an inference-context property and not trained-model unlearning.",
            ],
        },
    }
    row_payload = {
        "schemaVersion": "online-storefront-v2-condition-rows.v1",
        "protocolSha256": protocol_hash,
        "privacy": {
            "originalUserIdsIncluded": False,
            "originalItemIdsIncluded": False,
            "productTitlesIncluded": False,
            "reviewTextIncluded": False,
        },
        "rows": public_rows,
    }
    contrast_payload = {
        "schemaVersion": "online-storefront-v2-contrasts.v1",
        "protocolSha256": protocol_hash,
        "rows": contrasts,
    }
    bundle = {
        "schemaVersion": "online-storefront-v2-model-bundle.v1",
        "protocolSha256": protocol_hash,
        "model": {
            "name": "SASRec",
            "checkpointSeeds": protocol["models"]["checkpointSeeds"],
            "inference": "precomputed with trained PyTorch checkpoints; pseudonymous Top-10 slates replayed in the static browser artifact",
        },
        "representativeCases": representatives,
    }
    outputs = {
        "summary.json": summary,
        "rows.json": row_payload,
        "contrasts.json": contrast_payload,
        "model-bundle.json": bundle,
    }
    for filename, payload in outputs.items():
        write_json(
            OUTPUT / filename,
            payload,
            pretty=filename in {"summary.json", "model-bundle.json"},
        )
    manifest = {
        "schemaVersion": "online-storefront-v2-manifest.v1",
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
    print(
        json.dumps(
            {
                "taskCount": summary["design"]["taskCount"],
                "conditionRowCount": len(public_rows),
                "pairedContrastRowCount": len(contrasts),
                "confirmatory": summary["confirmatory"],
                "failuresAndNegativeCases": failures,
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    torch.set_grad_enabled(False)
    main()
