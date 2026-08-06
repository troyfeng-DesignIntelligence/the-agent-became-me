# DeepSeek V4 Flash sham-calibrated replication pilot

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed cross-provider pilot; not confirmatory evidence

## Purpose

This pilot asks whether the recommendation-mediated behavioral path observed descriptively with MiMo recurs under an independent LLM family after measuring repeated-call stochastic divergence directly.

The exposure contrast compares immediate platform-recommender activation with outcome-gated activation. The sham contrast independently runs the held condition twice with identical semantic input. Local cache scopes are different, so a zero sham rate is observed model behavior rather than forced response reuse.

## Design

- DeepSeek V4 Flash, non-thinking mode, temperature 0, JSON output.
- Provider fingerprint: `fp_a18b46594c_prod0820_fp8_kvcache_20260402`.
- 32 frozen tasks, eight in each of four Amazon-derived categories.
- Two agent policies and a balanced SASRec/GRU4Rec-family task allocation.
- 256 trajectories and 64 exposure-plus-sham paired contrasts.
- Only pseudonymous candidate identifiers and derived constraint, utility, rank, and novelty features were sent to DeepSeek.

## Reliability and cost

- 483 independent API requests; no cache reuse.
- 483/483 valid structured actions.
- No retries, invalid outputs, or timeouts.
- 324,626 input tokens and 10,410 output tokens.
- Median latency: 1.078 seconds.
- Cost at the provider's published rates: $0.048362, below the authorized $0.42 cap.
- Mechanical evaluator: 1.0 across schema, protocol, coverage, provider identity, sham calibration, disclosure, reliability, privacy, integrity, and claim calibration.

## Observed effects

- Mean in-task recommendation displacement: 0.6969.
- Immediate-versus-held trace divergence: 11/64 (17.19%).
- Held-versus-held sham trace divergence: 0/64.
- Persistent behavioral feedback—trace divergence plus T3 displacement: 9/64 (14.06%).
- Sham persistent behavioral feedback: 0/64.
- Sham-adjusted persistent feedback: +0.1406.
- Sham-adjusted trace divergence: +0.1719.

For 0 events in 64 sham contrasts, the one-sided 95% exact upper bound is approximately 4.57%, below the frozen 5% descriptive sham threshold. This pilot does not have the planned confirmatory task count or its full task-cluster inference.

| Recommender | Policy | Exposure trace | Sham trace | Persistent exposure | Persistent sham | Mean T1 |
|---|---|---:|---:|---:|---:|---:|
| SASRec | constraint-first | 2/16 | 0/16 | 1/16 | 0/16 | 0.7125 |
| SASRec | exploration-first | 3/16 | 0/16 | 3/16 | 0/16 | 0.7000 |
| GRU4Rec-family | constraint-first | 2/16 | 0/16 | 2/16 | 0/16 | 0.7250 |
| GRU4Rec-family | exploration-first | 4/16 | 0/16 | 3/16 | 0/16 | 0.6500 |

The effect was not confined to exploration-first prompts in this provider. Cell counts remain too small to establish prompt or recommender interactions.

| Category | Persistent feedback | Mean T1 | Mean T2 | Mean T3 |
|---|---:|---:|---:|---:|
| Luxury Beauty | 1/16 | 0.6625 | 0.0625 | 0.0125 |
| Software | 1/16 | 0.4625 | 0.0500 | 0.0125 |
| Industrial and Scientific | 3/16 | 0.8000 | 0.1188 | 0.1062 |
| Prime Pantry | 4/16 | 0.8625 | 0.2062 | 0.0688 |

## Task-local guardrail

The aggregate held-minus-immediate difference was -0.015625 for both decision accuracy and selected utility. The point estimates lie inside the frozen ±0.05 margin, but a 32-task pilot cannot establish equivalence. The difference occurred in the GRU exploration-first cell (-0.0625); the other three cells had zero point differences. This negative case remains in the result rather than being averaged away.

## Cross-family interpretation

The earlier MiMo pilot had 9/64 exposure trace divergences and 8/64 persistent-feedback events under its original decoding configuration. DeepSeek had 11/64 and 9/64 respectively. The directional similarity is encouraging, but it is not yet a matched cross-family replication: the MiMo run did not contain independent held sham calls and used provider-default temperature.

The next valid comparison is the already frozen MiMo sham-calibrated pilot. Only after both providers share the same four-arm protocol can the paper estimate cross-family adjusted effects. The 360-task study remains gated on that result and a separate cost authorization.

## Claim boundary

Observed: under DeepSeek V4 Flash and the frozen research protocol, recommendation activation changed agent traces and protocol-defined next-task outputs beyond the observed held-versus-held stochastic baseline.

Not established: confirmatory cross-LLM recurrence, a stable provider-model effect size, human behavioral feedback, production-retailer consequences, or indefinite irreversibility.

Official references: [DeepSeek models and pricing](https://api-docs.deepseek.com/quick_start/pricing), [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/).
