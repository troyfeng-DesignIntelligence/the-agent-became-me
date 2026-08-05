# External-Validity Study Plan

## Inferential goal

Replace the claim that a single custom ranking formula demonstrates a general
cross-task effect. The test asks whether the paired effect recurs across
content-profile, item-neighborhood collaborative, and sequential-transition
recommenders, with global popularity as an invariant negative control.

## Unit and data

The unit is a real MovieLens user history with at least 20 chronological
positive ratings, crossed with low-, medium-, and high-similarity injected
temporary tasks. Ratings of 4 or 5 are treated as positive interactions. Each
history is split chronologically into a 70% observed prefix and a held-out
future suffix. MovieLens supplies the histories and item genres; it does not
supply delegated tasks, agent actors, or intent labels.

## Counterfactual manipulation

For every user and similarity band, four unseen movies from one genre are
inserted as a counterfactual temporary task. Baseline and treatment share the
same user, candidate set, held-out future, global model, and tie-breaking. The
only difference is whether the injected events are active with weight `1`
(persist), `0.25` (intent-weighted), or `0` (quarantine).

Similarity is the cosine between the observed-history genre centroid and the
one-hot target genre. Low, medium, and high tasks are selected by within-user
quantiles; similarity is measured from data and is never passed into a ranker.

## Outcomes

- excess target-genre slots at 10 above the paired baseline;
- top-10 ranking displacement from the paired baseline;
- change in held-out Recall@10;
- fraction of paired cases with positive excess exposure.

## Alternative explanations and controls

- The candidate pool excludes both observed and injected items in every arm.
- Model parameters and global statistics are trained once without injected
  events; the experiment measures online profile/session interpretation rather
  than global retraining.
- Popularity cannot respond to one user's injected history and is a negative
  control for accidental candidate or tie-breaking differences.
- Quarantine must exactly reproduce the no-injection baseline.
- Genre is a coarse topic proxy and movies are not shopping products; this is
  an algorithm-breadth and real-history validation, not domain transfer.

## Stopping rule

Go only if two personalized families show positive spillover while both
invariance controls pass. Otherwise narrow or stop the general claim.
