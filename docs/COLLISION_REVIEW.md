# Scoped Collision Review

Review date: 2026-07-30  
Scope: agentic recommendation, delegated action, dynamic user profiles,
controllable personalization, provenance, and recommender feedback loops  
Status: targeted collision review, not a systematic review

## Verdict

The broad space is crowded. The project must not claim novelty for agents in
recommender systems, dynamic profiles, editable profiles, generic provenance
schemas, user-owned personalization, or recommender-induced preference shifts.

The current defensible residual is narrower:

> A controlled causal benchmark of when a delegate’s task-driven actions are
> misattributed as the principal’s preferences, and whether actor/intent
> provenance plus approval-gated updates reduce that contamination without
> destroying task utility.

No exact empirical precedent for this complete mechanism was found in the scoped
search. This is a plausible residual, not proof of novelty.

## Closest neighbors

| Work | Verified overlap | Residual and action |
|---|---|---|
| [iAgent](https://aclanthology.org/2025.findings-acl.928/) | User–agent–platform paradigm, instruction-aware agent, dynamic memory, recommendation feedback | Very high collision. Cite directly. Differentiate delegated-task misattribution from the agent-as-shield contribution. Its repository has no visible license, so do not copy code. |
| [From Hidden Profiles to Governable Personalization](https://arxiv.org/abs/2604.20065) | Assistants mediate shopping/search; profiles need ownership, access, and accountability | Very high conceptual collision. Contribute an executable causal testbed rather than a general governance agenda. |
| [Transparent and Scrutable Recommendations Using Natural Language User Profiles](https://aclanthology.org/2024.acl-long.753) | Editable profiles and counterfactual recommendation changes | Profile editing is occupied. Focus upstream on which delegated evidence is allowed to enter a profile. Its released implementation is Apache-2.0 and can inform a later baseline. |
| [MARS](https://arxiv.org/abs/2605.14401) | Event, preference, and profile memory with evidence tracking | High collision with evidence-aware memory. Differentiate platform-side attribution of a delegate’s traces to a human principal. |
| [Agent4Rec](https://arxiv.org/abs/2310.10108) | Profile, memory, and action modules for recommender simulation | Reuse simulation logic conceptually. Distinguish an agent simulating a user from a delegate whose actions need not express enduring preference. |
| [Preference pollution](https://onlinelibrary.wiley.com/doi/10.1002/aaai.12055) | Recommenders contaminate later preference evidence through feedback | Cite as the longer-running problem. Hold latent preference fixed to isolate inference contamination rather than genuine preference change. |
| [Estimating and Penalizing Induced Preference Shifts](https://proceedings.mlr.press/v162/carroll22a.html) | Long-horizon preference dynamics and trust-region mitigation | Reuse the idea of a utility–shift trade-off. Do not describe profile distance as measured human preference change. |
| [PROV-AGENT](https://arxiv.org/abs/2508.02866) and [W3C PROV-O](https://www.w3.org/TR/prov-o/) | Agent, activity, entity, attribution, derivation, revision, and invalidation | Fatal to a generic provenance-schema claim. Align with these primitives and add only domain-specific profile-impact fields. |
| [AgentTrace](https://arxiv.org/abs/2603.28551) | Post-hoc traceability for actions, permissions, provenance, and persistent side effects | Treat the learned profile as a specific persistent side effect and evaluate its downstream recommendation consequences. |
| [SWE-agent / ACI](https://arxiv.org/abs/2405.15793) | Interface design changes agent behavior and performance | Use as the ACI foundation; this project moves from task completion to downstream data interpretation. |

## Reusable methods and infrastructure

- [RecSim](https://github.com/google-research/recsim), Apache-2.0: separation
  among environment, agent response, recommender, and metrics.
- [T-RECS](https://elucherini.github.io/t-recs/): sociotechnical simulation
  patterns and longitudinal evaluation.
- [SARDINE](https://pypi.org/project/sardine-rec/), MIT: dynamic user state,
  slates, boredom, and uncertainty for a later Python-scale benchmark.
- [Amazon ESCI](https://github.com/amazon-science/esci-data), Apache-2.0:
  product/query relevance labels for a future shopping-task adapter.
- [Open Bandit Pipeline](https://github.com/st-tech/zr-obp), Apache-2.0:
  propensity-aware replay and off-policy evaluation for a later real-log study.
- [RecList](https://github.com/RecList/reclist), MIT: behavioral regression
  tests for recommendation requirements.

The portfolio release keeps its own small browser simulator because inspectable
state transitions are part of the interaction artifact. It does not present the
simulator itself as novel.

## Search limitations

The review used accessible primary paper pages, author manuscripts, standards,
official documentation, and public repositories. It did not provide complete
coverage of paywalled full texts, non-English work, unpublished industry
systems, or papers released after the review date. The search should be repeated
before any formal novelty claim or paper submission.
