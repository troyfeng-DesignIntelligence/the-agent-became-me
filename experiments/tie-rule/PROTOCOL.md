# Tie-rule experiment

Post-study design experiment for the portfolio (2026-09-25). Not part of the HAI '26 paper.
Frozen protocol: `protocol.json`, sha256 `7cd898b876726f6113fe0adfa18fdf6b09a0ca62aa1407a23c2496b7ad54686e`.

## Why

On the 920 Study 2 shelves, 462 offer an eligible candidate, and on 452 of those the task leaves a tie:
two or more eligible candidates share the highest taskUtility. Every published order-driven swap
(88/920 DeepSeek, 68/920 MiMo) was a tie broken by the shelf order; every pick had the highest
taskUtility (924/924 for both). The agent does its task; the task does not decide; the order does.

## What changes

- **T0** the task as recorded (re-run; the DeepSeek endpoint now returns another model).
- **T1** a tie rule in the task: *alphabetically first candidateId among the tied best*.
- **T2** the agent may report the tie: `equallyGoodIds`, output limit 96 → 320.

Six calls per unit per condition (both orders twice, plus the immediate shelf twice more as a noise floor),
8,316 calls per provider, shuffled with seed 20260925. Decision rules and readings are in `protocol.json`
and were written before any call.

## Commands

```
python3 scripts/run-tie-rule.py --prepare
python3 scripts/run-tie-rule.py --dry-run
python3 scripts/run-tie-rule.py --execute --provider deepseek --workers 12 --limit 5   # smoke test
python3 scripts/run-tie-rule.py --execute --provider deepseek --workers 12
python3 scripts/run-tie-rule.py --execute --provider mimo --workers 6
python3 scripts/evaluate-tie-rule.py
```

## Log

- 2026-09-25 protocol frozen, sha256 `7cd898b876726f6113fe0adfa18fdf6b09a0ca62aa1407a23c2496b7ad54686e`. Prepare: 462 units, 452 ties, both providers. Dry run: 8,316 calls each,
  estimated ~1.25 USD (DeepSeek) and ~8.5 CNY (MiMo); caps 3 USD and 20 CNY.
- 2026-09-25 smoke test, first 5 units, all conditions (90 calls each, kept in the dataset):
  DeepSeek 90/90 valid, 0 retries, 0.0108 USD, returned model `deepseek-flash`, fingerprint `aeb56401…`;
  MiMo 90/90 valid, 0 retries, 0.0783 CNY. Parser check on T2: DeepSeek wrote `equallyGoodIds` in 11/30 replies
  (all 11 parsed), MiMo in 30/30 (all parsed). Projected full cost ≈ 1.0 USD and ≈ 7.2 CNY. Full run started.
- 2026-09-25 full run finished. DeepSeek 8,316/8,316 valid (0 retries, 0 failures), returned `deepseek-flash`;
  MiMo 8,316/8,316 valid (2 transport retries, 0 failures). Cost from cache: 1.006679 USD and 7.23048 CNY.
- 2026-09-27 evaluated with `scripts/evaluate-tie-rule.py` → `results/summary.json`. Frozen readings:
  - T1 rule — DeepSeek: S 63 → 70, ΔS +7 [−16, +30], **no detectable effect** (rule followed on 1,384/1,808 tie picks;
    44/1,848 picks left the tie set). MiMo: S 70 → 43, ΔS −27 [−48, −6], R 0.39 [0.07, 0.61], McNemar p = 0.008,
    **partial** (rule followed on 1,036/1,808).
  - T2 report — DeepSeek: report present in 745/1,808 tie calls, exact set in 745 (precision 1.00, recall 0.42),
    **not usable**; MiMo: exact set in 1,780/1,808 (0.985), precision 0.9998, recall 0.997, **usable**. Neither model
    reported a tie on the 10 non-tie shelves (0/40 each). T2 did not change swaps (as expected).
  - Drift: T0 agreed with Study 2 on 1,070/1,848 DeepSeek calls and 1,661/1,848 MiMo calls.
