# When Deletion Is Too Late

## Working subtitle

Recommendation Exposure and Behavioral Path Dependence in Shopping Agents

## One-sentence version

Allowing temporary-task activity into a platform recommender can change what
an autonomous agent sees and chooses; deleting that activity afterward cannot
rewind an action that has already changed the resolved interaction history.

## Core phenomenon

Personalization systems treat interaction history as input to future rankings.
An autonomous shopping agent closes a feedback loop around that assumption:
its browsing changes the recommender, the changed recommender changes what the
agent sees, and that exposure can change the action the agent commits. A later
deletion may restore stored task evidence while leaving the altered action and
its downstream ranking consequences intact.

We call this narrower phenomenon **recommendation-mediated behavioral path
dependence**. It is not a claim that a human preference changed or that a model
parameter is permanently contaminated. “Persistent” means that, within a
paired research-system replay, the immediate and held trajectories reach
different resolved actions or next-task rankings after temporary browsing
evidence has been handled. The study asks when this path dependence appears,
when it disappears, and whether outcome-gated platform activation prevents it
without removing useful task-local personalization.

## Core research questions

### RQ1 — Exposure-mediated behavioral path dependence

Beyond divergence caused by repeated stochastic model calls, when does
immediate platform-recommender activation change an agent's action trace and
leave a different protocol-defined next-task ranking after outcome handling?

### RQ2 — Boundary conditions

How does the adjusted behavioral-feedback effect vary across LLM families,
agent policies, recommender sequence encoders, and product categories?

### RQ3 — Task-local preservation

Can outcome-gated platform activation preserve current-task decision accuracy
and selected-item utility when both conditions retain the same task-local
retrieval channel?

The control interface is a design artifact derived from these results. Without
a human study, the paper has no RQ about usability, trust, comprehension, or
control preference.

## Study chain

| Layer | Evidence | Supports | Does not support |
|---|---|---|---|
| Signed-out storefront probe | 4 isolated conditions; 24 frozen navigations; 8 redacted before/after slices | Preference-facing page traces can remain visible after temporary actions | Internal profile writes, account effects, or long-term personalization |
| Released WebArena failure replay | Lifecycle replay over released trajectories | Holding before activation and rollback can share a final state while differing provisionally | Human response or platform persistence |
| Controlled cross-task mechanism | 5 scenarios × 40 paired seeds × 6 contracts = 1,200 runs | Retained temporary evidence can alter later slots in a transparent model | A calibrated commercial recommender |
| Synthetic sensitivity | 250 cells × 100 paired runs = 25,000 runs | The custom ranker has a parameter-dependent boundary | A general law or population estimate |
| Real-history algorithm validation | 703 histories × 3 task bands × 4 algorithms × 3 lifecycle rules = 25,308 paired rows | The paired effect survives multiple personalized families and differs by memory assumption | Observed delegation, shopping-domain transfer, or commercial effect size |
| Learned commerce sequence validation | 3,811 Amazon histories; 3 SASRec seeds; 600 histories × 3 task bands × 3 seeds × 3 lifecycle rules = 16,200 paired rows | The effect recurs in a learned, order-sensitive e-commerce recommender | Observed delegation, deployed Amazon behavior, purchase intent, or human response |
| Cross-category learned replication | 4 Amazon categories; 30,838 histories; 261,836 events; 12 SASRec checkpoints; 54,000 task rows; hierarchical user/seed bootstrap | The direction recurs across four domains and survives leave-one-category-out checks | Universal e-commerce generality or one constant effect size |
| Shopping-agent activation-timing experiment | 320 generated tasks; 960 task-seed rows; 4 categories; 12 SASRec checkpoints; four recommendation snapshots | Immediate activation changes pending-task rankings under a matched resolved state; holding platform activation preserves identical task-local utility | Amazon.com behavior, frontier-agent behavior, human response, or trained-model unlearning |
| Online storefront v2 | 460 tasks; 22,080 condition rows; four contracts; fixed traces and two free-running policies; frozen SASRec checkpoints | Separates logging from ranking activation, tests deletion timing, and measures recommendation-mediated trajectory divergence with preregistered uncertainty gates | Frontier-LLM behavior, human response, commercial deployment, or model-state unlearning |
| Sequence-encoder robustness | Same 460 tasks and protocol; SASRec versus GRU recurrent encoders; 44,160 condition rows and 11,040 paired contrasts | Tests whether activation timing recurs when the learned sequential architecture changes | Architecture independence, production behavior, or canonical reproduction of every GRU4Rec optimization detail |
| Matched LLM boundary pilot | 32 frozen tasks per provider; MiMo v2.5 and DeepSeek V4 Flash; two prompt policies; two sequence encoders; independent held-exposure sham pairs | Shows that equally displaced shelves changed DeepSeek traces but not MiMo traces under the matched decoding protocol | A provider-general effect or a stable provider interaction estimate |
| Revised confirmatory gate | A new provider-sensitivity design is required before scaling; the previously frozen 360-task cross-family recurrence study is paused | Tests which model or policy properties make recommendation changes behaviorally consequential | Human behavior, production-retailer effects, or indefinite model persistence |

## Results

### R1 — Final state hides provisional exposure

In the released WebArena replay, holding before activation and rollback produced the same final
result for failed tasks. Rollback nevertheless activated `0.178542` mean
evidence mass before removing `26.86` total mass; the staged hold activated none. In
the Amazon-linked controlled replay, rollback similarly exposed `1.33`
provisional mass before removal. The result is about **when evidence becomes
active**, not merely whether it is later deleted.

### R2 — Retained evidence displaced later-task recommendations

Across 1,200 controlled runs, persist-all produced `24.17` temporary-topic
slots over eight later rounds and reached its first clean round at `5.04` on
average. Intent weighting reduced the count to `3.775` but did not guarantee
zero spillover. Holding until outcome resolution, rollback after abandonment, and
purchase-only scope produced zero post-task slots in this frozen model.
Rollback still caused `2.56` provisional excess slots before outcome resolution;
the staged hold caused zero.

### R3 — The synthetic phase was bounded, not universal

Of 250 cells, `53.6%` had zero mean excess exposure and `46.4%` had positive
exposure. Higher profile weight increased exposure, while faster decay and
intent weighting reduced it. Each cell subtracts a paired no-write
counterfactual at identical task similarity. These results explain the custom
mechanism; they do not establish a real-world threshold.

### R4 — The effect survived three families but was not algorithm independent

The external validation retained 703 MovieLens users with at least 20
chronological positive ratings. Four counterfactual temporary-task events were
activated against identical no-injection candidate sets, held-out futures,
global models, and tie-breaking.

| Recommender | Persist spillover rate | Intent-weighted rate | Persist Top-10 displacement | Persist Recall@10 delta |
|---|---:|---:|---:|---:|
| Content centroid | 19.7% | 4.4% | 23.0% | -0.0017 |
| Item neighborhood | 19.8% | 7.7% | 13.7% | -0.0070 |
| Sequential transition | 50.2% | 49.1% | 93.5% | -0.0771 |
| Global popularity | 0% | 0% | 0% | 0 |

Holding before activation exactly reproduced the no-injection ranking for every
family. The popularity negative control was invariant under every lifecycle.
Intent weighting strongly attenuated content and neighborhood models but barely
changed whether the sequential model spilled over.

Task similarity was measured from each real history rather than supplied to a
ranker. Its effect was not universally monotonic: content spillover peaked in
the medium band, while neighborhood and sequential spillover rose toward the
high band. The stronger conclusion is algorithm heterogeneity, not a universal
phase boundary.

MovieLens provides real human sequences and genres, not agent labels. The
temporary task remains a counterfactual injection; genres are a topic proxy,
not an e-commerce taxonomy.

### R5 — A learned e-commerce sequence model reproduced the task-boundary effect

Three SASRec models were trained from scratch on Amazon Reviews 2018 Luxury
Beauty chronologies: 3,811 histories, 34,246 retained review interactions, and
1,581 items. Every review was treated as implicit feedback, matching the
original SASRec event-retention and per-user leave-two-out protocol. On one
held-out item against 99 fixed unseen negatives, mean test NDCG@10 was `0.464`
for SASRec, `0.185` for popularity, and `0.426` for a first-order transition
control. Reversing observed histories changed the top 10 in `97.2%` of cases.

The paired task-boundary result used 600 deterministically selected histories,
three within-history similarity bands, every trained seed, and identical
candidate masks across lifecycle arms.

| Lifecycle | Mean excess target-family slots @10 | Positive spillover rate | Top-10 displacement | Next-item hit delta |
|---|---:|---:|---:|---:|
| Persist all four temporary items | +0.410 | 29.9% | 75.3% | -0.1411 |
| Commit final selected item | +0.333 | 28.6% | 70.1% | -0.1302 |
| Hold before platform activation | 0 | 0% | 0% | 0 |

Persist-all exposure was positive under all three model seeds. Outcome commit
attenuated but did not eliminate the effect; the staged hold exactly reproduced the
paired original ranking. The negative next-item hit delta is a system metric:
it indicates that the injected task displaced held-out sequence signal, not
that a person experienced harm.

The dataset contains real product-review chronologies, not agent traces. The
released category and brand metadata are nearly empty, so target families use
a frozen, support-filtered title-token proxy. Tokens define the exposure
outcome but are never inputs to SASRec. This result removes the movie-domain
and non-learned sequential-model proxies while retaining a counterfactual
delegation boundary.

### R6 — The direction replicated across categories; the magnitude did not

The shared-protocol replication added Software, Industrial and Scientific, and
Prime Pantry without category-specific tuning. Across 30,838 histories and
261,836 retained review events, all 12 SASRec checkpoints beat popularity in
held-out NDCG@10. Each category contributed 500 deterministically selected task
users, three within-user similarity bands, and all three lifecycle conditions.

Uncertainty was estimated with 2,000 hierarchical bootstrap replicates. Model
seeds and users were resampled separately; repeated bands stayed attached to
their user. The pooled estimate weights each category equally.

| Category | Persist-all excess slots @10, 95% CI | Outcome-only excess, 95% CI | SASRec − popularity NDCG@10, 95% CI |
|---|---:|---:|---:|
| Luxury Beauty | +0.435 [0.328, 0.565] | +0.355 [0.248, 0.490] | +0.279 [0.268, 0.290] |
| Software | +0.119 [0.015, 0.228] | +0.075 [-0.031, 0.185] | +0.250 [0.235, 0.267] |
| Industrial and Scientific | +0.612 [0.507, 0.708] | +0.531 [0.447, 0.615] | +0.121 [0.115, 0.127] |
| Prime Pantry | +0.119 [0.087, 0.152] | +0.091 [0.057, 0.127] | +0.121 [0.116, 0.126] |
| Equal-category pooled | +0.321 [0.273, 0.369] | — | — |

All four persist-all intervals were positive, outcome-only commit was smaller
in all four point estimates, and holding before activation exactly reproduced every paired
baseline. Every leave-one-category-out pooled lower bound also remained above
zero. The category-resampled descriptive interval was [0.117, 0.552].

The point estimates nevertheless spanned +0.119 to +0.612. We therefore claim
cross-category recurrence under this protocol, not a universal commerce effect
size. Four category units are too few for a stable random-effects
heterogeneity estimate.

### R7 — Activation timing changed pending recommendations without reducing task-local utility

We generated 320 shopping-agent tasks over the four Amazon sequence datasets.
The deterministic agent searched, opened products, requested task-local
recommendations, compared candidates, and selected or abandoned. There were
156 selected and 164 abandoned tasks. Every realized action trace was replayed
under immediate activation followed by outcome resolution and under a hold
until the outcome was known. The principal history, task, storefront,
observations, trace, SASRec checkpoint, candidate mask, outcome, and resolved
state were paired.

Recommendations were recorded at task start, during the task, after outcome
resolution, and at the next-task checkpoint. Across 960 task-seed rows, pooled
in-progress top-10 displacement was `0.766` with a 95% bootstrap interval of
`[0.741, 0.792]`. All four category-specific intervals were above zero. The two
conditions matched exactly after resolution and at the next-task checkpoint.

Both conditions retained the same task-local recommendation state. Every agent
trace consumed task-local recommendations, and the maximum paired task-utility
difference was zero. A no-task-local diagnostic reduced selected-item utility
in three of four categories, showing that the task-local channel was doing
useful work rather than being an unused implementation detail.

This result establishes a computational timing effect, not a deployed-platform
effect. The agent is deterministic, the storefront is offline, and the tasks
are generated even though the underlying histories are real public sequences.
Exact post-resolution equality is a replay property, not trained-model state removal.

### R8 — Logging alone was inert; activation timing changed both shelves and trajectories

The online v2 study froze 115 tasks per category from the largest pilot
task-level SD, for 460 tasks total. Four contracts separated no task memory,
an audit log excluded from ranking, immediate recommendation activation with
later removal, and an outcome-gated hold. Each contract was evaluated under
identical fixed traces and under two autonomous retrieval-and-planning
policies. The design produced 22,080 condition rows and 5,520 paired contrasts.

Under fixed traces, immediate-versus-held in-progress Top-10 displacement was
`0.765 [0.745, 0.785]`, exceeding the preregistered `0.15` lower-bound gate.
At outcome resolution and at the standardized next task, displacement was
`0.000` with upper 95% bounds of `0.000`, satisfying the preregistered `0.05`
equivalence margin. No-memory and logged-inert rankings and traces matched
throughout. This isolates recommendation activation rather than event capture
as the operative mechanism in the research system.

When recommendation shelves could affect subsequent actions, immediate and
held trajectories diverged in `36.7% [31.6%, 43.4%]` of paired runs. The
descriptive divergence rates differed sharply by policy: `12.7%` for the
constraint-first agent and `60.9%` for the exploration-first agent. Held
activation was non-inferior on the frozen decision-accuracy and selected-item
utility margins. Eight fixed pairs had zero T1 displacement, 162 condition
rows contained an incorrect decision, and 11,106 ended abandoned; these cases
remain in the public output rather than being excluded.

This is the strongest direct test of the paper's timing mechanism, but it
remains a computational replay. SASRec inference ran offline and the deployed
static page exposes frozen pseudonymous slates. The policies are deterministic
autonomous agents, not frontier LLMs, and equality after resolution is a
context-replay result rather than learned-model unlearning.

### R9 — The timing effect recurred under a recurrent encoder, but trajectory amplification changed

The model-robustness extension held tasks, contracts, agent policies, modes,
seeds, candidate masks, and the bootstrap hierarchy fixed while replacing the
SASRec self-attention encoder with a one-layer GRU sequence encoder. Both used
the same 32-dimensional item representation and sampled next-item objective.
The resulting artifact contains 44,160 condition rows and 11,040 paired
contrasts.

Both model families beat global popularity in mean test NDCG@10 in all four
categories and changed at least 93.9% of Top-10 rankings under reversed
histories. The recurrent model did not beat the first-order transition control
in every category, and one Software seed was notably weak; these limitations
remain in the released results.

| Model | Fixed T1 displacement, 95% CI | Free T1 displacement, 95% CI | Free trace divergence, 95% CI |
|---|---:|---:|---:|
| SASRec | 0.766 [0.746, 0.786] | 0.781 [0.762, 0.799] | 36.8% [31.6%, 43.3%] |
| GRU | 0.745 [0.639, 0.813] | 0.756 [0.646, 0.825] | 30.3% [25.2%, 35.0%] |

Both encoders passed the preregistered recurrence, equivalence, and inert-log
gates. A post-confirmatory paired comparison found a GRU-minus-SAS difference
of `-0.064 [-0.106, -0.015]` in free-running trace divergence. The corresponding
fixed and free recommendation-displacement differences included zero. We
therefore claim recurrence of the timing effect across two learned sequence
encoders, together with model dependence in how shelf differences propagate
into trajectories—not architecture independence.

### R10 — Equal shelf displacement did not produce cross-provider behavioral recurrence

The original MiMo v2.5 pilot crossed 32 tasks with constraint-first and
exploration-first prompts, SASRec and GRU sequence encoders, and four activation
contracts. It produced 256 condition trajectories and 64 paired
immediate-versus-held contrasts. Under its original decoding configuration,
nine of 64 action traces diverged and eight met the protocol-defined persistent-
feedback event. That run lacked independent held-versus-held sham trajectories.

We then froze a matched four-arm protocol before running either provider:
immediate-remove, held-outcome, and two independently called held-sham arms.
Tasks, pseudonymous candidate features, agent policies, recommender outputs,
temperature, retry rules, and primary event definitions were fixed. This
separates recommendation-mediated divergence from repeated-call stochasticity.

Both matched provider runs had `0.696875` mean in-task Top-10 displacement. The
recommender intervention was therefore equally strong at the shelf level.
DeepSeek traces diverged in 11/64 exposure contrasts, versus 0/64 sham
contrasts; 9/64 exposure contrasts also changed the protocol-defined next-task
ranking, for a sham-adjusted persistent-feedback estimate of `+0.140625`.

MiMo produced 0/64 exposure trace divergences and 0/64 sham trace divergences
under the same matched protocol. Its accuracy and selected-utility contrasts
were also exactly zero. The earlier MiMo divergence therefore did not recur
under the controlled decoding configuration.

Reliability does not explain the contrast. DeepSeek returned 483/483 valid
actions with no retries or timeouts. The completed MiMo run returned 256/256
valid actions with no retries or timeouts. Both providers passed the frozen
sham, privacy, and protocol-integrity gates.

The cross-family recurrence gate failed. The narrow defensible conclusion is
that recommendation exposure can propagate into later behavior for one tested
provider configuration, while an equally large recommendation change was
behaviorally inert for another. The former 360-task confirmation plan should
not be scaled unchanged. The next study must first isolate whether this boundary
comes from provider family, decoding configuration, action-margin sensitivity,
or an interaction between policy wording and model behavior.

## Contribution statement

1. **Empirical.** We characterize recommendation-mediated behavioral path
   dependence in a research shopping system, separating in-task ranking
   exposure, agent-trace divergence, and downstream consequences across task
   checkpoints. Matched MiMo and DeepSeek pilots show that equally displaced
   shelves need not produce equally changed behavior; the propagation step is
   model-contingent in the current evidence.
2. **Conceptual.** We distinguish stored-state reversibility from interaction-
   path reversibility: removing temporary evidence can restore a profile input
   while failing to restore the action that would have occurred without the
   earlier recommendation exposure.
3. **Methodological.** We introduce a paired four-arm protocol that separates
   platform activation from task-local retrieval and calibrates LLM stochastic
   divergence with two independent held-exposure sham trajectories. Real
   commerce histories, two learned sequence encoders, four categories, fixed
   candidate masks, and explicit failure accounting bound the comparison.
4. **Design.** We translate the mechanism into outcome-gated platform
   activation with a separate task-local channel and an inspectable control
   prototype. The design implication follows from computational evidence; the
   interface's usability and human interpretation remain unevaluated.

## Figure set

| Figure | Artifact | Paper role |
|---|---|---|
| Fig. 1 | Redacted storefront evidence slice and extraction manifest | Teaser with the observational boundary explicit |
| Fig. 2 | Action → staged evidence → active profile → recommendation → outcome | Explains why holding and rollback differ before final state |
| Fig. 3 | WebArena failure-lifecycle bars | Released-trace provisional versus final evidence |
| Fig. 4 | `figures/figure-4-lifecycle-exposure.svg` | Controlled lifecycle comparison |
| Fig. 5 | Multi-family spillover, displacement, and Recall@10 panel | Core external-validity result |
| Fig. 6 | Exposure-sensitivity surface (generated SVG) | Supporting custom-ranker mechanism surface |
| Fig. 7 | Website prototype states: HOLD, UNDO, BUY | Unevaluated design implication |
| Fig. 8 | `figures/figure-6-learned-sasrec.svg` | Learned-model validity and lifecycle exposure |
| Fig. 9 | `figures/figure-7-cross-category-uncertainty.svg` | Category-specific and equal-weight pooled 95% bootstrap intervals |
| Fig. 10 | `public/evidence/delegated-activation/v1/selected-timeline.png` and `abandoned-timeline.png` | Four-checkpoint agent-trajectory comparison under matched resolved state |
| Fig. 11 | `?view=storefront-v2&mode=free-running&phase=task-in-progress` plus v2 contrast intervals | Four-contract model-backed replay and fixed-versus-free-running estimands |
| Fig. 12 | SASRec-versus-GRU fixed displacement and free trace-divergence intervals | Recurrence and model-dependent trajectory amplification |
| Fig. 13 | Immediate-versus-held trace pair with the held-versus-held sham calibration | Makes exposure-adjusted behavioral path dependence visible |

## Claim discipline

- Say “visible page traces appeared in this bounded signed-out probe,” not
  “Amazon changed the profile.”
- Say “counterfactual injection over real histories,” not “real agent
  behavior.”
- Say “three personalized families responded differently,” not “algorithm
  independent.”
- Say “ranking displacement,” not “preference manipulation” or “harm.”
- Say “interaction prototype,” not “validated control.”
- Say “frozen model-backed replay,” not “live SASRec service” or “Amazon test.”
- Say “deterministic autonomous policies,” not “frontier LLM agents.”
- Say “behavioral path dependence within the paired replay,” not “permanent
  contamination,” “irreversible preference change,” or “unlearning failure.”
- Say “DeepSeek-only behavioral propagation under the matched pilot,” not
  “cross-LLM replication” or “provider-general agent feedback.”

## Most defensible paper story

The strongest story is not that transient evidence can “pollute” a profile.
Prior work already motivates transient intent and editable personalization.
The less visible problem appears earlier in the loop: temporary activity changes
a recommendation, the recommendation changes an agent's action, and the action
becomes part of the resolved history. At that point deletion can repair stored
evidence without restoring the counterfactual interaction path.

The fixed-trace experiments establish the first link: immediate activation,
not event logging, changes the recommendation slate. The matched LLM pilot now
shows that the second link is conditional: the same mean shelf displacement
propagated into DeepSeek actions but not MiMo actions. The held condition keeps
the same task-local retrieval channel, so preventing platform activation does
not require making the current agent task-blind.

The sham contrast ruled out observed repeated-call divergence in both matched
provider runs, but the exposure effect recurred only in DeepSeek. This triggers
the prespecified contraction: the defensible contribution is the ranking-
exposure mechanism plus a model-contingent propagation boundary. Before a large
confirmation, a smaller diagnostic study should vary decoding and action-margin
sensitivity within each provider while retaining the same paired sham design.
