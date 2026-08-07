# Research framework after the P0 audit

## Evidence state

One result is established: activating temporary task evidence changed learned
rankings in the research storefront, while inert logging did not.

The confirmatory v6 study also found a categorical provider-output contrast when both arms could
choose from the same candidates in the same order. The result recurred in
DeepSeek and MiMo after within-arm variation was subtracted.

The old 32-task pilot no longer answers the second question. Its action set
changed after forced inspection, its mechanism sample was enriched, and its
next-task outcome used unmatched realized histories. Its event counts and AUCs
are audit material, not findings.

## Evidence chain

| Step | Question | Current evidence |
|---|---|---|
| Shelf | Does activation rather than logging change recommendations? | Complete: four-contract replay, four categories, SASRec and GRU |
| Action | Does changed exposure alter the resolved action? | Complete: DeepSeek 0.126 [0.093, 0.161]; MiMo 0.111 [0.079, 0.144] |
| Guardrail | Does holding reduce current-task decision quality? | Complete: both provider intervals near zero and above the -0.05 margin |
| Interface | How might a system expose activation timing? | Implemented prototype without participant evaluation |

## P0 corrections

- Every matched arm receives the same candidate IDs.
- An inspected item remains selectable.
- Immediate and held arms each have two calls.
- Call order uses frozen Latin-square rotations.
- All 460 tasks enter without opportunity enrichment.
- The primary behavior endpoint stops at selected item or abandon.
- Platform-input restoration and downstream action histories are reported
  separately.
- The dominance AUC and actor-provenance mechanism claims are withdrawn.
- The quality guardrail uses a continuous offered-candidate score with a frozen
  margin and task-clustered interval.

## Contribution boundary

The empirical contribution concerns ranking activation and a bounded model-
action distribution effect in a research storefront. Natural actionable
opportunity occurred in 4.35% [2.93%, 5.98%] of task-model units, so conditional
estimates are reported beside prevalence. The interface is a design response,
not evidence about trust, control, comprehension, or human preference. Agent-
mediated shopping is the setting; provenance is not a causal treatment.

## Writing rule

Do not use pollution, irreversible feedback, deletion failure, or restored
behavior as result labels. Use the measured terms: temporary evidence
activation, shelf displacement, resolved-action distribution, platform-input
restoration, and downstream committed history.
