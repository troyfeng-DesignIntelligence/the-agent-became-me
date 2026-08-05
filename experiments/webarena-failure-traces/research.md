# Research: Failure Does Not Erase the Trail

## Goal
Use released WebArena shopping trajectories to measure how repeated actions and task failure interact with downstream preference persistence, then compare lifecycle contracts that deduplicate, quarantine, scope-gate, or roll back agent-generated evidence.

## Success Metric
- **Metric:** failure-trace evidence-readiness score in `[0, 1]`, mechanically computed from source integrity, OCR corroboration, complete trace coverage, loop detection, lifecycle-condition completeness, deterministic rerun, tests, and calibrated reporting
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize

## Constraints
- **Max iterations:** 5
- **Time budget per experiment:** 5 minutes
- **Pause for review every:** never
- **Evaluator:** `node scripts/evaluate-webarena-failure-experiment.mjs`
- **Keep policy:** pass_only
- **Guard:** existing tests, artifact verification, WebArena trajectory evaluator, typecheck, build, and browser QA remain green
- **Noise runs:** 1
- **Min delta:** 0
- Freeze released actions and task outcome labels before comparing lifecycle contracts.
- Treat OCR as auxiliary corroboration, not ground truth about a production logger.
- Do not claim that failure causes more profile drift without controlling task mix and trace length.
- Keep raw third-party screenshots, OCR, and trajectories under ignored `artifacts/`.
- Separate provisional exposure from final persistent state; rollback and quarantine are not interchangeable.

## Current Approach
The completed replay matches all 192 released GPT-4 CoT shopping trajectories, audits 1,740 raw steps, and applies a strict target taxonomy before lifecycle comparison. Pagination, sorting, account navigation, and category/filter links are excluded from the primary evidence set. Eight source-verified screenshots cover every OCR boundary case plus one corroborated control per action. The frozen 84-event set is then analyzed under two loop keys and six lifecycle contracts.

## Search Space
- **Allowed changes:** acquire and integrity-check released OCR or a bounded screenshot sample; add target-aware action mapping; compute repeats and failure loops; implement persist-all, deduplicate, intent-weighted, outcome-quarantine, rollback-on-failure, and scope-gated contracts; add sensitivity analyses, tests, reports, plots, and website evidence
- **Forbidden changes:** selecting only visually convenient traces, treating OCR as human annotation, inferring production recommender behavior, collapsing provisional and final effects, hiding zero-evidence traces, or claiming a causal effect of failure from unmatched task groups

## Context & References
- Prior released-trace report: `experiments/webarena-provenance/RELEASED_TRAJECTORY_REPORT.md`
- Source manifest: `experiments/webarena-provenance/source-manifest.json`
- WebArena resources: https://github.com/web-arena-x/webarena/blob/main/resources/README.md
- Existing claim boundaries: `docs/CLAIM_BOUNDARIES.md`

---

## History
<!-- Auto-maintained by the agent. -->
| # | Change | Metric | Result | Timestamp |
|---|--------|--------|--------|-----------|
| 0 | Baseline: released actions parsed, but no OCR corroboration or failure-lifecycle comparison | 0.250 | baseline | 2026-08-04T17:45:00+08:00 |
| 1 | Add OCR and lifecycle replay; audit reveals pagination/sort controls in the broad mapper | 0.700 | discarded: mapper precision gate failed | 2026-08-04T19:40:00+08:00 |
| 2 | Freeze strict evidence taxonomy, inspect all OCR misses plus controls, and add label-dedup sensitivity | 1.000 | kept: target achieved | 2026-08-04T19:51:00+08:00 |
