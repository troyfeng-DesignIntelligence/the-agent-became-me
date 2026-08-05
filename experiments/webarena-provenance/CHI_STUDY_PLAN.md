# WebArena Delegation-Provenance Replay: Study Plan

## Inferential goal

Test whether a downstream profile updater's treatment of externally generated shopping behavior changes when actor and task-scope provenance are operational inputs. The study does not test whether WebArena or Amazon currently uses any such updater.

## Unit of analysis

A released GPT-4 CoT WebArena shopping action trajectory, matched to the official task definition and release outcome by task ID. Replays are nested within trajectory and update contract. Human-agent pairing remains a future extension because the official human-trace host was unavailable from this execution environment.

## Conditions

Each parsed trajectory is frozen before replay and evaluated under the existing six contracts:

1. `actor-blind`
2. `logged-only`
3. `matched-attenuation`
4. `provenance-aware`
5. `scope-gated`
6. `no-update`

Only released agent traces are analyzed in this run. No human behavior reference is inferred or synthesized.

## Primary outcomes

- persistent evidence mass after replay
- non-commit persistent evidence mass
- persistent event rate
- actor-recording error rate
- provenance-use rate
- trace coverage and parse-failure rate
- matched-attenuation versus provenance-aware total-mass difference
- released task success versus downstream evidence exposure

No positive effect is required for experimental success. A null result or a matched-attenuation advantage remains reportable.

## Alternative explanations and controls

- **Different behavior mass:** freeze each released task trace across conditions, report action counts, and retain matched attenuation.
- **Parser selectivity:** publish inclusion rules and every excluded task ID with a reason.
- **Task-category confounding:** stratify by WebArena shopping template or semantic task family where metadata permits.
- **Agent failure behavior:** report WebArena task outcome separately from downstream profile outcomes.
- **Synthetic semantic mapping:** keep the mapping deterministic, versioned, and auditable; do not describe mapped product vectors as observed WebArena attributes.

## Evidence gates

- **Go for agent-only replay:** at least 20 released agent shopping tasks, at least 90% parse success, complete six-condition replay, deterministic rerun, and source checksums.
- **Go for human-agent comparison:** additionally requires at least 20 matched human traces; this gate was not met.
- **Pivot:** if released actions are unavailable, report the task-definition pressure test separately and make no trajectory claim.
- **No-go:** released trace access or redistribution terms cannot be established, semantic actions cannot be recovered reliably, or results depend on selecting desired task outcomes.

## Claim boundary

Permitted: released WebArena traces produce different downstream profile outcomes under specified simulated update contracts.

Not permitted: WebArena, Amazon, or another production platform currently updates profiles this way; the measured vector is a person's identity; the controls provide experienced consent or trust.

## Observed disposition

- Agent-only replay gate: **met** — 192/192 shopping trajectories parsed, six conditions complete, deterministic validation passed, and source/member integrity checks recorded.
- Human-agent comparison gate: **not met** — no human trace was acquired.
- Mechanical evidence-readiness evaluator: `1.000`, `pass: true` for the declared agent-only replay.
