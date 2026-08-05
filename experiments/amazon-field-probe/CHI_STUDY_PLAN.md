# Amazon Field-Probe Study Plan

## Inferential separation

The field probe asks whether a temporary task leaves a visible interface trail in a real shopping session. The controlled layer asks how lifecycle policies would handle the same events. The first offers ecological contact; only the second provides mechanism control.

## Field conditions

| Condition | Frozen actions | Intended contrast |
|---|---|---|
| Idle control | Load baseline, wait, reload | Natural page variation |
| Search only | Search the temporary-task phrase | Query exposure |
| Product view | Search, open two result products | Click/view exposure |
| Cart stage | Search, open one product, add to cart, then remove | Strong reversible action |

All contexts are signed out and isolated. Loading the home page for measurement is common to every condition. Cart staging is permitted only if Amazon remains signed out and removal is available without entering checkout.

## Measurements

- normalized ASIN set and link-title tokens on the home page before and after;
- task-category tokens on post-task surfaces;
- visible recommendation/history module headings;
- Jaccard overlap between baseline and post-task product sets;
- robot-check, authentication, throttling, and locale diagnostics;
- screenshot and HTML hashes, without redistributing Amazon page content.

## Alternative explanations

- session recommendations may be contextual rather than a persistent profile;
- Amazon may A/B test modules or vary inventory, locale, ads, and ranking over time;
- isolated contexts can still share IP, time, and device characteristics;
- the baseline measurement itself creates a page view;
- product-detail recommendations can be item-to-item rather than personalized;
- signed-out behavior cannot establish account-level persistence.

## Claim boundary

Allowed: a specified signed-out Amazon session displayed a changed or unchanged surface after a bounded task.

Not allowed: Amazon changed a user's internal profile; the agent caused long-term personalization; the observed page reflects all Amazon users; a blocked automation attempt implies the phenomenon is absent.
