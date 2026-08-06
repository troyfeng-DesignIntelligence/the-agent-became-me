# When temporary evidence reaches the shelf

## Working subtitle

Activation timing in a research shopping agent

## Current claim

A shopping agent can use temporary task evidence in two places. A task-local
channel can help with the current job. A platform channel can change the shelf
the agent sees. In a research storefront, activating temporary evidence changed
learned recommendation rankings; recording the same event without activating
it did not.

That is the completed empirical claim. Whether the changed shelf also changes
the model's selected item or abandon decision is a separate question. The first
LLM experiment cannot answer it, so its action and mechanism claims have been
withdrawn. A replacement study is frozen and has passed its local preflight,
but its provider results are not yet reported.

The paper does not claim trained-model deletion, irreversible platform state,
human preference change, or production-retailer effects.

## Research questions

### RQ1. Does activation, rather than event recording, change the in-task shelf?

The four-contract storefront separates no state, inert logging, immediate
platform activation, and an outcome-gated hold. Fixed traces keep behavior and
candidate masks constant while activation timing changes.

### RQ2. Does the changed exposure alter the agent's resolved action?

The prospective action study compares selected-item or abandon distributions
under immediate and held activation. Matched arms receive the same candidate
IDs, and the inspected candidate remains selectable. This question is open
until both provider runs and the frozen analysis are complete.

### RQ3. Does holding platform activation reduce current-task decision quality?

Both timing arms retain task-local retrieval. The new guardrail uses a
continuous, frozen score over offered candidates. The previous binary utility
measure was too coarse to support a non-inferiority claim.

## Evidence retained in the paper

| Evidence | Status | Claim it can support |
|---|---|---|
| Four-contract fixed replay over 460 tasks | Complete | Activation changes in-task rankings; inert logging does not |
| SASRec and GRU replication across four Amazon Reviews categories | Complete | The ranking effect is not confined to one category or encoder in this testbed |
| Free-running deterministic policies | Descriptive | Ranking movement can alter scripted trajectories; policy estimates are not LLM action effects |
| Natural-frame LLM action study | Protocol and preflight complete | No action claim until provider calls and clustered analysis finish |
| Control interface | Implemented design response | No usability, trust, comprehension, or preference claim |

## Completed result: activation changed rankings

No-state and inert-log conditions produced the same rankings and traces. In the
fixed storefront replay, immediate activation versus holding produced mean
in-task Top-10 displacement of 0.765, with a 95% bootstrap interval from 0.745
to 0.785. At the standardized post-resolution and next-task checkpoints, the
fixed replay displacement was 0.000.

The learned ranking effect recurred across four Amazon categories. The
equal-category estimate for excess target-family slots was +0.321, with a 95%
interval from +0.273 to +0.369. Category estimates ranged from +0.119 to +0.612.
Holding reproduced the paired baseline under the frozen protocol.

These results concern recommendation exposure in research-owned models. They do
not show that a production retailer behaves the same way, and they do not show
that a changed shelf changes an LLM's final action.

## Why the 32-task action pilot was invalidated

The controller first forced the model to inspect a platform recommendation. The
legacy candidate builder then excluded every viewed item. The inspected item
was therefore absent from the next browse decision. Because immediate and held
arms could inspect different items, the treatment changed candidate
availability as well as exposure.

The pilot also selected 15 opportunity tasks and 17 non-opportunity tasks. All
15 opportunity tasks had low dominance scores, while all 17 non-opportunity
tasks had high scores. The pooled AUC was therefore a group-separation result.
Within the 15 opportunity tasks, the association reversed and was not
significant: DeepSeek AUC 0.313, exact one-sided p = 0.892; MiMo AUC 0.231,
p = 0.961.

Finally, the old persistent event required action divergence and next-task
ranking displacement. The next-task mask included each arm's viewed and
selected items. Once selected items differ, later histories differ by design.
That downstream difference cannot establish that removal failed at a matched
state.

The recorded 7 DeepSeek and 6 MiMo provider-events remain in the repository as
an audit trail. They are not paper results.

## Replacement action study

The v5 study uses all 460 frozen tasks, 115 per category, without selecting on
opportunity or a proposed mechanism. Every task is evaluated with SASRec and
GRU, giving 920 task-model units per provider.

Each unit has four calls: immediate A, immediate B, held A, and held B. A frozen
Latin-square rotation varies call order. Immediate and held calls share a
symmetric candidate universe constructed from both shelves, task-local
retrieval, and search. The inspected item is marked but remains selectable.

The primary estimator is

`2 * mean(immediate != held) - 1[immediate A != immediate B] - 1[held A != held B]`.

In expectation, this is the squared distance between the two categorical
action distributions. It does not assume that temperature zero makes an API
deterministic. DeepSeek is the primary provider; MiMo is the prespecified
replication. Providers are analyzed separately.

The preflight covered all 920 task-model units. Candidate IDs and matched
layouts agreed in 920 of 920 units. All 1,840 inspected candidates remained
selectable. Post-resolution platform-input hashes agreed in 920 of 920 units.
The decision-quality score had 323 distinct feasible-candidate values. No API
call was needed for these checks.

## State and behavior are different estimands

The implementation uses the term temporary task evidence activation. It does
not call fixed-checkpoint context removal model deletion or unlearning.

For an abandoned task, the immediate and held arms must return to the same
platform-input history after resolution. That invariant is checked directly.
If the two arms select different items, any later committed histories are
legitimately different. Those histories are downstream behavior, not a test of
matched-state restoration.

The action endpoint therefore stops at selected item or abandon. Next-task
ranking displacement is not part of the primary behavioral event.

## Contributions allowed now

1. An empirical separation between event recording and recommendation
   activation in a learned research storefront.
2. A measurement distinction between shelf displacement, trace divergence, and
   resolved action.
3. A prospective method for estimating an LLM action-distribution effect while
   holding the selectable candidates fixed and measuring repeated-call
   variation symmetrically.
4. An outcome-gated interface as an unevaluated design response.

The third contribution is methodological until the provider study passes its
frozen gates. Agent provenance is not manipulated, so the paper does not claim
an ACI-specific causal mechanism.

## Design implication

Task-local recommendation and platform activation can be separate system
operations. The prototype makes that separation visible and lets platform
activation wait for a task outcome. This design follows from the ranking result
and the unresolved action question. It has not been evaluated with people.

## Limits

- There were no human participants.
- Tasks are generated over public, pseudonymized Amazon Reviews histories; they
  are not records of delegated shopping.
- Models and candidate construction belong to a research storefront, not a
  retailer's production system.
- The old 32-task LLM pilot is invalidated and supplies no action estimate.
- The new quality score is a protocol-defined surrogate over offered candidates,
  not human utility.
- The interface has not been tested for comprehension, trust, control, or use.

## Next claim gate

An action claim is eligible only if the DeepSeek overall action-distribution
interval excludes zero, MiMo has a positive prespecified replication estimate,
provider failures stay below 5%, and the worst-case decision-quality interval
remains above the frozen -0.05 margin. The natural opportunity rate and the
conditional estimate must be reported beside the overall estimate. Failing any
gate leaves the paper as a ranking-timing paper with a registered null or
inconclusive action study.
