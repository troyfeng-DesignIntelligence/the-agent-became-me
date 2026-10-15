# Anonymous artifact: recommendation-order writeback audit

This artifact supports the anonymous HAI 2026 poster. It contains frozen
protocols, evaluator and runner source, pseudonymous result primitives, and
aggregate outputs for the three linked computational studies and the
product-language extension.

## Privacy and review boundary

- No API keys, author identities, raw user identifiers, product titles, review
  text, or raw account histories are included.
- Public rows use task-scoped pseudonymous candidate aliases and derived scalar
  features.
- Provider prompts and response schemas are constructed in the runner source.
  Raw natural-language provider responses are not included; categorical outputs,
  hashes, model metadata, and audit primitives are retained.
- The artifact does not contain human-participant or production-retailer data.

## Contents

- `experiments/`: the 320-task Study 1 sizing pilot, frozen 460-task Study 1
  confirmatory protocol, V7 order-instrument protocol, V8 writeback bridge and
  downstream-action protocols, the V9 product-language protocol, and the V10
  counterbalanced DeepSeek and MiMo endpoint protocols.
- `scripts/`: runners and evaluators. Re-evaluation of the included public rows
  makes no provider calls.
- `public/results/delegated-activation/`: 320-task pilot rows used only for the
  confirmatory sample-size calculation.
- `public/results/online-storefront-v2/`: 460-task Study 1 confirmatory rows,
  paired contrasts, model metadata, summary, and integrity manifest. The paper's
  `0.765 [0.745, 0.785]` result comes from this directory.
- `public/results/online-storefront-instrument-ablation-confirmatory/`: V7 rows, provider metadata, corrected
  task-cluster evaluation, and integrity manifest.
- `public/results/online-storefront-feedback-bridge/`: V8 one-step recommender writeback rows and summary.
- `public/results/online-storefront-feedback-action/` and
  `public/results/online-storefront-feedback-action-mimo/`: superseded
  fixed-order endpoint rows retained for the sensitivity audit.
- `public/results/online-storefront-feedback-action-counterbalanced/`: the
  confirmatory V10 DeepSeek and MiMo rows, preflight order audits, run metadata,
  evaluations, and fixed-order comparison.
- `public/results/online-storefront-natural-language-policy/`: cleaned
  product-language pilot rows, validation, manifest, and evaluation.

## Re-evaluate the frozen results

From the artifact root with Node.js and a Python environment with NumPy:

```text
node scripts/evaluate-online-storefront-v2.mjs

python scripts/evaluate-online-storefront-instrument-ablation.py \
  --provider both \
  --protocol experiments/online-storefront-v7/instrument-ablation-confirmatory-protocol.json

python scripts/evaluate-online-storefront-feedback-action.py \
  --protocol experiments/online-storefront-v10/deepseek-counterbalanced-endpoint-protocol.json

python scripts/evaluate-online-storefront-feedback-action.py \
  --protocol experiments/online-storefront-v10/mimo-counterbalanced-endpoint-protocol.json

python scripts/compare-online-storefront-feedback-action-counterbalance.py

python scripts/evaluate-online-storefront-natural-language-policy.py \
  --protocol experiments/online-storefront-v9/natural-language-policy-protocol.json
```

Repository-relative paths in the frozen protocols are preserved. The public
evaluation files can also be inspected directly without rerunning model
inference.

The corrected V7 task-cluster evaluation should report:

- DeepSeek served order: `0.193478 [0.151087, 0.239130]`;
- DeepSeek masked control: `0.003804 [-0.003261, 0.012500]`;
- MiMo served order: `0.147283 [0.110313, 0.186957]`;
- MiMo masked control: `0.000000 [-0.006522, 0.007609]`.

The Study 1 evaluation should pass every integrity component and report fixed-
trace in-task Top-10 displacement `0.765454 [0.744851, 0.784639]`, with zero
fixed-trace displacement at resolution and at the standardized next task.

The downstream evaluations should report:

- DeepSeek later-choice distance `0.034783 [0.017391, 0.054348]` and matched
  change rate `0.018478 [0.009783, 0.028261]` (`34/1,840` comparisons;
  `18/920` units with any change);
- MiMo later-choice distance `0.017391 [0.005435, 0.031522]` and matched change
  rate `0.013043 [0.006522, 0.020109]` (`24/1,840`; `15/920` units);
- zero distance and zero matched changes in both 226-unit byte-identical
  controls.

The product-language evaluation should report order-only distances of
`0.309 [0.180, 0.453]` for DeepSeek and `0.289 [0.180, 0.414]` for MiMo. Its
holding-minus-immediate success, regret, and failure intervals all include
zero. Against one deterministic random realization matched on write count and
paired-write equality, step-three selected-minus-random displacement is `0.007
[-0.023, 0.035]` for DeepSeek and `-0.017 [-0.036, -0.001]` for MiMo. This pilot
does not establish equivalence or absence of selection-specific amplification.

## Known limitations

The confirmatory studies use pseudonymous scalar records, two calls per arm,
one later step, and a held-out-item next-task proxy. The 64-task extension uses
cleaned titles, brands, and prices, but its token-and-price score is not human
utility, only 60/128 task-model units contain a feasible offered item, and later
steps use a fixed policy. The final provider endpoint used a frozen four-row
cyclic Latin square within category, recommender, and mode strata. The public
artifact contains prompt-construction code and schemas rather than
instantiated provider payloads or raw responses. These results do not identify
human behavior, purchase quality, task benefit, production effects, policy
equivalence, or long-run amplification.
