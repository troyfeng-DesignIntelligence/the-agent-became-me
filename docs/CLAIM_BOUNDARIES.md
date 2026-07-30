# Claim Boundaries

## What is measured

The testbed measures how a simulated platform profile changes when controlled
shopping-agent traces are interpreted under different update and persistence
contracts.

The three primary outcomes are:

1. reference-profile divergence;
2. simulated top-6 ranking loss;
3. current task utility.

For backward compatibility, the result files serialize the first two as
`profileContamination` and `futureRecommendationRegret`. Those field names do
not make divergence a demonstrated harm or ranking loss a prediction about a
real future.

The project also records actor-label error, intent-label error, provenance use,
persistent update rate, hard-constraint violations, and a modeled cost index.

## What is not measured

There are no human participants and no observational platform data. The project
does not measure:

- trust, satisfaction, identity, authorship, consent, or perceived control;
- willingness to use an agent or preference for an interface;
- human time, effort, interruption, or cognitive load;
- actual commercial profile updates or recommendation outcomes;
- prevalence of stale profiles or delegated-task conflicts;
- an LLM's beliefs, intentions, or hidden reasoning.

The title *The Agent Became Me* is an editorial provocation about attribution.
It is not an empirical identity claim.

## Current result boundary

The committed benchmark does **not** establish that provenance-aware updating
is better than simpler regularization. Provenance-aware updating improves on
actor-blind updating, but matched shrinkage with the same summed effective
update weight performs slightly better. The provenance-specific explanation is
therefore falsified in this testbed.

Matched shrinkage is oracle-calibrated per trace from the provenance-aware
observed-intent weights. It is a mechanism control for selective weighting, not
a deployable policy that is wholly independent of intent metadata.

The benchmark does support narrower implementation observations:

- recording provenance without using it leaves updater outcomes unchanged;
- quarantining non-commit evidence changes persistence while holding the paired
  proxy-generated trace fixed;
- no update is optimal when the initial profile equals the evaluator reference,
  but not in the constructed stale-profile stress case.

These are properties of the implemented synthetic system, not general causal
claims about people or platforms.

## Required language

Prefer:

- “In this synthetic testbed…”
- “The simulated updater assigned…”
- “Across the generated configurations…”
- “Reference-profile divergence…”
- “Simulated top-6 ranking loss…”
- “The result motivates a subsequent human evaluation.”
- “Proxy plus quarantine…”

Avoid:

- “Users felt…”
- “The interface builds trust.”
- “The design protects identity.”
- “Platforms currently infer this trait…” without separate evidence.
- “The agent believed…”
- “Impact preview,” when referring to the static distance proxy.
- “Approval,” when referring to the scope-gated contract.
- “Repair” or “rollback,” when referring to pre-persistence quarantine.
- “Confidence interval,” when referring to descriptive P10–P90 ranges.
- “Provenance works,” without the matched-shrinkage result.

## Visual evidence rules

Every visible quantitative result should identify, in the figure or its nearby
plate metadata:

- protocol version;
- study and condition scope;
- run or event count;
- whether the mark is an aggregate, a representative replay, or a conceptual
  schematic;
- that P10–P90 is descriptive when ranges are shown.

Charts must not mix unlike causal contrasts in one apparent trade-off surface.
Study A updater comparisons and Study B behavior/persistence probes are shown in
separate panels. Exact-value tables remain available for analytical figures.

## Submission and reuse

A portfolio artifact may accurately describe itself as a reproducible synthetic
ACI testbed. It should not describe the work as a human-subject HCI study,
validated interface intervention, preregistered experiment, or conference-ready
paper without additional evidence and review.

Anyone quoting a result should cite the protocol version, committed catalog
snapshot, condition, run count, and this claim boundary.
