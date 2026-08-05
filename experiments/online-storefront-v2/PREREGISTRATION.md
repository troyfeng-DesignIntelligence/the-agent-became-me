# Online Storefront v2 - Frozen Analysis Protocol

Status: frozen before v2 outcome generation on 2026-08-05. This is a commit-auditable protocol freeze, not a registration in an independent registry.

## Research object

The unit is one generated delegated shopping task attached to one real, chronological Amazon review history. The manipulation changes when task evidence becomes eligible for a frozen SASRec checkpoint. It does not retrain or unlearn the checkpoint.

## Confirmatory questions

1. Under an identical trace and matched resolved state, does immediate platform activation create more task-in-progress Top-10 displacement than holding evidence until outcome resolution?
2. When model recommendations can affect the agent's next action, does activation timing change the resulting trajectory or task outcome?
3. Are inert logging, platform activation, and task-local retrieval mechanically distinguishable?

## Sample-size rule

The earlier 80-task-per-category pilot is used only for design variance. Task-level displacement is first averaged across its three model seeds. The largest category SD was 0.2729. To target a two-sided 95% normal-approximation half-width of 0.05:

`ceil((1.96 * 0.2729 / 0.05)^2) = 115 tasks per category`.

The v2 design therefore freezes 115 tasks in each of four categories, 460 tasks total. It does not choose the count from the observed effect size; the weaker lower-bound-above-0.15 rule would require fewer cases.

## Conditions

| Condition | Event log | Task-local retrieval | Platform activation before outcome | Resolution |
|---|---:|---:|---:|---|
| no-memory | no | no | never | no task evidence retained |
| logged-inert | yes | no | never | audit log remains behaviorally inert |
| immediate-remove | yes | yes | yes | selected item committed; abandoned evidence removed |
| held-outcome | yes | yes | no | selected item committed; abandoned evidence discarded |

The no-memory versus logged-inert comparison audits whether logging itself is behaviorally inert. Immediate-remove versus held-outcome isolates activation timing. Logged-inert versus held-outcome separates task-local retrieval from platform-profile activation.

## Two modes

### Fixed trace

The same realized view sequence, candidate mask, checkpoint, and outcome is replayed across all conditions. The confirmatory estimand is immediate-remove versus held-outcome Top-10 displacement at T1.

### Free running

Recommendations may affect the next viewed product. Two frozen agent policies are used: `constraint-first` and `exploration-first`. This analysis estimates a bundled trajectory effect and is not substituted for the fixed-trace causal contrast.

## Checkpoints and outcomes

- T0: task start.
- T1: task in progress.
- T2: outcome resolved.
- T3: standardized next-task event.

Primary outcome: paired Top-10 displacement at T1 for immediate-remove versus held-outcome in fixed-trace mode.

Secondary outcomes: first affected action, provisional exposure AUC, target-family slots, free-running trace divergence, decision accuracy, selected-item utility, action count, empty-slate count, and protocol failure count.

## Statistical decisions

- Primary go gate: the lower 95% hierarchical-bootstrap bound for fixed-trace T1 displacement is greater than 0.15.
- T2/T3 equivalence: the upper 95% bound for fixed-trace immediate-versus-held displacement is below 0.05.
- Utility non-inferiority: the lower 95% bound for held-minus-immediate decision accuracy and selected utility is above -0.05.
- Tasks and checkpoint seeds are resampled within category; categories are equally weighted; 2,000 replicates use seed 20260805.
- Null and negative effects remain in the released rows and summary.

## Failure and exclusion policy

All generated eligible tasks remain in the analysis. Empty slates, wrong decisions, abandoned tasks, missing checkpoints, timeouts, and protocol deviations are counted. A run is excluded only when a checkpoint cannot be computed; the count and reason must be published.

## Interpretation boundary

This experiment can establish activation-timing effects inside a research-owned replay system backed by trained SASRec checkpoints. It cannot establish Amazon's deployed behavior, human preference change, control comprehension, experienced harm, or model unlearning.

The machine-readable frozen specification is [`protocol.json`](./protocol.json).
