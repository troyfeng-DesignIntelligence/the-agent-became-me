"""Evaluate the check-first experiment against its frozen protocol.

    python3 scripts/evaluate-check-first.py [--provider deepseek] [--limit 5]

Reads experiments/check-first/results/calls-<provider>.json and the private unit file (shelves, evaluations).
Task success follows the V9 outcome rule unchanged: a selection succeeds iff the product satisfies every
constraint; an abandon succeeds iff no offered product does. Writes experiments/check-first/results/summary[...].json.
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
spec = importlib.util.spec_from_file_location("eval_notice", ROOT / "scripts/evaluate-order-notice.py")
EN = importlib.util.module_from_spec(spec)
spec.loader.exec_module(EN)

STUDY = ROOT / "experiments/check-first"
PRIVATE = ROOT / "artifacts/check-first"
PROVIDERS = ("deepseek", "mimo")
MAIN = ("immediate-a", "immediate-b", "held-a", "held-b")


def success(label: str, evaluations: dict):
    feasible = [a for a, e in evaluations.items() if e["constraintMatch"]]
    if label == "__PROTOCOL_FAILURE__":
        return 0.0
    if label == "__ABANDON__":
        return float(not feasible)
    return float(evaluations[label]["constraintMatch"])


def regret(label: str, evaluations: dict):
    feasible = [e["utility"] for e in evaluations.values() if e["constraintMatch"]]
    best = max(feasible) if feasible else 0.0
    if label in ("__PROTOCOL_FAILURE__",):
        return 1.0
    if label == "__ABANDON__":
        return best if feasible else 0.0
    e = evaluations[label]
    return max(0.0, best - (e["utility"] if e["constraintMatch"] else 0.0))


def error_flip(labels: dict, evaluations: dict) -> bool:
    """顺序造成的做错：两个顺序各自两次一致，而且一个成功、一个失败。"""
    return (labels["immediate-a"] == labels["immediate-b"] and labels["held-a"] == labels["held-b"]
            and success(labels["immediate-a"], evaluations) != success(labels["held-a"], evaluations))


def bootstrap(conditions, unit_ids, per_unit, keys, seed):
    tasks_by_category, units_by_task = defaultdict(list), defaultdict(list)
    for unit in unit_ids:
        category, task, _ = unit.split("/")
        units_by_task[(category, task)].append(unit)
    for key in units_by_task:
        tasks_by_category[key[0]].append(key)
    counts = {(c, t, k): sum(per_unit[(c, u)][k] for u in members)
              for t, members in units_by_task.items() for c in conditions for k in keys}

    def totals(sample):
        return {(c, k): sum(counts[(c, t, k)] for t in sample) for c in conditions for k in keys}

    observed = totals([t for ts in tasks_by_category.values() for t in ts])
    rng, boot = random.Random(seed), defaultdict(list)
    for _ in range(4000):
        sample = []
        for category in sorted(tasks_by_category):
            ts = tasks_by_category[category]
            sample.extend(ts[rng.randrange(len(ts))] for _ in ts)
        t = totals(sample)
        for c in conditions:
            for k in keys:
                boot[(c, k)].append(t[(c, k)])
                if c != conditions[0]:
                    boot[(c, "d" + k)].append(t[(c, k)] - t[(conditions[0], k)])
    ci = lambda key: [round(EN.percentile(boot[key], .025), 4), round(EN.percentile(boot[key], .975), 4)]
    return observed, ci


def evaluate(provider: str, protocol: dict, limit) -> dict:
    suffix = f"-limit{limit}" if limit else ""
    record = json.loads((STUDY / "results" / f"calls-{provider}{suffix}.json").read_text(encoding="utf-8"))
    units = {u["unit"]: u for u in json.loads((PRIVATE / "units.json").read_text(encoding="utf-8"))["units"]}
    conditions = [c["id"] for c in protocol["conditions"]]
    table, fits = defaultdict(dict), defaultdict(dict)
    for call in record["calls"]:
        table[(call["condition"], call["unit"])][call["slot"]] = call["label"]
        fits[(call["condition"], call["unit"])][call["slot"]] = call.get("fits")
    unit_ids = sorted({u for (_, u) in table})
    for c in conditions:
        for u in unit_ids:
            if len(table[(c, u)]) != 6:
                raise SystemExit(f"{provider} {c} {u}: incomplete slots")
    per_unit = {}
    for c in conditions:
        for u in unit_ids:
            labels, ev = table[(c, u)], units[u]["evaluations"]
            per_unit[(c, u)] = {"S": int(EN.swap(labels, "immediate", "held")), "F": int(EN.swap(labels, "immediate", "sham")),
                                "U": int(error_flip(labels, ev)),
                                "UF": int(labels["immediate-a"] == labels["immediate-b"] and labels["sham-a"] == labels["sham-b"]
                                          and success(labels["immediate-a"], ev) != success(labels["sham-a"], ev))}
    observed, ci = bootstrap(conditions, unit_ids, per_unit, ("S", "F", "U", "UF"), protocol["analysis"]["seed"])
    out = {"units": len(unit_ids), "unitsWithFeasibleItem": sum(any(e["constraintMatch"] for e in units[u]["evaluations"].values())
                                                                 for u in unit_ids), "conditions": {}}
    for c in conditions:
        e = {k: observed[(c, k)] for k in ("S", "F", "U", "UF")}
        e.update({f"{k}_ci": ci((c, k)) for k in ("S", "F", "U", "UF")})
        if c != conditions[0]:
            for k in ("S", "U"):
                base = observed[(conditions[0], k)]
                d_ci = ci((c, "d" + k))
                b = sum(per_unit[(conditions[0], u)][k] and not per_unit[(c, u)][k] for u in unit_ids)
                d = sum(per_unit[(c, u)][k] and not per_unit[(conditions[0], u)][k] for u in unit_ids)
                noise_now, noise_base = observed[(c, "F" if k == "S" else "UF")], observed[(conditions[0], "F" if k == "S" else "UF")]
                excess_base = base - noise_base
                removed = None if excess_base <= 0 else round(1 - (e[k] - noise_now) / excess_base, 4)
                e[f"delta{k}"] = e[k] - base
                e[f"delta{k}_ci"] = d_ci
                e[f"removed{k}"] = removed
                e[f"mcnemar{k}"] = {"onlyWithout": b, "onlyWith": d, "pExact": round(EN.mcnemar_exact(b, d), 6)}
                e[f"reading{k}"] = EN.reading(tuple(d_ci), removed)
        succ = [success(table[(c, u)][s], units[u]["evaluations"]) for u in unit_ids for s in MAIN]
        reg = [regret(table[(c, u)][s], units[u]["evaluations"]) for u in unit_ids for s in MAIN]
        e["successRate"] = round(sum(succ) / len(succ), 4)
        e["meanRegret"] = round(sum(reg) / len(reg), 4)
        e["protocolFailures"] = sum(table[(c, u)][s] == "__PROTOCOL_FAILURE__" for u in unit_ids for s in MAIN)
        e["abandons"] = sum(table[(c, u)][s] == "__ABANDON__" for u in unit_ids for s in MAIN)
        if c != conditions[0]:
            tp = fp = fn = tn = missing = 0
            for u in unit_ids:
                ev = units[u]["evaluations"]
                for s in MAIN:
                    got = fits[(c, u)].get(s)
                    if not got:
                        missing += 1
                        continue
                    for alias, row in ev.items():
                        said = got.get(alias)
                        if said is None:
                            continue
                        truth = row["constraintMatch"]
                        tp += said and truth
                        fp += said and not truth
                        fn += (not said) and truth
                        tn += (not said) and not truth
            e["fitChecks"] = {"callsWithoutChecklist": missing, "tp": tp, "fp": fp, "fn": fn, "tn": tn,
                              "accuracy": round((tp + tn) / max(1, tp + fp + fn + tn), 4),
                              "precisionTrue": round(tp / max(1, tp + fp), 4), "recallTrue": round(tp / max(1, tp + fn), 4)}
        out["conditions"][c] = e
    out["api"] = record["api"]
    out["protocolSha256"] = record["protocolSha256"]
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", choices=PROVIDERS)
    args = parser.parse_args()
    text = (STUDY / "protocol.json").read_text(encoding="utf-8")
    protocol = json.loads(text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    summary = {"schemaVersion": "check-first-summary.v1", "protocolSha256": sha,
               "label": "Post-study experiment · September 2026 · 920 product-language shelves",
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
        print(f"== {provider}  units {r['units']} (with a feasible item {r['unitsWithFeasibleItem']})")
        for c, e in r["conditions"].items():
            line = f"  {c:18s} swaps S {e['S']:3d} (noise {e['F']})  errors U {e['U']:3d} (noise {e['UF']})  success {e['successRate']}"
            if "deltaS" in e:
                line += (f"\n  {'':18s} ΔS {e['deltaS']:+d} {e['deltaS_ci']} → {e['readingS']}   "
                         f"ΔU {e['deltaU']:+d} {e['deltaU_ci']} → {e['readingU']}")
                line += f"\n  {'':18s} fit checks {e['fitChecks']}"
            print(line)
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
