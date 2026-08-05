# Failure-Trail Study Plan

**Status:** completed on the released GPT-4 CoT corpus; primary artifact passes
the frozen evaluator. See `RELEASED_FAILURE_TRACE_REPORT.md`.

## Phenomenon

A browser agent can fail its assigned task after producing a long sequence of product-facing actions. A task evaluator records failure, while a separate personalization pipeline may have already persisted those actions as evidence about the human principal.

## Research questions

1. In released WebArena shopping trajectories, how much mapped preference evidence is repeated within a trace, and how is it distributed across successful and failed outcomes?
2. How do deduplication, end-of-task quarantine, rollback-on-failure, intent weighting, and commit-only scope gating differ in final persistence, provisional exposure, and retention of evidence from successful tasks?

## Unit and corpus

- Unit: one released GPT-4 CoT WebArena shopping action trajectory.
- Corpus: all 192 official shopping tasks, including zero-evidence traces.
- Auxiliary validation: released OCR for the screenshot associated with each mapped action, when available.

## Lifecycle conditions

1. `persist-all`: every mapped event writes immediately and remains.
2. `deduplicate-target`: only the first occurrence of the same accessibility node id plus normalized label within a trace remains. Label-only deduplication is reported separately as a deliberately broad sensitivity analysis.
3. `intent-weighted`: every event writes immediately using the existing explore/consider/commit multipliers.
4. `outcome-quarantine`: evidence is buffered and becomes persistent only if the WebArena task succeeds.
5. `rollback-on-failure`: evidence writes provisionally, then final persistent mass returns to zero if the task fails.
6. `scope-gated`: only an explicit purchase/commit action persists.

## Outcomes

- mapped event count and target-corroboration rate;
- repeated-target event share;
- immediate/provisional evidence mass;
- final persistent evidence mass;
- failed residual mass;
- successful-evidence retention relative to `persist-all`;
- rollback mass and whether provisional exposure occurred.

## Alternative explanations and controls

- **Failure base rate:** report per-task means and success/failure strata; do not interpret the raw 66/84 proportion causally.
- **Trace length:** report steps and mapped events per trace; normalize repeated events within trajectory.
- **Task mix:** stratify by the six frozen task-intent classes.
- **Mapping error:** use explicit target rules, OCR corroboration, and mapping sensitivity variants.
- **Repeated UI navigation:** distinguish identical normalized targets from distinct product/category targets.
- **Final-state equivalence:** report provisional exposure so rollback and quarantine cannot appear equivalent merely because both end at zero.

## Evidence gates

- **Go:** 192/192 traces included; at least 90% OCR record matching for mapped steps; deterministic six-condition replay; repeated-target and provisional/final metrics pass invariants.
- **Pivot:** OCR matching is incomplete but target strings remain parseable; retain action-text analysis and narrow visual-validation claims.
- **No-go:** action targets cannot be associated with trace steps, lifecycle conditions do not preserve frozen traces, or the main pattern disappears under basic target-normalization sensitivity.

Observed gate result: 192/192 traces were included; OCR records existed for
84/84 primary events and corroborated 80/84; all four OCR misses were valid in
the source-verified screenshot audit; all six conditions passed invariants and
the deterministic readiness score was 1.000.

## Claim boundary

Permitted: specified released action traces create different provisional and final evidence mass under executable lifecycle contracts.

Not permitted: failed agents cause real user-profile harm; the mapper reproduces Amazon or WebArena logging; OCR establishes human-perceived relevance; quarantine or rollback provides experienced control.
