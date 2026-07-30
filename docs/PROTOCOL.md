# Experimental Protocol

Protocol version: `protocol.v1`

Status: implemented deterministic synthetic testbed

Human participants: none

External preregistration: none

`protocol.v1` names the executable artifact contract. It is not a claim that the
study was time-stamped or preregistered before development.

## Research question

When an AI agent directly operates a personalized system, how do delegation
provenance and profile-update controls change whether task-driven agent behavior
becomes long-term evidence about the human principal?

The project separates updater interpretation, behavior-side ranking, and
persistence. It also includes controls that can falsify the tempting claim that
provenance itself is responsible for lower profile divergence.

## Environment

The item catalog is a committed 90-product metadata snapshot from Open Food
Facts. It contains public product-level fields only. Product images, reviews,
accounts, purchases by real people, and user-level records are excluded.

Five normalized product and profile axes are derived from selected public
metadata:

- nutrition;
- sustainability;
- plant-based fit;
- low processing;
- indulgence.

These axes are an inspectable test representation, not a psychological model or
a claim to represent a complete person.

Four synthetic scenarios vary the relationship between a fixed evaluator
reference and a temporary delegated task:

1. party snacks — high conflict;
2. hiking fuel — medium conflict;
3. houseguest breakfast — high conflict;
4. weekly breakfast — low conflict.

Three transparent deterministic policies are tested:

- goal-bound;
- exploratory;
- recommendation-following.

The trace generator produces structured `view`, `compare`, `shortlist`, and
`purchase` events. Every event has simulator-known `actualIntent` and a noisy
`observedIntent` available to the updater. No LLM generates actions or scores.

## Shared profile update

For event \(t\), profile component \(j\) is updated toward the selected
product's attribute \(x_{t,j}\):

\[
p_{t+1,j}
=
(1-r_t)p_{t,j}+r_tx_{t,j},
\qquad
r_t=\min(0.95,\eta w_t)
\]

where \(\eta=0.22\) in the baseline and \(w_t\) is the
condition-specific effective event weight.

Base action weights are:

| Action | Weight |
| --- | ---: |
| View | 0.18 |
| Compare | 0.32 |
| Shortlist | 0.56 |
| Purchase | 1.00 |

Observed-intent multipliers are:

| Intent | Multiplier |
| --- | ---: |
| Explore | 0.06 |
| Consider | 0.28 |
| Commit | 0.82 |

Profiles are rounded after each event. The committed TypeScript implementation
in `src/recommender/profile-updater.ts` is normative.

## Study A — Same trace, six update contracts

Study A generates one trace for each scenario × policy × seed cell, then replays
that exact trace through six contracts.

| Condition | Recorded actor / intent | Effective event weight |
| --- | --- | --- |
| Actor-blind | Actor is recorded as principal; noisy observed intent is retained | Base action weight |
| Logged only | Agent actor and observed intent are recorded | Base action weight; provenance is ignored |
| Matched shrinkage | Agent actor and observed intent are recorded | Every base action weight is multiplied by one oracle-calibrated trace-level constant; events are not weighted selectively |
| Provenance-aware | Agent actor and observed intent are recorded and used | Base action weight × observed-intent multiplier |
| Scope-gated | Provenance is recorded and used | Purchase × observed commit only when scenario scope is `commit-only`; otherwise zero |
| No update | Trace remains available for audit | Zero |

For a frozen trace, matched shrinkage uses:

\[
s
=
\frac{\sum_t a_t\,i_t}{\sum_t a_t},
\qquad
w_t^{matched}=a_t s
\]

where \(a_t\) is the base action weight and \(i_t\) is the
provenance-aware observed-intent multiplier. Therefore
\(\sum_t w_t^{matched}=\sum_t w_t^{provenance}\). Sequential blending is
nonlinear, so matching summed effective weight does not force identical final
profiles; it is an attenuation control, not an equivalence proof.

The scalar is computed from the provenance-aware replay's observed-intent
weights. Matched shrinkage is therefore an oracle-calibrated mechanism control,
not a deployable policy that is wholly independent of intent metadata. Its
receipts mark event-level provenance use as false because no individual event
receives an intent-specific multiplier.

### Fixed factors

Within every paired Study A cell, the following are identical:

- catalog snapshot;
- scenario and principal reference;
- task vector and forbidden-allergen constraint;
- transparent policy and seed;
- event IDs, order, actions, products, actual intent, and observed intent;
- baseline learning rate.

Only the profile-update contract changes.

### Decisive comparison

The provenance-specific claim requires provenance-aware updating to outperform
matched shrinkage. In the committed output it does not:

- mean divergence: 0.176 matched shrinkage vs 0.187 provenance-aware;
- mean simulated ranking loss: 0.005 vs 0.006;
- mean task utility: 0.434 in both.
- provenance-aware divergence is higher in all 12 scenario × policy cell means
  and 456 of 480 paired runs.

The current benchmark therefore supports an attenuation explanation, not a
provenance-specific benefit.

## Study B — Behavior proxy versus persistence

Study B fixes provenance-weighted updating and compares three implementation
conditions:

| Condition | Behavior-side ranking | Persistence |
| --- | --- | --- |
| Action only | Baseline policy ranking | Provenance-weighted update |
| Impact proxy | Subtract \(0.16d(x,p_d)\) from each candidate score | Provenance-weighted update |
| Proxy + quarantine | Same proxy ranking and therefore the same paired trace as impact proxy | Exclude observed non-commit events from persistent updates |

\(d(x,p_d)\) is normalized Euclidean distance between a product vector and the
scenario's disclosed profile. It is a static distance proxy, not a projection
of the actual sequential updater.

Action-only versus impact proxy may alter the product ranking and behavior
trace. Impact proxy versus proxy plus quarantine uses identical paired traces
and changes persistence only.

The simulator assigns cost indices 0, 3, and 8 respectively. These values are
hand-authored metadata; they are not observed human time, effort, interruption,
or cognitive load. No person sees a preview, grants approval, or performs a
repair in this study.

## Study C — Learning-needed counterexample

Study A and B start from the scenario's `principalReference`. That setup makes
less updating structurally favorable under the divergence outcome.

Study C therefore selects the low-conflict weekly-breakfast scenario and starts
from its different `disclosedReference`, which functions as a deliberately
stale stored profile. It generates one frozen trace per policy × seed cell and
replays the six Study A contracts.

The stress test contains:

- 1 scenario;
- 3 policies;
- 40 paired seeds;
- 6 contracts;
- 720 runs.

It demonstrates one case in which no update is not optimal: mean divergence is
0.104 under no update and 0.067 under scope-gated learning. It does not estimate
the prevalence of stale profiles or establish which evidence people would want
stored.

## Outcomes

### Reference-profile divergence

Normalized Euclidean distance between final simulated platform profile \(p_T\)
and the scenario's fixed evaluator reference \(u\):

\[
D(p_T,u)
=
\sqrt{\frac{1}{d}\sum_{j=1}^{d}(p_{T,j}-u_j)^2}
\]

The serialized legacy field is `profileContamination`. Reader-facing text uses
the neutral term **reference-profile divergence** because distance alone is not
independently established harm.

### Simulated top-6 ranking loss

The mean reference utility difference between an oracle top-6 list ranked by
\(u\) and a top-6 list ranked by final profile \(p_T\):

\[
L
=
\bar{U}_u(R_u^6)-\bar{U}_u(R_{p_T}^6)
\]

The serialized legacy field is `futureRecommendationRegret`. The deterministic
evaluator—not an LLM—computes both lists.

### Current task utility

Mean task-vector utility of purchased products. This guards against a mechanism
that lowers divergence merely by preventing useful task completion.

## Diagnostics

Diagnostics are reported separately rather than collapsed into an ambiguous
"attribution accuracy" score:

- actor-recording error rate: recorded actor differs from actual trace actor;
- intent-label error rate: recorded intent differs from simulator-known intent;
- attribution error rate: either actor or intent differs;
- event-level provenance-use rate: the updater applies an event-specific
  provenance multiplier;
- persistent-update rate: receipt has positive effective weight;
- hard-constraint violations among purchases;
- hand-authored Study B cost index.

`actualIntent` is synthetic evaluator state, not a person's self-report.

## Baseline design and counts

- 4 scenarios;
- 3 policies;
- 40 paired deterministic seeds per cell;
- 10% event-intent label noise;
- learning rate 0.22;
- 2,880 Study A rows;
- 1,440 Study B rows;
- 720 Study C rows.

The seed count is a fixed simulation budget for covering deterministic trace
variation. It is not based on human-participant power analysis and does not
support population inference. Means and P10–P90 ranges summarize generated-run
variation; the ranges are not confidence intervals.

## Sensitivity analysis

The sensitivity grid crosses:

- label noise: 0, 0.10, 0.20, 0.35, 0.50;
- learning rate: 0.10, 0.16, 0.22, 0.30;
- 4 scenarios;
- 3 policies;
- 20 paired seeds;
- actor-blind and provenance-aware conditions.

This produces 9,600 rows. It is a failure-surface probe, not a robustness
certificate. Because confusing an event with `commit` can increase its weight
while confusing a commit event with `explore` can suppress it, aggregate noise
need not produce a monotonic trend.

## Evidence gates and observed disposition

### Strong provenance claim

Required:

- provenance-aware beats actor-blind;
- provenance-aware also beats matched shrinkage;
- task utility remains comparable;
- direction survives scenario, policy, and parameter variation.

Observed disposition: **falsified in the current testbed** because matched
shrinkage slightly outperforms provenance-aware.

### Operational logging claim

Required:

- logged only and actor-blind reuse identical traces;
- their update behavior and outcome metrics remain identical;
- their actor-recording and provenance-use diagnostics differ as implemented.

Observed disposition: **supported as a code-level mechanism check**.

### Persistence claim

Required:

- impact proxy and proxy-plus-quarantine have identical paired traces;
- only persistence receipts differ;
- outcome differences are described as simulator behavior, not experienced
  control.

Observed disposition: **supported as a synthetic persistence comparison**.

### Learning-needed boundary

Required:

- stale initial state is explicit;
- frozen traces are reused across contracts;
- no-update is allowed to lose;
- the result is described as a constructed counterexample.

Observed disposition: **supported for the single declared stress scenario**.

## Validity boundaries

Generated runs characterize this code, catalog snapshot, scenarios, policies,
and equations. They do not establish how commercial recommenders behave or how
people experience delegation. Scope-gated updates model a data contract; they
do not measure consent. Quarantine prevents persistence before it happens; it
is not rollback or repair. The literature search is scoped, not systematic.
