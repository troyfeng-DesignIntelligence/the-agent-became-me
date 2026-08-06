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
  eyebrow: "A study of shopping agents and recommender timing",
  title: "The Agent Became Me",
  subtitle:
    "I tested what happens when a temporary shopping task reaches the recommender before its outcome is known.",
  summary:
    "The experiment compares immediate activation with an outcome-gated hold. It follows each pair from the in-task shelf to the selected item or abandon decision, then checks the next-task ranking.",
  status:
    "4 Amazon-derived categories · 2 learned recommenders · 460-task storefront experiment · 32-task deterministic LLM pilot",
  disclosure:
    "Shopping tasks are generated over public, pseudonymized review histories. Public artifacts exclude original user IDs, item IDs, titles, reviews, and raw model responses.",
  primaryAction: "Inspect the evidence",
  secondaryAction: "Read the protocol"
} as const;

export const researchQuestion = {
  label: "Research question",
  headline: "A restored profile does not guarantee the same decision.",
  question:
    "When does immediate recommendation activation change a shopping agent's resolved action, and can delaying platform activation avoid that change without weakening the current task?",
  framing:
    "The project studies action path dependence inside a research storefront. Ranking movement, browsing movement, and a different final decision are measured separately.",
  contribution:
    "Four activation contracts separate recording from ranking. Paired sham calls separate recommendation effects from ordinary LLM variation.",
  noveltyBoundary:
    "The study does not claim that temporary intent or editable profiles are new. It asks a narrower timing question: what can change before deletion gets a chance to work?"
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
    id: "activation-timing",
    kicker: "460 tasks · four activation contracts",
    title: "Only ranking activation changed the shelf.",
    body:
      "No-state and inert-log conditions produced the same rankings and traces. Immediate activation versus holding changed the in-task Top-10, even though the two conditions returned to the same replay state after the outcome.",
    evidence: [
      "Fixed-trace T1 displacement: 0.765 [0.745, 0.785]",
      "Resolved and next-task displacement: 0.000",
      "No-state and inert-log contrasts: 0.000",
      "Direction repeated across four Amazon-derived categories"
    ],
    boundary:
      "This is a counterfactual experiment over public review histories and research-owned recommenders. It does not measure a retailer's production ranking system."
  },
  {
    id: "trace-versus-decision",
    kicker: "Primary outcome audit",
    title: "A different browsing trace was not always a different decision.",
    body:
      "A controller-required product view changed MiMo's browsing trace in most pairs but never changed its selected item or abandon outcome. The final analysis therefore counts resolved actions rather than every trace difference.",
    evidence: [
      "MiMo trace divergence: 24/32",
      "MiMo resolved-action divergence: 0/32",
      "DeepSeek exposure decisions: 6/32; sham: 1/32"
    ],
    boundary:
      "The controller probe came from the historical runner and is retained as a measurement audit. The repaired pilot supplies the prospective mechanism result."
  },
  {
    id: "action-opportunity",
    kicker: "Deterministic LLM pilot · 32 tasks",
    title: "All 13 exposure events occurred on opportunity tasks.",
    body:
      "The repaired pilot froze the shelves and a predecision dominance score before provider calls. Resolved actions changed only when exposure altered the actionable candidate opportunity, with more events at lower candidate separation.",
    evidence: [
      "DeepSeek exposure/sham: 7/32 versus 1/32; AUC 0.780",
      "MiMo exposure/sham: 6/32 versus 0/32; AUC 0.734",
      "Opportunity localization: 13/13 events",
      "Actual sent-state matches: 32/32 per provider"
    ],
    boundary:
      "Fifteen opportunity tasks were deliberately included in the 32-task set. The pilot tests the mechanism and cannot estimate its ordinary frequency."
  },
  {
    id: "task-local-preservation",
    kicker: "Current-task guardrail",
    title: "Holding platform activation kept task-local help available.",
    body:
      "Immediate and held conditions used the same task-local recommender. Holding passed the frozen checks for decision accuracy and selected-item utility, while removing task-local recommendations lowered utility in three categories.",
    evidence: [
      "Held condition passed accuracy non-inferiority",
      "Held condition passed selected-utility non-inferiority",
      "No-task-local diagnostic reduced utility in 3/4 categories"
    ],
    boundary:
      "The control interface has not been tested with people. The result concerns system performance, not whether users understand or prefer the design."
  }
] as const;

export const designImplications = [
  {
    title: "Keep task help separate from platform learning",
    body:
      "A shopping agent can use task-local recommendations without sending every temporary action straight into the principal's platform profile."
  },
  {
    title: "Show when activation happens",
    body:
      "Logging, task-local retrieval, platform activation, and deletion are separate operations. The interface should name the current state and the next transition."
  },
  {
    title: "Wait for the task outcome",
    body:
      "Removal after failure cannot replay a choice influenced by earlier exposure. Outcome-gated activation avoids that order in the tested system."
  },
  {
    title: "Be precise about undo",
    body:
      "A receipt can confirm that stored task evidence was removed. It cannot show that the agent would have made the same decision without the earlier recommendation."
  }
] as const;

export const limitations = [
  "There were no human participants. The project does not measure trust, comprehension, identity, authorship, perceived control, or cognitive load.",
  "The shopping tasks and agent outcomes were generated over public, pseudonymized review histories. They are not records of delegated shopping.",
  "The LLM pilot deliberately included 15 tasks with a treatment opportunity. Its adjusted event rate is a mechanism result, not an estimate of ordinary task frequency.",
  "The storefront uses research-owned SASRec and GRU models. It does not reproduce a production retailer's recommender.",
  "DeepSeek was the frozen primary mechanism test. MiMo supplies a same-direction check rather than a second confirmatory endpoint.",
  "The first LLM runner had dropout active during recommendation inference. Those historical comparisons remain in the audit trail and are not combined with the repaired pilot.",
  "The control interface is implemented but has not been evaluated with users.",
  "The literature review was scoped rather than systematic."
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
