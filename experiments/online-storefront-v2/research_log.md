# Online Storefront v2 Research Log

## Protocol freeze

The protocol, sample-size rule, four conditions, two agent configurations, three SASRec seeds, four categories, estimands, equivalence margin, non-inferiority margin, bootstrap seed, and claim boundaries were committed before v2 outcome generation in commit `df4a291`.

The 460-task count was derived from the largest task-level pilot SD, not the pilot mean effect: `ceil((1.96 × 0.2729 / 0.05)^2) = 115` tasks per category.

## Iteration 0 — baseline artifact verification

Hypothesis: the frozen implementation would produce complete model-backed rows and satisfy the confirmatory gates.

Execution:

- Loaded 12 trained SASRec checkpoints across four Amazon Reviews 2018 categories.
- Generated 115 eligible delegated tasks per category.
- Ran four evidence contracts, two agent configurations, fixed-trace and free-running modes.
- Produced 22,080 condition rows and 5,520 paired contrast rows.
- Used 2,000 hierarchical bootstrap replicates with the frozen seed.

Observed results:

- Fixed-trace T1 immediate-versus-held displacement: 0.765, 95% CI [0.745, 0.785].
- Fixed-trace T2 and T3 displacement: 0.000, upper 95% bound 0.000.
- Free-running T1 displacement: 0.781, 95% CI [0.763, 0.799].
- Free-running trace divergence: 36.7%, 95% CI [31.6%, 43.4%].
- Held-minus-immediate decision accuracy and selected utility: 0.000, satisfying the -0.05 non-inferiority margins.
- No-memory and logged-inert rankings and traces matched throughout.
- 8 fixed primary pairs had a null T1 effect and remain in the released rows.
- 162 of 22,080 condition rows recorded an incorrect agent decision; 11,106 ended abandoned; no slates, checkpoints, or protocol runs were missing.

Evaluator result: `pass: false`, `score: 0.9`. The only failed component was `protocolFrozen`. Python retained `0.0` in canonical JSON while JavaScript serialized it as `0`; the protocol content and every scientific gate matched.

Status: baseline retained as an audit event; verifier implementation required a portability fix.

## Iteration 1 — normalized protocol-byte hash

Hypothesis: hashing the normalized bytes of the frozen protocol file, instead of independently reserializing its parsed object, would make Python and JavaScript verification identical without changing any outcome, row, threshold, or statistical result.

Change:

- Both runner and evaluator now hash protocol text after CRLF-to-LF normalization.
- A mechanical refresh script updates only protocol-hash fields and the derived file manifest.
- Descriptive by-category and by-agent breakdowns were added after the confirmatory analysis and are labeled descriptive.

Evaluator output: `pass: true`, `score: 1.0`; all 14 components passed.

Guard results:

- TypeScript passed.
- 29 existing tests passed.
- Every v1 and external-validity evaluator passed.
- Production build passed with 709 modules.
- Desktop and mobile browser QA passed without overflow, console errors, missing model slates, or external product navigation.

Status: kept. Target achieved; the one-iteration implementation budget is complete.
