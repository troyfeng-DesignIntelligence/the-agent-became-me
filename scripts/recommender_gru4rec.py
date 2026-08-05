"""Shared recurrent next-item baseline for the storefront robustness study.

The encoder follows the GRU4Rec family (item embeddings -> recurrent sequence
encoder -> next-item scores). To isolate encoder architecture from the SASRec
comparison, it deliberately uses the same sampled binary next-item objective,
data split, embedding width, seeds, candidate sets, and early-stopping metric.
"""

from __future__ import annotations

import copy
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn


MAX_LEN = 50
HIDDEN = 32
DROPOUT = 0.2
BATCH_SIZE = 128
MAX_EPOCHS = 20
PATIENCE = 4
LEARNING_RATE = 0.001


class GRU4Rec(nn.Module):
    def __init__(self, item_count: int):
        super().__init__()
        self.item_embedding = nn.Embedding(item_count + 1, HIDDEN, padding_idx=0)
        self.input_dropout = nn.Dropout(DROPOUT)
        self.gru = nn.GRU(HIDDEN, HIDDEN, batch_first=True)
        self.output_norm = nn.LayerNorm(HIDDEN)
        nn.init.normal_(self.item_embedding.weight, std=0.02)
        with torch.no_grad():
            self.item_embedding.weight[0].zero_()

    def encode_steps(self, sequences: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        embedded = self.input_dropout(self.item_embedding(sequences))
        packed = nn.utils.rnn.pack_padded_sequence(
            embedded,
            lengths.cpu(),
            batch_first=True,
            enforce_sorted=False,
        )
        packed_output, _ = self.gru(packed)
        output, _ = nn.utils.rnn.pad_packed_sequence(
            packed_output,
            batch_first=True,
            total_length=MAX_LEN,
        )
        return self.output_norm(output)

    def training_logits(
        self,
        sequences: torch.Tensor,
        lengths: torch.Tensor,
        positives: torch.Tensor,
        negatives: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        features = self.encode_steps(sequences, lengths)
        positive_logits = (features * self.item_embedding(positives)).sum(dim=-1)
        negative_logits = (features * self.item_embedding(negatives)).sum(dim=-1)
        return positive_logits, negative_logits

    def score_all(self, sequences: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        features = self.encode_steps(sequences, lengths)
        indices = (lengths - 1).clamp_min(0)
        final = features[torch.arange(len(sequences)), indices]
        return final @ self.item_embedding.weight.T


def pad_contexts(contexts: list[list[int]]) -> tuple[np.ndarray, np.ndarray]:
    rows = np.zeros((len(contexts), MAX_LEN), dtype=np.int64)
    lengths = np.zeros(len(contexts), dtype=np.int64)
    for index, context in enumerate(contexts):
        recent = context[-MAX_LEN:] or [0]
        rows[index, : len(recent)] = recent
        lengths[index] = max(1, len(recent))
    return rows, lengths


def sample_training_row(
    sequence: list[int], interacted: set[int], item_count: int, rng: random.Random
) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
    recent = sequence[-(MAX_LEN + 1) :]
    inputs = recent[:-1]
    positives = recent[1:]
    length = max(1, len(inputs))
    input_row = np.zeros(MAX_LEN, dtype=np.int64)
    positive_row = np.zeros(MAX_LEN, dtype=np.int64)
    negative_row = np.zeros(MAX_LEN, dtype=np.int64)
    input_row[: len(inputs)] = inputs
    positive_row[: len(positives)] = positives
    for index in range(len(positives)):
        negative = rng.randint(1, item_count)
        while negative in interacted:
            negative = rng.randint(1, item_count)
        negative_row[index] = negative
    return input_row, positive_row, negative_row, length


@torch.no_grad()
def score_context_batch(model: GRU4Rec, contexts: list[list[int]]) -> np.ndarray:
    rows, lengths = pad_contexts(contexts)
    sequence_tensor = torch.from_numpy(rows).long()
    length_tensor = torch.from_numpy(lengths).long()
    model.eval()
    return model.score_all(sequence_tensor, length_tensor).cpu().numpy()


@torch.no_grad()
def evaluate_model(
    model: GRU4Rec,
    histories: dict[str, list[int]],
    targets: dict[str, int],
    all_interacted: dict[str, set[int]],
    item_count: int,
    seed: int,
    popularity: np.ndarray,
    transitions,
    sas,
    limit: int | None = None,
) -> dict:
    users = sorted(histories, key=lambda user: sas.stable_int("gru-eval-order", user))
    if limit:
        users = users[:limit]
    recurrent_ranks: list[int] = []
    popularity_ranks: list[int] = []
    transition_ranks: list[int] = []
    changed: list[float] = []
    displacements: list[float] = []
    for start in range(0, len(users), 256):
        batch_users = users[start : start + 256]
        ordered_scores = score_context_batch(
            model, [histories[user] for user in batch_users]
        )
        reversed_scores = score_context_batch(
            model, [list(reversed(histories[user])) for user in batch_users]
        )
        for index, user in enumerate(batch_users):
            target = targets[user]
            candidates = sas.fixed_candidates(
                user, target, all_interacted[user], item_count, seed
            )
            recurrent_ranks.append(
                sas.rank_of_target(ordered_scores[index], candidates, target)
            )
            popularity_ranks.append(sas.rank_of_target(popularity, candidates, target))
            transition_scores = sas.score_transition(
                histories[user][-1], item_count, transitions, popularity
            )
            transition_ranks.append(
                sas.rank_of_target(transition_scores, candidates, target)
            )
            ordered_top = sas.ranked_items(ordered_scores[index], candidates)
            reversed_top = sas.ranked_items(reversed_scores[index], candidates)
            overlap = len(set(ordered_top).intersection(reversed_top))
            changed.append(float(ordered_top != reversed_top))
            displacements.append(1.0 - overlap / 10.0)
    return {
        "gru4rec": sas.metric_from_ranks(recurrent_ranks),
        "popularity": sas.metric_from_ranks(popularity_ranks),
        "firstOrderTransition": sas.metric_from_ranks(transition_ranks),
        "orderSensitivity": {
            "changedTop10Rate": sas.rounded(sas.mean(changed)),
            "meanTop10Displacement": sas.rounded(sas.mean(displacements)),
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
    checkpoint_path: Path,
    sas,
) -> tuple[GRU4Rec, dict]:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    model = GRU4Rec(item_count)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
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
            sequences = torch.from_numpy(np.stack([row[0] for row in samples])).long()
            positives = torch.from_numpy(np.stack([row[1] for row in samples])).long()
            negatives = torch.from_numpy(np.stack([row[2] for row in samples])).long()
            lengths = torch.tensor([row[3] for row in samples], dtype=torch.long)
            positive_logits, negative_logits = model.training_logits(
                sequences, lengths, positives, negatives
            )
            mask = positives.ne(0)
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
        epoch_loss = sas.mean(epoch_losses)
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
            sas,
            limit=800,
        )
        ndcg = validation["gru4rec"]["ndcgAt10"]
        validation_history.append(
            {
                "epoch": epoch,
                "trainingLoss": sas.rounded(epoch_loss),
                "ndcgAt10": ndcg,
            }
        )
        print(
            f"gru4rec seed={seed} epoch={epoch:02d} loss={epoch_loss:.4f} "
            f"val_ndcg@10={ndcg:.4f}",
            flush=True,
        )
        if ndcg > best_ndcg + 1e-5:
            best_ndcg = ndcg
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
        if stale >= PATIENCE and epoch >= 6:
            break
        if time.monotonic() - started > 285:
            print(f"gru4rec seed={seed} reached 285-second safety stop", flush=True)
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), checkpoint_path)
    return model, {
        "seed": seed,
        "epochsCompleted": len(losses),
        "initialTrainingLoss": sas.rounded(losses[0]),
        "finalTrainingLoss": sas.rounded(losses[-1]),
        "bestValidationNdcgAt10": sas.rounded(best_ndcg),
        "wallClockSeconds": sas.rounded(time.monotonic() - started),
        "epochHistory": validation_history,
        "checkpointReused": False,
    }


def load_or_train_models(data: dict, category_slug: str, checkpoint_root: Path, sas):
    models: dict[int, GRU4Rec] = {}
    runs: list[dict] = []
    for seed in sas.SEEDS:
        checkpoint = checkpoint_root / category_slug / f"gru4rec-seed-{seed}.pt"
        if checkpoint.exists():
            model = GRU4Rec(data["itemCount"])
            model.load_state_dict(
                torch.load(checkpoint, map_location="cpu", weights_only=True)
            )
            run = {
                "seed": seed,
                "epochsCompleted": 0,
                "initialTrainingLoss": None,
                "finalTrainingLoss": None,
                "bestValidationNdcgAt10": None,
                "wallClockSeconds": 0,
                "epochHistory": [],
                "checkpointReused": True,
            }
        else:
            model, run = train_one_seed(
                seed,
                data["train"],
                data["validation"],
                data["interacted"],
                data["itemCount"],
                data["popularity"],
                data["transitions"],
                checkpoint,
                sas,
            )
        model.eval()
        models[seed] = model
        runs.append(run)
    return models, runs
