# P0/P1 repair and paper-oriented review

## Current verdict

The v6 result is internally auditable after the corrections below, but it is
not yet a competitive IUI or RecSys full paper. The remaining P0 is scientific
significance: the treatment is a constructed exposure instrument, and the
current endpoint does not show a real-world or consequential failure. This
cannot be repaired by stronger prose.

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

### P0-B: consequence is missing

The frozen quality surrogate is near zero between arms. That rules out a large
loss on that narrow score; it does not establish harm, benefit, autonomy,
privacy, task success, regret, or long-horizon value.

Required experiment: use an established shopping-agent benchmark or a newly
documented realistic task set with product language and a consequential
endpoint. For a RecSys paper, compare outcome gating with session-only state,
TTL/decay, selective assimilation, and commit-only updates on task success,
regret, and long-horizon recommendation quality. For an IUI paper, a human
study of comprehension and desired control is additionally required.

### P0-C: residual novelty is too narrow for a full paper

CALMRec and RecNet occupy the memory-policy idea, while energy statistics
occupies the estimator. Without P0-A and P0-B, the residual is a careful audit
of an expected input perturbation.

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

RecSys is the better fit if P0-A and P0-B are completed. The paper should be a
recommender-systems audit of premature evidence assimilation, not an HCI paper
with an ornamental interface. If those experiments fail, retain the artifact
as a portfolio project and target a workshop or short-format venue rather than
inflating the claim.

## Strict score after this repair

| Dimension | Score | Reason |
|---|---:|---|
| Internal validity and auditability | 4/5 | Main statistic and invariants now recompute from public primitives; provider IID remains unprovable |
| Statistical reporting | 4/5 | Fixed-category reporting, frozen analysis retained, hierarchy and stricter gates added |
| Novelty | 2/5 | Exact audit bundle is uncommon, but architecture and statistic are occupied |
| External validity | 1/5 | Engineered feature records, synthetic tasks, research storefront |
| Consequential evidence | 1/5 | No detected quality difference and no human or long-horizon outcome |
| IUI fit | 1/5 | No evaluated human interaction |
| RecSys fit | 2/5 | Relevant system question, but no method or consequential advantage yet |

Overall full-paper recommendation: **reject in current form, invite resubmission
after the instrument ablation and consequential benchmark study**. Confidence:
high.
