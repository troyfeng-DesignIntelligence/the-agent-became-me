# Cross-category Amazon replication

## Outcome

The frozen evaluator passed at `1.000`. A shared SASRec protocol reproduced the
direction of the temporary-task exposure effect in four Amazon Reviews 2018
categories. The effect size varied substantially by category.

## Data and model

| Category | Histories | Retained events | Items | Eligible task users |
|---|---:|---:|---:|---:|
| Luxury Beauty | 3,811 | 34,246 | 1,581 | 500 |
| Software | 1,823 | 12,796 | 802 | 500 |
| Industrial and Scientific | 11,024 | 77,006 | 5,334 | 500 |
| Prime Pantry | 14,180 | 137,788 | 4,970 | 500 |

All categories retain every published review event, use per-user leave-two-out,
and share one SASRec architecture and hyperparameter set. Three model seeds were
evaluated per category. Across all four categories, SASRec's held-out NDCG@10
exceeded popularity and reversed histories changed more than 97% of top-10 lists.

## Uncertainty

The inferential unit is a user history. Each of 2,000 deterministic bootstrap
replicates resamples model seeds and users with replacement while retaining all
three similarity bands for each sampled user. The pooled estimate gives every
category equal weight.

| Category | Persist-all excess slots @10, 95% CI | Outcome-only excess, 95% CI | SASRec − popularity NDCG@10, 95% CI |
|---|---:|---:|---:|
| Luxury Beauty | +0.435 [0.328, 0.565] | +0.355 [0.248, 0.490] | +0.279 [0.268, 0.290] |
| Software | +0.119 [0.015, 0.228] | +0.075 [-0.031, 0.185] | +0.250 [0.235, 0.267] |
| Industrial and Scientific | +0.612 [0.507, 0.708] | +0.531 [0.447, 0.615] | +0.121 [0.115, 0.127] |
| Prime Pantry | +0.119 [0.087, 0.152] | +0.091 [0.057, 0.127] | +0.121 [0.116, 0.126] |
| Equal-category pooled | +0.321 [0.273, 0.369] | — | — |

The category-resampled descriptive interval was [0.117, 0.552]. Every
leave-one-category-out pooled interval remained above zero. Persist-all exceeded
outcome-only commit in all four point estimates, and pre-activation quarantine
was exactly invariant in every paired ranking.

## Interpretation

The direction replicated, but the category estimates ranged by 0.493 top-10
slots. Industrial and Scientific showed a much larger response than Software or
Prime Pantry. The defensible claim is therefore cross-category recurrence with
domain heterogeneity—not a universal commerce effect size.

This remains a counterfactual injection into public review chronologies. Reviews
are not purchases or delegated-agent traces; title-token families are metadata
proxies; SASRec is not Amazon's deployed recommender.

## Reproduce

```bash
pnpm amazon:cross-category:data
pnpm amazon:cross-category:run
pnpm amazon:cross-category:evaluate
```

Raw inputs and checkpoints remain under ignored `artifacts/`. Public summary,
hashed user-level rows, and bootstrap outputs are under
`public/results/amazon-cross-category/v1/`.

