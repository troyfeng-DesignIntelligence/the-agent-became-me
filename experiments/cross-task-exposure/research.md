# Research: Cross-Task Contamination and Recommendation Exposure

## Goal

Measure whether evidence from an abandoned temporary delegated task changes the recommendation slots shown during a subsequent unrelated personal task, and compare six lifecycle contracts on both provisional and post-outcome exposure.

## Success metric

- **Metric:** evidence-readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-cross-task-exposure.mjs`

## Constraints

- Maximum 4 iterations; five minutes per iteration; keep policy `pass_only`.
- No further Amazon navigation, scraping, login, purchase, or external service provisioning.
- Five temporary task topics, 40 paired seeds, six frozen lifecycle contracts.
- Four provisional recommendation surfaces and eight unrelated follow-up rounds, six slots per surface.
- The ranking rule, item pool, task sequence, and paired jitter remain fixed across conditions.
- Exposure is a synthetic recommender outcome, not user harm, attention, preference, or a commercial-platform estimate.

## Research questions

- **RQ1:** How much temporary-task content appears in recommendation slots during a later unrelated task when evidence persists?
- **RQ2:** Which lifecycle contracts reduce post-outcome spillover, and which still allow provisional exposure before task outcome is known?
- **RQ3:** How quickly does the unrelated current task recover its recommendation share under partial attenuation versus unrestricted persistence?

## Falsification and gates

- **Go:** persist-all produces positive cross-task exposure and at least one contract separates provisional from final exposure.
- **Pivot:** profile mass differs but no recommendation slot changes; reframe the contribution as state lifecycle rather than downstream exposure.
- **No-go:** quarantine and rollback cannot be distinguished at any recommendation surface, or results are explained by unequal item pools or seeds.

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Frozen exposure design; no executable simulator or downstream metric | 0.200 | baseline | 2026-08-04T21:05:00+08:00 |
| 1 | Counted all temporary-topic slots on provisional task surfaces | 0.850 | discarded: contextual relevance was conflated with profile-driven excess exposure | 2026-08-04T21:57:00+08:00 |
| 2 | Subtracted a paired no-profile-write counterfactual on each provisional surface | 1.000 | kept: target achieved | 2026-08-04T22:01:00+08:00 |
