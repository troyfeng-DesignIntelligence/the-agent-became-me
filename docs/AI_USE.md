# AI Use Disclosure

## Summary

OpenAI Codex was used as an interactive development assistant during the
planning and implementation of this repository. Generative AI is not required
to run the site, generate the registered baseline, or compute any metric.

This disclosure concerns the production process. It does not imply that an AI
model is an experimental participant or evaluator.

## Where AI assistance was used

AI assistance supported:

- exploration and critique of the initial project framing;
- software architecture and task decomposition;
- drafting and reviewing TypeScript implementation ideas;
- proposing test cases and failure checks;
- drafting and editing documentation and interface copy;
- reviewing claim boundaries, reproducibility instructions, and handoff
  material.

AI suggestions are treated as untrusted contributions. The project owner is
responsible for reviewing source changes, running checks, verifying citations
and licenses, and accepting the final research and design decisions.

## Where AI is not used

The registered `protocol.v1` evidence does not use an LLM:

- the three agent policies are transparent deterministic functions;
- the evaluator is deterministic TypeScript;
- profile updates use explicit equations and condition rules;
- scenario principals and delegation briefs are synthetic fixtures;
- product metadata comes from Open Food Facts, not from a language model;
- no LLM acts as a judge, annotator, participant, or source of outcome values.

An optional LLM policy adapter may be explored later. It is not part of the
default runtime, committed baseline, or current claims. Any future LLM run must
record its provider, model identifier, model version when available, prompt
template, decoding configuration, failures, and separate exploratory status.

## Human and data boundary

The project contains no human-subject study and no real user profile. AI was not
used to fabricate participant quotes, interviews, observations, or behavioral
records.

The title *The Agent Became Me* is an editorial metaphor about attribution.
Generated outputs concern a simulated preference representation only.

## Reproducibility

Codex is not a runtime dependency. A reviewer can reproduce the registered
experiment from the committed catalog without an OpenAI account or API key:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm experiment
```

The generated metrics come from repository code and pinned inputs. The
`generatedAt` field changes on regeneration; this timestamp is not an
experimental outcome.

## Verification record

Material changes should be accepted only after the relevant checks pass:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Additional review should confirm:

- no hidden principal state is exposed to agent-facing logic;
- Study A reuses the same behavior trace across attribution conditions;
- Study B is not interpreted as a logging-only comparison;
- visible claims remain within `docs/CLAIM_BOUNDARIES.md`;
- external data and reused work remain attributed in
  `docs/DATA_AND_REUSE.md`.

AI assistance does not replace these checks or independent scholarly review.

## Documentation scope

This file is a project-level disclosure, not a complete transcript of all
human–AI interactions. If this work is submitted to a school, conference,
journal, competition, or employer, the author should also follow that
institution's current AI-disclosure policy.
