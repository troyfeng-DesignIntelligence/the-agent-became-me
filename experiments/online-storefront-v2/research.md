# Goal

Build and mechanically validate an online-storefront v2 experiment in which four evidence-lifecycle conditions are evaluated with frozen SASRec checkpoints under fixed-trace and free-running agent modes.

# Success Metric

The evaluator returns `pass: true` only when design coverage is complete, the protocol hash matches the frozen protocol, all four conditions and both agent configurations are present, the fixed-trace primary lower 95% bound exceeds 0.15, T2/T3 upper bounds are below 0.05, task-utility non-inferiority bounds exceed -0.05, failure counts are disclosed, and public evidence contains no source identifiers or product titles.

# Constraints

- Evaluator: `node scripts/evaluate-online-storefront-v2.mjs`
- Keep policy: `pass_only`
- pause_every: never
- max_iterations: 1
- Guard: existing v1 evaluators and TypeScript tests remain passing
- Raw IDs, titles, histories, and checkpoints remain under ignored `artifacts/`
- The protocol and analysis thresholds may not change after v2 outcome generation begins

# Current Approach

Reuse the three trained SASRec checkpoints in each of four Amazon Reviews 2018 categories. Generate a precision-derived frozen task set, replay fixed traces, run two condition-sensitive autonomous policies, and publish only pseudonymized rows, aggregate uncertainty, representative model slates, and integrity hashes.

# Search Space

Implementation correctness only: batching, caching, schema validation, deterministic tie-breaking, and browser presentation. Confirmatory thresholds, sample size, conditions, model seeds, and agent parameters are forbidden changes.

# Context & References

- `experiments/online-storefront-v2/PREREGISTRATION.md`
- `experiments/online-storefront-v2/protocol.json`
- `public/results/delegated-activation/v1/rows.json`
- Kang and McAuley, SASRec, ICDM 2018.

# History

| Iteration | Hypothesis | Score | Status | Notes |
|---:|---|---:|---|---|
