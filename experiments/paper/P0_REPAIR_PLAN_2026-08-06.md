# P0 repair plan

## Decision

The 32-task deterministic repair pilot is no longer confirmatory evidence. Its
action comparison changed candidate availability, its sample was enriched on a
mechanism variable, and its reported dominance AUC was driven by the split
between enriched and non-enriched tasks. The next-task displacement outcome
also mixed recommendation state with the consequences of different selected
items.

These problems cannot be repaired by changing labels. The public narrative now
treats that pilot as an invalidated audit, and the replacement study has a new
protocol and output path.

## P0 disposition

| P0 | Correction | Completion test |
|---|---|---|
| The inspected item was excluded from the next decision | Build one common candidate universe per paired arm; mark the inspected item but keep it selectable | Every matched arm has identical candidate IDs and every inspected ID is in that set |
| Dominance AUC was selection-confounded | Withdraw it from results and contributions | No main-paper or main-site claim uses the old AUC; any later margin analysis is opportunity-conditional and exploratory |
| “Persistent after deletion” used unmatched realized histories | Remove T3 from the behavioral endpoint; distinguish platform-input restoration from later action consequences | Primary action estimator contains no next-task mask; matched abandoned-task platform-input hashes are equal |
| Agent/delegate provenance was not manipulated | Remove provenance as a causal contribution | Paper describes agent-mediated shopping as the setting, not the treatment mechanism |
| Enriched tasks could not estimate ordinary frequency | Run all 460 frozen tasks without opportunity selection | Sampling code reads the full frame; prevalence and overall effect are reported before the conditional effect |
| LLM variation was asymmetrically controlled | Use two immediate and two held calls with frozen Latin-square call order | Four conditions are present, order is approximately balanced, and both within-arm disagreement rates are reported |
| Current-task “utility” was degenerate | Freeze a continuous offered-candidate quality score and selected-item regret | Preflight finds variation within and across tasks; inference reports paired differences and an interval |
| HCI contribution exceeded the evidence | Keep the interface as an unevaluated design response | No claim of usability, trust, control, comprehension, or human preference change appears |

## Replacement estimand

### Layout-control repair

The first natural-frame implementation used different candidate orders for
replicates A and B. DeepSeek's completed run showed that same-layout cross-arm
disagreement was much lower than different-layout within-arm disagreement. The
within-arm control therefore measured layout sensitivity as well as provider
variation. MiMo was stopped, and no v5 provider output is used for inference.

The v6 protocol uses one frozen candidate order for all four calls in a unit.
Immediate A/B now have byte-identical task states, as do held A/B. The Latin
square changes only condition call order across units.

For an action category `a`, let `p_I(a)` and `p_H(a)` denote the model's action
distributions under immediate and held activation. With two calls per arm, the
unbiased disagreement estimator is:

`2 * mean(I != H) - 1[I_a != I_b] - 1[H_a != H_b]`.

Its expectation is the squared distance between the two categorical action
distributions. This separates an arm effect from repeated-call variation
without pretending that temperature zero makes an API deterministic.

The primary estimate is averaged over the natural 460-task frame, separately
for DeepSeek and MiMo. A second estimate is conditional on a prospectively
defined exposure opportunity. Tasks, rather than task-model rows, are the
bootstrap clusters.

## Claim ladder after repair

The cross-category learned-recommender experiment can support the claim that
temporary task evidence changes research-storefront rankings. It does not show
that model choices change.

The new LLM study may support an action-distribution claim only if the overall
confidence interval excludes zero and the same direction appears in MiMo. A
conditional estimate is reported with its natural prevalence; it cannot replace
the overall estimate.

The project does not claim trained-model deletion, irreversible platform state,
human preference change, or a provenance-specific ACI mechanism. A participant
study would be required before the control prototype becomes an HCI result.

## Execution gates

1. The preflight must cover all 920 task-model units, with no candidate-set or
   post-resolution state mismatch.
2. The decision-quality score must show non-zero variance.
3. Conservative provider cost estimates must remain inside the previously
   approved caps.
4. Protocol, runner, evaluator, and preflight output are committed before live
   calls begin.
5. After calls begin, primary definitions do not change. Failures and timeouts
   remain in the denominator under the frozen missing-data policy.
