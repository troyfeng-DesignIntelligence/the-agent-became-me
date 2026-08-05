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

There are no human participants and no account-level platform data. A bounded
signed-out Amazon probe observes visible storefront surfaces only. The project
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

## Released WebArena trajectory boundary

The released-trajectory analysis observes action labels, outcome annotations,
OCR descriptions, and a bounded screenshot sample from a published GPT-4 CoT
WebArena archive. It establishes that mapped preference-facing actions can occur
in traces labeled as task failures and that executable lifecycle contracts
produce different provisional and final evidence states.

It does not establish that failure causes more profile evidence, that WebArena
implements a personalization pipeline, or that a commercial platform would
persist any mapped action. Evidence mass is an internal replay quantity, not
measured profile divergence, recommendation quality, or user harm. OCR is
model-generated metadata, and the screenshot audit is a Codex inspection rather
than independent human annotation.

“Rollback” is permitted only for the post-write `rollback-on-failure` contract.
The `outcome-quarantine` contract is pre-persistence staging and must not be
described as rollback.

## Signed-out Amazon field-probe boundary

The Amazon probe observes only visible page text, known module headings, item
identifiers exposed in the page, navigation counts, guard signals, and anonymous
cart cleanup. It used one isolated context per condition, default browser
automation signals, no account, and exactly the frozen cumulative budget of 24
document navigations. Raw screenshots remain local and ignored; committed data
contains aggregate features and hashes.

Permitted wording is: "In this bounded signed-out run, the product-view context
introduced two history-related or related-item headings and positive deltas for
the predefined task tokens; idle and search-only did not."

The probe does not establish:

- an internal Amazon profile update;
- account-level or long-term personalization;
- whether a module was personalized, contextual, item-to-item, advertised,
  cached, or assigned by an experiment;
- a general ranking of search, view, and cart signals;
- causality from baseline/post ASIN overlap, because loading, inventory, time,
  locale, advertising, and possible A/B variation were uncontrolled.

The linked controlled lifecycle replay is a local counterfactual model. Its
evidence weights are design parameters, not estimates of Amazon behavior.
Amazon Personalize was not provisioned or queried.

## Cross-task recommendation-exposure boundary

The controlled extension measures temporary-topic recommendation slots in a
hand-authored synthetic recommender. It holds task sequence, catalog, ranking
weights, and paired seed fixed across lifecycle conditions. Provisional excess
exposure subtracts a same-seed, same-surface baseline with no profile write, so
contextually relevant products are not mislabeled as profile-driven exposure.

Permitted wording is: "In the controlled recommender, unrestricted persistence
caused temporary-task products to occupy later unrelated recommendation slots;
intent weighting reduced but did not eliminate this spillover."

It does not establish:

- commercial-platform exposure frequency or duration;
- human attention, interpretation, annoyance, harm, or preference;
- that the ranking weights are behaviorally calibrated;
- that the prototype's control labels are usable, understandable, or sufficient.

The interactive interface is an executable research instrument. Until it is
evaluated with people, it must not be described as a validated consent,
transparency, repair, or user-control mechanism.

## Real-history multi-recommender boundary

The external validation uses 703 chronological MovieLens positive-rating
histories. The histories and genres are observed data; the four temporary-task
events, delegated-agent interpretation, and lifecycle labels are
counterfactual. The experiment supports algorithm-breadth and
algorithm-heterogeneity claims only within the four implemented families.

Permitted wording is: "The paired injection changed rankings in all three
personalized recommender families, with substantially larger displacement in
the sequential-transition family; holding before activation and global popularity remained
invariant."

It does not establish observed agent behavior, a commercial shopping effect,
transfer from movie genres to shopping goals, or human response to displaced
recommendations. The result also falsifies a uniform mitigation claim: intent
weighting strongly attenuated content and neighborhood models but barely
changed the sequential model's spillover rate.

## Learned e-commerce sequence boundary

The Amazon Luxury Beauty experiment uses 3,811 real chronological review
histories and three independently trained SASRec checkpoints. It supports the
narrow claim that a counterfactual temporary-task injection changed rankings
under this learned, order-sensitive recommender, while holding before activation
exactly preserved the paired ranking.

Permitted wording is: “Across three learned SASRec seeds, retaining four
temporary task items added 0.410 mean target-family slots at 10; committing only
the selected outcome reduced the effect to 0.333, while staged hold produced no
ranking change.”

It does not establish observed AI-agent behavior, purchase behavior, a deployed
Amazon effect, a causal platform mechanism, or a human response. Reviews are
implicit-feedback proxies. Product families are derived from title-token
support because the released category and brand fields are almost entirely
empty; they are not an official taxonomy and are not model inputs.

## Cross-category replication boundary

The follow-up applies one frozen SASRec protocol to Luxury Beauty, Software,
Industrial and Scientific, and Prime Pantry. Hierarchical bootstrap intervals
resample users and model seeds while preserving repeated within-user conditions.
All four persist-all 95% intervals were positive; the equal-category estimate
was +0.321 [0.273, 0.369], and every leave-one-category-out lower bound was
positive.

Permitted wording is: “The direction recurred in four public Amazon review
categories under one learned-model protocol, with substantial category
heterogeneity.” Do not write “the effect generalizes to Amazon,” “the true
commerce effect is 0.321,” or “users were influenced.” The category estimates
ranged from +0.119 to +0.612, the tasks remain counterfactual, and only four
category units are available.

## Shopping-agent activation-timing boundary

The generated shopping-agent experiment contains 320 tasks and 960 paired
task-seed rows over four Amazon review-sequence categories. It supports the
narrow claim that immediate platform-profile activation changed recommendations
while a task was pending even though both conditions later reached the same
resolved and next-task rankings. Holding platform activation did not reduce
task utility because both conditions retained identical task-local state.

Permitted wording is: “In this offline paired experiment, in-progress top-10
displacement was 0.766 [0.741, 0.792], all four category intervals were
positive, resolved and next-task states matched exactly, and the maximum
task-utility difference was zero.”

It does not establish behavior of Amazon.com, Amazon's production recommender,
frontier shopping agents, or people. Exact final-state equality is a replay
property, not trained-model state removal.

## Required language

Prefer:

- “In this synthetic testbed…”
- “The simulated updater assigned…”
- “Across the generated configurations…”
- “Reference-profile divergence…”
- “Simulated top-6 ranking loss…”
- “The result motivates a subsequent human evaluation.”
- “Proxy plus staged hold…”

Avoid:

- “Users felt…”
- “The interface builds trust.”
- “The design protects identity.”
- “Platforms currently infer this trait…” without separate evidence.
- “The agent believed…”
- “Impact preview,” when referring to the static distance proxy.
- “Approval,” when referring to the scope-gated contract.
- “Repair” or “rollback,” when referring to holding before activation.
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
