# Neutral review packet: temporary evidence activation in a research storefront

## Research question

When a shopping agent generates task-specific interaction evidence, does making
that evidence active in a learned platform recommender before the task outcome
is known change the recommendation shelf and the model's resolved action,
relative to holding the same evidence outside platform personalization?

## Phenomenon and setting

The study models a shopping agent operating a research-owned storefront. The
same task interaction can be recorded without affecting recommendation, made
active immediately, or held until the task resolves. Task-local retrieval is
available in both immediate and held conditions. The platform recommender is
separate from the task-local channel.

Tasks were generated over pseudonymized histories derived from four public
Amazon Reviews categories. They are not records of real delegated shopping.
The tested platform recommenders are SASRec and GRU sequence encoders trained
inside the research storefront. The action models are DeepSeek and Xiaomi MiMo.
They receive pseudonymous derived candidate features rather than rendered pages
or natural-language product descriptions.

## Current studies and evidence

### Ranking study

A four-condition fixed replay compares no state, inert logging, immediate
platform activation, and outcome-gated holding. It includes 460 tasks, with 115
tasks from each category, and evaluates both recommender encoders on every task.
Behavior traces and candidate masks are fixed. No-state and inert logging
produce the same shelves. Immediate versus held activation produces mean Top-10
displacement 0.765 with a task-bootstrap 95% interval of [0.745, 0.785]. The
equal-category estimate for excess target-family slots is +0.321 [0.273,
0.369]. At matched post-resolution and next-task platform-input checkpoints,
fixed-replay displacement is 0.

### Natural-frame model-action study

All 460 tasks are evaluated with both recommenders, giving 920 task-model units
per provider. Each unit has immediate A/B and held A/B calls. All four calls use
the same candidate IDs and candidate order; an inspected candidate remains
selectable. A frozen Latin-square rotation changes call order. Immediate A/B
states are byte-identical, as are held A/B states. The primary provider is
DeepSeek and the prespecified replication provider is MiMo.

The primary estimator is

`2 * mean(immediate != held) - 1[immediate A != immediate B] - 1[held A != held B]`.

It estimates squared distance between categorical action distributions after
subtracting within-condition repeated-call variation. Bootstrap intervals
resample tasks and keep both recommender observations within each task cluster.

DeepSeek's estimate is 0.126 [0.093, 0.161]. MiMo's estimate is 0.111 [0.079,
0.144]. All 7,360 calls return valid actions with no timeouts. Model-family
point estimates are positive for both providers and both encoders. Category
point estimates are positive in all eight provider-category cells; these
subgroups are descriptive.

The highest-ranked constraint-matching platform candidate differs between
immediate and held shelves in 40 of 920 units, or 4.35% [2.93%, 5.98%]. On
those units, the action-distance estimate is 0.600 [0.348, 0.850] for DeepSeek
and 0.400 [0.143, 0.703] for MiMo. These conditional estimates are reported
with their prevalence.

The frozen continuous decision-quality surrogate gives held-minus-immediate
-0.0006 [-0.0028, 0.0015] for DeepSeek and +0.0008 [-0.0012, 0.0028] for MiMo.
The score is computed over offered candidates and is not a measure of human
utility.

### Invalidated studies

An earlier 32-task action pilot is excluded because forced inspection changed
candidate availability, the sample was selected on a proposed mechanism, and a
next-task endpoint mixed platform state with downstream consequences of
different actions. A subsequent natural-frame implementation is excluded
because A/B repeats used different candidate orders. Both remain in the
repository as audit records and are not pooled with the current results.

## Proposed contribution boundary

1. An empirical separation between recording an event and making it active in
   learned recommendation during an unresolved agent task.
2. A measurement separation between shelf displacement, resolved model action,
   matched platform-input restoration, and downstream committed history.
3. A paired repeated-call estimator and confirmatory estimate of the immediate
   versus held model-action difference under a fixed selectable candidate set,
   replicated in two LLM families.
4. An outcome-gated control interface presented as an unevaluated design
   response.

The paper does not claim human preference change, production-retailer effects,
trained-model deletion or unlearning, irreversible platform state, human
benefit, or a causal effect of actor provenance.

## Closest-work candidates supplied to reviewers

- CALMRec (arXiv:2607.23647): separates short-term, long-term, and exposure
  memory for recommendation.
- iAgent (Findings of ACL 2025, paper 928): an instruction-aware agent between
  a user and recommender with dynamic memory.
- ShopperBench (EACL 2026 Industry, paper 62): evaluates persona-guided shopping
  agents.
- RecAudit / *Forget Me If You Can* (Information Systems Research,
  DOI 10.1287/isre.2024.1179): audits behavioral influence after recommender
  data revocation.
- Transparent and Scrutable Recommendations Using Natural Language User
  Profiles (ACL 2024, paper 753): edits inspectable profiles and measures
  resulting recommendation changes.

## Artifacts

The repository contains frozen protocols, task manifests, learned-model
checkpoints, runners, evaluators, public aggregate results, invalidation notes,
and an interactive research-storefront/control-interface website. Raw provider
payloads and responses are retained locally rather than published.

## Declared limitations

- No human participants or interface evaluation.
- Synthetic tasks over public, pseudonymized review histories rather than real
  delegated-shopping episodes.
- A research storefront rather than a production retailer.
- Pseudonymous derived features rather than rendered commerce pages or product
  language in the model-action study.
- Two recommender encoders and two LLM providers.
- Natural actionable opportunity is uncommon and conditional estimates are
  correspondingly less precise than the population action estimate.
