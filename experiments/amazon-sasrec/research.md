# Research: Amazon Commerce Sequences + Learned SASRec

## Goal

Replace the remaining domain and model proxy with a reproducible test on real
e-commerce interaction sequences and a trained, standard sequential
recommender. The test asks whether task-boundary activation changes downstream
recommendation exposure when the ranker is SASRec rather than a hand-authored
transition rule.

## Success metric

- **Metric:** evidence-readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-amazon-sasrec.mjs`

## Bounded run configuration

- One bounded current-session run; no overnight or unattended continuation.
- Maximum 4 iterations; keep policy `pass_only`; `pause_every: never`.
- Three independent model seeds (`7`, `17`, `29`).
- Raw Amazon review and metadata files, learned checkpoints, and source IDs stay
  in ignored `artifacts/` and are never redistributed.
- Public rows contain one-way case hashes and derived metrics only.
- Maximum wall-clock time per training attempt: 5 minutes.
- No paper or website claim is upgraded unless the evaluator passes.

## Frozen data and model

- **Data:** Amazon Reviews 2018, `Luxury_Beauty_5`, with matching metadata from
  the UCSD McAuley Lab.
- **Unit:** a reviewer chronology containing every published review event,
  including repeated user-item events; minimum five events. This matches the
  original SASRec partition code, which appends every interaction line before
  leave-two-out splitting.
- **Split:** per-user leave-two-out: last event test, penultimate validation,
  earlier events training.
- **Feedback:** every review is treated as an implicit product interaction;
  rating value and review text are not model inputs.
- **Model:** one-block SASRec with causal self-attention, learned item and
  position embeddings, point-wise feed-forward layer, residual connections,
  layer normalization, dropout, and sampled binary cross-entropy.
- **Evaluation:** one true next item against 99 fixed unseen negatives;
  HR@10 and NDCG@10, with popularity and first-order transition controls.

## Research questions

- **RQ-S1:** Does the trained SASRec learn non-trivial next-product prediction
  on held-out real e-commerce sequences?
- **RQ-S2:** Does appending a counterfactual four-item temporary task increase
  exposure to its metadata-derived product family relative to the paired
  original history?
- **RQ-S3:** Does committing only the task outcome attenuate exposure, while
  pre-activation quarantine exactly reproduces the original ranking?

## Falsification and gates

- **Go:** all three runs converge; mean SASRec test NDCG@10 exceeds popularity;
  rankings are order-sensitive; persist-all exposure is positive in at least
  two seeds; quarantine is exactly invariant.
- **Pivot:** SASRec learns next-item prediction but injected tasks do not create
  consistent exposure; keep the dataset/model validation and narrow the paper
  away from learned-ranker spillover.
- **No-go:** source scale or split checks fail, candidate sets differ across
  paired arms, source identifiers leak into public artifacts, SASRec fails to
  beat popularity, or quarantine changes any ranking.

## Guard tests

- `pnpm typecheck`
- `pnpm test`
- `pnpm verify:artifacts`
- `node scripts/evaluate-amazon-sasrec.mjs`

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Real-history validation still used movies and a count-based transition proxy | 0.200 | baseline: largest remaining reviewer risk | 2026-08-05T14:00:00+08:00 |
| 1 | Trained three models after removing repeated reviewer-item events | 0.910 | discarded: only 2,631 users survived, below the frozen 3,000-user gate | 2026-08-05T14:20:00+08:00 |
| 2 | Matched the original SASRec event-retention and leave-two-out protocol | 1.000 | kept: every frozen gate passed across three seeds | 2026-08-05T14:45:00+08:00 |

