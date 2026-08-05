import { useEffect, useMemo, useState } from "react";
import type { CrossTaskSensitivitySummary } from "../data";

type Metric = "meanPostTaskExcessExposureCount" | "pollutionRunRate";

const metricCopy: Record<Metric, { label: string; short: string }> = {
  meanPostTaskExcessExposureCount: {
    label: "Mean excess recommendation slots",
    short: "EXCESS SLOTS"
  },
  pollutionRunRate: {
    label: "Runs with any excess exposure",
    short: "EXPOSED RUNS"
  }
};

export function PollutionPhaseMap({
  summary
}: {
  summary: CrossTaskSensitivitySummary;
}) {
  const [condition, setCondition] = useState("persist-all");
  const [taskSimilarity, setTaskSimilarity] = useState(0.5);
  const [metric, setMetric] =
    useState<Metric>("meanPostTaskExcessExposureCount");
  const cells = useMemo(
    () =>
      summary.cells.filter(
        (cell) =>
          cell.condition === condition &&
          cell.taskSimilarity === taskSimilarity
      ),
    [condition, summary.cells, taskSimilarity]
  );
  const [selectedKey, setSelectedKey] = useState("");
  useEffect(() => {
    const defaultCell = [...cells].sort(
      (left, right) =>
        right.meanPostTaskExcessExposureCount -
        left.meanPostTaskExcessExposureCount
    )[0];
    setSelectedKey(
      defaultCell ? `${defaultCell.profileWeight}:${defaultCell.decayRate}` : ""
    );
  }, [cells]);
  const selected =
    cells.find(
      (cell) => `${cell.profileWeight}:${cell.decayRate}` === selectedKey
    ) ?? cells[0];
  const globalMaximum = Math.max(...summary.cells.map((cell) => cell[metric]));
  const profileWeights = summary.design.profileWeights;
  const decayRates = [...summary.design.decayRates].reverse();

  return (
    <section className="pollution-map" aria-labelledby="pollution-map-title">
      <header>
        <div>
          <span className="mono-label">INTERACTIVE EXPOSURE SURFACE / 25,000 RUNS</span>
          <h3 id="pollution-map-title">Where does a temporary task leak into the next one?</h3>
        </div>
        <p>
          Each cell averages 100 paired runs. Exposure means temporary-topic
          slots above a no-temporary-profile counterfactual at the same task similarity.
        </p>
      </header>

      <div className="pollution-controls">
        <fieldset>
          <legend>PROFILE RULE</legend>
          {summary.design.conditions.map((id) => (
            <button
              aria-pressed={condition === id}
              key={id}
              onClick={() => setCondition(id)}
              type="button"
            >
              {id === "persist-all" ? "Persist all" : "Intent weighted"}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>TASK SIMILARITY</legend>
          {summary.design.taskSimilarities.map((value) => (
            <button
              aria-pressed={taskSimilarity === value}
              key={value}
              onClick={() => setTaskSimilarity(value)}
              type="button"
            >
              {value.toFixed(2)}
            </button>
          ))}
        </fieldset>
        <label>
          <span>COLOR METRIC</span>
          <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
            {Object.entries(metricCopy).map(([key, copy]) => (
              <option key={key} value={key}>
                {copy.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pollution-map-body">
        <div className="pollution-grid-wrap">
          <span className="pollution-y-label">FASTER DECAY ↑</span>
          <div
            className="pollution-grid"
            style={{ gridTemplateColumns: `68px repeat(${profileWeights.length}, 1fr)` }}
          >
            <span />
            {profileWeights.map((weight) => (
              <span className="pollution-axis-tick" key={weight}>
                {weight.toFixed(2)}
              </span>
            ))}
            {decayRates.flatMap((decay) => [
              <span className="pollution-axis-tick is-y" key={`label-${decay}`}>
                {decay.toFixed(2)}
              </span>,
              ...profileWeights.map((weight) => {
                const cell = cells.find(
                  (candidate) =>
                    candidate.decayRate === decay &&
                    candidate.profileWeight === weight
                );
                const value = cell?.[metric] ?? 0;
                const intensity = globalMaximum > 0 ? value / globalMaximum : 0;
                const key = `${weight}:${decay}`;
                return (
                  <button
                    aria-label={`Profile weight ${weight}, decay ${decay}, ${metricCopy[metric].label} ${value.toFixed(2)}`}
                    aria-pressed={selectedKey === key}
                    className="pollution-cell"
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    style={{
                      backgroundColor: `rgba(158, 76, 65, ${0.08 + intensity * 0.86})`,
                      color: intensity > 0.43 ? "#f3efe5" : "#25221e"
                    }}
                    type="button"
                  >
                    {metric === "pollutionRunRate"
                      ? `${Math.round(value * 100)}%`
                      : value.toFixed(1)}
                  </button>
                );
              })
            ])}
          </div>
          <span className="pollution-x-label">MORE PROFILE WEIGHT →</span>
          <div className="pollution-legend">
            <span>0</span><i /><span>{metricCopy[metric].short}</span>
          </div>
        </div>

        {selected && (
          <aside className="pollution-detail" aria-live="polite">
            <span className="mono-label">SELECTED CELL</span>
            <strong>{selected.meanPostTaskExcessExposureCount.toFixed(2)}</strong>
            <h4>excess later recommendation slots</h4>
            <dl>
              <div><dt>Profile weight</dt><dd>{selected.profileWeight.toFixed(2)}</dd></div>
              <div><dt>Decay / round</dt><dd>{selected.decayRate.toFixed(2)}</dd></div>
              <div><dt>Task similarity</dt><dd>{selected.taskSimilarity.toFixed(2)}</dd></div>
              <div><dt>Exposed runs</dt><dd>{Math.round(selected.pollutionRunRate * 100)}%</dd></div>
              <div><dt>Exposed rounds</dt><dd>{selected.meanPostTaskExcessExposureRounds.toFixed(2)}</dd></div>
              <div><dt>Current-task share</dt><dd>{Math.round(selected.meanCurrentTaskRecommendationShare * 100)}%</dd></div>
            </dl>
          </aside>
        )}
      </div>

      <footer>
        <span>{Math.round(summary.observedComparisons.zeroPollutionCellShare * 100)}% of all cells had zero excess exposure.</span>
        <span>Fast decay removed {summary.observedComparisons.noVsFastDecayDifference.toFixed(2)} excess slots on average versus no decay.</span>
        <span>Intent weighting removed {summary.observedComparisons.persistVsIntentDifference.toFixed(2)} versus persist-all.</span>
      </footer>
    </section>
  );
}
