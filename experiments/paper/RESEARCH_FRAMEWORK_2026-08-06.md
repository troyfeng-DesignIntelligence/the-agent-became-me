# Research framework after the P0 audit

## Evidence state

One result is established: activating temporary task evidence changed learned
rankings in the research storefront, while inert logging did not.

One question remains open: whether that exposure changes an LLM shopping
agent's selected item or abandon decision when both arms can choose from the
same candidates.

The old 32-task pilot no longer answers the second question. Its action set
changed after forced inspection, its mechanism sample was enriched, and its
next-task outcome used unmatched realized histories. Its event counts and AUCs
are audit material, not findings.

## Evidence chain

| Step | Question | Current evidence |
|---|---|---|
| Shelf | Does activation rather than logging change recommendations? | Complete: four-contract replay, four categories, SASRec and GRU |
| Action | Does changed exposure alter the resolved action? | Open: v5 protocol and 920-unit preflight complete; provider results pending |
| Guardrail | Does holding reduce current-task decision quality? | Open: nondegenerate score frozen; paired analysis pending |
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

The empirical contribution currently concerns ranking activation. The action
study contributes a prospective method until its gates pass. The interface is a
design response, not evidence about trust, control, comprehension, or human
preference. Agent-mediated shopping is the setting; provenance is not a causal
treatment in this study.

## Writing rule

Do not use pollution, irreversible feedback, deletion failure, or restored
behavior as result labels. Use the measured terms: temporary evidence
activation, shelf displacement, resolved-action distribution, platform-input
restoration, and downstream committed history.
