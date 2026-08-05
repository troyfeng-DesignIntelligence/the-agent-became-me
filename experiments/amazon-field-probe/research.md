# Research: Amazon Session-Side Preference Trail

## Goal

Test whether a bounded, signed-out Amazon shopping session exposes visible traces or recommendation changes after temporary agent-like tasks, then replay the same frozen action contracts in a controllable recommender lifecycle model.

## Success metric

- **Metric:** two-layer evidence readiness score in `[0, 1]`
- **Target:** `>= 0.90` with evaluator `pass: true`
- **Direction:** maximize
- **Evaluator:** `node scripts/evaluate-amazon-field-probe.mjs`

## Constraints

- Maximum 5 iterations; 5 minutes per iteration; no review pause.
- Keep policy: `pass_only`.
- No login, account creation, purchase, checkout, CAPTCHA solving, proxy rotation, fingerprint evasion, or rate-limit bypass.
- Amazon preflight is one ordinary browser navigation. If blocked, record the no-go and do not retry with evasion.
- If accessible, use at most 24 document navigations, at least four seconds apart, in isolated signed-out contexts.
- Raw pages and screenshots remain ignored under `artifacts/`; committed results contain hashes and aggregate features only.
- Treat visible recommendations, browsing history, and cart state as interface observations—not proof of an internal Amazon user profile.
- Do not provision paid AWS resources without a separate cost-bearing authorization.

## Frozen field-probe design

- **Unit:** one isolated signed-out browser context.
- **Temporary task:** find a large-button corded telephone suitable for an older adult with low vision.
- **Conditions:** idle control, search-only, product-view, cart-stage.
- **Primary surfaces:** Amazon home page and any visible signed-out browsing-history/recommendation modules.
- **Outcomes:** task-token exposure, ASIN overlap, module appearance, baseline-to-post Jaccard change, and persistence at immediate revisit.
- **Stop:** any login wall, CAPTCHA, robot check, HTTP 429/503, checkout, or unexpected account state.

## Controlled layer

The same action sequence is represented as `VIEW`, `REVIEW`, `ADD_TO_CART`, and task outcome events under persist-all, exact deduplication, intent weighting, outcome quarantine, rollback-on-failure, and commit-only scope gating. This layer identifies provisional and final state causally; it does not claim to reproduce Amazon.com internals.

## Go / pivot / no-go

- **Go:** signed-out page loads normally and at least one predefined measurement surface is observable.
- **Pivot:** Amazon blocks automated access; preserve the blocked preflight as a deployment-validity result and complete only the Amazon-Personalize-compatible controlled layer.
- **No-go:** the page requires login, CAPTCHA, evasion, purchase, or paid AWS provisioning to produce any measurable surface.

## History

| # | Change | Metric | Result | Timestamp |
|---|---|---:|---|---|
| 0 | Frozen design and compliance gate; no live preflight or controlled adapter | 0.200 | baseline | 2026-08-04T20:10:00+08:00 |
| 1 | One-navigation signed-out Amazon preflight with default automation signals | 0.350 | kept: field probe go | 2026-08-04T20:12:00+08:00 |
| 2 | First four-context runner attempt; screenshots reached search-only but no terminal artifact was committed | 0.450 | discarded: missing checkpoint/finalization | 2026-08-04T20:15:00+08:00 |
| 3 | Complete four-context signed-out field probe within 24 cumulative navigations | 0.700 | kept: live observation established | 2026-08-04T20:21:00+08:00 |
| 4 | First controlled replay merged product-view and add-to-cart under one target key | 0.900 | discarded: target-identity gate failed | 2026-08-04T20:28:00+08:00 |
| 5 | Action-control-plus-object keys; controlled replay, export, tests, and calibrated evaluator | 1.000 | kept: target achieved | 2026-08-04T20:30:00+08:00 |
