# P0/P1 repair and paper-oriented review

## V7 update: P0-A closed within the research-storefront scope

The complete natural-frame V7 crossed 460 tasks with SASRec and GRU4Rec. With
explicit `platformRank` and `inspected` fields removed, candidate order alone
produced a categorical energy-distance estimate of 0.193 [0.155, 0.233] for
DeepSeek and 0.147 [0.115, 0.183] for MiMo. The masked estimates were 0.004
[-0.003, 0.013] and 0.000 [-0.007, 0.008]. The frozen treatment-meaning gates
passed. V8 subsequently closed the one-step system-feedback part of P0-B;
calibrated task value, human consequence, and long-horizon behavior remain open.

The supported phenomenon is recommendation-order-induced agent choice
divergence. Prior work already establishes candidate-order sensitivity in LLM
ranking, so novelty cannot rest on that phenomenon alone. See
`V7_CONFIRMATORY_REPORT_2026-08-07.md` and
`COLLISION_REVIEW_RECOMMENDATION_ORDER_2026-08-07.md`.

## Current verdict

V6–V8 now form an internally auditable one-step feedback chain, but the package
is not yet a competitive IUI full paper and remains borderline for a RecSys
full paper. The remaining P0 is value significance: the treatment changes a
later shelf and later model action, but the endpoint does not show decision
benefit, regret, long-run amplification, human consequence, or a production
failure. This cannot be repaired by stronger prose.

## P0 repairs completed in this pass

### Public audit chain

- Public rows now include pseudonymous state hashes, candidate layouts,
  platform ranks, inspected aliases, feasible-platform aliases, and matched
  post-resolution hashes.
- The evaluator recomputes categorical energy distance, within-arm variation,
  quality differences, opportunity, exposure change, inspected identity,
  layout equality, selectable inspection, and restoration from those
  primitives.
- It rejects duplicate task-by-recommender cells, incomplete family pairs,
  wrong category counts, undeclared checkpoint seeds, and disagreements between
  stored fields and recomputed values.
- Cached provider responses were replayed to create the new public rows. API
  request count was zero and no new cost was incurred.

### Statistical reporting

- The original frozen unstratified task bootstrap remains in the artifact.
- A dated reporting amendment uses within-category task resampling so the
  fixed equal category weights stay fixed. The conclusion is unchanged:
  DeepSeek 0.126 [0.093, 0.161]; MiMo 0.111 [0.080, 0.142].
- The confirmatory hierarchy now names DeepSeek as the single confirmatory
  hypothesis, MiMo as second-provider robustness, quality/failure outcomes as
  guardrails, and subgroup/opportunity results as descriptive.
- The MiMo gate now requires its interval, not merely its point estimate, to be
  above zero. The quality guardrail is checked for both providers.
- Category, recommender, and assigned-checkpoint-seed intervals are published.
  They are conditional on the six trained checkpoints; checkpoint-population
  uncertainty is not claimed.

### Terminology and novelty

- The repeated-call expression is now identified as categorical energy
  distance, not a new estimator.
- “Two LLM families” has been replaced by “two provider models.”
- “Agent action” has been narrowed to a categorical provider output over
  pseudonymous candidate records.
- The paper no longer says that holding improves decisions. The -0.05 margin is
  a frozen engineering tolerance on a [0,1] offered-candidate surrogate, not a
  human-utility or harmlessness threshold.
- The closest-work review removes temporary-memory separation, buffering,
  profile editing, revocation, and agent-feedback-loop concepts from the
  contribution list.

### Dependence and provider stability

- The task frame contains 460 distinct source histories and one task per
  source history. Both recommender observations remain inside the task cluster.
- DeepSeek exposes one fingerprint; MiMo exposes no fingerprint. This asymmetry
  is now a limitation.
- Aggregate call-time diagnostics report same-arm lags, matched cross-arm lags,
  Latin-square order groups, and within-category chronological quartiles. They
  can reveal gross drift but cannot prove IID or stationarity.

## What the corrected result actually says

All four calls use a common candidate set and order. Immediate and held states
differ in the research instrument's platform-rank and inspected-item fields.
The categorical energy-distance estimate is positive for both tested provider
models. This is an effect of the complete constructed exposure instrument. It
is not yet an effect of a rendered shelf, a production recommender, a purchase,
or a human preference.

For DeepSeek, 58 of 920 unit-level distance contributions were 2 and 862 were
0. For MiMo, 52 were 2, one was 1, three were -1, and 864 were 0. Across paired
calls, every observed cross-arm transition was a selected-candidate swap; no
select-to-abandon or abandon-to-select transition occurred. This makes the
behavioral result more precise, but not more consequential.

## Remaining P0

### P0-A: treatment meaning is unresolved

The v6 action result may be sensitivity to explicit `platformRank` and
`inspected` features. Candidate order was fixed to remove a layout confound, so
v6 does not test a naturally served recommendation shelf.

Required experiment: preregister an orthogonal instrument audit with at least
the following cells:

1. current rank-plus-inspection metadata with a common order;
2. rank metadata only;
3. inspected marker only;
4. neither field, as a negative control;
5. a served-shelf condition in which exposure is represented by arm-specific
   order, with identical IDs and identical within-arm repeats.

The paper's behavioral interpretation survives only if the served-shelf cell
shows a positive contrast and the negative control does not.

### P0-B: system feedback is measured; value consequence is missing

V8 shows that an order-induced choice changes a later learned-recommender slate
and a second categorical DeepSeek choice. The system-level consequence is no
longer hypothetical. The effect is one step and small in prevalence: the
matched later-action change rate is 2.1% [1.1%, 3.1%]. It does not establish
harm, benefit, autonomy, privacy, task success, regret, or long-horizon value.

Required experiment: use an established shopping-agent benchmark or a newly
documented realistic task set with product language and a consequential
endpoint. For a RecSys paper, compare outcome gating with session-only state,
TTL/decay, selective assimilation, and commit-only updates on task success,
regret, and long-horizon recommendation quality. For an IUI paper, a human
study of comprehension and desired control is additionally required.

### P0-C: residual novelty remains narrow but is no longer order bias alone

CALMRec and RecNet occupy the memory-policy idea, energy statistics occupies
the estimator, and RecInter occupies broad agent–recommender ecosystem feedback.
The residual is the isolated activation-timing to order to action to writeback
chain. That is more defensible than an order-bias paper, but a full-paper method
or consequential policy advantage is still missing.

## Remaining P1

- The three checkpoint seeds are hash-assigned rather than fully crossed with
  every task. Published seed strata are a robustness diagnostic, not variance
  over a checkpoint population.
- Two repeated calls per arm identify the chosen statistic under mutual
  independence and stable categorical output distributions. Hosted-model calls
  cannot prove those assumptions.
- Natural actionable opportunity occurs in only 40/920 units and 33/460 tasks.
  Conditional estimates are descriptive and cannot carry the main claim.
- The -0.05 quality margin has no external calibration. Keep it as a protocol
  guardrail and do not call the result noninferior in human utility.
- Raw prompts and responses remain local. Public pseudonymous primitives and
  response hashes permit the numerical audit but not semantic inspection of
  provider text.
- MiMo supplies no system fingerprint, so version stability cannot be audited
  as strongly as DeepSeek.

## Venue decision

### IUI 2027: no-go in the current form

IUI accepts computational evidence, but its call asks for both computational
and human-centric aspects. An unevaluated interface and API choices over
engineered fields leave a very high fit risk. Do not submit the current full
paper merely to meet the 20 August deadline.

### RecSys 2027: conditional primary target

RecSys remains the better fit. V8 supplies the missing one-step feedback
mechanism, but the paper still needs to show what a gating policy improves and
what it costs. The paper should be a recommender-systems audit of premature
evidence assimilation, not an HCI paper with an ornamental interface. If the
value study fails, retain the artifact as a portfolio project and target a
workshop or short format rather than inflating the claim.

## Strict score after this repair

| Dimension | Score | Reason |
|---|---:|---|
| Internal validity and auditability | 4/5 | Main statistic and invariants now recompute from public primitives; provider IID remains unprovable |
| Statistical reporting | 4/5 | Fixed-category reporting, frozen analysis retained, hierarchy and stricter gates added |
| Novelty | 3/5 | The isolated one-step causal chain is uncommon, but position bias, feedback ecosystems, and memory policies are occupied |
| External validity | 1/5 | Engineered feature records, synthetic tasks, research storefront |
| Consequential evidence | 2/5 | A later shelf and later model action change; decision value, humans, and long-horizon outcomes remain absent |
| IUI fit | 1/5 | No evaluated human interaction |
| RecSys fit | 3/5 | Mechanism evidence is now coherent, but no policy advantage or long-run value endpoint yet |

Overall full-paper recommendation: **borderline reject in current form; invite
resubmission after a calibrated outcome-gating and long-horizon benchmark**.
Confidence: high.
