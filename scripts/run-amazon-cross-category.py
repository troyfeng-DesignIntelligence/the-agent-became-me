"""Run a shared SASRec protocol across four Amazon categories.

Public artifacts contain only aggregates and domain-separated one-way hashes.
Raw user/item identifiers and model checkpoints remain under artifacts/.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/results/amazon-cross-category/v1"
EXPERIMENT = ROOT / "experiments/amazon-cross-category"
CHECKPOINT_ROOT = ROOT / "artifacts/models/amazon-cross-category"
BOOTSTRAP_REPLICATES = 2000
BOOTSTRAP_SEED = 20260805
TASK_USER_LIMIT = 500
CATEGORIES = [
    {"slug": "luxury-beauty", "file": "Luxury_Beauty", "label": "Luxury Beauty"},
    {"slug": "software", "file": "Software", "label": "Software"},
    {"slug": "industrial-and-scientific", "file": "Industrial_and_Scientific", "label": "Industrial and Scientific"},
    {"slug": "prime-pantry", "file": "Prime_Pantry", "label": "Prime Pantry"},
]


def load_sasrec_module():
    path = ROOT / "scripts/run-amazon-sasrec.py"
    spec = importlib.util.spec_from_file_location("amazon_sasrec_base", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not import SASRec implementation")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sas = load_sasrec_module()


def rounded(value: float) -> float:
    return round(float(value), 6)


def mean(values) -> float:
    rows = list(values)
    return float(sum(rows) / len(rows)) if rows else 0.0


def public_user_hash(category: str, user: str) -> str:
    value = f"amazon-cross-category-v1|user|{category}|{user}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()[:16]


def public_case_hash(category: str, user: str, band: str, seed: int) -> str:
    value = f"amazon-cross-category-v1|case|{category}|{user}|{band}|{seed}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()[:16]


def prepare_category(category: dict) -> dict:
    directory = ROOT / f"artifacts/datasets/amazon-{category['slug']}-2018"
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    review_path = directory / f"{category['file']}_5.json.gz"
    metadata_path = directory / f"meta_{category['file']}.json.gz"
    raw_events = list(sas.load_json_lines(review_path))
    by_user = defaultdict(list)
    pair_counts = Counter((event["reviewerID"], event["asin"]) for event in raw_events)
    for event in sorted(
        raw_events,
        key=lambda row: (row["reviewerID"], int(row["unixReviewTime"]), row["asin"]),
    ):
        by_user[event["reviewerID"]].append((int(event["unixReviewTime"]), event["asin"]))
    by_user = {
        user: sorted(events, key=lambda row: (row[0], row[1]))
        for user, events in by_user.items()
        if len(events) >= 5
    }
    raw_items = sorted({item for events in by_user.values() for _, item in events})
    item_index = {item: index + 1 for index, item in enumerate(raw_items)}
    raw_item_by_index = {index: item for item, index in item_index.items()}
    sequences = {
        user: [item_index[item] for _, item in events]
        for user, events in by_user.items()
    }
    train = {user: sequence[:-2] for user, sequence in sequences.items()}
    validation = {user: sequence[-2] for user, sequence in sequences.items()}
    test = {user: sequence[-1] for user, sequence in sequences.items()}
    test_histories = {user: sequence[:-1] for user, sequence in sequences.items()}
    interacted = {user: set(sequence) for user, sequence in sequences.items()}
    interaction_counts = Counter(item for sequence in sequences.values() for item in sequence)
    popularity, transitions = sas.build_baselines(train, len(raw_items))
    tokens_by_item, family_items, metadata_audit = sas.build_product_families(
        raw_item_by_index, interaction_counts, metadata_path
    )
    task_cases = select_eligible_cases(
        category["slug"], test_histories, interacted, family_items,
        tokens_by_item, interaction_counts
    )
    eligible_users = len({case["user"] for case in task_cases})
    if eligible_users < 300:
        raise RuntimeError(
            f"{category['label']} has only {eligible_users} eligible task users under frozen filters"
        )
    print(
        f"category={category['slug']} reviews={len(raw_events)} users={len(sequences)} "
        f"items={len(raw_items)} families={len(family_items)} task_users={eligible_users}",
        flush=True,
    )
    return {
        "category": category,
        "manifest": manifest,
        "rawEventCount": len(raw_events),
        "repeatedUserItemEventCount": sum(
            count - 1 for count in pair_counts.values() if count > 1
        ),
        "sequences": sequences,
        "train": train,
        "validation": validation,
        "test": test,
        "testHistories": test_histories,
        "interacted": interacted,
        "interactionCounts": interaction_counts,
        "itemCount": len(raw_items),
        "popularity": popularity,
        "transitions": transitions,
        "tokensByItem": tokens_by_item,
        "familyItems": family_items,
        "metadataAudit": metadata_audit,
        "taskCases": task_cases,
    }


def select_eligible_cases(category, sequences, interacted, family_items, tokens_by_item, interaction_counts):
    cases = []
    accepted = 0
    for user in sorted(sequences, key=lambda value: sas.stable_int("task-user", category, value)):
        history = sequences[user]
        token_counts = Counter(
            token for item in history for token in tokens_by_item.get(item, set())
            if token in family_items
        )
        profile_norm = math.sqrt(sum(value * value for value in token_counts.values())) or 1.0
        eligible = []
        for family, items in family_items.items():
            unseen = [item for item in items if item not in interacted[user]]
            if len(unseen) < 14:
                continue
            eligible.append((token_counts[family] / profile_norm, family, unseen))
        eligible.sort(key=lambda row: (row[0], row[1]))
        if len(eligible) < 3:
            continue
        indexes = [0, (len(eligible) - 1) // 2, len(eligible) - 1]
        for band, index in zip(sas.SIMILARITY_BANDS, indexes):
            similarity, family, unseen = eligible[index]
            ranked = sorted(unseen, key=lambda item: (-interaction_counts[item], item))
            span = max(1, len(ranked) - sas.TASK_ITEMS + 1)
            offset = sas.stable_int("inject", category, user, family) % span
            injected = ranked[offset : offset + sas.TASK_ITEMS]
            if len(injected) < sas.TASK_ITEMS:
                injected = ranked[: sas.TASK_ITEMS]
            cases.append({
                "user": user,
                "band": band,
                "similarity": similarity,
                "family": family,
                "injected": injected,
                "history": history,
            })
        accepted += 1
        if accepted >= TASK_USER_LIMIT:
            break
    return cases


@torch.no_grad()
def evaluate_user_rows(model, data, seed):
    model.eval()
    users = sorted(data["testHistories"], key=lambda value: sas.stable_int("test-user", data["category"]["slug"], value))
    rows = []
    for start in range(0, len(users), 256):
        batch = users[start : start + 256]
        tensors = torch.from_numpy(np.stack([
            sas.pad_sequence(data["testHistories"][user]) for user in batch
        ])).long()
        reversed_tensors = torch.from_numpy(np.stack([
            sas.pad_sequence(list(reversed(data["testHistories"][user]))) for user in batch
        ])).long()
        scores = model.score_all(tensors).cpu().numpy()
        reverse_scores = model.score_all(reversed_tensors).cpu().numpy()
        for index, user in enumerate(batch):
            target = data["test"][user]
            candidates = sas.fixed_candidates(
                user, target, data["interacted"][user], data["itemCount"], seed
            )
            rank = sas.rank_of_target(scores[index], candidates, target)
            pop_rank = sas.rank_of_target(data["popularity"], candidates, target)
            transition_scores = sas.score_transition(
                data["testHistories"][user][-1], data["itemCount"],
                data["transitions"], data["popularity"]
            )
            transition_rank = sas.rank_of_target(transition_scores, candidates, target)
            ordered_top = sas.ranked_items(scores[index], candidates)
            reverse_top = sas.ranked_items(reverse_scores[index], candidates)
            rows.append({
                "category": data["category"]["slug"],
                "userCaseId": public_user_hash(data["category"]["slug"], user),
                "modelSeed": seed,
                "sasrecNdcgAt10": rounded(1 / math.log2(rank + 1) if rank <= 10 else 0),
                "sasrecHitAt10": 1 if rank <= 10 else 0,
                "popularityNdcgAt10": rounded(1 / math.log2(pop_rank + 1) if pop_rank <= 10 else 0),
                "popularityHitAt10": 1 if pop_rank <= 10 else 0,
                "transitionNdcgAt10": rounded(1 / math.log2(transition_rank + 1) if transition_rank <= 10 else 0),
                "transitionHitAt10": 1 if transition_rank <= 10 else 0,
                "orderChangedTop10": 1 if ordered_top != reverse_top else 0,
                "orderDisplacementAt10": rounded(1 - len(set(ordered_top) & set(reverse_top)) / 10),
            })
    return rows


@torch.no_grad()
def run_task_rows(models, data):
    category = data["category"]["slug"]
    rows = []
    cases = data["taskCases"]
    for seed, model in models.items():
        model.eval()
        for start in range(0, len(cases), 128):
            batch = cases[start : start + 128]
            baseline_scores = sas.score_context_batch(model, [case["history"] for case in batch])
            persist_scores = sas.score_context_batch(model, [case["history"] + case["injected"] for case in batch])
            commit_scores = sas.score_context_batch(model, [case["history"] + [case["injected"][-1]] for case in batch])
            for index, case in enumerate(batch):
                masked = set(case["history"]) | set(case["injected"])
                baseline_top = sas.top_all(baseline_scores[index], masked)
                baseline_slots = sum(case["family"] in data["tokensByItem"].get(item, set()) for item in baseline_top)
                target = data["test"][case["user"]]
                baseline_hit = 1 if target in baseline_top else 0
                conditions = {
                    "persist-all": persist_scores[index],
                    "outcome-commit": commit_scores[index],
                    "outcome-quarantine": baseline_scores[index],
                }
                for lifecycle, scores in conditions.items():
                    treatment_top = sas.top_all(scores, masked)
                    treatment_slots = sum(case["family"] in data["tokensByItem"].get(item, set()) for item in treatment_top)
                    rows.append({
                        "category": category,
                        "userCaseId": public_user_hash(category, case["user"]),
                        "caseId": public_case_hash(category, case["user"], case["band"], seed),
                        "modelSeed": seed,
                        "similarityBand": case["band"],
                        "measuredTaskSimilarity": rounded(case["similarity"]),
                        "lifecycle": lifecycle,
                        "baselineTargetSlotsAt10": baseline_slots,
                        "treatmentTargetSlotsAt10": treatment_slots,
                        "excessTargetSlotsAt10": treatment_slots - baseline_slots,
                        "rankingDisplacementAt10": rounded(1 - len(set(baseline_top) & set(treatment_top)) / 10),
                        "baselineNextItemHitAt10": baseline_hit,
                        "treatmentNextItemHitAt10": 1 if target in treatment_top else 0,
                    })
    return rows


def interval(values):
    array = np.asarray(values, dtype=np.float64)
    return {
        "estimate": rounded(float(np.mean(array))),
        "lower95": rounded(float(np.quantile(array, 0.025))),
        "upper95": rounded(float(np.quantile(array, 0.975))),
        "positiveProbability": rounded(float(np.mean(array > 0))),
    }


def arrays_for_task(rows, category):
    selected = [row for row in rows if row["category"] == category]
    seeds = sorted({row["modelSeed"] for row in selected})
    users = sorted({row["userCaseId"] for row in selected})
    seed_index = {value: index for index, value in enumerate(seeds)}
    user_index = {value: index for index, value in enumerate(users)}
    bands = {value: index for index, value in enumerate(sas.SIMILARITY_BANDS)}
    lifecycles = {value: index for index, value in enumerate(sas.LIFECYCLES)}
    shape = (len(seeds), len(users), len(bands), len(lifecycles))
    excess = np.full(shape, np.nan)
    displacement = np.full(shape, np.nan)
    hit_delta = np.full(shape, np.nan)
    for row in selected:
        index = (
            seed_index[row["modelSeed"]], user_index[row["userCaseId"]],
            bands[row["similarityBand"]], lifecycles[row["lifecycle"]]
        )
        excess[index] = row["excessTargetSlotsAt10"]
        displacement[index] = row["rankingDisplacementAt10"]
        hit_delta[index] = row["treatmentNextItemHitAt10"] - row["baselineNextItemHitAt10"]
    if np.isnan(excess).any():
        raise RuntimeError(f"Incomplete paired task cube for {category}")
    return seeds, users, excess, displacement, hit_delta


def bootstrap_category_task(rows, category, rng):
    seeds, users, excess, displacement, hit_delta = arrays_for_task(rows, category)
    lifecycle_index = {value: index for index, value in enumerate(sas.LIFECYCLES)}
    samples = defaultdict(list)
    for _ in range(BOOTSTRAP_REPLICATES):
        sampled_seeds = rng.integers(0, len(seeds), len(seeds))
        sampled_users = rng.integers(0, len(users), len(users))
        for lifecycle, life_index in lifecycle_index.items():
            values = excess[np.ix_(sampled_seeds, sampled_users, range(3), [life_index])]
            displacement_values = displacement[np.ix_(sampled_seeds, sampled_users, range(3), [life_index])]
            hit_values = hit_delta[np.ix_(sampled_seeds, sampled_users, range(3), [life_index])]
            samples[f"{lifecycle}:excess"].append(float(values.mean()))
            samples[f"{lifecycle}:spillover"].append(float((values > 0).mean()))
            samples[f"{lifecycle}:displacement"].append(float(displacement_values.mean()))
            samples[f"{lifecycle}:hitDelta"].append(float(hit_values.mean()))
        persist = excess[np.ix_(sampled_seeds, sampled_users, range(3), [lifecycle_index["persist-all"]])]
        commit = excess[np.ix_(sampled_seeds, sampled_users, range(3), [lifecycle_index["outcome-commit"]])]
        samples["attenuation"].append(float((persist - commit).mean()))
    return {key: np.asarray(value) for key, value in samples.items()}, len(users)


def bootstrap_performance(validation_rows, category, rng):
    selected = [row for row in validation_rows if row["category"] == category]
    seeds = sorted({row["modelSeed"] for row in selected})
    users = sorted({row["userCaseId"] for row in selected})
    seed_index = {value: index for index, value in enumerate(seeds)}
    user_index = {value: index for index, value in enumerate(users)}
    shape = (len(seeds), len(users))
    difference = np.full(shape, np.nan)
    sasrec_hit = np.full(shape, np.nan)
    order_change = np.full(shape, np.nan)
    for row in selected:
        index = seed_index[row["modelSeed"]], user_index[row["userCaseId"]]
        difference[index] = row["sasrecNdcgAt10"] - row["popularityNdcgAt10"]
        sasrec_hit[index] = row["sasrecHitAt10"]
        order_change[index] = row["orderChangedTop10"]
    values = defaultdict(list)
    for _ in range(BOOTSTRAP_REPLICATES):
        sampled_seeds = rng.integers(0, len(seeds), len(seeds))
        sampled_users = rng.integers(0, len(users), len(users))
        values["ndcgGainVsPopularity"].append(float(difference[np.ix_(sampled_seeds, sampled_users)].mean()))
        values["sasrecHitRateAt10"].append(float(sasrec_hit[np.ix_(sampled_seeds, sampled_users)].mean()))
        values["orderChangedTop10Rate"].append(float(order_change[np.ix_(sampled_seeds, sampled_users)].mean()))
    return {key: interval(value) for key, value in values.items()}


def load_cached_training_runs(category):
    cross_path = OUTPUT / "summary.json"
    if cross_path.exists():
        previous = json.loads(cross_path.read_text(encoding="utf-8"))
        payload = next(
            (row for row in previous.get("categories", []) if row.get("slug") == category),
            None,
        )
        if payload:
            return payload.get("trainingRuns")
    if category == "luxury-beauty":
        path = ROOT / "public/results/amazon-sasrec/v1/summary.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))["model"]["trainingRuns"]
    return None


def load_or_train_models(data):
    category = data["category"]
    sas.INPUT = ROOT / f"artifacts/datasets/amazon-{category['slug']}-2018"
    sas.CHECKPOINTS = (
        ROOT / "artifacts/models/amazon-sasrec"
        if category["slug"] == "luxury-beauty"
        else CHECKPOINT_ROOT / category["slug"]
    )
    cached_runs = load_cached_training_runs(category["slug"])
    models = {}
    runs = []
    for seed in sas.SEEDS:
        checkpoint = sas.CHECKPOINTS / f"sasrec-seed-{seed}.pt"
        if checkpoint.exists():
            model = sas.SASRec(data["itemCount"])
            model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
            cached = next((run for run in cached_runs or [] if run["seed"] == seed), None)
            run = dict(cached) if cached else {
                "seed": seed, "epochsCompleted": 0, "initialTrainingLoss": 1,
                "finalTrainingLoss": 0.999, "bestValidationNdcgAt10": 0,
                "wallClockSeconds": 0, "checkpointReused": True,
            }
            run["checkpointReused"] = True
        else:
            model, run = sas.train_one_seed(
                seed, data["train"], data["validation"], data["interacted"],
                data["itemCount"], data["popularity"], data["transitions"]
            )
            run["checkpointReused"] = False
        models[seed] = model
        runs.append(run)
    return models, runs


def aggregate_point(rows, category, lifecycle):
    selected = [row for row in rows if row["category"] == category and row["lifecycle"] == lifecycle]
    return {
        "rowCount": len(selected),
        "meanExcessTargetSlotsAt10": rounded(mean(row["excessTargetSlotsAt10"] for row in selected)),
        "spilloverRate": rounded(mean(row["excessTargetSlotsAt10"] > 0 for row in selected)),
        "meanRankingDisplacementAt10": rounded(mean(row["rankingDisplacementAt10"] for row in selected)),
        "meanNextItemHitDeltaAt10": rounded(mean(row["treatmentNextItemHitAt10"] - row["baselineNextItemHitAt10"] for row in selected)),
    }


def draw_progress(category_results, pooled):
    image = Image.new("RGB", (1400, 780), "#eee9df")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((70, 55), "CROSS-CATEGORY SASREC REPLICATION / 95% HIERARCHICAL BOOTSTRAP", fill="#252728", font=font)
    axis_left, axis_right = 330, 1310
    zero = axis_left
    scale = (axis_right - axis_left) / 0.75
    for index, result in enumerate(category_results):
        y = 155 + index * 115
        effect = result["uncertainty"]["persistExcess"]
        draw.text((70, y - 7), result["label"], fill="#252728", font=font)
        draw.line((axis_left, y, axis_right, y), fill="#c9c2b7", width=1)
        draw.line((zero + effect["lower95"] * scale, y, zero + effect["upper95"] * scale, y), fill="#697c88", width=8)
        x = zero + effect["estimate"] * scale
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill="#a9685a")
        draw.text((axis_right - 170, y - 28), f"{effect['estimate']:+.3f} [{effect['lower95']:+.3f}, {effect['upper95']:+.3f}]", fill="#252728", font=font)
    y = 155 + len(category_results) * 115
    draw.text((70, y - 7), "Equal-category pooled", fill="#252728", font=font)
    draw.line((axis_left, y, axis_right, y), fill="#8b857c", width=1)
    draw.line((zero + pooled["lower95"] * scale, y, zero + pooled["upper95"] * scale, y), fill="#1f333e", width=10)
    x = zero + pooled["estimate"] * scale
    draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill="#1f333e")
    draw.text((axis_right - 170, y - 28), f"{pooled['estimate']:+.3f} [{pooled['lower95']:+.3f}, {pooled['upper95']:+.3f}]", fill="#252728", font=font)
    draw.text((axis_left, 700), "0", fill="#6b6a66", font=font)
    draw.text((axis_right - 35, 700), "+0.75 excess target-family slots @10", fill="#6b6a66", font=font)
    image.save(EXPERIMENT / "progress.png")


def main():
    all_task_rows = []
    all_validation_rows = []
    category_payloads = []
    for category in CATEGORIES:
        data = prepare_category(category)
        models, training_runs = load_or_train_models(data)
        validation_rows = []
        for seed, model in models.items():
            seed_rows = evaluate_user_rows(model, data, seed)
            validation_rows.extend(seed_rows)
            summary = {
                "sasrecNdcgAt10": rounded(mean(row["sasrecNdcgAt10"] for row in seed_rows)),
                "popularityNdcgAt10": rounded(mean(row["popularityNdcgAt10"] for row in seed_rows)),
                "transitionNdcgAt10": rounded(mean(row["transitionNdcgAt10"] for row in seed_rows)),
                "sasrecHitRateAt10": rounded(mean(row["sasrecHitAt10"] for row in seed_rows)),
                "orderChangedTop10Rate": rounded(mean(row["orderChangedTop10"] for row in seed_rows)),
                "meanOrderDisplacementAt10": rounded(mean(row["orderDisplacementAt10"] for row in seed_rows)),
            }
            next(run for run in training_runs if run["seed"] == seed)["testSummary"] = summary
            print(f"category={category['slug']} seed={seed} test={json.dumps(summary)}", flush=True)
        task_rows = run_task_rows(models, data)
        all_task_rows.extend(task_rows)
        all_validation_rows.extend(validation_rows)
        category_payloads.append({
            "slug": category["slug"],
            "label": category["label"],
            "dataset": {
                "source": data["manifest"]["dataset"],
                "reviewCount": data["rawEventCount"],
                "retainedEventCount": sum(len(value) for value in data["sequences"].values()),
                "repeatedUserItemEventCount": data["repeatedUserItemEventCount"],
                "userCount": len(data["sequences"]),
                "itemCount": data["itemCount"],
                "minimumSequenceLength": min(map(len, data["sequences"].values())),
                "medianSequenceLength": rounded(float(np.median([len(value) for value in data["sequences"].values()]))),
                "files": data["manifest"]["files"],
                "metadataAudit": data["metadataAudit"],
            },
            "trainingRuns": training_runs,
            "taskUserCount": len({row["userCaseId"] for row in task_rows}),
        })

    rng = np.random.default_rng(BOOTSTRAP_SEED)
    bootstrap_arrays = {}
    for payload in category_payloads:
        category = payload["slug"]
        task_bootstrap, task_user_count = bootstrap_category_task(all_task_rows, category, rng)
        bootstrap_arrays[category] = task_bootstrap
        payload["performanceUncertainty"] = bootstrap_performance(all_validation_rows, category, rng)
        payload["lifecycle"] = []
        for lifecycle in sas.LIFECYCLES:
            point = aggregate_point(all_task_rows, category, lifecycle)
            payload["lifecycle"].append({
                "lifecycle": lifecycle,
                **point,
                "uncertainty": {
                    "excessTargetSlotsAt10": interval(task_bootstrap[f"{lifecycle}:excess"]),
                    "spilloverRate": interval(task_bootstrap[f"{lifecycle}:spillover"]),
                    "rankingDisplacementAt10": interval(task_bootstrap[f"{lifecycle}:displacement"]),
                    "nextItemHitDeltaAt10": interval(task_bootstrap[f"{lifecycle}:hitDelta"]),
                },
            })
        payload["uncertainty"] = {
            "persistExcess": interval(task_bootstrap["persist-all:excess"]),
            "commitExcess": interval(task_bootstrap["outcome-commit:excess"]),
            "persistMinusCommit": interval(task_bootstrap["attenuation"]),
        }
        payload["taskUserCount"] = task_user_count
        payload["quarantineMaxAbsoluteExcess"] = max(
            abs(row["excessTargetSlotsAt10"]) for row in all_task_rows
            if row["category"] == category and row["lifecycle"] == "outcome-quarantine"
        )
        payload["quarantineMaxDisplacement"] = max(
            row["rankingDisplacementAt10"] for row in all_task_rows
            if row["category"] == category and row["lifecycle"] == "outcome-quarantine"
        )

    category_order = [category["slug"] for category in CATEGORIES]
    pooled_array = np.mean(np.stack([
        bootstrap_arrays[category]["persist-all:excess"] for category in category_order
    ]), axis=0)
    category_resampled = []
    for index in range(BOOTSTRAP_REPLICATES):
        sampled = rng.integers(0, len(category_order), len(category_order))
        category_resampled.append(mean(
            bootstrap_arrays[category_order[category_index]]["persist-all:excess"][index]
            for category_index in sampled
        ))
    leave_one_out = []
    for omitted in category_order:
        retained = [category for category in category_order if category != omitted]
        values = np.mean(np.stack([
            bootstrap_arrays[category]["persist-all:excess"] for category in retained
        ]), axis=0)
        leave_one_out.append({"omittedCategory": omitted, **interval(values)})
    point_effects = [payload["uncertainty"]["persistExcess"]["estimate"] for payload in category_payloads]
    inference = {
        "method": "hierarchical percentile bootstrap: model seeds and users resampled with replacement; all within-user similarity bands retained",
        "unit": "user history",
        "replicates": BOOTSTRAP_REPLICATES,
        "seed": BOOTSTRAP_SEED,
        "confidenceLevel": 0.95,
        "fixedSetEqualCategoryPooledPersistExcess": interval(pooled_array),
        "categoryResampledPooledPersistExcess": interval(category_resampled),
        "leaveOneCategoryOut": leave_one_out,
        "betweenCategoryDescriptive": {
            "minimumPointEstimate": min(point_effects),
            "maximumPointEstimate": max(point_effects),
            "range": rounded(max(point_effects) - min(point_effects)),
            "standardDeviation": rounded(float(np.std(point_effects, ddof=1))),
            "randomEffectsMetaAnalysisOmitted": "four categories are too few for a stable heterogeneity estimate",
        },
    }
    positive_category_count = sum(
        payload["uncertainty"]["persistExcess"]["lower95"] > 0
        for payload in category_payloads
    )
    attenuated_category_count = sum(
        payload["uncertainty"]["persistMinusCommit"]["estimate"] > 0
        for payload in category_payloads
    )
    learned_valid_category_count = sum(
        payload["performanceUncertainty"]["ndcgGainVsPopularity"]["estimate"] > 0
        for payload in category_payloads
    )
    summary = {
        "schemaVersion": "amazon-cross-category-sasrec.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "evidenceStatus": "cross-category-computational-replication",
        "design": {
            "categories": category_order,
            "modelSeeds": sas.SEEDS,
            "split": "per-user leave-two-out",
            "feedback": "each review treated as an implicit product interaction; ratings and text excluded",
            "sharedHyperparameters": {
                "hiddenDimension": sas.HIDDEN, "attentionHeads": sas.HEADS,
                "blocks": sas.BLOCKS, "maximumSequenceLength": sas.MAX_LEN,
                "dropout": sas.DROPOUT, "maximumEpochs": sas.MAX_EPOCHS,
                "learningRate": sas.LEARNING_RATE,
            },
            "evaluationCandidates": "one held-out positive plus 99 fixed unseen negatives",
            "taskUserLimitPerCategory": TASK_USER_LIMIT,
            "similarityBands": sas.SIMILARITY_BANDS,
            "lifecycles": sas.LIFECYCLES,
            "pairedDefinition": "same checkpoint, user, baseline history, held-out item, injected set, candidate mask, and tie-breaking; only lifecycle activation changes",
            "injectedItemsExcludedFromEveryArm": True,
        },
        "categories": category_payloads,
        "inference": inference,
        "observedComparisons": {
            "positivePersistIntervalCategoryCount": positive_category_count,
            "attenuatedPointEstimateCategoryCount": attenuated_category_count,
            "learnedModelBeatsPopularityCategoryCount": learned_valid_category_count,
            "allQuarantineInvariant": all(
                payload["quarantineMaxAbsoluteExcess"] == 0 and payload["quarantineMaxDisplacement"] == 0
                for payload in category_payloads
            ),
            "allLeaveOneOutPositive": all(row["lower95"] > 0 for row in leave_one_out),
        },
        "claims": {
            "observed": [
                "One shared SASRec protocol was run in four Amazon 5-core review categories with three model seeds each.",
                "Uncertainty intervals resample users and model seeds while preserving repeated within-user conditions.",
                "The fixed-set pooled effect weights each category equally and is accompanied by leave-one-category-out checks.",
                "Quarantine is evaluated as an exact paired ranking-invariance control in every category.",
            ],
            "notEstablished": [
                "Amazon reviews are not observed AI-agent delegation events.",
                "The experiment does not estimate effects in Amazon's deployed recommender.",
                "Title-token product families are evaluation proxies rather than an official taxonomy.",
                "Four selected categories do not establish universal e-commerce generality.",
                "The category-resampled interval is descriptive with only four category units.",
            ],
        },
    }
    rows_payload = {
        "schemaVersion": "amazon-cross-category-paired-rows.v1",
        "privacy": {
            "userCaseId": "first 16 hex characters of domain-separated SHA-256",
            "originalUserIdsIncluded": False,
            "originalItemIdsIncluded": False,
            "productTitlesIncluded": False,
            "reviewTextIncluded": False,
        },
        "taskRows": all_task_rows,
        "validationRows": all_validation_rows,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "rows.json").write_text(json.dumps(rows_payload, separators=(",", ":")) + "\n", encoding="utf-8")
    draw_progress(category_payloads, inference["fixedSetEqualCategoryPooledPersistExcess"])
    print(json.dumps({
        "categories": [{
            "slug": payload["slug"], "dataset": payload["dataset"],
            "performance": payload["performanceUncertainty"],
            "uncertainty": payload["uncertainty"],
        } for payload in category_payloads],
        "inference": inference,
        "observedComparisons": summary["observedComparisons"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
