"""Evaluate the shelf-and-door experiment against its frozen protocol.

    python3 scripts/evaluate-shelf-door.py [--provider deepseek] [--limit 5]

Every served pick (immediate-a) is classified once per shelf condition — wrong, order-decided (the other arm's order
consistently leads elsewhere), stable right, unclear — and each door policy decides whether it is written to the
record. Primary: today's platform T = (L0, P0) against the combined design D = (F1, P1).
Writes experiments/shelf-door/results/summary[...].json.
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
EN = EC.EN
STUDY = ROOT / "experiments/shelf-door"
UNITS = ROOT / "artifacts/vote-facts/units.json"
PROVIDERS = ("deepseek", "mimo")
KINDS = ("selection", "wrong", "right", "orderDecided", "orderDecidedRight", "stableRight", "unclear")
# (货架, 门) 组合；"noise" 是用同一货架再问一次代替随机顺序
CELLS = (("L0-none", "P0"), ("L0-none", "P1"), ("F1-facts", "P0"), ("F1-facts", "P1"), ("F1-facts", "P2"),
         ("F1-facts", "noise"))


def classify(labels: dict, ev: dict) -> dict:
    s = labels["immediate-a"]
    sel = not s.startswith("__")
    right = sel and ev[s]["constraintMatch"]
    probe = labels["held-a"] == labels["held-b"]
    return {"selection": sel, "wrong": sel and not right, "right": right,
            "orderDecided": sel and probe and labels["held-a"] != s,
            "orderDecidedRight": right and probe and labels["held-a"] != s,      # 描述用，不进判定
            "stableRight": right and probe and labels["held-a"] == s,
            "unclear": sel and not probe}


def written(labels: dict, policy: str) -> bool:
    s = labels["immediate-a"]
    if s.startswith("__"):
        return False
    if policy == "P0":
        return True
    if policy == "P1":
        return labels["random1-a"] == s
    if policy == "P2":
        return labels["random1-a"] == s and labels["random2-a"] == s
    if policy == "noise":
        return labels["sham-a"] == s
    raise ValueError(policy)


def bootstrap(unit_ids, per_unit, seed, reps=4000):
    """任务为簇、品类内分层；返回观测总数和每个指标的重抽样总数序列。"""
    keys = sorted(next(iter(per_unit.values())))
    by_task, by_cat = defaultdict(list), defaultdict(list)
    for u in unit_ids:
        cat, task, _ = u.split("/")
        by_task[(cat, task)].append(u)
    for t in by_task:
        by_cat[t[0]].append(t)
    task_vec = {t: [sum(per_unit[u][k] for u in us) for k in keys] for t, us in by_task.items()}
    observed = dict(zip(keys, [sum(v[i] for v in task_vec.values()) for i in range(len(keys))]))
    rng, reps_out = random.Random(seed), []
    cats = sorted(by_cat)
    for _ in range(reps):
        tot = [0] * len(keys)
        for c in cats:
            ts = by_cat[c]
            for _ in ts:
                v = task_vec[ts[rng.randrange(len(ts))]]
                for i, x in enumerate(v):
                    tot[i] += x
        reps_out.append(dict(zip(keys, tot)))
    return observed, reps_out


def ci(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return [round(EN.percentile(values, .025), 4), round(EN.percentile(values, .975), 4)]


def evaluate(provider: str, protocol: dict, limit) -> dict:
    suffix = f"-limit{limit}" if limit else ""
    record = json.loads((STUDY / "results" / f"calls-{provider}{suffix}.json").read_text(encoding="utf-8"))
    units = {u["unit"]: u for u in json.loads(UNITS.read_text(encoding="utf-8"))["units"]}
    table = defaultdict(dict)
    for call in record["calls"]:
        table[(call["condition"], call["unit"])][call["slot"]] = call["label"]
    unit_ids = sorted({u for (_, u) in table})
    for c in protocol["conditions"]:
        for u in unit_ids:
            if set(table[(c["id"], u)]) != set(c["slots"]):
                raise SystemExit(f"{provider} {c['id']} {u}: incomplete slots")

    per_unit = {}
    for u in unit_ids:
        ev, row = units[u]["evaluations"], {}
        for cond in ("L0-none", "F1-facts"):
            labels = table[(cond, u)]
            k = classify(labels, ev)
            for kind in KINDS:
                row[f"{cond}|{kind}"] = int(k[kind])
            for c2, policy in CELLS:
                if c2 != cond:
                    continue
                w = written(labels, policy)
                for kind in KINDS:
                    row[f"{cond}|{policy}|{kind}"] = int(w and k[kind])
            row[f"{cond}|S"] = int(EN.swap(labels, "immediate", "held"))
            row[f"{cond}|U"] = int(EC.error_flip(labels, ev))
        per_unit[u] = row
    seed = protocol["analysis"]["seed"]
    obs, reps = bootstrap(unit_ids, per_unit, seed)

    cells = {}
    for cond, policy in CELLS:
        cells[f"{cond}|{policy}"] = {f"{kind}Written": obs[f"{cond}|{policy}|{kind}"] for kind in KINDS}
    classes = {cond: {kind: obs[f"{cond}|{kind}"] for kind in KINDS} for cond in ("L0-none", "F1-facts")}

    T, D = "L0-none|P0", "F1-facts|P1"
    primary = {}
    for name, kind, need in (("W", "wrong", .8), ("O", "orderDecided", .5)):
        t, d = obs[f"{T}|{kind}"], obs[f"{D}|{kind}"]
        diff_ci = ci([r[f"{D}|{kind}"] - r[f"{T}|{kind}"] for r in reps])
        removed = None if t == 0 else round(1 - d / t, 4)
        removed_ci = ci([None if r[f"{T}|{kind}"] == 0 else 1 - r[f"{D}|{kind}"] / r[f"{T}|{kind}"] for r in reps])
        primary[name] = {"T": t, "D": d, "diff": d - t, "diff_ci": diff_ci, "removed": removed, "removed_ci": removed_ci,
                         "met": bool(removed is not None and removed >= need and diff_ci and diff_ci[1] < 0)}
    stable = obs["F1-facts|stableRight"]
    held = stable - obs["F1-facts|P1|stableRight"]
    h_reps = [None if r["F1-facts|stableRight"] == 0 else
              (r["F1-facts|stableRight"] - r["F1-facts|P1|stableRight"]) / r["F1-facts|stableRight"] for r in reps]
    primary["H"] = {"stableRight": stable, "held": held, "rate": round(held / stable, 4) if stable else None,
                    "rate_ci": ci(h_reps), "met": bool(stable and held / stable <= .2)}
    w, o, h = primary["W"]["met"], primary["O"]["met"], primary["H"]["met"]
    primary["reading"] = ("works" if w and o and h else "costly" if w and o else "partial" if w else "doesNotWork")

    # 门的另外几个视角：同一货架再问（噪声）会拦多少稳定的对选；随机再问拦下的顺序决定的选择占多少
    noise_held = stable - obs["F1-facts|noise|stableRight"]
    door = {
        "F1": {"orderDecided": obs["F1-facts|orderDecided"],
               "orderDecidedHeldP1": obs["F1-facts|orderDecided"] - obs["F1-facts|P1|orderDecided"],
               "stableRightHeldByNoiseReask": noise_held,
               "stableRightHeldP2": stable - obs["F1-facts|P2|stableRight"]},
        "L0": {"orderDecided": obs["L0-none|orderDecided"],
               "orderDecidedHeldP1": obs["L0-none|orderDecided"] - obs["L0-none|P1|orderDecided"],
               "stableRight": obs["L0-none|stableRight"],
               "stableRightHeldP1": obs["L0-none|stableRight"] - obs["L0-none|P1|stableRight"]},
    }
    shelf = {}
    for k in ("S", "U"):
        shelf[k] = {"L0": obs[f"L0-none|{k}"], "F1": obs[f"F1-facts|{k}"],
                    "diff_ci": ci([r[f"F1-facts|{k}"] - r[f"L0-none|{k}"] for r in reps])}
    success = {}
    for cond in ("L0-none", "F1-facts"):
        s = [EC.success(table[(cond, u)][slot], units[u]["evaluations"]) for u in unit_ids for slot in EC.MAIN]
        success[cond] = round(sum(s) / len(s), 4)
    return {"units": len(unit_ids), "classes": classes, "cells": cells, "primary": primary, "door": door,
            "shelfReplication": shelf, "successRate": success, "api": record["api"],
            "protocolSha256": record["protocolSha256"]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", choices=PROVIDERS)
    args = parser.parse_args()
    text = (STUDY / "protocol.json").read_text(encoding="utf-8")
    protocol = json.loads(text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    summary = {"schemaVersion": "shelf-door-summary.v1", "protocolSha256": sha,
               "label": "Post-study experiment · October 2026 · 920 product-language shelves",
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
        p = r["primary"]
        print(f"== {provider}  units {r['units']}  success L0 {r['successRate']['L0-none']} F1 {r['successRate']['F1-facts']}")
        print(f"  classes  L0 {r['classes']['L0-none']}\n           F1 {r['classes']['F1-facts']}")
        for cell, e in r["cells"].items():
            print(f"  {cell:16s} written {e['selectionWritten']:4d}  wrong {e['wrongWritten']:3d}  order-decided "
                  f"{e['orderDecidedWritten']:3d}  right {e['rightWritten']:4d}  stable right {e['stableRightWritten']:4d}")
        for k in ("W", "O"):
            e = p[k]
            print(f"  {k}: today {e['T']} → both {e['D']}  diff {e['diff']:+d} {e['diff_ci']}  removed {e['removed']} "
                  f"{e['removed_ci']}  met {e['met']}")
        print(f"  H: stable right held {p['H']['held']}/{p['H']['stableRight']} = {p['H']['rate']} {p['H']['rate_ci']}  met {p['H']['met']}")
        print(f"  → {p['reading']}")
        print(f"  door {r['door']}")
        print(f"  shelf {r['shelfReplication']}")
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
