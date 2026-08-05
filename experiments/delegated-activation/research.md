# Delegated-evidence activation timing

## Research question

When a shopping agent acts for a principal, does holding task evidence outside the principal's platform profile until the outcome is known reduce recommendation changes during the task without reducing the agent's task-local personalization?

## Falsifiable comparison

The experiment replays the same shopping task twice:

- **Immediate activation, then resolution:** viewed products enter the platform-facing history while the task is pending. On success, the history collapses to the selected product; on abandonment, all task events are removed.
- **Hold until resolution:** viewed products remain in task-local state only. On success, the selected product is committed; on abandonment, the staged events are discarded.

The principal history, storefront, agent observations, realized action trace, SASRec checkpoint, candidate mask, outcome, and post-outcome state are paired. The only intended difference is whether pending evidence is visible to the platform-facing recommender.

## Four checkpoints

1. Task start
2. Task in progress
3. Outcome resolved
4. Next task, after appending the same held-out historical event

## Success gates

- The paired top-10 ranking differs during the task in all four categories, with a positive 95% bootstrap interval.
- Outcome-resolved and next-task rankings match exactly.
- Task utility is identical between activation conditions.
- The agent consumes task-local recommendations in every task.

## Outcome

All gates passed. Across 320 tasks and three SASRec checkpoints per category, pooled in-progress top-10 displacement was `0.766` (95% bootstrap interval `[0.741, 0.792]`). All four category intervals were positive. Outcome-resolved and next-task rankings matched exactly, and the maximum paired task-utility difference was zero.

## Claim boundary

This is a computational experiment with a deterministic shopping agent over a frozen local storefront backed by public Amazon Reviews 2018 sequences. It is not a live Amazon.com test, not evidence about Amazon's production recommender, not a human study, and not model unlearning. The defensible phenomenon is **provisional recommendation exposure caused by activation timing under a matched final state**.
