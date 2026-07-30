import {
  line,
  max,
  min,
  scaleLinear,
  scaleSqrt,
  symbol,
  symbolCircle,
  symbolDiamond,
  symbolSquare,
  symbolTriangle
} from "d3";
import {
  AccessibleDataTable,
  ChartHeader,
  ConditionLegend,
  VIS_COLORS,
  clamp,
  conditionStyle,
  cx,
  formatDecimal,
  formatRate,
  humanizeCondition,
  orderedUnique,
  useChartIds,
  type ChartCopy
} from "./shared";

export interface UtilityIntegrityDatum {
  id: string;
  label: string;
  condition: string;
  taskUtility: number;
  profileContamination: number;
  interactionCost?: number;
  runCount?: number;
  group?: string;
}

export interface UtilityIntegrityTradeoffProps extends ChartCopy {
  data: UtilityIntegrityDatum[];
  width?: number;
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  showFrontier?: boolean;
  showTable?: boolean;
}

interface PlottedDatum extends UtilityIntegrityDatum {
  profileIntegrity: number;
}

function paretoFrontier(data: PlottedDatum[]): PlottedDatum[] {
  const descending = [...data].sort(
    (left, right) =>
      right.taskUtility - left.taskUtility ||
      right.profileIntegrity - left.profileIntegrity
  );
  const frontier: PlottedDatum[] = [];
  let bestIntegrity = -Infinity;
  for (const point of descending) {
    if (point.profileIntegrity > bestIntegrity) {
      frontier.push(point);
      bestIntegrity = point.profileIntegrity;
    }
  }
  return frontier.sort((left, right) => left.taskUtility - right.taskUtility);
}

export function UtilityIntegrityTradeoff({
  data,
  width = 920,
  height = 500,
  xDomain = [0, 1],
  yDomain = [0, 1],
  showFrontier = true,
  showTable = true,
  title = "Task utility versus profile integrity",
  subtitle = "Higher is better on both axes. Profile integrity equals one minus normalized profile contamination.",
  description,
  note,
  className
}: UtilityIntegrityTradeoffProps) {
  const ids = useChartIds("utility-integrity");
  const margin = { top: 28, right: 38, bottom: 66, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const plotted: PlottedDatum[] = data.map((datum) => ({
    ...datum,
    profileIntegrity: clamp(1 - datum.profileContamination)
  }));
  const x = scaleLinear().domain(xDomain).range([0, innerWidth]);
  const y = scaleLinear().domain(yDomain).range([innerHeight, 0]);
  const xTicks = x.ticks(5);
  const yTicks = y.ticks(5);
  const costs = plotted.map((datum) => datum.interactionCost ?? 0);
  const minCost = min(costs) ?? 0;
  const maxCost = max(costs) ?? 0;
  const pointArea =
    maxCost > minCost
      ? scaleSqrt().domain([minCost, maxCost]).range([70, 230])
      : () => 110;
  const conditions = orderedUnique(plotted.map((datum) => datum.condition));
  const styles = new Map(
    conditions.map((condition, index) => [
      condition,
      conditionStyle(condition, index)
    ])
  );
  const symbols = [symbolCircle, symbolSquare, symbolTriangle, symbolDiamond];
  const symbolNames = [
    "circle",
    "square",
    "triangle",
    "diamond"
  ] as const;
  const symbolByCondition = new Map(
    conditions.map((condition, index) => [
      condition,
      symbols[index % symbols.length]
    ])
  );
  const symbolNameByCondition = new Map(
    conditions.map((condition, index) => [
      condition,
      symbolNames[index % symbolNames.length]
    ])
  );
  const frontier = paretoFrontier(plotted);
  const frontierPath = line<PlottedDatum>()
    .x((datum) => x(datum.taskUtility))
    .y((datum) => y(datum.profileIntegrity))(frontier);
  const highestIntegrity = [...plotted].sort(
    (left, right) => right.profileIntegrity - left.profileIntegrity
  )[0];
  const highestUtility = [...plotted].sort(
    (left, right) => right.taskUtility - left.taskUtility
  )[0];
  const semanticSummary =
    highestIntegrity && highestUtility
      ? `${highestIntegrity.label} has the highest profile integrity (${formatRate(
          highestIntegrity.profileIntegrity
        )}); ${highestUtility.label} has the highest task utility (${formatRate(
          highestUtility.taskUtility
        )}).`
      : "No utility and integrity observations are available.";
  const showDirectLabels = plotted.length <= 12;

  return (
    <figure className={cx("vis", "vis--utility-integrity", className)}>
      <ChartHeader title={title} subtitle={subtitle} />
      <ConditionLegend
        items={conditions.map((condition) => ({
          id: condition,
          label: humanizeCondition(condition),
          color: styles.get(condition)?.color ?? VIS_COLORS.ink,
          shape: symbolNameByCondition.get(condition)
        }))}
      />
      <p className="vis__semantic-summary">{semanticSummary}</p>
      <div className="vis__scroll-region" style={{ overflowX: "auto" }}>
        <svg
          className="vis__svg utility-integrity__svg"
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
          <desc id={ids.descriptionId}>
            {description ??
              `${semanticSummary} Point area represents interaction cost; point shape and color identify interface condition.`}
          </desc>
          <defs>
            <marker
              id={`${ids.gradientId}-arrow`}
              markerHeight="6"
              markerWidth="6"
              orient="auto"
              refX="5"
              refY="3"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={VIS_COLORS.muted} />
            </marker>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {yTicks.map((tick) => (
              <g className="vis__gridline" key={`y-${tick}`}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={VIS_COLORS.rule}
                  strokeWidth={0.75}
                />
                <text
                  x={-12}
                  y={y(tick) + 4}
                  textAnchor="end"
                  fill={VIS_COLORS.muted}
                  fontFamily="'IBM Plex Mono', monospace"
                  fontSize={11.5}
                >
                  {formatRate(tick)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g className="vis__gridline" key={`x-${tick}`}>
                <line
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={0}
                  y2={innerHeight}
                  stroke={VIS_COLORS.rule}
                  strokeWidth={0.75}
                />
                <text
                  x={x(tick)}
                  y={innerHeight + 24}
                  textAnchor="middle"
                  fill={VIS_COLORS.muted}
                  fontFamily="'IBM Plex Mono', monospace"
                  fontSize={11.5}
                >
                  {formatRate(tick)}
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

            {showFrontier && frontierPath && frontier.length > 1 ? (
              <path
                className="utility-integrity__frontier"
                d={frontierPath}
                fill="none"
                stroke={VIS_COLORS.ink}
                strokeDasharray="2 5"
                strokeLinecap="round"
                strokeWidth={1.25}
              />
            ) : null}

            <g
              className="utility-integrity__direction"
              transform={`translate(${innerWidth - 170},18)`}
            >
              <line
                x1={0}
                x2={52}
                y1={18}
                y2={0}
                stroke={VIS_COLORS.muted}
                strokeWidth={1}
                markerEnd={`url(#${ids.gradientId}-arrow)`}
              />
              <text
                x={60}
                y={4}
                fill={VIS_COLORS.muted}
                fontSize={11}
              >
                higher on both
              </text>
            </g>

            {plotted.map((datum) => {
              const style = styles.get(datum.condition) ?? {
                color: VIS_COLORS.ink,
                dash: undefined
              };
              const shape = symbol()
                .type(symbolByCondition.get(datum.condition) ?? symbolCircle)
                .size(pointArea(datum.interactionCost ?? 0))();
              return (
                <g
                  className={`utility-integrity__point condition-${datum.condition}`}
                  data-condition={datum.condition}
                  key={datum.id}
                  transform={`translate(${x(datum.taskUtility)},${y(
                    datum.profileIntegrity
                  )})`}
                >
                  <path
                    d={shape ?? ""}
                    fill={style.color}
                    fillOpacity={0.78}
                    stroke={VIS_COLORS.ink}
                    strokeWidth={0.9}
                  >
                    <title>
                      {datum.label}: task utility{" "}
                      {formatRate(datum.taskUtility)}, profile integrity{" "}
                      {formatRate(datum.profileIntegrity)}, interaction cost{" "}
                      {formatDecimal(datum.interactionCost ?? 0, 2)}
                      {datum.runCount ? `, ${datum.runCount} runs` : ""}
                    </title>
                  </path>
                  {showDirectLabels ? (
                    <text
                      className="utility-integrity__point-label"
                      x={10}
                      y={-9}
                      fill={VIS_COLORS.ink}
                      fontSize={10.5}
                      paintOrder="stroke"
                      stroke={VIS_COLORS.paper}
                      strokeWidth={4}
                      strokeLinejoin="round"
                    >
                      {datum.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <text
              className="vis__axis-label"
              x={innerWidth / 2}
              y={innerHeight + 53}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              Task utility
            </text>
            <text
              className="vis__axis-label"
              transform={`translate(${-54},${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              Profile integrity
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="vis__note">
        {note ??
          "Point area encodes interaction cost. The dashed line marks the non-dominated utility–integrity frontier; it does not include cost."}
      </figcaption>
      {showTable ? (
        <AccessibleDataTable
          caption={`${title}. ${subtitle}`}
          rows={plotted}
          rowKey={(row) => row.id}
          columns={[
            { key: "label", header: "Observation", render: (row) => row.label },
            {
              key: "condition",
              header: "Condition",
              render: (row) => humanizeCondition(row.condition)
            },
            {
              key: "utility",
              header: "Task utility",
              render: (row) => formatRate(row.taskUtility)
            },
            {
              key: "integrity",
              header: "Profile integrity",
              render: (row) => formatRate(row.profileIntegrity)
            },
            {
              key: "contamination",
              header: "Profile contamination",
              render: (row) => formatDecimal(row.profileContamination)
            },
            {
              key: "cost",
              header: "Interaction cost",
              render: (row) =>
                formatDecimal(row.interactionCost ?? 0, 2)
            },
            {
              key: "runs",
              header: "Runs",
              render: (row) => row.runCount ?? "—"
            }
          ]}
        />
      ) : null}
    </figure>
  );
}
