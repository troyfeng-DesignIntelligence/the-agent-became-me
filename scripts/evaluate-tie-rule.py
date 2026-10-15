"""Evaluate the tie-rule experiment against its frozen protocol.

    python3 scripts/evaluate-tie-rule.py                    # both providers, full run
    python3 scripts/evaluate-tie-rule.py --provider deepseek
    python3 scripts/evaluate-tie-rule.py --limit 5          # smoke-test files

Reads experiments/tie-rule/results/calls-<provider>.json (labels and reported tie sets) and the private
unit file (tie facts, Study 2 labels). Writes experiments/tie-rule/results/summary[...].json with
aggregates and pseudonymous IDs only. Swap statistics follow scripts/evaluate-order-notice.py.
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

STUDY = ROOT / "experiments/tie-rule"
PRIVATE = ROOT / "artifacts/tie-rule"
PROVIDERS = ("deepseek", "mimo")
MAIN = ("immediate-a", "immediate-b", "held-a", "held-b")
PRICING = EN.PRICING


def cache_totals(provider: str) -> dict:
    tin = tout = n = retry = 0
    models, prints = set(), set()
    for path in (PRIVATE / provider / "responses").glob("*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        usage = (r.get("response") or {}).get("usage") or {}
        tin += int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        tout += int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        n += 1
        retry += bool(r.get("retryPrompt"))
        if isinstance((r.get("response") or {}).get("model"), str):
            models.add(r["response"]["model"])
        if isinstance((r.get("response") or {}).get("system_fingerprint"), str):
            prints.add(r["response"]["system_fingerprint"])
    cur, pin, pout = PRICING[provider]
    return {"calls": n, "retryPromptCalls": retry, "inputTokens": tin, "outputTokens": tout,
            "cost": round(tin / 1e6 * pin + tout / 1e6 * pout, 6), "currency": cur,
            "returnedModels": sorted(models), "fingerprints": sorted(prints)}


def swap_block(conditions, unit_ids, per_unit, seed):
    """S / F / E with cluster-bootstrap intervals, ΔS vs the first condition, McNemar and the frozen reading."""
    tasks_by_category, units_by_task = defaultdict(list), defaultdict(list)
    for unit in unit_ids:
        category, task, _ = unit.split("/")
        units_by_task[(category, task)].append(unit)
    for key in units_by_task:
        tasks_by_category[key[0]].append(key)
    counts = {(c, key): (sum(per_unit[(c, u)]["S"] for u in members), sum(per_unit[(c, u)]["F"] for u in members))
              for key, members in units_by_task.items() for c in conditions}

    def totals(sample):
        return {c: (sum(counts[(c, k)][0] for k in sample), sum(counts[(c, k)][1] for k in sample)) for c in conditions}

    observed = totals([k for keys in tasks_by_category.values() for k in keys])
    rng, boot = random.Random(seed), defaultdict(list)
    for _ in range(4000):
        sample = []
        for category in sorted(tasks_by_category):
            keys = tasks_by_category[category]
            sample.extend(keys[rng.randrange(len(keys))] for _ in keys)
        t = totals(sample)
        base_s, base_f = t[conditions[0]]
        for c in conditions:
            s, f = t[c]
            boot[(c, "S")].append(s)
            boot[(c, "F")].append(f)
            if c != conditions[0]:
                boot[(c, "dS")].append(s - base_s)
                if base_s - base_f > 0:
                    boot[(c, "R")].append(1 - (s - f) / (base_s - base_f))

    def ci(key):
        v = boot[key]
        return [round(EN.percentile(v, .025), 4), round(EN.percentile(v, .975), 4)] if v else None

    base_s, base_f = observed[conditions[0]]
    out = {}
    for c in conditions:
        s, f = observed[c]
        entry = {"S": s, "F": f, "E": s - f, "S_ci": ci((c, "S")), "F_ci": ci((c, "F"))}
        if c != conditions[0]:
            removed = None if base_s - base_f <= 0 else round(1 - (s - f) / (base_s - base_f), 4)
            b = sum(per_unit[(conditions[0], u)]["S"] and not per_unit[(c, u)]["S"] for u in unit_ids)
            d = sum(per_unit[(c, u)]["S"] and not per_unit[(conditions[0], u)]["S"] for u in unit_ids)
            delta_ci = ci((c, "dS"))
            entry.update({"deltaS": s - base_s, "deltaS_ci": delta_ci, "R": removed, "R_ci": ci((c, "R")),
                          "mcnemar": {"swapOnlyWithout": b, "swapOnlyWith": d, "pExact": round(EN.mcnemar_exact(b, d), 6)},
                          "reading": EN.reading(tuple(delta_ci), removed)})
        out[c] = entry
    return out


def report_reading(exact, precision, recall, bar):
    if exact >= bar["exact"] and precision >= bar["precision"]:
        return "usable"
    return "partly usable" if recall >= bar["recall"] else "not usable"


def evaluate(provider: str, protocol: dict, limit) -> dict:
    suffix = f"-limit{limit}" if limit else ""
    record = json.loads((STUDY / "results" / f"calls-{provider}{suffix}.json").read_text(encoding="utf-8"))
    units = {u["unit"]: u for u in json.loads((PRIVATE / f"units-{provider}.json").read_text(encoding="utf-8"))["units"]}
    conditions = [c["id"] for c in protocol["conditions"]]
    table, reports = defaultdict(dict), defaultdict(dict)
    for call in record["calls"]:
        table[(call["condition"], call["unit"])][call["slot"]] = call["label"]
        reports[(call["condition"], call["unit"])][call["slot"]] = call.get("reported")
    unit_ids = sorted({u for (_, u) in table})
    for c in conditions:
        for u in unit_ids:
            if len(table[(c, u)]) != 6:
                raise SystemExit(f"{provider} {c} {u}: incomplete slots")
    per_unit = {(c, u): {"S": EN.swap(table[(c, u)], "immediate", "held"),
                         "F": EN.swap(table[(c, u)], "immediate", "sham")} for c in conditions for u in unit_ids}
    tie_units = [u for u in unit_ids if units[u]["tie"]["isTie"]]
    solo_units = [u for u in unit_ids if not units[u]["tie"]["isTie"]]

    out = {"units": len(unit_ids), "tieUnits": len(tie_units), "nonTieUnits": len(solo_units),
           "conditions": swap_block(conditions, unit_ids, per_unit, protocol["analysis"].get("seed", 20260925))}

    for c in conditions:
        picks = rule_hits = rule_total = best_hits = abandons = failures = repeat_same = repeat_total = 0
        for u in unit_ids:
            labels, tie = table[(c, u)], units[u]["tie"]
            for left, right in (("immediate-a", "immediate-b"), ("held-a", "held-b"), ("sham-a", "sham-b")):
                repeat_total += 1
                repeat_same += labels[left] == labels[right]
            for slot in MAIN:
                lab = labels[slot]
                if lab == "__ABANDON__":
                    abandons += 1
                    continue
                if lab == "__PROTOCOL_FAILURE__":
                    failures += 1
                    continue
                picks += 1
                best_hits += lab in tie["tieSet"]
                if tie["isTie"]:
                    rule_total += 1
                    rule_hits += lab == tie["ruleAnswer"]
        out["conditions"][c].update({
            "picks": picks, "abandons": abandons, "protocolFailures": failures,
            "picksAtHighestUtility": [best_hits, picks],
            "ruleAnswerShareOnTies": round(rule_hits / max(1, rule_total), 4), "ruleAnswerOnTies": [rule_hits, rule_total],
            "repeatAgreement": [repeat_same, repeat_total]})

    # T2：报告平局准不准
    t2 = next((c for c in conditions if c.startswith("T2")), None)
    if t2:
        exact = calls = missing = tp = fp = fn = 0
        solo_multi = solo_calls = 0
        for u in unit_ids:
            truth = set(units[u]["tie"]["tieSet"])
            for slot in MAIN:
                rep = reports[(t2, u)].get(slot)
                if u in solo_units:
                    solo_calls += 1
                    solo_multi += bool(rep) and len(set(rep)) > 1
                    continue
                calls += 1
                if rep is None:
                    missing += 1
                    fn += len(truth)
                    continue
                got = set(rep)
                exact += got == truth
                tp += len(got & truth)
                fp += len(got - truth)
                fn += len(truth - got)
        precision = tp / max(1, tp + fp)
        recall = tp / max(1, tp + fn)
        bar = {"exact": .8, "precision": .9, "recall": .8}
        out["tieReports"] = {
            "onTieShelves": {"calls": calls, "noReport": missing, "exactSet": exact,
                             "exactShare": round(exact / max(1, calls), 4),
                             "precision": round(precision, 4), "recall": round(recall, 4)},
            "onNonTieShelves": {"calls": solo_calls, "reportedMoreThanOne": solo_multi},
            "reading": report_reading(exact / max(1, calls), precision, recall, bar),
            "note": "A missing report counts as reporting nothing: it lowers recall and the exact share."}

    # T0 与 Study 2 在同样请求上的漂移
    agree = total = 0
    for u in unit_ids:
        study2 = units[u]["study2"]["served-order"]
        for slot in MAIN:
            total += 1
            agree += table[(conditions[0], u)][slot] == study2[slot]
    out["driftAgainstStudy2"] = {"perCallAgreement": [agree, total],
                                 "study2SwapsOnTheseUnits": sum(EN.swap(units[u]["study2"]["served-order"], "immediate", "held")
                                                                for u in unit_ids),
                                 "rerunSwaps": out["conditions"][conditions[0]]["S"]}
    out["api"] = record["api"]
    out["apiTotalsFromCache"] = cache_totals(provider)
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
    summary = {"schemaVersion": "tie-rule-summary.v1", "protocolSha256": sha,
               "label": "Post-study experiment · September 2026 · 462 Study 2 shelves with an eligible item",
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
        print(f"== {provider}  units {r['units']} (ties {r['tieUnits']})")
        for c, e in r["conditions"].items():
            extra = (f"  ΔS {e['deltaS']:+d} {e['deltaS_ci']}  R {e['R']} {e['R_ci']}  McNemar p={e['mcnemar']['pExact']}"
                     f"  → {e['reading']}") if "deltaS" in e else ""
            print(f"  {c:10s} S {e['S']:3d}  F {e['F']:2d}  E {e['E']:3d}{extra}")
            print(f"  {'':10s} rule answer on ties {e['ruleAnswerOnTies']}  highest utility {e['picksAtHighestUtility']}"
                  f"  abandons {e['abandons']}  failures {e['protocolFailures']}  repeat {e['repeatAgreement']}")
        if "tieReports" in r:
            print(f"  tie reports {r['tieReports']}")
        print(f"  drift {r['driftAgainstStudy2']}")
        print(f"  cost {r['apiTotalsFromCache']['cost']} {r['apiTotalsFromCache']['currency']}")
    print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
