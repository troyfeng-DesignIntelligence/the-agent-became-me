# V9 natural-product-language policy pilot

Status: completed product-language pilot for DeepSeek and MiMo, plus completed full MiMo replication of the final feedback endpoint.

## What was tested

The pilot sampled 64 frozen tasks, 16 from each of four Amazon categories, and crossed each task with SASRec and GRU4Rec for 128 task-model units. Each provider received two byte-identical repeats of two shelves:

- `immediate`: temporary task views affected the shelf while the task was active and were removed at resolution;
- `held`: temporary task views stayed outside platform ranking and were discarded at resolution.

Both arms contained the same 12 cleaned product records. Only their recommendation order could differ. The prompt contained an ordinary-language shopping request and cleaned title, brand, and price fields. It did not contain constraint flags, utilities, ranks, inspection markers, recommender names, user IDs, ASINs, review text, or browsing histories.

Task success, failure, and regret were scored privately against the frozen title-token and price constraints. These are benchmark measures, not human utility.

## Preflight

- 128/128 candidate sets matched across arms.
- 128/128 within-arm repeats were byte-identical.
- 128/128 post-resolution histories matched before a resolved selected item was admitted.
- Recommendation order changed in 126/128 units (98.4%).
- 60/128 units contained at least one feasible offered product; the remaining units required a correct abandon.

## Results

### Natural-language selection divergence

| Provider | Categorical distance | Matched selection-change rate | Protocol failure |
|---|---:|---:|---:|
| DeepSeek | 0.309 [0.180, 0.453] | 0.180 [0.113, 0.250] | 0.000 [0.000, 0.000] |
| MiMo | 0.289 [0.180, 0.414] | 0.191 [0.129, 0.258] | 0.000 [0.000, 0.000] |

Observed: the lower interval bound for the order-only selection estimand was above zero for both providers and both recommender-family point estimates were positive. The original pseudonymous-scalar result therefore survives this small natural-product-language pilot.

### Immediate-write-then-delete versus hold-until-outcome

Differences are `held minus immediate`.

| Provider | Success difference | Regret difference | Failure difference |
|---|---:|---:|---:|
| DeepSeek | +0.031 [-0.008, 0.078] | -0.016 [-0.047, 0.016] | -0.031 [-0.078, 0.008] |
| MiMo | +0.023 [-0.016, 0.066] | -0.008 [-0.043, 0.027] | -0.023 [-0.066, 0.016] |

Observed: point estimates favor holding, but every interval includes zero. This pilot does not show that holding harms current-task performance. It also is not powered to establish equivalence or safety.

### Multistep recommendation propagation and matched-random writeback

Top-10 set displacement after the initial model selection was propagated for three steps with the same fixed top-item continuation policy in every arm.

| Provider | Step | Observed writeback | Matched-random writeback | Observed minus random |
|---|---:|---:|---:|---:|
| DeepSeek | 1 | 0.034 [0.017, 0.052] | 0.034 [0.016, 0.055] | 0.000 [-0.010, 0.010] |
| DeepSeek | 2 | 0.032 [0.015, 0.054] | 0.034 [0.013, 0.059] | -0.002 [-0.025, 0.020] |
| DeepSeek | 3 | 0.040 [0.018, 0.067] | 0.033 [0.012, 0.061] | +0.007 [-0.023, 0.035] |
| MiMo | 1 | 0.027 [0.015, 0.040] | 0.030 [0.018, 0.044] | -0.004 [-0.011, 0.004] |
| MiMo | 2 | 0.025 [0.012, 0.040] | 0.040 [0.020, 0.064] | -0.015 [-0.032, -0.001] |
| MiMo | 3 | 0.025 [0.013, 0.040] | 0.042 [0.022, 0.064] | -0.017 [-0.036, -0.001] |

Each unit used one deterministic hash-selected random pair that matched the
number of writes and whether the two arm-specific writes were equal. A different
admitted event continued to produce different recommendation shelves through
step three. The selected-event point estimates did not consistently exceed this
single random realization; for MiMo they were lower at steps two and three.

This is not an equivalence test. Random-baseline assignment uncertainty was not
integrated, and no superiority or equivalence margin was prespecified. The
defensible interpretation is therefore narrow: model selections can seed
recommender-state differences, while this pilot does not establish either
selection-specific amplification or its absence.

## API accounting

- DeepSeek completed 512 valid calls with no retries or terminal failures. Published-rate estimate: `$0.056527`.
- MiMo completed 512 valid calls with no retries or terminal failures after an exact JSON response-template repair. Published-rate estimate: `¥0.416606`.
- The incomplete pre-repair MiMo calls cost approximately `¥0.375361` and are not included in any row or estimate. Their request caches are ignored because the repaired payload hashes differ.

## Full MiMo final-endpoint replication

The frozen protocol retained all 920 task-model units and 226 byte-identical controls. It completed 4,584 valid actions from 4,589 requests: five invalid attempts were retried successfully, with no terminal failure or timeout. Provider calls used a fixed arm order; the byte-identical controls diagnose repeat variation but do not eliminate every call-position or short-term drift explanation. Published-rate cost was `¥3.465273`.

| Endpoint | Estimate |
|---|---:|
| Later categorical choice distance | 0.017391 [0.005435, 0.031522] |
| Matched later-action change rate | 0.013043 [0.006522, 0.020109] |
| Byte-identical control distance | 0.000000 [0.000000, 0.000000] |
| SASRec-only distance | 0.006522 [-0.004348, 0.021739] |
| GRU4Rec-only distance | 0.028261 [0.006522, 0.052174] |

The frozen overall gate passed. Both recommender-family point estimates were positive, as prespecified, but the SASRec-only interval crosses zero. The confirmatory claim is therefore provider-level recurrence of the final one-step endpoint, not a claim that every recommender-specific interval excludes zero.

Independent validation audited 1,146 public rows, recomputed ten headline estimates and two family estimates, reconciled the cost, and found no protocol failure. The share assessment is `ready-to-share-with-scope-caveats`.
