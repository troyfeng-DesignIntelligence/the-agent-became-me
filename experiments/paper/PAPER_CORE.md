# When temporary evidence reaches the shelf

## Working subtitle

Activation timing in a research shopping agent

## Current claim

A shopping agent can use temporary task evidence in two places. A task-local
channel can help with the current job. A platform channel can change the shelf
the agent sees. In a research storefront, activating temporary evidence changed
learned recommendation rankings; recording the same event without activating
it did not.

The confirmatory action study also found a bounded categorical provider-output
contrast. With the
candidate IDs and order fixed, immediate versus held activation changed the
selected-item or abandon distribution after repeated-call variation was
subtracted. The result recurred in DeepSeek and MiMo over the natural 460-task
frame. Earlier 32-task and layout-confounded runs remain withdrawn.

The paper does not claim trained-model deletion, irreversible platform state,
human preference change, or production-retailer effects.

The complete V7 study identifies recommendation-order-induced agent choice
divergence. After explicit rank and inspection fields were removed, changing
only the order of the same candidate records changed categorical choices in
both tested provider models. Candidate-order sensitivity is established in
prior LLM ranking work; the paper does not claim to discover position bias.

The feedback follow-up traces that difference through one additional cycle. V7
choices were written back to the same frozen recommender, which changed later
Top-10 exposure. Serving those later shelves to their source providers changed
a second categorical choice distribution for both DeepSeek and MiMo. This
supports a one-step feedback path inside the research storefront, not a claim
about long-run amplification or people.

## Research questions

### RQ1. Does activation, rather than event recording, change the in-task shelf?

The four-contract storefront separates no state, inert logging, immediate
platform activation, and an outcome-gated hold. Fixed traces keep behavior and
candidate masks constant while activation timing changes.

### RQ2. Does the changed exposure alter the provider model's categorical choice?

The confirmatory action study compares selected-item or abandon distributions
under immediate and held activation. Matched arms receive the same candidate
IDs in the same order, and the inspected candidate remains selectable. Two
independent calls per arm estimate repeated-call variation.

### RQ3. What is the held-minus-immediate difference on the frozen offered-candidate score?

Both timing arms retain task-local retrieval. The new guardrail uses a
continuous, frozen score over offered candidates. The previous binary utility
measure was too coarse to support a non-inferiority claim. Both providers passed
the frozen -0.05 engineering guardrail. The margin is not externally calibrated
and does not define human utility or harmlessness.

### RQ4. Does an order-induced choice survive writeback as later exposure and action?

The V8 bridge writes each V7 selection into the same frozen SASRec or GRU4Rec
history, adds one standardized held-out next event, and measures the next
Top-10. Two confirmatory provider studies serve those next shelves under a
held-out intent proxy. Every stage retains all 920 task-model units rather than
selecting cases that already diverged.

## Evidence retained in the paper

| Evidence | Status | Claim it can support |
|---|---|---|
| Four-contract fixed replay over 460 tasks | Complete | Activation changes in-task rankings; inert logging does not |
| SASRec and GRU replication across four Amazon Reviews categories | Complete | The ranking effect is not confined to one category or encoder in this testbed |
| Free-running deterministic policies | Descriptive | Ranking movement can alter scripted trajectories; policy estimates are not LLM action effects |
| Natural-frame LLM action study | Complete: 7,360 valid calls | Immediate versus held activation changed categorical output distributions in both tested provider models |
| V7 confirmatory instrument ablation | Complete: 29,440 valid calls | Order-only exposure changed categorical agent choices; this does not establish decision quality or human effects |
| V8 deterministic writeback bridge | Complete: 3,680 public rows, no provider calls | Order-induced choices changed a later slate in both learned recommenders and both V7 action-source providers |
| Downstream-agent confirmation | Complete for DeepSeek and MiMo: 9,168 valid actions | The later shelves changed a second choice distribution for both providers under a held-out next-task proxy |
| Product-language policy extension | Pilot: 1,024 valid calls | Order sensitivity recurred; quality intervals included zero; selected-writeback point estimates did not consistently exceed one matched random realization, which is not an equivalence test |
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
not show that a production retailer behaves the same way. The separate action
study below tests model choices under pseudonymous derived features.

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

A first natural-frame implementation was also invalidated. Replicates A and B
used different candidate orders, so within-arm disagreement combined provider
variation with layout sensitivity. DeepSeek completed under that protocol and
MiMo was stopped when the problem was detected. The v6 replacement used one
candidate order for all four calls and an independent output path.

## Replacement action study

The v6 study uses all 460 frozen tasks, 115 per category, without selecting on
opportunity or a proposed mechanism. Every task is evaluated with SASRec and
GRU, giving 920 task-model units per provider.

Each unit has four calls: immediate A, immediate B, held A, and held B. A frozen
Latin-square rotation varies call order. All four calls use the same candidate
order. Immediate A/B have byte-identical task states, as do held A/B; separate
cache scopes force independent provider calls. The common candidate universe is
constructed from both shelves, task-local retrieval, and search. The inspected
item is marked but remains selectable.

The primary statistic is the categorical energy-distance construction
(Szekely and Rizzo, 2013), applied to two repeated calls in each arm:

`2 * mean(immediate != held) - 1[immediate A != immediate B] - 1[held A != held B]`.

Under mutually independent calls from stable categorical output distributions,
it is an unbiased estimate of the squared L2 distance between the two
distributions. The statistic is established; the contribution here is its use
as a control for repeated provider variation, not a new estimator. Temperature
zero does not establish independence or stability. DeepSeek is the primary
provider; MiMo is the prespecified second provider. Providers are analyzed
separately.

The preflight covered all 920 task-model units from 460 distinct source
histories, with one task per source history. Candidate IDs and all four
candidate orders agreed in 920 of 920 units. All 1,840 inspected candidates remained
selectable. Post-resolution platform-input hashes agreed in 920 of 920 units.
The decision-quality score had 323 distinct feasible-candidate values. No API
call was needed for these checks.

The public evaluator now reconstructs every distance, quality contrast, and P0
invariant from pseudonymous action and state primitives. It rejects duplicate
or incomplete task-by-recommender cells. A dated reporting amendment resamples
tasks within category so the fixed equal category weights remain fixed; the
original frozen unstratified intervals remain published. Cached responses were
replayed to publish the primitives without new provider calls.

## Confirmatory action results

All 7,360 v6 provider calls returned valid actions. There were no terminal
failures or timeouts. DeepSeek's overall action-distribution distance was 0.126,
with a task-clustered 95% interval from 0.093 to 0.161. MiMo's prespecified
second-provider estimate was 0.111, with a category-stratified interval from
0.080 to 0.142. Its original frozen interval was 0.079 to 0.144.

Actionable opportunity was uncommon in the natural frame. The highest-ranked
constraint-matching platform candidate differed between arms in 40 of 920
task-model units, or 4.35%, with a 95% interval from 2.93% to 5.98%. Conditional
on those units, the action-distribution estimate was 0.600 [0.348, 0.850] for
DeepSeek and 0.400 [0.143, 0.703] for MiMo. The conditional estimates are
reported beside prevalence; they are not population event rates.

The shared-layout control behaved as intended. DeepSeek within-arm disagreement
was 1.52% in immediate and 0.65% in held calls; MiMo was 1.74% and 2.28%.
Same-layout immediate-versus-held divergence was about 7.5% in both families.

The held-minus-immediate decision-quality difference was -0.0006
[-0.0028, 0.0015] for DeepSeek and +0.0008 [-0.0012, 0.0028] for MiMo after
rounding. Both lower bounds remained above the frozen -0.05 engineering
guardrail. This score is a protocol-defined surrogate over offered candidates,
not human utility, and the margin has no external calibration.

The action contrast was entirely within selected items. Across the two paired
replicates per unit, DeepSeek had 136 selected-candidate swaps and MiMo had 138;
neither provider had a select-to-abandon or abandon-to-select transition. The
result therefore concerns which pseudonymous candidate record was returned, not
whether the model completed or abandoned the task.

## V7 confirmatory instrument ablation

V6 changed a composite prompt representation. Besides `platformRank` and the
`inspected` marker, novelty was computed after the arm-specific inspection. V7
held the candidate set, candidate attributes, and baseline novelty fixed. It
then compared rank only, inspection only, a byte-identical masked control, and
candidate order alone.

The complete study used all 460 frozen tasks, crossed with SASRec and GRU4Rec,
for 920 task-model units per provider. It made 29,440 valid calls with no
failures or timeouts.

DeepSeek's categorical energy distance was 0.193 [0.151, 0.239] for served
order and 0.004 [-0.003, 0.013] for the masked control. MiMo's served-order
estimate was 0.147 [0.110, 0.187], versus 0.000 [-0.007, 0.008] for the masked
control. All changes were selected-candidate swaps.

Both frozen DeepSeek gates passed, and MiMo supplied a same-direction robustness
result. The treatment-meaning P0 is closed within the research-storefront scope.
We name the observed phenomenon recommendation-order-induced agent choice
divergence. Prior work already documents position bias in LLM listwise ranking
and recommendation. V8 therefore tests the narrower residual mechanism:
whether temporary platform activation can enter a measurable one-step
agent-recommender-agent feedback path through that known sensitivity.

## V8 one-step feedback chain

V8 tests whether the V7 choice contrast disappears at the terminal action or
enters the recommender's next state. The first stage uses the four V7 action
replicates for every task-model unit. A selected item is appended to the same
principal history; abandon appends nothing. The held-out chronological next
item is then appended as a standardized first event for the next task. Every
condition uses the same exclusion mask, and the frozen SASRec or GRU4Rec
checkpoint emits a new Top-10 without retraining.

The downstream-slate statistic applies the same repeated-call energy
construction to Top-10 set displacement. DeepSeek-sourced V7 actions produced
a served-order estimate of 0.035 [0.024, 0.047], compared with 0.000
[-0.002, 0.002] in the masked control. MiMo-sourced actions produced 0.025
[0.016, 0.035]. The estimate remained positive for SASRec, 0.018 [0.010,
0.027], and GRU4Rec, 0.052 [0.034, 0.071]. At least one matched next slate
changed in 7.5% [5.5%, 9.6%] of DeepSeek task-model units.

The second stage asks whether the changed shelf alters another agent choice.
Both provider runs retained all 920 units. The held-out next item defined
private token-overlap and price-similarity features; titles, tokens, raw item
IDs, and the held-out item were not sent. In each run, a hash-selected set of
226 units also received four calls over one byte-identical state. DeepSeek and
MiMo each produced 4,584 valid actions; MiMo required five successful retries
and had no terminal failure.

DeepSeek's counterbalanced downstream categorical action distance was 0.035
[0.017, 0.054], with matched-change rate 1.8% [1.0%, 2.8%] (34/1,840 matched
repeat-pair comparisons; 18/920 units with any change). MiMo's was 0.017 [0.005, 0.032],
with matched-change rate 1.3% [0.7%, 2.0%]. Both byte-identical controls were
zero. MiMo's provider-level gate passed and both family point estimates were
positive, but its SASRec-only interval crossed zero: 0.007 [-0.004, 0.020].
GRU4Rec was 0.028 [0.009, 0.052].

Together, V7 and V8 establish a one-step path in this testbed:
`learned recommendation order -> provider choice -> recommender writeback ->
next recommendation exposure -> later provider choice`. The result is a
measurable model-system feedback path. It is not evidence that the effect grows
over repeated cycles, changes human preferences, improves or harms decisions,
or occurs in a production retailer.

## Product-language policy extension

A 64-task extension crossed the same two recommenders with both providers,
producing 128 task-model units, of which 60 contained a feasible offered item.
It served ordinary-language requests plus 12 cleaned title, brand, and price
records. Order-only categorical distances were 0.309 [0.180, 0.453] for
DeepSeek and 0.289 [0.180, 0.414] for MiMo. Holding-minus-immediate success
differences were 0.031 [-0.008, 0.078] and 0.023 [-0.016, 0.066]; regret and
failure intervals also included zero. A fixed three-step continuation showed
recommender-state differences. Selected-event point estimates did not
consistently exceed one deterministic random realization matched on write count
and paired-write equality. Random-baseline assignment uncertainty was not
integrated, so this pilot supports product-language order sensitivity but
establishes neither policy equivalence nor the presence or absence of
selection-specific amplification.

## State and behavior are different estimands

The implementation uses the term temporary task evidence activation. It does
not call fixed-checkpoint context removal model deletion or unlearning.

For an abandoned task, the immediate and held arms must return to the same
platform-input history after resolution. That invariant is checked directly.
If the two arms select different items, any later committed histories are
legitimately different. Those histories are downstream behavior, not a test of
matched-state restoration.

The V6 and V7 action endpoints stop at selected item or abandon. V8 treats
next-task ranking displacement and later action as separate, prospectively
frozen estimands. They are not evidence that a matched resolved state failed to
restore; the histories differ because the agents selected different items.

## Contributions allowed now

1. An empirical separation between event recording and recommendation
   activation in a learned research storefront.
2. A measurement distinction between shelf displacement, trace divergence, and
   categorical provider output.
3. A confirmatory application of categorical energy distance to estimate an
   immediate-versus-held output-distribution contrast while holding selectable
   candidates fixed and measuring repeated-call variation symmetrically in two
   provider models.
4. A confirmatory estimate of recommendation-order-induced agent choice
   divergence linking learned platform exposure to categorical agent action.
5. A confirmatory one-step trace from that action through learned-recommender
   writeback to later exposure and a second categorical agent choice.
6. An outcome-gated interface as an unevaluated design response.

All frozen action and guardrail gates passed. Agent provenance is not
manipulated, so the paper does not claim an ACI-specific causal mechanism.

## Design implication

Task-local recommendation and platform activation can be separate system
operations. The prototype makes that separation visible and lets platform
activation wait for a task outcome. The experiment shows that the timing choice
is behaviorally non-neutral for the tested provider models and can propagate
through one later recommendation cycle. It does not show that holding improves
decisions or that people prefer this control.

## Limits

- There were no human participants.
- Tasks are generated over public, pseudonymized Amazon Reviews histories; they
  are not records of delegated shopping.
- Models and candidate construction belong to a research storefront, not a
  retailer's production system.
- The confirmatory LLM studies used pseudonymous derived features, not rendered
  commerce pages. The extension used cleaned product language but remained a
  64-task research-storefront pilot.
- The V8 next task is a proxy derived from one held-out chronological item. It
  is not a natural-language delegated task or verified user intent.
- The confirmatory chain traces one later cycle. The extension propagates three
  recommender steps with a fixed continuation policy, not repeated LLM calls;
  it does not estimate equilibrium behavior or accumulated value.
- Both providers recur at the downstream action endpoint, but MiMo's
  SASRec-only interval crosses zero.
- The v6 action contrast is the effect of a composite instrument containing
  arm-dependent platform-rank, inspection, and inspection-conditioned novelty.
  V7 isolated and confirmed an order-only signal. Neither confirmatory study
  used a rendered shelf; the small extension used product language.
- Two repeated calls per arm require stable, mutually independent provider
  draws for the categorical-distance interpretation; call diagnostics cannot
  prove those assumptions.
- Checkpoint-seed strata are descriptive because tasks were assigned to one of
  three seeds rather than fully crossed with all seeds.
- The old 32-task LLM pilot is invalidated and supplies no action estimate.
- The quality and product-language token-and-price scores are protocol-defined
  surrogates, not human utility. The pilot policy intervals cannot establish
  equivalence or safety.
- The interface has not been tested for comprehension, trust, control, or use.

## Claim decision

Both providers' final provider-level intervals excluded zero, both
byte-identical controls were zero, and protocol-failure gates passed. The paper
is eligible for the bounded model-action claim stated above, while preserving
the MiMo SASRec subgroup caveat. It is not eligible for claims about people,
Amazon, trained-model deletion, irreversible platform state, or actor
provenance. V7 supports “recommendation-order-induced agent choice divergence”
for categorical outputs in this storefront; the follow-up supports a measurable
one-step agent-recommender-agent feedback path. The product-language pilot does
not establish policy equivalence, safety, selection-specific amplification,
human outcomes, or production-retailer effects.
