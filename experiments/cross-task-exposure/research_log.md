# Cross-Task Exposure Autoresearch Log

## Iteration 0 - Frozen design

- **State:** Five temporary task topics, 40 paired seeds, six lifecycle rules, four provisional surfaces, and eight unrelated follow-up rounds were frozen.
- **Metric:** No executable downstream exposure measure existed.
- **Score:** `0.200`.

## Iteration 1 - Total provisional topic exposure

- **Hypothesis:** Counting temporary-topic recommendation slots before task resolution would distinguish quarantine from rollback.
- **Experiment:** Generated 1,200 paired runs and counted all temporary-topic slots on four provisional surfaces.
- **Observed:** Persist-all exposed 24.00 slots, rollback 24.00, and quarantine still exposed 21.44. The latter was not profile contamination: those products were contextually relevant to the active temporary task even when no evidence entered the profile.
- **Decision:** Discard the provisional measure. It conflated contextual ranking with profile-driven exposure.
- **Score:** `0.850`, evaluator pass false.

## Iteration 2 - Paired counterfactual excess exposure

- **Hypothesis:** Subtracting the same-seed, same-surface ranking with no profile write will isolate the extra slots attributable to profile evidence.
- **Experiment:** For every provisional surface, recomputed the ranking from the frozen baseline profile and counted only positive excess temporary-topic slots. Post-outcome metrics were unchanged.
- **Observed:** Quarantine and scope gating produced zero provisional excess. Rollback produced 2.56 excess slots before removing the evidence. Persist-all produced 24.17 later slots across 4.04 rounds; intent weighting reduced this to 3.775 slots across 0.685 rounds. Quarantine, rollback, and scope gating produced zero post-outcome spillover for abandoned tasks.
- **Decision:** Keep. Target reached at `1.000`.

## Claim boundary

The result is causal inside the executable synthetic recommender because catalog, task sequence, ranking weights, and paired jitter are fixed. It is not an estimate of a commercial system, user attention, preference, or harm.
