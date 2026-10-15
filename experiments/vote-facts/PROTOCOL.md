# Vote and facts

Two post-study design experiments for the portfolio (2026-10-05), run as one shuffled batch. Not part of the HAI '26 paper.
Frozen protocol: `protocol.json`, sha256 `751710d53f249c2b954827256e63b286c0c35f0f8af96f085c81eebf0028256f`.

After three tests that changed what the agent was told (notice, tie rule, checklist) and did not remove the errors
the order caused, the redesign stops instructing the agent:

- **A · vote (the door).** The platform re-asks in its own random orders and admits the served pick to the person's
  record only if the picks agree. Measured: how many wrong picks it keeps out (catch rate) and how many right ones it
  holds (false-hold rate).
- **B · facts (the shelf).** Each product carries three facts the platform already has — requested type, requested
  attribute, within budget — next to its title and price. No instruction added. Measured: order-driven swaps and errors.

Units: the 920 product-language shelves from the check-first experiment. A fresh baseline is re-run in the same
batch because the DeepSeek endpoint has changed model before.

## Commands

```
artifacts/venv/bin/python scripts/run-vote-facts.py --prepare
python3 scripts/run-vote-facts.py --dry-run
python3 scripts/run-vote-facts.py --execute --provider deepseek --workers 12 --limit 5   # smoke test
python3 scripts/run-vote-facts.py --execute --provider deepseek --workers 12
python3 scripts/run-vote-facts.py --execute --provider mimo --workers 8
python3 scripts/evaluate-vote-facts.py
```

## Log

- 2026-10-05 prepare: 920 units; every product's three facts agree with the frozen constraintMatch; random1 and random2
  differ from the served order and from each other on all 920. Protocol frozen, sha256 `751710d53f249c2b954827256e63b286c0c35f0f8af96f085c81eebf0028256f`. Dry run: 14,720 calls per
  provider, ~2.1 USD and ~14.8 CNY; caps 4 USD, 30 CNY.
- 2026-10-05 smoke test, first 5 units, both conditions (80 calls each, kept): DeepSeek 80/80 valid, 0.0111 USD;
  MiMo 80/80 valid, 0.0817 CNY. Projected ≈ 2.03 USD and ≈ 15.0 CNY. Full run started.
- 2026-10-05 DeepSeek stopped after ~600 calls with HTTP 402 (insufficient balance); process stopped, author topped up,
  resumed from cache. Both runs then paused several times while the machine slept (on battery, lid closed) and resumed
  on wake; no call was lost or repeated (responses are cached by request).
- 2026-10-05 DeepSeek finished: 14,720 calls, 1.7177 USD. Drift check: the 5,520 L0 requests are byte-identical to the
  2026-09-27 check-first L0 requests and return the same system fingerprint, yet 251 (4.5%) got a different label.
  Within this run, repeats of the identical shelf disagree almost never (noise floors 2 and 1). Read each experiment
  against its own same-batch baseline only.
- 2026-10-05 MiMo finished: 14,720 calls, 12.9948 CNY; no protocol failures on either provider. Drift: the 5,520 L0
  requests are byte-identical to 2026-09-27 and the returned model is still `mimo-v2.5`, yet 1,569 (28.4%) got a
  different label and abandons fell from 2,718 to 2,295. The served model behaves differently under the same name.
- 2026-10-05 evaluated (`python3 scripts/evaluate-vote-facts.py`, `results/summary.json`).

## Results (frozen rules)

**B · facts — works on order-caused errors for both models; partial on swaps.**

| | L0 swaps S (noise) | F1 swaps S (noise) | ΔS [95%] | R | L0 errors U (noise) | F1 errors U (noise) | ΔU [95%] | R | success L0 → F1 |
|---|---|---|---|---|---|---|---|---|---|
| DeepSeek | 143 (2) | 98 (4) | −45 [−69, −20] | 0.33 partial | 41 (1) | 2 (0) | −39 [−53, −26] | 0.95 **works** | 0.936 → 0.991 |
| MiMo | 144 (7) | 98 (6) | −46 [−74, −19] | 0.33 partial | 66 (4) | 7 (1) | −59 [−77, −43] | 0.90 **works** | 0.825 → 0.965 |

Exact McNemar on U: 41 vs 2 and 64 vs 5 discordant units, p < 1e-6. Abandons rise slightly (1,741 → 1,811; 1,522 → 1,714).

**A · vote — costly for both models (catch ≥ 0.5, false-hold > 0.2).**

| | wrong / right selections (served order) | P1 catch [95%] | P1 false-hold [95%] | wrong written P0 → P1 → P2 | identical-shelf re-ask: held, catch, false-hold |
|---|---|---|---|---|---|
| DeepSeek | 52 / 434 | 0.75 [0.62, 0.87] | 0.50 [0.45, 0.55] | 52 → 13 → 7 | 27, 0.08, 0.05 |
| MiMo | 147 / 386 | 0.56 [0.48, 0.65] | 0.47 [0.42, 0.52] | 147 → 64 → 41 | 65, 0.18, 0.10 |

P2 (two re-asks): catch 0.87 / 0.72, false-hold 0.63 / 0.64.

## Exploratory (after the results; not part of the frozen rules)

- What the vote holds when the served pick was right: in 202 of 218 (DeepSeek) and 143 of 181 (MiMo) the random order
  led to a different product that also met every constraint and had the same task utility — a tie the order broke.
  The remaining were an invalid product (15; 36) or an abandon (1; 2).
- What remains under facts: of the 98 swaps left per model, 95 (DeepSeek) and 89 (MiMo) are between two products that
  both meet every constraint with equal task utility; the rest involve an abandon (1; 7) or other (2; 2).
- Reading: with facts on the shelf, order no longer decides whether the task is met; it still decides between equally
  good products on about one shelf in ten. Those are what a re-ask holds. Facts and a re-ask together were **not**
  tested in one condition.
- Caveat on B: the three facts are computed from the same title tokens and price that define success, so they are
  exact by construction — an upper bound. Real catalogue attributes are incomplete and sometimes wrong.
