"""Compare the twelve co-design proposals from the interview probe.

Method, stated so it can be checked:

1. Each proposal is split at the first explicit exclusion cue ("deliberately does not
   show", "Deliberately not shown:", ...). Text before the cue is the SHOWN span, text
   after it is the HIDDEN span. Every split point is written out so a person can verify it.
2. A vocabulary of interface elements is declared up front, below, with the exact regex
   used for each. The script reports whether each pattern matches in the shown span, the
   hidden span, both, or neither.

This is keyword presence over a declared vocabulary. It is not a reading of the designs.
Nothing here should reach a page without someone reading the twelve proposals.

    python3 scripts/compare-agent-codesign.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = ROOT / "experiments/agent-interviews"

# 把"故意不显示"那一段切出来。第一个命中的线索即为切点。
EXCLUSION_CUES = [
    r"deliberately does not show",
    r"deliberately not shown",
    r"what it deliberately does not show",
    r"it deliberately does not show",
    r"does not show",
    r"deliberately omits",
]

# 词表：左边是元素名，右边是判定用的正则。改了就在这里改，别散在别处。
VOCABULARY = {
    "confidence score": r"\bconfidence\b",
    "the non-selected candidates": (r"other candidates|other eleven|other items|"
                                    r"candidates considered|every candidate|full list|"
                                    r"twelve candidate|all twelve|viewed-but-unselected"),
    "the presentation order": r"\border(?:ed|ing|ings|s)?\b(?!\s+to\b)|reorder|sequence",
    "the selected item": r"selected item|item selected|item's id|item id|P-028899B8|final selection",
    "date or time": r"\bdate\b|time of day|when it ran|chronological|timeline",
    "internal ranking numbers": r"internal rank|ranking numbers|search rank|task-local rank|"
                                r"utility|novelty|internal deliberation|ranking logic",
    "a reason or explanation": r"explanation|\breason\b|why (?:this|it) was",
    "keep or remove control": r"\bkeep\b|\bremove\b|\bdiscard\b|\bexclude\b|not mine",
    "effect on later recommendations": r"future recommendation|recommendations would|"
                                       r"shape what you see|influence future|would change",
    "attribution to the agent": r"not by you|on your behalf|in your name|did not make|"
                                r"automated|chosen by agent|by an automated",
    "the delegation brief": r"delegation brief",
}


def load_proposals() -> list[dict]:
    findings = STUDY / "findings.json"
    if not findings.exists():
        raise SystemExit("run scripts/evaluate-agent-interviews.py first")
    data = json.loads(findings.read_text(encoding="utf-8"))
    rows = data.get("codesign") or []
    if not rows:
        raise SystemExit("findings.json holds no co-design proposals")
    return sorted(rows, key=lambda r: (r["provider"], r["temperature"], r["repeat"]))


def split_proposal(text: str) -> tuple[str, str, str | None]:
    lowered = text.lower()
    best = None
    for cue in EXCLUSION_CUES:
        match = re.search(cue, lowered)
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), match.group(0))
    if best is None:
        return text, "", None
    return text[:best[0]], text[best[0]:], best[1]


def screen_name(text: str) -> str | None:
    for pattern in (r'called\s+"([^"]+)"', r"called\s+'([^']+)'", r'screen is called\s+"([^"]+)"'):
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def main() -> int:
    proposals = load_proposals()
    rows, unsplit = [], 0
    for p in proposals:
        shown, hidden, cue = split_proposal(p["proposal"])
        if cue is None:
            unsplit += 1
        marks = {}
        for element, pattern in VOCABULARY.items():
            in_shown = bool(re.search(pattern, shown, flags=re.I))
            in_hidden = bool(re.search(pattern, hidden, flags=re.I))
            marks[element] = ("both" if in_shown and in_hidden else
                              "shown" if in_shown else
                              "hidden" if in_hidden else "absent")
        rows.append({
            "provider": p["provider"], "temperature": p["temperature"], "repeat": p["repeat"],
            "answerSha256": p["answerSha256"], "screenName": screen_name(p["proposal"]),
            "splitCue": cue, "shownSpan": shown.strip(), "hiddenSpan": hidden.strip(),
            "elements": marks,
        })

    providers = sorted({r["provider"] for r in rows})
    aggregate = {}
    for element in VOCABULARY:
        aggregate[element] = {}
        for provider in providers:
            group = [r for r in rows if r["provider"] == provider]
            aggregate[element][provider] = {
                state: sum(1 for r in group if r["elements"][element] == state)
                for state in ("shown", "hidden", "both", "absent")
            }
            aggregate[element][provider]["n"] = len(group)

    # ── 关键词 vs 人工判读，分歧一律打出来 ──────────────────────
    review_path = STUDY / "codesign-review.json"
    disagreements = []
    if review_path.exists():
        review = json.loads(review_path.read_text(encoding="utf-8"))
        for element, table in review["elements"].items():
            for r in rows:
                key = f"{r['provider']}-t{r['temperature']}-r{r['repeat']}"
                human = table.get(key)
                if not human:
                    continue
                if human["evidence"] not in r["shownSpan"] + " " + r["hiddenSpan"]:
                    disagreements.append({"cell": key, "element": element,
                                          "issue": "evidence sentence not found in the proposal"})
                    continue
                keyword = r["elements"][element]
                if keyword != human["verdict"]:
                    disagreements.append({
                        "cell": key, "element": element, "keyword": keyword,
                        "human": human["verdict"], "evidence": human["evidence"]})
        out_review = {"readBy": review["readBy"], "readAt": review["readAt"],
                      "disagreements": disagreements,
                      "rule": "Where they disagree, the human reading wins and the keyword "
                              "result must not be used."}
    else:
        out_review = {"disagreements": [], "rule": "no human reading recorded yet"}

    out = {
        "schemaVersion": "agent-codesign-comparison.v1",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "proposalCount": len(rows),
        "proposalsWithoutExclusionCue": unsplit,
        "vocabulary": VOCABULARY,
        "exclusionCues": EXCLUSION_CUES,
        "method": ("Keyword presence over a declared vocabulary, after splitting each "
                   "proposal at its first exclusion cue. Not a reading of the designs. "
                   "Verify against the twelve proposals before using."),
        "needsReview": True,
        "proposals": rows,
        "byProvider": aggregate,
        "humanReview": out_review,
    }
    path = STUDY / "codesign-comparison.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── 打印 ──────────────────────────────────────────────────────
    print(f"{len(rows)} proposals, {unsplit} without an explicit exclusion cue\n")
    print("SCREEN NAMES")
    for r in rows:
        print(f"  {r['provider']:<9} t={r['temperature']} r{r['repeat']}  "
              f"{r['screenName'] or '(not named in quotes)'}")

    glyph = {"shown": "●", "hidden": "○", "both": "◐", "absent": "·"}
    print(f"\nELEMENT MATRIX   ● in the shown span   ○ in the hidden span   "
          f"◐ both   · absent")
    header = "".join(f"{r['provider'][:2]}{int(r['temperature'])}{r['repeat']} "
                     for r in rows)
    print(f"  {'':<34}{header}")
    for element in VOCABULARY:
        cells = "".join(f"  {glyph[r['elements'][element]]}  " for r in rows)
        print(f"  {element:<34}{cells}")

    print("\nBY PROVIDER  (n = 6 each)")
    for element, per in aggregate.items():
        parts = []
        for provider, counts in per.items():
            parts.append(f"{provider}: shown {counts['shown']}, hidden {counts['hidden']}, "
                         f"both {counts['both']}")
        print(f"  {element:<34}{'   |   '.join(parts)}")

    if out_review["disagreements"]:
        print(f"\nKEYWORD vs HUMAN READING — {len(out_review['disagreements'])} disagreements")
        for d in out_review["disagreements"]:
            print(f"  {d['cell']:<20} {d['element']:<24} "
                  f"keyword={d.get('keyword')} human={d.get('human')}")
        print("  the human reading wins; do not use the keyword result for these cells")
    else:
        print("\nkeyword and human reading agree on every reviewed cell")

    print(f"\nwrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
