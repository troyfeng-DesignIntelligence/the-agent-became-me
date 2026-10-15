# Shelf and door

A post-study design experiment for the portfolio (2026-10-05), run as one shuffled batch per provider. Not part of
the HAI '26 paper. Frozen protocol: `protocol.json`, sha256 `39ffdbd824d53b3567b4a3cb50f33ce1773aa200b7fc5894a1dd2f89cb5ebc9d`.

The vote-facts batch tested the two halves of the redesign separately: facts on the shelf removed most order-caused
errors; a random-order re-ask kept most wrong picks out of the record but held about half the right ones, which after
the results turned out to be mostly ties. This batch tests them together, 2 x 2:

| | door P0: write every pick | door P1: write only if a random-order re-ask agrees |
|---|---|---|
| shelf L0: as in V9 | today's platform (T) | door only |
| shelf F1: three fit facts | shelf only | **both (D)** |

Before running we wrote down that holding a pick the order decided is the door's job, not a cost. The rule counts as
cost only order-stable right picks that the door holds (H), and asks D against T to cut wrong picks written by 80% and
order-decided picks written by 50%, with H at most 0.2.

Units and payloads: the 920 shelves in `artifacts/vote-facts/units.json` (sha256 `ff5e8487…`), facts and random orders
unchanged; all 9,200 requests that also occur in vote-facts are byte-identical to it. Every call is new.

## Commands

```
python3 scripts/run-shelf-door.py --dry-run
python3 scripts/run-shelf-door.py --execute --provider deepseek --workers 12 --limit 5   # smoke test
python3 scripts/run-shelf-door.py --execute --provider deepseek --workers 12
python3 scripts/run-shelf-door.py --execute --provider mimo --workers 8
python3 scripts/evaluate-shelf-door.py
```

## Log

- 2026-10-05 protocol frozen, sha256 `39ffdbd824d53b3567b4a3cb50f33ce1773aa200b7fc5894a1dd2f89cb5ebc9d`. Dry run: 11,040 calls per provider
  (L0 4,600, F1 6,440); token estimate ~1.67 USD and ~11.8 CNY, about 1.3 USD and 9.7 CNY scaled from vote-facts
  actuals; caps 3 USD, 25 CNY.
- 2026-10-05 smoke test, first 5 units, both conditions (60 calls each, kept): DeepSeek 60/60 valid, 0.0087 USD; MiMo
  60/60 valid, 0.0638 CNY. Projected ≤ 1.60 USD and ≤ 11.7 CNY. Full run started.
- 2026-10-06 DeepSeek finished: 11,040 calls, 1.4143 USD, no stop. MiMo running (~1.4 calls/s).
- 2026-10-06 MiMo finished: 11,040 calls, 10.2052 CNY, no stop, no protocol failures on either provider.
- 2026-10-06 evaluated (`python3 scripts/evaluate-shelf-door.py`, `results/summary.json`).

## Results (frozen rule): costly for both models

| | wrong picks written: today T → both D | order-decided picks written: T → D | stable right picks held by D (H) | reading |
|---|---|---|---|---|
| DeepSeek | 55 → 4, removed 0.93 [0.84, 1.00], diff −51 [−67, −37] ✓ | 142 → 56, removed 0.61 [0.49, 0.71], diff −86 [−112, −61] ✓ | 140/306 = 0.46 [0.40, 0.52] ✗ | **costly** |
| MiMo | 144 → 12, removed 0.92 [0.86, 0.97], diff −132 [−155, −110] ✓ | 155 → 36, removed 0.77 [0.68, 0.85], diff −119 [−146, −93] ✓ | 157/337 = 0.47 [0.41, 0.53] ✗ | **costly** |

The four cells (selections written / wrong / order-decided / right):

| | DeepSeek | MiMo |
|---|---|---|
| today: plain shelf, write all | 487 / 55 / 142 / 432 | 533 / 144 / 155 / 389 |
| door only | 237 / 12 / 36 / 225 | 270 / 65 / 46 / 205 |
| shelf only | 466 / 6 / 134 / 460 | 490 / 30 / 110 / 460 |
| both | 229 / 4 / 56 / 225 | 232 / 12 / 36 / 220 |

- Door noise: re-asking the identical facts shelf holds 12/306 (DeepSeek) and 9/337 (MiMo) stable right picks; the
  random order holds 140 and 157. P2 holds 177 and 219.
- Shelf replication (secondary): order-caused errors U 35 → 1 (DeepSeek), 73 → 8 (MiMo); success 0.935 → 0.991 and
  0.829 → 0.964. The vote-facts B result replicates in a new batch.

## Exploratory (after the results; not part of the frozen rule)

- Every stable right pick the door held was a tie the probe order had missed: in 140 of 140 (DeepSeek) and 155 of 157
  (MiMo) the random order led to another product that met every constraint with the same task utility. The probe
  (the other study arm's order) agreed with the served order; a full shuffle did not.
- Ties are nearly universal on these shelves: on 452 of the 462 with a valid product, two or more valid products share
  the highest task utility (task utility is coarse). So almost no pick here is decided by the task alone, and a door
  that holds order-decided picks holds about half of all right picks.
- Reading: the door does what it was designed to do; the frozen definition of "stable" was too generous (the protocol
  noted that one probe order undercounts). Whether holding tie-breaks is a cost depends on what the record should
  learn: the task outcome (request met) is learnable; which of several equal products the agent took is not the
  person's taste.
