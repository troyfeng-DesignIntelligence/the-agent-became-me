# Failure-Trail Autoresearch Log

## Baseline — Iteration 0

- **Observed:** 192/192 released shopping traces and 1,740 raw steps are locally available with verified hashes.
- **Observed:** The prior conservative mapper admitted 160 events across 67 traces; 142 events occurred in failed traces.
- **Unresolved:** The mapped targets have not been corroborated against page OCR, repeated-target loops are not quantified, and rollback is not separated from pre-persistence quarantine.
- **Baseline score:** `0.250` for source integrity and complete trace coverage.

## Iteration 1 — OCR exposed mapper overreach

- **Hypothesis:** The 160 broad mapped clicks are page-visible preference evidence.
- **Experiment:** Acquired and CRC-checked 7,736 released OCR records, joined them to all mapped image ids, and implemented repeated-target plus six-contract lifecycle replay.
- **Observed:** OCR existed for 160/160 events but corroborated only 104 (65.0%). The misses were dominated by pagination, ascending/descending sort controls, and category/filter navigation admitted as product views.
- **Decision:** Discard the broad mapper result. Strengthen the evaluator with mapper-precision and screenshot-audit gates rather than accepting the initial readiness score.
- **Score under strengthened evaluator:** `0.700`.

## Iteration 2 — Strict taxonomy and boundary screenshots

- **Hypothesis:** Excluding known interface controls and category/filter navigation will leave a defensible primary evidence set without hiding OCR misses.
- **Experiment:** Froze product, review, shortlist, and purchase evidence kinds; excluded UI controls; downloaded all four remaining OCR misses plus one corroborated control per action by ZIP byte range; verified every PNG with CRC-32 and SHA-256; visually inspected all eight; reran all 192 traces through six lifecycle contracts; added exact-key and label-only loop sensitivity.
- **Observed:** 84 primary events remained, 80/84 (95.2%) were OCR-corroborated, and all four OCR misses were visibly valid targets. Exact target repetition was 1.2%; label-only repetition was 29.8%. Exact deduplication reduced failed residual mass by 0.7%; label-only deduplication reduced it by 39.2% while discarding 14.6% of successful evidence. Quarantine and rollback both reduced final failed residual mass from 26.86 to zero, but rollback exposed 0.179 mean provisional mass and quarantine exposed none.
- **Decision:** Keep. The evaluator passed `1.000`; target achieved after two iterations.
