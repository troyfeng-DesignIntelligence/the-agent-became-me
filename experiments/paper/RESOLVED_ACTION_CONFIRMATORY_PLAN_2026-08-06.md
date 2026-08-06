# Resolved-action confirmatory plan

Status: **deterministic repair pilot passed; provider expansion deferred**.

Prospective update (2026-08-06): a new outcome-independent dominance score and
outcome-blind 32-task opportunity-enriched manifest were frozen before calls.
On deterministic shelves, DeepSeek produced 7/32 exposure events versus 1/32
sham (AUC 0.780, exact `p = 0.0115`); MiMo produced 6/32 versus 0/32 (AUC
0.734, exact `p = 0.0391`). All 13 events occurred on opportunity-changed tasks,
and actual sent-state checks matched 32/32 per provider. The next study should
use a natural, non-enriched sample to estimate opportunity frequency and the
conditional action effect separately. The 360-task plan below is retained as an
audit record and should not be run in its current form.

Post-freeze audit (2026-08-06): only 13/32 DeepSeek tasks were margin-analyzable,
all 13 top-two eligible utility gaps were zero, margin AUC was 0.50, and the
one-sided permutation p-value was 1.00. The historical storefront runner also
left SASRec/GRU4Rec in training mode, so recommender dropout was active. The
three-family plan below remains an audit record and must not be executed until
a deterministic repair pilot and a newly frozen, non-degenerate margin
instrument pass their gates. See `DATA_QUALITY_AUDIT_2026-08-06.md`.

Instrumentation update (2026-08-06): the repaired runner now passes its separate
determinism preflight on 32/32 tasks, including a matching Top-10 shelf hash in
two fresh processes. The confirmatory plan remains paused because this does not
repair the degenerate margin instrument or supply mechanism evidence.

## What is primary now

The primary event is no longer a different browsing trace. It is a different
resolved item-or-abandon outcome that also produces non-zero next-task ranking
displacement. Each task contributes the exposure event minus its independently
generated held-sham event. The task is the unit of analysis.

This change is necessary because the forced-inspection pilot changed 24 of 32
MiMo browsing traces while changing zero MiMo resolved actions. A required
intermediate view is therefore not evidence that the agent made a different
decision.

## Planned three-family temperature-zero study

- 360 unique tasks per LLM family, balanced as 90 per Amazon-derived category.
- Balanced SASRec and GRU4Rec assignment within category.
- Four paired arms: immediate-remove, held-outcome, held-sham-a, held-sham-b.
- One frozen forced-inspection policy and temperature 0.
- DeepSeek is the prospective positive replication.
- MiMo is the prospective near-zero equivalence boundary.
- One independently developed third LLM family is the prospective recurrence
  test; its exact provider and model must be frozen before calls.

DeepSeek and the third family receive Holm-corrected one-sided exact paired sign
tests. MiMo receives a paired equivalence test with a plus-or-minus 0.05 margin.
All families receive category-stratified bootstrap intervals, reliability and
sham gates, current-task equivalence checks, and worst-case missingness analysis.

## Offline mechanism gate before spending

The first gate asks whether DeepSeek's six resolved-action events are
concentrated on tasks where the top two eligible candidates have nearly equal
task utility after the required recommendation inspection. The predictor,
permutation test, AUC threshold, bottom-tertile concentration rule, candidate-
state opportunity audit, and stop rules are frozen in
`candidate-margin-protocol.json`.

If the near-tie gate passes, the larger study retains decision margin as a
pre-specified moderator. If only candidate-state opportunity passes, the paper
pivots from near-tie sensitivity to exposure-created decision opportunity. If
neither passes, no new confirmatory API calls are justified.

Historical decision: **no-go for the original task-utility gap**. That result
was not loosened or reinterpreted. The separately frozen dominance-score repair
pilot later passed. No provider expansion or population-scale call should be
made directly from the old 360-task plan until its sampling and estimands are
refrozen.

## Claim boundary

The study can establish a resolved-action effect inside this research shopping
controller. It cannot establish human preference change, permanent model
contamination, production-retailer harm, or a proprietary model architecture
mechanism.
