# Natural-frame action study

## Decision

The v6 study passed its frozen action, second-provider, reliability, and decision-
quality gates. The paper may claim that immediate versus held activation changed
categorical provider-output distributions in this research storefront. The claim is limited to
the tested models, pseudonymous derived product features, and frozen task frame.

It may not be described as human preference change, an Amazon effect,
trained-model deletion, irreversible platform state, or a provenance-specific
ACI mechanism.

## Design

- 460 frozen tasks, 115 in each of four Amazon Reviews categories.
- SASRec and GRU evaluated on every task: 920 task-model units per provider.
- Two separately issued immediate calls and two separately issued held calls per unit.
- One common candidate universe and one candidate order across all four calls.
- The inspected candidate remained selectable.
- Frozen Latin-square condition order.
- DeepSeek primary; MiMo prespecified second-provider robustness check.
- 5,000-replicate bootstrap clustered by task, retaining both encoders inside
  each task cluster.

## Results

| Estimate | DeepSeek | MiMo |
|---|---:|---:|
| Overall categorical energy distance | 0.126 [0.093, 0.161] | 0.111 [0.080, 0.142] |
| Conditional distance on opportunity units | 0.600 [0.345, 0.846] | 0.400 [0.146, 0.690] |
| Same-layout immediate-versus-held divergence | 0.0739 [0.0571, 0.0918] | 0.0750 [0.0587, 0.0924] |
| Immediate within-arm divergence | 0.0152 [0.0076, 0.0239] | 0.0174 [0.0098, 0.0261] |
| Held within-arm divergence | 0.0065 [0.0022, 0.0120] | 0.0228 [0.0141, 0.0326] |
| Held-minus-immediate offered-candidate score | -0.0006 [-0.0028, 0.0015] | +0.0008 [-0.0012, 0.0028] |
| Protocol failure rate | 0.000 | 0.000 |

The natural actionable-opportunity rate was 40/920, or 4.35% [2.93%,
5.98%]. Opportunity meant that the highest-ranked constraint-matching platform
candidate in the common universe differed between immediate and held arms.
Platform ranks changed in 98.15% of units, and the inspected identity changed in
74.24%; those broader manipulation checks were not substituted for actionable
opportunity.

The direction was positive for both recommender encoders. DeepSeek estimates
were 0.122 for SASRec and 0.130 for GRU; MiMo estimates were 0.117 and 0.104.
Category point estimates were also positive in all eight provider-category
cells, ranging from 0.057 to 0.165. These subgroup values are descriptive; the
task-clustered provider estimates above carry the bounded claim.

The reporting intervals above use within-category task resampling so the fixed
equal category weights remain fixed. The original frozen unstratified intervals
remain in the public evaluation; they lead to the same decision. The evaluator
recomputes all main quantities from public pseudonymous primitives and rejects
duplicate or incomplete cells.

Every observed paired cross-arm transition was a selected-candidate swap. No
provider changed between select and abandon. The result is therefore a
categorical output contrast over pseudonymous records, not a task-completion or
purchase effect.

## Provider accounting

| Provider | Valid calls | Terminal failures | Input tokens | Output tokens | Published-rate cost |
|---|---:|---:|---:|---:|---:|
| DeepSeek | 3,680 | 0 | 3,074,936 | 74,986 | $0.451487 |
| MiMo | 3,680 | 0 | 2,984,660 | 90,996 | ¥3.166652 |

## P0 audit trail

The old 32-task action pilot remains invalid because forced inspection changed
candidate availability, mechanism sampling drove the pooled dominance AUC, and
the persistent endpoint mixed platform input with consequences of different
actions.

The v5 natural-frame run also remains invalid. Its A/B controls used different
candidate orders. DeepSeek's within-arm disagreement was then roughly 28%, far
above same-layout cross-arm disagreement. The v6 run changed only that control:
all four calls received the same order. v5 outputs were not pooled, corrected,
or reused.

## Reproducibility

- Protocol: `experiments/online-storefront-v6/natural-action-study-protocol.json`
- Runner: `scripts/run-online-storefront-natural-action.py`
- Evaluator: `scripts/evaluate-online-storefront-natural-action.py`
- Public evaluation: `public/results/online-storefront-natural-action-v2/v1/evaluation.json`
- Raw provider payloads and responses remain in ignored local artifacts.
