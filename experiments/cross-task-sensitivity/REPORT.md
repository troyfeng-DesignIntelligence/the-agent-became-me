# Cross-Task Pollution Sensitivity Report

## Outcome

The frozen three-factor experiment completed 25,000 deterministic paired runs across 250 cells. The mechanical evaluator scored the artifact `1.000` and passed all gates.

## Main observations

- 53.6% of cells had zero mean excess exposure; 46.4% had positive exposure.
- High versus low profile weight increased excess exposure by 6.1924 slots on average.
- No decay versus 0.85 per-round decay increased exposure by 11.7292 slots.
- Persist-all exceeded intent-weighted by 5.7836 slots on average.
- Peak: persist-all, profile weight 0.80, decay 0, similarity 1.00; 33.96 excess slots and 100% polluted runs.

## Interpretation boundary

The results establish the behavior of the frozen synthetic ranker. They do not estimate a commercial platform, human attention, preference change, or harm. Task similarity is controlled by a relevance parameter and is subtracted through a paired no-temporary-profile counterfactual.
