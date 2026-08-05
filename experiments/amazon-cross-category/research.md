# Research: Cross-category Amazon replication and uncertainty

## Goal

Test whether the learned-ranker task-boundary effect observed in Luxury Beauty
recurs across e-commerce domains, and quantify uncertainty without treating
repeated similarity bands or model seeds as independent users.

## Success metric

- **Metric:** cross-category evidence-readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-amazon-cross-category.mjs`

## Bounded run configuration

- One bounded current-session run; no overnight continuation.
- Maximum 4 iterations; keep policy `pass_only`; `pause_every: never`.
- Three independently initialized model seeds (`7`, `17`, `29`) per category.
- `2,000` deterministic hierarchical bootstrap replicates, seed `20260805`.
- Maximum wall-clock time per category-seed training attempt: 5 minutes.
- Raw data, source identifiers, and checkpoints remain in ignored `artifacts/`.
- No website or paper claim is upgraded unless the frozen evaluator passes.

## Frozen categories and protocol

- **Categories:** Luxury Beauty, Software, Industrial and Scientific, and Prime
  Pantry from Amazon Reviews 2018 5-core.
- **Why these four:** personal-care, digital goods, specialist procurement, and
  replenishment groceries vary in catalog size and likely sequence semantics.
- **Unit:** one reviewer chronology retaining every published review event;
  minimum five events.
- **Split:** per-user leave-two-out; last event test, penultimate validation.
- **Model:** the same one-block SASRec architecture and hyperparameters in every
  category; no category-specific tuning.
- **Evaluation:** one held-out positive plus 99 fixed unseen negatives for
  next-item validity. Task tests use the same title-token family rule, three
  similarity bands, and three lifecycle conditions.
- **Task sample:** up to 500 deterministically selected eligible users per
  category. Each contributes all three bands and all lifecycle contrasts.

## Uncertainty model

- The inferential unit is the user history.
- Within a category, each bootstrap replicate samples model seeds with
  replacement, then users with replacement, retaining all bands and lifecycle
  contrasts for each sampled user.
- Report percentile 95% intervals for persist-all excess exposure,
  outcome-commit excess exposure, their paired difference, spillover rate,
  ranking displacement, and held-out next-item hit change.
- The cross-category estimate gives each category equal weight. A second
  category bootstrap resamples the four categories and repeats the hierarchical
  user/seed resampling.
- Report leave-one-category-out estimates and descriptive between-category
  range. Four categories are too few for a reliable random-effects meta-analysis.

## Research questions

- **RQ-X1:** Does SASRec beat popularity in held-out next-item prediction in
  each category under a shared protocol?
- **RQ-X2:** Is persist-all excess target-family exposure positive in at least
  three of four category-specific 95% intervals?
- **RQ-X3:** Is the equal-category pooled effect positive, including every
  leave-one-category-out estimate?
- **RQ-X4:** Does outcome-only commit attenuate the point estimate in at least
  three categories while quarantine remains exactly invariant?

## Falsification and gates

- **Go:** all 12 models train; SASRec beats popularity in every category;
  persist-all has a positive lower 95% bound in at least three categories; the
  equal-category and all leave-one-out lower bounds are positive; quarantine is
  exactly invariant.
- **Pivot:** learned-model validity passes but fewer than three categories have
  positive persist-all intervals. Report domain heterogeneity and narrow the
  claim to the categories that replicate.
- **No-go:** source hashes are absent, protocols differ by category, paired
  masks differ, fewer than two categories show positive point estimates, public
  artifacts leak source user/item identifiers, or quarantine changes ranking.

## Guard tests

- `pnpm typecheck`
- `pnpm test`
- `pnpm verify:artifacts`
- `node scripts/evaluate-amazon-cross-category.mjs`

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Single-category Luxury Beauty result without inferential intervals | 0.280 | baseline: domain generality and sampling uncertainty unresolved | 2026-08-05T16:00:00+08:00 |
| 1 | Shared SASRec protocol across four categories with hierarchical user/seed bootstrap | 1.000 | kept: every frozen replication, uncertainty, privacy, and falsification gate passed | 2026-08-05T21:45:00+08:00 |
