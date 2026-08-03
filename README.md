# The Agent Became Me

> You asked it to shop. The system watched.

![The Agent Became Me — interactive synthetic ACI study](docs/assets/hero.png)

**The Agent Became Me** is an interactive Agent–Computer Interaction (ACI)
testbed about delegated action and persistent personalization. It asks a narrow
question: when a shopping agent explores products for a temporary task, which
actions—if any—should become long-term evidence about the human principal?

The repository combines:

- a polished static React portfolio experience;
- a deterministic TypeScript simulator;
- two paired experiments and one falsification stress test;
- versioned product metadata and generated results;
- event-level traces, update receipts, exact-value tables, and accessible
  analytical figures.

No API key is required. There are no human participants, real user profiles, or
LLM-generated evaluation scores in the committed baseline.

The visual system treats the site as an evidence exhibition rather than an AI
product landing page: carbon-black rooms, bone-white documents, cobalt and
vermilion trace colors, physical specimen imagery, and data-led transitions.
The generated concept art is visibly labeled and is never presented as study
data. See [Art Direction and Image Provenance](docs/ART_DIRECTION.md).

## What the project found

The most important result is a **failed strong claim**.

Provenance-aware updating reduced reference-profile divergence relative to an
actor-blind updater. But a non-selective shrinkage control, oracle-calibrated
per trace to apply the same total update mass, performed slightly better:

| Study A contract | Runs | Mean divergence | Simulated ranking loss | Task utility |
| --- | ---: | ---: | ---: | ---: |
| Actor-blind | 480 | 0.311 | 0.035 | 0.434 |
| Logged only | 480 | 0.311 | 0.035 | 0.434 |
| Matched shrinkage | 480 | **0.176** | **0.005** | 0.434 |
| Provenance-aware | 480 | 0.187 | 0.006 | 0.434 |
| Scope-gated | 480 | 0.016 | 0.000 | 0.434 |
| No update | 480 | 0.000 | 0.000 | 0.434 |

In this benchmark, attenuation is a simpler explanation than provenance for the
observed improvement. Provenance-aware divergence was higher than matched
shrinkage in all 12 scenario × policy cell means and in 456 of 480 paired runs.
The project treats that falsification as a result, not as something to hide.

The zero-divergence no-update condition is also not universally preferable. In
a deliberately constructed stale-profile stress test, scope-gated updating
moved closer to the declared evaluator reference than preserving the stale
state:

| Study C contract | Runs | Mean divergence |
| --- | ---: | ---: |
| Scope-gated | 120 | **0.067** |
| Matched shrinkage | 120 | 0.075 |
| Provenance-aware | 120 | 0.078 |
| No update | 120 | 0.104 |
| Actor-blind | 120 | 0.132 |
| Logged only | 120 | 0.132 |

These are deterministic outputs from a synthetic testbed, not estimates of
human behavior or commercial platform effects.

## Claim boundary

The title is deliberately provocative. The implementation measures distance
between a **simulated inferred preference profile** and a declared evaluator
reference;
it does not measure a person's identity, preferences, or experienced harm.

Results in this repository do not establish:

- how a commercial platform currently updates profiles;
- how people experience delegation, consent, trust, or control;
- that a five-axis synthetic preference vector represents a person;
- that provenance-aware, scope-gated, or no-update mechanisms are universally
  preferable;
- that the Study B proxy is a real impact preview, approval flow, or repair
  interaction.

See [Claim Boundaries](docs/CLAIM_BOUNDARIES.md) and the
[Experimental Protocol](docs/PROTOCOL.md) before quoting a result.

## Research design

### Study A — Same trace, six update contracts

A behavior trace is generated once and replayed under six contracts:

| Condition | Operational difference |
| --- | --- |
| Actor-blind | Records agent events as principal events and applies full action weights |
| Logged only | Records actor and intent, but the updater ignores both |
| Matched shrinkage | Applies one uniform trace-level scale, oracle-calibrated to match the provenance-aware trace's total effective update mass; it does not weight events selectively |
| Provenance-aware | Downweights events by observed explore / consider / commit intent |
| Scope-gated | Updates only purchases observed as commit when the scenario allows commit-only learning |
| No update | Retains the trace for audit but never mutates the profile |

Catalog, scenario, policy, seed, event order, products, and task behavior are
held fixed. This isolates the updater contract.

### Study B — Behavior proxy versus persistence

Study B separates two implementation changes:

| Condition | Operational difference |
| --- | --- |
| Action only | Baseline product ranking and provenance-aware persistence |
| Impact proxy | Adds a deterministic product-to-disclosed-profile distance penalty to ranking |
| Proxy + quarantine | Reuses the proxy trace, then excludes non-commit evidence from persistent updates |

The proxy and proxy-plus-quarantine conditions have identical paired traces.
Their difference isolates persistence. The action-only comparison may change the
trace and therefore does not isolate logging.

| Study B condition | Runs | Mean divergence | Simulated ranking loss | Task utility | Cost index |
| --- | ---: | ---: | ---: | ---: | ---: |
| Action only | 480 | 0.187 | 0.006 | 0.434 | 0 |
| Impact proxy | 480 | 0.180 | 0.006 | 0.432 | 3 |
| Proxy + quarantine | 480 | **0.131** | **0.004** | 0.432 | 8 |

The cost index is hand-authored simulator metadata—not measured time, effort,
or cognitive load.

### Study C — A learning-needed counterexample

The weekly-breakfast scenario starts from its disclosed stale profile rather
than from the evaluator reference. The same frozen trace is replayed through the
six Study A contracts. This is one constructed counterexample to the claim that
preventing all learning is always safest; it does not estimate how often stored
profiles are stale.

## Committed evidence

The current `protocol.v1` artifact contains:

- 90 Open Food Facts product-metadata records;
- 4 deliberately constructed synthetic scenarios;
- 3 transparent deterministic policies;
- 40 paired seeds per baseline cell;
- 2,880 Study A rows;
- 1,440 Study B rows;
- 720 Study C rows;
- 9,600 sensitivity-analysis rows;
- 6 representative replays over the same 17-event trace.

Primary outcomes:

1. reference-profile divergence, serialized under the legacy field
   `profileContamination`;
2. simulated top-6 ranking loss, serialized as
   `futureRecommendationRegret`;
3. current task utility.

Diagnostics separately report actor-recording error, intent-label error,
provenance use, persistent update rate, constraint violations, and modeled
interaction cost. P10–P90 ranges describe generated-run variation; they are not
confidence intervals.

## Local development

### Requirements

- Node.js 24.14.0 (pinned in `.node-version`)
- pnpm 11.9.0

Install dependencies from the committed lockfile:

```bash
pnpm install --frozen-lockfile
```

Start the local development server:

```bash
pnpm dev
```

Build and preview the production bundle:

```bash
pnpm build
pnpm exec vite preview
```

## Verify the repository

Run the complete local gate:

```bash
pnpm check
```

It runs:

```bash
pnpm typecheck
pnpm test
pnpm verify:artifacts
pnpm build
```

`verify:artifacts` checks schema markers, row counts, condition coverage,
paired-trace invariants, representative receipts, finite metrics, and catalog
references. The Pages workflow also installs bundled Chromium, serves the
production build, and runs the responsive interaction QA:

```bash
pnpm qa:site
```

## Reproduce generated results

The committed Open Food Facts snapshot is the input to the committed baseline.
Regenerate full and aggregate outputs with:

```bash
pnpm experiment
pnpm verify:artifacts
```

This overwrites:

```text
public/results/v1/baseline.json
public/results/v1/summary.json
```

For fixed source, catalog, runtime, and seed configuration, simulated rows and
metrics are deterministic. `generatedAt` changes on regeneration and is not
part of the experimental state.

Refreshing the external catalog is a separate networked operation:

```bash
pnpm data:fetch
pnpm experiment
```

A refreshed Open Food Facts snapshot is a new dataset, not a reproduction of
the committed snapshot. Review its diff and attribution before committing it.

## Repository map

```text
src/domain/             Runtime schemas and TypeScript types
src/sim/                Named random streams, scenarios, and behavior traces
src/recommender/        Ranking and profile-update contracts
src/experiments/        Replay, metrics, and experiment runner
src/components/         Interactive trace and editorial evidence components
src/visualizations/     Accessible React/D3 analytical figures
scripts/                Generation, artifact verification, and browser QA
public/data/            Versioned product-metadata snapshot
public/results/v1/      Full rows, aggregates, and representative replay
tests/                  Determinism and mechanism checks
docs/                   Protocol, claim, trace, reuse, and AI-use records
```

Useful review documents:

- [Experimental Protocol](docs/PROTOCOL.md)
- [Claim Boundaries](docs/CLAIM_BOUNDARIES.md)
- [Analytical Chart Map](docs/CHART_MAP.md)
- [Trace Schema](docs/TRACE_SCHEMA.md)
- [Collision Review](docs/COLLISION_REVIEW.md)
- [Data and Reuse](docs/DATA_AND_REUSE.md)
- [AI Use Disclosure](docs/AI_USE.md)
- [Art Direction and Image Provenance](docs/ART_DIRECTION.md)

## Data, reuse, and licenses

The committed product snapshot contains information from
[Open Food Facts](https://world.openfoodfacts.org/), made available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The project excludes product images, reviews, accounts, and user-level records.
All principals, briefs, traces, and outcomes are synthetic.

See [Data License](DATA_LICENSE.md) and
[Third-Party Notices](THIRD_PARTY_NOTICES.md) for the repository's license
boundary. Project code and original documentation are released under the
[MIT License](LICENSE); that license does not replace ODbL terms for database
material.

The trace vocabulary is informed by
[W3C PROV-O](https://www.w3.org/TR/prov-o/). The project does not claim full
conformance with that standard.

## Publishing boundary

The repository includes a GitHub Pages workflow, but no publication is implied
by the local build. Publishing requires an explicit repository target and owner
approval. After publication, GitHub Pages can be enabled with **Source:
GitHub Actions**; the workflow verifies artifacts, builds, runs browser QA, and
deploys `dist/` without API keys.
