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
    "This reproducible testbed delegates four shopping scenarios to transparent policies, replays the traces through competing update contracts, and includes controls designed to falsify a provenance-specific explanation.",
  status:
    "Generated evidence · protocol.v1 · 4 synthetic scenarios · 3 policies · paired controls · no human participants",
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
    "The scoped contribution is an executable benchmark for delegated-action attribution with explicit falsification controls: matched update mass, no-update bounds, stale-profile stress, event-level provenance, and inspectable receipts.",
  noveltyBoundary:
    "Agents in recommendation, editable profiles, dynamic memories, and provenance standards already exist. This project does not claim to invent them or to be the first study of agent-mediated personalization."
} as const;

export const studyA = {
  id: "study-a",
  label: "Study A",
  title: "Same trace, six update contracts",
  question:
    "If behavior is held constant, does intent-selective provenance outperform a non-selective control with the same total update mass?",
  explanation:
    "Each synthetic trace is frozen and replayed through six contracts. Catalog, scenario, principal reference, task vector, policy, seed, event order, and learning rate remain identical. Matched shrinkage is the decisive attenuation control.",
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
    "The initially aligned profile makes less updating structurally favorable. Matched shrinkage and the stale-profile stress test are required before interpreting the result."
} as const;

export const studyB = {
  id: "study-b",
  label: "Study B",
  title: "Separate a behavior signal from persistence",
  question:
    "What changes when ranking receives a profile-distance proxy, and what changes again when the resulting non-commit evidence is quarantined?",
  explanation:
    "Action-only versus impact proxy changes the behavior-side ranking rule. Impact proxy versus proxy plus quarantine reuses identical paired traces and changes only persistence. These are implementation probes, not a human-tested preview or repair workflow.",
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
      name: "Proxy + quarantine",
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
  title: "A learning-needed counterexample",
  explanation:
    "The weekly-breakfast task starts from the scenario’s disclosed, stale profile. The same six contracts test whether preserving state can be worse when delegated behavior is aligned with a legitimate recurring preference.",
  runCount: 720,
  runsPerCondition: 120,
  caution:
    "This single constructed counterexample is a falsification probe, not evidence about the prevalence of stale profiles or legitimate delegated learning."
} as const;

export const findings: readonly Finding[] = [
  {
    id: "matched-control",
    kicker: "Study A · 480 paired runs per contract",
    title: "The matched control falsified the provenance-specific claim.",
    body:
      "Provenance-aware updating lowered divergence relative to actor-blind updating, but uniform shrinkage with the same total update mass performed slightly better. In this testbed, attenuation—not selective provenance—is the simpler explanation.",
    evidence: [
      "Mean divergence: 0.176 matched shrinkage; 0.187 provenance-aware",
      "Mean simulated ranking loss: 0.005 matched; 0.006 provenance-aware",
      "Mean task utility: 0.434 in both contracts",
      "Higher provenance-aware divergence in 12/12 cell means and 456/480 paired runs"
    ],
    boundary:
      "The matched scale is oracle-calibrated from observed-intent weights and is not a deployable metadata-free policy. Even so, it defeats the stronger mechanistic claim that selective provenance itself explains the observed gain."
  },
  {
    id: "logged-only-control",
    kicker: "Study A · frozen traces",
    title: "Recording provenance without using it changed the audit trail, not the profile.",
    body:
      "Actor-blind and logged-only contracts produced identical profile and ranking outcomes. The diagnostic matrix now separates actor-recording error, intent-label error, provenance use, and event persistence instead of combining unlike definitions.",
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
    title: "No update won the aligned-profile benchmark—and lost the stale-profile stress test.",
    body:
      "When the stored profile started at the evaluator reference, no update produced zero divergence by construction. When the weekly-breakfast stress test started from a stale disclosed profile, scope-gated learning moved closer to the reference than no update.",
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
    title: "Quarantining non-commit evidence changed persistence, not the agent trace.",
    body:
      "The impact-proxy and proxy-plus-quarantine conditions generated identical paired traces. Replaying those traces with non-commit evidence excluded from persistence lowered mean divergence from 0.180 to 0.131.",
    evidence: [
      "Mean divergence: 0.180 proxy; 0.131 proxy + quarantine",
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
    title: "Test provenance against simpler regularization",
    body:
      "Future evaluations should match total update mass before attributing a benefit to actor or purpose metadata. In this benchmark, uniform shrinkage was the stronger explanation."
  },
  {
    title: "Test when task context deserves persistence",
    body:
      "The simulation motivates comparing task-scoped, expiring, and durable evidence in cases where learning is harmful and cases where a stored profile is stale."
  },
  {
    title: "Build a real counterfactual impact signal",
    body:
      "A follow-up ACI should expose the updater’s actual projected state transition—not the static distance proxy used here—and log how an agent responds."
  },
  {
    title: "Keep quarantine and repair distinct",
    body:
      "Quarantining evidence before persistence is not rollback. A genuine repair study needs explicit update, expiry, reversal, and confirmation events with inspectable receipts."
  },
  {
    title: "Stress asymmetric label failures",
    body:
      "Aggregate noise can improve divergence by accidentally suppressing commit signals. Follow-up tests should separate false explore, consider, and commit labels."
  }
] as const;

export const limitations = [
  "There were no human participants. The project does not measure trust, satisfaction, identity, authorship, perceived control, willingness to use, or cognitive load.",
  "All principals, delegation briefs, behaviors, and outcomes are synthetic. Results characterize this implemented testbed, not commercial recommenders or real shopping behavior.",
  "The profile is a five-axis test representation over 90 food products. It is intentionally inspectable and cannot represent the breadth, instability, or social meaning of a person’s preferences.",
  "Three deterministic, transparent policies stand in for shopping agents. The baseline does not model open-ended LLM reasoning, prompt injection, latency, tool failure, or strategic platform behavior.",
  "The serialized field `profileContamination` is a reference-profile distance, not independently established harm. It depends on hand-authored vectors, update equations, learning rates, and one relevance model.",
  "Matched shrinkage slightly outperformed provenance-aware updating. The benchmark therefore does not establish a provenance-specific benefit.",
  "Matched shrinkage is oracle-calibrated per trace from provenance-aware observed-intent weights. It is a non-selective mechanism control, not a deployable policy wholly independent of intent metadata.",
  "Intent labels and their noise are generated. Aggregate label noise is not monotonic evidence of robustness and may suppress high-weight commit updates.",
  "Study B uses a static product-to-profile distance proxy and a quarantine rule. It does not implement or evaluate a projected-impact preview, approval flow, or repair action.",
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
      "Directly occupies the broad human–agent–platform framing. This project contributes a narrow executable profile-update benchmark, not a new recommendation paradigm."
  },
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
    id: "shared-accounts-top-n",
    kind: "prior-work",
    title: "Top-N Recommendation for Shared Accounts",
    year: 2015,
    url: "https://doi.org/10.1145/2792838.2800170",
    note:
      "Establishes that one account can contain mixed preference evidence. Here the actor is a known software delegate rather than an unknown human account sharer."
  },
  {
    id: "shared-account-user-identification",
    kind: "prior-work",
    title: "Identifying Users behind Shared Accounts in Online Streaming Services",
    year: 2018,
    url: "https://doi.org/10.1145/3209978.3210054",
    note:
      "Infers which hidden person produced a session. This benchmark receives actor identity and instead tests whether a delegate event should enter a principal profile."
  },
  {
    id: "shopping-intent-personalization",
    kind: "prior-work",
    title:
      "Learning to Personalize Recommendation based on Customers’ Shopping Intents",
    year: 2023,
    url: "https://arxiv.org/abs/2305.05279",
    note:
      "Occupies shopping-goal inference and intent-aware ranking. The arXiv record is withdrawn; only its accessible record and abstract support this comparison."
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
    id: "mars-memory",
    kind: "prior-work",
    title: "Agentic Recommender System with Hierarchical Belief-State Memory",
    year: 2026,
    url: "https://arxiv.org/abs/2605.14401",
    note:
      "Occupies evidence-tracked event, preference, and profile memory lifecycles. This benchmark focuses on admission of known delegate evidence."
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
      "Establishes long-horizon preference-shift and utility–shift trade-off methods. Here, a declared evaluator reference is fixed to isolate inference divergence."
  },
  {
    id: "preference-pollution",
    kind: "prior-work",
    title: "Recommender Systems, Ground Truth, and Preference Pollution",
    url: "https://doi.org/10.1002/aaai.12055",
    note:
      "Establishes the broader feedback problem in which recommender outputs distort later preference evidence. This project studies one synthetic delegated-action mechanism."
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
    id: "human-delegation-provenance",
    kind: "prior-work",
    title:
      "HDP: A Lightweight Cryptographic Protocol for Human Delegation Provenance in Agentic AI Systems",
    year: 2026,
    url: "https://arxiv.org/abs/2604.04522",
    note:
      "Occupies verifiable delegation and authorization scope. The testbed implements neither cryptographic authorization nor an approval interaction."
  },
  {
    id: "agenttrace",
    kind: "prior-work",
    title:
      "What Did It Actually Do? Understanding Risk Awareness and Traceability for Computer-Use Agents",
    year: 2026,
    url: "https://arxiv.org/abs/2603.28551",
    note:
      "Occupies general action traceability and persistent-side-effect inspection. This project narrows the persistent side effect to a simulated recommender profile."
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
  studyC,
  findings,
  designImplications,
  limitations,
  references
} as const;

export default siteContent;
