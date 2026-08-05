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

Supported query parameters:

- `view=storefront` enters the research storefront.
- `task=<task-id>` selects one of the eight frozen pilot tasks.
- `arm=immediate|held` selects the platform-profile activation contract.

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

## Claim boundary

The pilot can establish activation-timing effects inside this deployed research system. It cannot establish Amazon behavior, production recommender behavior, human preference change, purchasing outcomes, trust, welfare, or the behavior of frontier shopping agents.
