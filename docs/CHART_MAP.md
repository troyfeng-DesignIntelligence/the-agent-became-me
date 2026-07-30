# Analytical Chart Map

All quantitative figures are generated from `protocol.v1`. Editorial headings
may be provocative; chart titles and notes use neutral measurement language.
Every analytical figure includes a text summary and exact-value fallback.

## Plate 01 — Delegation gap

- Question: At which transition can task behavior become durable profile
  evidence?
- Form: conceptual causal ribbon.
- Data grain: none; this is explicitly labeled a schematic, not an observed
  trace.
- Encoding: ordered stage position and a highlighted log-to-profile transition.
- Claim boundary: explains the mechanism under study; it reports no result.

## Plate 02 — Six contracts over paired traces

- Question: How does generated reference-profile divergence vary across Study A
  contracts?
- Form: six aggregate range cards.
- Data grain: 480 runs per contract, pooling 4 scenarios × 3 policies × 40
  paired seeds.
- Encoding: large numeral = mean; horizontal segment = descriptive P10–P90.
- Comparison: actor-blind, logged only, matched shrinkage, provenance-aware,
  scope-gated, and no update.
- Claim boundary: no-update is a construction floor because Study A starts from
  the evaluator reference; it is not a universal recommendation.

## Plate 03 — Representative final profile strata

- Question: Which of the five profile axes moved in one replay?
- Form: aligned horizontal profile bars.
- Data grain: final state after one 17-event party-snacks trace, exploratory
  policy, seed 17.
- Comparison: actor-blind, matched shrinkage, provenance-aware, scope-gated,
  and no update.
- Encoding: bar length = final axis value; vertical rule = evaluator reference;
  adjacent text = exact reference, final value, and signed delta.
- Claim boundary: the plate explains one trajectory and cannot substitute for
  aggregate evidence.

## Plate 04 — Receipt-derived provenance braid

- Question: Which event contributed most strongly to which profile axis in the
  representative actor-blind replay?
- Form: compact connection diagram plus exact ledger.
- Data grain: 17 events and their 17 actual update receipts.
- Encoding:
  - source y-position = trace event;
  - target y-position = axis with the largest absolute signed delta;
  - path width = absolute magnitude of that dominant delta;
  - color = delta sign;
  - line style = observed intent.
- Claim boundary: links are derived from receipts, not fabricated geometry.
  Showing one dominant axis per event omits smaller simultaneous component
  changes; the ledger states that reduction.

## Plate 05 — Representative profile divergence

- Question: How quickly does divergence accumulate over one fixed trace?
- Form: multi-series step-after line chart.
- Data grain: 18 state points (initial state plus 17 events) for each of 5
  contracts over the same representative trace.
- Encoding: x = logical state/event order; y = normalized distance from the
  fixed reference; color and dash jointly encode contract.
- Claim boundary: lines are deterministic state transitions, not estimates or
  confidence intervals. Logged only is omitted because it exactly overlaps
  actor-blind.

## Plate 06 — Trace-handling diagnostics

- Question: What does each Study A contract record and operationally use?
- Form: rate matrix.
- Data grain: event-level rates aggregated over 480 runs per contract.
- Rows:
  - actor-recording error;
  - intent-label error;
  - event-level provenance-use rate;
  - persistent-update rate.
- Columns: all six Study A contracts.
- Encoding: fill intensity and direct percentage label use the same rate
  definition within each row.
- Claim boundary: these are implementation diagnostics, not human judgments or
  one interchangeable notion of attribution quality.

## Plate 07 — Separated outcome distributions

- Question: How do updater contracts and behavior/persistence probes compare
  without mixing their causal grains?
- Form: two vertically separated dot-and-range panels.
- Study A panel: 6 contracts × 480 runs, frozen trace within paired cells.
- Study B panel: 3 conditions × 480 runs; action-only may change behavior,
  whereas proxy and proxy-plus-quarantine share paired traces.
- Encoding: dot = mean divergence; whisker = descriptive P10–P90; adjacent
  columns = exact task utility and optional modeled cost index.
- Scale: both panels use a zero-based common divergence domain.
- Claim boundary: Study A and B are not plotted as one trade-off frontier.

## Plate 08 — Learning-needed counterexample

- Question: Can preventing all updates be worse when the stored profile is
  stale and delegated behavior is aligned?
- Form: dot-and-range condition panel.
- Data grain: 720 runs from weekly breakfast: 3 policies × 40 paired seeds × 6
  contracts.
- Encoding: dot = mean divergence; whisker = descriptive P10–P90; adjacent
  column = task utility.
- Claim boundary: one constructed counterexample falsifies a universal
  no-learning rule but does not establish prevalence or external validity.

## Sensitivity figure — Reference-divergence surface

- Question: How do label noise and learning rate alter actor-blind and
  provenance-aware divergence?
- Form: two small-multiple heatmaps.
- Data grain: 2 contracts × 5 label-noise levels × 4 learning rates × 4
  scenarios × 3 policies × 20 paired seeds = 9,600 rows.
- Encoding: x = label noise; y = learning rate; fill and direct label = mean
  divergence. Exact P10 and P90 values appear in the fallback table.
- Claim boundary: the surface is diagnostic. Non-monotonic means are possible
  because label errors can either amplify an event as commit or suppress a
  commit as explore; the chart is not a robustness certificate.

## Shared visual rules

- Color is always redundant with text, position, line dash, or direct labels.
- Quantitative axes start at zero unless the figure explicitly explains
  otherwise.
- P10–P90 denotes generated-run spread, not inferential uncertainty.
- Representative replay plates say “representative”; aggregate plates expose
  run counts.
- Dark fills use computed foreground contrast for direct labels.
- Horizontally scrollable figures are keyboard focusable and retain exact-value
  tables.
- Study A and Study B remain visually separated when their causal contrasts
  differ.
