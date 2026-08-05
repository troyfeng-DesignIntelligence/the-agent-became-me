# Research: Cross-Task Pollution Sensitivity

## Goal

Locate the parameter regions in which evidence from an abandoned temporary task changes later recommendation slots, while separating profile-driven excess exposure from ordinary contextual relevance.

## Success metric

- **Metric:** evidence-readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-cross-task-sensitivity.mjs`

## Frozen design

- Five temporary-task scenarios and 20 paired seeds per cell.
- Two lifecycle rules: persist-all and intent-weighted.
- Profile weight: `0.20, 0.35, 0.50, 0.65, 0.80`.
- Per-round decay: `0, 0.15, 0.35, 0.60, 0.85`.
- Follow-up task similarity: `0, 0.25, 0.50, 0.75, 1`.
- Eight follow-up surfaces with six recommendation slots each.
- Pollution is excess temporary-topic exposure above a paired no-temporary-profile counterfactual at the same task similarity.
- No further Amazon navigation or external service use.

## Research questions

- **RQ-S1:** When does profile evidence become strong enough to alter later recommendation slots?
- **RQ-S2:** How quickly must temporary evidence decay to prevent cross-task exposure?
- **RQ-S3:** How does task similarity change the boundary between contextual relevance and profile-driven excess?

## Falsification and gates

- **Go:** the grid contains both zero- and positive-pollution regions, and paired conditions reveal at least one stable boundary shift.
- **Pivot:** profile mass changes but the top-six list never changes; report a ranking-insensitivity result rather than a pollution phase.
- **No-go:** a cell changes when only its counterfactual seed or item pool changes, or contextual relevance is counted as profile pollution.

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Frozen three-factor grid and paired counterfactual metric | 0.200 | baseline | 2026-08-05T00:40:00+08:00 |
| 1 | Executed 250 cells with 100 paired runs per cell | 1.000 | kept: all gates passed | 2026-08-05T01:16:00+08:00 |
