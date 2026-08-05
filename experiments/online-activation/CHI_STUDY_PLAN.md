# Online activation-timing study

## Decision

Proceed with a two-layer online study. The primary causal experiment runs on a research-owned public storefront and shopping-agent wrapper. A secondary public-web probe may test ecological robustness only after a site-specific policy audit or permission. It must not be described as manipulating a third-party platform's internal profile.

## Research question

Under identical shopping evidence and recommendation opportunities, how does early versus post-outcome eligibility of delegated-task evidence affect a research-owned shopping agent's recommendations, browsing decisions, and next-task state?

## Why a research-owned online system is required

A third-party storefront cannot be assigned an immediate or deferred evidence policy without platform cooperation. Its page, session state, recommendation system, advertising, inventory, and experiments are simultaneously stimulus, adapting system, and measurement source. The primary study therefore treats public product information as content and keeps the manipulated recommendation and evidence lifecycle inside an auditable research wrapper.

## System boundary

The online system has six explicit components:

1. Public product-content source or frozen licensed snapshot.
2. Browser shopping interface.
3. Append-only delegated-task event log.
4. Task-local evidence store available in both conditions.
5. Platform-profile eligibility gate controlled by condition.
6. Recommendation and snapshot generator owned by the study.

The agent never receives direct storage access. It can only search, view an allowlisted product, request recommendations, compare, select, abandon, and begin the next task.

## Conditions

- **Immediate activation:** task evidence becomes eligible for platform-profile recommendations as it is generated. At outcome resolution, exploratory evidence is removed and the selected outcome is committed, or all task evidence is removed after abandonment.
- **Hold until resolution:** the same events enter an inaccessible staged buffer while remaining available to the task-local recommender. At resolution, only the selected outcome is committed; abandoned-task evidence is discarded.
- **Stored but never activated control:** evidence is logged but never eligible for platform-profile or task-local retrieval.
- **No-memory control:** neither task-local nor platform-profile state persists.

## Four checkpoints

- T0: task start.
- T1: task in progress after the same frozen evidence prefix.
- T2: outcome resolved against an externally specified success criterion.
- T3: next task after the same standardized prefix.

Each snapshot is produced from a fresh inference context that receives only the state eligible at that checkpoint. Automated leakage probes must verify that held evidence does not appear in prompts, retrieval results, summaries, caches, or platform-profile state.

## Two estimands

### Fixed-trace direct effect

Both conditions replay the same observation and action trace. This identifies the direct recommendation effect of evidence eligibility timing.

### Free-running total effect

The agent may choose different browsing actions after its recommendations diverge. This estimates the bundled consequence of activation timing on the resulting trajectory. It must not be interpreted as the fixed-trace mechanism effect.

## Outcomes

Primary:

- paired Top-10 displacement at T1;
- excess displacement relative to identical-trace sham pairs;
- upper equivalence bound for T2 and T3 displacement.

Integrity and utility:

- task-local recommendation-use rate;
- selected-item constraint utility;
- outcome accuracy against an external task answer;
- evidence-leakage probe failures;
- trace and inference-call equality;
- action-budget and elapsed-time equality.

Secondary:

- category share and direct evidence-product share;
- rank-biased overlap;
- free-running trajectory divergence;
- failure, missing-snapshot, and negative-case rates.

## Technical pilot

Start with eight balanced tasks on the deployed research storefront. Each task has four frozen candidates, one externally specified success outcome or an infeasible label, and one next-task prefix. Use two model configurations only after deterministic browser and state-machine tests pass.

The pilot advances only if:

- 100% of actions and snapshots validate against the trace schema;
- no staged evidence is retrievable before resolution;
- conditions have identical fixed traces, inference calls, candidate sets, and task-local state;
- T2/T3 stored states are exactly matched;
- at least 90% of browser runs complete without protocol deviation;
- null and negative results are accepted by the evaluator.

## Go, pivot, no-go

**Go:** the lower 95% bound for excess T1 displacement is above 0.15, all leakage probes pass, and task utility is not lower in the held condition beyond a preregistered equivalence margin.

**Pivot:** T1 differs but T2/T3 fail equivalence; reframe around delayed carryover. If only free-running traces differ, reframe around interaction-mediated path dependence rather than a direct activation effect.

**No-go:** the fixed-trace difference disappears under a verified evidence firewall; sham sessions move similarly; held evidence leaks; task-local utility is meaningfully lower; or the conditions cannot be opportunity-matched.

## Secondary third-party web probe

This layer is optional and descriptive. Admit a site only if public navigation is compatible with current terms/robots or written permission is obtained. Use isolated signed-out contexts, default automation signals, sequential GET navigation, an allowlist, conservative rate limits, and an immediate stop on CAPTCHA, 403, 429, 503, authentication, selector drift, popup, or prohibited route.

Never log in, add to cart, purchase, submit forms, click sponsored placements, write reviews, rotate proxies, spoof fingerprints, solve challenges, or bypass access controls. Store no cookies, tracking tokens, identities, raw review text, or unnecessary HTML.

The public-web layer can establish only that a specified research agent completed a bounded task over specified public pages and that visible surfaces changed or did not change. It cannot establish platform-profile writes, platform-internal mechanisms, commercial-agent behavior, or human effects.

## Claim boundary

If the primary online study succeeds, the paper may claim a causal effect of evidence-eligibility timing **inside the deployed research-owned agent system**. It may not call that an Amazon effect, production recommender effect, human preference change, validated user control, or model unlearning.
