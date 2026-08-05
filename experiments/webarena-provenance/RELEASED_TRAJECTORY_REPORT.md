# Released WebArena Trajectory Replay

## Result in one sentence

In 192 released GPT-4 CoT shopping trajectories, task failure did not mean the absence of downstream profile-update exposure: 142 of 160 conservatively mapped evidence events occurred in failed trajectories, while a scope-gated updater removed all non-commit evidence in the executable replay.

Status: **observed in a released-trajectory replay**. This is not a human-subject result, a live WebArena run, or evidence about Amazon's recommender.

## What was run

- Source corpus: WebArena release-2 GPT-4 CoT action trajectories distributed in the Agent-Eval-Refine trajectory archive.
- Scope: all 192 tasks whose official WebArena task definition includes the `shopping` site.
- Coverage: 192/192 trajectories parsed; 49 intent templates; 1,740 raw browser steps.
- Outcome labels: 26 successful and 166 failed tasks in the acquired release.
- Evidence adapter: a fixed, inspectable mapping from released click targets to four possible profile signals: `view`, `compare`, `shortlist`, and `purchase`.
- Audit-only actions: typing, scrolling, navigation commands, stop responses, and clicks without an interpretable product/category target.
- Replay: each frozen action trace passed through actor-blind, logged-only, matched-attenuation, provenance-aware, scope-gated, and no-update contracts.

The adapter mapped 160 evidence-bearing events across 67 trajectories. The other 1,580 browser steps remain in the audit count but receive zero profile-evidence weight.

## Observed findings

### 1. Failed tasks still produced profile evidence

Failed trajectories were longer on average (9.64 versus 5.38 audited steps) and contained 142 mapped evidence events across 56 trajectories. Successful trajectories contained 18 mapped events across 11 trajectories.

This does not show that those events harmed a person. It establishes a narrower systems point: a success evaluator can return `Failure` while a downstream personalization pipeline still sees behavior that looks persistable.

### 2. Recording provenance without using it changed no outcome

Actor-blind and logged-only replay both produced mean evidence mass `0.251979` per task and mean non-commit mass `0.194687`. The recorded actor becomes correct under logged-only, but the updater behaves identically.

The operational implication is simple: provenance in a log is not a control unless the update contract reads it.

### 3. Reduced evidence mass was not provenance-specific

Matched attenuation and provenance-aware replay both produced mean total evidence mass `0.068927`. The matched condition uses one trace-level scalar and does not apply event-specific provenance. Therefore a lower-mass result alone cannot identify selective provenance as the cause.

This is a mechanism control, not a claim that both policies would produce identical sequential profiles in a production system.

### 4. Scope gating removed non-commit persistence

The scope-gated contract admitted only an explicit purchase action labelled `commit`. It reduced mean evidence mass by `81.36%` relative to actor-blind replay and reduced mean non-commit mass from `0.194687` to `0`.

This is an executable upper-bound policy. No person reviewed, approved, or repaired a profile in the experiment.

## Condition summary

| Update contract | Mean evidence mass | Mean non-commit mass | Actor-recording error |
| --- | ---: | ---: | ---: |
| Actor-blind | 0.251979 | 0.194687 | 100% |
| Logged-only | 0.251979 | 0.194687 | 0% |
| Matched attenuation | 0.068927 | 0.021948 | 0% |
| Provenance-aware | 0.068927 | 0.021948 | 0% |
| Scope-gated | 0.046979 | 0 | 0% |
| No update | 0 | 0 | 0% |

Each row contains the same 192 released action traces. Only the downstream update contract changes.

## Why this does not duplicate WebArena

WebArena evaluates whether an agent completes realistic browser tasks. This replay starts after those actions exist and asks a different question: what happens if another system treats the delegate's actions as evidence about the human principal?

The contribution is therefore not another browser benchmark score. It is a fixed-trace downstream persistence test, including controls that separate logging, attenuation, selective provenance use, scope gating, and no update.

## Evidence and claim boundaries

- The released archive contains agent trajectories only for this analysis; human WebArena traces were not acquired.
- The click-to-evidence adapter is deterministic and reviewable, but it is not a production logging schema.
- `evidence mass` measures updater exposure. It is not preference accuracy, profile divergence, user harm, consent, trust, or satisfaction.
- The archive mirror did not declare a dataset license at acquisition time. Raw files stay in ignored `artifacts/`; the repository stores only source metadata, hashes, code, and derived aggregate results.
- No live shopping site, user account, order, payment, or commercial profile was touched.

## Reproduce

The raw source members are intentionally untracked. With the source files present under `artifacts/webarena-provenance/raw/`, run:

```text
node scripts/index-webarena-remote-zip.mjs
node scripts/extract-webarena-remote-members.mjs
pnpm webarena:pilot
pnpm webarena:evaluate
```

The evaluator prints one JSON line. The accepted run is:

```json
{"pass":true,"score":1}
```

The complete aggregate result is committed at `public/results/webarena-pilot/v1/summary.json`; task-by-condition derivatives are in `task-results.json`.
