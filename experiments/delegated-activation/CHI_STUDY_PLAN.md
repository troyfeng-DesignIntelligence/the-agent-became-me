# CHI study plan: activation timing at delegated-task boundaries

## Contribution target

The study targets a narrow systems-and-interaction contribution: a delegated task creates evidence with an unresolved outcome, so the platform must decide whether that evidence becomes principal-profile input immediately or remains task-local until resolution. The contribution is the temporal distinction and its observable recommendation consequence, not a new deletion or memory mechanism.

## RQ

**RQ.** Under matched shopping-agent traces and matched final stored state, how does pre-outcome activation timing affect (a) recommendations displayed while the delegated task is pending and (b) the agent's current-task personalization?

## Study design

- Data: chronological implicit-feedback histories from four Amazon Reviews 2018 categories.
- Tasks: 80 generated shopping tasks per category, 320 total; 156 end in selection and 164 in abandonment.
- Agent: deterministic retrieval-and-planning agent that searches, views products, requests task-local recommendations, compares candidates, and selects or abandons.
- Recommender: three frozen SASRec checkpoints per category.
- Pairing: identical history, task, observation sequence, action trace, model seed, candidate mask, outcome, and resolved state.
- Conditions: immediate activation then resolution; hold until resolution.
- Checkpoints: task start, task in progress, outcome resolved, next task.
- Primary outcome: paired top-10 ranking displacement during the task.
- Integrity outcomes: exact resolved/next-task equality, task utility difference, and task-local recommendation-use rate.
- Uncertainty: 2,000 bootstrap replicates; tasks and model seeds resampled separately within category; equal-category pooled estimates.

## Go/no-go result

**Go for a scoped paper claim.** In-progress displacement was positive in all four categories and pooled at `0.766` `[0.741, 0.792]`. Resolved and next-task rankings matched exactly. Task utility was identical between conditions, and every agent trace consumed task-local recommendations.

## Required language

Use:

- delegated-evidence activation
- hold before platform activation
- task-local personalization
- provisional recommendation exposure
- matched final state

Avoid as claims:

- profile pollution
- quarantine
- forgetting or unlearning
- restored human preference
- validated user control
- Amazon production effect

## Next empirical upgrade

A publishable follow-up should replace the deterministic agent with multiple real agent architectures and use an instrumented research storefront or recruited participants. The current experiment supports mechanism and prototype claims, not human experience or deployed-platform claims.
