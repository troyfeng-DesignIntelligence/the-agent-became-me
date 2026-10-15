import { useMemo, useState } from "react";
import type { CrossTaskExposureSummary } from "../data";
import {
  CROSS_TASK_SCENARIOS,
  simulateCrossTaskExposure,
  type CrossTaskOutcome,
  type ExposureSnapshot
} from "../amazon/cross-task-exposure";

type ServiceArm = "immediate" | "held";

const armCopy: Record<
  ServiceArm,
  { index: string; label: string; rule: string; condition: "rollback-on-failure" | "outcome-quarantine" }
> = {
  immediate: {
    index: "A",
    label: "Write now, remove later",
    rule: "The action becomes ranking input before the task result is known.",
    condition: "rollback-on-failure"
  },
  held: {
    index: "B",
    label: "Hold before outcome",
    rule: "The action remains task-local until the task result is known.",
    condition: "outcome-quarantine"
  }
};

interface CrossTaskControlLabProps {
  summary: CrossTaskExposureSummary;
}

function stateForArm(
  arm: ServiceArm,
  afterOutcome: boolean,
  outcome: CrossTaskOutcome
) {
  if (!afterOutcome) {
    return arm === "immediate"
      ? { label: "ACTIVE", detail: "Eligible for ranking now", tone: "active" }
      : { label: "HELD", detail: "Not eligible for ranking", tone: "held" };
  }
  if (outcome === "completed") {
    return {
      label: arm === "immediate" ? "RETAINED" : "COMMITTED",
      detail: "Eligible for later ranking",
      tone: "active"
    };
  }
  return arm === "immediate"
    ? {
        label: "REMOVED",
        detail: "Deleted after provisional exposure",
        tone: "removed"
      }
    : {
        label: "DISCARDED",
        detail: "Never entered ranking input",
        tone: "discarded"
      };
}

function Surface({
  arm,
  snapshot,
  comparison,
  temporaryTopic
}: {
  arm: ServiceArm;
  snapshot: ExposureSnapshot;
  comparison: ExposureSnapshot;
  temporaryTopic: string;
}) {
  return (
    <div className="activation-gate-surface">
      <header>
        <span>AGENT-FACING SHELF</span>
        <output>
          {snapshot.temporaryTopicExposure} / 6 task-topic slots
        </output>
      </header>
      <div className="activation-gate-items">
        {snapshot.recommendations.map((item, index) => {
          const isTemporary = item.topic === temporaryTopic;
          const shifted = item.id !== comparison.recommendations[index]?.id;
          return (
            <div
              className={`activation-gate-item ${isTemporary ? "is-task" : "is-other"} ${shifted ? "is-shifted" : ""}`}
              key={`${arm}-${item.id}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <small>{isTemporary ? "task match" : "profile fallback"}{shifted ? " · position changed" : ""}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CrossTaskControlLab({ summary }: CrossTaskControlLabProps) {
  const [scenarioId, setScenarioId] = useState(CROSS_TASK_SCENARIOS[0].id);
  const [outcome, setOutcome] = useState<CrossTaskOutcome>("abandoned");
  const [timelineIndex, setTimelineIndex] = useState(3);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const scenario =
    CROSS_TASK_SCENARIOS.find((item) => item.id === scenarioId) ??
    CROSS_TASK_SCENARIOS[0];

  const runs = useMemo(
    () => ({
      immediate: simulateCrossTaskExposure(
        scenario,
        armCopy.immediate.condition,
        8,
        outcome
      ),
      held: simulateCrossTaskExposure(
        scenario,
        armCopy.held.condition,
        8,
        outcome
      )
    }),
    [outcome, scenario]
  );

  const snapshots = {
    immediate: runs.immediate.snapshots[timelineIndex] ?? runs.immediate.snapshots[0],
    held: runs.held.snapshots[timelineIndex] ?? runs.held.snapshots[0]
  };
  const afterOutcome = snapshots.immediate.phase === "follow-up";
  const changedPositions = snapshots.immediate.recommendations.filter(
    (item, index) => item.id !== snapshots.held.recommendations[index]?.id
  ).length;
  const immediateState = stateForArm("immediate", afterOutcome, outcome);
  const heldState = stateForArm("held", afterOutcome, outcome);
  const immediateAggregate = summary.conditions.find(
    (row) => row.condition === armCopy.immediate.condition
  );
  const heldAggregate = summary.conditions.find(
    (row) => row.condition === armCopy.held.condition
  );
  const stepLabel = afterOutcome
    ? `Next-task shelf ${snapshots.immediate.round} / 8`
    : `Delegated-task action ${snapshots.immediate.round} / 4`;
  const readoutText =
    afterOutcome && outcome === "abandoned"
      ? "Both policies now produce the same clean state. Only one had already made the provisional action eligible for ranking."
      : afterOutcome
        ? "The completed outcome admits the held action. Both paths now make it eligible for later ranking."
        : `${changedPositions} of 6 shelf positions differ while the task is still unresolved. The agent action is identical; only eligibility timing changed.`;

  return (
    <section
      aria-labelledby="activation-gate-title"
      className={`cross-task-control-lab activation-gate-lab ${showMobileDetails ? "is-mobile-details-open" : ""}`}
    >
      <h3 className="sr-only" id="activation-gate-title">Outcome-gate eligibility replay</h3>
      <div className="activation-gate-controls">
        <label>
          <span>DELEGATED BRIEF</span>
          <select
            aria-label="Temporary delegated task"
            onChange={(event) => {
              setScenarioId(event.target.value);
              setTimelineIndex(3);
              setShowMobileDetails(false);
            }}
            value={scenario.id}
          >
            {CROSS_TASK_SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div aria-label="Outcome to replay" className="activation-gate-outcome" role="group">
          <span>OUTCOME TO REPLAY</span>
          {(["abandoned", "completed"] as const).map((value) => (
            <button
              aria-pressed={outcome === value}
              key={value}
              onClick={() => setOutcome(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="activation-gate-authority" aria-label="Proposed outcome resolution authority">
        <span className="mono-label">PROPOSED SERVICE AUTHORITY</span>
        <dl>
          <div><dt>REPORTER</dt><dd>Agent submits an outcome claim</dd></div>
          <div><dt>RESOLVER</dt><dd>Principal confirms or overrides</dd></div>
          <div><dt>NO RESPONSE</dt><dd>Contract discards at deadline</dd></div>
          <div><dt>RECOVERY</dt><dd>Service ops issue a source-linked receipt</dd></div>
        </dl>
      </div>

      <div className="activation-gate-trace">
        <div>
          <span className="mono-label">SHARED INPUT / SAME AGENT TRACE</span>
          <strong>{scenario.temporaryBrief}</strong>
        </div>
        <ol aria-label="Service timeline">
          {["SEARCH", "VIEW", "VIEW", "ADD TO CART"].map((label, index) => (
            <li
              aria-current={timelineIndex === index ? "step" : undefined}
              className={timelineIndex === index ? "is-current" : ""}
              key={`${label}-${index}`}
            >
              <span>A{index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
          <li
            aria-current={timelineIndex === 4 ? "step" : undefined}
            className={`is-gate ${timelineIndex === 4 ? "is-current" : ""}`}
          >
            <span>T2</span>
            <small>OUTCOME GATE</small>
          </li>
          <li
            aria-current={timelineIndex > 4 ? "step" : undefined}
            className={timelineIndex > 4 ? "is-current" : ""}
          >
            <span>T3</span>
            <small>NEXT TASK</small>
          </li>
        </ol>
      </div>

      <div className="activation-gate-timeline">
        <div>
          <span>{stepLabel}</span>
          <span>Drag across T2 to compare the same action before and after resolution</span>
        </div>
        <input
          aria-label="Cross-task timeline"
          aria-valuetext={stepLabel}
          max={runs.immediate.snapshots.length - 1}
          min={0}
          onChange={(event) => setTimelineIndex(Number(event.target.value))}
          style={
            {
              "--cross-task-progress": `${
                (timelineIndex / Math.max(1, runs.immediate.snapshots.length - 1)) * 100
              }%`,
              "--cross-task-boundary": `${
                ((4 - 0.5) / (runs.immediate.snapshots.length - 1)) * 100
              }%`
            } as React.CSSProperties
          }
          type="range"
          value={timelineIndex}
        />
        <div className="activation-gate-ticks" aria-hidden="true">
          <span>A1</span><span>A2</span><span>A3</span><span>A4</span><span>T2</span><span>T3 × 8</span>
        </div>
        <div className="activation-gate-mobile-summary">
          <div><span>A / WRITE NOW</span><strong>{immediateState.label}</strong><small>{snapshots.immediate.temporaryTopicExposure}/6 task slots</small></div>
          <div><span>B / HOLD</span><strong>{heldState.label}</strong><small>{snapshots.held.temporaryTopicExposure}/6 task slots</small></div>
          <p>{changedPositions}/6 shelf positions differ</p>
          <button
            aria-expanded={showMobileDetails}
            onClick={() => setShowMobileDetails((current) => !current)}
            type="button"
          >
            {showMobileDetails ? "Hide full shelves" : "Inspect both shelves"}
          </button>
        </div>
      </div>

      <div className="activation-gate-blueprint" aria-label="Paired service blueprint">
        {(["immediate", "held"] as const).map((arm) => {
          const copy = armCopy[arm];
          const state = arm === "immediate" ? immediateState : heldState;
          const snapshot = snapshots[arm];
          const profileMass = snapshot.profile[scenario.temporaryTopic];
          return (
            <article className={`activation-gate-arm is-${arm}`} key={arm}>
              <header>
                <span>{copy.index} / SERVICE POLICY</span>
                <h4>{copy.label}</h4>
                <p>{copy.rule}</p>
              </header>
              <dl className="activation-gate-state-grid">
                <div>
                  <dt>TASK MEMORY</dt>
                  <dd>{afterOutcome ? "CLOSED" : "IN USE"}</dd>
                  <small>Agent can finish the current task</small>
                </div>
                <div>
                  <dt>AUDIT LOG</dt>
                  <dd>RECORDED</dd>
                  <small>Action remains reviewable</small>
                </div>
                <div className={`is-${state.tone}`}>
                  <dt>RANKING INPUT</dt>
                  <dd>{state.label}</dd>
                  <small>{state.detail}</small>
                </div>
              </dl>
              <Surface
                arm={arm}
                snapshot={snapshot}
                comparison={snapshots[arm === "immediate" ? "held" : "immediate"]}
                temporaryTopic={scenario.temporaryTopic}
              />
              <footer>
                <div>
                  <span>PROFILE MASS</span>
                  <strong>{profileMass.toFixed(2)}</strong>
                </div>
                <div>
                  <span>RANKING STATE</span>
                  <strong>{state.label}</strong>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      <div className="activation-gate-readout">
        <span className="sr-only" role="status">{readoutText}</span>
        <span className="mono-label">WHAT CHANGED AT THIS CHECKPOINT</span>
        <p>{readoutText}</p>
        <div>
          <span>FROZEN AGGREGATE / {immediateAggregate?.runCount ?? 200} RUNS PER POLICY</span>
          <strong>
            +{summary.observedComparisons.rollbackVsQuarantineProvisionalExposureDifference.toFixed(2)}
          </strong>
          <small>mean provisional excess slots for write-now versus hold</small>
          <em>
            Later slots after abandonment: {immediateAggregate?.meanPostTaskExposureCount.toFixed(0) ?? "0"} / {heldAggregate?.meanPostTaskExposureCount.toFixed(0) ?? "0"}
          </em>
        </div>
      </div>

      <p className="cross-task-prototype-boundary">
        Executable design prototype, not participant evidence. The paired replay uses
        the same frozen scenario, catalog seed, agent actions, and outcome; only the
        event-eligibility rule changes. Aggregate values come from the controlled
        synthetic experiment.
      </p>
    </section>
  );
}
