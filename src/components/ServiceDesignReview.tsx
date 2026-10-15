import "./service-design-review.css";

type EvidenceStatus = "OBS" | "IMPL" | "PROP" | "UNMEASURED";

type BlueprintCell = {
  text: string;
  status: EvidenceStatus;
};

type BlueprintRow = {
  label: string;
  meta: string;
  tone: "principal" | "agent" | "surface" | "local" | "platform" | "support";
  cells: readonly BlueprintCell[];
};

const bp = (text: string, status: EvidenceStatus): BlueprintCell => ({ text, status });

const stages = [
  ["PRE", "Delegate"],
  ["T0", "Task start"],
  ["T1", "Task in progress"],
  ["A1", "Agent action"],
  ["T2", "Outcome + gate"],
  ["T3", "Next task"]
] as const;

const blueprintRows: readonly BlueprintRow[] = [
  {
    label: "Human principal",
    meta: "commissioning actor / not studied",
    tone: "principal",
    cells: [
      bp("Provides a temporary task brief", "PROP"),
      bp("May review learning scope", "PROP"),
      bp("May inspect task progress", "PROP"),
      bp("Receives selected item or abandonment", "PROP"),
      bp("Reviews outcome claim; confirms or overrides", "PROP"),
      bp("May inspect or correct the source trace", "PROP")
    ]
  },
  {
    label: "Agent operations",
    meta: "operational client",
    tone: "agent",
    cells: [
      bp("Receives task and activation policy", "IMPL"),
      bp("Opens the task session", "IMPL"),
      bp("Issues search, open, and compare calls", "OBS"),
      bp("Emits selected item or abandon", "OBS"),
      bp("Submits outcome claim; receives pending state", "IMPL"),
      bp("Receives ordered candidates at T3", "OBS")
    ]
  },
  {
    label: "Agent-facing touchpoints",
    meta: "frontstage service",
    tone: "surface",
    cells: [
      bp("Scope summary", "PROP"),
      bp("Task and learning-status panel", "PROP"),
      bp("Candidates and task-local help", "IMPL"),
      bp("Recommendation shelf", "IMPL"),
      bp("Resolution receipt", "PROP"),
      bp("Source explanation and correction", "PROP")
    ]
  },
  {
    label: "Task-local orchestration",
    meta: "backstage support",
    tone: "local",
    cells: [
      bp("Load tools and task scope", "IMPL"),
      bp("Open temporary workspace", "IMPL"),
      bp("Maintain current-task context", "IMPL"),
      bp("Freeze the resolved action", "IMPL"),
      bp("Hold until resolution; clear after receipt", "IMPL"),
      bp("Open a clean task context", "IMPL")
    ]
  },
  {
    label: "Event eligibility / learning",
    meta: "backstage routing",
    tone: "platform",
    cells: [
      bp("Load the activation contract", "IMPL"),
      bp("Route log, hold, or immediate", "IMPL"),
      bp("Immediate arm may rerank", "OBS"),
      bp("Register action and eligibility", "IMPL"),
      bp("Confirm, override, or timeout-discard", "IMPL"),
      bp("Rank from resulting context", "OBS")
    ]
  },
  {
    label: "Support data",
    meta: "ledger / buffers / context",
    tone: "support",
    cells: [
      bp("Policy configuration", "IMPL"),
      bp("Audit ledger and pending buffer", "IMPL"),
      bp("Task-local state and ranking context", "IMPL"),
      bp("Action event and eligibility record", "IMPL"),
      bp("Outcome claim, deadline, resolver, and receipt", "IMPL"),
      bp("Source link across one measured cycle", "OBS")
    ]
  }
];

const lifecycleStates = [
  { text: "no task evidence", tone: "empty" },
  { text: "task-local", tone: "local" },
  { text: "logged / held / active", tone: "mixed" },
  { text: "selected / abandoned", tone: "neutral" },
  { text: "committed / discarded / removed", tone: "mixed" },
  { text: "source-linked later shelf", tone: "active" }
] as const;

const resolutionPaths = [
  {
    trigger: "Completed claim",
    reporter: "Agent reports selected item + task completion",
    authority: "Principal confirms, or a predeclared contract resolves",
    transition: "PENDING → COMMIT SELECTED",
    response: "Committed receipt with source trace and resolver"
  },
  {
    trigger: "Abandoned claim",
    reporter: "Agent reports no resolved purchase action",
    authority: "Principal confirms, or a predeclared contract resolves",
    transition: "PENDING → DISCARD TASK EVIDENCE",
    response: "Discarded receipt; no event becomes rank-eligible"
  },
  {
    trigger: "Ambiguous / conflict / no response",
    reporter: "Agent claim and principal response are missing or disagree",
    authority: "Principal may override before the contract deadline",
    transition: "REMAIN HELD → AUTO-DISCARD AT DEADLINE",
    response: "Timeout receipt with reason and allowed retry"
  },
  {
    trigger: "Writeback failure / later correction",
    reporter: "Platform check or source-linked correction request",
    authority: "Service operations resolve; principal may request correction",
    transition: "RETRY IDEMPOTENTLY → REVERT OR MARK CORRECTED",
    response: "Recovery receipt; prior exposure remains disclosed"
  }
] as const;

const decisionRows = [
  {
    observation: "No-state and logged-inert produced the same rankings and traces.",
    status: "OBSERVED",
    source: "POLICY ABLATION / FIXED TRACE",
    risk: "If record state and ranking eligibility share one indicator, the interface does not distinguish them.",
    requirement: "Separate record state from ranking eligibility.",
    response: "Two-field status + evidence receipt",
    validation: "Mechanism tested · interface untested"
  },
  {
    observation: "Immediate versus held changed the in-task shelf under a fixed trace.",
    status: "OBSERVED",
    source: "FIXED-TRACE SHELF COMPARISON",
    risk: "Removal after failure can occur after exposure.",
    requirement: "Place the control before activation, not after deletion.",
    response: "Outcome gate + pending evidence tray",
    validation: "Shelf effect measured"
  },
  {
    observation: "Holding preserved the frozen current-task quality surrogate.",
    status: "OBSERVED",
    source: "TASK-LOCAL QUALITY SURROGATE",
    risk: "Controls that also disable task-local retrieval change a second system variable.",
    requirement: "Keep task-local retrieval independent from platform learning.",
    response: "Task-local memory remains on while learning is held",
    validation: "Surrogate only · not human utility"
  },
  {
    observation: "A changed agent selection produced a changed next shelf and, sometimes, later action.",
    status: "OBSERVED",
    source: "ONE-CYCLE FEEDBACK ENDPOINT",
    risk: "Selected-event writeback can change the next learned slate.",
    requirement: "Retain source links across one measured feedback cycle.",
    response: "Later-shelf provenance + correction entry",
    validation: "One cycle measured · correction proposed"
  }
] as const;

function Node({
  x,
  y,
  width,
  title,
  subtitle,
  tone = "neutral",
  status = "IMPL"
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  subtitle: string;
  tone?: "neutral" | "agent" | "local" | "active" | "gate" | "audit";
  status?: EvidenceStatus;
}) {
  return (
    <g className={`sd-system-node sd-system-node--${tone}`}>
      <rect height="76" rx="2" width={width} x={x} y={y} />
      <text className="sd-system-node__status" textAnchor="end" x={x + width - 12} y={y + 16}>
        {status}
      </text>
      <text className="sd-system-node__title" x={x + 16} y={y + 28}>
        {title}
      </text>
      <text className="sd-system-node__subtitle" x={x + 16} y={y + 51}>
        {subtitle}
      </text>
    </g>
  );
}

function ServiceSystemMap() {
  return (
    <div className="sd-system-map" role="img" tabIndex={0} aria-label="Event eligibility architecture showing an agent action routed to task-local state, an inert audit ledger, immediate ranking context, or a pending buffer. The agent reports an outcome claim. The outcome gate holds it for resolution, then can commit held evidence, remove provisionally active events, or discard held evidence before activation. Ranking context feeds a recommender, and a next-task shelf returns to the agent at T3.">
      <svg viewBox="0 0 1180 720">
        <defs>
          <marker id="arrow-neutral" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
          <marker id="arrow-local" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path className="is-local" d="M0,0 L8,4 L0,8 Z" />
          </marker>
          <marker id="arrow-active" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path className="is-active" d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>

        <text className="sd-map-zone" x="32" y="36">ACTORS + AGENT-FACING SERVICE</text>
        <text className="sd-map-zone" x="32" y="216">EVENT ROUTING + LEARNING STATE</text>
        <line className="sd-map-divider" x1="32" x2="1148" y1="194" y2="194" />

        <path className="sd-edge" d="M254 118 H328" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="276" y="106">brief</text>
        <path className="sd-edge sd-edge--local" d="M518 108 H608" markerEnd="url(#arrow-local)" />
        <text className="sd-edge-label" x="544" y="96">tool call</text>
        <path className="sd-edge" d="M608 132 H518" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="542" y="150">candidates</text>
        <path className="sd-edge" d="M798 132 H898" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="818" y="150">rank request</text>
        <path className="sd-edge sd-edge--active" d="M898 108 H798" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="822" y="96">ranked shelf</text>

        <path className="sd-edge" d="M450 156 V240" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="464" y="208">action event</text>
        <path className="sd-edge" d="M500 80 V54 H1110 V428 H1088" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="824" y="46">T2 outcome claim / reporter = agent</text>
        <path className="sd-edge sd-edge--local" d="M348 316 V338 H133 V390" markerEnd="url(#arrow-local)" />
        <text className="sd-edge-label" x="78" y="328">task-local</text>
        <path className="sd-edge sd-edge--audit" d="M398 316 V352 H343 V390" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="270" y="344">logged inert</text>
        <path className="sd-edge sd-edge--active" d="M458 316 V366 H568 V390" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="520" y="356">immediate</text>
        <path className="sd-edge sd-edge--local" d="M528 316 V338 H783 V390" markerEnd="url(#arrow-local)" />
        <text className="sd-edge-label" x="694" y="328">held</text>

        <path className="sd-edge sd-edge--local" d="M868 428 H908" markerEnd="url(#arrow-local)" />
        <text className="sd-edge-label" x="881" y="416">T2</text>
        <path className="sd-edge sd-edge--active" d="M948 466 V492 H548 V466" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="680" y="486">commit selected event</text>
        <path className="sd-edge sd-edge--active" d="M998 466 V516 H598 V466" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="690" y="510">remove provisional task events</text>
        <path className="sd-edge sd-edge--audit" d="M1048 466 V540 H343 V466" markerEnd="url(#arrow-neutral)" />
        <text className="sd-edge-label" x="720" y="534">discard before activation</text>

        <path className="sd-edge sd-edge--active" d="M568 390 V180 H993 V156" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="716" y="172">ranking context</text>
        <path className="sd-edge sd-edge--active" d="M1088 120 H1144 V612 H798" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="938" y="602">T3 next-task shelf</text>
        <path className="sd-edge sd-edge--active" d="M608 612 H24 V184 H396 V156" markerEnd="url(#arrow-active)" />
        <text className="sd-edge-label" x="74" y="174">T3 ordered candidates</text>

        <Node x={48} y={80} width={206} title="Human principal" subtitle="commissioning role" status="UNMEASURED" />
        <Node x={328} y={80} width={190} title="Agent operations" subtitle="operational client" tone="agent" status="OBS" />
        <Node x={608} y={80} width={190} title="Marketplace surface" subtitle="agent-facing candidates" status="IMPL" />
        <Node x={898} y={80} width={190} title="Recommender" subtitle="orders the shelf" status="IMPL" />

        <Node x={328} y={240} width={220} title="Event / eligibility router" subtitle="drop · audit · activate · hold" status="IMPL" />
        <Node x={48} y={390} width={170} title="Task-local state" subtitle="current task only" tone="local" status="IMPL" />
        <Node x={258} y={390} width={170} title="Audit ledger" subtitle="recorded, rank-inert" tone="audit" status="IMPL" />
        <Node x={478} y={390} width={180} title="Ranking context" subtitle="recommender input" tone="active" status="IMPL" />
        <Node x={698} y={390} width={170} title="Pending buffer" subtitle="held before outcome" tone="local" status="IMPL" />
        <Node x={908} y={390} width={180} title="Outcome gate" subtitle="hold · resolve · receipt" tone="gate" status="IMPL" />
        <Node x={608} y={574} width={190} title="Next-task shelf" subtitle="one measured later cycle" tone="active" status="OBS" />

        <g className="sd-map-legend" transform="translate(48 690)">
          <line className="sd-edge sd-edge--local" x1="0" x2="44" y1="0" y2="0" />
          <text x="56" y="5">task-local / held</text>
          <line className="sd-edge sd-edge--active" x1="210" x2="254" y1="0" y2="0" />
          <text x="266" y="5">ranking-active</text>
          <line className="sd-edge sd-edge--audit" x1="440" x2="484" y1="0" y2="0" />
          <text x="496" y="5">audit / inert</text>
          <text x="736" y="5">NODE BADGE = EVIDENCE MATURITY</text>
        </g>
      </svg>
    </div>
  );
}

export function ServiceDesignReview() {
  return (
    <main className="sd-review">
      <header className="sd-review__hero">
        <div className="sd-review__hero-copy">
          <span className="sd-kicker">SERVICE DESIGN / CASE APPENDIX</span>
          <h1>Design the boundary<br />between <em>acting</em> and <em>learning.</em></h1>
          <p>
            A service model that treats the shopping agent as the operational user,
            the human as commissioning principal, and recommendation as an environment
            that can learn from the agent while the task is still unfolding.
          </p>
        </div>
        <div className="sd-review__hero-meta">
          <div><span>PERSPECTIVE</span><strong>Agent-computer interaction</strong></div>
          <div><span>GROUNDING</span><strong>Observed mechanism + proposed service layer</strong></div>
          <div><span>BOUNDARY</span><strong>No participant claims</strong></div>
        </div>
        <a className="sd-back-link" href="./#evidence">← Back to case study</a>
      </header>

      <section className="sd-plate sd-plate--dark">
        <header className="sd-plate__header">
          <div><span className="sd-index">01</span><span className="sd-kicker">EVENT ELIGIBILITY ARCHITECTURE</span></div>
          <h2>Who acts,<br />who learns?</h2>
          <p>
            The agent is the operational user of the marketplace. The principal
            commissions the work. An eligibility router determines whether an
            action remains local, stays audit-only, activates immediately, or waits.
          </p>
        </header>
        <p className="sd-scroll-hint">Swipe to inspect system paths →</p>
        <ServiceSystemMap />
        <footer className="sd-plate__note">
          <strong>Reading rule</strong>
          <span>Color encodes event lifecycle: blue is task-local or held; red is ranking-active; dashed is audit-only. Node badges encode evidence maturity.</span>
        </footer>
      </section>

      <section className="sd-plate sd-plate--paper">
        <header className="sd-plate__header">
          <div><span className="sd-index">02</span><span className="sd-kicker">FUTURE-STATE SERVICE BLUEPRINT</span></div>
          <h2>The task ends once.<br />Its evidence changes state several times.</h2>
          <p>
            PRE is delegation. T0–T3 retain the exact experimental checkpoints;
            the activation gate is a state transition inside T2, not another timepoint.
          </p>
        </header>

        <p className="sd-scroll-hint">Swipe to inspect stages →</p>
        <div className="sd-blueprint-wrap" role="region" aria-label="Future-state service blueprint; scroll horizontally to inspect stages" tabIndex={0}>
          <div className="sd-blueprint">
            <div className="sd-blueprint__corner"><span>LANE</span><small>responsibility</small></div>
            {stages.map(([code, label]) => (
              <div className="sd-blueprint__stage" key={code}><span>{code}</span><strong>{label}</strong></div>
            ))}
            {blueprintRows.map((row, rowIndex) => (
              <div className="sd-blueprint__row" key={row.label}>
                <div className={`sd-blueprint__label is-${row.tone}`}>
                  <strong>{row.label}</strong><span>{row.meta}</span>
                </div>
                {row.cells.map((cell, index) => (
                  <div className={`sd-blueprint__cell is-${row.tone}`} key={`${row.label}-${index}`}>
                    <span>{cell.text}</span>
                    <small className={`sd-cell-status is-status-${cell.status.toLowerCase()}`}>{cell.status}</small>
                  </div>
                ))}
                {rowIndex === 2 && <div className="sd-blueprint__line"><span>LINE OF VISIBILITY</span></div>}
                {rowIndex === 4 && <div className="sd-blueprint__line sd-blueprint__line--internal"><span>PLATFORM ACTIVATION BOUNDARY</span></div>}
              </div>
            ))}
          </div>
          <div className="sd-lifecycle-band" aria-label="Evidence lifecycle by experimental checkpoint">
            <div className="sd-lifecycle-band__label"><span>EVIDENCE</span><strong>lifecycle state</strong></div>
            {lifecycleStates.map((state) => (
              <div key={state.text}><i className={`is-${state.tone}`} /><span>{state.text}</span></div>
            ))}
          </div>
        </div>

        <div className="sd-policy-compare">
          <div><span>NO MEMORY</span><i className="is-empty" /><small>Nothing enters platform context</small></div>
          <div><span>LOGGED / INERT</span><i className="is-audit" /><small>Auditable, never rank-eligible</small></div>
          <div><span>IMMEDIATE / REMOVE</span><i className="is-active" /><small>Active before outcome; removed later</small></div>
          <div><span>HELD / OUTCOME</span><i className="is-held" /><small>Commit or discard at the gate</small></div>
        </div>
      </section>

      <section className="sd-plate sd-plate--blue">
        <header className="sd-plate__header">
          <div><span className="sd-index">03</span><span className="sd-kicker">OUTCOME GATE / AUTHORITY + RECOVERY</span></div>
          <h2>The agent reports.<br />The service resolves.</h2>
          <p>
            The simulator replays a resolved outcome; it does not imply that its
            outcome button is the live authority. This proposed service contract
            names the reporter, resolver, fallback, and recovery owner.
          </p>
        </header>

        <div className="sd-recovery-authority" aria-label="Outcome gate ownership">
          <div><span>REPORTER</span><strong>Agent submits a claim</strong></div>
          <div><span>DEFAULT STATE</span><strong>Evidence remains held</strong></div>
          <div><span>RESOLUTION AUTHORITY</span><strong>Principal or predeclared contract</strong></div>
          <div><span>FALLBACK</span><strong>Auto-discard at deadline</strong></div>
          <div><span>RECOVERY OWNER</span><strong>Service operations</strong></div>
        </div>

        <div className="sd-recovery-grid">
          {resolutionPaths.map((item, index) => (
            <article className="sd-recovery-card" key={item.trigger}>
              <header><span>{String(index + 1).padStart(2, "0")}</span><small>{item.trigger}</small></header>
              <dl>
                <div><dt>REPORT</dt><dd>{item.reporter}</dd></div>
                <div><dt>AUTHORITY</dt><dd>{item.authority}</dd></div>
                <div><dt>STATE TRANSITION</dt><dd>{item.transition}</dd></div>
                <div><dt>AGENT-VISIBLE RESPONSE</dt><dd>{item.response}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="sd-recovery-boundary">PROPOSED SERVICE LOGIC · EXPERIMENTS TEST ELIGIBILITY TIMING, NOT HUMAN COMPREHENSION OR OPERATIONAL SLA</p>
      </section>

      <section className="sd-plate sd-plate--paper sd-plate--matrix">
        <header className="sd-plate__header">
          <div><span className="sd-index">04</span><span className="sd-kicker">EVIDENCE → DESIGN</span></div>
          <h2>Every interface response<br />starts from an observed constraint.</h2>
          <p>
            The final column prevents implemented mechanisms from being presented
            as validated consent, comprehension, control, or human utility.
          </p>
        </header>

        <div className="sd-matrix-wrap">
          <div className="sd-decision-matrix">
            <div className="sd-decision-matrix__head"><span>Experimental observation</span><span>Hypothesized service risk</span><span>Design requirement</span><span>Interface response</span><span>Validation status</span></div>
            {decisionRows.map((row, index) => (
              <article key={row.observation}>
                <div><small>{String(index + 1).padStart(2, "0")} / {row.status}</small><strong>{row.observation}</strong><em>{row.source}</em></div>
                <p className="sd-matrix-risk">{row.risk}</p>
                <p className="sd-matrix-requirement">{row.requirement}</p>
                <p className="sd-matrix-response">{row.response}</p>
                <p className="sd-decision-matrix__validation">{row.validation}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="sd-review__footer">
        <span>THE AGENT BECAME ME</span>
        <p>Service-design appendix · linked from the portfolio case study.</p>
        <span>ACI / SERVICE DESIGN</span>
      </footer>
    </main>
  );
}
