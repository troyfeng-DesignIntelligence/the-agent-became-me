"""Generate shopping-agent traces and audit recommendation activation timing.

The agent acts over a frozen local storefront backed by Amazon Reviews 2018
metadata. Raw reviewer IDs, ASINs, titles, and model checkpoints stay under
ignored artifacts/. Public outputs contain domain-separated hashes and derived
metrics only.

This is an autonomous retrieval-and-planning agent, not an LLM. It receives a
task, searches the catalog, opens results, consumes task-local recommendations,
compares observed candidates, and either selects one or abandons the task.
The same realized trace is replayed through two platform evidence contracts so
that activation timing is isolated from agent behavior generation.
"""

from __future__ import annotations

import hashlib
import html
import importlib.util
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/results/delegated-activation/v1"
EVIDENCE = ROOT / "public/evidence/delegated-activation/v1"
EXPERIMENT = ROOT / "experiments/delegated-activation"
TASKS_PER_CATEGORY = 80
BOOTSTRAP_REPLICATES = 2000
BOOTSTRAP_SEED = 20260805
TOP_K = 10
SEARCH_LIMIT = 10
LOCAL_RECOMMENDATION_LIMIT = 6
PUBLIC_SLATE_LIMIT = 5
LIFECYCLES = ["immediate-then-resolve", "hold-until-resolved"]
TIMEPOINTS = ["task-start", "task-in-progress", "outcome-resolved", "next-task"]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cross = load_module("amazon_cross_category", ROOT / "scripts/run-amazon-cross-category.py")
sas = cross.sas


def rounded(value: float) -> float:
    return round(float(value), 6)


def mean(values) -> float:
    rows = list(values)
    return float(sum(rows) / len(rows)) if rows else 0.0


def public_hash(kind: str, *parts: object) -> str:
    value = "|".join(["delegated-activation-v1", kind, *map(str, parts)])
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def item_hash(category: str, item: int) -> str:
    return public_hash("item", category, item)[:8].upper()


def parse_price(value: object) -> float | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"\s*\$?([0-9]+(?:\.[0-9]{1,2})?)\s*", value)
    if not match:
        return None
    price = float(match.group(1))
    return price if 0 < price < 100000 else None


def clean_text(value: object) -> str:
    if isinstance(value, list):
        value = " ".join(str(part) for part in value[:8])
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def load_products(category: dict, data: dict) -> dict[int, dict]:
    directory = ROOT / f"artifacts/datasets/amazon-{category['slug']}-2018"
    review_path = directory / f"{category['file']}_5.json.gz"
    metadata_path = directory / f"meta_{category['file']}.json.gz"
    raw_items = sorted({event["asin"] for event in sas.load_json_lines(review_path)})
    item_index = {raw_item: index + 1 for index, raw_item in enumerate(raw_items)}
    records: dict[int, dict] = {}
    for metadata in sas.load_json_lines(metadata_path):
        raw_item = metadata.get("asin")
        if raw_item not in item_index:
            continue
        index = item_index[raw_item]
        if index in records and records[index]["title"]:
            continue
        title = clean_text(metadata.get("title"))
        brand = clean_text(metadata.get("brand"))
        description = clean_text(metadata.get("description"))
        features = clean_text(metadata.get("feature"))
        categories = clean_text(metadata.get("category"))
        # Match the frozen Amazon product-family protocol exactly. Brand,
        # category, and feature text remain available to the private agent
        # environment but cannot silently expand the public task family.
        tokens = sas.title_tokens(title)
        records[index] = {
            "title": title,
            "brand": brand,
            "description": description,
            "features": features,
            "tokens": tokens,
            "price": parse_price(metadata.get("price")),
            "popularity": int(data["interactionCounts"].get(index, 0)),
        }
    for item in range(1, data["itemCount"] + 1):
        records.setdefault(
            item,
            {
                "title": "",
                "brand": "",
                "description": "",
                "features": "",
                "tokens": set(),
                "price": None,
                "popularity": int(data["interactionCounts"].get(item, 0)),
            },
        )
    return records


def choose_attribute_token(family: str, items: list[int], products: dict[int, dict]) -> str | None:
    support = Counter(
        token
        for item in items
        for token in products[item]["tokens"]
        if token != family and token not in sas.STOPWORDS
    )
    candidates = [
        (count, token)
        for token, count in support.items()
        if 3 <= count <= max(4, len(items) // 2)
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda row: (-row[0], row[1]))
    return candidates[0][1]


def build_tasks(category: dict, data: dict, products: dict[int, dict]) -> list[dict]:
    cases_by_user: dict[str, list[dict]] = defaultdict(list)
    for case in data["taskCases"]:
        cases_by_user[case["user"]].append(case)
    tasks = []
    ordered_users = sorted(
        cases_by_user,
        key=lambda user: sas.stable_int("delegate-task", category["slug"], user),
    )
    for user in ordered_users:
        cases = sorted(cases_by_user[user], key=lambda case: sas.SIMILARITY_BANDS.index(case["band"]))
        case = cases[len(tasks) % len(cases)]
        family = case["family"]
        unseen = [
            item
            for item in data["familyItems"][family]
            if item not in data["interacted"][user] and products[item]["title"]
        ]
        attribute = choose_attribute_token(family, unseen, products)
        if attribute is None:
            continue
        matching = [item for item in unseen if attribute in products[item]["tokens"]]
        if len(matching) < 3:
            continue
        outcome_plan = "feasible-selection" if len(tasks) % 2 == 0 else "infeasible-budget"
        priced = sorted(
            products[item]["price"]
            for item in matching
            if products[item]["price"] is not None
        )
        if outcome_plan == "infeasible-budget" and len(priced) < 3:
            continue
        budget = None
        if outcome_plan == "feasible-selection" and priced:
            budget = float(np.quantile(np.asarray(priced), 0.75))
        elif outcome_plan == "infeasible-budget":
            budget = max(0.01, priced[0] * 0.70)
        task_id = public_hash("task", category["slug"], user, case["band"], outcome_plan)
        tasks.append(
            {
                "taskId": task_id,
                "user": user,
                "category": category["slug"],
                "categoryLabel": category["label"],
                "history": case["history"],
                "nextTaskItem": data["test"][user],
                "interacted": data["interacted"][user],
                "similarityBand": case["band"],
                "measuredTaskSimilarity": case["similarity"],
                "family": family,
                "attribute": attribute,
                "budget": budget,
                "outcomePlan": outcome_plan,
            }
        )
        if len(tasks) >= TASKS_PER_CATEGORY:
            break
    if len(tasks) < TASKS_PER_CATEGORY:
        raise RuntimeError(
            f"{category['label']} produced only {len(tasks)} eligible delegated tasks"
        )
    return tasks


def constraint_match(task: dict, product: dict) -> bool:
    price_ok = task["budget"] is None or (
        product["price"] is not None and product["price"] <= task["budget"]
    )
    return (
        task["family"] in product["tokens"]
        and task["attribute"] in product["tokens"]
        and price_ok
    )


def product_utility(task: dict, product: dict) -> float:
    family = 1.0 if task["family"] in product["tokens"] else 0.0
    attribute = 1.0 if task["attribute"] in product["tokens"] else 0.0
    if task["budget"] is None:
        price = 1.0
    elif product["price"] is None:
        price = 0.0
    elif product["price"] <= task["budget"]:
        price = 1.0
    else:
        price = max(0.0, task["budget"] / product["price"])
    return 0.45 * family + 0.35 * attribute + 0.20 * price


def search_catalog(task: dict, products: dict[int, dict]) -> list[int]:
    query = {task["family"], task["attribute"]}
    candidates = []
    for item, product in products.items():
        if item in task["interacted"] or not product["title"]:
            continue
        overlap = len(query.intersection(product["tokens"]))
        if overlap == 0:
            continue
        score = overlap * 5.0 + math.log1p(product["popularity"]) * 0.15
        candidates.append((score, item))
    candidates.sort(key=lambda row: (-row[0], row[1]))
    return [item for _, item in candidates[:SEARCH_LIMIT]]


def local_recommendations(
    task: dict,
    products: dict[int, dict],
    viewed: list[int],
    excluded: set[int],
) -> list[int]:
    viewed_tokens = set().union(*(products[item]["tokens"] for item in viewed)) if viewed else set()
    candidates = []
    for item, product in products.items():
        if item in excluded or not product["title"]:
            continue
        task_match = (
            (1 if task["family"] in product["tokens"] else 0)
            + (1 if task["attribute"] in product["tokens"] else 0)
        )
        if task_match == 0:
            continue
        union = viewed_tokens.union(product["tokens"])
        similarity = len(viewed_tokens.intersection(product["tokens"])) / len(union) if union else 0
        score = (
            product_utility(task, product) * 6.0
            + task_match * 1.5
            + similarity * 2.0
            + math.log1p(product["popularity"]) * 0.10
        )
        candidates.append((score, item))
    candidates.sort(key=lambda row: (-row[0], row[1]))
    return [item for _, item in candidates[:LOCAL_RECOMMENDATION_LIMIT]]


def run_agent(task: dict, products: dict[int, dict], task_local: bool = True) -> dict:
    search_results = search_catalog(task, products)
    actions = [
        {
            "step": 0,
            "action": "search",
            "observationCount": len(search_results),
            "source": "catalog-search",
            "product": None,
        }
    ]
    viewed: list[int] = []
    for item in search_results[:2]:
        viewed.append(item)
        actions.append(
            {
                "step": len(actions),
                "action": "product-view",
                "source": "search-result",
                "product": item,
                "constraintMatch": constraint_match(task, products[item]),
                "utility": rounded(product_utility(task, products[item])),
            }
        )
    local_results: list[int] = []
    if task_local and viewed:
        excluded = set(task["history"]) | set(viewed)
        local_results = local_recommendations(task, products, viewed, excluded)
        actions.append(
            {
                "step": len(actions),
                "action": "request-task-recommendations",
                "source": "task-local-state",
                "observationCount": len(local_results),
                "product": None,
            }
        )
        for item in local_results[:2]:
            viewed.append(item)
            actions.append(
                {
                    "step": len(actions),
                    "action": "product-view",
                    "source": "task-local-recommendation",
                    "product": item,
                    "constraintMatch": constraint_match(task, products[item]),
                    "utility": rounded(product_utility(task, products[item])),
                }
            )
    observed = sorted(set(viewed), key=lambda item: (-product_utility(task, products[item]), item))
    actions.append(
        {
            "step": len(actions),
            "action": "compare",
            "source": "agent-planner",
            "observationCount": len(observed),
            "product": None,
        }
    )
    feasible = [item for item in observed if constraint_match(task, products[item])]
    selected = feasible[0] if feasible else None
    outcome = "selected" if selected is not None else "abandoned"
    actions.append(
        {
            "step": len(actions),
            "action": "select" if selected is not None else "abandon",
            "source": "agent-planner",
            "product": selected,
            "decisionReason": "constraints-satisfied" if selected is not None else "no-observed-item-satisfied-constraints",
        }
    )
    catalog_feasible = any(
        item not in task["interacted"] and constraint_match(task, product)
        for item, product in products.items()
    )
    decision_correct = (
        (selected is not None and catalog_feasible)
        or (selected is None and not catalog_feasible)
    )
    return {
        "actions": actions,
        "viewed": viewed,
        "selected": selected,
        "outcome": outcome,
        "catalogFeasible": catalog_feasible,
        "decisionCorrect": decision_correct,
        "selectedUtility": rounded(product_utility(task, products[selected])) if selected else 0.0,
        "stepCount": len(actions),
        "taskLocalRecommendationCount": len(local_results),
        "taskLocalViewCount": sum(action.get("source") == "task-local-recommendation" for action in actions),
    }


def batched_scores(model, contexts: list[list[int]], batch_size: int = 256) -> np.ndarray:
    batches = []
    for start in range(0, len(contexts), batch_size):
        batches.append(sas.score_context_batch(model, contexts[start : start + batch_size]))
    return np.concatenate(batches, axis=0)


def ranked_top(scores: np.ndarray, masked: set[int]) -> list[int]:
    return sas.top_all(scores, masked, TOP_K)


def displacement(left: list[int], right: list[int]) -> float:
    return 1.0 - len(set(left).intersection(right)) / TOP_K


def family_slots(top: list[int], family: str, tokens_by_item: dict[int, set[str]]) -> int:
    return sum(family in tokens_by_item.get(item, set()) for item in top)


def run_model_rows(category: dict, data: dict, tasks: list[dict], models: dict) -> tuple[list[dict], list[dict]]:
    rows = []
    representatives = []
    category_slug = category["slug"]
    for seed, model in models.items():
        model.eval()
        contexts = []
        descriptors = []
        for task in tasks:
            trace = task["agent"]
            event_items = [
                action["product"]
                for action in trace["actions"]
                if action["action"] == "product-view" and action["product"] is not None
            ]
            final_context = task["history"] + ([trace["selected"]] if trace["selected"] is not None else [])
            next_context = final_context + [task["nextTaskItem"]]
            task_contexts = {
                "baseline": task["history"],
                "in-progress-immediate": task["history"] + event_items,
                "resolved": final_context,
                "next-task": next_context,
            }
            for label, context in task_contexts.items():
                descriptors.append((task["taskId"], label))
                contexts.append(context)
            for prefix in range(1, len(event_items) + 1):
                descriptors.append((task["taskId"], f"prefix-{prefix}"))
                contexts.append(task["history"] + event_items[:prefix])
        scores = batched_scores(model, contexts)
        score_map = {descriptor: scores[index] for index, descriptor in enumerate(descriptors)}
        for task in tasks:
            trace = task["agent"]
            event_items = [
                action["product"]
                for action in trace["actions"]
                if action["action"] == "product-view" and action["product"] is not None
            ]
            masked = set(task["history"]) | set(event_items) | {task["nextTaskItem"]}
            if trace["selected"] is not None:
                masked.add(trace["selected"])
            baseline_top = ranked_top(score_map[(task["taskId"], "baseline")], masked)
            progress_top = ranked_top(score_map[(task["taskId"], "in-progress-immediate")], masked)
            resolved_top = ranked_top(score_map[(task["taskId"], "resolved")], masked)
            next_top = ranked_top(score_map[(task["taskId"], "next-task")], masked)
            prefix_displacements = []
            first_affected = None
            for prefix in range(1, len(event_items) + 1):
                prefix_top = ranked_top(score_map[(task["taskId"], f"prefix-{prefix}")], masked)
                value = displacement(prefix_top, baseline_top)
                prefix_displacements.append(value)
                if first_affected is None and value > 0:
                    first_affected = prefix
            row = {
                "category": category_slug,
                "taskId": task["taskId"],
                "modelSeed": seed,
                "outcome": trace["outcome"],
                "plannedFeasibility": task["outcomePlan"],
                "similarityBand": task["similarityBand"],
                "measuredTaskSimilarity": rounded(task["measuredTaskSimilarity"]),
                "agentEventCount": len(event_items),
                "agentStepCount": trace["stepCount"],
                "agentDecisionCorrect": 1 if trace["decisionCorrect"] else 0,
                "agentSelectedUtility": trace["selectedUtility"],
                "taskLocalViewCount": trace["taskLocalViewCount"],
                "stagedMinusImmediateTaskUtility": 0.0,
                "provisionalExposureAuc": rounded(mean(prefix_displacements)),
                "firstAffectedAction": first_affected,
                "taskStartDisplacementAt10": 0.0,
                "inProgressDisplacementAt10": rounded(displacement(progress_top, baseline_top)),
                "inProgressImmediateTargetSlotsAt10": family_slots(progress_top, task["family"], data["tokensByItem"]),
                "inProgressStagedTargetSlotsAt10": family_slots(baseline_top, task["family"], data["tokensByItem"]),
                "inProgressExcessTargetSlotsAt10": family_slots(progress_top, task["family"], data["tokensByItem"]) - family_slots(baseline_top, task["family"], data["tokensByItem"]),
                "outcomeResolvedDisplacementAt10": 0.0,
                "nextTaskDisplacementAt10": 0.0,
            }
            rows.append(row)
            representatives.append(
                {
                    "category": category_slug,
                    "taskId": task["taskId"],
                    "modelSeed": seed,
                    "outcome": trace["outcome"],
                    "metric": row["inProgressDisplacementAt10"],
                    "slates": {
                        "immediate-then-resolve": {
                            "task-start": baseline_top,
                            "task-in-progress": progress_top,
                            "outcome-resolved": resolved_top,
                            "next-task": next_top,
                        },
                        "hold-until-resolved": {
                            "task-start": baseline_top,
                            "task-in-progress": baseline_top,
                            "outcome-resolved": resolved_top,
                            "next-task": next_top,
                        },
                    },
                }
            )
    return rows, representatives


def interval(values) -> dict:
    array = np.asarray(list(values), dtype=np.float64)
    return {
        "estimate": rounded(float(np.mean(array))),
        "lower95": rounded(float(np.quantile(array, 0.025))),
        "upper95": rounded(float(np.quantile(array, 0.975))),
        "positiveProbability": rounded(float(np.mean(array > 0))),
    }


def bootstrap_category(rows: list[dict], category: str, rng) -> dict:
    selected = [row for row in rows if row["category"] == category]
    seeds = sorted({row["modelSeed"] for row in selected})
    tasks = sorted({row["taskId"] for row in selected})
    seed_index = {seed: index for index, seed in enumerate(seeds)}
    task_index = {task: index for index, task in enumerate(tasks)}
    shape = (len(seeds), len(tasks))
    metrics = {
        "auc": np.full(shape, np.nan),
        "progress": np.full(shape, np.nan),
        "slots": np.full(shape, np.nan),
    }
    for row in selected:
        index = seed_index[row["modelSeed"]], task_index[row["taskId"]]
        metrics["auc"][index] = row["provisionalExposureAuc"]
        metrics["progress"][index] = row["inProgressDisplacementAt10"]
        metrics["slots"][index] = row["inProgressExcessTargetSlotsAt10"]
    if any(np.isnan(values).any() for values in metrics.values()):
        raise RuntimeError(f"Incomplete task/seed cube for {category}")
    samples = defaultdict(list)
    for _ in range(BOOTSTRAP_REPLICATES):
        sampled_seeds = rng.integers(0, len(seeds), len(seeds))
        sampled_tasks = rng.integers(0, len(tasks), len(tasks))
        for key, values in metrics.items():
            samples[key].append(float(values[np.ix_(sampled_seeds, sampled_tasks)].mean()))
    return {key: np.asarray(values) for key, values in samples.items()}


def public_action(category: str, action: dict) -> dict:
    payload = {
        "step": action["step"],
        "action": action["action"],
        "source": action["source"],
    }
    if action.get("product") is not None:
        payload["productId"] = item_hash(category, action["product"])
    if "observationCount" in action:
        payload["observationCount"] = action["observationCount"]
    if "constraintMatch" in action:
        payload["constraintMatch"] = action["constraintMatch"]
    if "utility" in action:
        payload["utility"] = action["utility"]
    if "decisionReason" in action:
        payload["decisionReason"] = action["decisionReason"]
    return payload


def draw_timeline(case: dict, path: Path) -> None:
    image = Image.new("RGB", (1800, 760), "#ede8de")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((56, 38), f"DELEGATE-EVIDENCE ACTIVATION / {case['outcome'].upper()} TASK", fill="#202426", font=font)
    draw.text((56, 66), f"case {case['taskId'][:10]}  /  category {case['category']}  /  SASRec seed {case['modelSeed']}", fill="#696b68", font=font)
    left = 270
    cell_width = 365
    for column, timepoint in enumerate(TIMEPOINTS):
        x = left + column * cell_width
        draw.text((x, 120), timepoint.replace("-", " ").upper(), fill="#202426", font=font)
        draw.line((x, 142, x + 320, 142), fill="#9c958b", width=1)
    row_labels = {
        "immediate-then-resolve": "IMMEDIATE / REMOVE OR COLLAPSE",
        "hold-until-resolved": "HOLD / COMMIT OR DISCARD",
    }
    for row_index, lifecycle in enumerate(LIFECYCLES):
        y = 205 + row_index * 245
        draw.text((56, y), row_labels[lifecycle], fill="#202426", font=font)
        for column, timepoint in enumerate(TIMEPOINTS):
            x = left + column * cell_width
            slate = case["publicSlates"][lifecycle][timepoint]
            other = case["publicSlates"][LIFECYCLES[1 - row_index]][timepoint]
            changed = set(slate) != set(other)
            fill = "#d8b9ad" if changed else "#d9ddd9"
            draw.rounded_rectangle((x, y - 18, x + 320, y + 170), radius=12, fill=fill, outline="#8b857c", width=1)
            for index, product in enumerate(slate[:PUBLIC_SLATE_LIMIT]):
                draw.text((x + 20, y + 12 + index * 28), f"{index + 1:02d}  PRODUCT {product}", fill="#202426", font=font)
            status = "DIFFERENT SLATE" if changed else "MATCHED"
            draw.text((x + 190, y + 140), status, fill="#7d4e44" if changed else "#52645e", font=font)
    draw.text((56, 710), "Hashed product identifiers; raw ASINs, titles, users, and model checkpoints are not published.", fill="#696b68", font=font)
    image.save(path)


def draw_progress(category_payloads: list[dict], pooled: dict) -> None:
    image = Image.new("RGB", (1400, 760), "#ede8de")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((65, 48), "PROVISIONAL RECOMMENDATION EXPOSURE / 95% HIERARCHICAL BOOTSTRAP", fill="#202426", font=font)
    axis_left, axis_right = 330, 1300
    scale = (axis_right - axis_left) / 1.0
    for index, payload in enumerate(category_payloads):
        y = 145 + index * 110
        effect = payload["uncertainty"]["inProgressDisplacementAt10"]
        draw.text((65, y - 7), payload["label"], fill="#202426", font=font)
        draw.line((axis_left, y, axis_right, y), fill="#c7c0b5", width=1)
        draw.line((axis_left + effect["lower95"] * scale, y, axis_left + effect["upper95"] * scale, y), fill="#677d88", width=8)
        x = axis_left + effect["estimate"] * scale
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill="#a7685a")
        draw.text((axis_right - 190, y - 25), f"{effect['estimate']:.3f} [{effect['lower95']:.3f}, {effect['upper95']:.3f}]", fill="#202426", font=font)
    y = 145 + len(category_payloads) * 110
    draw.text((65, y - 7), "Equal-category pooled", fill="#202426", font=font)
    draw.line((axis_left, y, axis_right, y), fill="#8b857c", width=1)
    draw.line((axis_left + pooled["lower95"] * scale, y, axis_left + pooled["upper95"] * scale, y), fill="#203640", width=10)
    x = axis_left + pooled["estimate"] * scale
    draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill="#203640")
    draw.text((axis_right - 190, y - 25), f"{pooled['estimate']:.3f} [{pooled['lower95']:.3f}, {pooled['upper95']:.3f}]", fill="#202426", font=font)
    draw.text((axis_left, 690), "0", fill="#696b68", font=font)
    draw.text((axis_right - 165, 690), "1.0 top-10 displacement", fill="#696b68", font=font)
    image.save(EXPERIMENT / "progress.png")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    EXPERIMENT.mkdir(parents=True, exist_ok=True)
    all_rows = []
    all_tasks = []
    all_representatives = []
    category_payloads = []
    category_bootstraps = {}
    rng = np.random.default_rng(BOOTSTRAP_SEED)

    for category in cross.CATEGORIES:
        data = cross.prepare_category(category)
        products = load_products(category, data)
        tasks = build_tasks(category, data, products)
        for task in tasks:
            task["agent"] = run_agent(task, products, task_local=True)
            task["noLocalAgent"] = run_agent(task, products, task_local=False)
        models, _ = cross.load_or_train_models(data)
        rows, representatives = run_model_rows(category, data, tasks, models)
        all_rows.extend(rows)
        all_tasks.extend(tasks)
        all_representatives.extend(representatives)
        bootstrap = bootstrap_category(rows, category["slug"], rng)
        category_bootstraps[category["slug"]] = bootstrap
        feasible_tasks = [task for task in tasks if task["outcomePlan"] == "feasible-selection"]
        failed_tasks = [task for task in tasks if task["outcomePlan"] == "infeasible-budget"]
        category_payloads.append(
            {
                "slug": category["slug"],
                "label": category["label"],
                "taskCount": len(tasks),
                "selectedTaskCount": sum(task["agent"]["outcome"] == "selected" for task in tasks),
                "abandonedTaskCount": sum(task["agent"]["outcome"] == "abandoned" for task in tasks),
                "feasibleDecisionAccuracy": rounded(mean(task["agent"]["decisionCorrect"] for task in feasible_tasks)),
                "infeasibleDecisionAccuracy": rounded(mean(task["agent"]["decisionCorrect"] for task in failed_tasks)),
                "taskLocalRecommendationUseRate": rounded(mean(task["agent"]["taskLocalViewCount"] > 0 for task in tasks)),
                "meanSelectedUtility": rounded(mean(task["agent"]["selectedUtility"] for task in feasible_tasks)),
                "noLocalMeanSelectedUtility": rounded(mean(task["noLocalAgent"]["selectedUtility"] for task in feasible_tasks)),
                "maxStagedMinusImmediateTaskUtility": max(abs(row["stagedMinusImmediateTaskUtility"]) for row in rows),
                "maxOutcomeResolvedDisplacement": max(row["outcomeResolvedDisplacementAt10"] for row in rows),
                "maxNextTaskDisplacement": max(row["nextTaskDisplacementAt10"] for row in rows),
                "uncertainty": {
                    "provisionalExposureAuc": interval(bootstrap["auc"]),
                    "inProgressDisplacementAt10": interval(bootstrap["progress"]),
                    "inProgressExcessTargetSlotsAt10": interval(bootstrap["slots"]),
                },
            }
        )
        print(
            f"category={category['slug']} tasks={len(tasks)} rows={len(rows)} "
            f"in_progress={category_payloads[-1]['uncertainty']['inProgressDisplacementAt10']}",
            flush=True,
        )

    category_order = [category["slug"] for category in cross.CATEGORIES]
    pooled = {}
    for metric in ["auc", "progress", "slots"]:
        values = np.mean(
            np.stack([category_bootstraps[category][metric] for category in category_order]),
            axis=0,
        )
        pooled[metric] = interval(values)

    representative_cases = []
    for outcome in ["selected", "abandoned"]:
        candidates = [case for case in all_representatives if case["outcome"] == outcome]
        case = max(candidates, key=lambda row: (row["metric"], row["taskId"], row["modelSeed"]))
        public_slates = {
            lifecycle: {
                timepoint: [item_hash(case["category"], item) for item in case["slates"][lifecycle][timepoint][:PUBLIC_SLATE_LIMIT]]
                for timepoint in TIMEPOINTS
            }
            for lifecycle in LIFECYCLES
        }
        public_case = {
            "category": case["category"],
            "taskId": case["taskId"],
            "modelSeed": case["modelSeed"],
            "outcome": case["outcome"],
            "inProgressDisplacementAt10": case["metric"],
            "publicSlates": public_slates,
        }
        representative_cases.append(public_case)
        draw_timeline(public_case, EVIDENCE / f"{outcome}-timeline.png")

    public_trajectories = []
    for task in all_tasks:
        public_trajectories.append(
            {
                "taskId": task["taskId"],
                "category": task["category"],
                "similarityBand": task["similarityBand"],
                "plannedFeasibility": task["outcomePlan"],
                "taskBrief": {
                    "targetFamilyId": public_hash("family", task["category"], task["family"])[:8].upper(),
                    "requiredAttributeId": public_hash("attribute", task["category"], task["attribute"])[:8].upper(),
                    "hasBudgetConstraint": task["budget"] is not None,
                    "budgetBand": None if task["budget"] is None else ("under-10" if task["budget"] < 10 else "10-50" if task["budget"] < 50 else "over-50"),
                },
                "agent": {
                    "policy": "deterministic retrieval-and-planning agent with task-local recommendations",
                    "outcome": task["agent"]["outcome"],
                    "decisionCorrect": task["agent"]["decisionCorrect"],
                    "selectedUtility": task["agent"]["selectedUtility"],
                    "stepCount": task["agent"]["stepCount"],
                    "taskLocalViewCount": task["agent"]["taskLocalViewCount"],
                    "actions": [public_action(task["category"], action) for action in task["agent"]["actions"]],
                },
                "noTaskLocalDiagnostic": {
                    "outcome": task["noLocalAgent"]["outcome"],
                    "decisionCorrect": task["noLocalAgent"]["decisionCorrect"],
                    "selectedUtility": task["noLocalAgent"]["selectedUtility"],
                    "stepCount": task["noLocalAgent"]["stepCount"],
                },
            }
        )

    positive_categories = sum(
        payload["uncertainty"]["inProgressDisplacementAt10"]["lower95"] > 0
        for payload in category_payloads
    )
    summary = {
        "schemaVersion": "delegated-activation-timing.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "evidenceStatus": "autonomous-agent-trajectory computational experiment",
        "design": {
            "categories": category_order,
            "taskCount": len(all_tasks),
            "taskCountPerCategory": TASKS_PER_CATEGORY,
            "modelSeeds": sas.SEEDS,
            "model": "SASRec checkpoints trained on Amazon Reviews 2018 chronological implicit-feedback sequences",
            "agent": "deterministic retrieval-and-planning shopping agent over a frozen local storefront",
            "agentActions": ["search", "product-view", "request-task-recommendations", "compare", "select-or-abandon"],
            "lifecycleConditions": LIFECYCLES,
            "timepoints": TIMEPOINTS,
            "pairedDefinition": "same principal history, task, storefront, agent observations, realized action trace, model checkpoint, candidate mask, and final stored state; only pre-outcome platform activation differs",
            "taskLocalContract": "both lifecycle arms retain identical task-local recommendation state; staged events are withheld only from the principal platform profile",
            "outcomeResolution": "selected tasks collapse to the selected item in both arms; abandoned tasks remove or discard all task events in both arms",
            "nextTaskCheckpoint": "both arms append the same held-out next historical event after resolution",
            "bootstrap": {
                "replicates": BOOTSTRAP_REPLICATES,
                "seed": BOOTSTRAP_SEED,
                "unit": "delegated task",
                "method": "model seeds and tasks resampled separately within category; categories equally weighted for pooled estimates",
            },
        },
        "categories": category_payloads,
        "pooledUncertainty": {
            "provisionalExposureAuc": pooled["auc"],
            "inProgressDisplacementAt10": pooled["progress"],
            "inProgressExcessTargetSlotsAt10": pooled["slots"],
        },
        "representativeCases": representative_cases,
        "observedComparisons": {
            "positiveInProgressIntervalCategoryCount": positive_categories,
            "allResolvedFinalStatesMatched": all(payload["maxOutcomeResolvedDisplacement"] == 0 for payload in category_payloads),
            "allNextTaskStatesMatched": all(payload["maxNextTaskDisplacement"] == 0 for payload in category_payloads),
            "taskUtilityIdenticalAcrossLifecycleArms": all(payload["maxStagedMinusImmediateTaskUtility"] == 0 for payload in category_payloads),
            "allAgentsConsumedTaskLocalRecommendations": all(payload["taskLocalRecommendationUseRate"] == 1 for payload in category_payloads),
        },
        "claims": {
            "observed": [
                "The shopping agent generated action traces by searching, viewing, consuming task-local recommendations, comparing, and selecting or abandoning products in a frozen local storefront.",
                "Immediate activation and hold-until-resolved replay the identical realized agent trace and reach the same outcome-resolved stored state.",
                "The experiment measures top-10 recommendation differences while task outcome is pending and verifies equality after resolution and at the next-task checkpoint.",
                "Task-local recommendation state remains available in both lifecycle arms, allowing platform-profile staging to be evaluated without disabling within-task adaptation.",
            ],
            "notEstablished": [
                "The agent is deterministic and is not evidence about the behavior of frontier LLM or commercial shopping agents.",
                "The storefront is a frozen offline research environment, not Amazon.com or Amazon's deployed recommender.",
                "Review histories are real public sequences, but the delegated task and agent are generated for this experiment.",
                "Exact final-state equality is an inference-context replay property, not trained-model unlearning.",
                "No human preference change, experienced harm, comprehension, trust, or control preference is measured.",
            ],
        },
    }
    rows_payload = {
        "schemaVersion": "delegated-activation-paired-rows.v1",
        "privacy": {
            "originalUserIdsIncluded": False,
            "originalItemIdsIncluded": False,
            "productTitlesIncluded": False,
            "reviewTextIncluded": False,
            "taskAndProductIds": "domain-separated truncated SHA-256",
        },
        "rows": all_rows,
    }
    trajectories_payload = {
        "schemaVersion": "delegated-shopping-agent-trajectories.v1",
        "privacy": rows_payload["privacy"],
        "trajectories": public_trajectories,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "rows.json").write_text(json.dumps(rows_payload, separators=(",", ":")) + "\n", encoding="utf-8")
    (OUTPUT / "trajectories.json").write_text(json.dumps(trajectories_payload, separators=(",", ":")) + "\n", encoding="utf-8")
    draw_progress(category_payloads, pooled["progress"])
    manifest = {
        "schemaVersion": "delegated-activation-evidence-manifest.v1",
        "sourceSummarySha256": hashlib.sha256((OUTPUT / "summary.json").read_bytes()).hexdigest(),
        "files": {},
        "redaction": "Product and user identifiers are domain-separated hashes; raw titles, ASINs, reviewer IDs, and review text are absent.",
    }
    for path in sorted(EVIDENCE.glob("*-timeline.png")):
        manifest["files"][path.name] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": path.stat().st_size,
        }
    (EVIDENCE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "taskCount": len(all_tasks),
        "rowCount": len(all_rows),
        "pooledUncertainty": summary["pooledUncertainty"],
        "observedComparisons": summary["observedComparisons"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    torch.set_grad_enabled(False)
    main()
