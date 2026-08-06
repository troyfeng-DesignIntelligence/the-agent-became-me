# Temperature 0.3 decoding-sensitivity pilot

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed mechanism pilot; frozen decision = stochasticity-dominated

## Question

Does the matched MiMo–DeepSeek boundary at temperature 0 change when both providers use the same mildly stochastic temperature of 0.3?

The task set, recommender allocation, agent policies, four activation/sham arms, primary events, reliability gates, and privacy boundary were frozen before calls. Only decoding temperature changed.

## Results

| Provider | Temperature | Exposure trace | Sham trace | Persistent exposure | Persistent sham | Adjusted persistent |
|---|---:|---:|---:|---:|---:|---:|
| MiMo v2.5 | 0 | 0/64 | 0/64 | 0/64 | 0/64 | 0.0000 |
| MiMo v2.5 | 0.3 | 2/64 | 0/64 | 2/64 | 0/64 | 0.03125 |
| DeepSeek V4 Flash | 0 | 11/64 | 0/64 | 9/64 | 0/64 | 0.140625 |
| DeepSeek V4 Flash | 0.3 | 9/64 | 5/64 | 9/64 | 4/64 | 0.078125 |

MiMo acquired a small positive exposure response at temperature 0.3 without observed sham divergence. DeepSeek retained the same 9/64 persistent exposure count, but independent held calls also produced 4/64 persistent sham events. Its sham rate therefore crossed the frozen 5% descriptive threshold.

The mechanical decision is **stochasticity-dominated**, because the DeepSeek persistent sham rate exceeded 0.05. The result also contains a decoding-sensitivity signal for MiMo, but it cannot be promoted to clean cross-provider recurrence while one provider's sham process is above its gate.

## Reliability and cost

- MiMo: 256/256 valid actions, no retries or timeouts, ¥0.198026 at the frozen published rates.
- DeepSeek: 480/480 valid actions, no retries or timeouts, $0.048038 at the frozen published rates.
- Both runs used pseudonymous derived candidate features; public files exclude original IDs, titles, reviews, histories, prompts, and raw responses.

## Interpretation boundary

Observed: increasing temperature from 0 to 0.3 introduced two MiMo exposure divergences and five DeepSeek held-sham trace divergences. DeepSeek's adjusted persistent-feedback estimate fell from 0.140625 to 0.078125.

Not established: a monotonic temperature effect, a provider-architecture explanation, cross-LLM recurrence, or a production-agent consequence.

## Next gate

Do not choose a favorable temperature post hoc. Freeze and run the full intermediate grid at 0.1 and 0.2 for both providers, retaining every result. The diagnostic goal is to map whether exposure-adjusted behavior appears before sham divergence becomes substantial.
