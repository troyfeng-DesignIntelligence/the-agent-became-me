# Order notice — protocol

**Post-study design experiment. Run after the HAI 2026 study closed. It contributes no
number to any published result.**

Date written: 2026-09-23, before any provider call · Frozen spec: `protocol.json` ·
Runner: `scripts/run-order-notice.py` · Analysis: `scripts/evaluate-order-notice.py`

## The question

Study 2 found that the platform's shelf order changes which item the agent picks:
**88 of 920** units for DeepSeek and **68 of 920** for MiMo, against **3** and **2** when the
two shelves are byte-identical. The shelf is the interface the agent-user reads. So the
design question a traditional case would ask of a label or a warning applies here too:

> **Can you warn an agent?** If the shelf says where its order came from, or tells the
> agent to disregard it, do the order-driven swaps go away?

## What stays fixed

The 920 shelves are **the Study 2 shelves themselves**, taken byte-for-byte from the private
response cache (`artifacts/online-storefront-instrument-ablation-confirmatory/`). Before use,
`--prepare` checks every one of them against the published rows:

- the candidate order matches the published layout for all 4 arms × 2 modes × 920 units;
- the cached answer matches the published action for every call;
- the two repeats in each arm are byte-identical requests;
- the recomputed swaps come out at 88/920 and 68/920 (served order) and 3/920 and 2/920
  (masked control), as published.

Same system message, same decoding (temperature 0, 96 output tokens, JSON mode, no
reasoning), same two model versions. The system message belongs to the agent and is not
touched: a platform can only write on its own shelf.

## What changes

One field, `aboutOrder`, added to the shelf. Canonical key order puts it first, above the
candidates, the way a label sits above a shelf.

| Condition | `aboutOrder` |
| --- | --- |
| **N0 · none** | *(field absent: the recorded Study 2 request, unchanged)* |
| **N1 · disclose** | The platform set this order using its recommender and this account's history. The order is not based on constraintMatch or taskUtility. |
| **N2 · disclose + instruct** | N1, plus: Choose as you would if the candidates were in random order. |

Both notices are true of the shelf they sit on. N2 adds one thing to N1, so the steps read
as a dose: nothing → information → information and an instruction.

## Calls

Six calls per unit per condition:

| Slot | Shelf |
| --- | --- |
| immediate-a, immediate-b | immediate-arm order |
| held-a, held-b | held-arm order |
| sham-a, sham-b | immediate-arm order again |

`immediate-a/b + sham-a/b` are four calls of one identical shelf: the noise floor, measured
under each condition's own wording.

3 conditions × 920 units × 6 slots = **16,560 calls per provider**, all shuffled together
(seed 20260923) so that time drift falls on every condition equally. N0 is re-run, not
reused: the comparison has to be made at the same time.

## Outcomes

- **S**: order swaps, the paper's recomputed definition. Both arms agree with themselves
  across the repeat, and disagree with each other.
- **F**: the same count with the sham pair in place of the held arm.
- **E = S − F**: order-driven swaps above noise.
- **R = 1 − E(notice) / E(none)**: the share of order-driven swaps a notice removes.

Secondary, reported descriptively: drift against Study 2 (per-call agreement on the
identical N0 requests; N0 swaps against 88 and 68), repeat agreement, abandon share,
constraint-violating picks, decision quality of the pick, the share of picks that are
the first eligible candidate on the shelf, and the published example unit under each
condition.

Exploratory, no new calls: a **reorder check** computed from Study 2's recorded
decisions. Would re-asking the agent with a differently ordered shelf have flagged the
order-driven choices?

## Uncertainty and the decision rule

Cluster bootstrap over tasks, resampled within category with both recommender families
kept together (as in Study 2), 4,000 replicates, percentile 95% intervals; exact McNemar
on per-unit swap indicators. Each provider is read on its own; nothing is pooled.

| Reading | Rule |
| --- | --- |
| **works** | R ≥ 0.5, and the interval of S(notice) − S(none) lies entirely below 0 |
| **partial** | the interval lies below 0, but R < 0.5 |
| **no detectable effect** | the interval contains 0 |
| **backfires** | the interval lies entirely above 0 |

## What each outcome would mean (written before running)

- **Both notices work.** A shelf can protect the person. The notice becomes a field of the
  agent-facing shelf; HELD is still needed for everything order does not cover.
- **Only the instruction works.** Information alone does not move the agent; an
  instruction does. Design principle: write to agents in imperatives, not disclosures.
- **Neither works.** You cannot warn an agent about order. Together with Study A, labels
  fail at both ends of the loop, and admission control (HELD, the reorder check) is what
  remains.
- **A notice backfires.** Reported as found. It changes behaviour in a way the platform did
  not intend, and it is not a fix.

Every outcome is informative. That is why the experiment is worth running, and why the
readings are fixed here and not after.

## What this is not

1. **Not evidence about people.** Nothing here says anything about human users or labels
   for humans.
2. **Not a general claim about agents.** Two model versions, one storefront, two wordings.
3. **Not part of the study.** Separate folder, separate cache (`artifacts/order-notice/`),
   separate protocol hash. No result in `public/results/` changes.

Every artifact derived from this experiment carries the label
**`Post-study experiment · September 2026 · same 920 Study 2 shelves`.**

## Log

Entries added after the protocol was frozen. `protocol.json` is unchanged
(sha256 `df82e8ce97139c05c16cc04bd99676cda476e0bb509858a65a6f6f62a7c8ed56`).

**2026-09-23 · smoke test (5 units × 3 conditions × 6 slots per provider, 90 calls each).**
No transport retries, no invalid outputs, no protocol failures. Two observations, recorded
before the full run:

- **DeepSeek's endpoint now serves a different model.** The request still names
  `deepseek-v4-flash`, but responses report `deepseek-flash`, fingerprint
  `aeb56401ca74e127821c4f9126dcb669`. Study 2 (August 2026) got `deepseek-v4-flash`,
  fingerprint `fp_a18b46594c_prod0820_fp8_kvcache_20260402`. MiMo still reports
  `mimo-v2.5` (it returns no fingerprint).
- **Identical requests, different answers.** On the N0 requests, which are byte-identical to
  Study 2's, the answer matched the recorded Study 2 answer in 19 of 30 calls for DeepSeek
  and 18 of 30 for MiMo. The sample is too small to estimate drift, and the full run reports
  it over all 920 units.

Consequence: the N0 re-run is the comparator for N1 and N2, as planned. The Study 2 numbers
(88 and 68) are no longer a baseline for this run; they become one half of a **drift
measurement**: same shelves, one month apart. The smoke-test calls stay in the dataset
unchanged.

**2026-09-23 · DeepSeek run complete.** 16,560 / 16,560 calls, USD 1.959567, no invalid
outputs, no protocol failures (2,877 transport retries, all recovered). Every response
reported `deepseek-flash`, fingerprint `aeb56401ca74e127821c4f9126dcb669`.

**2026-09-23 · MiMo run interrupted by the provider account balance.** The provider
returned HTTP 402 *Insufficient account balance* after 12,354 of 16,560 calls
(about CNY 10 spent; the protocol's CNY 40 cap was not reached). Every completed call is
cached; none is lost or partial. The run resumes with the same command once the balance is
topped up, and the cache supplies the 12,354 completed calls unchanged. Because all calls
were shuffled across conditions before the run (seed 20260923), the gap in time falls on
the three conditions equally. No MiMo result was looked at before the run was complete.

**2026-09-23 · MiMo run complete after top-up.** The resumed run reused the 12,354 cached
calls and made the remaining 4,206; 16,560 / 16,560 in total, CNY 13.65175 over both
parts, one invalid output recovered by the protocol's retry note, no protocol failures.
Analysis run once, on the complete data, by the frozen rule: all four comparisons read
**no detectable effect**. Results: `results/summary.json`; facts: `portfolio/FACTS.md` §9.
