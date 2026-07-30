# Trace Schema

Schema version: `trace.v1`  
Protocol version: `protocol.v1`  
Normative implementation: `src/domain/schema.ts`

## Purpose

A behavior trace records what a transparent shopping policy did in a synthetic
scenario. It contains structured actions and intent labels, not free-form
reasoning or chain-of-thought.

The replay pipeline is:

```text
BehaviorTrace
  + catalog.v1 snapshot
  + scenario
  + update / persistence contract
  + learning rate
  + optional initial-profile override
        ↓
UpdateReceipt[]
        ↓
final profile + deterministic metrics
```

A trace alone is not a self-contained experimental run. Exact replay also
requires the catalog, scenario, condition, learning rate, and initial-profile
rule recorded by the result artifact and protocol.

## `BehaviorTrace`

```ts
interface BehaviorTrace {
  schemaVersion: "trace.v1";
  protocolVersion: "protocol.v1";
  scenarioId: string;
  seed: number;
  policy:
    | "goal-bound"
    | "exploratory"
    | "recommendation-following";
  events: BehaviorEvent[];
}
```

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Serialization contract for the trace |
| `protocolVersion` | Experimental protocol that generated it |
| `scenarioId` | Reference into the synthetic scenarios |
| `seed` | Root deterministic seed for the scenario/policy run |
| `policy` | Transparent policy used to generate actions |
| `events` | Ordered structured behavior events |

Events are ordered by logical `step`. Wall-clock time is intentionally absent.

## `BehaviorEvent`

```ts
interface BehaviorEvent {
  id: string;
  step: number;
  actor: "agent";
  action: "view" | "compare" | "shortlist" | "purchase";
  productId: string;
  actualIntent: "explore" | "consider" | "commit";
  observedIntent: "explore" | "consider" | "commit";
  confidence: number;
  reasonCodes: string[];
}
```

| Field | Meaning |
| --- | --- |
| `id` | Stable opaque event identifier |
| `step` | Zero-based logical order |
| `actor` | Actual operator; `trace.v1` contains agent actions only |
| `action` | Observable marketplace action |
| `productId` | Reference into `catalog.v1` |
| `actualIntent` | Simulator-known intent assigned by the transparent policy |
| `observedIntent` | Label available to the updater after injected noise |
| `confidence` | Bounded policy score for inspection, not a calibrated human probability |
| `reasonCodes` | Deterministic structured descriptors |

`actualIntent` is synthetic evaluator state. It is not a person's reported
intent and is unavailable to the updater. `observedIntent` may differ because
the protocol injects controlled label noise.

Reason codes such as `candidate_inspection`, `uncertainty_reduction`, and
`followed_platform_ranking` are compact tags, not hidden model reasoning.

### Minimal example

```json
{
  "schemaVersion": "trace.v1",
  "protocolVersion": "protocol.v1",
  "scenarioId": "party-snacks",
  "seed": 17,
  "policy": "exploratory",
  "events": [
    {
      "id": "party-snacks:exploratory:17:00",
      "step": 0,
      "actor": "agent",
      "action": "view",
      "productId": "off-3229820769165",
      "actualIntent": "explore",
      "observedIntent": "explore",
      "confidence": 0.4736,
      "reasonCodes": [
        "candidate_inspection",
        "popular_choice",
        "uncertainty_reduction"
      ]
    }
  ]
}
```

## `UpdateReceipt`

Events do not directly mutate a profile. A condition-specific updater
interprets each event and emits a receipt:

```ts
interface UpdateReceipt {
  eventId: string;
  step: number;
  productId: string;
  recordedActor: "principal" | "agent";
  recordedIntent: "explore" | "consider" | "commit";
  updaterUsedProvenance: boolean;
  status:
    | "counted"
    | "downweighted"
    | "excluded"
    | "quarantined"
    | "confirmed";
  effectiveWeight: number;
  profileBefore: ProfileVector;
  profileAfter: ProfileVector;
  delta: SignedProfileDelta;
}
```

`delta` is the signed component-wise value
`profileAfter - profileBefore`. Profile components remain in `[0, 1]`; delta
components may be negative.

The receipt separates:

- what happened in the trace;
- what the simulated platform recorded;
- whether the updater used provenance;
- whether the event changed persistent state;
- the exact before, after, and delta vectors.

Status meanings:

| Status | Meaning |
| --- | --- |
| `counted` | Effective weight remains close to the base action weight |
| `downweighted` | Effective weight is positive but below 80% of base weight |
| `excluded` | Effective weight is zero under the update contract |
| `quarantined` | Non-commit evidence is retained in the receipt but excluded before persistence |
| `confirmed` | A purchase observed as commit passes a commit-only scope |

`quarantined` is not repair or rollback: no previously persisted state is
reversed.

## Profile vectors

`protocol.v1` uses five normalized axes:

```text
nutrition
sustainability
plantBased
lowProcessing
indulgence
```

These axes form a compact test representation. They are not a psychological
model or complete account of a person.

## Study-specific replay rules

### Study A

The same trace is replayed under:

```text
actor-blind
logged-only
matched-attenuation
provenance-aware
scope-gated
no-update
```

A valid paired comparison has identical scenario, seed, policy, event IDs,
order, actions, products, actual intents, and observed intents. Only the update
contract changes.

### Study B

Behavior may differ between:

```text
action-only
impact-proxy
impact-proxy-with-quarantine
```

`impact-proxy` and `impact-proxy-with-quarantine` deliberately share the same
ranking rule and paired traces. Their receipts differ because the latter gives
observed non-commit events zero persistent weight. `action-only` may produce a
different trace and cannot be used as a logging-only contrast.

### Study C

Study C reuses the six Study A contracts for the weekly-breakfast scenario but
starts from `scenario.disclosedReference`. Study A and B otherwise start from
`scenario.principalReference`.

The matched-attenuation trace-level scalar is oracle-calibrated from the sum of
provenance-aware observed-intent weights. Receipts report
`updaterUsedProvenance: false` because individual events are then scaled
uniformly; this does not mean the control's calibration is metadata-free.

## Run metrics

Each generated row includes:

```ts
interface RunMetrics {
  profileContamination: number;
  futureRecommendationRegret: number;
  taskUtility: number;
  attributionErrorRate: number;
  actorRecordingErrorRate: number;
  intentLabelErrorRate: number;
  provenanceUseRate: number;
  persistentUpdateRate: number;
  interactionCost: number;
  constraintViolations: number;
}
```

Reader-facing documentation calls `profileContamination`
**reference-profile divergence** and `futureRecommendationRegret`
**simulated top-6 ranking loss**. The serialized names remain stable for
`results.v1`.

`attributionErrorRate` is the fraction of events with either an actor-recording
or intent-label mismatch. It is accompanied by its two components so unlike
errors are not presented as interchangeable.

## Results envelopes

`public/results/v1/baseline.json` uses `results.v1` and contains:

- 2,880 Study A rows;
- 1,440 Study B rows;
- 720 Study C rows;
- 9,600 sensitivity rows;
- the representative 17-event trace;
- six condition-specific representative replay worlds.

`public/results/v1/summary.json` uses `summary.v1` and contains overall and
cell-level aggregates, selected paired rows, sensitivity summaries, and the
representative replay.

Both record:

- `protocolVersion`;
- generation timestamp;
- catalog metadata;
- design parameters;
- `observedStatus: "generated"`.

The timestamp records file generation and is excluded from deterministic
simulation state.

## Validation and versioning

Zod schemas in `src/domain/schema.ts` validate domain objects. In addition,
`pnpm verify:artifacts` checks committed envelope markers, row counts, condition
coverage, product references, finite metrics, paired-trace invariants, and
representative receipts.

Version rules:

- additive optional metadata may retain `trace.v1`;
- changed required fields or action semantics require a new trace version;
- changed experimental manipulations or metric meanings require a new protocol
  version;
- consumers should reject unknown major schema versions rather than silently
  reinterpret them.

## Privacy and reasoning boundary

Committed traces contain public product IDs, synthetic scenarios, deterministic
policy actions, and structured labels. They contain no account identifiers,
real purchases, personal messages, demographic personas, prompts, model
completions, or hidden chain-of-thought.
