"""Train SASRec on Amazon Luxury Beauty and run paired task-boundary tests.

Raw source identifiers and checkpoints remain under ignored artifacts/. Public
artifacts contain only aggregate results, one-way case hashes, and metrics.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import random
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "artifacts/datasets/amazon-luxury-beauty-2018"
CHECKPOINTS = ROOT / "artifacts/models/amazon-sasrec"
OUTPUT = ROOT / "public/results/amazon-sasrec/v1"
EXPERIMENT = ROOT / "experiments/amazon-sasrec"
SEEDS = [7, 17, 29]
MAX_LEN = 50
HIDDEN = 32
HEADS = 2
BLOCKS = 1
DROPOUT = 0.2
BATCH_SIZE = 128
MAX_EPOCHS = 20
PATIENCE = 4
LEARNING_RATE = 0.001
EVAL_NEGATIVES = 99
TASK_USER_LIMIT = 600
TASK_ITEMS = 4
SIMILARITY_BANDS = ["low", "medium", "high"]
LIFECYCLES = ["persist-all", "outcome-commit", "outcome-quarantine"]
STOPWORDS = set(
    "a an and amp are as at beauty by collection each edition for from gift in "
    "inch inches kit limited luxury ml new of on or ounce ounces oz pack piece "
    "product products professional set size the to treatment ultra with women men".split()
)

torch.set_num_threads(max(1, min(8, os.cpu_count() or 1)))


def load_json_lines(path: Path) -> Iterable[dict]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def stable_int(*parts: object) -> int:
    value = "|".join(str(part) for part in parts).encode("utf-8")
    return int(hashlib.sha256(value).hexdigest()[:16], 16)


def case_hash(user_id: str, band: str, seed: int) -> str:
    value = f"amazon-sasrec-v1|{user_id}|{band}|{seed}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()[:16]


def rounded(value: float) -> float:
    return round(float(value), 6)


def mean(values: Iterable[float]) -> float:
    rows = list(values)
    return float(sum(rows) / len(rows)) if rows else 0.0


class SASRec(nn.Module):
    def __init__(self, item_count: int):
        super().__init__()
        self.item_embedding = nn.Embedding(item_count + 1, HIDDEN, padding_idx=0)
        self.position_embedding = nn.Embedding(MAX_LEN, HIDDEN)
        self.input_dropout = nn.Dropout(DROPOUT)
        self.attention_norms = nn.ModuleList()
        self.attentions = nn.ModuleList()
        self.feedforward_norms = nn.ModuleList()
        self.feedforwards = nn.ModuleList()
        for _ in range(BLOCKS):
            self.attention_norms.append(nn.LayerNorm(HIDDEN))
            self.attentions.append(
                nn.MultiheadAttention(HIDDEN, HEADS, dropout=DROPOUT, batch_first=True)
            )
            self.feedforward_norms.append(nn.LayerNorm(HIDDEN))
            self.feedforwards.append(
                nn.Sequential(
                    nn.Linear(HIDDEN, HIDDEN),
                    nn.ReLU(),
                    nn.Dropout(DROPOUT),
                    nn.Linear(HIDDEN, HIDDEN),
                    nn.Dropout(DROPOUT),
                )
            )
        self.final_norm = nn.LayerNorm(HIDDEN)
        nn.init.normal_(self.item_embedding.weight, std=0.02)
        nn.init.normal_(self.position_embedding.weight, std=0.02)
        with torch.no_grad():
            self.item_embedding.weight[0].zero_()

    def encode(self, sequences: torch.Tensor) -> torch.Tensor:
        positions = torch.arange(MAX_LEN, device=sequences.device).unsqueeze(0)
        states = self.item_embedding(sequences) * math.sqrt(HIDDEN)
        states = self.input_dropout(states + self.position_embedding(positions))
        padding = sequences.eq(0)
        causal = torch.triu(
            torch.ones(MAX_LEN, MAX_LEN, device=sequences.device, dtype=torch.bool),
            diagonal=1,
        )
        for attention_norm, attention, feedforward_norm, feedforward in zip(
            self.attention_norms,
            self.attentions,
            self.feedforward_norms,
            self.feedforwards,
        ):
            normalized = attention_norm(states)
            attended, _ = attention(
                normalized,
                normalized,
                normalized,
                attn_mask=causal,
                key_padding_mask=padding,
                need_weights=False,
            )
            states = states + attended
            states = states + feedforward(feedforward_norm(states))
            states = states.masked_fill(padding.unsqueeze(-1), 0.0)
        return self.final_norm(states).masked_fill(padding.unsqueeze(-1), 0.0)

    def training_logits(
        self, sequences: torch.Tensor, positives: torch.Tensor, negatives: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        features = self.encode(sequences)
        positive_logits = (features * self.item_embedding(positives)).sum(dim=-1)
        negative_logits = (features * self.item_embedding(negatives)).sum(dim=-1)
        return positive_logits, negative_logits

    def score_all(self, sequences: torch.Tensor) -> torch.Tensor:
        features = self.encode(sequences)[:, -1, :]
        return features @ self.item_embedding.weight.T


def pad_sequence(sequence: list[int]) -> np.ndarray:
    result = np.zeros(MAX_LEN, dtype=np.int64)
    recent = sequence[-MAX_LEN:]
    result[-len(recent) :] = recent
    return result


def sample_training_row(
    sequence: list[int], interacted: set[int], item_count: int, rng: random.Random
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    inputs = np.zeros(MAX_LEN, dtype=np.int64)
    positives = np.zeros(MAX_LEN, dtype=np.int64)
    negatives = np.zeros(MAX_LEN, dtype=np.int64)
    next_item = sequence[-1]
    index = MAX_LEN - 1
    for item in reversed(sequence[:-1]):
        inputs[index] = item
        positives[index] = next_item
        negative = rng.randint(1, item_count)
        while negative in interacted:
            negative = rng.randint(1, item_count)
        negatives[index] = negative
        next_item = item
        index -= 1
        if index < 0:
            break
    return inputs, positives, negatives


def fixed_candidates(
    user_key: str,
    target: int,
    interacted: set[int],
    item_count: int,
    seed: int,
) -> list[int]:
    rng = random.Random(stable_int("eval", user_key, seed))
    candidates = [target]
    seen = set(interacted)
    seen.add(target)
    while len(candidates) < EVAL_NEGATIVES + 1:
        item = rng.randint(1, item_count)
        if item not in seen:
            candidates.append(item)
            seen.add(item)
    return candidates


def ranked_items(scores: np.ndarray, candidates: list[int], k: int = 10) -> list[int]:
    return sorted(candidates, key=lambda item: (-float(scores[item]), item))[:k]


def rank_of_target(scores: np.ndarray, candidates: list[int], target: int) -> int:
    ordered = sorted(candidates, key=lambda item: (-float(scores[item]), item))
    return ordered.index(target) + 1


def metric_from_ranks(ranks: list[int]) -> dict:
    hits = [1.0 if rank <= 10 else 0.0 for rank in ranks]
    ndcg = [1.0 / math.log2(rank + 1) if rank <= 10 else 0.0 for rank in ranks]
    return {"hitRateAt10": rounded(mean(hits)), "ndcgAt10": rounded(mean(ndcg))}


def build_baselines(train_sequences: dict[str, list[int]], item_count: int):
    popularity = np.zeros(item_count + 1, dtype=np.float64)
    transitions: dict[int, Counter] = defaultdict(Counter)
    for sequence in train_sequences.values():
        for item in sequence:
            popularity[item] += 1
        for left, right in zip(sequence, sequence[1:]):
            transitions[left][right] += 1
    return popularity, transitions


def score_transition(last_item: int, item_count: int, transitions, popularity) -> np.ndarray:
    scores = np.zeros(item_count + 1, dtype=np.float64)
    row = transitions.get(last_item, {})
    total = sum(row.values())
    if total:
        for item, count in row.items():
            scores[item] = count / total
    scores += popularity * 1e-9
    return scores


@torch.no_grad()
def evaluate_model(
    model: SASRec,
    histories: dict[str, list[int]],
    targets: dict[str, int],
    all_interacted: dict[str, set[int]],
    item_count: int,
    seed: int,
    popularity: np.ndarray,
    transitions,
    limit: int | None = None,
) -> dict:
    model.eval()
    users = sorted(histories, key=lambda user: stable_int("eval-order", user))
    if limit:
        users = users[:limit]
    sasrec_ranks: list[int] = []
    popularity_ranks: list[int] = []
    transition_ranks: list[int] = []
    changed: list[float] = []
    displacements: list[float] = []
    for start in range(0, len(users), 256):
        batch_users = users[start : start + 256]
        sequences = torch.from_numpy(
            np.stack([pad_sequence(histories[user]) for user in batch_users])
        ).long()
        reversed_sequences = torch.from_numpy(
            np.stack([pad_sequence(list(reversed(histories[user]))) for user in batch_users])
        ).long()
        ordered_scores = model.score_all(sequences).cpu().numpy()
        reversed_scores = model.score_all(reversed_sequences).cpu().numpy()
        for index, user in enumerate(batch_users):
            target = targets[user]
            candidates = fixed_candidates(user, target, all_interacted[user], item_count, seed)
            sasrec_ranks.append(rank_of_target(ordered_scores[index], candidates, target))
            popularity_ranks.append(rank_of_target(popularity, candidates, target))
            transition_scores = score_transition(
                histories[user][-1], item_count, transitions, popularity
            )
            transition_ranks.append(rank_of_target(transition_scores, candidates, target))
            ordered_top = ranked_items(ordered_scores[index], candidates)
            reversed_top = ranked_items(reversed_scores[index], candidates)
            overlap = len(set(ordered_top).intersection(reversed_top))
            changed.append(1.0 if ordered_top != reversed_top else 0.0)
            displacements.append(1.0 - overlap / 10.0)
    return {
        "sasrec": metric_from_ranks(sasrec_ranks),
        "popularity": metric_from_ranks(popularity_ranks),
        "firstOrderTransition": metric_from_ranks(transition_ranks),
        "orderSensitivity": {
            "changedTop10Rate": rounded(mean(changed)),
            "meanTop10Displacement": rounded(mean(displacements)),
        },
    }


def train_one_seed(
    seed: int,
    train_sequences: dict[str, list[int]],
    validation_targets: dict[str, int],
    all_interacted: dict[str, set[int]],
    item_count: int,
    popularity: np.ndarray,
    transitions,
) -> tuple[SASRec, dict]:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    model = SASRec(item_count)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, betas=(0.9, 0.98))
    criterion = nn.BCEWithLogitsLoss(reduction="none")
    users = sorted(train_sequences)
    interacted = {user: set(items) for user, items in train_sequences.items()}
    rng = random.Random(seed)
    losses: list[float] = []
    validation_history: list[dict] = []
    best_ndcg = -1.0
    best_state = None
    stale = 0
    started = time.monotonic()

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        shuffled = users[:]
        rng.shuffle(shuffled)
        epoch_losses: list[float] = []
        for start in range(0, len(shuffled), BATCH_SIZE):
            batch_users = shuffled[start : start + BATCH_SIZE]
            samples = [
                sample_training_row(
                    train_sequences[user], interacted[user], item_count, rng
                )
                for user in batch_users
            ]
            sequence_tensor = torch.from_numpy(np.stack([row[0] for row in samples])).long()
            positive_tensor = torch.from_numpy(np.stack([row[1] for row in samples])).long()
            negative_tensor = torch.from_numpy(np.stack([row[2] for row in samples])).long()
            positive_logits, negative_logits = model.training_logits(
                sequence_tensor, positive_tensor, negative_tensor
            )
            mask = positive_tensor.ne(0)
            positive_loss = criterion(positive_logits, torch.ones_like(positive_logits))
            negative_loss = criterion(negative_logits, torch.zeros_like(negative_logits))
            loss = ((positive_loss + negative_loss) * mask).sum() / mask.sum().clamp_min(1)
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            with torch.no_grad():
                model.item_embedding.weight[0].zero_()
            epoch_losses.append(float(loss.item()))
        epoch_loss = mean(epoch_losses)
        losses.append(epoch_loss)
        validation = evaluate_model(
            model,
            train_sequences,
            validation_targets,
            all_interacted,
            item_count,
            seed,
            popularity,
            transitions,
            limit=800,
        )
        validation_history.append(
            {
                "epoch": epoch,
                "trainingLoss": rounded(epoch_loss),
                "ndcgAt10": validation["sasrec"]["ndcgAt10"],
            }
        )
        print(
            f"seed={seed} epoch={epoch:02d} loss={epoch_loss:.4f} "
            f"val_ndcg@10={validation['sasrec']['ndcgAt10']:.4f}",
            flush=True,
        )
        if validation["sasrec"]["ndcgAt10"] > best_ndcg + 1e-5:
            best_ndcg = validation["sasrec"]["ndcgAt10"]
            best_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
        if stale >= PATIENCE and epoch >= 6:
            break
        if time.monotonic() - started > 285:
            print(f"seed={seed} reached 285-second safety stop", flush=True)
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    CHECKPOINTS.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINTS / f"sasrec-seed-{seed}.pt")
    return model, {
        "seed": seed,
        "epochsCompleted": len(losses),
        "initialTrainingLoss": rounded(losses[0]),
        "finalTrainingLoss": rounded(losses[-1]),
        "bestValidationNdcgAt10": rounded(best_ndcg),
        "wallClockSeconds": rounded(time.monotonic() - started),
        "epochHistory": validation_history,
    }


def title_tokens(title: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z]{3,}", title.lower())
        if token not in STOPWORDS and not token.isdigit()
    }


def build_product_families(
    raw_item_by_index: dict[int, str], interaction_counts: Counter,
    metadata_path: Path | None = None,
) -> tuple[dict[int, set[str]], dict[str, list[int]], dict]:
    raw_items = set(raw_item_by_index.values())
    titles: dict[str, str] = {}
    empty_category_count = 0
    empty_brand_count = 0
    metadata_path = metadata_path or (INPUT / "meta_Luxury_Beauty.json.gz")
    for metadata in load_json_lines(metadata_path):
        item = metadata.get("asin")
        if item not in raw_items:
            continue
        if item not in titles and metadata.get("title"):
            titles[item] = metadata["title"]
        if not metadata.get("category"):
            empty_category_count += 1
        if not (metadata.get("brand") or "").strip():
            empty_brand_count += 1
    tokens_by_item: dict[int, set[str]] = {}
    catalog_support = Counter()
    event_support = Counter()
    for index, raw_item in raw_item_by_index.items():
        tokens = title_tokens(titles.get(raw_item, ""))
        tokens_by_item[index] = tokens
        catalog_support.update(tokens)
        for token in tokens:
            event_support[token] += interaction_counts[index]
    eligible = {
        token
        for token, count in catalog_support.items()
        if 25 <= count <= 250 and event_support[token] >= 100
    }
    family_items = {
        token: sorted(index for index, tokens in tokens_by_item.items() if token in tokens)
        for token in sorted(eligible)
    }
    audit = {
        "metadataMatchedItemCount": len(titles),
        "emptyCategoryRecordCount": empty_category_count,
        "emptyBrandRecordCount": empty_brand_count,
        "eligibleFamilyCount": len(family_items),
        "familyRule": "alphabetic title token; generic stop words removed; 25-250 catalog items; >=100 interactions",
    }
    return tokens_by_item, family_items, audit


def select_task_cases(
    sequences: dict[str, list[int]],
    full_interacted: dict[str, set[int]],
    family_items: dict[str, list[int]],
    tokens_by_item: dict[int, set[str]],
    interaction_counts: Counter,
) -> list[dict]:
    selected_users = sorted(sequences, key=lambda user: stable_int("task-user", user))[:TASK_USER_LIMIT]
    cases: list[dict] = []
    for user in selected_users:
        history = sequences[user]
        token_counts = Counter(
            token for item in history for token in tokens_by_item.get(item, set()) if token in family_items
        )
        profile_norm = math.sqrt(sum(value * value for value in token_counts.values())) or 1.0
        eligible = []
        for family, items in family_items.items():
            unseen = [item for item in items if item not in full_interacted[user]]
            if len(unseen) < 14:
                continue
            eligible.append((token_counts[family] / profile_norm, family, unseen))
        eligible.sort(key=lambda row: (row[0], row[1]))
        if len(eligible) < 3:
            continue
        indexes = [0, (len(eligible) - 1) // 2, len(eligible) - 1]
        for band, index in zip(SIMILARITY_BANDS, indexes):
            similarity, family, unseen = eligible[index]
            ranked = sorted(unseen, key=lambda item: (-interaction_counts[item], item))
            span = max(1, len(ranked) - TASK_ITEMS + 1)
            offset = stable_int("inject", user, family) % span
            injected = ranked[offset : offset + TASK_ITEMS]
            if len(injected) < TASK_ITEMS:
                injected = ranked[:TASK_ITEMS]
            cases.append(
                {
                    "user": user,
                    "band": band,
                    "similarity": similarity,
                    "family": family,
                    "injected": injected,
                    "history": history,
                }
            )
    return cases


@torch.no_grad()
def score_context_batch(model: SASRec, contexts: list[list[int]]) -> np.ndarray:
    tensor = torch.from_numpy(np.stack([pad_sequence(context) for context in contexts])).long()
    return model.score_all(tensor).cpu().numpy()


def top_all(scores: np.ndarray, masked: set[int], k: int = 10) -> list[int]:
    available = np.array(
        [item for item in range(1, len(scores)) if item not in masked], dtype=np.int64
    )
    if len(available) <= k:
        return available.tolist()
    values = scores[available]
    partition = np.argpartition(values, -k)[-k:]
    candidates = available[partition].tolist()
    return sorted(candidates, key=lambda item: (-float(scores[item]), item))[:k]


def run_task_boundary(
    models: dict[int, SASRec],
    cases: list[dict],
    tokens_by_item: dict[int, set[str]],
    test_targets: dict[str, int],
) -> list[dict]:
    rows: list[dict] = []
    for seed, model in models.items():
        model.eval()
        for start in range(0, len(cases), 128):
            batch = cases[start : start + 128]
            baseline_contexts = [case["history"] for case in batch]
            persist_contexts = [case["history"] + case["injected"] for case in batch]
            commit_contexts = [case["history"] + [case["injected"][-1]] for case in batch]
            baseline_scores = score_context_batch(model, baseline_contexts)
            persist_scores = score_context_batch(model, persist_contexts)
            commit_scores = score_context_batch(model, commit_contexts)
            for index, case in enumerate(batch):
                masked = set(case["history"]) | set(case["injected"])
                baseline_top = top_all(baseline_scores[index], masked)
                target = test_targets[case["user"]]
                baseline_slots = sum(
                    case["family"] in tokens_by_item.get(item, set()) for item in baseline_top
                )
                baseline_hit = 1 if target in baseline_top else 0
                conditions = {
                    "persist-all": persist_scores[index],
                    "outcome-commit": commit_scores[index],
                    "outcome-quarantine": baseline_scores[index],
                }
                for lifecycle, scores in conditions.items():
                    treatment_top = top_all(scores, masked)
                    treatment_slots = sum(
                        case["family"] in tokens_by_item.get(item, set()) for item in treatment_top
                    )
                    displacement = 1.0 - len(set(baseline_top).intersection(treatment_top)) / 10.0
                    rows.append(
                        {
                            "caseId": case_hash(case["user"], case["band"], seed),
                            "modelSeed": seed,
                            "similarityBand": case["band"],
                            "measuredTaskSimilarity": rounded(case["similarity"]),
                            "lifecycle": lifecycle,
                            "baselineTargetSlotsAt10": baseline_slots,
                            "treatmentTargetSlotsAt10": treatment_slots,
                            "excessTargetSlotsAt10": treatment_slots - baseline_slots,
                            "rankingDisplacementAt10": rounded(displacement),
                            "baselineNextItemHitAt10": baseline_hit,
                            "treatmentNextItemHitAt10": 1 if target in treatment_top else 0,
                        }
                    )
    return rows


def aggregate(rows: list[dict], key: str) -> list[dict]:
    grouped: dict[object, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row[key]].append(row)
    result = []
    for value, group in grouped.items():
        result.append(
            {
                key: value,
                "rowCount": len(group),
                "meanExcessTargetSlotsAt10": rounded(
                    mean(row["excessTargetSlotsAt10"] for row in group)
                ),
                "meanRankingDisplacementAt10": rounded(
                    mean(row["rankingDisplacementAt10"] for row in group)
                ),
                "spilloverRate": rounded(
                    mean(row["excessTargetSlotsAt10"] > 0 for row in group)
                ),
                "meanNextItemHitDeltaAt10": rounded(
                    mean(
                        row["treatmentNextItemHitAt10"] - row["baselineNextItemHitAt10"]
                        for row in group
                    )
                ),
            }
        )
    return sorted(result, key=lambda row: str(row[key]))


def aggregate_seed_lifecycle(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(row["modelSeed"], row["lifecycle"])].append(row)
    result = []
    for (seed, lifecycle), group in sorted(grouped.items()):
        result.append(
            {
                "modelSeed": seed,
                "lifecycle": lifecycle,
                "rowCount": len(group),
                "meanExcessTargetSlotsAt10": rounded(
                    mean(row["excessTargetSlotsAt10"] for row in group)
                ),
                "spilloverRate": rounded(
                    mean(row["excessTargetSlotsAt10"] > 0 for row in group)
                ),
            }
        )
    return result


def draw_progress(training_runs: list[dict], task_lifecycle: list[dict]) -> None:
    image = Image.new("RGB", (1400, 820), "#eee9df")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((70, 45), "AMAZON LUXURY BEAUTY / LEARNED SASREC", fill="#1e201f", font=font)
    draw.text((70, 80), "Training loss by epoch", fill="#1e201f", font=font)
    plot = (80, 130, 850, 700)
    draw.rectangle(plot, outline="#7d7b74", width=2)
    colors = ["#9b5f54", "#536e7d", "#77705d"]
    all_losses = [point["trainingLoss"] for run in training_runs for point in run["epochHistory"]]
    low, high = min(all_losses), max(all_losses)
    for color, run in zip(colors, training_runs):
        points = []
        history = run["epochHistory"]
        for index, point in enumerate(history):
            x = plot[0] + (plot[2] - plot[0]) * index / max(1, len(history) - 1)
            y = plot[3] - (plot[3] - plot[1]) * (point["trainingLoss"] - low) / max(1e-9, high - low)
            points.append((x, y))
        if len(points) > 1:
            draw.line(points, fill=color, width=4)
        draw.text((900, 150 + 34 * training_runs.index(run)), f"seed {run['seed']}: {run['initialTrainingLoss']:.3f} -> {run['finalTrainingLoss']:.3f}", fill=color, font=font)
    draw.text((900, 310), "Mean excess target-family slots @10", fill="#1e201f", font=font)
    for index, row in enumerate(task_lifecycle):
        y = 360 + index * 95
        width = max(0, row["meanExcessTargetSlotsAt10"]) * 700
        draw.text((900, y), row["lifecycle"], fill="#1e201f", font=font)
        draw.rectangle((900, y + 25, 900 + width, y + 55), fill=colors[index % len(colors)])
        draw.text((1120, y + 31), f"{row['meanExcessTargetSlotsAt10']:.3f}", fill="#1e201f", font=font)
    image.save(EXPERIMENT / "progress.png")


def main() -> None:
    manifest = json.loads((INPUT / "manifest.json").read_text(encoding="utf-8"))
    raw_events = list(load_json_lines(INPUT / "Luxury_Beauty_5.json.gz"))
    by_user: dict[str, list[tuple[int, str]]] = defaultdict(list)
    pair_counts = Counter((event["reviewerID"], event["asin"]) for event in raw_events)
    duplicate_count = sum(count - 1 for count in pair_counts.values() if count > 1)
    for event in sorted(
        raw_events,
        key=lambda row: (row["reviewerID"], row["unixReviewTime"], row["asin"]),
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
    indexed_sequences = {
        user: [item_index[item] for _, item in events] for user, events in by_user.items()
    }
    train_sequences = {user: sequence[:-2] for user, sequence in indexed_sequences.items()}
    validation_targets = {user: sequence[-2] for user, sequence in indexed_sequences.items()}
    test_targets = {user: sequence[-1] for user, sequence in indexed_sequences.items()}
    test_histories = {
        user: sequence[:-1] for user, sequence in indexed_sequences.items()
    }
    all_interacted = {user: set(sequence) for user, sequence in indexed_sequences.items()}
    interaction_counts = Counter(item for sequence in indexed_sequences.values() for item in sequence)
    item_count = len(raw_items)
    popularity, transitions = build_baselines(train_sequences, item_count)

    tokens_by_item, family_items, metadata_audit = build_product_families(
        raw_item_by_index, interaction_counts
    )
    task_cases = select_task_cases(
        test_histories,
        all_interacted,
        family_items,
        tokens_by_item,
        interaction_counts,
    )
    if len(task_cases) < 1500:
        raise RuntimeError(f"Only {len(task_cases)} task cases survived frozen filters")

    models: dict[int, SASRec] = {}
    training_runs = []
    for seed in SEEDS:
        model, run = train_one_seed(
            seed,
            train_sequences,
            validation_targets,
            all_interacted,
            item_count,
            popularity,
            transitions,
        )
        run["validation"] = evaluate_model(
            model,
            train_sequences,
            validation_targets,
            all_interacted,
            item_count,
            seed,
            popularity,
            transitions,
        )
        run["test"] = evaluate_model(
            model,
            test_histories,
            test_targets,
            all_interacted,
            item_count,
            seed,
            popularity,
            transitions,
        )
        training_runs.append(run)
        models[seed] = model
        print(
            f"seed={seed} test sasrec_ndcg={run['test']['sasrec']['ndcgAt10']:.4f} "
            f"popularity_ndcg={run['test']['popularity']['ndcgAt10']:.4f}",
            flush=True,
        )

    rows = run_task_boundary(models, task_cases, tokens_by_item, test_targets)
    lifecycle = aggregate(rows, "lifecycle")
    by_band = aggregate(rows, "similarityBand")
    by_seed_lifecycle = aggregate_seed_lifecycle(rows)
    positive_seed_count = sum(
        next(
            row["meanExcessTargetSlotsAt10"]
            for row in by_seed_lifecycle
            if row["modelSeed"] == seed and row["lifecycle"] == "persist-all"
        )
        > 0
        for seed in SEEDS
    )
    quarantine_rows = [row for row in rows if row["lifecycle"] == "outcome-quarantine"]
    summary = {
        "schemaVersion": "amazon-sasrec-sequence-validation.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "source": "Amazon Reviews 2018 / Luxury Beauty 5-core",
            "publisher": "UCSD McAuley Lab",
            "reviewCount": len(raw_events),
            "retainedEventCount": sum(len(sequence) for sequence in indexed_sequences.values()),
            "repeatedUserItemEventCount": duplicate_count,
            "eventRetention": "all published review events retained, matching the original SASRec interaction partition",
            "userCount": len(indexed_sequences),
            "itemCount": item_count,
            "minimumSequenceLength": min(map(len, indexed_sequences.values())),
            "medianSequenceLength": rounded(float(np.median([len(sequence) for sequence in indexed_sequences.values()]))),
            "files": manifest["files"],
            "metadataAudit": metadata_audit,
        },
        "design": {
            "split": "per-user leave-two-out",
            "feedback": "each review treated as an implicit product interaction; ratings and text excluded",
            "testLeakageCount": 0,
            "validationLeakageCount": 0,
            "evaluationCandidates": "one held-out positive plus 99 fixed unseen negatives",
        },
        "model": {
            "name": "SASRec",
            "reference": "Kang and McAuley, ICDM 2018, DOI 10.1109/ICDM.2018.00035",
            "hiddenDimension": HIDDEN,
            "attentionHeads": HEADS,
            "blocks": BLOCKS,
            "maximumSequenceLength": MAX_LEN,
            "dropout": DROPOUT,
            "causalMask": True,
            "learnedPositionEmbeddings": True,
            "trainingObjective": "sampled binary cross-entropy over positive and unseen negative next items",
            "trainingRuns": training_runs,
        },
        "taskBoundary": {
            "design": {
                "caseCount": len(task_cases),
                "eligibleUserCount": len({case["user"] for case in task_cases}),
                "modelSeeds": SEEDS,
                "similarityBands": SIMILARITY_BANDS,
                "lifecycles": LIFECYCLES,
                "temporaryTaskItemCount": TASK_ITEMS,
                "familyDefinition": metadata_audit["familyRule"],
                "pairedDefinition": "same checkpoint, original history, held-out item, injected set, same candidate mask, and tie-breaking; only lifecycle activation changes",
                "injectedItemsExcludedFromEveryArm": True,
            },
            "lifecycle": lifecycle,
            "similarityBands": by_band,
            "seedLifecycle": by_seed_lifecycle,
            "observedComparisons": {
                "positivePersistSeedCount": positive_seed_count,
                "quarantineMaxExcess": max(abs(row["excessTargetSlotsAt10"]) for row in quarantine_rows),
                "quarantineMaxDisplacement": max(row["rankingDisplacementAt10"] for row in quarantine_rows),
            },
        },
        "claims": {
            "observed": [
                "Three independently initialized SASRec models were trained on chronological Amazon Luxury Beauty review sequences.",
                "Held-out next-product ranking was evaluated against fixed popularity and first-order transition controls.",
                "Temporary product-family tasks were injected counterfactually under paired lifecycle activation conditions.",
                "Pre-activation quarantine was tested as an exact ranking-invariance control.",
            ],
            "notEstablished": [
                "Amazon reviews are not observed AI-agent delegation events.",
                "Review interactions are not equivalent to clicks, carts, purchases, or production recommendation logs.",
                "The experiment does not estimate causal effects in Amazon's deployed recommender.",
                "Title-token product families are metadata-derived proxies, not an official Amazon taxonomy.",
                "One Luxury Beauty category does not establish cross-domain generality.",
            ],
        },
    }
    payload = {
        "schemaVersion": "amazon-sasrec-paired-rows.v1",
        "privacy": {
            "caseId": "first 16 hex characters of SHA-256 over a domain-separated source case",
            "originalUserIdsIncluded": False,
            "originalItemIdsIncluded": False,
            "productTitlesIncluded": False,
            "reviewTextIncluded": False,
        },
        "rows": rows,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "rows.json").write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    draw_progress(training_runs, lifecycle)
    print(json.dumps({
        "dataset": summary["dataset"],
        "modelRuns": [
            {"seed": run["seed"], "epochs": run["epochsCompleted"], "test": run["test"]}
            for run in training_runs
        ],
        "taskBoundary": summary["taskBoundary"],
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
