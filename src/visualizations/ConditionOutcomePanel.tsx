import { scaleLinear } from "d3";
import type { MetricSummary } from "../data";
import {
  AccessibleDataTable,
  ChartHeader,
  VIS_COLORS,
  conditionStyle,
  cx,
  formatDecimal,
  humanizeCondition,
  type ChartCopy
} from "./shared";

export interface ConditionOutcomePanelProps extends ChartCopy {
  rows: readonly MetricSummary[];
  studyLabel: string;
  showCost?: boolean;
  maxDivergence?: number;
}

export function ConditionOutcomePanel({
  rows,
  studyLabel,
  showCost = false,
  maxDivergence = 0.5,
  title = "Reference-profile divergence by condition",
  subtitle = "Dots are generated means; whiskers are P10–P90 across deterministic runs.",
  note,
  className
}: ConditionOutcomePanelProps) {
  const width = 500;
  const x = scaleLinear().domain([0, maxDivergence]).range([8, width - 8]);
  const ordered = [...rows].sort(
    (left, right) =>
      left.profileContamination - right.profileContamination
  );
  const minimum = ordered[0]?.profileContamination;
  const maximum = ordered.at(-1)?.profileContamination;
  const best = ordered.filter(
    (row) =>
      minimum !== undefined &&
      Math.abs(row.profileContamination - minimum) < 1e-9
  );
  const worst = ordered.filter(
    (row) =>
      maximum !== undefined &&
      Math.abs(row.profileContamination - maximum) < 1e-9
  );
  const labels = (items: readonly MetricSummary[]) =>
    items.map((item) => humanizeCondition(item.condition)).join(" and ");

  return (
    <figure className={cx("vis", "vis--condition-outcomes", className)}>
      <ChartHeader title={title} subtitle={subtitle} />
      <p className="vis__semantic-summary">
        {best.length > 0 && worst.length > 0
          ? `${labels(best)} ${
              best.length > 1 ? "tie for" : "has"
            } the lowest generated mean divergence (${formatDecimal(
              best[0].profileContamination
            )}); ${labels(worst)} ${
              worst.length > 1 ? "tie for" : "has"
            } the highest (${formatDecimal(worst[0].profileContamination)}).`
          : "No generated condition summaries are available."}
      </p>

      <div
        className={`condition-outcomes${showCost ? " has-cost" : ""}`}
        role="img"
        aria-label={`${title}. ${subtitle}`}
      >
        <div className="condition-outcomes__head" aria-hidden="true">
          <span>{studyLabel}</span>
          <span>Reference-profile divergence · 0–{maxDivergence.toFixed(1)}</span>
          <span>Task utility</span>
          {showCost ? <span>Cost index</span> : null}
        </div>
        <div className="condition-outcomes__axis" aria-hidden="true">
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5]
            .filter((tick) => tick <= maxDivergence)
            .map((tick) => (
              <span key={tick} style={{ left: `${(tick / maxDivergence) * 100}%` }}>
                {tick.toFixed(1)}
              </span>
            ))}
        </div>
        {ordered.map((row, index) => {
          const style = conditionStyle(row.condition, index);
          return (
            <div
              className={`condition-outcomes__row${
                showCost ? " has-cost" : ""
              }`}
              key={row.condition}
            >
              <strong>{humanizeCondition(row.condition)}</strong>
              <svg
                aria-hidden="true"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 34`}
              >
                <line
                  className="condition-outcomes__baseline"
                  x1={x(0)}
                  x2={x(maxDivergence)}
                  y1={17}
                  y2={17}
                />
                <line
                  x1={x(row.profileContaminationP10)}
                  x2={x(row.profileContaminationP90)}
                  y1={17}
                  y2={17}
                  stroke={style.color}
                  strokeLinecap="round"
                  strokeWidth={5}
                />
                <line
                  x1={x(row.profileContaminationP10)}
                  x2={x(row.profileContaminationP10)}
                  y1={11}
                  y2={23}
                  stroke={style.color}
                  strokeWidth={1.5}
                />
                <line
                  x1={x(row.profileContaminationP90)}
                  x2={x(row.profileContaminationP90)}
                  y1={11}
                  y2={23}
                  stroke={style.color}
                  strokeWidth={1.5}
                />
                <circle
                  cx={x(row.profileContamination)}
                  cy={17}
                  fill={VIS_COLORS.paper}
                  r={6}
                  stroke={style.color}
                  strokeWidth={4}
                />
              </svg>
              <output>
                <b>{formatDecimal(row.profileContamination)}</b>
                <small>
                  {formatDecimal(row.profileContaminationP10)}–
                  {formatDecimal(row.profileContaminationP90)}
                </small>
              </output>
              <output>{formatDecimal(row.taskUtility)}</output>
              {showCost ? (
                <output>{formatDecimal(row.interactionCost, 0)}</output>
              ) : null}
            </div>
          );
        })}
      </div>

      <figcaption className="vis__note">
        {note ??
          "P10–P90 shows variation across generated runs; it is not a confidence interval. Lower divergence is not automatically better when a stored profile is stale."}
      </figcaption>

      <AccessibleDataTable
        caption={`${title}. ${subtitle}`}
        rows={ordered}
        rowKey={(row) => row.condition}
        columns={[
          {
            key: "condition",
            header: "Condition",
            render: (row) => humanizeCondition(row.condition)
          },
          {
            key: "mean",
            header: "Mean divergence",
            render: (row) => formatDecimal(row.profileContamination)
          },
          {
            key: "p10",
            header: "Divergence P10",
            render: (row) => formatDecimal(row.profileContaminationP10)
          },
          {
            key: "p90",
            header: "Divergence P90",
            render: (row) => formatDecimal(row.profileContaminationP90)
          },
          {
            key: "utility",
            header: "Task utility",
            render: (row) => formatDecimal(row.taskUtility)
          },
          {
            key: "cost",
            header: "Modeled cost index",
            render: (row) => formatDecimal(row.interactionCost, 0)
          },
          {
            key: "runs",
            header: "Runs",
            render: (row) => row.runCount
          }
        ]}
      />
    </figure>
  );
}
