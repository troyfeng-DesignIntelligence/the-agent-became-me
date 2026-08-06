# Deterministic repair pilot report

Status: **frozen mechanism gate passed**.

## Answer first

The redesigned predecision dominance score was non-degenerate before any new
LLM calls, and it predicted persistent resolved-action divergence in the new
32-task deterministic pilot. DeepSeek passed every frozen primary gate. MiMo
showed the same direction independently. Across both providers, all 13 exposure
events occurred on tasks where recommendation exposure changed the actionable
candidate opportunity; no event occurred on the other 17 tasks.

This is an opportunity-enriched mechanism stress test. It does not estimate how
often the mechanism occurs in ordinary task traffic.

## Frozen predecision dominance score

Candidates are eligible only when they satisfy the task constraint. Each
eligible candidate receives an equally weighted score:

`0.25 × (task match + reciprocal platform rank + reciprocal task-local rank + novelty)`

Missing ranks contribute zero. For an arm with at least two eligible candidates,
the separation margin is half the difference between the first and second score.
A one-candidate arm receives `0.5 + 0.5 × score`; a zero-candidate arm receives
`1.0`. The task predictor is the smaller margin across the immediate and held
arms. Lower values mean weaker dominance before the model decides.

The score excludes model responses, selected actions, success/failure, and all
post-decision outcomes. The protocol was committed before the pilot calls in
`dominance-margin-protocol.json`.

## Offline support and task selection

- All 460 screened deterministic tasks had a finite predictor.
- The original balanced 32-task slice had 17 distinct values, a largest point
  mass of 0.40625, and standard deviation 0.450489.
- Only 1/32 tasks in that slice changed actionable opportunity, so the frozen
  gate correctly stopped calls on that sample.
- The full 460-task pool contained 37 opportunity-changed tasks (8.04%).
- An outcome-blind algorithm then selected 32 tasks, balanced across four
  categories and two recommender families, including 15 opportunity tasks.
- The selected set retained 17 distinct predictor values, a largest point mass
  of 0.25, and standard deviation 0.426337.

Task selection used only predecision shelf features. It did not use LLM outcomes
or event labels.

## Pilot results

| Provider | Exposure events | Sham events | Adjusted rate | Dominance AUC | Exact one-sided p | Bottom-tertile events |
|---|---:|---:|---:|---:|---:|---:|
| DeepSeek | 7/32 | 1/32 | 0.1875 | 0.780 | 0.011541 | 5/7 |
| MiMo | 6/32 | 0/32 | 0.1875 | 0.733974 | 0.039057 | 3/6 |

The paired exposure-versus-sham sign test was `p = 0.035156` for DeepSeek and
`p = 0.015625` for MiMo. The DeepSeek dominance permutation test exhaustively
enumerated 3,365,856 assignments; MiMo enumerated 906,192.

DeepSeek was the frozen primary mechanism test. Its reliability, sham,
event-support, AUC, exact-permutation, bottom-tertile, manifest, actual-state,
and privacy gates all passed. MiMo is convergent evidence rather than a second
post-hoc primary endpoint.

## Actual sent-state audit

The evaluator parsed the pseudonymous candidate states actually sent to each
provider and mapped them to the frozen task manifest without publishing raw
prompts, responses, candidate aliases, titles, reviews, or original IDs.

- MiMo: predictor, resolved action, and sham resolved action matched 32/32.
- DeepSeek: predictor, resolved action, and sham resolved action matched 32/32.
- Valid action rate was 100% for both providers; no request timed out.

Observed API cost was CNY 0.101333 for MiMo and USD 0.016706 for DeepSeek.

## What the pilot supports

Safe wording:

> In an opportunity-enriched deterministic research storefront, lower frozen
> predecision separation predicted persistent resolved-action divergence, and
> every event occurred where exposure changed the actionable candidate
> opportunity. The pattern recurred across MiMo and DeepSeek.

Unsafe wording includes natural prevalence, human preference change, permanent
model contamination, production-retailer harm, or provider-general effects.

## Next study

Provider expansion is not the next priority. The useful follow-up is a natural,
non-enriched task sample that reports two quantities separately: how often
activation changes the actionable opportunity, and how often a resolved action
changes when that opportunity exists. The analysis should keep exact sent-state
auditing, paired sham arms, deterministic recommender hashes, and the resolved-
action outcome. A later interface study can test whether people understand the
difference between task-local use, platform activation, and deletion.

## Reproducible artifacts

- Metric protocol: `experiments/online-storefront-v4/dominance-margin-protocol.json`
- Selection protocol: `experiments/online-storefront-v4/repair-pilot-task-selection-protocol.json`
- Pilot protocol: `experiments/online-storefront-v4/deterministic-repair-pilot-protocol.json`
- Selected manifest: `public/results/online-storefront-repair-pilot-selection/v1/selected-task-manifest.json`
- Evaluation summary: `public/results/online-storefront-deterministic-repair-pilot/v1/evaluation/summary.json`
- Public derived rows: `public/results/online-storefront-deterministic-repair-pilot/v1/evaluation/rows.json`
# Invalidated result

The result below is preserved for reproducibility but is not used in the paper.
Forced inspection removed the inspected product from the next candidate list;
the dominance AUC was driven by enriched versus non-enriched task groups; and
the next-task endpoint mixed state with consequences of different actions.
