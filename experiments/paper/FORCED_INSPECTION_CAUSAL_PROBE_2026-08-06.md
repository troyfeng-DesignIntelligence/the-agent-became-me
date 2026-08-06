# Forced recommendation-inspection causal probe

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed; frozen decision = interaction depth insufficient

## Motivation

Across temperatures 0–0.3, MiMo made exactly one model decision per trajectory and never initiated a product view. DeepSeek initiated 891 views across the corresponding 1,024 trajectories. This left provider identity confounded with interaction depth.

## Intervention

At temperature 0, the controller deterministically viewed the highest-ranked available platform recommendation before the first LLM call. The same 32 tasks, recommendation models, task allocation, and immediate/held/sham arms were reused.

Because the controller-required view can differ mechanically across activation arms, whole-trace divergence was not the primary outcome. The frozen primary event required:

1. a different final selected item or select/abandon outcome; and
2. a different next-task Top-10 ranking after outcome handling.

The exposure event was adjusted by the corresponding independent held-sham event.

## Results

| Provider | Whole trace divergence | Whole-trace persistent event | Resolved action divergence | Persistent resolved action | Sham persistent resolved action | Adjusted resolved effect |
|---|---:|---:|---:|---:|---:|---:|
| MiMo v2.5 | 24/32 | 19/32 | 0/32 | 0/32 | 0/32 | 0.0000 |
| DeepSeek V4 Flash | 22/32 | 18/32 | 6/32 | 6/32 | 1/32 | 0.15625 |

The MiMo browsing trace changed in three quarters of exposure pairs because the required recommendation view differed. Its final action never changed. DeepSeek changed final actions in six exposure pairs versus one sham pair.

The frozen evaluator returns **interaction-depth-insufficient**. Required inspection is enough to alter MiMo's realized browsing history and downstream candidate mask, but not enough to alter its resolved decision under this protocol.

## Reliability and cost

- MiMo: 128/128 valid actions, no retries or timeouts, ¥0.100713.
- DeepSeek: 174/174 valid actions, no retries or timeouts, $0.017108.
- Public artifacts contain only pseudonymous task and candidate fields, aggregate outcomes, and hashes.

## Knowledge gained

The provider boundary cannot be reduced to whether the agent looked at a recommendation. A changed browsing trace can coexist with an unchanged final choice. This makes the measurement distinction substantive: trace divergence is too permissive when a controller or policy mandates intermediate actions.

For this research system, behavioral propagation has at least two separable stages:

`recommendation change → inspected-item/history change → resolved-decision change`

MiMo passed the first transition and stopped before the second; DeepSeek sometimes passed both.

## Design implication

Systems should not treat every changed agent trace as evidence that recommendation exposure changed task resolution. Audits and user controls need separate indicators for provisional browsing-history effects and committed decision effects.

## Claim boundary

Observed: a deterministic platform-recommendation inspection changed MiMo browsing traces without changing any of its 32 paired resolved actions. DeepSeek showed five sham-adjusted persistent resolved-action events.

Not established: why the proprietary model policies differ, whether the effect transfers to other prompts or tools, human consequences, or production-retailer behavior.
# Invalidated causal probe

The probe below is historical audit material. Its forced-inspection controller
changed candidate availability after a view, so it does not identify a pure
recommendation-exposure effect. None of its action counts support the current
paper claim.
