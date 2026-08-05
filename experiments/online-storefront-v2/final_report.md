# Online Storefront v2 — Final Report

## Outcome

The frozen v2 experiment completed and its mechanical evaluator passed with score 1.0. The public artifact contains 460 tasks, 22,080 four-condition rows, 5,520 paired contrasts, four representative model-backed replay cases, a frozen protocol hash, and file-integrity hashes.

## Confirmatory findings

Under identical fixed traces, immediate activation changed the trained SASRec Top-10 relative to holding evidence until resolution by 0.765 on average, with a 95% hierarchical-bootstrap interval of [0.745, 0.785]. The lower bound exceeded the preregistered 0.15 gate.

At outcome resolution and the standardized next task, fixed immediate and held contexts produced identical Top-10 rankings; both upper 95% bounds were 0.000, below the 0.05 equivalence margin.

When recommendations could affect subsequent actions, immediate and held traces diverged in 36.7% of paired runs [31.6%, 43.4%]. Divergence was 12.7% for the constraint-first policy and 60.9% for the exploration-first policy. Held activation was non-inferior on decision accuracy and selected-item utility under the frozen -0.05 margins.

No-memory and logged-inert remained mechanically identical, showing that an audit log did not affect either retrieval or ranking. This separates recording from behavioral activation in the research system.

## Negative cases

Eight fixed pairs had zero T1 displacement. The released condition table includes 162 incorrect decision rows and 11,106 abandoned rows. No model slate, checkpoint, or protocol run was missing. These counts are part of the result rather than exclusions.

## What changed relative to v1

- Platform slates now come from trained SASRec checkpoints, not the hand-authored Open Food Facts profile ranker.
- Four contracts separate no memory, inert logging, immediate activation, and held activation.
- Fixed and free-running estimands are reported separately.
- Two deterministic autonomous agent policies expose policy-dependent trajectory effects.
- Sample size, thresholds, equivalence, non-inferiority, bootstrap, failure accounting, and privacy rules were frozen before outcomes.
- A static browser replay exposes pseudonymous model slates without shipping raw histories, titles, IDs, or checkpoint tensors.

## Claim boundary

The results establish a trained-model activation-timing effect inside this research-owned replay. The agents are deterministic retrieval-and-planning policies, not frontier LLM agents. The study does not manipulate Amazon.com, measure humans, validate a user control, or demonstrate trained-model unlearning.

## Next scientific step

The computational paper can now center the fixed-trace causal contrast and use free-running divergence as the interaction-mediated extension. A future model-robustness study should add a second learned recommender family. A CHI submission still requires a human study of whether people understand prevention-before-activation versus deletion-after-exposure.
