# Learned Sequential Commerce Study Plan

## Inferential goal

Test a bounded system mechanism: whether temporary-task evidence that is made
available to a learned sequential recommender changes later recommendation
exposure. This does not treat Amazon reviewers as AI-agent users and does not
claim that the historical reviews contain delegated tasks. The delegation is a
paired counterfactual intervention on otherwise real product chronologies.

## Unit, conditions, and allocation

The analysis unit is a reviewer history crossed with a data-derived low,
medium, or high product-category similarity task and one independently trained
model seed. Up to 600 eligible histories are selected by a deterministic hash,
not by outcome. Every case is evaluated in all lifecycle conditions:

- `persist-all`: four counterfactual task items remain active in sequence;
- `outcome-commit`: only the final selected item is committed;
- `outcome-quarantine`: no temporary item reaches the model.

The model checkpoint, original history, held-out next item, candidate universe,
injected item set, and tie-breaking are fixed within a paired case. Injected
items are excluded from every arm's recommendation candidates.

## Data-derived task similarity

The released Luxury Beauty metadata has empty category and brand fields for
nearly every 5-core item, so product families are derived from title tokens
under a frozen, support-based rule rather than invented category labels.
Alphabetic title tokens that occur in 25–250 catalog items and at least 100
interactions are eligible after generic stop-word removal. A reviewer's
observed token centroid is compared with each eligible family one-hot vector by
cosine similarity. Low, medium, and high tasks are chosen from within-reviewer
similarity quantiles. Similarity is used to select and describe tasks; neither
tokens nor similarity are passed to SASRec as features.

## Outcomes

- excess target-family slots in top 10 above the paired original history;
- top-10 ranking displacement from the paired original history;
- change in held-out next-item hit and rank;
- HR@10 and NDCG@10 for SASRec, popularity, and first-order transition models;
- fraction of histories whose ranking changes when interaction order reverses.

## Alternative explanations and controls

- Global SASRec parameters are trained once per seed without injected events.
- Test and validation events are never used as training targets for that user.
- Evaluation negatives are sampled once and shared by all model comparisons.
- Candidate masking is identical across lifecycle arms.
- Quarantine must be bit-for-bit rank invariant, detecting pairing bugs.
- Popularity tests non-sequential catalog signal; first-order transition tests
  whether the Transformer adds value beyond the last item.
- Reviews are explicit post-use feedback, not clicks or purchases. The study
  establishes e-commerce sequence behavior, not production Amazon causality.

## Decision rule

Only a passing mechanical evaluator can promote the learned-model result to
the paper or site. A null spillover with valid next-item learning is retained
as a scoped negative result.
