# Cross-Task Contamination and Recommendation Exposure

## What was tested

Five temporary, other-directed or one-off shopping tasks were each followed by eight rounds of unrelated personal household shopping. Forty paired seeds and six lifecycle contracts produced 1,200 controlled runs. Every recommendation surface contained six slots.

The manipulation changes only when the same temporary-task evidence can affect the stored profile. Catalog items, item quality, ranking weights, tasks, seeds, and deterministic tie-breaking are held fixed.

## Primary results

| Lifecycle contract | Mean provisional excess slots | Mean later temporary slots | Contaminated follow-up rounds | First clean round | Current-task share |
|---|---:|---:|---:|---:|---:|
| Persist all | 2.560 | 24.170 | 4.040 | 5.040 | 49.6% |
| Exact target deduplication | 2.560 | 24.170 | 4.040 | 5.040 | 49.6% |
| Intent weighted | 2.510 | 3.775 | 0.685 | 1.685 | 92.1% |
| Outcome quarantine | 0 | 0 | 0 | 1.000 | 100% |
| Roll back on failure | 2.560 | 0 | 0 | 1.000 | 100% |
| Commit-only scope | 0 | 0 | 0 | 1.000 | 100% |

Persist-all caused temporary-task products to occupy about half of the 48 later recommendation slots. Intent weighting reduced but did not eliminate spillover. Quarantine and rollback were identical after an abandoned outcome, but rollback allowed an average of 2.56 profile-driven excess slots before outcome resolution.

## Measurement correction

The first implementation counted all temporary-topic products on provisional task surfaces. That measure incorrectly labeled contextually appropriate products as profile contamination: quarantine still appeared to expose 21.44 slots despite writing nothing to the profile.

The retained measure subtracts a same-seed, same-surface counterfactual computed from the frozen baseline profile. It therefore counts only additional temporary-topic slots attributable to profile evidence in this model.

## Interactive instrument

The website prototype exposes five understandable lifecycle choices, an abandoned/completed outcome switch, five temporary tasks, and a twelve-step timeline. It recomputes the recommendation shelf from the same deterministic model. It is a research instrument, not usability evidence; no participant has evaluated the labels or interaction.

## What is not established

- The hand-authored recommender estimates Amazon.com or another deployed platform.
- People notice, dislike, or are harmed by the simulated recommendation slots.
- The lifecycle labels are understandable, trusted, or preferred.
- Zero spillover is universally preferable; completed tasks can contain legitimate learning evidence.

## Reproduce

```bash
npm run cross-task:run
npm run cross-task:evaluate
npm test -- --run tests/cross-task-exposure.test.ts
```
