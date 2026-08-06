# Matched MiMo–DeepSeek recommendation-exposure pilot

Date: 2026-08-06 (Asia/Shanghai)  
Status: completed negative cross-provider recurrence test

## Frozen question

When recommendation activation changes the shelf shown to a shopping agent, does that exposure change the agent's realized action path beyond divergence from independent repeated model calls?

The exposure contrast compares immediate-remove with held-outcome. The sham contrast compares two independent held trajectories with identical semantic input. The primary persistent-feedback event requires both a divergent action trace and a different protocol-defined next-task Top-10 after outcome handling.

## Matched design

- 32 frozen tasks per provider, eight in each of four Amazon-derived categories.
- MiMo v2.5 and DeepSeek V4 Flash.
- SASRec and GRU4Rec-family recommendation outputs.
- Constraint-first and exploration-first agent policies.
- Four arms: immediate-remove, held-outcome, held-sham-a, and held-sham-b.
- 256 trajectories and 64 paired exposure-plus-sham contrasts per provider.
- Temperature 0, frozen prompts, fixed task order, fixed candidate features, and provider-specific fresh calls.
- Public artifacts exclude original IDs, product titles, review text, histories, prompts, and raw provider responses.

## Reliability and cost

| Provider | Valid actions | Retries | Timeouts | Median latency | Recorded run cost |
|---|---:|---:|---:|---:|---:|
| MiMo v2.5 | 256/256 | 0 | 0 | 1.578 s | ¥0.197918 |
| DeepSeek V4 Flash | 483/483 | 0 | 0 | 1.078 s | $0.048362 |

The MiMo command was resumed after a local tool timeout. Across all 288 successful cached response files created during both executions, the published token rates imply approximately ¥0.222418 total provider cost. This remains far below the authorized ¥2.80 cap. The public summary reports the final completed run's accounting rather than unused responses created before the resume.

Both provider artifacts passed the frozen mechanical evaluator across schema, protocol integrity, coverage, provider identity, sham calibration, disclosure, reliability, privacy, evidence integrity, and claim calibration.

## Result

| Metric | MiMo v2.5 | DeepSeek V4 Flash |
|---|---:|---:|
| Mean in-task Top-10 displacement | 0.696875 | 0.696875 |
| Exposure trace divergence | 0/64 | 11/64 |
| Held-sham trace divergence | 0/64 | 0/64 |
| Persistent-feedback event | 0/64 | 9/64 |
| Sham persistent event | 0/64 | 0/64 |
| Sham-adjusted persistent feedback | 0.000000 | 0.140625 |
| Held minus immediate accuracy | 0.000000 | -0.015625 |
| Held minus immediate selected utility | 0.000000 | -0.015625 |

The recommendation intervention was equally large at the shelf level, yet only DeepSeek changed its action trace. The observed boundary therefore lies in the propagation from recommendation exposure to model action, not in whether the recommender produced a different slate.

## Decision against the frozen gate

The planned provider-replication gate required a positive adjusted effect in both LLM families at confirmatory scale. MiMo's matched pilot estimate is exactly zero, so the evidence does not justify scaling the prior 360-task design unchanged.

This is a useful negative result rather than a failed implementation:

1. Independent held calls produced no observed divergence for either provider, weakening ordinary repeated-call randomness as an explanation for the DeepSeek contrast.
2. Equal shelf displacement did not guarantee behavioral propagation.
3. The original MiMo pilot's divergence did not survive matched decoding and sham controls.
4. Any paper claim must now make model configuration a central boundary condition.

## Next diagnostic study

Before confirmatory scaling, retain the same paired four-arm protocol and vary only mechanisms that could explain action sensitivity:

- deterministic versus mildly stochastic decoding within each provider;
- action-margin difficulty, measured from the utility gap between the top two candidates;
- constraint-first versus exploration-first policy wording;
- recommendation rank perturbations that preserve the candidate set;
- a third provider family as an external boundary check.

The diagnostic stop rule is simple: if exposure divergence remains isolated to one provider after within-provider decoding and action-margin manipulations, frame the contribution as provider-contingent behavioral propagation. If the effect can be induced or removed within both providers by the same mechanism, redesign the confirmatory study around that mechanism rather than provider identity.

## Claim boundary

Observed: within this research storefront and frozen task set, the same mean recommendation displacement changed DeepSeek action paths but not MiMo action paths; neither provider showed held-sham divergence.

Not established: a provider-general LLM effect, a causal attribute of either proprietary model architecture, human behavior, production-retailer consequences, or indefinite irreversibility.
