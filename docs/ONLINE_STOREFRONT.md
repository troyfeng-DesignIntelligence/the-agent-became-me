# Online Research Storefront

## Purpose

The storefront is a deployed research instrument for testing when delegated-task evidence becomes eligible for platform-level recommendations. It is not a commercial store and does not connect to Amazon or any other retailer.

## Open the interface

Local development:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Then open:

```text
http://127.0.0.1:5173/?view=storefront&task=cereal-selected&arm=held
```

Production:

```text
https://troyfeng-designintelligence.github.io/the-agent-became-me/?view=storefront&task=cereal-selected&arm=held
```

Model-backed v2 replay:

```text
http://127.0.0.1:5173/?view=storefront-v2&mode=free-running&phase=task-in-progress
```

Supported query parameters:

- `view=storefront` enters the research storefront.
- `task=<task-id>` selects one of the eight frozen pilot tasks.
- `arm=immediate|held` selects the platform-profile activation contract.
- `view=storefront-v2` enters the SASRec-backed v2 replay.
- `mode=fixed-trace|free-running` selects the v2 estimand.
- `phase=task-start|task-in-progress|outcome-resolved|next-task` selects a
  captured recommendation checkpoint.

## Run the browser-agent pilot

Build and start a production preview, then run:

```powershell
$env:SITE_URL="http://127.0.0.1:4173/"
pnpm online:pilot
pnpm online:evaluate
```

After deployment, set `SITE_URL` to the GitHub Pages URL and rerun the same commands. The runner creates 8 tasks × 2 arms × 4 snapshots = 64 browser snapshots.

## Safety boundary

The interface exposes only frozen-catalog search, product view, outcome resolution, and next-task actions. It contains no login, account, cart, checkout, payment, form submission, sponsored placement, or external product navigation.

The agent is deterministic. Both arms receive identical product observations and task-local recommendation state. The held arm stores pending evidence in a separate buffer that is not read by the platform shelf before resolution.

## Outputs

- `public/results/online-storefront-pilot/v1/summary.json`
- `public/results/online-storefront-pilot/v1/rows.json`
- `public/results/online-storefront-pilot/v1/traces.json`
- `public/evidence/online-storefront-pilot/v1/manifest.json`
- representative selected and abandoned task screenshots

Raw run screenshots and browser details remain under ignored `artifacts/`.

## Run the model-backed v2 experiment

The v2 runner requires the ignored Amazon Reviews 2018 inputs and 12 trained
SASRec checkpoints. It generates 460 tasks, four evidence contracts, two agent
configurations, two trace modes, and three model seeds per category.

```powershell
pnpm online:v2:run
pnpm online:v2:evaluate
pnpm build
pnpm qa:storefront-v2
```

The runner performs PyTorch inference offline. The static site loads a frozen
`model-bundle.json` containing representative pseudonymous Top-10 slates and
the aggregate result bundle; it does not ship raw reviews, product titles,
original user or item IDs, histories, or model checkpoint tensors.

The four v2 conditions separate evidence capture from recommendation use:

- `no-memory`: no task event is recorded.
- `logged-inert`: events are auditable but never enter recommendation context.
- `immediate-remove`: task evidence enters the model context immediately and
  is removed or resolved when the outcome is known.
- `held-outcome`: evidence stays outside platform recommendation context until
  selection or abandonment resolves the task.

Fixed traces answer whether activation timing changes recommendations under
identical behavior. Free-running policies answer whether changed shelves can
alter later browsing and selection. The two policies are deterministic
autonomous configurations, not frontier LLM agents.

V2 outputs:

- `public/results/online-storefront-v2/v1/summary.json`
- `public/results/online-storefront-v2/v1/rows.json`
- `public/results/online-storefront-v2/v1/contrasts.json`
- `public/results/online-storefront-v2/v1/model-bundle.json`
- `public/results/online-storefront-v2/v1/manifest.json`
- `experiments/online-storefront-v2/PREREGISTRATION.md`
- `experiments/online-storefront-v2/final_report.md`

## Claim boundary

The pilot and v2 can establish activation-timing effects inside this
research-owned system. V2 adds trained-model inference and free-running policy
feedback, but neither study establishes Amazon behavior, production
recommender behavior, human preference change, purchasing outcomes, trust,
welfare, or the behavior of frontier shopping agents.
