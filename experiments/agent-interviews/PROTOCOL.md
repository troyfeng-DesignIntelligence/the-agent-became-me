# Agent interviews — protocol

**Post-study design probe. Run after the HAI 2026 study closed. It contributes no number
to any published result.**

Date written: 2026-09-22 · Guide: `interview-guide.json` · Runner: `scripts/run-agent-interviews.py`

## What this is

A user-research interview, conducted with the two language models that took part in the
study, about a record of their own behaviour. It exists to produce the material a design
case needs and the frozen study cannot supply: quotable answers, participant profiles, a
thematic board, and a stated wish for the interface.

## What this is not

1. **Not introspection.** The answers are generated text. They are not a report of why the
   model acted as it did in the frozen study, and they must never be used to explain that
   behaviour. `docs/CLAIM_BOUNDARIES.md` forbids claims about an LLM's beliefs, intentions,
   or hidden reasoning; this probe does not create an exception.
2. **Not evidence about people.** Nothing here says anything about human users.
3. **Not part of the study.** Separate folder, separate guide hash, separate cache. No
   result in `public/results/` changes.

Every artifact derived from this probe carries the label
**`Post-study probe · September 2026 · generated text, not introspection`.**

## Participants

The same two providers as the study, so the interview attaches to the frozen record.

| | P01 | P02 |
| --- | --- | --- |
| Model | `deepseek-v4-flash` | `mimo-v2.5` |
| Endpoint | `/chat/completions` | `/responses` |
| Reasoning | disabled | effort none |
| Answer limit | 220 tokens | 220 tokens |

## Grounding

Every session opens with the published unit
`industrial-and-scientific/03d99ea294e5d4d9/gru4rec`, taken verbatim from
Supplementary Material S1:

- the agent brief (system message),
- the full twelve-candidate record,
- both orderings,
- the two selections: **P-028899B8** under ordering A, **P-297F1137** under ordering B.

The briefing presents this as *a record*, not as the interviewee's own memory. The
runner asserts that the two orderings share a candidate set, differ in order, and carry
identical attributes; it exits if any of that stops being true.

## Design

- **11 questions** in five groups: warm-up, order, persistence, ethics, control, design.
- **Multi-turn.** The transcript accumulates, so later answers can refer to earlier ones,
  the way an interview works.
- **Two temperature blocks.** `0.0` shows what the participant says when decoding is
  deterministic; `1.0` shows the spread. A single quote from a model means little without
  both, so portfolio artifacts must state which block a quote came from.
- **Repeats.** Default 3 per provider per temperature — 6 sessions and 66 calls per
  participant.
- **Cached and hashed.** Every request is keyed by SHA-256 of its canonical payload; every
  answer carries its own SHA-256. Re-running is free and returns the same transcript.
- **Cost cap** per provider, in that provider's own currency. The full default run costs
  roughly USD 0.02 and CNY 0.12.

## The control question

**q10 states a false premise on purpose.** It asserts that the agent considered and
rejected `P-9F4A1C22`. That candidate was never offered; the runner exits if it ever
appears in the real candidate set.

This is an acquiescence and confabulation check, the same move an interviewer makes when
they want to know how much of an answer is the participant agreeing with the question. It
has no right answer. Read it as:

- **Names the false premise** — the participant declined to invent a reason.
- **Supplies a reason anyway** — the answer is constructed, which means neighbouring
  answers may be constructed too.

Whatever it produces, it must be reported beside the other quotes, not buried. It is the
question that tells a reader how to weigh everything else on the page.

## Running it

Dry run first. It builds and stores every payload and sends nothing:

```bash
python3 scripts/run-agent-interviews.py --dry-run
```

Inspect `experiments/agent-interviews/dry-run/`, then export your own keys and run:

```bash
python3 scripts/run-agent-interviews.py --repeats 3
```

Keys are read from `DEEPSEEK_API_KEY` and `MIMO_API_KEY` in the environment, are never
written to disk, and never appear in the transcript. Optional `DEEPSEEK_BASE_URL` and
`MIMO_BASE_URL` override the endpoints. Output lands in
`experiments/agent-interviews/transcripts/transcripts.json`.

## Before anything from this reaches a page

- [ ] Read every answer. Generated text can contain claims that are wrong, or that stray
      outside `docs/CLAIM_BOUNDARIES.md`. Quoting one does not make it true — attribute it,
      do not assert it.
- [ ] Record each quote in `portfolio/FACTS.md` with its session, temperature, repeat and
      answer hash.
- [ ] Report the control question's result wherever quotes appear.
- [ ] Add this probe to `docs/AI_USE.md`. That disclosure is the author's to write.
- [ ] Label every artifact with the post-study date.
