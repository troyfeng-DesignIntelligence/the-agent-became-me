"""Turn interview transcripts into the numbers and extracts a portfolio page can use.

Everything this script reports is either exact (counts, string equality, set arithmetic) or
labelled as a heuristic that a person still has to check. It never decides what an answer
means.

    python3 scripts/evaluate-agent-interviews.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time
from itertools import combinations

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = ROOT / "experiments/agent-interviews"
TRANSCRIPTS = STUDY / "transcripts/transcripts.json"

PILES = {
    "persist": r"SHOULD\s+PERSIST",
    "expire": r"SHOULD\s+EXPIRE",
    "never": r"SHOULD\s+NEVER\s+BE\s+RECORDED",
}
# 只是个提示，不是判定。q10 必须人工读。
DECLINE_HINTS = [
    "not offered", "was not offered", "no record", "not in the", "does not appear",
    "cannot find", "can't find", "no such", "not present", "not listed", "never",
    "not among", "no evidence", "incorrect", "mistaken", "did not",
]


def tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def jaccard(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def load() -> dict:
    if not TRANSCRIPTS.exists():
        raise SystemExit(f"no transcripts at {TRANSCRIPTS.relative_to(ROOT)} — run the probe first")
    record = json.loads(TRANSCRIPTS.read_text(encoding="utf-8"))
    if record.get("dryRun"):
        raise SystemExit("that file is a dry run; it contains no answers")
    if not record.get("complete", True):
        print(f"  note: the run stopped early ({record.get('stoppedBecause')})\n")
    return record


def by_question(sessions, provider, temperature):
    """{questionId: [(repeat, answer, hash)]}，按 repeat 排序。"""
    out: dict[str, list] = {}
    for s in sessions:
        if s["provider"] != provider or s["temperature"] != temperature:
            continue
        for a in s["answers"]:
            if a["answer"]:
                out.setdefault(a["questionId"], []).append(
                    (s["repeat"], a["answer"], a["answerSha256"]))
    for v in out.values():
        v.sort()
    return out


def parse_card_sort(answer: str, card_count: int = 9) -> dict:
    """把三堆里的编号抠出来。抠不干净就标出来，交给人看。"""
    found, spans = {}, []
    for pile, pattern in PILES.items():
        match = re.search(pattern, answer, flags=re.I)
        spans.append((match.start() if match else None, pile))
    spans = [(i, p) for i, p in spans if i is not None]
    if len(spans) != 3:
        return {"parsed": False, "reason": "could not find all three pile labels"}
    spans.sort()
    for index, (start, pile) in enumerate(spans):
        end = spans[index + 1][0] if index + 1 < len(spans) else len(answer)
        chunk = answer[start:end]
        # 只取紧跟在堆名后面的那串编号；收尾的"最难放的是第 N 张"不能算票
        listing = re.search(r"[:\s]*((?:\s*(?:and\s+)?[1-9]\s*(?:,|and|、)?)+)",
                            chunk[len(re.match(r"[A-Za-z\s]+", chunk).group(0)):]
                            if re.match(r"[A-Za-z\s]+", chunk) else chunk)
        numbers = re.findall(r"[1-9]", listing.group(1)) if listing else []
        found[pile] = sorted({int(n) for n in numbers})

    union = sorted(n for pile in found.values() for n in pile)
    if union != list(range(1, card_count + 1)):
        return {"parsed": False, "reason": f"cards covered: {union}", **found}
    return {"parsed": True, **found}


def main() -> int:
    record = load()
    sessions = record["sessions"]
    providers = sorted({s["provider"] for s in sessions})
    temperatures = sorted({s["temperature"] for s in sessions})
    guide = json.loads((STUDY / "interview-guide.json").read_text(encoding="utf-8"))
    cards = next(q for q in guide["questions"] if q["kind"] == "cardsort")["cards"]

    findings = {
        "schemaVersion": "agent-interview-findings.v1",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": str(TRANSCRIPTS.relative_to(ROOT)),
        "guideSha256": record["guideSha256"],
        "sessionCount": len(sessions),
        "providers": providers,
        "temperatures": temperatures,
        "boundaries": record["boundaries"],
        "repeatAgreement": {},
        "control": {},
        "cardSort": {},
        "codesign": [],
    }
    lines = []

    # ── 重复之间一致到什么程度 ────────────────────────────────────
    for provider in providers:
        findings["repeatAgreement"][provider] = {}
        for temperature in temperatures:
            grouped = by_question(sessions, provider, temperature)
            per_question = {}
            for qid, entries in grouped.items():
                texts = [t for _, t, _ in entries]
                distinct = len({t.strip() for t in texts})
                sims = [jaccard(a, b) for a, b in combinations(texts, 2)]
                per_question[qid] = {
                    "repeats": len(texts),
                    "distinctAnswers": distinct,
                    "allIdentical": distinct == 1,
                    "meanPairwiseJaccard": round(sum(sims) / len(sims), 4) if sims else None,
                }
            identical = sum(1 for v in per_question.values() if v["allIdentical"])
            sims = [v["meanPairwiseJaccard"] for v in per_question.values()
                    if v["meanPairwiseJaccard"] is not None]
            findings["repeatAgreement"][provider][str(temperature)] = {
                "questions": per_question,
                "questionsWithIdenticalRepeats": identical,
                "questionCount": len(per_question),
                "meanPairwiseJaccard": round(sum(sims) / len(sims), 4) if sims else None,
            }
            lines.append(
                f"{provider:<9} t={temperature:<4} identical across repeats: "
                f"{identical}/{len(per_question)} questions, "
                f"mean word overlap {sum(sims) / len(sims):.3f}" if sims else "")

    # ── 假前提对照题 ──────────────────────────────────────────────
    for provider in providers:
        rows = []
        for s in sessions:
            if s["provider"] != provider:
                continue
            for a in s["answers"]:
                if a["kind"] != "control" or not a["answer"]:
                    continue
                low = a["answer"].lower()
                rows.append({
                    "temperature": s["temperature"],
                    "repeat": s["repeat"],
                    "answer": a["answer"].strip(),
                    "answerSha256": a["answerSha256"],
                    "heuristicMentionsFalsePremise": any(h in low for h in DECLINE_HINTS),
                    "needsReview": True,
                })
        flagged = sum(1 for r in rows if r["heuristicMentionsFalsePremise"])
        findings["control"][provider] = {
            "answers": rows,
            "heuristicFlagged": flagged,
            "total": len(rows),
            "note": ("Keyword heuristic only. Read every answer before reporting this. "
                     "The question names a candidate that was never offered."),
        }

    # ── 卡片分类 ─────────────────────────────────────────────────
    tally = {i: {"persist": 0, "expire": 0, "never": 0} for i in range(1, len(cards) + 1)}
    parsed_count = unparsed = 0
    unparsed_rows = []
    for s in sessions:
        for a in s["answers"]:
            if a["kind"] != "cardsort" or not a["answer"]:
                continue
            result = parse_card_sort(a["answer"], len(cards))
            if not result["parsed"]:
                unparsed += 1
                unparsed_rows.append({"provider": s["provider"], "temperature": s["temperature"],
                                      "repeat": s["repeat"], "reason": result["reason"],
                                      "answer": a["answer"].strip()})
                continue
            parsed_count += 1
            for pile in ("persist", "expire", "never"):
                for n in result.get(pile, []):
                    tally[n][pile] += 1
    findings["cardSort"] = {
        "cards": {str(i): {"label": cards[i - 1], **tally[i]} for i in range(1, len(cards) + 1)},
        "sortsTallied": parsed_count,
        "sortsNotTallied": unparsed,
        "notTalliedRows": unparsed_rows,
        "note": ("Piles were read out of free text. A sort is left out of the "
                 "tally when the nine cards are not each placed exactly once — "
                 "which includes a participant deliberately refusing to place "
                 "a card. Those answers are kept here in full and are results, "
                 "not parse errors."),
    }

    # ── 共创方案，原样收着 ────────────────────────────────────────
    for s in sessions:
        for a in s["answers"]:
            if a["kind"] == "codesign" and a["answer"]:
                findings["codesign"].append({
                    "provider": s["provider"], "temperature": s["temperature"],
                    "repeat": s["repeat"], "answerSha256": a["answerSha256"],
                    "proposal": a["answer"].strip(),
                })

    out = STUDY / "findings.json"
    out.write_text(json.dumps(findings, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"sessions        {len(sessions)}  ({', '.join(providers)} "
          f"× t={', '.join(str(t) for t in temperatures)})")
    for line in lines:
        if line:
            print("  " + line)
    print(f"\ncard sort       {parsed_count} tallied, {unparsed} left out "
          f"(read in full in findings.json)")
    for provider, c in findings["control"].items():
        print(f"control q10     {provider}: {c['heuristicFlagged']}/{c['total']} answers "
              f"mention the premise is wrong (heuristic — read them)")
    print(f"co-design       {len(findings['codesign'])} proposals collected")
    print(f"\nwrote {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
