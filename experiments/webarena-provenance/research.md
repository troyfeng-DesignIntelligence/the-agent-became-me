# Research: WebArena Delegation-Provenance Replay

## Goal
Use released WebArena shopping trajectories as externally generated browser-behavior evidence, then test how downstream profile-update contracts treat behavior produced by a human principal versus a software delegate. The experiment must keep behavior generation separate from profile interpretation and must not claim that WebArena or a commercial platform implements the tested updater.

## Success Metric
- **Metric:** evidence-readiness score in `[0, 1]`, computed mechanically from source provenance, shopping-task coverage, human/agent task pairing, parse success, condition completeness, deterministic replay, and validation checks
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize

## Constraints
- **Max iterations:** 6
- **Time budget per experiment:** 5 minutes
- **Pause for review every:** never
- **Evaluator:** `node scripts/evaluate-webarena-experiment.mjs`
- **Keep policy:** pass_only
- **Guard:** existing `pnpm test` and `pnpm verify:artifacts` remain green; evaluator must not require or reward a positive provenance effect
- **Noise runs:** 1
- **Min delta:** 0
- Use only released WebArena data or locally generated derivatives with recorded source URLs and checksums.
- Do not automate Amazon, create accounts, make purchases, bypass access controls, or infer private production policies.
- Do not commit third-party raw traces unless their license and redistribution terms are verified; raw downloads belong under ignored `artifacts/webarena-provenance/raw/`.
- Separate observed outputs from hypothesized interpretations in every report.

## Current Approach
The repository now contains a commit-pinned WebArena task manifest, a byte-range extractor for the published Agent-Eval-Refine trajectory archive, a deterministic action-to-evidence adapter, and a six-contract fixed-trace replay. The acquired release contains 809 GPT-4 CoT trajectories; all 192 official shopping tasks were matched and parsed. The host still cannot run the self-hosted WebArena website stack, and the human Playwright trace folder remained unreachable, so this experiment is a released-agent-trajectory replay rather than a live environment run or a human-agent comparison.

## Search Space
- **Allowed changes:** add a WebArena data manifest, task selector, trace parser, semantic-event adapter, deterministic replay runner, mechanical evaluator, tests, research logs, plots, and clearly delimited website evidence derived from the experiment
- **Forbidden changes:** changing released source traces, selecting results by desired effect direction, weakening the matched-attenuation/no-update controls, relabeling external traces as commercial-platform evidence, modifying existing synthetic baseline artifacts to manufacture agreement, or hiding missing/failed parses

## Context & References
- WebArena paper: https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html
- WebArena repository: https://github.com/web-arena-x/webarena
- Released trajectories: https://github.com/web-arena-x/webarena/blob/main/resources/README.md
- Existing local protocol: `docs/PROTOCOL.md`
- Existing claim boundaries: `docs/CLAIM_BOUNDARIES.md`
- Existing scoped collision review: `docs/COLLISION_REVIEW.md`

---

## History
<!-- Auto-maintained by the agent. Do not edit manually. -->
| # | Change | Metric | Result | Timestamp |
|---|--------|--------|--------|-----------|
| 0 | Baseline: no external WebArena adapter or evidence | 0.000 | baseline | 2026-08-04T15:44:09+08:00 |
| 1 | Shallow-clone official WebArena repository | 0.000 | reverted: network reset before refs | 2026-08-04T15:49:00+08:00 |
| 2 | Pin official task metadata, resource index, license, and checksums | 0.150 | kept | 2026-08-04T16:12:00+08:00 |
| 3 | Attempt official Drive and canonical Hugging Face trajectory endpoints | 0.150 | reverted: connection timeouts | 2026-08-04T17:03:00+08:00 |
| 4 | Complete WebArena-derived task-pressure pilot under six contracts | 0.800 | kept as fallback | 2026-08-04T17:11:00+08:00 |
| 5 | Range-index mirror archive; extract, verify, parse, and replay released GPT-4 CoT traces | 1.000 | kept: target achieved | 2026-08-04T17:20:00+08:00 |
