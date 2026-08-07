# V7 instrument-ablation pilot

## Decision

The frozen 32-unit pilot passed its scale-up gate. It did not pass the full
DeepSeek confirmatory gate. The next defensible step is a natural-frame V7, not
a paper claim based on this enriched pilot.

## What changed from V6

V6 sent a composite representation: explicit platform rank, an inspected-item
marker, and novelty computed after the arm-specific inspection. The pilot held
the candidate set and all other candidate attributes fixed, then compared four
representations:

1. arm-specific `platformRank` in a shared candidate order;
2. an arm-specific `inspected` marker in a shared order;
3. neither field, with byte-identical immediate and held states;
4. neither field, with the same candidates placed in arm-specific served order.

The 32 task-model units came from a previously committed, outcome-blind task
manifest. It is enriched for recommendation opportunity and therefore cannot
estimate how often the effect occurs in the 460-task natural frame.

## Preflight

All 32 units changed served order between immediate and held activation. Mean
normalized rank displacement was 0.259. Candidate sets matched in every mode,
within-arm repeats were byte-identical, and every masked-control state was
byte-identical across arms. No provider call was used for these checks.

## Results

| Provider | Rank only | Inspection only | Masked control | Served order |
|---|---:|---:|---:|---:|
| DeepSeek | 0.063 [0.000, 0.188] | 0.250 [0.063, 0.438] | -0.047 [-0.125, 0.000] | 0.188 [0.000, 0.375] |
| MiMo | 0.000 [0.000, 0.000] | 0.125 [0.000, 0.313] | 0.063 [0.000, 0.188] | 0.313 [0.125, 0.563] |

Values are categorical energy-distance estimates with within-category paired
task bootstrap intervals. Providers were analyzed separately.

DeepSeek changed action in 7 of 64 matched served-order pairs, compared with 3
of 64 in the masked control. MiMo changed 10 of 64 served-order pairs and 3 of
64 masked pairs. Every change was a selected-candidate swap. There were no
select-to-abandon or abandon-to-select transitions.

All 1,024 provider calls returned valid actions. DeepSeek used 414,800 input
and 11,092 output tokens, for an estimated $0.061 at the protocol price. MiMo
used 400,948 input and 12,967 output tokens, for an estimated CNY 0.427. The
DeepSeek fingerprint was stable throughout the run; MiMo returned no system
fingerprint.

## Interpretation

The served-order result clears the frozen pilot thresholds: DeepSeek's point
estimate exceeded 0.08, exceeded the masked estimate by more than 0.05, and
produced at least four matched changes. It is therefore worth testing the order
representation on the full natural frame.

The pilot does not isolate a single mechanism. The inspection marker also
changed outputs, especially for DeepSeek. V6 should still be described as a
composite prompt-instrument effect. The new result only shows that an
order-based account remains plausible after explicit rank and inspection fields
are removed.

The DeepSeek served-order interval was [0.000, 0.375], so the primary full-study
criterion was not met. MiMo's interval excluded zero, but MiMo was the second
provider and cannot replace the frozen primary. The pilot is a scale-up decision,
not confirmatory evidence.

## Next gate

Run the four modes on the complete 460-task by two-recommender frame. Keep
DeepSeek primary, resample tasks within category, and retain the current
thresholds:

- served-order lower 95% bound above zero;
- masked-control upper 95% bound below 0.05;
- provider failure rate below 0.05.

Even a passing full V7 would leave the consequential-outcome P0 open. A later
study still needs natural-language products and an endpoint such as task
success, regret, or long-horizon recommendation value.

## Artifacts

- Frozen protocol: `experiments/online-storefront-v7/instrument-ablation-pilot-protocol.json`
- Public evaluation: `public/results/online-storefront-instrument-ablation-pilot/v1/evaluation.json`
- Integrity manifest: `public/results/online-storefront-instrument-ablation-pilot/v1/manifest.json`
- Runner: `scripts/run-online-storefront-instrument-ablation.py`
- Evaluator: `scripts/evaluate-online-storefront-instrument-ablation.py`
