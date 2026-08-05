# Research Log

## 2026-08-05 — Iteration 0

- Baseline: current external validation uses MovieLens and a count-based
  sequential-transition ranker.
- Evidence-readiness score: `0.200`.
- Decision: replace both the domain proxy and the non-learned sequence proxy.

## 2026-08-05 — Iteration 1

- Removed repeated `(reviewer, item)` pairs before splitting, leaving 24,102
  interactions, 2,631 users, and 1,541 items.
- All three SASRec runs converged and beat both popularity and first-order
  transition controls. Persist-all product-family exposure was positive in all
  seeds; outcome commit attenuated it; quarantine was exactly invariant.
- Mechanical evaluator: `0.910`, fail. The frozen 3,000-user scale gate did not
  pass, so the result was not promoted.
- The original SASRec paper treats each review as an implicit interaction, and
  the authors' partition code appends every interaction line without user–item
  deduplication. Decision: discard this non-standard preprocessing and rerun
  with all published events; do not lower the evaluator threshold.

## 2026-08-05 — Iteration 2

- Retained every published interaction event, matching the original SASRec
  partition behavior. The frozen corpus checks now cover 3,811 users, 1,581
  items, and 34,246 retained events.
- Three seeds completed 20 epochs. Test SASRec NDCG@10 ranged from `0.4560` to
  `0.4690`, versus `0.1835–0.1871` for popularity and `0.4251–0.4268` for the
  first-order transition control.
- Reversing each observed history changed the top 10 in `97.1–97.3%` of cases.
- Across 5,400 paired rows per lifecycle, persist-all added `0.410` mean target-
  family slots at 10; outcome commit reduced this to `0.333`; quarantine was
  exactly invariant. Persist-all reduced held-out next-item hits by `0.1411` on
  average.
- Mechanical evaluator: `1.000`, pass. Decision: keep and promote with the
  counterfactual-task and metadata-proxy boundaries intact.
