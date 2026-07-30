# Analytical Chart Map

All visible results are generated from `protocol.v1`. Editorial headlines may
be provocative; chart titles remain neutral and descriptive.

## Plate 01 — Delegation pipeline

- Question: Where does a task-driven action become profile evidence?
- Takeaway: Interpretation is introduced at the log-to-profile transition.
- Form: annotated causal ribbon.
- Data: one representative 17-event trace.
- Encoding: stage position plus labeled actor/purpose fields.
- Fallback: ordered text sequence.

## Plate 02 — Fixed-trace condition comparison

- Question: How does one frozen trace produce different profile updates?
- Takeaway: Logging provenance without using it reproduces the actor-blind
  profile.
- Form: synchronized triptych with shared event rows.
- Data: 17 events × 3 selected conditions.
- Encoding: update status by symbol, text, and color.
- Fallback: per-event comparison table.

## Plate 03 — Profile components by evidence status

- Question: Which preference axes changed, and from what evidence?
- Takeaway: Non-commit agent events account for most change in the actor-blind
  replay.
- Form: layered horizontal strata.
- Data: 5 axes × condition × selected step.
- Encoding: axis length, provenance pattern, and status label.
- Fallback: exact before/delta/after table.

## Plate 04 — Evidence-to-profile provenance

- Question: Which events contributed to each profile axis?
- Takeaway: Provenance-aware updating redirects exploratory evidence away from
  persistent profile state.
- Form: compact braid / alluvial connection diagram.
- Data: selected trace receipts, 17–30 links after thresholding.
- Encoding: source actor and intent by line style; contribution by width.
- Fallback: evidence ledger.

## Plate 05 — Profile contamination across interaction steps

- Question: How quickly does the inferred profile move away from the reference?
- Takeaway: The paths separate early, while task behavior remains fixed.
- Form: highlighted multi-series line.
- Data: 18 logical points per condition; identical x-domain.
- Encoding: condition by color and line style; no area fill.
- Palette: hard two-root cap plus neutrals for the focused comparison.
- Fallback: step-by-step contamination table.

## Plate 06 — Attribution outcomes

- Question: How are agent events classified and used?
- Takeaway: Actor-aware logging can be accurate while remaining operationally
  ineffective.
- Form: heatmap / confusion-style matrix with counts.
- Data: event-level actual source, recorded source, purpose, and update status.
- Encoding: cell intensity plus direct counts.
- Fallback: accessible cross-tabulation.

## Plate 07 — Utility–integrity trade-off

- Question: Which design conditions preserve current task utility while limiting
  profile contamination?
- Takeaway: Preview and repair add interaction cost; the result is a Pareto
  field, not a universal winner.
- Form: scatter.
- Data: 12 condition × policy aggregates; each point has 160 runs.
- x: task utility.
- y: profile integrity (`1 - profile contamination`).
- size: interaction cost.
- grouping: condition, encoded by shape and color.
- Fallback: sorted comparison table.

## Palette and typography

- Paper: `#F2EFE8`
- Ink: `#151518`
- Quiet ink: `#626269`
- Rule: `#D5D0C6`
- Principal: `#315BD6`
- Agent: `#7656D8`
- Actor-blind/error: `#D94F36`
- Provenance: `#167C91`
- Approval/repair: `#16836F`
- Exposure/reference: `#B67A19`

Newsreader is reserved for editorial interpretation, IBM Plex Sans for interface
states, and IBM Plex Mono for evidence IDs, parameters, and exact values. No
chart relies on color alone.
