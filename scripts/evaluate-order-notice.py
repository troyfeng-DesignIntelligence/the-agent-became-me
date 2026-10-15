"""Evaluate the order-notice experiment against its frozen protocol.

    python3 scripts/evaluate-order-notice.py            # full run
    python3 scripts/evaluate-order-notice.py --limit 5  # smoke-test files

Reads experiments/order-notice/results/calls-<provider>.json (labels only) and the
private unit file (shelves, Study 2 labels). Writes experiments/order-notice/results/summary.json,
which holds aggregates and pseudonymous IDs only, like the published Study 2 rows.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import random
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = ROOT / "experiments/order-notice"
PRIVATE = ROOT / "artifacts/order-notice"
PROVIDERS = ("deepseek", "mimo")
EXAMPLE = "industrial-and-scientific/03d99ea294e5d4d9/gru4rec"
MAIN = ("immediate-a", "immediate-b", "held-a", "held-b")


def swap(labels: dict, left: str, right: str) -> bool:
    return (labels[f"{left}-a"] == labels[f"{left}-b"]
            and labels[f"{right}-a"] == labels[f"{right}-b"]
            and labels[f"{left}-a"] != labels[f"{right}-a"])


def reciprocal(rank):
    return 0.0 if rank is None else 1.0 / rank


def quality(shelf: list, label: str):
    """Study 2 candidate_quality / action_quality, unchanged."""
    if label == "__PROTOCOL_FAILURE__":
        return None
    if label == "__ABANDON__":
        return 0.0 if any(row["constraintMatch"] for row in shelf) else 1.0
    row = next(row for row in shelf if row["candidateId"] == label)
    if not row["constraintMatch"]:
        return 0.0
    return round(0.40 * float(row["taskUtility"]) + 0.25 * reciprocal(row["taskLocalRank"])
                 + 0.20 * reciprocal(row["searchRank"]) + 0.15 * float(row["novelty"]), 6)


def shelf_of(provider: str, request: dict) -> list:
    text = request["input"] if provider == "mimo" else request["messages"][1]["content"]
    return json.loads(text)["candidates"]


def mcnemar_exact(b: int, c: int) -> float:
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def percentile(values: list, q: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    lower, upper = math.floor(position), math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def reading(delta_ci: tuple, removed: float) -> str:
    low, high = delta_ci
    if high < 0:
        return "works" if removed is not None and removed >= 0.5 else "partial"
    if low > 0:
        return "backfires"
    return "no detectable effect"


PRICING = {"deepseek": ("USD", 0.14, 0.28), "mimo": ("CNY", 1.00, 2.00)}


def cache_totals(provider: str) -> dict:
    """整个实验（含冒烟测试、含中断前后两段）的真实用量：从每条缓存的响应里加总。
    每次运行的 api 统计只算那一次进程里新发出的调用。"""
    tin = tout = n = retry = 0
    models, prints = set(), set()
    for path in (PRIVATE / provider / "responses").glob("*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        usage = (r.get("response") or {}).get("usage") or {}
        tin += int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        tout += int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        n += 1
        retry += bool(r.get("retryPrompt"))
        if isinstance(r["response"].get("model"), str):
            models.add(r["response"]["model"])
        if isinstance(r["response"].get("system_fingerprint"), str):
            prints.add(r["response"]["system_fingerprint"])
    cur, pin, pout = PRICING[provider]
    return {"calls": n, "retryPromptCalls": retry, "inputTokens": tin, "outputTokens": tout,
            "cost": round(tin / 1e6 * pin + tout / 1e6 * pout, 6), "currency": cur,
            "returnedModels": sorted(models), "fingerprints": sorted(prints),
            "note": "successful calls only; failed transport attempts are not in the cache"}


def evaluate(provider: str, protocol: dict, limit) -> dict:
    suffix = f"-limit{limit}" if limit else ""
    record = json.loads((STUDY / "results" / f"calls-{provider}{suffix}.json").read_text(encoding="utf-8"))
    units = {u["unit"]: u for u in json.loads(
        (PRIVATE / f"units-{provider}.json").read_text(encoding="utf-8"))["units"]}
    conditions = [c["id"] for c in protocol["conditions"]]
    table = defaultdict(dict)
    for call in record["calls"]:
        table[(call["condition"], call["unit"])][call["slot"]] = call["label"]
    unit_ids = sorted({unit for (_, unit) in table})
    for condition in conditions:
        for unit in unit_ids:
            if len(table[(condition, unit)]) != 6:
                raise SystemExit(f"{provider} {condition} {unit}: incomplete slots")

    # 每个单元的指标
    per_unit = {}
    for condition in conditions:
        for unit in unit_ids:
            labels = table[(condition, unit)]
            per_unit[(condition, unit)] = {
                "S": swap(labels, "immediate", "held"),
                "F": swap(labels, "immediate", "sham"),
            }

    # 聚类 bootstrap：任务为簇，按品类分层，两个推荐器家族一起走
    tasks_by_category = defaultdict(list)
    units_by_task = defaultdict(list)
    for unit in unit_ids:
        category, task, _ = unit.split("/")
        units_by_task[(category, task)].append(unit)
    for key in units_by_task:
        tasks_by_category[key[0]].append(key)
    task_counts = {}
    for key, members in units_by_task.items():
        for condition in conditions:
            task_counts[(condition, key)] = (
                sum(per_unit[(condition, u)]["S"] for u in members),
                sum(per_unit[(condition, u)]["F"] for u in members))

    def totals(sample):
        out = {}
        for condition in conditions:
            s = sum(task_counts[(condition, key)][0] for key in sample)
            f = sum(task_counts[(condition, key)][1] for key in sample)
            out[condition] = (s, f)
        return out

    observed = totals([key for keys in tasks_by_category.values() for key in keys])
    rng = random.Random(protocol["analysis"].get("seed", 20260923))
    replicates = 4000
    boot = defaultdict(list)
    for _ in range(replicates):
        sample = []
        for category in sorted(tasks_by_category):
            keys = tasks_by_category[category]
            sample.extend(keys[rng.randrange(len(keys))] for _ in keys)
        t = totals(sample)
        base_e = t[conditions[0]][0] - t[conditions[0]][1]
        for condition in conditions:
            s, f = t[condition]
            boot[(condition, "S")].append(s)
            boot[(condition, "F")].append(f)
            boot[(condition, "E")].append(s - f)
            if condition != conditions[0]:
                boot[(condition, "dS")].append(s - t[conditions[0]][0])
                boot[(condition, "dE")].append((s - f) - base_e)
                if base_e > 0:
                    boot[(condition, "R")].append(1 - (s - f) / base_e)

    def ci(key):
        values = boot[key]
        if not values:
            return None
        return [round(percentile(values, 0.025), 4), round(percentile(values, 0.975), 4)]

    # 每个单元在 Study 2 served-order rows 里的文件顺序下标，页面上的点阵和第 1 张逐点对齐
    file_order = {u: i for i, u in enumerate(units)}

    n = len(unit_ids)
    base_s, base_f = observed[conditions[0]]
    base_e = base_s - base_f
    out = {"units": n, "conditions": {}}
    for condition in conditions:
        s, f = observed[condition]
        entry = {"S": s, "F": f, "E": s - f, "S_ci": ci((condition, "S")),
                 "F_ci": ci((condition, "F")), "E_ci": ci((condition, "E")),
                 "swapFileIndices": sorted(file_order[u] for u in unit_ids
                                           if per_unit[(condition, u)]["S"]),
                 "shamFileIndices": sorted(file_order[u] for u in unit_ids
                                           if per_unit[(condition, u)]["F"])}
        if condition != conditions[0]:
            removed = None if base_e <= 0 else round(1 - (s - f) / base_e, 4)
            b = sum(per_unit[(conditions[0], u)]["S"] and not per_unit[(condition, u)]["S"] for u in unit_ids)
            c = sum(per_unit[(condition, u)]["S"] and not per_unit[(conditions[0], u)]["S"] for u in unit_ids)
            delta_ci = ci((condition, "dS"))
            entry.update({"deltaS": s - base_s, "deltaS_ci": delta_ci,
                          "deltaE": (s - f) - base_e, "deltaE_ci": ci((condition, "dE")),
                          "R": removed, "R_ci": ci((condition, "R")),
                          "mcnemar": {"swapOnlyWithoutNotice": b, "swapOnlyWithNotice": c,
                                      "pExact": round(mcnemar_exact(b, c), 6)},
                          "reading": reading(tuple(delta_ci), removed)})
        out["conditions"][condition] = entry

    # 次要指标
    for condition in conditions:
        repeat_same = repeat_total = abandons = violations = picks = 0
        first_eligible = positions = 0
        qualities = []
        swap_first = swap_arms = 0
        for unit in unit_ids:
            labels = table[(condition, unit)]
            u = units[unit]
            shelves = {"immediate": shelf_of(provider, u["served"]["immediate"]),
                       "held": shelf_of(provider, u["served"]["held"])}
            for left, right in (("immediate-a", "immediate-b"), ("held-a", "held-b"), ("sham-a", "sham-b")):
                repeat_total += 1
                repeat_same += labels[left] == labels[right]
            for slot in MAIN:
                side = "held" if slot.startswith("held") else "immediate"
                shelf = shelves[side]
                lab = labels[slot]
                q = quality(shelf, lab)
                if q is not None:
                    qualities.append(q)
                if lab == "__ABANDON__":
                    abandons += 1
                    continue
                if lab == "__PROTOCOL_FAILURE__":
                    continue
                picks += 1
                ids = [row["candidateId"] for row in shelf]
                row = shelf[ids.index(lab)]
                violations += not row["constraintMatch"]
                positions += ids.index(lab) + 1
                eligible = [r["candidateId"] for r in shelf if r["constraintMatch"]]
                first_eligible += bool(eligible) and eligible[0] == lab
            if per_unit[(condition, unit)]["S"]:
                for side, slot in (("immediate", "immediate-a"), ("held", "held-a")):
                    eligible = [r["candidateId"] for r in shelves[side] if r["constraintMatch"]]
                    swap_arms += 1
                    swap_first += bool(eligible) and eligible[0] == labels[slot]
        out["conditions"][condition].update({
            "repeatAgreement": [repeat_same, repeat_total],
            "abandonShare": round(abandons / (4 * n), 4),
            "constraintViolations": violations,
            "meanDecisionQuality": round(sum(qualities) / len(qualities), 4),
            "firstEligibleShareOfPicks": round(first_eligible / max(1, picks), 4),
            "meanPickPosition": round(positions / max(1, picks), 3),
            "swapArmsTakingFirstEligible": [swap_first, swap_arms],
        })

    # 漂移：N0 与 Study 2 在逐字节相同的请求上
    agree = total = 0
    transitions = {"swap->swap": 0, "swap->none": 0, "none->swap": 0, "none->none": 0}
    for unit in unit_ids:
        study2 = units[unit]["study2"]["served-order"]
        labels = table[(conditions[0], unit)]
        for slot in MAIN:
            total += 1
            agree += labels[slot] == study2[slot]
        before = swap(study2, "immediate", "held")
        after = per_unit[(conditions[0], unit)]["S"]
        transitions[f"{'swap' if before else 'none'}->{'swap' if after else 'none'}"] += 1
    study2_swaps = sum(swap(units[u]["study2"]["served-order"], "immediate", "held") for u in unit_ids)
    out["driftAgainstStudy2"] = {
        "perCallAgreement": [agree, total],
        "study2Swaps": study2_swaps,
        "rerunSwaps": base_s,
        "unitTransitions": transitions,
        "mcnemarPExact": round(mcnemar_exact(transitions["swap->none"], transitions["none->swap"]), 6),
    }

    # 示例单元
    if EXAMPLE in units and all((c, EXAMPLE) in table for c in conditions):
        out["exampleUnit"] = {"unit": EXAMPLE,
                              "study2": units[EXAMPLE]["study2"]["served-order"],
                              **{c: table[(c, EXAMPLE)] for c in conditions}}

    # 探索性：重排复核，只用 Study 2 已记录的决定（served 与 masked 同一批候选，只差顺序）
    held_imm = held_held = swap_units = 0
    flags = decided = noise_flags = noise_total = 0
    for unit in unit_ids:
        s2 = units[unit]["study2"]
        served, masked = s2["served-order"], s2["masked-control"]
        decided += 1
        flags += served["immediate-a"] != masked["immediate-a"]
        for left, right in (("immediate-a", "immediate-b"), ("immediate-a", "held-a"), ("immediate-a", "held-b")):
            noise_total += 1
            noise_flags += masked[left] != masked[right]
        if swap(served, "immediate", "held"):
            swap_units += 1
            held_imm += served["immediate-a"] != masked["immediate-a"]
            held_held += served["held-a"] != masked["immediate-a"]
    out["reorderCheckFromStudy2"] = {
        "note": "Exploratory, offline, Study 2 decisions only. Check = re-ask with the masked-control shelf "
                "(same candidates, neutral order); hold the choice if the pick differs.",
        "immediateArmChoicesHeld": [flags, decided],
        "orderSwapUnits": swap_units,
        "inSwapUnitsImmediatePickHeld": held_imm,
        "inSwapUnitsHeldPickHeld": held_held,
        "noiseFlagsOnIdenticalShelves": [noise_flags, noise_total],
    }
    out["api"] = record["api"]
    out["apiTotalsFromCache"] = cache_totals(provider)
    out["protocolSha256"] = record["protocolSha256"]
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", choices=PROVIDERS,
                        help="只看一个提供方（另一个还在跑时），写到 summary-<provider>.json")
    args = parser.parse_args()
    text = (STUDY / "protocol.json").read_text(encoding="utf-8")
    protocol = json.loads(text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    summary = {"schemaVersion": "order-notice-summary.v1", "protocolSha256": sha,
               "label": "Post-study experiment · September 2026 · same 920 Study 2 shelves",
               "claimBoundary": protocol["claimBoundary"], "providers": {}}
    for provider in ((args.provider,) if args.provider else PROVIDERS):
        result = evaluate(provider, protocol, args.limit)
        if result["protocolSha256"] != sha:
            raise SystemExit(f"{provider}: calls were made under a different protocol hash")
        summary["providers"][provider] = result
    suffix = (f"-limit{args.limit}" if args.limit else "") + (f"-{args.provider}" if args.provider else "")
    path = STUDY / "results" / f"summary{suffix}.json"
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for provider, result in summary["providers"].items():
        print(f"== {provider}  units {result['units']}")
        for condition, entry in result["conditions"].items():
            extra = ""
            if "R" in entry:
                extra = (f"  ΔS {entry['deltaS']:+d} {entry['deltaS_ci']}  R {entry['R']} {entry['R_ci']}"
                         f"  McNemar p={entry['mcnemar']['pExact']}  → {entry['reading']}")
            print(f"  {condition:12s} S {entry['S']:4d}  F {entry['F']:3d}  E {entry['E']:4d}{extra}")
            print(f"  {'':12s} repeat {entry['repeatAgreement']}  abandon {entry['abandonShare']}"
                  f"  violations {entry['constraintViolations']}  quality {entry['meanDecisionQuality']}"
                  f"  first-eligible {entry['firstEligibleShareOfPicks']}  pos {entry['meanPickPosition']}"
                  f"  swap-arms-first {entry['swapArmsTakingFirstEligible']}")
        print(f"  drift {result['driftAgainstStudy2']}")
        print(f"  reorder {result['reorderCheckFromStudy2']}")
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
