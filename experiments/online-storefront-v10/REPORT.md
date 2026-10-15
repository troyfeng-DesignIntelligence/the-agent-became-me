# Counterbalanced final-endpoint audit

## Decision

The frozen counterbalanced final endpoint passed for both providers. The
confirmatory result is therefore the V10 rerun, not the earlier fixed-order
endpoint.

| Provider | Later-choice distance (95% CI) | Matched changes | Units with any change | Identical control |
|---|---:|---:|---:|---:|
| DeepSeek | 0.034783 [0.017391, 0.054348] | 34/1,840 | 18/920 | 0/452 |
| MiMo | 0.017391 [0.005435, 0.031522] | 24/1,840 | 15/920 | 0/452 |

The provider-level lower bounds exceed zero, both recommender-family point
estimates are positive, terminal failure rates are below the frozen threshold,
and each 226-unit byte-identical control is zero.

## Counterbalancing

The four semantic conditions were assigned to call positions with a frozen
four-row cyclic Latin square. Assignment was balanced separately within
category × recommender family × mode strata; order counts differed by at most
one. The four primary order groups contained 231, 228, 231, and 230 units.

Every pairwise call-position comparison in the byte-identical controls was
zero for both providers. Order-specific primary estimates were positive but
imprecise, so subgroup differences are not interpreted.

## Sensitivity to the superseded fixed order

DeepSeek moved from 0.036957 [0.019565, 0.056522] to 0.034783 [0.017391,
0.054348]. MiMo was unchanged at 0.017391 [0.005435, 0.031522]. Across the two
runs, MiMo returned the same semantic action for every condition. DeepSeek
changed 20 of 3,680 primary condition actions (0.54%); this is reported as a
provider stability diagnostic and is not pooled with the confirmatory rerun.

The machine-readable comparison is in
`public/results/online-storefront-feedback-action-counterbalanced/v1/comparison.json`.

## Boundary

This closes the fixed-call-position confound for the one-step endpoint. It does
not establish stationarity from two repeats per arm, long-run amplification,
human behavior, purchase quality, or production-platform effects. MiMo's
SASRec-only interval still crosses zero.
