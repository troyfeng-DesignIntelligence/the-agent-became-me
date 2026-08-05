# Final report

Target achieved at iteration 2 with evidence-readiness score `1.000`.

- Real e-commerce corpus: 3,811 histories, 34,246 retained events, 1,581 items.
- Learned model: three independently trained SASRec seeds; all converged.
- Mean test NDCG@10: SASRec `0.464`, popularity `0.185`, first-order transition
  `0.426`.
- Persist-all task injection: `+0.410` mean target-family slots at 10 and
  `-0.1411` next-item hit delta.
- Outcome-only commit: `+0.333` slots.
- Pre-activation quarantine: exact zero change.

Raw sources, source identifiers, and checkpoints remain local. The temporary
task and lifecycle interpretation are counterfactual; no deployed Amazon or
human-response claim is made.

