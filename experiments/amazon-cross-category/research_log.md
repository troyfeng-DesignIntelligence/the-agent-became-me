# Research log

## Iteration 0 — frozen baseline

The Luxury Beauty experiment passes its mechanical evaluator but has one domain
and reports point estimates only. The largest remaining reviewer risks are
category specificity and pseudo-replication across user, band, and seed rows.

## Iteration 1 — kept

Downloaded and hash-checked Software, Industrial and Scientific, and Prime
Pantry alongside the existing Luxury Beauty data. One shared protocol trained
three seeds per category. The first execution was interrupted after training a
Software seed because the sandbox denied checkpoint-directory creation; no
scientific setting changed, and the authorized rerun completed.

The evaluator scored `1.000`. All four category-specific persist-all intervals
were positive. The equal-category estimate was +0.321 [0.273, 0.369], every
leave-one-out interval was positive, and quarantine was exactly invariant. The
0.493 range across category point estimates is retained as heterogeneity rather
than averaged away.
