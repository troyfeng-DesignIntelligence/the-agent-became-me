"""Evaluate the vote and facts experiments against their frozen protocol.

    python3 scripts/evaluate-vote-facts.py [--provider deepseek] [--limit 5]

A · vote: what the platform writes to the record under P0 (admit all), P1 (one random re-ask), P2 (two re-asks),
          scored against the frozen V9 constraint evaluation; noise = the same policy re-asking the identical shelf.
B · facts: order swaps S and order-caused errors U, L0 vs F1, as in scripts/evaluate-check-first.py.
Writes experiments/vote-facts/results/summary[...].json.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import pathlib
import random
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


EC = load("eval_check_first", ROOT / "scripts/evaluate-check-first.py")
SIX = ("immediate-a", "immediate-b", "held-a", "held-b", "sham-a", "sham-b")
EN = EC.EN
STUDY = ROOT / "experiments/vote-facts"
PRIVATE = ROOT / "artifacts/vote-facts"
PROVIDERS = ("deepseek", "mimo")
SELECT = lambda label: label not in ("__ABANDON__", "__PROTOCOL_FAILURE__")


def clusters(unit_ids):
    tasks_by_category, units_by_task = defaultdict(list), defaultdict(list)
    for unit in unit_ids:
        category, task, _ = unit.split("/")
        units_by_task[(category, task)].append(unit)
    for key in units_by_task:
        tasks_by_category[key[0]].append(key)
    return tasks_by_category, units_by_task


def ratio_ci(unit_ids, num, den, seed):
    """任务为簇、品类内分层的 bootstrap，给比率 sum(num)/sum(den) 的 95% 区间。"""
    tasks_by_category, units_by_task = clusters(unit_ids)
    n = {t: sum(num[u] for u in us) for t, us in units_by_task.items()}
    d = {t: sum(den[u] for u in us) for t, us in units_by_task.items()}
    rng, values = random.Random(seed), []
    for _ in range(4000):
        sn = sd = 0
        for category in sorted(tasks_by_category):
            ts = tasks_by_category[category]
            for _ in ts:
                t = ts[rng.randrange(len(ts))]
                sn += n[t]
                sd += d[t]
        if sd:
            values.append(sn / sd)
    if not values:
        return None
    return [round(EN.percentile(values, .025), 4), round(EN.percentile(values, .975), 4)]


def vote(table, units, unit_ids, seed):
    policies = {"P1-oneReask": ("random1-a",), "P2-twoReasks": ("random1-a", "random2-a")}
    noise = {"P1-oneReask": ("immediate-b",), "P2-twoReasks": ("immediate-b", "sham-a")}
    out = {}
    wrong = {u: 0 for u in unit_ids}
    right = {u: 0 for u in unit_ids}
    for u in unit_ids:
        served = table[("L0-none", u)]["immediate-a"]
        if SELECT(served):
            ok = units[u]["evaluations"][served]["constraintMatch"]
            wrong[u], right[u] = int(not ok), int(ok)
    totals = {"selections": sum(wrong.values()) + sum(right.values()),
              "wrongSelections": sum(wrong.values()), "rightSelections": sum(right.values())}
    out["P0-admitAll"] = {**totals, "wrongWritten": totals["wrongSelections"], "heldShare": 0.0}
    for name, slots in policies.items():
        entry = {}
        for label, use in (("randomOrders", slots), ("identicalShelfNoise", noise[name])):
            held = {u: int(SELECT(table[("L0-none", u)]["immediate-a"]) and any(
                table[("L0-none", u)][s] != table[("L0-none", u)]["immediate-a"] for s in use)) for u in unit_ids}
            caught = {u: held[u] * wrong[u] for u in unit_ids}
            false_held = {u: held[u] * right[u] for u in unit_ids}
            c, fh = sum(caught.values()), sum(false_held.values())
            entry[label] = {
                "held": sum(held.values()), "caught": c, "falseHeld": fh,
                "catchRate": round(c / max(1, totals["wrongSelections"]), 4),
                "catchRate_ci": ratio_ci(unit_ids, caught, wrong, seed),
                "falseHoldRate": round(fh / max(1, totals["rightSelections"]), 4),
                "falseHoldRate_ci": ratio_ci(unit_ids, false_held, right, seed + 1),
                "wrongWritten": totals["wrongSelections"] - c,
                "recordPrecision": round((totals["rightSelections"] - fh) /
                                         max(1, totals["selections"] - sum(held.values())), 4)}
        r = entry["randomOrders"]
        entry["reading"] = ("usable" if r["catchRate"] >= .5 and r["falseHoldRate"] <= .2
                            else "costly" if r["catchRate"] >= .5 else "weak")
        out[name] = entry
    # 描述：顺序造成做错的单元里（服务顺序与另一臂顺序的一致选择成败不同），服务那一次选错的被拦下多少
    caught_u = total_u = 0
    for u in unit_ids:
        labels = table[("L0-none", u)]
        if EC.error_flip(labels, units[u]["evaluations"]) and wrong[u]:
            total_u += 1
            caught_u += labels["random1-a"] != labels["immediate-a"]
    out["orderCausedWrongServedPicks"] = {"units": total_u, "heldByOneReask": caught_u}
    return out


def evaluate(provider: str, protocol: dict, limit) -> dict:
    suffix = f"-limit{limit}" if limit else ""
    record = json.loads((STUDY / "results" / f"calls-{provider}{suffix}.json").read_text(encoding="utf-8"))
    units = {u["unit"]: u for u in json.loads((PRIVATE / "units.json").read_text(encoding="utf-8"))["units"]}
    table = defaultdict(dict)
    for call in record["calls"]:
        table[(call["condition"], call["unit"])][call["slot"]] = call["label"]
    unit_ids = sorted({u for (_, u) in table})
    for c in protocol["conditions"]:
        for u in unit_ids:
            if set(table[(c["id"], u)]) != set(c["slots"]):
                raise SystemExit(f"{provider} {c['id']} {u}: incomplete slots")
    seed = protocol["analysis"]["seed"]

    # B · facts
    conditions = ["L0-none", "F1-facts"]
    per_unit = {}
    for c in conditions:
        for u in unit_ids:
            labels, ev = table[(c, u)], units[u]["evaluations"]
            per_unit[(c, u)] = {"S": int(EN.swap(labels, "immediate", "held")), "F": int(EN.swap(labels, "immediate", "sham")),
                                "U": int(EC.error_flip(labels, ev)),
                                "UF": int(labels["immediate-a"] == labels["immediate-b"] and labels["sham-a"] == labels["sham-b"]
                                          and EC.success(labels["immediate-a"], ev) != EC.success(labels["sham-a"], ev))}
    observed, ci = EC.bootstrap(conditions, unit_ids, per_unit, ("S", "F", "U", "UF"), seed)
    facts = {}
    for c in conditions:
        e = {k: observed[(c, k)] for k in ("S", "F", "U", "UF")}
        e.update({f"{k}_ci": ci((c, k)) for k in ("S", "F", "U", "UF")})
        if c != conditions[0]:
            for k in ("S", "U"):
                base, noise_k = observed[(conditions[0], k)], "F" if k == "S" else "UF"
                excess = base - observed[(conditions[0], noise_k)]
                removed = None if excess <= 0 else round(1 - (e[k] - observed[(c, noise_k)]) / excess, 4)
                d_ci = ci((c, "d" + k))
                b = sum(per_unit[(conditions[0], u)][k] and not per_unit[(c, u)][k] for u in unit_ids)
                d = sum(per_unit[(c, u)][k] and not per_unit[(conditions[0], u)][k] for u in unit_ids)
                e.update({f"delta{k}": e[k] - base, f"delta{k}_ci": d_ci, f"removed{k}": removed,
                          f"mcnemar{k}": {"onlyWithout": b, "onlyWith": d, "pExact": round(EN.mcnemar_exact(b, d), 6)},
                          f"reading{k}": EN.reading(tuple(d_ci), removed)})
        succ = [EC.success(table[(c, u)][s], units[u]["evaluations"]) for u in unit_ids for s in EC.MAIN]
        reg = [EC.regret(table[(c, u)][s], units[u]["evaluations"]) for u in unit_ids for s in EC.MAIN]
        e.update({"successRate": round(sum(succ) / len(succ), 4), "meanRegret": round(sum(reg) / len(reg), 4),
                  "abandons": sum(table[(c, u)][s] == "__ABANDON__" for u in unit_ids for s in EC.MAIN),
                  "protocolFailures": sum(table[(c, u)][s] == "__PROTOCOL_FAILURE__" for u in unit_ids for s in EC.MAIN)})
        facts[c] = e

    # 漂移：今天的 L0 和 9 月 27 日 check-first 的 L0，在逐字节相同的请求上
    drift = None
    cf_path = ROOT / "experiments/check-first/results" / f"calls-{provider}{suffix}.json"
    if cf_path.exists():
        old = {(c["unit"], c["slot"]): c["label"] for c in json.loads(cf_path.read_text())["calls"] if c["condition"] == "L0-none"}
        pairs = [(table[("L0-none", u)][s], old[(u, s)]) for u in unit_ids for s in SIX if (u, s) in old]
        drift = {"perCallAgreement": [sum(a == b for a, b in pairs), len(pairs)]}

    return {"units": len(unit_ids), "vote": vote(table, units, unit_ids, seed), "facts": facts,
            "driftAgainstCheckFirstL0": drift, "api": record["api"], "protocolSha256": record["protocolSha256"]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", choices=PROVIDERS)
    args = parser.parse_args()
    text = (STUDY / "protocol.json").read_text(encoding="utf-8")
    protocol = json.loads(text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    summary = {"schemaVersion": "vote-facts-summary.v1", "protocolSha256": sha,
               "label": "Post-study experiments · October 2026 · 920 product-language shelves",
               "claimBoundary": protocol["claimBoundary"], "providers": {}}
    for provider in ((args.provider,) if args.provider else PROVIDERS):
        result = evaluate(provider, protocol, args.limit)
        if result["protocolSha256"] != sha:
            raise SystemExit(f"{provider}: calls were made under a different protocol hash")
        summary["providers"][provider] = result
    suffix = (f"-limit{args.limit}" if args.limit else "") + (f"-{args.provider}" if args.provider else "")
    path = STUDY / "results" / f"summary{suffix}.json"
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for provider, r in summary["providers"].items():
        v, f = r["vote"], r["facts"]
        print(f"== {provider}  units {r['units']}  drift {r['driftAgainstCheckFirstL0']}")
        print(f"  A · selections {v['P0-admitAll']['selections']}  wrong {v['P0-admitAll']['wrongSelections']}"
              f"  right {v['P0-admitAll']['rightSelections']}")
        for name in ("P1-oneReask", "P2-twoReasks"):
            a, n = v[name]["randomOrders"], v[name]["identicalShelfNoise"]
            print(f"    {name:13s} catch {a['catchRate']} {a['catchRate_ci']}  false-hold {a['falseHoldRate']} "
                  f"{a['falseHoldRate_ci']}  wrong written {a['wrongWritten']}  precision {a['recordPrecision']}"
                  f"  → {v[name]['reading']}   (noise: held {n['held']}, catch {n['catchRate']}, false-hold {n['falseHoldRate']})")
        print(f"    order-caused wrong served picks {v['orderCausedWrongServedPicks']}")
        for c, e in f.items():
            line = f"  B · {c:9s} S {e['S']:3d} (noise {e['F']})  U {e['U']:3d} (noise {e['UF']})  success {e['successRate']}  abandons {e['abandons']}"
            if "deltaS" in e:
                line += (f"\n      ΔS {e['deltaS']:+d} {e['deltaS_ci']} R {e['removedS']} → {e['readingS']}   "
                         f"ΔU {e['deltaU']:+d} {e['deltaU_ci']} R {e['removedU']} → {e['readingU']}")
            print(line)
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
