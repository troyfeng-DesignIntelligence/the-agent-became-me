export type LinkKind = "prior-work" | "standard" | "reuse" | "data";

export interface ReferenceLink {
  id: string;
  kind: LinkKind;
  title: string;
  year?: number;
  url: string;
  repositoryUrl?: string;
  note: string;
  license?: string;
}

export interface Finding {
  id: string;
  kicker: string;
  title: string;
  body: string;
  evidence: readonly string[];
  boundary: string;
}

export const hero = {
  eyebrow: "An agent-computer interaction experiment",
  title: "The Agent Became Me",
  subtitle:
    "A temporary task changes what a shopping agent sees. If that exposure changes what it chooses, deletion may already be too late.",
  summary:
    "I pair immediate recommendation activation with an outcome-gated hold, then follow the agent from the changed shelf to its resolved action and next task. Independent held-exposure calls separate recommendation-mediated feedback from ordinary LLM variation.",
  status:
    "4 Amazon-derived categories · 2 learned recommenders · matched MiMo and DeepSeek pilots complete · provider-contingent result · no human participants",
  disclosure:
    "Shopping tasks are generated over public, pseudonymized review histories. Public artifacts exclude original user IDs, item IDs, titles, reviews, and raw model responses.",
  primaryAction: "Inspect the evidence",
  secondaryAction: "Read the protocol"
} as const;

export const researchQuestion = {
  label: "Research question",
  headline: "Can deletion restore a path the agent has already left?",
  question:
    "Beyond repeated-call randomness, when does immediate recommender activation change an agent's action path and leave a different protocol-defined next-task ranking after temporary evidence is removed?",
  framing:
    "The project studies behavioral path dependence inside a research-owned recommender pipeline. It does not treat ranking movement as human preference change, permanent model contamination, or production-platform harm.",
  contribution:
    "The paired protocol separates logging, platform activation, task-local retrieval, LLM stochastic divergence, resolved action, and downstream ranking consequences.",
  noveltyBoundary:
    "Transient intent, editable profiles, recommendation agents, and exposure feedback already exist. The narrower claim concerns when early recommendation exposure changes an autonomous agent's committed path before a later deletion can act."
} as const;

export const studyA = {
  id: "study-a",
  label: "Study A",
  title: "Same trace, six update contracts",
  question:
    "If behavior is held constant, does intent-selective provenance outperform a non-selective control with the same total update mass?",
  explanation:
    "I freeze each synthetic trace and replay it through six contracts. The catalog, scenario, reference profile, task vector, policy, seed, event order, and learning rate stay fixed. Matched shrinkage tests whether lower update mass explains the result.",
  runCount: 2880,
  runsPerCondition: 480,
  conditions: [
    {
      id: "actor-blind",
      name: "Actor-blind",
      copy:
        "Treat every delegated view, comparison, shortlist, and purchase as if the principal performed it."
    },
    {
      id: "logged-only",
      name: "Logged only",
      copy:
        "Record actor and intent, but leave the updater blind to both fields. This tests whether transparency is merely decorative."
    },
    {
      id: "matched-attenuation",
      name: "Matched shrinkage",
      copy:
        "Apply one oracle-calibrated trace-level scale so total effective update mass matches the provenance-aware replay, without selectively weighting events."
    },
    {
      id: "provenance-aware",
      name: "Provenance-aware",
      copy:
        "Use actor plus explore, consider, and commit intent to downweight temporary, non-commit agent evidence."
    },
    {
      id: "scope-gated",
      name: "Scope-gated",
      copy:
        "Use the scenario’s protocol-defined learning scope as an idealized upper-bound contract; no approval interaction is simulated."
    },
    {
      id: "no-update",
      name: "No update",
      copy:
        "Keep the trace for audit while preventing every event from changing the stored profile. This exposes the preservation floor."
    }
  ],
  caution:
    "The starting profile already matches the evaluator reference, so less updating has an advantage. The matched control and stale-profile test show where that advantage matters."
} as const;

export const studyB = {
  id: "study-b",
  label: "Study B",
  title: "Separate ranking from persistence",
  question:
      "What changes when ranking receives a profile-distance proxy, and what changes again when the resulting non-commit evidence is held before platform activation?",
  explanation:
      "Action only and impact proxy use different ranking rules. Impact proxy and proxy plus staged hold reuse identical traces, changing only what reaches the stored profile. No person used or evaluated these controls.",
  runCount: 1440,
  runsPerCondition: 480,
  conditions: [
    {
      id: "action-only",
      name: "Action only",
      copy:
        "The agent can view, compare, shortlist, and purchase without seeing projected profile consequences."
    },
    {
      id: "impact-proxy",
      name: "Impact proxy",
      copy:
        "Ranking receives the product’s distance from the disclosed profile as a deterministic penalty. It is a proxy, not a projected state transition."
    },
    {
      id: "impact-proxy-with-quarantine",
      name: "Proxy + staged hold",
      copy:
        "The same proxy-generated trace is replayed, but non-commit evidence is retained for audit and excluded from persistent updates."
    }
  ],
  caution:
    "The cost index is hand-authored simulator metadata. No preview comprehension, approval act, rollback, human time, effort, or cognitive load is measured."
} as const;

export const studyC = {
  id: "study-c",
  label: "Study C",
  title: "When the profile needs to learn",
  explanation:
    "The weekly-breakfast task starts from a disclosed but stale profile. I replay the same six contracts to test a case where the delegated behavior matches a recurring preference and the stored profile should change.",
  runCount: 720,
  runsPerCondition: 120,
  caution:
    "This single constructed counterexample is a falsification probe, not evidence about the prevalence of stale profiles or legitimate delegated learning."
} as const;

export const findings: readonly Finding[] = [
  {
    id: "matched-control",
    kicker: "Study A · 480 paired runs per contract",
    title: "The matched control changed the conclusion.",
    body:
      "Provenance-aware updating lowered divergence relative to actor-blind updating. Uniform shrinkage with the same total update mass performed slightly better. In this testbed, reduced update mass explains the result without needing selective provenance.",
    evidence: [
      "Mean divergence: 0.176 matched shrinkage; 0.187 provenance-aware",
      "Mean simulated ranking loss: 0.005 matched; 0.006 provenance-aware",
      "Mean task utility: 0.434 in both contracts",
      "Higher provenance-aware divergence in 12/12 cell means and 456/480 paired runs"
    ],
    boundary:
      "The matched scale is calibrated from observed-intent weights, so it is a mechanism control rather than a deployable policy. It still rules out the stronger claim that selective provenance produced the gain on its own."
  },
  {
    id: "logged-only-control",
    kicker: "Study A · frozen traces",
    title: "Recording provenance changed the log, not the profile.",
    body:
      "Actor-blind and logged-only contracts produced identical profile and ranking outcomes. I report actor-recording errors, intent-label errors, provenance use, and persistence separately because they describe different failures.",
    evidence: [
      "Mean divergence: 0.311 in both contracts",
      "Mean simulated ranking loss: 0.035 in both contracts",
      "Actor-recording error: 100% actor-blind; 0% logged-only",
      "Intent-label error: 9.9% in both"
    ],
    boundary:
      "This is a code-level comparison of synthetic contracts. It does not evaluate whether a provenance label is visible, understandable, or useful to a person."
  },
  {
    id: "learning-needed",
    kicker: "Study C · explicit counterexample",
    title: "No update won with an aligned profile, then lost with a stale one.",
    body:
      "With the profile initialized at the evaluator reference, no update produced zero divergence by construction. In the weekly-breakfast case, the disclosed profile started stale and scope-gated learning moved it closer to the reference.",
    evidence: [
      "Aligned start: 0.000 no-update divergence",
      "Stale start: 0.104 no update; 0.067 scope-gated",
      "Stale start: 0.075 matched shrinkage; 0.078 provenance-aware"
    ],
    boundary:
      "The stress case is one deliberately constructed scenario. It shows a counterexample to universal preservation, not how frequently such cases occur."
  },
  {
    id: "quarantine-contract",
    kicker: "Study B · 480 runs per condition",
    title: "A staged hold changed persistence without changing the agent trace.",
    body:
      "The impact-proxy and staged-hold conditions generated identical paired traces. Replaying those traces with non-commit evidence excluded from persistence lowered mean divergence from 0.180 to 0.131.",
    evidence: [
      "Mean divergence: 0.180 proxy; 0.131 proxy + staged hold",
      "Mean simulated ranking loss: 0.006 → 0.004",
      "Mean task utility: 0.432 in both paired-trace conditions",
      "Modeled cost index: 3 → 8"
    ],
    boundary:
      "No repair or approval interaction occurs. The comparison isolates a synthetic persistence rule and must not be described as experienced control."
  }
] as const;

export const designImplications = [
  {
    title: "Compare provenance with simple shrinkage",
    body:
      "Match total update mass before crediting actor or purpose metadata. Here, uniform shrinkage explained the gain more simply."
  },
  {
    title: "Test when task context should persist",
    body:
      "Compare task-scoped, expiring, and durable evidence in both kinds of case: when learning causes drift and when the stored profile is stale."
  },
  {
    title: "Use a real counterfactual impact signal",
    body:
      "The next experiment should expose the updater's projected state transition instead of the static distance proxy used here, then record how the agent responds."
  },
  {
    title: "Keep holding and post-hoc repair distinct",
    body:
      "Holding happens before platform activation; rollback happens after it. A repair study needs explicit update, expiry, reversal, and confirmation events with inspectable receipts."
  },
  {
    title: "Stress asymmetric label failures",
    body:
      "Aggregate noise can lower divergence by accidentally suppressing commit signals. The next test should vary false explore, consider, and commit labels independently."
  }
] as const;

export const limitations = [
  "There were no human participants. The project does not measure trust, satisfaction, identity, authorship, perceived control, willingness to use, or cognitive load.",
  "All principals, delegation briefs, behaviors, and outcomes are synthetic. Results characterize this implemented testbed, not commercial recommenders or real shopping behavior.",
  "The profile is a five-axis test representation over 90 food products. It is intentionally inspectable and cannot represent the breadth, instability, or social meaning of a person’s preferences.",
  "Most large experiments use deterministic, transparent policies. In the matched 32-task LLM pilots, DeepSeek changed action paths after recommendation exposure while MiMo did not, despite identical mean shelf displacement. The result is provider-contingent and does not establish cross-LLM recurrence.",
  "The serialized field `profileContamination` is a reference-profile distance, not independently established harm. It depends on hand-authored vectors, update equations, learning rates, and one relevance model.",
  "Matched shrinkage slightly outperformed provenance-aware updating. The benchmark therefore does not establish a provenance-specific benefit.",
  "Matched shrinkage is oracle-calibrated per trace from provenance-aware observed-intent weights. It is a non-selective mechanism control, not a deployable policy wholly independent of intent metadata.",
  "Intent labels and their noise are generated. Aggregate label noise is not monotonic evidence of robustness and may suppress high-weight commit updates.",
      "Study B uses a static product-to-profile distance proxy and a hold-before-activation rule. It does not implement or evaluate a projected-impact preview, approval flow, or repair action.",
  "Study B’s cost values are abstract simulator indices, not measurements of human burden.",
  "The literature review was scoped rather than systematic. Finding no exact precedent does not establish novelty."
] as const;

export const references: readonly ReferenceLink[] = [
  {
    id: "autonomous-agents-recsys-position",
    kind: "prior-work",
    title:
      "A Position Paper on Recommender Systems in the Era of Autonomous Agents",
    year: 2026,
    url: "https://doi.org/10.1145/3773078.3831734",
    note:
      "The closest match to the overall human-agent-platform setup. My project is narrower and tests profile updates in executable scenarios."
  },
  {
    id: "iagent",
    kind: "prior-work",
    title: "iAgent: LLM Agent as a Shield between User and Recommender Systems",
    year: 2025,
    url: "https://aclanthology.org/2025.findings-acl.928/",
    repositoryUrl: "https://github.com/agiresearch/iAgent",
    note:
      "A close precedent for instruction-aware reranking and agent memory. Its public repository has no visible license, so I cite it without reusing code."
  },
  {
    id: "shared-accounts-top-n",
    kind: "prior-work",
    title: "Top-N Recommendation for Shared Accounts",
    year: 2015,
    url: "https://doi.org/10.1145/2792838.2800170",
    note:
      "Shows how one account can contain evidence from several people. Here the actor is known and is a software delegate."
  },
  {
    id: "shared-account-user-identification",
    kind: "prior-work",
    title: "Identifying Users behind Shared Accounts in Online Streaming Services",
    year: 2018,
    url: "https://doi.org/10.1145/3209978.3210054",
    note:
      "Infers which person produced a shared-account session. My benchmark already knows the actor and asks whether the event should update the principal's profile."
  },
  {
    id: "shopping-intent-personalization",
    kind: "prior-work",
    title:
      "Learning to Personalize Recommendation based on Customers’ Shopping Intents",
    year: 2023,
    url: "https://arxiv.org/abs/2305.05279",
    note:
      "Relevant to shopping-goal inference and intent-aware ranking. The paper was withdrawn, so I rely only on its accessible record and abstract."
  },
  {
    id: "governable-personalization",
    kind: "prior-work",
    title:
      "From Hidden Profiles to Governable Personalization: Recommender Systems in the Age of LLM Agents",
    year: 2026,
    url: "https://arxiv.org/abs/2604.20065",
    note:
      "Treats assistants as personalization intermediaries and discusses intent translation, ownership, access, and accountability."
  },
  {
    id: "scrutable-profiles",
    kind: "prior-work",
    title:
      "Transparent and Scrutable Recommendations Using Natural Language User Profiles",
    year: 2024,
    url: "https://aclanthology.org/2024.acl-long.753",
    repositoryUrl:
      "https://github.com/jeromeramos70/user-profile-recommendation",
    note:
      "A concrete example of editable natural-language profiles and counterfactual recommendation changes.",
    license: "Apache-2.0 repository"
  },
  {
    id: "mars-memory",
    kind: "prior-work",
    title: "Agentic Recommender System with Hierarchical Belief-State Memory",
    year: 2026,
    url: "https://arxiv.org/abs/2605.14401",
    note:
      "Tracks evidence across event, preference, and profile memory. I focus on one earlier decision: whether known delegate evidence enters the profile at all."
  },
  {
    id: "agent4rec",
    kind: "prior-work",
    title: "On Generative Agents in Recommendation",
    year: 2024,
    url: "https://arxiv.org/abs/2310.10108",
    repositoryUrl: "https://github.com/LehengTHU/Agent4Rec",
    note:
      "Its profile, memory, and action modules inform the simulation context. I distinguish a simulated user from a delegate acting on a temporary task.",
    license: "MIT repository"
  },
  {
    id: "preference-shifts",
    kind: "prior-work",
    title: "Estimating and Penalizing Induced Preference Shifts",
    year: 2022,
    url: "https://proceedings.mlr.press/v162/carroll22a.html",
    note:
      "Provides methods for studying preference shifts over time. I hold a declared evaluator reference fixed to isolate profile divergence."
  },
  {
    id: "preference-pollution",
    kind: "prior-work",
    title: "Recommender Systems, Ground Truth, and Preference Pollution",
    url: "https://doi.org/10.1002/aaai.12055",
    note:
      "Describes how recommender outputs can distort later preference evidence. My experiment isolates one synthetic delegated-action mechanism."
  },
  {
    id: "swe-agent",
    kind: "prior-work",
    title: "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering",
    year: 2024,
    url: "https://arxiv.org/abs/2405.15793",
    repositoryUrl: "https://github.com/swe-agent/swe-agent",
    note:
      "The agent-computer interface precedent for treating interface design as part of agent performance.",
    license: "MIT repository"
  },
  {
    id: "prov-o",
    kind: "standard",
    title: "W3C PROV-O: The PROV Ontology",
    url: "https://www.w3.org/TR/prov-o/",
    note:
      "I use its Agent, Activity, Entity, attribution, delegation, revision, and invalidation primitives."
  },
  {
    id: "prov-agent",
    kind: "standard",
    title:
      "PROV-AGENT: Unified Provenance for Tracking AI Agent Interactions",
    year: 2025,
    url: "https://arxiv.org/abs/2508.02866",
    note:
      "Extends provenance records to prompts, responses, decisions, and tool-mediated workflows."
  },
  {
    id: "human-delegation-provenance",
    kind: "prior-work",
    title:
      "HDP: A Lightweight Cryptographic Protocol for Human Delegation Provenance in Agentic AI Systems",
    year: 2026,
    url: "https://arxiv.org/abs/2604.04522",
    note:
      "Covers verifiable delegation and authorization scope. My testbed has neither cryptographic authorization nor an approval interaction."
  },
  {
    id: "agenttrace",
    kind: "prior-work",
    title:
      "What Did It Actually Do? Understanding Risk Awareness and Traceability for Computer-Use Agents",
    year: 2026,
    url: "https://arxiv.org/abs/2603.28551",
    note:
      "Studies action traceability and persistent side effects. I narrow the side effect to a simulated recommender profile."
  },
  {
    id: "open-food-facts",
    kind: "data",
    title: "Open Food Facts",
    url: "https://world.openfoodfacts.org/",
    repositoryUrl:
      "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/",
    note:
      "The 90-item test catalog uses public product metadata only. It excludes images, reviews, accounts, and user records.",
    license: "Open Database License 1.0; attribution and share-alike apply"
  },
  {
    id: "sardine",
    kind: "reuse",
    title:
      "SARDINE: A Simulator for Automated Recommendation in Dynamic and Interactive Environments",
    year: 2023,
    url: "https://arxiv.org/abs/2311.16586",
    repositoryUrl: "https://pypi.org/project/sardine-rec/",
    note:
      "A possible base for later experiments with dynamic environments, slates, and uncertainty.",
    license: "MIT core package"
  },
  {
    id: "recsim",
    kind: "reuse",
    title: "RecSim",
    url: "https://github.com/google-research/recsim",
    note:
      "Useful for separating the environment, response model, recommender policy, and metrics.",
    license: "Apache-2.0"
  },
  {
    id: "t-recs",
    kind: "reuse",
    title: "T-RECS",
    url: "https://elucherini.github.io/t-recs/",
    note:
      "A reference for sociotechnical simulation and longitudinal measurement.",
    license: "MIT repository"
  },
  {
    id: "amazon-esci",
    kind: "reuse",
    title: "Amazon ESCI Shopping Queries Dataset",
    year: 2022,
    url: "https://github.com/amazon-science/esci-data",
    note:
      "A source of product-query relevance labels for a later shopping-task adapter.",
    license: "Apache-2.0"
  },
  {
    id: "open-bandit",
    kind: "reuse",
    title: "Open Bandit Pipeline",
    year: 2020,
    url: "https://github.com/st-tech/zr-obp",
    note:
      "A possible route to propensity-aware replay and off-policy estimation with real logs.",
    license: "Apache-2.0"
  },
  {
    id: "reclist",
    kind: "reuse",
    title: "RecList",
    url: "https://github.com/RecList/reclist",
    note:
      "A behavioral-testing reference for profile drift, rollback, utility, and consent-scope requirements.",
    license: "MIT"
  }
] as const;

export const siteContent = {
  hero,
  researchQuestion,
  studyA,
  studyB,
  studyC,
  findings,
  designImplications,
  limitations,
  references
} as const;

export default siteContent;
