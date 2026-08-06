# Decoding-temperature dose response

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed four-temperature mechanism diagnostic

## Frozen grid

The same 32 tasks, two recommendation models, two agent policies, four exposure/sham arms, and paired outcomes were run at temperatures 0, 0.1, 0.2, and 0.3 for MiMo v2.5 and DeepSeek V4 Flash. Temperatures 0.1 and 0.2 and their decision rules were committed before either intermediate call.

## Persistent-feedback curve

| Provider | Temperature | Exposure | Sham | Adjusted | Clean under ≤5% sham rule |
|---|---:|---:|---:|---:|---:|
| MiMo | 0.0 | 0/64 | 0/64 | 0/64 | No |
| MiMo | 0.1 | 0/64 | 0/64 | 0/64 | No |
| MiMo | 0.2 | 0/64 | 0/64 | 0/64 | No |
| MiMo | 0.3 | 2/64 | 0/64 | 2/64 | Yes |
| DeepSeek | 0.0 | 9/64 | 0/64 | 9/64 | Yes |
| DeepSeek | 0.1 | 9/64 | 3/64 | 6/64 | Yes |
| DeepSeek | 0.2 | 13/64 | 4/64 | 9/64 | No |
| DeepSeek | 0.3 | 9/64 | 4/64 | 5/64 | No |

The frozen evaluator returns **stochasticity-obscures-low-temperature** because DeepSeek's sham persistent-feedback rate exceeded 0.05 at temperature 0.2. The complete pattern is more informative than the single label: MiMo remained behaviorally inert through temperature 0.2, whereas DeepSeek had positive adjusted feedback at every temperature. At temperature 0.3, MiMo acquired two exposure events, but DeepSeek had already crossed the stochasticity gate.

## Interaction-depth diagnostic

The completed public summaries also reveal a structural policy difference. Every valid trajectory contains one terminal select-or-abandon model action; additional model actions are views.

| Provider | Temperature range | Model views across 256 trajectories | Mean model actions per trajectory |
|---|---:|---:|---:|
| MiMo | 0–0.3 | 0 at every temperature | 1.000 |
| DeepSeek | 0–0.3 | 219–227 | 1.855–1.887 |

MiMo always made a single model decision, while DeepSeek usually inspected a recommendation before resolving the task. Provider and interaction depth are therefore confounded in the current comparison. This offers a concrete alternative to an opaque provider-family explanation.

## Reliability and cost

All temperature 0.1 and 0.2 cells had 100% valid structured actions, zero retries, and zero timeouts.

- MiMo 0.1: ¥0.197506; MiMo 0.2: ¥0.198122.
- DeepSeek 0.1: $0.047530; DeepSeek 0.2: $0.047930.

## Next decisive experiment

At temperature 0, require one deterministic recommendation inspection before the LLM can resolve the task. The primary event must ignore the controller-required view and instead test whether the final selected item or abandon outcome diverges and produces a different next-task ranking. Independent held sham arms remain mandatory.

If forced inspection creates clean MiMo resolved-action feedback, interaction depth explains part of the earlier provider boundary. If MiMo remains inert while DeepSeek remains responsive, the boundary lies beyond simple exposure depth.

## Claim boundary

Observed: MiMo never initiated a product-view model action across 1,024 trajectories spanning four temperatures; DeepSeek initiated 891 views across its corresponding 1,024 trajectories.

Not established: that interaction depth causes the provider difference, that temperature has a monotonic effect, or that either pattern transfers to production agents.
