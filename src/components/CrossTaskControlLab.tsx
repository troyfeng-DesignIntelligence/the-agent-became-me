import { useMemo, useState } from "react";
import type { CrossTaskExposureSummary } from "../data";
import {
  CROSS_TASK_SCENARIOS,
  simulateCrossTaskExposure,
  type CrossTaskOutcome
} from "../amazon/cross-task-exposure";
import type { AmazonLifecycleCondition } from "../amazon/field-lifecycle";

const CONTROL_CONDITIONS = [
  "persist-all",
  "intent-weighted",
  "outcome-quarantine",
  "rollback-on-failure",
  "scope-gated"
] as const satisfies readonly AmazonLifecycleCondition[];

const conditionCopy: Record<
  (typeof CONTROL_CONDITIONS)[number],
  { label: string; short: string; description: string }
> = {
  "persist-all": {
    label: "Learn now",
    short: "NOW",
    description: "Every exploratory action can immediately shape recommendations."
  },
  "intent-weighted": {
    label: "Reduce exploration",
    short: "SOFT",
    description: "Searches and views count less, but can still cross task boundaries."
  },
  "outcome-quarantine": {
    label: "Hold until outcome",
    short: "HOLD",
    description: "Evidence stays outside the profile until the task result is known."
  },
  "rollback-on-failure": {
    label: "Undo on failure",
    short: "UNDO",
    description: "Evidence applies immediately, then is removed if the task is abandoned."
  },
  "scope-gated": {
    label: "Purchase only",
    short: "BUY",
    description: "Only an explicit completed purchase can update the profile."
  }
};

interface CrossTaskControlLabProps {
  summary: CrossTaskExposureSummary;
}

export function CrossTaskControlLab({ summary }: CrossTaskControlLabProps) {
  const [scenarioId, setScenarioId] = useState(CROSS_TASK_SCENARIOS[0].id);
  const [condition, setCondition] =
    useState<(typeof CONTROL_CONDITIONS)[number]>("persist-all");
  const [outcome, setOutcome] = useState<CrossTaskOutcome>("abandoned");
  const [timelineIndex, setTimelineIndex] = useState(3);
  const scenario =
    CROSS_TASK_SCENARIOS.find((item) => item.id === scenarioId) ??
    CROSS_TASK_SCENARIOS[0];
  const run = useMemo(
    () => simulateCrossTaskExposure(scenario, condition, 17, outcome),
    [condition, outcome, scenario]
  );
  const snapshot = run.snapshots[timelineIndex] ?? run.snapshots[0];
  const aggregate = summary.conditions.find(
    (row) => row.condition === condition
  );
  const isAfterOutcome = snapshot.phase === "follow-up";
  const temporaryProfile = snapshot.profile[scenario.temporaryTopic];
  const taskBoundaryIndex = 4;

  const status = (() => {
    if (!isAfterOutcome && condition === "outcome-quarantine") {
      return "Evidence held outside profile";
    }
    if (!isAfterOutcome) return "Profile may affect this surface";
    if (outcome === "abandoned" && condition === "rollback-on-failure") {
      return "Temporary evidence removed";
    }
    if (outcome === "abandoned" && condition === "outcome-quarantine") {
      return "Held evidence discarded";
    }
    if (condition === "scope-gated") return "No purchase evidence to retain";
    return "Temporary evidence remains active";
  })();

  return (
    <div className="cross-task-control-lab">
      <div className="cross-task-control-bar">
        <label>
          <span>TEMPORARY TASK</span>
          <select
            aria-label="Temporary delegated task"
            onChange={(event) => {
              setScenarioId(event.target.value);
              setTimelineIndex(3);
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
        <div aria-label="Task outcome" className="cross-task-outcome" role="group">
          <span>OUTCOME</span>
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

      <div className="cross-task-contracts" aria-label="Profile lifecycle rule">
        {CONTROL_CONDITIONS.map((id) => (
          <button
            aria-pressed={condition === id}
            className={condition === id ? "is-active" : ""}
            key={id}
            onClick={() => setCondition(id)}
            type="button"
          >
            <span>{conditionCopy[id].short}</span>
            <strong>{conditionCopy[id].label}</strong>
            <small>{conditionCopy[id].description}</small>
          </button>
        ))}
      </div>

      <div className="cross-task-stage">
        <article className="cross-task-brief">
          <span className="mono-label">
            {isAfterOutcome ? "NEXT / PERSONAL TASK" : "TEMPORARY / DELEGATED TASK"}
          </span>
          <h4>{isAfterOutcome ? scenario.followUpBrief : scenario.temporaryBrief}</h4>
          <p>{conditionCopy[condition].description}</p>
          <div className="cross-task-status">
            <i className={isAfterOutcome ? "is-after" : ""} />
            <span>{status}</span>
          </div>
        </article>

        <article className="cross-task-shelf">
          <header>
            <span className="mono-label">RECOMMENDATION SURFACE</span>
            <output>
              {snapshot.temporaryTopicExposure} / 6 temporary-topic slots
            </output>
          </header>
          <div className="cross-task-items">
            {snapshot.recommendations.map((item, index) => {
              const isTemporary = item.topic === scenario.temporaryTopic;
              const isCurrent = item.topic === "everyday-home";
              return (
                <div
                  className={`cross-task-item ${
                    isTemporary ? "is-temporary" : isCurrent ? "is-current" : ""
                  }`}
                  key={item.id}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.label}</strong>
                  <small>
                    {isTemporary
                      ? isAfterOutcome
                        ? "from previous task"
                        : "temporary task"
                      : isCurrent
                        ? "serves current task"
                        : "other topic"}
                  </small>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="cross-task-meter">
          <span className="mono-label">TEMPORARY TOPIC IN PROFILE</span>
          <strong>{temporaryProfile.toFixed(2)}</strong>
          <div>
            <i style={{ transform: `scaleX(${Math.min(1, temporaryProfile / 1.2)})` }} />
          </div>
          <dl>
            <div>
              <dt>Mean later slots</dt>
              <dd>{aggregate?.meanPostTaskExposureCount.toFixed(2) ?? "-"}</dd>
            </div>
            <div>
              <dt>Mean first clean round</dt>
              <dd>{aggregate?.meanFirstCleanRound.toFixed(2) ?? "-"}</dd>
            </div>
            <div>
              <dt>Current-task share</dt>
              <dd>
                {aggregate
                  ? `${(aggregate.meanCurrentTaskRecommendationShare * 100).toFixed(1)}%`
                  : "-"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="cross-task-timeline">
        <div>
          <span>
            {snapshot.phase === "provisional"
              ? `Temporary action ${snapshot.round} / 4`
              : `Personal follow-up ${snapshot.round} / 8`}
          </span>
          <span>Task outcome resolved after step {taskBoundaryIndex}</span>
        </div>
        <input
          aria-label="Cross-task timeline"
          aria-valuetext={
            snapshot.phase === "provisional"
              ? `Temporary task action ${snapshot.round} of 4`
              : `Personal follow-up recommendation round ${snapshot.round} of 8`
          }
          max={run.snapshots.length - 1}
          min={0}
          onChange={(event) => setTimelineIndex(Number(event.target.value))}
          style={
            {
              "--cross-task-progress": `${
                (timelineIndex / Math.max(1, run.snapshots.length - 1)) * 100
              }%`,
              "--cross-task-boundary": `${
                ((taskBoundaryIndex - 0.5) / (run.snapshots.length - 1)) * 100
              }%`
            } as React.CSSProperties
          }
          type="range"
          value={timelineIndex}
        />
      </div>

      <p className="cross-task-prototype-boundary">
        Instrument, not usability evidence: these controls manipulate the executable
        recommender model. No participant has evaluated whether the labels are
        understandable, desirable, or sufficient.
      </p>
    </div>
  );
}
