import { area, curveStepAfter, line, max, scaleLinear } from "d3";
import {
  AccessibleDataTable,
  ChartHeader,
  ConditionLegend,
  VIS_COLORS,
  conditionStyle,
  cx,
  formatDecimal,
  humanizeCondition,
  useChartIds,
  type ChartCopy
} from "./shared";

export interface ProfileDivergencePoint {
  step: number;
  value: number;
  p10?: number;
  p90?: number;
}

export interface ProfileDivergenceSeries {
  condition: string;
  label?: string;
  color?: string;
  dash?: string;
  points: ProfileDivergencePoint[];
}

export interface ProfileDivergenceChartProps extends ChartCopy {
  series: ProfileDivergenceSeries[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  showTable?: boolean;
}

function toDisplayStep(step: number): number {
  return step + 1;
}

function formatTraceState(step: number): string {
  return step === -1 ? "Before" : `After event ${toDisplayStep(step)}`;
}

export function ProfileDivergenceChart({
  series,
  width = 920,
  height = 430,
  title = "Profile divergence after each delegated action",
  subtitle = "Normalized distance from the principal reference before the trace and after each event.",
  description,
  note,
  className,
  xLabel = "Trace state (before, then event number)",
  yLabel = "Profile divergence",
  showTable = true
}: ProfileDivergenceChartProps) {
  const ids = useChartIds("profile-divergence");
  const margin = { top: 20, right: 28, bottom: 58, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const allPoints = series.flatMap((item) => item.points);
  const displaySteps = [
    ...new Set(allPoints.map((point) => toDisplayStep(point.step)))
  ].sort((left, right) => left - right);
  const minDisplayStep = Math.min(0, ...displaySteps);
  const maxDisplayStep = Math.max(1, ...displaySteps);
  const highestValue =
    max(
      allPoints,
      (point) => point.p90 ?? point.value
    ) ?? 0;
  const x = scaleLinear()
    .domain([minDisplayStep, maxDisplayStep])
    .range([0, innerWidth]);
  const y = scaleLinear()
    .domain([0, Math.max(0.05, highestValue * 1.08)])
    .nice()
    .range([innerHeight, 0]);
  const xTicks =
    displaySteps.length <= 18
      ? displaySteps
      : x
          .ticks(8)
          .filter((tick) => Number.isInteger(tick));
  const yTicks = y.ticks(5);
  const lineGenerator = line<ProfileDivergencePoint>()
    .x((point) => x(toDisplayStep(point.step)))
    .y((point) => y(point.value))
    .curve(curveStepAfter);
  const bandGenerator = area<ProfileDivergencePoint>()
    .defined(
      (point) =>
        typeof point.p10 === "number" && typeof point.p90 === "number"
    )
    .x((point) => x(toDisplayStep(point.step)))
    .y0((point) => y(point.p10 ?? point.value))
    .y1((point) => y(point.p90 ?? point.value))
    .curve(curveStepAfter);
  const styledSeries = series.map((item, index) => ({
    ...item,
    ...conditionStyle(item.condition, index, item.color, item.dash),
    points: [...item.points].sort((left, right) => left.step - right.step)
  }));
  const finalRows = styledSeries
    .map((item) => ({
      condition: item.label ?? humanizeCondition(item.condition),
      value: item.points.at(-1)?.value ?? 0
    }))
    .sort((left, right) => left.value - right.value);
  const minimumFinal = finalRows[0]?.value;
  const maximumFinal = finalRows.at(-1)?.value;
  const lowestFinal = finalRows.filter(
    (row) =>
      minimumFinal !== undefined && Math.abs(row.value - minimumFinal) < 1e-9
  );
  const highestFinal = finalRows.filter(
    (row) =>
      maximumFinal !== undefined && Math.abs(row.value - maximumFinal) < 1e-9
  );
  const joinConditions = (
    rows: Array<{ condition: string; value: number }>
  ) => rows.map((row) => row.condition).join(" and ");
  const semanticSummary =
    finalRows.length === 0
      ? "No profile-divergence observations are available."
      : `${joinConditions(lowestFinal)} ${
          lowestFinal.length > 1 ? "tie for" : "has"
        } the lowest final divergence (${formatDecimal(
          lowestFinal[0].value
        )}); ${joinConditions(highestFinal)} ${
          highestFinal.length > 1 ? "tie for" : "has"
        } the highest (${formatDecimal(highestFinal[0].value)}).`;
  const longDescription =
    description ??
    `${semanticSummary} Divergence is shown from zero on a shared vertical scale. The horizontal axis starts before the trace and advances to the state after each numbered event.`;

  return (
    <figure className={cx("vis", "vis--profile-divergence", className)}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ConditionLegend
        items={styledSeries.map((item) => ({
          id: item.condition,
          label: item.label ?? humanizeCondition(item.condition),
          color: item.color,
          dash: item.dash
        }))}
      />
      <p className="vis__semantic-summary">{semanticSummary}</p>
      <div
        aria-label="Scrollable profile-divergence chart"
        className="vis__scroll-region"
        style={{ overflowX: "auto" }}
        tabIndex={0}
      >
        <svg
          className="vis__svg profile-divergence__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
          style={{
            display: "block",
            width: "100%",
            minWidth: "640px",
            height: "auto",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
          }}
        >
          <title id={ids.titleId}>{title}</title>
          <desc id={ids.descriptionId}>{longDescription}</desc>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {yTicks.map((tick) => (
              <g className="vis__gridline" key={tick}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={VIS_COLORS.rule}
                  strokeWidth={tick === 0 ? 1.25 : 0.75}
                />
                <text
                  x={-12}
                  y={y(tick) + 4}
                  textAnchor="end"
                  fill={VIS_COLORS.muted}
                  fontSize={12}
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {formatDecimal(tick, 2)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g className="vis__x-tick" key={tick}>
                <line
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={innerHeight}
                  y2={innerHeight + 6}
                  stroke={VIS_COLORS.ink}
                  strokeWidth={0.9}
                />
                <text
                  x={x(tick)}
                  y={innerHeight + 23}
                  textAnchor="middle"
                  fill={VIS_COLORS.muted}
                  fontSize={12}
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {tick === 0 ? "Before" : tick}
                </text>
              </g>
            ))}
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={innerHeight}
              stroke={VIS_COLORS.ink}
              strokeWidth={1}
            />
            <line
              x1={0}
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke={VIS_COLORS.ink}
              strokeWidth={1}
            />

            {styledSeries.map((item) => {
              const band = bandGenerator(item.points);
              const path = lineGenerator(item.points);
              return (
                <g
                  className={`profile-divergence__series condition-${item.condition}`}
                  key={item.condition}
                  data-condition={item.condition}
                >
                  {band ? (
                    <path
                      className="profile-divergence__interval"
                      d={band}
                      fill={item.color}
                      fillOpacity={0.1}
                      stroke="none"
                    />
                  ) : null}
                  {path ? (
                    <path
                      className="profile-divergence__line"
                      d={path}
                      fill="none"
                      stroke={item.color}
                      strokeDasharray={item.dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                    />
                  ) : null}
                  {item.points.map((point, pointIndex) => (
                    <circle
                      className="profile-divergence__point"
                      cx={x(toDisplayStep(point.step))}
                      cy={y(point.value)}
                      fill={pointIndex === item.points.length - 1 ? item.color : VIS_COLORS.paper}
                      key={`${item.condition}-${point.step}`}
                      r={pointIndex === item.points.length - 1 ? 4.5 : 2.6}
                      stroke={item.color}
                      strokeWidth={1.6}
                    >
                      <title>
                        {item.label ?? humanizeCondition(item.condition)},{" "}
                        {formatTraceState(point.step)}:{" "}
                        {formatDecimal(point.value)}
                      </title>
                    </circle>
                  ))}
                </g>
              );
            })}

            <text
              className="vis__axis-label"
              x={innerWidth / 2}
              y={innerHeight + 49}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              {xLabel}
            </text>
            <text
              className="vis__axis-label"
              transform={`translate(${-54},${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              {yLabel}
            </text>
          </g>
        </svg>
      </div>
      {note ? <figcaption className="vis__note">{note}</figcaption> : null}
      {showTable ? (
        <AccessibleDataTable
          caption={`${title}. ${subtitle}`}
          rows={styledSeries.flatMap((item) =>
            item.points.map((point) => ({
              condition:
                item.label ?? humanizeCondition(item.condition),
              ...point
            }))
          )}
          rowKey={(row) => `${row.condition}-${row.step}`}
          columns={[
            {
              key: "condition",
              header: "Condition",
              render: (row) => row.condition
            },
            {
              key: "state",
              header: "Trace state",
              render: (row) => formatTraceState(row.step)
            },
            {
              key: "value",
              header: "Divergence",
              render: (row) => formatDecimal(row.value)
            },
            {
              key: "interval",
              header: "P10–P90",
              render: (row) =>
                row.p10 === undefined || row.p90 === undefined
                  ? "—"
                  : `${formatDecimal(row.p10)}–${formatDecimal(row.p90)}`
            }
          ]}
        />
      ) : null}
    </figure>
  );
}
