# Failure Does Not Erase the Trail

## Result in one paragraph

Across all 192 released GPT-4 CoT WebArena shopping trajectories, the strict mapper admitted 84 preference-facing actions from 1,740 audited steps. Sixty-six of those actions occurred in failed trajectories. That aggregate does **not** show that failure causes more profile evidence: the release contains 166 failures and only 26 successes, and successful tasks had more mapped events per trace (0.692 vs 0.398). The defensible result is narrower: task failure and preference-evidence persistence are separate lifecycle decisions. A profile updater that persists every mapped action retains 26.86 units of evidence mass from failed tasks. Outcome quarantine and rollback both reduce final failed-task mass to zero, but rollback first exposes a mean provisional profile mass of 0.179, whereas quarantine exposes none.

## Corpus and mapper audit

| Item | Observed value |
|---|---:|
| Released shopping trajectories | 192 |
| Successful / failed | 26 / 166 |
| Raw actions audited | 1,740 |
| Strict preference-facing events | 84 |
| Traces with at least one mapped event | 45 |
| Events in failed trajectories | 66 |
| OCR records available | 84 / 84 |
| OCR-corroborated targets | 80 / 84 (95.2%) |
| Source-verified screenshots inspected | 8 / 8 valid targets |
| Known pagination/sort controls admitted | 0 |

The mapper retains product views, review openings, shortlist/add-to-cart actions, and purchase/reorder actions. Pagination, sorting, and account navigation are excluded. Category and filter links are not used in the primary analysis. The four OCR misses were all visually valid: one long product title, two review links, and one add-to-cart control. The screenshot audit is a supplementary Codex inspection, not independent human annotation.

## RQ1 — Are failed traces loopier?

The answer depends on what counts as the “same” target.

| Repeat key | Repeated events | Share | Traces with repeats |
|---|---:|---:|---:|
| Accessibility node + normalized label | 1 / 84 | 1.2% | 1 |
| Normalized label only | 25 / 84 | 29.8% | 9 |

The exact key is conservative and can miss a product whose accessibility id changes across page states. The label-only key can merge different objects with identical controls, such as several order rows named “Reorder” or several product cards named “Add to Cart.” Therefore the 25× gap is not evidence for one preferred loop rate. It is evidence that repeated-action measurement requires explicit target identity.

This ambiguity changes policy evaluation. Exact-target deduplication reduces failed residual mass from 26.86 to 26.68 (0.7%). Label-only deduplication reduces it to 16.34 (39.2%) but retains only 85.4% of evidence from successful traces. Broader deduplication removes more questionable evidence and more potentially valid evidence at the same time.

## RQ2 — Which lifecycle contract limits failed-task persistence?

| Contract | Mean provisional mass | Mean final mass | Failed residual total | Successful evidence retained |
|---|---:|---:|---:|---:|
| Persist all | 0.179 | 0.179 | 26.86 | 100.0% |
| Deduplicate exact target | 0.178 | 0.178 | 26.68 | 100.0% |
| Intent weighted | 0.065 | 0.065 | 10.59 | 24.3% |
| Outcome quarantine | 0.000 | 0.039 | 0.00 | 100.0% |
| Roll back on failure | 0.179 | 0.039 | 0.00 | 100.0% |
| Scope gated | 0.047 | 0.047 | 9.02 | 0.0% |

Quarantine and rollback finish with the same state in this deterministic replay, but they are observably different during task execution. Rollback removes 26.86 mass after exposure; quarantine stages the same evidence without writing it to the profile. If recommendations can be served, caches updated, or downstream models triggered before rollback, final-state equality is not enough.

Intent weighting and scope gating reduce residual mass, but they do not isolate task failure. Their low successful-evidence retention also shows why “less profile writing” should not automatically be described as better personalization.

## What the experiment establishes

- Released WebArena failures can contain actions that a separate personalization pipeline could interpret as preference evidence.
- Task completion and evidence persistence need separate success criteria.
- Pre-persistence quarantine and post-write rollback are distinct contracts even when their final profile states match.
- Deduplication results are highly sensitive to target-identity semantics.
- A mapper can be audited without a new participant study using released action labels, OCR metadata, bounded screenshot inspection, and integrity hashes.

## What it does not establish

- Failure does not cause more preference evidence; the outcome groups are unbalanced and differ in trace length and task mix.
- Evidence mass is not measured user harm, preference accuracy, profile divergence, or recommendation quality.
- WebArena is not Amazon, and no production recommender is shown to persist these actions.
- OCR and Codex screenshot inspection are not human ground truth or an inter-rater reliability study.
- The lifecycle policies are executable counterfactual contracts, not observed platform behavior.

## Reproduction

```bash
npm run webarena:failure
npm run webarena:failure:evaluate
npm test -- --run tests/webarena-pilot.test.ts tests/webarena-failure-lifecycle.test.ts
```

The aggregate artifact is in `public/results/webarena-failure/v1/summary.json`; task rows and event audit rows are adjacent. Raw released trajectories, OCR, and screenshots remain under ignored `artifacts/` and are not redistributed because the mirror did not declare a dataset license at acquisition time.
