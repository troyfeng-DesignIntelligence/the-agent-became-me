# Algorithm-Breadth External Validation Report

## Outcome

The frozen validation passed all mechanical gates with score `1.000`. It uses
703 real chronological MovieLens histories and 25,308 paired rows across three
personalized recommender families plus one invariant negative control.

The temporary task remains a counterfactual injection. This study replaces the
single-ranker risk; it does not turn MovieLens into observed agent behavior.

## Main results

| Recommender | Lifecycle | Excess target slots @10 | Spillover rate | Top-10 displacement | Recall@10 delta |
|---|---|---:|---:|---:|---:|
| Content centroid | Persist all | 0.469 | 19.7% | 23.0% | -0.0017 |
| Content centroid | Intent weighted | 0.066 | 4.4% | 6.0% | -0.0011 |
| Item neighborhood | Persist all | 0.246 | 19.8% | 13.7% | -0.0070 |
| Item neighborhood | Intent weighted | 0.081 | 7.7% | 4.7% | -0.0010 |
| Sequential transition | Persist all | 1.040 | 50.2% | 93.5% | -0.0771 |
| Sequential transition | Intent weighted | 0.953 | 49.1% | 84.4% | -0.0671 |
| Global popularity | All three contracts | 0 | 0% | 0% | 0 |
| Every recommender | Outcome quarantine | 0 | 0% | 0% | 0 |

## Interpretation

The effect is algorithm-dependent rather than a property of one handcrafted
formula. All three personalized families respond to the same four injected
events, but a short-horizon transition model is substantially more sensitive
than profile or neighborhood models. Downweighting attenuates content and
neighborhood effects but barely changes whether the sequential model spills
over. Pre-activation quarantine is the only tested rule that exactly preserves
the paired no-injection ranking in every family.

Held-out Recall@10 changes are descriptive. The sequential model's larger drop
is consistent with the injected session replacing its recent state, but this
experiment does not estimate user satisfaction or commercial utility.

## Similarity boundary

Task similarity is measured from data, not supplied to any ranker. Mean cosine
similarity was `0.0008`, `0.0846`, and `0.6541` in the low, medium, and high
within-user bands. Effects were not uniformly monotonic: content spillover
peaked in the medium band, item-neighborhood and sequential spillover rose with
similarity. This is a stronger and less convenient result than the original
hand-set similarity grid; it shows that similarity interacts with model family.

## Claim boundary

- MovieLens provides real human rating sequences and item genres.
- The four temporary-task events, their delegated interpretation, and their
  lifecycle labels are counterfactual.
- Movie genres are a coarse topic proxy, not an e-commerce taxonomy.
- Ranking displacement and excess slots are system outcomes, not attention,
  preference change, annoyance, identity harm, or experienced control.
