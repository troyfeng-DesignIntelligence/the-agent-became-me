# Research Log

## 2026-08-05 — Iteration 0

- Baseline: the paper's cross-task evidence depended on one hand-authored
  synthetic ranker and a manually supplied similarity scalar.
- Evidence-readiness score: `0.200`.
- Decision: largest reviewer risk; do not upgrade the paper claim.

## 2026-08-05 — Iteration 1

- Downloaded GroupLens MovieLens 100K from the official source into ignored
  `artifacts/`; recorded source hashes and redistribution boundary.
- Retained 703 users with at least 20 chronological positive ratings.
- Froze three data-derived similarity tasks per user, four injected events,
  three lifecycle weights, three personalized recommender families, and a
  global-popularity negative control.
- Ran 25,308 paired rows. Evaluator: `1.000`, pass.
- All personalized families showed positive persist-all exposure. Quarantine
  and popularity were exactly invariant. Intent weighting attenuated at least
  two families.
- Decision: keep. Target achieved; no further iteration.
