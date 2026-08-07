# V8 confirmatory one-step feedback chain

## Section outline

- Start from the V7 order-induced choice contrast.
- Test whether the selected action changes a later learned-recommender slate.
- Test whether that later slate changes a second categorical agent action.
- Use repeated calls and a byte-identical control to separate arm effects from
  provider variation.
- Stop the claim at one model-system cycle.

## Question

Does recommendation-order-induced agent choice divergence survive action
writeback as a measurable later recommendation and later agent-choice effect?

## Design

The experiment retained the complete V7 frame: 460 tasks crossed with SASRec
and GRU4Rec, giving 920 task-model units. No unit was selected because its V7
actions or later shelves differed.

The deterministic bridge began with the four V7 served-order actions for each
unit. A selected item was appended to the same principal history; abandon
appended nothing. The task's held-out chronological next item was then appended
as a standardized first event for the next task. The same condition-invariant
mask was applied to all four histories before the assigned frozen recommender
emitted a new Top-10. The bridge also replayed the V7 masked-control actions.

The downstream action study served the resulting next shelves to DeepSeek. The
held-out item defined a private token-overlap and price-similarity proxy for the
next task. Provider payloads contained only pseudonymous candidate IDs,
constraint matches, and four derived scalar features. They did not contain
titles, tokens, reviews, user IDs, raw item IDs, histories, or the held-out
item.

Every primary unit received four calls: immediate A/B and held A/B. A
protocol-frozen hash selected 226 task-model units for four additional calls
over one byte-identical state. The categorical energy-distance estimator was
the same repeated-call construction used in V7. Uncertainty came from 5,000
paired task-cluster bootstrap replicates within category.

## Frozen gates

The exposure bridge required a positive DeepSeek served-order lower bound, a
masked-control upper bound below 0.02, valid ten-item slates, and positive point
estimates for both recommender families. The downstream study required a
positive primary lower bound, a byte-identical-control upper bound below 0.05,
failure rates below 5%, and positive point estimates for both recommender
families. All conditions were frozen before the corresponding outcomes were
computed or provider calls began.

## Results

The writeback bridge passed. DeepSeek-sourced V7 actions produced downstream
Top-10 energy displacement 0.035 [0.024, 0.047] under served order and 0.000
[-0.002, 0.002] under the masked control. MiMo-sourced actions reproduced the
served-order direction at 0.025 [0.016, 0.035]. SASRec was 0.018 [0.010,
0.027], and GRU4Rec was 0.052 [0.034, 0.071]. At least one matched next slate
changed in 7.5% [5.5%, 9.6%] of DeepSeek task-model units.

The downstream action gate also passed. DeepSeek's categorical distance over
all 920 primary units was 0.037 [0.020, 0.057]. The byte-identical control over
226 independently selected units was 0.000 [0.000, 0.000]. SASRec was 0.022
[0.004, 0.043], and GRU4Rec was 0.052 [0.026, 0.083]. The matched later-action
change rate was 2.1% [1.1%, 3.1%].

All 4,584 downstream calls returned valid actions. There were no retries,
timeouts, or terminal failures. The recorded cost was $0.474 at the prices
frozen in the protocol.

## Interpretation

The research storefront contains a measurable one-step path:

`learned recommendation order -> agent choice -> recommender writeback -> next
recommendation exposure -> later agent choice`.

This result is narrower than a claim of irreversible or self-reinforcing
personalization. It establishes one later cycle, not repeated amplification.
The next-task proxy is derived from one held-out interaction rather than a
natural-language delegated task. The second action endpoint was run with
DeepSeek only. No human behavior, purchase, decision benefit, welfare effect,
or production recommender was measured.

## Claim-evidence map

| Claim | Evidence | Status |
| --- | --- | --- |
| Order-induced choices change later learned-recommender exposure | DeepSeek bridge 0.035 [0.024, 0.047]; masked control near zero | Supported in the research storefront |
| The bridge is not confined to one action-source provider | MiMo-sourced bridge 0.025 [0.016, 0.035] | Supported |
| The bridge is not confined to one recommender family | Positive SASRec and GRU4Rec intervals | Supported |
| Later exposure changes a second categorical DeepSeek action | 0.037 [0.020, 0.057]; identical control exactly zero | Supported |
| The loop amplifies over time | One later cycle only | Needs a new experiment |
| Outcome gating improves decisions | No calibrated downstream value comparison | Needs a new experiment |
| The effect applies to people or Amazon | No human or production study | Unsupported; do not claim |

## Adversarial self-review

### Contribution

Pass with a narrow claim. Position bias itself is prior work. The remaining
contribution is the isolated activation-to-order-to-action-to-writeback path.

### Writing clarity

Pass. Exposure, action, writeback, and later action are separate estimands.
The report avoids using pollution, irreversibility, or preference change as
observed findings.

### Experimental strength

Pass for a one-step computational mechanism. Both learned recommenders recur,
the full frame is retained, and negative controls remain near zero. The absolute
matched later-action rate is small and is reported rather than hidden.

### Evaluation completeness

Needs a new experiment for long-run or policy claims. A recursive multi-round
study, a natural-language next-task benchmark, and a calibrated outcome-gating
comparison are still absent.

### Method design soundness

Pass within the stated testbed. The held-out item is only an intent proxy, and
the stable independent-call assumption behind categorical energy distance
cannot be proven from temperature-zero diagnostics.
