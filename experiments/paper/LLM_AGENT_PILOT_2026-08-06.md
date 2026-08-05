# MiMo v2.5 Free-Running Agent Pilot

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed pilot; not confirmatory evidence

## Question

When a shopping task is allowed to influence a learned recommender during the task, does the changed recommendation slate alter a free-running LLM agent's subsequent browsing and selection? Does holding task activity outside the platform model avoid that feedback without reducing task-local decision quality?

## Design

- 32 pseudonymous shopping tasks: eight from each of four Amazon-derived categories.
- 64 paired immediate-versus-held contrasts and 256 condition trajectories.
- Xiaomi MiMo v2.5 under two frozen policies: constraint-first and exploration-first.
- SASRec and a GRU4Rec-family sequential encoder, balanced across tasks.
- Four conditions: no memory, logged but recommendation-inert, immediate activation followed by removal, and held activity committed only after success.
- Two browse decisions and one terminal decision at most per trajectory.
- Only pseudonymous candidate identifiers and derived features were sent to MiMo: constraint match, task utility, three ranks, and novelty. Titles, reviews, original identifiers, and histories were not sent.

The first three integration requests produced no valid action because `reasoning: low` consumed the 180-token output budget before visible JSON. Before any valid action or research outcome existed, the protocol was transparently amended to `reasoning: none` and the provider's JSON response mode. The failed requests are integration failures, not study observations.

## Observed results

### API reliability and cost

- Main run: 204 new responses and 64 content-addressed cache reuses.
- One invalid response was repaired by the frozen retry rule; no timeouts occurred.
- Valid action rate: 99.63%.
- Main-run usage: 147,422 input tokens and 5,040 output tokens.
- Main-run cost at the published domestic pay-as-you-go rates: ¥0.157502.
- Conservative cost bound including the three preflight failures: below ¥0.17, within the operator-approved ¥3 cap.
- Median response latency: 2.039 seconds.

### Manipulation and behavioral feedback

- Mean immediate-versus-held recommendation displacement was 0 at task start and 0.6859 during the task.
- Agent traces diverged in 9 of 64 paired contrasts (14.06%).
- Mean displacement remained 0.0844 after outcome resolution and 0.0422 at the next task. These residual differences occurred when earlier recommendation exposure changed the agent's trace or selected item; deleting activity did not rewind the action already taken.
- Logged-but-inert and no-memory traces matched in all 64 contrasts. Event recording alone did not change recommendations or behavior in this implementation.

| Recommender | Prompt policy | N | Mean T1 displacement | Diverged traces | Mean T2 | Mean T3 |
|---|---:|---:|---:|---:|---:|---:|
| SASRec | constraint-first | 16 | 0.6938 | 0/16 | 0.0000 | 0.0000 |
| SASRec | exploration-first | 16 | 0.6875 | 3/16 | 0.1250 | 0.0562 |
| GRU4Rec-family | constraint-first | 16 | 0.6750 | 1/16 | 0.0250 | 0.0125 |
| GRU4Rec-family | exploration-first | 16 | 0.6875 | 5/16 | 0.1875 | 0.1000 |

The pilot therefore suggests an interaction, not a universal agent effect: recommendation activation was more likely to propagate into behavior under the exploration-first policy, but the cell sizes are too small for a confirmatory model-by-policy claim.

### Task-local utility guardrail

| Condition | Correct decisions | Accuracy | Mean selected utility |
|---|---:|---:|---:|
| No memory | 56/64 | 0.8750 | 0.4688 |
| Logged, recommendation-inert | 56/64 | 0.8750 | 0.4688 |
| Immediate activation, then removal | 62/64 | 0.9688 | 0.5625 |
| Held until outcome | 62/64 | 0.9688 | 0.5625 |

Holding task activity outside the platform recommender did not reduce the current task's decision accuracy or selected utility relative to immediate activation in this pilot. Both conditions retained the same task-local retrieval mechanism. This comparison isolates platform-model activation from access to task-local memory.

## Gates

- Passed: valid action rate at least 0.95.
- Passed: timeout rate below 0.05.
- Passed: zero detected privacy-policy violations in the public payload design.
- Passed: complete 32-task, 256-row, 64-contrast coverage and manifest integrity.
- Mechanical evaluator score: 1.0.

The largest observed cell-level task SD was 0.478714. The frozen half-width rule implies 353 tasks per model-by-prompt cell for a 0.05 normal-approximation half-width. This is an unconstrained planning result, not yet the final confirmatory sample size; the estimand and paired binary analysis should be fixed before scaling.

## Claim boundary

Observed: immediate activation substantially changed the recommendation slate; in a minority of paired trials, that exposure changed a MiMo agent's trajectory; holding activity preserved task-local decision quality in this pilot.

Hypothesized: exploratory agent policies are more susceptible to recommendation-mediated feedback, and changed choices can make nominal deletion too late to restore the counterfactual trajectory.

Not established: robustness across LLM families, human behavior, production-retailer behavior, causal mediation by any single candidate feature, or a confirmatory model-by-policy interaction.

## Next experiment

1. Freeze a confirmatory estimand centered on paired trace divergence and downstream T2/T3 persistence, rather than treating all pilot measures as co-primary.
2. Add a second LLM family or a materially different agent implementation; two prompts of one model are not model-family replication.
3. Use the same task-local retrieval in immediate and held conditions, preserving the current isolation of platform activation timing.
4. Predefine paired uncertainty and equivalence tests for task accuracy and utility.
5. Scale only after checking that enough eligible tasks exist in every category and after freezing exclusions for invalid JSON, empty slates, and API failures.

Official API references: [MiMo Responses API](https://mimo.mi.com/docs/en-US/api/chat/responses), [MiMo pay-as-you-go pricing](https://mimo.mi.com/docs/en-US/price/pay-as-you-go).
