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
  eyebrow: "A synthetic agent–computer interaction study",
  title: "The Agent Became Me",
  subtitle:
    "What happens when a shopping agent’s temporary assignment is treated as lasting evidence about the person who delegated it?",
  summary:
    "This reproducible testbed holds a principal’s reference preferences fixed, delegates four shopping scenarios to transparent agent policies, and replays the resulting actions through different logging, profile-update, preview, and repair contracts.",
  status:
    "Generated evidence · protocol.v1 · 4 synthetic scenarios · 3 policies · 40 paired seeds per cell · no human participants",
  disclosure:
    "All principals, delegation briefs, behaviors, and outcomes are synthetic. Public Open Food Facts product metadata supplies the choice environment; no user records are used.",
  primaryAction: "Inspect the evidence",
  secondaryAction: "Read the protocol"
} as const;

export const researchQuestion = {
  label: "Research question",
  question:
    "When an AI agent directly operates a personalized system, how do delegation provenance and profile-update controls change whether task-driven agent behavior becomes long-term evidence about the human principal?",
  framing:
    "The project studies attribution inside a simulated recommender pipeline. It does not treat profile movement as a change in a person’s identity or underlying preferences.",
  contribution:
    "The scoped contribution is an executable benchmark for delegated-action misattribution: fixed latent principal preferences, temporary task goals, event-level actor and intent provenance, and reversible update policies.",
  noveltyBoundary:
    "Agents in recommendation, editable profiles, dynamic memories, and provenance standards already exist. This project does not claim to invent them or to be the first study of agent-mediated personalization."
} as const;

export const studyA = {
  id: "study-a",
  label: "Study A",
  title: "Same trace, different attribution contract",
  question:
    "If behavior is held constant, does recording and operationalizing who acted—and why—change the learned profile?",
  explanation:
    "Each synthetic agent trace is frozen and replayed through four profile-update contracts. Catalog, scenario, principal reference, task vector, policy, seed, event order, and learning rate remain identical.",
  runCount: 1920,
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
      id: "provenance-aware",
      name: "Provenance-aware",
      copy:
        "Use actor plus explore, consider, and commit intent to downweight temporary, non-commit agent evidence."
    },
    {
      id: "approval-gated",
      name: "Approval-gated",
      copy:
        "Preserve provenance and update the persistent profile only when the scenario’s registered learning scope permits it."
    }
  ],
  caution:
    "Approval gating is a simulated data contract, not a measurement of consent, trust, or perceived control."
} as const;

export const studyB = {
  id: "study-b",
  label: "Study B",
  title: "Change what the agent can see and repair",
  question:
    "With the provenance-aware updater fixed, do profile-impact previews and repair affordances change the resulting trace and profile?",
  explanation:
    "Unlike Study A, the interface can alter agent behavior. Study B therefore evaluates the combined effect of an affordance and the trace it produces; it does not isolate logging alone.",
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
      id: "impact-preview",
      name: "Impact preview",
      copy:
        "Before commitment, the agent can inspect how an action would move the persistent profile."
    },
    {
      id: "preview-and-repair",
      name: "Preview and repair",
      copy:
        "Non-commit evidence can remain temporary, and the agent can repair profile changes after the delegated task."
    }
  ],
  caution:
    "Interaction cost is expressed in simulator units. It is not a measure of human time, effort, or cognitive load."
} as const;

export const findings: readonly Finding[] = [
  {
    id: "operational-provenance",
    kicker: "Study A · 480 runs per condition",
    title: "Logging provenance was not enough; the updater had to use it.",
    body:
      "Actor-blind and logged-only conditions produced the same mean contamination and future recommendation regret. Recording accurate provenance without connecting it to the update rule changed the audit trail, not the learned profile.",
    evidence: [
      "Mean profile contamination: 0.311 actor-blind; 0.311 logged-only",
      "Mean future recommendation regret: 0.035 actor-blind; 0.035 logged-only",
      "Mean task utility: 0.434 in both conditions"
    ],
    boundary:
      "This equivalence is generated by the registered simulator and updater; it is not evidence about a commercial platform."
  },
  {
    id: "provenance-aware-update",
    kicker: "Study A · generated means",
    title: "Operational provenance reduced contamination while task utility stayed fixed.",
    body:
      "Using actor and intent in the profile updater descriptively reduced mean contamination by about 40% and mean recommendation regret by about 82% relative to the actor-blind replay. Because the trace was frozen, mean task utility remained 0.434.",
    evidence: [
      "Mean contamination: 0.311 → 0.187",
      "Mean regret: 0.035 → 0.006",
      "Mean task utility: 0.434 → 0.434",
      "Baseline intent-label noise: 10%"
    ],
    boundary:
      "These are descriptive simulation results, not causal estimates of real-user behavior or statistical evidence about deployed systems."
  },
  {
    id: "approval-gate",
    kicker: "Study A · modeled contract",
    title: "A strict learning scope nearly separated task execution from persistent learning.",
    body:
      "The approval-gated contract produced mean contamination of 0.016 and mean regret rounded to 0.000 while preserving the frozen trace’s mean task utility of 0.434.",
    evidence: [
      "Mean contamination: 0.311 actor-blind; 0.016 approval-gated",
      "Mean regret: 0.035 actor-blind; 0.000 approval-gated",
      "Mean task utility: 0.434 in both conditions"
    ],
    boundary:
      "The gate has access to a registered learning scope in a synthetic scenario. It does not demonstrate experienced consent or feasibility in an existing service."
  },
  {
    id: "preview-and-repair",
    kicker: "Study B · 480 runs per condition",
    title: "Repair produced the clearest integrity gain, with a modeled interaction cost.",
    body:
      "Relative to action-only, preview-and-repair descriptively lowered mean contamination by about 30% and mean regret by about 41%. Mean task utility moved from 0.434 to 0.432, while modeled interaction cost increased from 0 to 8 units.",
    evidence: [
      "Mean contamination: 0.187 action-only; 0.180 preview; 0.131 preview-and-repair",
      "Mean regret: 0.006 action-only; 0.006 preview; 0.004 preview-and-repair",
      "Mean task utility: 0.434 action-only; 0.432 with preview conditions",
      "Mean interaction cost: 0; 3; 8 simulator units"
    ],
    boundary:
      "Study B allows the affordance to change the trace, so its differences cannot be attributed to logging or profile updating alone."
  }
] as const;

export const designImplications = [
  {
    title: "Make provenance executable",
    body:
      "Actor and purpose fields should govern downstream learning rules. A visible label that the updater ignores is useful for audit but insufficient for profile integrity."
  },
  {
    title: "Separate task context from durable preference",
    body:
      "Exploration and consideration can remain task-scoped evidence; durable profile updates should require a stronger commit signal or an explicit learning scope."
  },
  {
    title: "Preview the data consequence, not only the transaction",
    body:
      "An agent-facing interface can expose projected profile impact alongside price, relevance, and constraint checks before a consequential action."
  },
  {
    title: "Treat repair as a first-class operation",
    body:
      "Temporary evidence, exclusion, confirmation, and rollback should produce inspectable receipts rather than silently rewriting history."
  },
  {
    title: "Design for uncertain intent labels",
    body:
      "Provenance-aware policies need confidence, conservative fallbacks, and auditability because inferred explore/consider/commit labels can be wrong."
  }
] as const;

export const limitations = [
  "There were no human participants. The project does not measure trust, satisfaction, identity, authorship, perceived control, willingness to use, or cognitive load.",
  "All principals, delegation briefs, behaviors, and outcomes are synthetic. Results characterize this registered testbed, not commercial recommenders or real shopping behavior.",
  "The profile is a five-axis test representation over 90 food products. It is intentionally inspectable and cannot represent the breadth, instability, or social meaning of a person’s preferences.",
  "Three deterministic, transparent policies stand in for shopping agents. The baseline does not model open-ended LLM reasoning, prompt injection, latency, tool failure, or strategic platform behavior.",
  "Profile contamination and regret depend on the simulator’s reference vectors, update equations, learning rates, and relevance model. Alternative mechanisms may change effect sizes or directions.",
  "Intent labels and their noise are generated. The study does not validate whether real systems can infer delegation purpose reliably.",
  "Study B’s interaction-cost values are abstract simulator units, not measurements of human burden.",
  "The literature review was scoped rather than systematic. Finding no exact precedent does not establish novelty."
] as const;

export const references: readonly ReferenceLink[] = [
  {
    id: "iagent",
    kind: "prior-work",
    title: "iAgent: LLM Agent as a Shield between User and Recommender Systems",
    year: 2025,
    url: "https://aclanthology.org/2025.findings-acl.928/",
    repositoryUrl: "https://github.com/agiresearch/iAgent",
    note:
      "Closest user–agent–platform precedent: instruction-aware reranking, individual memory, and learning from recommendation feedback. The public repository has no visible license; cite, but do not copy."
  },
  {
    id: "governable-personalization",
    kind: "prior-work",
    title:
      "From Hidden Profiles to Governable Personalization: Recommender Systems in the Age of LLM Agents",
    year: 2026,
    url: "https://arxiv.org/abs/2604.20065",
    note:
      "Frames assistants as personalization intermediaries and identifies intent translation, ownership, access, and accountability as research problems."
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
      "Demonstrates editable natural-language profiles and counterfactual recommendation changes.",
    license: "Apache-2.0 repository"
  },
  {
    id: "agent4rec",
    kind: "prior-work",
    title: "On Generative Agents in Recommendation",
    year: 2024,
    url: "https://arxiv.org/abs/2310.10108",
    repositoryUrl: "https://github.com/LehengTHU/Agent4Rec",
    note:
      "Provides profile, memory, and action modules for recommender simulation. This project distinguishes a simulated user from a delegate whose task behavior need not express enduring preference.",
    license: "MIT repository"
  },
  {
    id: "preference-shifts",
    kind: "prior-work",
    title: "Estimating and Penalizing Induced Preference Shifts",
    year: 2022,
    url: "https://proceedings.mlr.press/v162/carroll22a.html",
    note:
      "Establishes long-horizon preference-shift and utility–shift trade-off methods. Here, latent preference is fixed to isolate inference contamination."
  },
  {
    id: "swe-agent",
    kind: "prior-work",
    title: "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering",
    year: 2024,
    url: "https://arxiv.org/abs/2405.15793",
    repositoryUrl: "https://github.com/swe-agent/swe-agent",
    note:
      "Provides the agent–computer interface precedent: interface design can alter agent behavior and task performance.",
    license: "MIT repository"
  },
  {
    id: "prov-o",
    kind: "standard",
    title: "W3C PROV-O: The PROV Ontology",
    url: "https://www.w3.org/TR/prov-o/",
    note:
      "Source for Agent, Activity, Entity, attribution, association, delegation, revision, and invalidation primitives."
  },
  {
    id: "prov-agent",
    kind: "standard",
    title:
      "PROV-AGENT: Unified Provenance for Tracking AI Agent Interactions",
    year: 2025,
    url: "https://arxiv.org/abs/2508.02866",
    note:
      "Extends provenance modeling to prompts, responses, decisions, and tool-mediated agent workflows."
  },
  {
    id: "open-food-facts",
    kind: "data",
    title: "Open Food Facts",
    url: "https://world.openfoodfacts.org/",
    repositoryUrl:
      "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/",
    note:
      "Public product-level metadata supplies the 90-item test catalog. The project excludes product images, reviews, accounts, and user records.",
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
      "A reusable substrate for larger dynamic, slate-based, and uncertainty-aware follow-up experiments.",
    license: "MIT core package"
  },
  {
    id: "recsim",
    kind: "reuse",
    title: "RecSim",
    url: "https://github.com/google-research/recsim",
    note:
      "Informs the separation among environment, user response, recommender policy, and metrics.",
    license: "Apache-2.0"
  },
  {
    id: "t-recs",
    kind: "reuse",
    title: "T-RECS",
    url: "https://elucherini.github.io/t-recs/",
    note:
      "Provides sociotechnical simulation and longitudinal measurement patterns.",
    license: "MIT repository"
  },
  {
    id: "amazon-esci",
    kind: "reuse",
    title: "Amazon ESCI Shopping Queries Dataset",
    year: 2022,
    url: "https://github.com/amazon-science/esci-data",
    note:
      "Offers product/query relevance labels for a future shopping-task adapter.",
    license: "Apache-2.0"
  },
  {
    id: "open-bandit",
    kind: "reuse",
    title: "Open Bandit Pipeline",
    year: 2020,
    url: "https://github.com/st-tech/zr-obp",
    note:
      "Offers propensity-aware replay and off-policy estimators for a later real-log evaluation.",
    license: "Apache-2.0"
  },
  {
    id: "reclist",
    kind: "reuse",
    title: "RecList",
    url: "https://github.com/RecList/reclist",
    note:
      "A behavioral-testing pattern for contamination, rollback, utility, and consent-scope requirements.",
    license: "MIT"
  }
] as const;

export const siteContent = {
  hero,
  researchQuestion,
  studyA,
  studyB,
  findings,
  designImplications,
  limitations,
  references
} as const;

export default siteContent;
