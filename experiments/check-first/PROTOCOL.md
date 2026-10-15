# Check-first experiment

Post-study design experiment for the portfolio (2026-09-27). Not part of the HAI '26 paper.
Frozen protocol: `protocol.json`, sha256 `2be8e6e6f5e1cce956a65802984567be7739d0e8949f9d79e0e1abe760d1e9c4`.

## Why

With product text, the agent has to judge whether a product fits the request. In the V9 pilot the shelf order
sometimes made it pick a product that did not fit. This experiment asks whether an agent-facing change, *check
every product against the request before choosing*, stops that, and whether a person's own tie rule (*cheapest*)
takes the order out of choices the request leaves open.

## Units

920 product-language shelves: V9 pipeline widened from 16 to 115 frozen tasks per category, both recommender
families. Rebuilt from the Amazon Reviews 2018 files (SHA-256 matches `docs/DATA_AND_REUSE.md`) in a private
Python 3.11 environment (`artifacts/venv`, torch 2.8.0). All 1,376 cached V9 requests reproduce byte for byte
(11 after removing V9's retry note). 900 units change order between arms; 462 offer a product that fits.

## Commands

```
artifacts/venv/bin/python scripts/run-check-first.py --prepare
python3 scripts/run-check-first.py --dry-run
python3 scripts/run-check-first.py --execute --provider deepseek --workers 12 --limit 5   # smoke test
python3 scripts/run-check-first.py --execute --provider deepseek --workers 12
python3 scripts/run-check-first.py --execute --provider mimo --workers 6
python3 scripts/evaluate-check-first.py
```

## Log

- 2026-09-27 data fetched with `scripts/fetch-amazon-cross-category.mjs` (8 files, 145 MB, all SHA-256 match the repo).
  Units rebuilt: 920 / 900 order changed / 462 with a fitting product; V9 byte check 1,376/1,376.
- 2026-09-27 protocol frozen, sha256 `2be8e6e6f5e1cce956a65802984567be7739d0e8949f9d79e0e1abe760d1e9c4`. Dry run: 16,560 calls per provider, ~2.72 USD and ~19.2 CNY; caps 6 USD, 40 CNY.
- 2026-09-27 smoke test, first 5 units, all conditions (90 calls each, kept): DeepSeek 90/90 valid, 0 retries, 0.0118 USD;
  MiMo 90/90 valid, 0 retries, 0.1100 CNY. Projected full cost ≈ 2.17 USD and ≈ 20.2 CNY. Checklist parse check: MiMo wrote
  `fits` on 40/40 L1/L2 calls; DeepSeek on 0/40 — its raw replies contain only the V9 keys (action, candidateId,
  confidence), so this is the model's output, not a parser miss. Full run started (DeepSeek 12 workers, MiMo 10).
- 2026-09-27 DeepSeek full run: 16,560 valid, 0 retries, 0 failures, 1.9195 USD. MiMo stopped at 16,462 on HTTP 402
  (insufficient balance); resumed 2026-10-05 after the author topped up: 98 new calls, 0 failures, 0.0842 CNY. MiMo total 17.8265 CNY.
- 2026-10-05 evaluated (`results/summary.json`). Frozen readings:
  - Baseline, order-caused errors U (one order's pick meets the request, the other's does not): DeepSeek 25/920 (noise 1),
    MiMo 57/920 (noise 2). Swaps S: 106 (noise 6) and 114 (noise 4).
  - L1 check first — DeepSeek wrote a checklist on 2 of 3,680 calls; S +8 [−17, +32], U +8 [−5, +21]: no detectable effect.
    MiMo wrote one on 3,510/3,680; S 114 → 87, ΔS −27 [−50, −3], R 0.31, McNemar p = 0.03: **partial**;
    U 57 → 46, ΔU −11 [−28, +7]: **no detectable effect**. Checklist accuracy 0.92, precision of "fits" 0.87, recall 0.71.
  - L2 check first + cheapest — DeepSeek S +13 [−12, +37], U +1 [−11, +13]; MiMo S −14 [−38, +10], U +5 [−14, +25]:
    no detectable effect on either.
  - Secondary: asking to check first made both models abandon more (DeepSeek 1,741 → 1,976 of 3,680 main calls,
    MiMo 1,815 → 2,064) and lowered task success (0.936 → 0.916; 0.882 → 0.855).
  - Matching pre-written reading: *checkNoEffect* — a checklist does not stop order from steering the pick; errors that
    order causes have to be caught after the fact, not prevented.
