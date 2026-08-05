# Collision Review Delta — 2026-08-05

## Verdict

The largest conceptual collision is now verified: **separating short-term
intent from long-term preference is not a defensible novelty claim**. CALMRec
explicitly frames the collapse of enduring preference, transient intent, and
exposure-induced behavior into one profile as a failure mode, implements
separate short-, long-, and exposure memories, and visualizes a temporary
shopping burst that moves short-term state and decays. MTAM, PAMU, and a broad
sequential-recommendation lineage also model short- and long-horizon interest.

The current project's defensible residual is narrower:

> A task-boundary activation audit for a known software delegate: replay the
> same counterfactual temporary-task events against a no-injection baseline,
> distinguish pre-activation quarantine from post-hoc removal, and measure how
> the paired ranking effect varies across recommender families on real
> chronological histories.

This is a plausible residual in the recorded scope, not a firstness claim.

## Scope

| Dimension | Recorded scope |
|---|---|
| Review date | 2026-08-05 |
| Type | Incremental scoped collision review extending `docs/COLLISION_REVIEW.md`; not systematic |
| Claim tested | Novelty of transient/durable evidence separation, intent-conditioned memory, task-boundary activation, and multi-recommender cross-task measurement |
| Years | Primary focus 2020–2026, with established session-based work followed backward to 2016 |
| Venues/sources | ACL Anthology, ACM CIKM/RecSys/SIGIR discovery, ICLR/arXiv primary records, official author repositories |
| Language | English only |
| Inclusion | Primary work directly occupying transient intent, durable preference, intent-indexed memory, shopping persona/query separation, or agent-memory lifecycle operations |
| Exclusion | Generic personalization, generic memory retrieval, secondary surveys, marketing pages, patents, and papers without a direct claim constraint |
| Limitation | Query-led rather than exhaustive proceedings screening; CALMRec is a July 2026 arXiv preprint; no dual screening or citation-database export |
| Stopping | Searches saturated into the same five clusters: sequential short/long modeling, tri-timescale recommendation memory, contextual-intent retrieval, agent memory operations, and persona/query separation |

## Query log

- `recommender temporary intent short-term long-term user profile session preference`
- `recommender gift purchase buying for others profile personalization`
- `recommender profile contamination transient behavior user model`
- `recommender multiple intents session-based recommendation long-term`
- `recommender transient intent long-term memory exposure`
- `stable user preferences situational needs recommender`
- exact-title and identifier checks for `arXiv:2607.23647`, PAMU, AgeMem,
  STITCH, PROPER Agents, MTAM, and GRU4Rec.

## Closest-neighbor matrix

| Work | What is occupied | Verified overlap | Plausible residual / action | Risk |
|---|---|---|---|---|
| [CALMRec](https://arxiv.org/abs/2607.23647) (2026) | Tri-timescale short-term, long-term, and exposure memory; propensity-corrected updating; temporary shopping burst | Directly occupies the premise that transient intent and exposure should not be collapsed into durable preference | Do not contribute memory separation. Contribute delegated actor/task boundary, provisional activation timing, and paired algorithm-sensitivity audit | **Fatal** to old novelty; **very high** overall |
| [Grounding Agent Memory in Contextual Intent (STITCH)](https://aclanthology.org/2026.findings-acl.584/) | Indexes trajectory steps by latent goal, action type, and entity type; filters context-incompatible memory | Occupies intent-conditioned retrieval and interference reduction across goal segments | Focus on whether evidence becomes active in a recommender before task outcome, not retrieval quality | **High** |
| [Preference-Aware Memory Update (PAMU)](https://aclanthology.org/2026.findings-acl.38/) | Fuses sliding-window and exponential averages for short-term fluctuations and long-term tendencies | Occupies dynamic short/long preference updating in agents | Do not claim decay or short/long fusion as new; treat weights/decay as baselines | **High** |
| [Agentic Memory (AgeMem)](https://aclanthology.org/2026.acl-long.981/) | Learns when to store, retrieve, update, summarize, and discard short- and long-term memory | Occupies generic learned memory lifecycle operations | Keep the system contribution at the platform recommender boundary and make lifecycle controls operationally auditable | **Medium-high** |
| [PROPER Agents](https://aclanthology.org/2026.findings-acl.2082/) | PersonalWAB separates long-term persona, query-level shopping intent, and product affordances | Occupies stable-persona versus situational-need representation in shopping assistance | Known delegated actor and downstream profile activation remain distinct; cite rather than claim task/persona separation | **High** |
| [MTAM](https://doi.org/10.1145/3340531.3411869) (CIKM 2020) | Integrates long-term memory with short-term intent for sequential retrieval | Establishes a mature technical lineage before LLM agents | Treat short/long modeling as background and evaluate multiple families rather than one formula | **Fatal** to broad historical novelty |
| [GRU4Rec](https://arxiv.org/abs/1511.06939) (ICLR 2016) | Session-based recommendation from short interaction sequences | Occupies recency/session sensitivity | Use a transparent transition family as one stress case, not a novel recommender | **Medium** |

## Claim audit

| Candidate claim | Status | Permitted action or wording |
|---|---|---|
| Recommenders collapse temporary intent into long-term preference | **Occupied** | Present as a known failure class; cite CALMRec and sequential work |
| Short-term and long-term memory should be separated | **Occupied** | Remove from contribution list |
| Intent-aware retrieval reduces cross-context interference | **Occupied** | Cite STITCH; do not claim retrieval novelty |
| Agent memory needs store/update/discard controls | **Occupied** | Cite AgeMem and PAMU; do not claim generic lifecycle novelty |
| Shopping systems can distinguish persona from situational query needs | **Occupied** | Cite PROPER/PersonalWAB; avoid “new separation” language |
| A known software delegate creates a different attribution question from an ordinary short-lived human interest | **Plausible residual** | Say the actor/task provenance is given in this benchmark; do not make a universal taxonomy claim |
| Pre-activation quarantine and post-hoc removal can share a final state but differ in provisional recommendation exposure | **Plausible residual** | Keep as the strongest interaction/systems claim within released and controlled traces |
| Paired task-boundary spillover recurs across recommender families on real histories | **Supported in the new validation** | Say three personalized families responded to counterfactual injections on MovieLens histories; retain the domain boundary |
| The effect is algorithm independent | **Falsified / abandon** | Effects differ sharply by family; report heterogeneity |
| Task similarity produces a universal monotonic phase boundary | **Falsified / abandon** | Data-derived similarity was non-monotonic for content models; treat similarity as an interaction, not a law |
| Quarantine is a validated user-control design | **Unverified** | It is a system contract and interaction prototype until a human study exists |

## Replacement decision

The prior largest reviewer risk was a single hand-authored ranker with a supplied
similarity scalar. It is replaced by `external-validity-cross-task.v1`:

- 100,000 real ratings; 703 eligible chronological positive histories;
- 3 within-user, data-derived task-similarity bands;
- content-centroid, item-neighborhood collaborative, and sequential-transition
  recommenders;
- global-popularity negative control;
- persist, 0.25 intent weighting, and pre-activation quarantine;
- 25,308 paired rows with identical candidates and global models.

All mechanical gates passed. Positive spillover appeared in all three
personalized families; quarantine and the popularity control were exactly
invariant. The result replaces algorithm generality by **algorithm
heterogeneity**: persist-all spillover rates were 19.7%, 19.8%, and 50.2% for
content, neighborhood, and sequential families respectively.

## Abandoned framing and new paper center

Abandon:

- “We introduce a way to distinguish temporary from enduring preference.”
- “Cross-task preference pollution is a new recommender failure.”
- “The phase map reveals a general boundary controlled by similarity.”
- “The mitigation works across recommenders.”

Use:

> Prior work already separates transient intent, durable preference, exposure,
> and contextual memory. We study a narrower governance and measurement gap:
> when a known delegate performs a temporary task, whether its evidence becomes
> active before outcome resolution, and how far that activation displaces the
> principal's later ranking under different recommender memory assumptions.

The synthetic phase map remains a mechanism visualization. The real-history,
multi-family paired validation becomes the core quantitative result.
