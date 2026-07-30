# Experimental Protocol

Protocol version: `protocol.v1`  
Status: implemented synthetic testbed  
Human participants: none

## Research question

When an AI agent becomes the direct operator of a personalized system, how do
delegation provenance and profile-update controls change whether task-driven
agent behavior becomes long-term evidence about the human principal?

The project separates two causal questions.

## Study A — Trace attribution

Study A freezes the agent behavior trace and replays it through four data
contracts.

| Condition | What the log records | What the profile updater uses |
|---|---|---|
| Actor-blind | Treats every event as principal activity | Action strength only |
| Logged-only | Records actor and purpose | Ignores both fields |
| Provenance-aware | Records actor and `explore / consider / commit` | Downweights non-commit agent activity |
| Approval-gated | Preserves provenance and an explicit learning scope | Updates only when the registered scope permits it |

The logged-only control distinguishes decorative transparency from operational
provenance.

### Constants

- identical catalog, scenario, principal reference, task vector, policy, and
  seed;
- identical behavior trace for all four conditions;
- identical profile update equation and base learning rate;
- deterministic item ordering and named random streams.

## Study B — Agent-facing affordances

Study B fixes the provenance-aware updater and changes the interface available to
the agent.

| Condition | Available interaction |
|---|---|
| Action-only | View, compare, shortlist, and purchase |
| Impact preview | Adds a projected profile-impact signal before commitment |
| Preview and repair | Adds temporary evidence and repair actions for non-commit events |

Unlike Study A, Study B may change the behavior trace. Its results must not be
used to attribute an effect to logging alone.

## Environment

The item catalog is a 90-product metadata snapshot from Open Food Facts. The
testbed uses public product-level fields only. Product images, reviews, accounts,
and user-level records are excluded.

Five normalized item axes are derived from public evidence:

- nutrition;
- sustainability;
- plant-based fit;
- low processing;
- indulgence.

These axes are a compact test representation, not a claim that they describe a
complete person.

Four synthetic scenarios vary the relationship between a fixed principal
reference and a temporary delegated task:

1. party snacks — high conflict;
2. hiking fuel — medium conflict;
3. houseguest breakfast — high conflict;
4. weekly breakfast — low conflict.

Three transparent policies are tested:

- goal-bound;
- exploratory;
- recommendation-following.

## Primary outcomes

### Profile contamination

Normalized Euclidean distance between the final simulated platform profile
\(p_T\) and the fixed principal reference \(u\):

\[
\mathrm{contamination}(p_T, u)
=
\sqrt{\frac{1}{d}\sum_{j=1}^{d}(p_{T,j}-u_j)^2}
\]

### Future recommendation regret

The difference between the principal-reference utility of the oracle top-k list
and the principal-reference utility of the list ranked by the final platform
profile:

\[
\mathrm{regret}
=
\bar{U}_u(R_u^k)-\bar{U}_u(R_{p_T}^k)
\]

The deterministic evaluator—not an LLM—computes both rankings.

### Task utility

Mean task-vector utility of purchased products. This guards against mechanisms
that reduce contamination by preventing useful action.

## Diagnostics

- attribution error rate;
- constraint violations;
- interaction cost;
- sensitivity to intent-label noise;
- sensitivity to profile learning rate.

## Baseline design

- 4 scenarios;
- 3 policies;
- 40 paired seeds per cell;
- 10% intent-label noise;
- profile learning rate 0.22;
- 1,920 Study A runs;
- 1,440 Study B runs.

Sensitivity analysis crosses five label-noise levels and four learning rates
over 20 paired seeds.

## Evidence gates

### Go

- provenance-aware updating lowers recommendation regret and profile
  contamination across multiple policies and scenarios;
- task utility remains materially comparable;
- the direction remains under moderate intent-label noise;
- the result does not depend on accessing hidden principal state.

### Pivot

- if repair controls work but provenance-only does not, reposition the artifact
  around reversible delegated transactions;
- if profile distance changes without downstream regret, reposition it as a
  provenance-audit tool;
- if results survive only one policy, present a benchmark case study rather
  than a transferable mechanism.

### No-go

- differences disappear when action count and information access are controlled;
- provenance fails under small label noise;
- effects reverse unpredictably across policies;
- a direct precedent answers the same mechanism with stronger evidence.

## Validity boundaries

Generated runs demonstrate behavior of this testbed under registered rules. They
do not establish how commercial platforms behave or how people experience the
interfaces. Approval-gated updates model an explicit data contract; they do not
measure experienced consent.
