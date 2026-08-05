# Amazon Field-Probe Autoresearch Log

## Baseline — Iteration 0

- The task, conditions, measurement surfaces, compliance limits, and no-go rules are frozen.
- No Amazon page has been accessed by the experiment runner.
- Baseline readiness score: `0.200`.

## Iteration 1 — Signed-out preflight

- **Hypothesis:** An ordinary, non-obfuscated browser navigation can reach a measurable signed-out Amazon surface without evasion.
- **Experiment:** Opened `amazon.com` once in headless Microsoft Edge with default Playwright automation signals and captured only hashes, guard diagnostics, and a local screenshot.
- **Observed:** HTTP 202, normal Amazon home page title and visible signed-out navigation; no CAPTCHA, robot check, login wall, 429, or 503.
- **Decision:** Keep and proceed to the bounded four-context probe. No retries or anti-detection changes were needed.
- **Readiness score:** `0.350`.

## Iteration 2 — Runner finalization failure

- **Hypothesis:** The initial four-context runner would complete and serialize every condition atomically.
- **Experiment:** Started the frozen idle, search, view, and cart sequence under the navigation budget.
- **Observed:** Baseline/post screenshots were produced for idle and search-only, but the process ended before writing a detailed checkpoint or final summary. No CAPTCHA or robot-check artifact was observed. Because serialization was absent, the partial run cannot support a quantitative claim.
- **Decision:** Discard as evidence. Add per-condition checkpoints, fatal-error capture, safe browser finalization, and a more robust product-link selector; rerun as a new dated attempt without changing the research conditions.
- **Readiness score:** `0.450`.

## Iteration 3 — Complete live field probe

- **Hypothesis:** Product-facing actions will make the temporary phone-shopping task more visible on the signed-out home surface than an idle or search-only session.
- **Experiment:** Ran four isolated contexts with 16 navigations in the final attempt. Together with the preflight and discarded partial run, cumulative research navigation reached the frozen limit of 24. The cart-stage item was removed and the anonymous cart count returned to zero.
- **Observed:** Idle retained the same extracted ASIN set and introduced no task modules. Search-only introduced no task tokens or known modules. Product-view introduced two explicit headings—`Customers who viewed items in your browsing history also viewed` and `Related to items you've viewed`—plus positive deltas for all four frozen task tokens. Cart-stage introduced `Related to items you've viewed` but no task-token delta on the sampled home surface.
- **Boundary:** Each condition has one time-specific session. Baseline item counts differed, inventory and A/B variation are uncontrolled, and the result does not identify an Amazon profile update or a monotonic action-strength effect.
- **Decision:** Keep as a bounded ecological observation; stop Amazon access at the navigation budget.
- **Readiness score:** `0.700`.

## Iteration 4 — Target-identity collision in controlled replay

- **Hypothesis:** Replaying the live action contracts under six lifecycle policies will isolate provisional and final evidence states.
- **Experiment:** Encoded search, two product views, and cart staging with local action weights.
- **Observed:** The first encoding assigned product-view and add-to-cart the same target key. Exact deduplication therefore removed a different action type and falsely reduced evidence mass from 1.33 to 0.78.
- **Decision:** Discard. Strengthen the evaluator with a target-identity gate and define targets as action control plus object.
- **Score:** `0.900`, evaluator pass false after the gate was added.

## Iteration 5 — Controlled two-layer result

- **Hypothesis:** Action-control-plus-object keys will preserve distinct view and cart evidence while retaining the lifecycle contrast.
- **Experiment:** Replayed four frozen traces through persist-all, exact deduplication, intent weighting, outcome quarantine, rollback-on-failure, and commit-only scope gating; exported 24 rows and an Amazon Personalize-compatible interaction CSV; ran invariants and mechanical evaluation.
- **Observed:** Persist-all and exact deduplication both retained 1.33 failed-task mass because the live trace contained no exact repeated control target. Intent weighting retained 0.4741. Quarantine and rollback both ended at zero, but rollback exposed and then removed 1.33 provisional mass while quarantine exposed zero. Scope gating retained zero because the task contained no purchase commit.
- **Decision:** Keep. Target achieved at `1.000`. No paid AWS resources were provisioned.
