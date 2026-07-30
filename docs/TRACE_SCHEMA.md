# Trace Schema

Schema version: `trace.v1`  
Protocol version: `protocol.v1`  
Normative implementation: `src/domain/schema.ts`

## Purpose

A behavior trace records what a transparent shopping policy did in a synthetic
scenario. It is deliberately narrower than a conversational-agent transcript:
it contains structured observations about actions and intent labels, not hidden
reasoning or free-form chain-of-thought.

The replay pipeline is:

```text
BehaviorTrace
  + catalog snapshot
  + scenario
  + attribution/interface contract
  + learning rate
        ↓
UpdateReceipt[]
        ↓
final profile + registered metrics
```

A trace alone is not a self-contained experimental run. Exact replay also
requires the versioned catalog, scenario definition, condition, and learning
rate stored by the experiment output or protocol.

## BehaviorTrace

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
| `schemaVersion` | Serialization contract for this trace |
| `protocolVersion` | Experimental protocol that generated it |
| `scenarioId` | Reference into the registered synthetic scenarios |
| `seed` | Root deterministic seed for this scenario/policy run |
| `policy` | Transparent policy used to generate actions |
| `events` | Ordered behavior events |

Events are ordered by logical `step`. Wall-clock time is intentionally absent.

## BehaviorEvent

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
| `id` | Stable event identifier; consumers should treat it as opaque |
| `step` | Zero-based logical order within the trace |
| `actor` | The actual operator; `trace.v1` contains agent actions only |
| `action` | Observable marketplace action |
| `productId` | Reference into `catalog.v1` |
| `actualIntent` | Simulator-known intent assigned by the transparent policy |
| `observedIntent` | Intent available to the profile updater after label noise |
| `confidence` | Bounded policy score used for inspection, not a calibrated human probability |
| `reasonCodes` | Deterministic, structured descriptors of the action |

`actualIntent` is synthetic evaluator state. It is not a report of a person's
intent and is not available to the profile updater. `observedIntent` may differ
because `protocol.v1` injects controlled label noise.

`reasonCodes` are compact labels such as `candidate_inspection`,
`uncertainty_reduction`, or `followed_platform_ranking`. They are not
chain-of-thought and should not be presented as private model reasoning.

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

## UpdateReceipt

Behavior events do not directly mutate a profile. A condition-specific updater
interprets each event and emits an update receipt.

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
    | "temporary"
    | "confirmed";
  effectiveWeight: number;
  profileBefore: ProfileVector;
  profileAfter: ProfileVector;
  delta: SignedProfileDelta;
}
```

`delta` is the signed component-wise value
`profileAfter - profileBefore`. Profile components remain in `[0, 1]`, while a
delta can be negative.

The receipt separates three ideas:

- what actually happened in the behavior trace;
- what the simulated platform recorded;
- what the profile updater operationally used.

This distinction makes the `logged-only` control possible: actor and intent can
be present in the record while having no effect on the profile.

## Profile vectors

`protocol.v1` uses five normalized axes:

```text
nutrition
sustainability
plantBased
lowProcessing
indulgence
```

These axes are derived from selected public product metadata. They form a compact
test representation and are not a psychological model or complete account of a
person.

## Study-specific replay

### Study A

The same `BehaviorTrace` must be replayed under all four conditions. A valid
Study A comparison therefore has identical:

- `scenarioId`;
- `seed`;
- `policy`;
- event IDs, order, actions, and products.

Only the attribution/profile-update contract may differ.

### Study B

The interface condition is allowed to change product ranking and behavior.
Study B traces may therefore differ across:

- `action-only`;
- `impact-preview`;
- `preview-and-repair`.

Study B traces must not be used as evidence that logging alone caused an effect.

## Results envelopes

`public/results/v1/baseline.json` uses `results.v1` and contains full experiment
rows plus a representative trace and replay.

`public/results/v1/summary.json` uses `summary.v1` and contains aggregate cells,
selected paired-seed rows, sensitivity summaries, and the same representative
replay.

Both include:

- `protocolVersion`;
- generation timestamp;
- catalog metadata;
- registered design parameters;
- an explicit `observedStatus: "generated"` marker.

The timestamp records file generation and is not part of the deterministic
simulation state.

## Validation and versioning

Zod schemas in `src/domain/schema.ts` are the runtime source of truth.

Version rules:

- additive optional metadata may retain `trace.v1`;
- changed field meaning, required fields, or action semantics require a new
  trace version;
- changed experimental manipulations or metric definitions require a new
  protocol version;
- consumers should reject unknown major schema versions rather than silently
  reinterpret them.

## Privacy and reasoning boundary

The committed traces contain:

- public product identifiers;
- synthetic scenario identifiers;
- deterministic policy actions;
- structured intent and reason labels.

They contain no account identifiers, purchases by real people, personal
messages, demographic personas, model prompts, model completions, or hidden
chain-of-thought.
