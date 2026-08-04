import { AXES, type Axis, type ProfileVector } from "../domain/schema";
import type { RepresentativeReplay } from "../data";
import {
  AccessibleDataTable,
  useChartIds,
  type TableColumn
} from "../visualizations/shared";

const axisLabels: Record<Axis, string> = {
  nutrition: "Nutrition",
  sustainability: "Sustainability",
  plantBased: "Plant-based",
  lowProcessing: "Low processing",
  indulgence: "Indulgence"
};

export function formatAxis(axis: Axis): string {
  return axisLabels[axis];
}

function formatSigned(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}`;
}

interface CausalRibbonProps {
  activeStage?: number;
}

const causalStages = [
  {
    eyebrow: "01 / request",
    label: "Human intent",
    note: "A temporary goal enters the system."
  },
  {
    eyebrow: "02 / strategy",
    label: "Agent decision",
    note: "The delegate explores and acts."
  },
  {
    eyebrow: "03 / trace",
    label: "Recorded action",
    note: "Behavior becomes platform evidence."
  },
  {
    eyebrow: "04 / inference",
    label: "Profile update",
    note: "A task choice becomes long-term preference evidence."
  },
  {
    eyebrow: "05 / return",
    label: "Future ranking",
    note: "The inferred profile shapes what comes back."
  }
];

export function CausalRibbon({ activeStage = 3 }: CausalRibbonProps) {
  return (
    <div className="causal-ribbon" aria-label="Delegated action causal chain">
      <div className="causal-line" aria-hidden="true" />
      {causalStages.map((stage, index) => (
        <article
          className={`causal-stage${index === activeStage ? " is-active" : ""}`}
          key={stage.label}
        >
          <span className="causal-index">{stage.eyebrow}</span>
          <span className="causal-dot" aria-hidden="true" />
          <h3>{stage.label}</h3>
          <p>{stage.note}</p>
        </article>
      ))}
    </div>
  );
}

interface ProfileStrataProps {
  reference: ProfileVector;
  profiles: Array<{
    id: string;
    label: string;
    profile: ProfileVector;
    tone: "error" | "provenance" | "negotiated" | "neutral";
  }>;
}

export function ProfileStrata({
  reference,
  profiles
}: ProfileStrataProps) {
  const tableRows = AXES.map((axis) => ({ axis }));
  const tableColumns: TableColumn<(typeof tableRows)[number]>[] = [
    {
      key: "axis",
      header: "Axis",
      render: (row) => axisLabels[row.axis]
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => reference[row.axis].toFixed(6)
    },
    ...profiles.flatMap((item) => [
      {
        key: `${item.id}-final`,
        header: `${item.label} final`,
        render: (row: (typeof tableRows)[number]) =>
          item.profile[row.axis].toFixed(6)
      },
      {
        key: `${item.id}-delta`,
        header: `${item.label} delta from reference`,
        render: (row: (typeof tableRows)[number]) =>
          formatSigned(
            item.profile[row.axis] - reference[row.axis],
            6
          )
      }
    ])
  ];

  return (
    <div className="profile-strata">
      <div className="strata-header" aria-hidden="true">
        <span>trait</span>
        <span>0</span>
        <span>reference</span>
        <span>1</span>
      </div>
      {AXES.map((axis) => (
        <div className="strata-row" key={axis}>
          <div className="strata-label">{axisLabels[axis]}</div>
          <div className="strata-track">
            <span
              className="reference-tick"
              style={{ left: `${reference[axis] * 100}%` }}
              title={`Reference ${reference[axis].toFixed(2)}`}
            />
            {profiles.map((item, index) => (
              <div
                className={`strata-bar tone-${item.tone}`}
                key={item.id}
                style={
                  {
                    "--bar-width": `${item.profile[axis] * 100}%`,
                    "--bar-row": index
                  } as React.CSSProperties
                }
              >
                <span className="sr-only">
                  {item.label}: {item.profile[axis].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="strata-values">
            {profiles.map((item) => (
              <span className={`tone-text-${item.tone}`} key={item.id}>
                {item.profile[axis].toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="strata-legend">
        {profiles.map((item) => (
          <span className={`tone-text-${item.tone}`} key={item.id}>
            <i className={`legend-mark tone-${item.tone}`} />
            {item.label}
          </span>
        ))}
        <span>
          <i className="legend-mark reference" />
          Evaluator reference
        </span>
      </div>
      <AccessibleDataTable
        caption="Final profile values and signed deltas from the declared evaluator reference."
        rows={tableRows}
        rowKey={(row) => row.axis}
        columns={tableColumns}
      />
    </div>
  );
}

interface ProvenanceBraidProps {
  replay: RepresentativeReplay;
}

export function ProvenanceBraid({ replay }: ProvenanceBraidProps) {
  const ids = useChartIds("provenance-braid");
  const actorBlindWorld = replay.worlds["actor-blind"];
  const receiptsByEventId = new Map(
    actorBlindWorld.receipts.map((receipt) => [receipt.eventId, receipt])
  );
  const links = replay.trace.events.map((event) => {
    const receipt = receiptsByEventId.get(event.id);
    if (!receipt) {
      throw new Error(
        `Missing actor-blind update receipt for trace event ${event.id}.`
      );
    }

    const dominantAxis = AXES.reduce((winner, axis) =>
      Math.abs(receipt.delta[axis]) >
      Math.abs(receipt.delta[winner])
        ? axis
        : winner
    );

    return {
      event,
      receipt,
      dominantAxis,
      delta: receipt.delta[dominantAxis]
    };
  });
  const maxAbsoluteDelta = Math.max(
    ...links.map((link) => Math.abs(link.delta)),
    Number.EPSILON
  );
  const width = 1000;
  const height = 660;
  const eventX = 286;
  const middleX = 570;
  const traitX = 826;
  const eventStartY = 56;
  const eventGap = 34;
  const traitStartY = 104;
  const traitGap = 120;

  return (
    <div className="braid-wrap">
      <svg
        className="provenance-braid"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
      >
        <title id={ids.titleId}>
          Actor-blind receipt links by dominant profile update
        </title>
        <desc id={ids.descriptionId}>
          {links.length} trace events are connected to the profile axis with
          the largest absolute delta in each matching actor-blind update
          receipt. Line width encodes absolute delta; solid lines are positive
          and dashed lines are negative. Event labels state the actual action
          and actual intent.
        </desc>
        <text x={20} y={24} className="svg-kicker">
          TRACE EVENT / ACTUAL INTENT
        </text>
        <text x={middleX} y={22} textAnchor="middle" className="svg-kicker">
          ACTOR-BLIND GATE
        </text>
        <text x={980} y={24} textAnchor="end" className="svg-kicker">
          DOMINANT PROFILE AXIS
        </text>

        {links.map((link, index) => {
          const eventY = eventStartY + index * eventGap;
          const traitIndex = AXES.indexOf(link.dominantAxis);
          const traitY = traitStartY + traitIndex * traitGap;
          const path = `M ${eventX + 7} ${eventY} C 390 ${eventY}, 430 ${traitY}, ${middleX} ${traitY} S 730 ${traitY}, ${traitX - 7} ${traitY}`;
          const strokeWidth =
            1.2 +
            (Math.abs(link.delta) / maxAbsoluteDelta) * 4.8;
          return (
            <g key={link.event.id}>
              <path
                d={path}
                className="braid-path"
                style={{
                  stroke: "var(--error)",
                  strokeDasharray:
                    link.delta < 0 ? "7 5" : undefined,
                  strokeOpacity: 0.72,
                  strokeWidth
                }}
              >
                <title>
                  {link.event.id}: {link.event.action}, actual intent{" "}
                  {link.event.actualIntent}; {axisLabels[link.dominantAxis]}{" "}
                  {formatSigned(link.delta, 6)}, effective weight{" "}
                  {link.receipt.effectiveWeight.toFixed(3)}, status{" "}
                  {link.receipt.status}
                </title>
              </path>
              <circle
                cx={eventX}
                cy={eventY}
                r={4}
                className="braid-node agent"
              />
              <text x={20} y={eventY + 4} className="svg-label">
                {String(link.event.step + 1).padStart(2, "0")}{" "}
                {link.event.action} · actual intent:{" "}
                {link.event.actualIntent}
              </text>
            </g>
          );
        })}

        <rect
          x={middleX - 72}
          y={287}
          width={144}
          height={76}
          rx={38}
          className="braid-gate"
        />
        <text
          x={middleX}
          y={316}
          textAnchor="middle"
          className="svg-gate-title"
        >
          actor-blind
        </text>
        <text
          x={middleX}
          y={335}
          textAnchor="middle"
          className="svg-gate-note"
        >
          agent → principal
        </text>

        {AXES.map((axis, index) => {
          const y = traitStartY + index * traitGap;
          return (
            <g key={axis}>
              <circle
                cx={traitX}
                cy={y}
                r={5}
                className="braid-node error"
              />
              <text
                x={traitX + 16}
                y={y + 4}
                className="svg-label"
              >
                {axisLabels[axis]}
              </text>
            </g>
          );
        })}
        <text x={20} y={646} className="svg-kicker">
          {links.length} MATCHED RECEIPTS · SOLID = POSITIVE DELTA · DASHED =
          NEGATIVE DELTA · WIDTH = ABSOLUTE DELTA
        </text>
      </svg>
      <div className="braid-mobile">
        <span>{links.length} matched trace events</span>
        <span aria-hidden="true">→</span>
        <span className="error-copy">Actor-blind attribution</span>
        <span aria-hidden="true">→</span>
        <span>Dominant signed profile deltas</span>
      </div>
      <AccessibleDataTable
        caption="Actor-blind trace-event and update-receipt ledger."
        rows={links}
        rowKey={(row) => row.event.id}
        columns={[
          {
            key: "event",
            header: "Event",
            render: (row) =>
              `${String(row.event.step + 1).padStart(2, "0")} ${row.event.action} (${row.event.id})`
          },
          {
            key: "actual-actor",
            header: "Actual actor",
            render: (row) => row.event.actor
          },
          {
            key: "recorded-actor",
            header: "Recorded actor",
            render: (row) => row.receipt.recordedActor
          },
          {
            key: "intent",
            header: "Actual / observed intent",
            render: (row) =>
              `${row.event.actualIntent} / ${row.event.observedIntent}`
          },
          {
            key: "axis",
            header: "Dominant axis",
            render: (row) => axisLabels[row.dominantAxis]
          },
          {
            key: "delta",
            header: "Signed delta",
            render: (row) => formatSigned(row.delta, 6)
          },
          {
            key: "weight",
            header: "Effective weight",
            render: (row) => row.receipt.effectiveWeight.toFixed(6)
          },
          {
            key: "status",
            header: "Status",
            render: (row) => row.receipt.status
          }
        ]}
      />
    </div>
  );
}
