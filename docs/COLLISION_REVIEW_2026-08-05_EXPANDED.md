# Expanded Collision Review — 2026-08-05

## Decision

The broad project framing is too crowded for a defensible paper claim. The
review found direct precedents for transient versus durable preference,
session-versus-persistent personalization, private-session exclusion, gift and
out-of-profile controls, editable user profiles, recommendation unlearning,
agent-memory isolation, cross-task memory interference, shopping-agent
personalization, provenance, and recommendation feedback effects.

The remaining candidate is narrower and temporal:

> **Audit when evidence produced by a known software delegate becomes active
> in a recommender while the delegated task's outcome is still unresolved.**
> Compare hold-before-activation with immediate activation followed by removal,
> and measure the recommendation exposure that occurs before both policies
> reach the same final stored state.

No exact empirical precedent for that complete combination was identified in
this scoped review. This is a plausible residual, not an absence or firstness
claim.

## What changed after the wider search

The previous residual—"task-boundary activation"—survives only after four
additional restrictions:

1. the actor is a **known software delegate**, not an unknown household member;
2. the task has a **pending outcome**, not merely a short session or changing
   interest;
3. the dependent variable includes **recommendations shown before outcome
   resolution**, not only the final profile or later ranking;
4. the comparison is **hold before activation versus remove after activation**
   under a matched final state, not generic deletion, forgetting, or control.

The existing four-category SASRec result is useful validation, but it is not
itself the novelty. It currently demonstrates counterfactual sequence
sensitivity, not observed delegation or unresolved task outcomes.

## Review protocol

| Dimension | Recorded scope |
|---|---|
| Review date | 2026-08-05 |
| Type | Expanded, query-led collision review; not systematic |
| Years | Foundational work followed backward where necessary; primary emphasis on 2015–2026 |
| Sources | ACM/DOI records, ACL Anthology, AAAI proceedings, INFORMS, arXiv, OpenReview, official platform documentation, and accessible author copies |
| Language | English only |
| Inclusion | Work constraining the phenomenon, mechanism, interface, population, method, or contribution claim |
| Exclusion | Generic agents, generic personalization, and generic privacy work without a direct constraint on the proposed claim |
| Search limitation | No dual screening, database export, citation-count threshold, non-English search, or exhaustive proceedings-by-proceedings screening |
| Stopping rule | Practical saturation: new queries repeatedly returned the clusters below rather than a direct matched precedent |

### Added query families

- `delegated shopping recommender temporary task profile`
- `gift purchase recommender user profile preference`
- `private session personalization recommender user profile`
- `selective forgetting recommender system user profile`
- `AI agent memory task boundary isolation cross-task interference`
- `agent memory addition deletion misaligned experience replay`
- `AI agent on behalf of user recommendation profile`
- `shopping agent persona preference memory temporary intent`
- `recommender delete history prevent personalization user study`
- `Don't use for recommendations Amazon user control`
- `private session Spotify recommendations user study`
- `recommender staged interaction pending purchase outcome`
- `task boundary recommender system user profile`

## Claim-level collision map

| Candidate claim | Status | Closest collision | Required action |
|---|---|---|---|
| Temporary intent should be separated from durable preference | **Occupied** | CALMRec; MTAM; PAMU; session-based recommendation | Remove from the contribution list |
| Short-, long-, and exposure-memory separation is new | **Occupied** | CALMRec and agent-memory systems | Treat as background or baseline |
| Current-session personalization should be separated from persistent personalization | **Occupied** | *Ephemeral and Persistent Personalization* and cross-session recommendation | Do not use as novelty language |
| Users need a private/incognito mode so activity does not affect recommendations | **Occupied in products and research context** | Spotify Private Session; CHI 2024 Spotify Blend study | Do not present the mode itself as a design contribution |
| Gift or atypical purchases should be excluded from recommendations | **Occupied** | Jannach et al.'s Amazon user-control study | Cite; abandon the motivating-example novelty |
| Users need visible, editable control over profile evidence | **Occupied** | Amazon “Don't use for recommendations”; scrutable profiles; counterfactual control; DiscomfortFilter | Prototype can instantiate the temporal contract, but not claim generic control novelty |
| Deleting an interaction should remove its learned influence | **Occupied** | recommendation unlearning, CURE4Rec, RecAudit | Do not call the intervention unlearning or forgetting |
| Agent memories can pollute later tasks | **Occupied** | ACL 2026 experience-following/error-propagation study; task-isolated memory systems | Do not claim discovery of cross-task memory interference |
| Memory addition/deletion and task isolation are new agent controls | **Occupied** | Xiong et al.; HiAgent; AgentMemoryBench; isolation literature | Keep the boundary at the platform recommender, not the agent's own memory |
| Personalized shopping agents with personas and goals are new | **Occupied** | ShopperBench; PROPER/PersonalWAB; iAgent | Do not claim a new shopping-agent benchmark in general |
| “Profile pollution” is a clean name for the benign phenomenon | **Unsafe / occupied terminology** | AAAI 2026 Profile Pollution Attack and earlier preference-pollution work | Replace with **delegate-evidence activation** or **task-boundary exposure** |
| Agent provenance, delegation scope, or traceability is new | **Occupied** | W3C PROV-O, PROV-AGENT, HDP, AgentTrace | Use provenance only as an input field, not a contribution |
| Recommendations can shape later observations or preferences | **Occupied** | exposure-bias, feedback-loop, and induced-preference-shift work | Do not call ranking displacement preference change or harm |
| Known-delegate evidence raises a different admission question from an unknown shared-account actor | **Plausible residual** | Shared-account work usually infers or serves multiple humans | State as this study's setting, not a universal taxonomy |
| Hold-before-activation and activate-then-remove can share a final state but differ in already-shown recommendations | **Strongest residual** | Unlearning audits final retained influence; private modes prevent use; neither inspected line used the complete delegated pending-outcome comparison | Make this the paper center and test it directly |
| People understand the difference between “never active” and “deleted later” | **Open empirical question** | Data-deletion mental-model and recommender-control studies show confusion, but do not answer this exact delegated-recommendation question | Valid CHI RQ only after a human study |

## Closest-neighbor matrix

| Work | What it already establishes | Why it is not the exact residual | Risk |
|---|---|---|---|
| [CALMRec](https://arxiv.org/abs/2607.23647) | Separates enduring preference, transient intent, and exposure memory in long-horizon recommendation | No known-delegate pending-outcome activation audit | **Fatal** to the old memory-separation story |
| [User Control in Recommender Systems](https://interactivesystems.info/system/pdfs/851/original/user_control.pdf?1560346152=) | Reviews recommender controls and studies Amazon's “Don't use for recommendations,” including gifts and atypical interests | Primarily a control-usage study; it does not compare provisional ranking paths under matched final states | **Fatal** to generic control and gift framing |
| [Spotify Private Session](https://support.spotify.com/au/article/private-listening/) | Temporarily prevents listening activity from personalizing recommendations | It is an account-level product mode, not a delegated task/outcome lifecycle experiment | **Fatal** to “private task mode” novelty |
| [Kwak et al., CHI 2024](https://doi.org/10.1145/3613904.3642544) | Studies Spotify Blend over 21 days with 30 participants and discusses visibility/control tensions across individual and group recommendation | Social two-person group recommendation, not a software delegate or matched activation timing | **High** HCI framing collision |
| [Forget Me If You Can / RecAudit](https://doi.org/10.1287/isre.2024.1179) | Audits whether a sequential recommender still retains a user's behavioral influence after a deletion request | Ex-post revocation and trained-model retention, not exposure before outcome resolution | **High**, but it sharpens the temporal distinction |
| [How Memory Management Impacts LLM Agents](https://aclanthology.org/2026.acl-long.27/) | Shows experience-following, error propagation, and misaligned replay under memory addition/deletion | Studies the agent's memory and task performance, not a platform profile learning from delegate actions | **High** to cross-task-interference claims |
| [ShopperBench](https://aclanthology.org/2026.eacl-industry.62/) | Benchmarks persona-guided shopping agents with goals, rationales, and preference cues | Measures agent persona fidelity and path consistency, not downstream platform learning from agent traces | **High** to generic shopping-agent novelty |
| [PROPER Agents / PersonalWAB](https://aclanthology.org/2026.findings-acl.2082/) | Separates long-term persona, shopping query, situational needs, and product affordances | It personalizes the agent's recommendation; it does not audit platform-side activation of the agent's behavior | **High** |
| [iAgent](https://aclanthology.org/2025.findings-acl.928/) | Places an instruction-aware agent with dynamic memory between the user and recommender | Agent as protective intermediary rather than delegate trace as learned platform evidence | **High** |
| [Profile Pollution Attack, AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/view/38606) | Uses “profile pollution” for malicious interaction injection into sequential recommenders | Our target is benign/misattributed delegate evidence, not an adversarial attack | **Fatal** to the term, not to the residual |

## Narrowed research object

### Recommended working title

**Before the Task Counts: Auditing When Delegated Actions Become Recommendation Evidence**

### Unit of analysis

A single delegated task episode with:

- a known principal;
- a known software delegate;
- an explicit task boundary;
- a pending terminal outcome such as selected, purchased, abandoned, failed, or
  cancelled;
- timestamped recommendation slates before, during, and after resolution.

### Core counterfactual

The same delegated actions are replayed under lifecycle policies that differ
only in activation timing:

| Arm | Before outcome | At outcome resolution | Final state after cancellation |
|---|---|---|---|
| Immediate activation | Evidence affects ranking | Retain or remove | Empty after removal |
| Hold-before-activation | Evidence is staged but cannot affect ranking | Commit selected evidence or discard | Empty after discard |
| No-delegate baseline | No evidence added | No change | Empty |

The critical comparison is immediate-then-remove versus hold-then-discard:
both finish empty, but only the first can alter already-rendered slates.

### Primary measures

1. **Provisional exposure AUC:** cumulative paired ranking displacement before
   outcome resolution.
2. **First affected slate:** latency from the first delegate action to the first
   changed recommendation.
3. **Residual displacement:** ranking difference after outcome resolution and
   any removal.
4. **Task utility:** whether holding evidence impairs the active delegated task.
5. **Model heterogeneity:** variation across content, neighborhood,
   sequential, and learned sequence recommenders.

### Research questions

**RQ1 — Activation timing.** Under a matched final stored state, how much
recommendation exposure occurs when known-delegate evidence is activated
before task outcome resolution rather than held until resolution?

**RQ2 — Memory assumptions.** How does provisional and residual exposure vary
across recommender families and task categories under the same paired delegate
trace?

**RQ3 — Human understanding (optional CHI layer).** Can people distinguish
“this evidence will never become active unless the task succeeds” from “this
evidence will be deleted if the task fails,” and can they accurately predict
the recommendations each contract permits before resolution?

RQ3 must not be claimed or answered without participants.

## What the current evidence can and cannot do

### Already useful

- Four Amazon categories, 30,838 histories, 261,836 events, 12 SASRec
  checkpoints, and 54,000 paired task rows show that counterfactual temporary
  events can displace later rankings across categories.
- Persist-all effects are positive in all four category-specific 95% intervals;
  the equal-category pooled estimate is +0.321 excess target-family slots at
  10, with a 95% interval of [0.273, 0.369].
- Category point estimates vary from +0.119 to +0.612, supporting algorithm and
  domain heterogeneity rather than a universal effect size.

### Still missing for the narrowed claim

- an actual or faithfully generated delegate trajectory rather than only a
  counterfactual item injection;
- explicit task-outcome timestamps and recommendation checkpoints during the
  unresolved interval;
- immediate-then-remove and hold-then-discard arms with a verified identical
  final state;
- a task-utility check showing that staging does not merely disable useful
  within-task personalization;
- for a CHI claim, evidence about people's understanding and choices.

## Contribution set after narrowing

Keep only these candidate contributions:

1. a temporal audit protocol for known-delegate evidence with matched final
   state and intermediate recommendation checkpoints;
2. provisional exposure measures that distinguish what was already shown from
   what remains stored;
3. a paired multi-model, cross-category evaluation of activation timing;
4. optionally, a human study of the mental-model difference between prevention
   and later removal.

Do not claim as contributions:

- temporary-versus-durable preference separation;
- private mode, quarantine, profile editing, forgetting, or unlearning;
- cross-task interference, shopping agents, provenance, or ACI in general;
- “profile pollution” as a new phenomenon;
- universal harm, preference change, identity change, or algorithm-independent
  effects;
- a validated user control without a human study.

## Go/no-go gates

| Gate | Go | Pivot / no-go |
|---|---|---|
| Exact-neighbor gate | No inspected work combines known delegate, pending outcome, matched final state, and provisional recommendation exposure | A new paper is found with the same unit, manipulation, and outcome |
| Directness gate | Real or generated delegate trajectories include task and outcome timestamps | Only anonymous Amazon review histories remain |
| Temporal gate | Immediate-remove has non-zero provisional exposure while hold-discard has zero or materially less under the same final state | Effects exist only after the task and disappear under realistic online updating |
| Utility gate | Holding external profile activation preserves within-task task success through task-local state | The mitigation works only by removing useful personalization |
| Robustness gate | Direction recurs across at least two learned recommender families or two domains, with uncertainty | Result depends on one hand-built ranker or one seed |
| CHI gate | Participants reveal a specific prevention-versus-removal mental-model problem and the prototype changes comprehension or decisions | The UI study only shows generic preference for more control |

## Recommended venue-shaped scope

- **RecSys / CCF-B computational paper:** RQ1–RQ2, real delegate traces,
  activation checkpoints, multi-model evaluation, and task-utility trade-off.
- **CHI paper:** the same system evidence plus RQ3; the novelty must be the
  temporal mental model and consequential choice, not the existence of a
  control panel.
- **Portfolio artifact:** visualize the same task twice—one trace becomes
  active immediately and is later removed; the other is staged—and let the
  visitor scrub the timeline to see recommendations that cannot be “unshown.”

## Calibrated novelty statement

> Prior work already separates temporary and durable preference, supports
> private or editable recommendation profiles, audits data revocation, isolates
> agent memories, and personalizes shopping agents. Within this scoped review,
> we did not identify an empirical study that holds the delegate trace and final
> stored state constant while varying whether known-delegate evidence becomes
> recommendation-active before a pending task outcome is resolved. We therefore
> study activation timing and already-incurred recommendation exposure, rather
> than proposing a new memory separation, deletion, or profile-control method.

