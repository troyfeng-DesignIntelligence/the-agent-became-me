import { AXES, type Axis, type ProfileVector } from "../domain/schema";
import type { RepresentativeReplay } from "../data";

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
    note: "A task choice is read as identity."
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
    tone: "error" | "provenance" | "negotiated";
  }>;
}

export function ProfileStrata({
  reference,
  profiles
}: ProfileStrataProps) {
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
          Latent reference
        </span>
      </div>
    </div>
  );
}

interface ProvenanceBraidProps {
  replay: RepresentativeReplay;
}

export function ProvenanceBraid({ replay }: ProvenanceBraidProps) {
  const events = replay.trace.events.slice(0, 7);
  const traits: Axis[] = [
    "nutrition",
    "sustainability",
    "plantBased",
    "lowProcessing",
    "indulgence"
  ];
  const width = 920;
  const height = 330;
  const leftX = 72;
  const middleX = 460;
  const rightX = 850;

  return (
    <div className="braid-wrap">
      <svg
        className="provenance-braid"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="braid-title braid-desc"
      >
        <title id="braid-title">Trace-to-trait provenance braid</title>
        <desc id="braid-desc">
          Agent exploration events connect through an attribution rule to five
          profile traits. Broken red paths indicate actor-blind attribution.
        </desc>
        <text x={leftX} y={22} className="svg-kicker">
          AGENT EVENTS
        </text>
        <text x={middleX} y={22} textAnchor="middle" className="svg-kicker">
          ATTRIBUTION LAYER
        </text>
        <text x={rightX} y={22} textAnchor="end" className="svg-kicker">
          PROFILE TRAITS
        </text>

        {events.map((event, index) => {
          const y = 58 + index * 38;
          const target = 58 + (index % traits.length) * 52;
          const path = `M ${leftX + 12} ${y} C 275 ${y}, 326 ${target}, ${middleX} ${target} S 700 ${target}, ${rightX - 12} ${target}`;
          return (
            <g key={event.id}>
              <path
                d={path}
                className={`braid-path${index % 3 === 0 ? " is-broken" : ""}`}
              />
              <circle cx={leftX} cy={y} r={5} className="braid-node agent" />
              <text x={leftX + 16} y={y + 4} className="svg-label">
                {event.action} / {event.actualIntent}
              </text>
            </g>
          );
        })}

        <rect
          x={middleX - 72}
          y={122}
          width={144}
          height={76}
          rx={38}
          className="braid-gate"
        />
        <text x={middleX} y={151} textAnchor="middle" className="svg-gate-title">
          actor-blind
        </text>
        <text x={middleX} y={170} textAnchor="middle" className="svg-gate-note">
          agent → principal
        </text>

        {traits.map((axis, index) => {
          const y = 58 + index * 52;
          return (
            <g key={axis}>
              <circle cx={rightX} cy={y} r={5} className="braid-node error" />
              <text
                x={rightX - 16}
                y={y + 4}
                textAnchor="end"
                className="svg-label"
              >
                {axisLabels[axis]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="braid-mobile">
        <span>Agent exploration</span>
        <span aria-hidden="true">→</span>
        <span className="error-copy">Recorded as “you”</span>
        <span aria-hidden="true">→</span>
        <span>Persistent profile</span>
      </div>
    </div>
  );
}

