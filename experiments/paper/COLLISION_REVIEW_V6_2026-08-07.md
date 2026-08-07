# Collision review after the v6 action study

## Scope

This is a query-led collision review completed on 7 August 2026. It is not a
systematic review. Searches covered temporary intent, agent-generated feedback,
selective preference assimilation, recommendation feedback loops, profile
editing, data revocation, shopping-agent benchmarks, and repeated-sample
distribution statistics. Technical comparisons use publisher pages, official
proceedings, or primary manuscripts.

## Decision

The broad paper is occupied. The project cannot claim that it invented
short-versus-long-term memory, temporary buffering, selective assimilation,
agent-mediated recommendation, editable profiles, recommendation feedback
loops, or the repeated-call statistic.

The remaining claim is narrower:

> In a research storefront, we audit a specific admission-time contrast for
> unresolved shopping-task evidence. With task-local retrieval held available,
> we distinguish recording from platform activation, measure shelf movement,
> and estimate a categorical provider-output contrast under a common candidate
> set. We then verify restoration only at a matched platform-input checkpoint.

The search did not find this exact audit bundle. That is a residual empirical
claim, not a new memory architecture, new statistical estimator, or established
human phenomenon.

## Closest work

| Work | What it already occupies | Residual left here | Risk |
|---|---|---|---|
| [CALMRec](https://arxiv.org/abs/2607.23647) (2026) | Short-, long-, and exposure-memory separation; transient shopping bursts; propensity correction; delayed satisfaction; counterfactual deletion checks | A known external task episode, immediate-versus-held admission audit, and downstream provider-output endpoint | Fatal to the old temporary-memory novelty; very high |
| [RecNet](https://arxiv.org/abs/2601.21609) (2026) | A temporary message buffer and filter memory for selective real-time preference assimilation in an agentic recommender | Outcome status and a matched activation-timing audit rather than learned preference propagation | Very high |
| [iAgent](https://aclanthology.org/2025.findings-acl.928/) (Findings ACL 2025) | The user-agent-platform paradigm, instruction-aware recommendation, dynamic agent memory, and individual feedback | Platform-side treatment of a delegate episode rather than an agent shield or agent-side memory | High |
| [Agentic Feedback Loop Modeling](https://arxiv.org/abs/2410.20027) (2024/2025) | A reciprocal feedback loop between recommendation and user agents | Admission timing for one task episode and matched-state auditing | High |
| [RecAudit / Forget Me If You Can](https://pubsonline.informs.org/doi/abs/10.1287/isre.2024.1179) (ISR 2026) | Auditing retained user-specific influence after data revocation and machine unlearning | Pre-outcome activation rather than trained-model revocation; no unlearning claim | High |
| [Transparent and Scrutable Recommendations Using Natural Language User Profiles](https://aclanthology.org/2024.acl-long.753/) (ACL 2024) | Editable user profiles and measured recommendation changes after editing | Admission of unresolved event evidence before it becomes profile state | Medium-high |
| [ShopperBench](https://aclanthology.org/2026.eacl-industry.62/) (EACL Industry 2026) | Persona-guided shopping-agent tasks, trajectories, and agent evaluation | Downstream platform learning from a task episode | High for generic shopping-agent novelty |
| [Energy Statistics](https://doi.org/10.1016/j.jspi.2013.03.018) (Szekely and Rizzo, 2013) | The form `2E d(X,Y) - E d(X,X') - E d(Y,Y')` | Application to categorical provider actions with task-clustered uncertainty | Fatal to an estimator novelty claim |

## Claim-level disposition

| Candidate claim | Disposition | Required wording |
|---|---|---|
| Separate temporary intent from durable preference | Occupied | Background only; cite CALMRec and RecNet |
| Introduce a user-agent-platform paradigm | Occupied | Cite iAgent; do not claim |
| Introduce a new repeated-call estimator | Occupied | Call it categorical energy distance and cite Szekely and Rizzo |
| Show that deleting data removes learned influence | Unsupported and occupied | Do not use deletion, forgetting, revocation, or unlearning as result labels |
| Show an agent-specific causal effect | Unsupported | Agent mediation is the setting; provenance was not manipulated |
| Show harm, contamination, or user preference change | Unsupported | Report shelf and categorical provider-output measurements only |
| Show that holding improves decision quality | Unsupported | Report only the protocol-defined surrogate guardrail and its margin |
| Separate event recording from platform activation in this testbed | Supported, context-specific | Present as a research-storefront audit result |
| Estimate a model-output contrast with common candidates | Supported, bounded | Name the full exposure instrument and the IID/stability assumptions |
| Present an outcome-gated control | Implemented, unevaluated | Design proposal only |

## What would falsify the residual

The behavioral interpretation fails if a preregistered ablation finds that the
contrast disappears when explicit `platformRank` and `inspected` fields are
removed, while no comparable effect appears when recommendation exposure is
represented through the served shelf itself. In that case v6 measured prompt-
feature sensitivity, not recommendation-mediated action.

The agent-task interpretation fails if ordinary human, scripted, and delegated
events show no provenance-by-maturity interaction and a standard session buffer
fully reproduces the proposed outcome-gated policy. The current paper avoids
this stronger claim rather than treating it as established.

## Must-cite set

At minimum, the manuscript needs CALMRec, RecNet, iAgent, Agentic Feedback Loop
Modeling, RecAudit, Ramos et al. on scrutable profiles, ShopperBench, and the
energy-statistics source. A final proceedings and citation search must be run
immediately before submission.

