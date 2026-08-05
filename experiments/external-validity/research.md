# Research: Algorithm-Breadth External Validation

## Goal

Test whether cross-task recommendation spillover survives outside the original
hand-authored ranker when real chronological interaction histories are replayed
through multiple recommender families.

## Success metric

- **Metric:** evidence-readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-external-validity.mjs`

## Bounded run configuration

- One bounded current-session run; no overnight or unattended continuation.
- Maximum 4 iterations; keep policy `pass_only`; `pause_every: never`.
- Raw MovieLens files stay in ignored `artifacts/` and are never redistributed.
- Use chronological positive-rating histories, three data-derived task-similarity
  bands, four recommendation families, and paired candidate sets.
- A temporary delegated task is injected counterfactually; MovieLens does not
  contain agent labels or delegated-task ground truth.
- No paper or website claim is upgraded unless the evaluator passes.

## Research questions

- **RQ-E1:** Does injected temporary-task evidence create excess target-topic
  exposure under more than one recommender family?
- **RQ-E2:** Does pre-activation quarantine eliminate the paired effect while
  intent weighting attenuates it?
- **RQ-E3:** How does the effect vary across similarity bands derived from each
  real history rather than set as a ranking parameter?

## Falsification and gates

- **Go:** positive paired spillover appears in at least two personalized
  recommender families, quarantine is invariant, and the popularity control is
  invariant.
- **Pivot:** only the sequential family moves; narrow the paper to recency-
  sensitive recommenders instead of claiming algorithm breadth.
- **No-go:** paired candidate sets differ, quarantine moves, the popularity
  control moves, or fewer than 200 real histories pass the frozen filters.

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Existing evidence used one hand-authored synthetic ranker | 0.200 | baseline: largest reviewer risk retained | 2026-08-05T12:00:00+08:00 |
| 1 | Added 703 real chronological histories, three personalized families, and two invariance controls | 1.000 | kept: all frozen gates passed | 2026-08-05T12:30:00+08:00 |
