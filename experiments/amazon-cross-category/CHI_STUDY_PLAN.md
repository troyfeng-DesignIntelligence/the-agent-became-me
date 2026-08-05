# Study plan: cross-category replication

## Inferential target

The target is not Amazon's deployed recommender. It is the change in a trained
SASRec model's top-10 outputs when temporary task interactions are activated,
under four public Amazon review-sequence categories.

## Conditions and outcomes

Each sampled user history is evaluated in three paired conditions:

1. persist all four temporary task items;
2. commit only the selected outcome item;
3. quarantine all temporary items before model activation.

Primary outcome: paired excess number of task-family items in the top 10.
Secondary outcomes: positive-spillover indicator, top-10 displacement, and
held-out next-item hit change. Quarantine is a falsification control.

## Dependence and uncertainty

The same user appears in three similarity bands and three model seeds. Those
rows are not independent observations. Hierarchical resampling preserves all
within-user rows and separately resamples model seeds. The four-category pooled
estimate is equal-weighted so Prime Pantry cannot dominate merely by size.

## Alternative explanations and controls

- SASRec is compared with popularity and first-order transition baselines.
- One architecture and hyperparameter set is reused without per-category tuning.
- Injected items are excluded from every paired ranking arm.
- Product families use one frozen metadata-derived title-token rule.
- Order reversal tests whether the learned ranker uses chronology.
- Quarantine must reproduce baseline rankings exactly.
- Ratings and review text are excluded from training.

## Claim boundary

Passing supports a cross-category computational replication in public review
sequences. It does not establish human preference change, delegated-agent
behavior, causal effects in production Amazon, or external validity beyond the
four categories and this model class.

