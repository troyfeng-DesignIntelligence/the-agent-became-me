# Amazon Session-Side Preference Trail

## What was run

A bounded, signed-out Amazon.com field probe used four isolated browser contexts and one frozen temporary task: find a large-button corded telephone for an older adult with low vision.

The final run used 16 low-frequency document navigations. Including one preflight and a discarded partial runner attempt, the research used exactly the frozen 24-navigation budget. No account was created or used, no CAPTCHA or robot check was bypassed, no checkout page was entered, and the staged cart item was removed with the anonymous cart count verified at zero.

## Field observations

| Condition | Baseline→post ASIN Jaccard | New known module | Task-token delta |
|---|---:|---|---|
| Idle control | 1.000 | none | all zero |
| Search only | 0.340 | none | all zero |
| Product view | 0.498 | browsing-history and related-items modules | large button +1; corded +4; telephone +6; senior +7 |
| Cart stage | 0.605 | related-items module | all zero |

The clearest observation is not the Jaccard difference. Baseline item counts differed substantially across contexts, so cross-condition ranking comparisons are confounded by loading, inventory, time, locale, advertising, and possible A/B variation.

The stronger interface-level observation is categorical: after opening two phone products, the signed-out home page contained headings for `Customers who viewed items in your browsing history also viewed` and `Related to items you've viewed`, and its visible text contained every frozen task token. Neither the idle nor search-only surface showed those modules or tokens. Cart staging showed a related-items module but no task-token increase on the sampled surface, so the probe does not support a simple “stronger action creates stronger personalization” ordering.

## Controlled lifecycle replay

The same action contracts were represented locally as search, product-view, and add-to-cart events. All task-bearing traces were treated as abandoned temporary tasks because the experimental task intentionally ended without purchase.

| Lifecycle contract | Provisional mass | Final mass | Failed residual | Rollback mass |
|---|---:|---:|---:|---:|
| Persist all | 1.3300 | 1.3300 | 1.3300 | 0 |
| Exact deduplication | 1.3300 | 1.3300 | 1.3300 | 0 |
| Intent weighted | 0.4741 | 0.4741 | 0.4741 | 0 |
| Outcome quarantine | 0 | 0 | 0 | 0 |
| Roll back on failure | 1.3300 | 0 | 0 | 1.3300 |
| Commit-only scope | 0 | 0 | 0 | 0 |

Quarantine and rollback finish identically but are not interactionally equivalent. Rollback permits provisional state to exist and potentially affect a recommendation surface before deletion; quarantine stages the evidence outside the profile until task outcome is known.

Exact deduplication does nothing here because no action-control-plus-object target repeats. An early implementation incorrectly merged viewing a product with clicking that product's cart control. That failure reinforces the WebArena result: target identity must include the interaction control, not just the product object.

## What is established

- A specified signed-out Amazon session displayed task-related browsing-history and related-item modules after product views.
- A search-only session did not display the same task tokens or known modules in this single run.
- A reversible cart action can be executed and cleaned up without login or checkout under the frozen probe.
- The observed action contracts generate distinct provisional and final states under executable local lifecycle policies.

## What is not established

- Amazon changed a user's internal or long-term profile.
- The observed modules were personalized rather than contextual, item-to-item, advertised, cached, or A/B tested.
- Product views are generally stronger signals than search or cart actions.
- The local event weights or lifecycle implementation reproduce Amazon.com.
- Amazon Personalize was deployed or queried. The repository contains only a compatible interaction export because provisioning would create paid AWS resources.

## Reproduction boundary

The live field probe must **not** be rerun automatically: it has reached its frozen navigation budget. The committed aggregate is `public/results/amazon-field-probe/v1/field-summary.json`; raw screenshots remain ignored. The controlled layer can be rerun safely:

```bash
npm run amazon:controlled
npm run amazon:evaluate
npm test -- --run tests/amazon-field-lifecycle.test.ts
```

Amazon Personalize documents item interactions such as clicks, purchases, and add-to-cart events as recommendation inputs, but that service documentation is not evidence of Amazon.com's internal implementation: <https://aws.amazon.com/personalize/faqs/>.
