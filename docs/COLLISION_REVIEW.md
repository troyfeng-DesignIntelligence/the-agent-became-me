# Scoped Collision Review

- Review date: 2026-07-30
- Review type: reproducible scoped collision review, not a systematic review
- Project under review: *The Agent Became Me* (`protocol.v1`)

## Executive verdict

The broad space is crowded. The project must not claim novelty for:

- agents acting as intermediaries or recommendation consumers;
- dynamic, evidence-tracked, editable, or governable user profiles;
- inferring shopping intent and using it to personalize ranking;
- handling mixed behavior behind a shared account;
- identifying which person generated a shared-account session;
- generic agent/delegation provenance or action traceability;
- recommender-induced preference or evidence feedback loops;
- agent-computer interfaces or recommender simulation in general.

Within the scope below, the defensible residual is narrower:

> A controlled synthetic benchmark of when a known software delegate's
> task-driven actions are treated as evidence about a human principal, using a
> fixed-trace replay to test operational actor/intent provenance against
> matched attenuation, scope-gated and no-update bounds, and a stale-profile
> counterexample. In the current output, the matched control falsifies the
> stronger provenance-specific explanation.

No source inspected in this review evaluated that complete combination. This is
a **plausible residual within the recorded scope**, not proof of novelty,
absence, or firstness.

## Review scope and protocol

### Claim being tested

The review tests whether the project's contribution can be framed as the
combination of:

1. a known software delegate acting for one principal on a temporary task;
2. a platform-side inferred profile that may treat the delegate's behavior as
   enduring evidence about the principal;
3. replay of the same behavior trace under different profile-update contracts;
4. actor and intent fields that affect updating rather than merely appearing in
   a log;
5. matched-update-mass, scope-gated, no-update, and stale-profile falsification
   controls; and
6. a measured comparison among reference-profile divergence, simulated top-6
   ranking loss, and current task utility.

### Coverage

| Dimension | Recorded scope |
|---|---|
| Dates | Core publication search: 2015-01-01 through 2026-07-30. The 2013 W3C PROV-O Recommendation was included as a foundational standard. Earlier shared-account, group-recommendation, user-modeling, and provenance work was not exhaustively searched. |
| Venue families | ACM RecSys, SIGIR, and HCI-facing ACM results including CHI/CSCW terms; ACL/EMNLP; ICML/PMLR; AI Magazine; arXiv `cs.IR`, `cs.HC`, `cs.AI`, `cs.MA`, and `cs.CR`; W3C standards. Venue coverage was query-led, not a paper-by-paper sweep of every proceedings volume. |
| Language | English-language titles, abstracts, standards, and accessible full texts. Non-English literature was not searched. |
| Sources | ACM DOI/landing pages, ACL Anthology, arXiv, PMLR, Wiley Online Library, W3C specifications, and official author/project repositories. General web search was used for discovery, but retained claims and links use primary publication or official project sources. |
| Inclusion | A source was retained when its research question, mechanism, population/context, method, artifact, or contribution directly constrained at least one project claim. Standards and systems were included when they occupied provenance or simulation claims. |
| Exclusion | Generic personalization, generic shopping agents, generic LLM memory, and generic provenance papers were excluded unless they addressed recommendation, delegation, profile updating, persistent effects, or a directly reused method. Secondary summaries, commercial marketing pages, patents, and unverified code mirrors were not used as evidence. |
| Access limits | Full text was **not available for every paywalled source**. Some ACM items were assessed from publisher metadata/abstracts and accessible author or institutional material. The arXiv entry for shopping-intent personalization, arXiv:2305.05279, is withdrawn following a third-party copyright claim and has no accessible PDF or license on arXiv; only its primary-source record and abstract support the statements here. |
| Stopping rule | Searches were rerun across phenomenon, mechanism, population, outcome, and standards terms until they returned the same collision clusters. This is practical saturation for this audit, not database saturation. Result counts were not used because web indexes change. |

This review did not use PRISMA procedures, dual screening, a registered
protocol, exhaustive database exports, or a formal risk-of-bias assessment. It
must not be described as a systematic review.

## Query families and literal search strings

The following strings record the review's search logic. Exact-title, DOI, and
arXiv-ID lookups were used after broad discovery.

| Query family | Literal strings |
|---|---|
| Delegated action and persistent profile effects | `"delegated action" recommender "user profile"`; `"agent action" "persistent personalization"`; `"task-driven" behavior "preference profile" recommendation`; `"delegated shopping" recommender "profile update"` |
| Shared or mixed account activity | `"shared account" recommender system implicit feedback`; `"Top-N Recommendation for Shared Accounts"`; `"Identifying Users behind Shared Accounts"`; `site:dl.acm.org/doi "shared account" recommendation session user` |
| Shopping and session intent | `"shopping intent" personalization recommendation`; `"high level shopping intent" recommender`; `"temporary intent" persistent personalization recommender`; `site:arxiv.org "shopping intents" personalization` |
| Agentic recommendation and memory | `"LLM agent" recommender dynamic memory feedback`; `"agentic recommender" profile memory evidence`; `"user-agent-platform" recommender`; `site:aclanthology.org agent recommender dynamic memory` |
| Profile scrutiny and governance | `"editable user profile" recommender scrutable`; `"governable personalization" LLM agents`; `"profile ownership" recommendation assistant`; `"evidence tracking" profile memory recommender` |
| Recommender feedback and preference change | `"preference pollution" recommender`; `"induced preference shifts" recommender`; `"recommendation feedback loop" preference contamination`; `site:proceedings.mlr.press "preference shifts" recommender` |
| Provenance, delegation, and persistent side effects | `"agent provenance" delegated action profile update`; `"AI agent" traceability "persistent side effects"`; `"W3C PROV" agent activity attribution delegation`; `"on behalf of" recommender provenance agent` |
| ACI and simulation | `"agent-computer interface" downstream data interpretation`; `"recommender simulation" agent profile memory`; `"dynamic recommender" agent simulation platform`; `"interface design" agent behavior performance` |
| Exact identifiers | `10.1145/2792838.2800170`; `10.1145/3209978.3210054`; `arXiv:2305.05279`; `arXiv:2607.24822`; `arXiv:2604.04522` |

The shared-account seeds were followed into session-level user identification;
the shopping-intent seed was compared against temporary-intent and persistent
profile terms; and the agentic-recommender seeds were followed into memory,
profile governance, provenance, and simulator work. Citation chasing was
limited by indexing and access, so it is an explicit next-search item below.

## Cluster-level collision matrix

| Collision cluster | Closest sources | What is occupied | Plausible residual for this project | Remaining verification |
|---|---|---|---|---|
| Autonomous agents as recommendation consumers | [A Position Paper on Recommender Systems in the Era of Autonomous Agents](https://doi.org/10.1145/3773078.3831734); [iAgent](https://aclanthology.org/2025.findings-acl.928/) | The human-agent-platform relationship, agents acting on behalf of users, instruction-aware recommendation, and dynamic agent memory are occupied. | An empirical, platform-side test of how a delegate's trace is interpreted as principal-profile evidence. | Search RecSys 2026 proceedings and citations after publication; the position paper itself is not an empirical test of profile updating. |
| Shared accounts and latent actors | [Top-N Recommendation for Shared Accounts](https://doi.org/10.1145/2792838.2800170); [Identifying Users behind Shared Accounts in Online Streaming Services](https://doi.org/10.1145/3209978.3210054) | Mixed behavior from multiple people behind one account, taste disentanglement, session-to-person identification, and recommendation improvement are occupied. | The actor is already known to be a software delegate, and the ambiguity is whether temporary task evidence should update one principal's durable profile—not which hidden person acted. | Search household, passenger-booking, group-recommendation, and account-switching literature before submission. |
| Shopping and task intent | [Learning to Personalize Recommendation based on Customers' Shopping Intents](https://arxiv.org/abs/2305.05279) | Inferring high-level shopping goals from online behavior and using intent alongside granular engagement in a real-time personalized ranker are occupied. | Treating a delegate's temporary task intent as a possible exclusion/downweighting signal for durable principal-profile updates. | Full text is unavailable from the withdrawn arXiv record. Do not infer its persistence policy from the abstract; locate any lawful publisher version or follow-on work. |
| Dynamic, scrutable, and governable profiles | [Transparent and Scrutable Recommendations Using Natural Language User Profiles](https://aclanthology.org/2024.acl-long.753/); [From Hidden Profiles to Governable Personalization](https://arxiv.org/abs/2604.20065); [MARS](https://arxiv.org/abs/2605.14401) | Editable profiles, recommendation changes after profile edits, profile ownership/governance, and evidence-tracked memory lifecycles are occupied. | An upstream admission rule that tests which delegate events are permitted to become profile evidence, with downstream causal outcomes. | Compare against profile repair, selective forgetting, temporal preference, and consent-receipt work. |
| Recommender feedback and preference dynamics | [Recommender systems, ground truth, and preference pollution](https://doi.org/10.1002/aaai.12055); [Estimating and Penalizing Induced Preference Shifts](https://proceedings.mlr.press/v162/carroll22a.html) | Recommendation feedback can bias later preference evidence, and systems can estimate or penalize induced preference shifts. | Holding a synthetic principal reference fixed to isolate **inference contamination** caused by delegated evidence rather than human preference change. | Human preference change, stated ratings, and production feedback effects remain outside the current testbed. |
| Provenance, delegation, and traceability | [W3C PROV-O](https://www.w3.org/TR/prov-o/); [PROV-AGENT](https://arxiv.org/abs/2508.02866); [HDP](https://arxiv.org/abs/2604.04522); [AgentTrace](https://arxiv.org/abs/2603.28551) | Generic agents, activities, attribution, `actedOnBehalfOf`, qualified delegation, scoped authorization provenance, action traces, and persistent-side-effect auditability are occupied. | Making provenance operational inside a recommender profile-update contract and measuring its downstream effect. | Search data-provenance-to-model-update work; do not claim a new provenance model, authorization protocol, or conformance. |
| Agent simulators and agent-facing interfaces | [Agent4Rec](https://arxiv.org/abs/2310.10108); [SWE-agent / ACI](https://arxiv.org/abs/2405.15793); [RecSim](https://github.com/google-research/recsim); [T-RECS](https://elucherini.github.io/t-recs/) | Agent/user simulation, profile-memory-action modules, interface effects on agent behavior, and longitudinal recommender testbeds are occupied. | A small inspectable benchmark whose manipulation is downstream interpretation of a delegate's trace, not simulator realism or ACI novelty. | Compare against the newest interactive recommender simulators and agent benchmarks before claiming transfer. |

## Closest-neighbor extraction

### Direct framing and mechanism neighbors

| Work | Research question, context, and method | Verified overlap | Residual, risk, and action |
|---|---|---|---|
| [A Position Paper on Recommender Systems in the Era of Autonomous Agents](https://doi.org/10.1145/3773078.3831734) (RecSys 2026) | Positions authorized, user-aligned agents as recommendation consumers in a tripartite human-agent-platform relationship. It is a position paper, not the same empirical benchmark. | Directly occupies the broad claim that recommenders must adapt when agents act on behalf of people. | **Very high framing risk.** Cite early. Contribute the fixed-trace profile-update experiment, not the paradigm. |
| [iAgent: LLM Agent as a Shield between User and Recommender Systems](https://aclanthology.org/2025.findings-acl.928/) (Findings of ACL 2025) | Builds a user-agent-platform paradigm with instruction-aware recommendation and dynamic memory, evaluated on four recommendation datasets. | Agent mediation, user instructions, feedback, dynamic memory, and a user-protective framing. | **Very high collision.** Differentiate a platform learning from a delegate's trace from an agent shielding or representing the user. Cite directly. Its public repository did not provide a license basis for reuse during this audit, so no code is copied. |
| [Learning to Personalize Recommendation based on Customers' Shopping Intents](https://arxiv.org/abs/2305.05279) (2023) | The accessible abstract describes mapping customer searches and item engagements to high-level shopping intents, then combining intent and granular engagement in a real-time personalized ranker. | High-level task intent, shopping examples such as camping/parties, behavioral inference, and intent-aware recommendation are direct collisions. | **Very high mechanism/framing risk.** Goal-conditioned personalization is occupied. The residual is whether a *delegate's temporary task evidence* should enter a durable principal profile. The arXiv record is withdrawn; no full text or reusable artifact was available, so do not make stronger comparisons than the abstract supports. |
| [From Hidden Profiles to Governable Personalization](https://arxiv.org/abs/2604.20065) (2026) | Argues that assistants mediating shopping/search require inspectable, revisable, portable, and accountable user representations. | Profile ownership, access, governance, intent translation, and assistant-mediated personalization. | **Very high conceptual collision.** Contribute an executable causal testbed, not a general governance agenda. |
| [Transparent and Scrutable Recommendations Using Natural Language User Profiles](https://aclanthology.org/2024.acl-long.753/) (ACL 2024) | Generates natural-language profiles from reviews, recommends from those profiles, and tests recommendation changes after profile edits. | Transparent, editable profiles and counterfactual effects of editing. | **High collision.** Profile editing is occupied. Focus on which delegated evidence is admitted upstream. Its Apache-2.0 implementation may inform a separately attributed future baseline; it is not embedded here. |
| [Agentic Recommender System with Hierarchical Belief-State Memory (MARS)](https://arxiv.org/abs/2605.14401) (2026) | Separates event, preference, and profile memory, tracks evidence, and manages extraction, weakening, consolidation, forgetting, and resynthesis. | Ephemeral versus stable signals, evidence-aware memory, and profile lifecycle management. | **High collision.** Differentiate platform-side attribution of known delegate events to a principal and the frozen-trace causal comparison. |
| [On Generative Agents in Recommendation (Agent4Rec)](https://arxiv.org/abs/2310.10108) (2023) | Uses LLM agents with profile, memory, and action modules to simulate users interacting with recommenders. | Agent behavior, persistent memory, recommender feedback, and simulation. | **Medium-high collision.** The project studies a delegate whose task behavior need not express the principal's enduring preference, not an agent intended to simulate that person. |

### Shared-account neighbors

| Work | Research question, context, and method | Verified overlap | Residual, risk, and action |
|---|---|---|---|
| [Top-N Recommendation for Shared Accounts](https://doi.org/10.1145/2792838.2800170) (RecSys 2015) | Studies item-based top-N collaborative filtering when multiple people share one account, contextual information is absent, and feedback is binary and positive-only; it evaluates a shared-account solution across multiple datasets. | Establishes that account-level behavior is not safely equivalent to one person's preferences and that mixed positive-only traces can damage recommendation quality. | **High analogical collision, different actor problem.** It models hidden multiple humans/tastes; this project has one known principal and a software delegate pursuing a temporary brief. Cite as the account-attribution precursor. Do not claim to invent actor separation. |
| [Identifying Users behind Shared Accounts in Online Streaming Services](https://doi.org/10.1145/3209978.3210054) (SIGIR 2018) | Uses unsupervised Session-based Heterogeneous graph Embedding for User Identification (SHE-UI) to infer account sharers, assign a new session to an inferred user, and improve recommendation on Last.fm and KKBOX data. | Occupies session-level producer identification and preference separation behind a shared account. | **High methods collision, different inferential goal.** This project does not infer latent people or cluster sessions; actor identity is given, and the causal variable is how the updater treats the delegate's intent. Do not reuse SHE-UI, its graph construction, embeddings, datasets, or evaluation claims. |

### Consequence, provenance, and interface neighbors

| Work | Verified overlap | Residual and action |
|---|---|---|
| [Recommender systems, ground truth, and preference pollution](https://doi.org/10.1002/aaai.12055) | Recommender outputs can bias later preference evidence through a feedback loop. | Cite as the longer-running evidence-quality problem. Do not equate synthetic profile distance with a human preference rating or actual preference change. |
| [Estimating and Penalizing Induced Preference Shifts in Recommender Systems](https://proceedings.mlr.press/v162/carroll22a.html) | Models long-horizon preference dynamics and evaluates a utility-versus-shift mitigation trade-off. | Reuse the trade-off logic, while holding a declared evaluator reference fixed and naming the outcome reference-profile divergence. |
| [W3C PROV-O](https://www.w3.org/TR/prov-o/) (2013) | Defines `Entity`, `Activity`, `Agent`, attribution, association, derivation, revision, invalidation, `actedOnBehalfOf`, and qualified delegation. | **Fatal to a generic provenance-vocabulary claim.** Align with stable primitives and add only application-specific profile-impact fields. |
| [PROV-AGENT](https://arxiv.org/abs/2508.02866) (2025) | Extends W3C PROV for agent interactions and downstream workflow impacts. | Do not claim agent provenance or end-to-end trace capture as new; specialize the question to profile updating. |
| [HDP: A Lightweight Cryptographic Protocol for Human Delegation Provenance in Agentic AI Systems](https://arxiv.org/abs/2604.04522) (2026) | Records human authorization, delegation chains, and scope in a verifiable token protocol. | Scoped delegation provenance is occupied. The project models an idealized scope-gated update rule without an approval interaction and makes no cryptographic authorization claim. |
| ["What Did It Actually Do?": Understanding Risk Awareness and Traceability for Computer-Use Agents](https://arxiv.org/abs/2603.28551) (2026) | AgentTrace visualizes actions, touched resources, permission history, provenance, and persistent side effects. | Treat the learned profile as one specific persistent side effect and evaluate downstream recommendations; do not claim general action traceability. |
| [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793) (2024) | Shows that interface design changes agent behavior and performance. | Use as the ACI foundation. Study B asks how an interface changes behavior and downstream data interpretation, not whether ACI matters in general. |

## Claim-by-claim audit

The labels in this table are novelty-audit labels, not empirical quality labels.

| Proposed claim | Status | Basis and permitted wording |
|---|---|---|
| Recommender systems will interact with agents acting on behalf of users. | **Occupied** | Directly framed by the RecSys 2026 position paper and iAgent. Cite them; do not present the tripartite paradigm as this project's contribution. |
| Agentic recommenders can maintain dynamic profiles or memory from feedback. | **Occupied** | iAgent, MARS, Agent4Rec, and related agentic recommendation work establish this. |
| User profiles can be made transparent, editable, or governable. | **Occupied** | ACL 2024 profile scrutiny and the governable-personalization position paper occupy this space. |
| High-level shopping intent can be inferred from behavior and used for personalized ranking. | **Occupied** | arXiv:2305.05279 states this in its accessible abstract. Do not claim task-intent personalization as new. |
| One account's trace may combine preferences from different people. | **Occupied** | RecSys 2015 treats shared-account top-N recommendation without context. |
| Sessions behind a shared account can be assigned to inferred users to improve recommendation. | **Occupied** | SIGIR 2018 evaluates SHE-UI for this purpose. This project must not call its known-actor field user identification. |
| Agent, action, attribution, delegation, and persistent-side-effect provenance are new schema concepts. | **Occupied** | W3C PROV-O, PROV-AGENT, HDP, and AgentTrace make this framing untenable. |
| Recommender feedback can distort later preference evidence or preferences. | **Occupied** | Preference-pollution and induced-shift work occupy the broad consequence. |
| Agent-facing interface design can change behavior and task performance. | **Occupied** | SWE-agent/ACI establishes the general claim. |
| A known software delegate pursuing a temporary task is analytically distinct from hidden people sharing an account. | **Plausible residual** | The inspected shared-account papers infer or serve multiple human users. This project receives actor identity and tests evidence admission. Phrase as a distinction in this benchmark, not a universal taxonomy. |
| Replaying one fixed delegate trace across updater contracts isolates platform interpretation from behavior generation. | **Plausible residual** | No inspected neighbor used this exact manipulation for delegated recommendation traces. Describe the design precisely; do not call it the first such replay. |
| Logged provenance can be causally separated from provenance that changes a profile updater. | **Plausible residual** | The `logged-only` control is a specific benchmark contribution within this scope. A broader audit-log-versus-policy idea is not novel. |
| Provenance-aware updating has a benefit beyond equally strong actor- and intent-blind attenuation. | **Falsified in the current testbed** | Matched shrinkage slightly outperforms provenance-aware updating on mean divergence and simulated ranking loss with equal task utility. Do not claim a provenance-specific benefit from `protocol.v1`. |
| Fixed-trace replay with matched attenuation, no-update bounds, and a stale-profile counterexample is a useful delegated-evidence benchmark design. | **Plausible residual** | No inspected neighbor used this exact control bundle. Present it as a benchmark contribution within this search scope, not as a first. |
| Commercial platforms currently attribute shopping-agent behavior to the principal in this way. | **Unverified** | No production profile-update policy was inspected. The testbed demonstrates a possible mechanism, not current platform practice. |
| People experience the tested controls as consent, identity protection, trust, or meaningful control. | **Unverified** | There are no human participants or human-experience measures. |
| The result generalizes across domains, recommenders, agent policies, or real behavioral logs. | **Unverified** | The current evidence is a deterministic synthetic shopping testbed with four scenarios and three transparent policies. |
| No prior work evaluates the complete mechanism. | **Unverified as a universal absence claim** | Permitted wording: “No exact empirical precedent was identified within this scoped review.” |

## Must-cite list

Any paper, proposal, or portfolio claim built from this testbed should cite and
differentiate at least the following:

1. [A Position Paper on Recommender Systems in the Era of Autonomous Agents](https://doi.org/10.1145/3773078.3831734) — broad human-agent-platform and authorized-agent framing.
2. [iAgent](https://aclanthology.org/2025.findings-acl.928/) — agent mediation, instruction-aware recommendation, dynamic memory, and user-protective framing.
3. [Top-N Recommendation for Shared Accounts](https://doi.org/10.1145/2792838.2800170) — mixed account-level feedback without contextual identity.
4. [Identifying Users behind Shared Accounts in Online Streaming Services](https://doi.org/10.1145/3209978.3210054) — session-level latent user identification and recommendation improvement.
5. [Learning to Personalize Recommendation based on Customers' Shopping Intents](https://arxiv.org/abs/2305.05279) — task-intent inference and intent-aware ranking; cite with its withdrawn-record limitation.
6. [Transparent and Scrutable Recommendations Using Natural Language User Profiles](https://aclanthology.org/2024.acl-long.753/) — editable profiles and downstream recommendation changes.
7. [From Hidden Profiles to Governable Personalization](https://arxiv.org/abs/2604.20065) — ownership, access, accountability, and assistant-mediated profiles.
8. [MARS](https://arxiv.org/abs/2605.14401) — ephemeral/stable memory separation and evidence-tracked profile lifecycles.
9. [Agent4Rec](https://arxiv.org/abs/2310.10108) — agent profile-memory-action simulation in recommendation.
10. [Recommender systems, ground truth, and preference pollution](https://doi.org/10.1002/aaai.12055) and [Estimating and Penalizing Induced Preference Shifts](https://proceedings.mlr.press/v162/carroll22a.html) — feedback contamination and utility/shift trade-offs.
11. [W3C PROV-O](https://www.w3.org/TR/prov-o/), [PROV-AGENT](https://arxiv.org/abs/2508.02866), and [HDP](https://arxiv.org/abs/2604.04522) — provenance, delegation, and authorization-scope boundaries.
12. [AgentTrace](https://arxiv.org/abs/2603.28551) — agent action auditability and persistent side effects.
13. [SWE-agent / ACI](https://arxiv.org/abs/2405.15793) — the established claim that interfaces shape agent behavior.

## Reusable methods and infrastructure

- [RecSim](https://github.com/google-research/recsim), Apache-2.0: separation
  among environment, response, recommender, and metrics.
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
simulator, provenance vocabulary, shared-account inference, shopping-intent
modeling, or profile editing as novel.

## Abandoned framings

| Framing to abandon | Why it fails |
|---|---|
| “The first recommender system for autonomous agents” | Agent-mediated and agent-consumed recommendation is directly occupied. |
| “A new human-agent-platform paradigm” or “an agent as a shield” | The RecSys 2026 position paper and iAgent occupy those broad framings. |
| “A new way to personalize from shopping goals” | arXiv:2305.05279 already infers high-level shopping intents and uses them in ranking. |
| “Solving shared-account contamination” | Shared-account top-N recommendation and latent-user identification are established. The current actor and causal question differ. |
| “Identifying who acted behind an account” | SIGIR 2018 explicitly targets that task; `trace.v1` already knows the actor. |
| “A new editable, transparent, or user-owned profile” | Scrutable-profile and governable-personalization work occupy this. |
| “A new provenance schema for agents” | W3C PROV-O, PROV-AGENT, HDP, and AgentTrace are fatal collisions. |
| “Preventing preference change/manipulation” | The benchmark fixes a synthetic principal reference; it does not measure a person's changing preferences. |
| “An ACI contribution because the interface changes agent behavior” | That general relationship is established. Study B can only claim a domain-specific test of downstream profile consequences. |
| “A new recommender simulator” | RecSim, T-RECS, SARDINE, Agent4Rec, and other interactive simulators occupy simulator novelty. |
| “The first controlled benchmark of this mechanism” | The search is scoped and incomplete. Use the residual statement below without firstness. |
| “The controls provide consent, trust, identity protection, or user control” | Those are human-experience claims and are not measured. |

## Defensible residual

The strongest calibrated formulation is:

> Within an English-language search of selected recommender, agent, HCI,
> provenance, and ML sources from 2015 through 2026-07-30, plus the 2013 W3C
> PROV-O standard, we found prior work on agent-mediated recommendation,
> shared-account preference separation, session-level user identification,
> shopping-intent personalization, dynamic and editable profiles, recommender
> feedback effects, delegation provenance, traceability, and agent simulation.
> We did not identify an empirical study combining a known software delegate's
> temporary task, fixed-trace replay across platform profile-update contracts,
> operational actor/intent provenance, a matched attenuation baseline,
> no-update and stale-profile controls, and downstream
> divergence/ranking-loss/utility outcomes. We therefore treat the benchmark
> design—and its falsification of a provenance-specific explanation—as a
> plausible contribution pending broader full-text and citation search.

The contribution is defensible only if the project keeps these boundaries:

- say **synthetic reference-profile divergence**, not identity loss, established
  harm, or human preference change;
- say **known delegate versus principal**, not latent-user identification;
- say **temporary task evidence admission**, not shopping-intent
  personalization;
- say **PROV-informed application profile**, not a new provenance standard;
- say **scope-gated update contract**, and state that no approval interaction,
  cryptographic authorization, or experienced consent was evaluated;
- say **no exact precedent identified in this scope**, not “first,” “no prior
  work,” “unexplored,” or “systematic review.”

## Next-search queries and actions

Run these before a paper submission or stronger novelty statement:

| Priority | Query or action | Purpose |
|---|---|---|
| 1 | `("delegated shopping" OR "purchase on behalf of" OR "proxy shopping") (recommender OR personalization) ("profile update" OR "user model")` | Find domain-specific delegated-purchase systems. |
| 1 | `("software agent" OR "AI agent") ("user profile" OR "preference model") (attribution OR provenance OR contamination)` | Test the known-delegate/profile-update residual directly. |
| 1 | `("temporary intent" OR "situational intent" OR "session intent" OR "short-term preference") ("long-term profile" OR persistent personalization)` | Find work separating transient goals from durable preference. |
| 1 | `("task intent" AND "profile update") (shopping OR ecommerce OR recommender)` | Find explicit task-intent admission or forgetting policies. |
| 1 | Forward- and backward-citation search for DOI `10.1145/2792838.2800170`, DOI `10.1145/3209978.3210054`, and arXiv `2305.05279`. | Locate shared-account descendants, lawful shopping-intent versions, and terminology missed by keyword search. |
| 2 | `("shared account" OR household OR family OR "multi-user account") recommendation (session OR intent OR attribution)` | Cover household and group-recommendation variants outside the two seeds. |
| 2 | `("passenger prediction" OR "booking for others" OR "gift purchase") recommender account preference` | Find other temporary on-behalf-of purchase traces. |
| 2 | `("actedOnBehalfOf" OR "qualifiedDelegation" OR "delegation provenance") recommender` | Test whether PROV delegation has already been connected to profile updating. |
| 2 | `("profile contamination" OR "preference contamination" OR "behavioral contamination") recommender` | Search alternate outcome terminology. |
| 2 | `("selective forgetting" OR "evidence deletion" OR "profile repair") recommender provenance` | Compare scope gating and pre-persistence quarantine with established forgetting and repair mechanisms. |
| 3 | Manually screen 2024-2026 RecSys, SIGIR, CHI, CSCW, UMAP, IUI, WWW, KDD, ACL, and EMNLP proceedings using the retained synonyms. | Reduce venue-index and very-recent-publication gaps. |
| 3 | Obtain lawful full texts for paywalled closest neighbors through institutional access and re-extract research question, manipulation, baselines, and limitations. | Replace abstract-level comparisons; full text was not available for every paywalled source in this review. |
| 3 | Add non-English search terms or recruit multilingual screening if a publication-level absence claim is contemplated. | Address the English-only limitation. |

The collision review should be rerun immediately before submission because the
agentic-recommender literature is changing quickly, and work released after
2026-07-30 is outside this audit.
