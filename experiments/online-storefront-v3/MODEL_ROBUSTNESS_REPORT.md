# Online storefront model robustness

## Design

The preregistered extension holds the v2 task set, four evidence contracts, two
deterministic agent policies, fixed/free modes, four Amazon Reviews 2018
categories, three seeds, candidate masks, and bootstrap hierarchy constant. It
changes only the learned sequence encoder:

- SASRec: one-block causal self-attention.
- GRU4Rec-family baseline: one-layer gated recurrent unit.

Both encoders use 32-dimensional item embeddings, a maximum history length of
50, dropout 0.2, and the same sampled binary next-item objective. This is a
controlled encoder comparison, not a reproduction of every session-parallel
optimization detail in the original GRU4Rec paper.

The final artifact contains 44,160 condition rows and 11,040 paired contrasts.

## Model validity

Mean test NDCG@10 exceeded global popularity for both models in all four
categories. Reversing histories changed at least 93.9% of Top-10 rankings in
every model-category cell.

| Model | Category | NDCG@10 | Popularity | First-order transition | Reversed-history Top-10 changed |
|---|---|---:|---:|---:|---:|
| SASRec | Luxury Beauty | 0.463 | 0.198 | 0.423 | 97.4% |
| GRU | Luxury Beauty | 0.386 | 0.197 | 0.442 | 97.8% |
| SASRec | Software | 0.303 | 0.049 | 0.278 | 99.8% |
| GRU | Software | 0.162 | 0.050 | 0.276 | 93.9% |
| SASRec | Industrial and Scientific | 0.300 | 0.176 | 0.252 | 98.8% |
| GRU | Industrial and Scientific | 0.276 | 0.164 | 0.244 | 99.6% |
| SASRec | Prime Pantry | 0.279 | 0.145 | 0.224 | 99.8% |
| GRU | Prime Pantry | 0.275 | 0.175 | 0.234 | 99.6% |

The recurrent model did not beat the first-order transition control in Luxury
Beauty or Software, and one Software seed was notably weak. These are retained
limitations. The preregistered validity gate was superiority to non-personalized
global popularity, not superiority to every learned or heuristic baseline.

## Confirmatory recurrence

| Model | Fixed T1 displacement, 95% CI | Free T1 displacement, 95% CI | Free trace divergence, 95% CI |
|---|---:|---:|---:|
| SASRec | 0.766 [0.746, 0.786] | 0.781 [0.762, 0.799] | 36.8% [31.6%, 43.3%] |
| GRU | 0.745 [0.639, 0.813] | 0.756 [0.646, 0.825] | 30.3% [25.2%, 35.0%] |

Both model families passed the frozen lower-bound gate for fixed-trace T1
displacement. T2 and T3 displacement were exactly zero for both, satisfying
the equivalence gate. No-memory and logged-inert also matched for both.

## Descriptive model difference

The preregistered question concerned recurrence, not model superiority. A
post-confirmatory paired bootstrap therefore labels GRU-minus-SAS differences
as descriptive:

- Fixed T1 displacement: -0.021 [-0.140, 0.050].
- Free T1 displacement: -0.026 [-0.143, 0.046].
- Free-running trace divergence: -0.064 [-0.106, -0.015].

The first two intervals include zero. The last suggests that, in this testbed,
the same deterministic policies propagated recommendation changes into fewer
distinct trajectories under the recurrent encoder. This is evidence of model
dependence in trajectory amplification, not a general ranking of architectures.

## Claim boundary

The experiment supports recurrence across two learned sequence-encoder
families under a shared offline protocol. It does not establish architecture
independence, production recommender behavior, human response, or LLM-agent
behavior.
