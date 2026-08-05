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

## Install and quickstart

Requires Node.js 24 and pnpm 11.9.0.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173/` for the portfolio narrative or
`http://127.0.0.1:5173/?view=storefront&task=cereal-selected&arm=held` for the
online research storefront. The model-backed v2 replay is available at
`http://127.0.0.1:5173/?view=storefront-v2&mode=free-running&phase=task-in-progress`.

Run the production checks and browser-agent experiment with:

```powershell
pnpm check
pnpm build
pnpm online:pilot
pnpm online:evaluate
pnpm online:v2:run
pnpm online:v2:evaluate
pnpm qa:storefront-v2
```

The online storefront is a research-owned static web application. It has no
account, cart, checkout, payment, or external product navigation. See the
[online storefront guide](docs/ONLINE_STOREFRONT.md).

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

### Released WebArena failure-trace check

The repository also parses all 192 released GPT-4 CoT WebArena shopping
trajectories. A strict, screenshot-audited mapper retained 84 preference-facing
actions from 1,740 steps; 66 occurred in failed trajectories. This does not show
that failure causes more evidence because failures dominate the release and the
outcome groups differ.

The lifecycle replay found that holding before activation and rollback both remove all
final failed-task evidence mass, but rollback first exposes a mean provisional
mass of 0.179. Exact-target deduplication changed failed residual mass by only
0.7%. A broader label-only sensitivity reduced it by 39.2% but also removed
14.6% of successful evidence. See the
[failure-trace report](experiments/webarena-failure-traces/RELEASED_FAILURE_TRACE_REPORT.md).

### Bounded signed-out Amazon field probe

The repository now also contains one small ecological probe on Amazon.com. Four
isolated, signed-out contexts ran the same temporary accessibility-oriented
phone-shopping task under idle, search-only, product-view, and cart-stage
conditions. Across the preflight, one discarded runner attempt, and the final
run, the study used exactly its frozen budget of 24 document navigations.

The product-view condition introduced two explicit browsing-history or
related-item headings and positive deltas for all four predefined task tokens.
Idle and search-only introduced neither in this run. Cart staging introduced a
related-items heading but no task-token increase on the sampled home surface;
the anonymous cart was then emptied and verified at zero.

This is a page-level observation with one context per condition. It does not
show that Amazon changed an internal, account-level, or long-term profile, and
it does not establish a monotonic ordering from stronger actions to stronger
personalization. A linked local replay compares six evidence-lifecycle rules:
persist-all and exact deduplication leave 1.33 failed-task mass; intent
weighting leaves 0.4741; staged hold, rollback, and commit-only scope gating end
at zero. Rollback nevertheless exposes 1.33 provisionally before removing it,
while staged hold exposes zero. See the [field-probe report](experiments/amazon-field-probe/REPORT.md).

### Cross-task evidence and recommendation exposure

A controlled extension follows five abandoned temporary tasks with eight rounds
of unrelated personal shopping. Forty paired seeds and six lifecycle rules
produce 1,200 runs. Persist-all places an average of 24.17 temporary-task items
into the 48 later recommendation slots and takes 5.04 rounds to reach the first
clean surface. Intent weighting reduces this to 3.775 slots. Holding until outcome,
rollback, and commit-only scope gating produce zero post-outcome spillover, but
rollback first permits 2.56 profile-driven excess slots while task outcome is
pending; staged hold permits zero.

The website includes an interactive research instrument for changing task,
lifecycle rule, outcome, and timeline. It is not a validated control interface.
See the [cross-task exposure report](experiments/cross-task-exposure/REPORT.md).

### Exposure sensitivity and evidence slices

The follow-up sensitivity experiment varies profile weight, per-round evidence
decay, and follow-up task similarity over 250 cells. Each cell contains 100
paired runs, for 25,000 runs total. A paired no-temporary-profile counterfactual
prevents task-similar content from being counted as task-boundary exposure. 53.6% of
cells have zero mean excess exposure; the remaining 46.4% define a bounded
positive-exposure region. The website exposes this surface as an interactive map.

The field section also includes eight fixed before/after crops from the signed-out
Amazon probe. Product-bearing pixels are softened, the full-page extraction is
reported separately from what is visible in each crop, and source/output hashes
plus crop coordinates are stored in
[`public/evidence/amazon-field/v1/manifest.json`](public/evidence/amazon-field/v1/manifest.json).
See the [sensitivity report](experiments/cross-task-sensitivity/REPORT.md) and
the [paper core](experiments/paper/PAPER_CORE.md).

### Real-history, multi-recommender validation

The largest reviewer risk in the original cross-task result was its dependence
on one hand-authored ranker and a supplied similarity scalar. The replacement
experiment uses 703 chronological MovieLens histories, three within-user
similarity bands derived from genre profiles, three personalized recommender
families, and a global-popularity negative control. Four counterfactual
temporary-task events are activated against identical candidate sets and
global models, producing 25,308 paired rows.

Persist-all spillover appeared in 19.7% of content-profile cases, 19.8% of
item-neighborhood cases, and 50.2% of sequential-transition cases. Intent
weighting reduced the first two rates to 4.4% and 7.7%, but the sequential
family remained at 49.1%. Holding before activation exactly reproduced the no-injection
ranking, and global popularity remained invariant. This supports algorithm
heterogeneity, not algorithm independence. MovieLens supplies real histories,
but the delegated task is counterfactual and movies are not commerce. See the
[external-validity report](experiments/external-validity/REPORT.md) and the
[updated collision review](docs/COLLISION_REVIEW_2026-08-05.md).

### Learned sequence model on real commerce histories

The remaining domain and model proxies are now replaced by a standard learned
baseline. Three SASRec models were trained from scratch on Amazon Reviews 2018
`Luxury_Beauty_5`: 3,811 chronological histories, 34,246 retained interaction
events, and 1,581 products. On a fixed one-positive/99-negative test, mean
NDCG@10 was `0.464`, versus `0.185` for popularity and `0.426` for a first-order
transition control. Reversing histories changed the top 10 in 97.2% of cases.

In the paired task-boundary test, retaining four temporary-task items added
`0.410` mean target-family slots at 10 and reduced next-item hits by `0.1411`.
Committing only the selected outcome attenuated exposure to `0.333`; staged hold
reproduced the original ranking exactly. The histories are real, but delegation
is counterfactual, reviews are not purchases, title-token families are proxies,
and the model is not Amazon's production system. See the
[learned SASRec report](experiments/amazon-sasrec/REPORT.md).

### Cross-category replication and uncertainty

The learned test now uses the same architecture, split, task-family rule, and
hyperparameters in four Amazon 5-core categories: Luxury Beauty, Software,
Industrial and Scientific, and Prime Pantry. Across 30,838 histories, 261,836
retained events, and 12 checkpoints, SASRec beat popularity in held-out NDCG@10
in every category.

Statistical intervals use 2,000 hierarchical bootstrap replicates. Model seeds
and users are resampled separately, while the three repeated task-similarity
conditions stay attached to each user. Persist-all excess target-family slots
were positive in all four category-specific 95% intervals. The equal-category
estimate was `+0.321 [0.273, 0.369]`, and every leave-one-category-out lower
bound remained positive. Category estimates ranged from `+0.119` to `+0.612`,
so the result supports recurrence with domain heterogeneity, not a universal
effect size. See the [cross-category report](experiments/amazon-cross-category/REPORT.md).

### Shopping-agent activation timing

The latest experiment generates 320 shopping-agent tasks over the same four
Amazon sequence datasets. The deterministic agent searches, opens products,
requests task-local recommendations, compares candidates, and either selects or
abandons. Each realized trace is replayed under immediate platform activation
followed by removal or outcome commit, and under a hold that commits only the
selected outcome or discards an abandoned task.

Recommendations are captured at task start, in progress, after outcome
resolution, and at the next-task checkpoint. Pooled in-progress top-10
displacement was `0.766 [0.741, 0.792]`; all four category intervals were
positive. The resolved and next-task rankings matched exactly. Both lifecycle
arms retained identical task-local recommendation state, every trace used it,
and the maximum task-utility difference was zero. This is an offline
computational result, not a live Amazon.com or human study. See the
[activation-timing report](experiments/delegated-activation/REPORT.md).

### Deployed research storefront pilot

The research-owned storefront turns the activation contract into a real browser
interaction. A deterministic shopping agent completed eight tasks under both
immediate and held activation, recording four snapshots per arm. Across the 64
browser snapshots, fixed behavior traces and task-local recommendations matched
exactly. Mean in-progress platform-shelf displacement was `0.538`; T0, resolved,
and next-task shelves matched exactly. This validates the deployed instrument,
not a commercial recommender. Open it with
`?view=storefront&task=cereal-selected&arm=held` or see the
[online storefront guide](docs/ONLINE_STOREFRONT.md).

### Model-backed online storefront v2

The main online experiment replaces the pilot ranker with 12 frozen SASRec
checkpoints trained across four Amazon Reviews 2018 categories. Its 460-task
design compares four contracts—no memory, inert logging, immediate activation
followed by removal, and outcome-gated holding—under both identical fixed
traces and two free-running autonomous policies. The protocol, task count,
estimands, margins, bootstrap seed, and failure accounting were frozen before
outcomes were generated.

Across 22,080 condition rows, fixed-trace in-progress Top-10 displacement
between immediate and held activation was `0.765 [0.745, 0.785]`. The rankings
were equivalent after resolution and at the next-task checkpoint (`0.000`,
upper 95% bounds `0.000`). When shelves could affect subsequent actions,
paired traces diverged in `36.7% [31.6%, 43.4%]` of runs. Held activation was
non-inferior on the frozen decision-accuracy and selected-utility margins.
No-memory and inert logging matched throughout, separating event recording
from recommendation activation.

GitHub Pages presents a frozen, pseudonymous replay of offline PyTorch SASRec
inference; it does not run checkpoint inference in the browser. The two agents
are deterministic retrieval-and-planning policies, not frontier LLMs. See the
[v2 protocol and interface guide](docs/ONLINE_STOREFRONT.md) and
[final experiment report](experiments/online-storefront-v2/final_report.md).

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
- that the Amazon field probe reveals Amazon's internal recommender or profile
  implementation.

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
| Proxy + staged hold | Reuses the proxy trace, then excludes non-commit evidence from persistent updates |

The proxy and proxy-plus-staged-hold conditions have identical paired traces.
Their difference isolates persistence. The action-only comparison may change the
trace and therefore does not isolate logging.

| Study B condition | Runs | Mean divergence | Simulated ranking loss | Task utility | Cost index |
| --- | ---: | ---: | ---: | ---: | ---: |
| Action only | 480 | 0.187 | 0.006 | 0.434 | 0 |
| Impact proxy | 480 | 0.180 | 0.006 | 0.432 | 3 |
| Proxy + staged hold | 480 | **0.131** | **0.004** | 0.432 | 8 |

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
- 192 released WebArena shopping trajectories, 1,740 audited steps, 84 strict
  mapped events, and 1,152 failure-lifecycle replay rows.
- 4 signed-out Amazon field contexts within a 24-navigation cumulative budget,
  plus 24 controlled lifecycle rows and 7 interaction-export records.

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
pnpm amazon:evaluate
pnpm cross-task:evaluate
pnpm sensitivity:evaluate
pnpm external:evaluate
pnpm amazon:sasrec:evaluate
pnpm amazon:cross-category:evaluate
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
src/amazon/             Controlled field-action lifecycle contracts
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
- [Collision Review Delta](docs/COLLISION_REVIEW_2026-08-05.md)
- [Data and Reuse](docs/DATA_AND_REUSE.md)
- [AI Use Disclosure](docs/AI_USE.md)
- [Art Direction and Image Provenance](docs/ART_DIRECTION.md)
- [Amazon Field-Probe Report](experiments/amazon-field-probe/REPORT.md)
- [Cross-Task Exposure Report](experiments/cross-task-exposure/REPORT.md)
- [Cross-Task Sensitivity Report](experiments/cross-task-sensitivity/REPORT.md)
- [External-Validity Report](experiments/external-validity/REPORT.md)
- [Learned Amazon SASRec Report](experiments/amazon-sasrec/REPORT.md)
- [Cross-category Amazon Replication](experiments/amazon-cross-category/REPORT.md)
- [Paper Core: RQs, Results, and Figures](experiments/paper/PAPER_CORE.md)

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
