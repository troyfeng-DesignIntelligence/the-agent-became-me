# Report: immediate activation versus hold until resolution

## Answer first

Holding delegated shopping evidence outside the principal's platform profile until the task outcome is known prevented recommendation changes during the pending interval without reducing the agent's current-task personalization in this testbed.

The important result is temporal. Immediate activation and later removal reached the same final state as holding and discarding, but they did not produce the same recommendations while the task was still running.

## Evidence

| Measure | Result |
| --- | ---: |
| Shopping tasks | 320 |
| Model-seed task rows | 960 |
| Selected / abandoned tasks | 156 / 164 |
| Pooled in-progress top-10 displacement | 0.766 `[0.741, 0.792]` |
| Pooled provisional exposure AUC | 0.760 `[0.739, 0.782]` |
| Categories with positive displacement interval | 4 / 4 |
| Resolved-state mismatches | 0 |
| Next-task mismatches | 0 |
| Maximum task-utility difference between conditions | 0 |
| Traces using task-local recommendations | 100% |

The paired in-progress displacement estimates were `0.763` for Luxury Beauty, `0.633` for Software, `0.800` for Industrial and Scientific, and `0.870` for Prime Pantry. Their 95% bootstrap intervals were all above zero.

## Did staging hurt current-task personalization?

No difference was observed between lifecycle arms because both retained the same task-local state and replayed the same realized trace. This is not merely a structural assertion: every trace requested and consumed task-local recommendations. A diagnostic run with task-local recommendations disabled produced lower selected-item utility in Software (`0.425` versus `0.975`), Industrial and Scientific (`0.725` versus `0.950`), and Prime Pantry (`0.900` versus `0.975`); Luxury Beauty was tied at `1.000`.

The correct interpretation is that **holding platform-profile activation does not require disabling within-task adaptation**. The experiment does not establish that every implementation of staging is cost-free.

## Reproducibility

- Run: `node scripts/run-delegated-activation.mjs`
- Evaluate: `node scripts/evaluate-delegated-activation.mjs`
- Summary: `public/results/delegated-activation/v1/summary.json`
- Row-level public output: `public/results/delegated-activation/v1/rows.json`
- Public trajectories: `public/results/delegated-activation/v1/trajectories.json`
- Selected-task evidence: `public/evidence/delegated-activation/v1/selected-timeline.png`
- Abandoned-task evidence: `public/evidence/delegated-activation/v1/abandoned-timeline.png`

Public task and item identifiers are hashed. Raw titles, review text, source identifiers, and model checkpoints remain outside the public artifact.

## What this does not establish

- No live Amazon.com behavior or production recommender response was measured.
- The shopping agent is deterministic, not a frontier LLM agent.
- The tasks are generated even though the underlying histories are real public sequences.
- Final-state equality is a replay property, not trained-model unlearning.
- No human preference, trust, comprehension, or perceived control was measured.

## Reviewer-facing claim

> In a paired computational experiment over 320 generated shopping-agent tasks and four public e-commerce sequence datasets, immediate activation changed pending-task recommendations even when later resolution produced the same stored state. Holding task evidence outside the platform profile preserved identical task-local agent utility and eliminated those pre-outcome differences by construction.
