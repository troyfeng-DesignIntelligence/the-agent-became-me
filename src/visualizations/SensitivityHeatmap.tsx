import {
  extent,
  interpolateRgb,
  max,
  min,
  scaleBand,
  scaleSequential
} from "d3";
import {
  AccessibleDataTable,
  ChartHeader,
  VIS_COLORS,
  cx,
  formatDecimal,
  formatRate,
  humanizeCondition,
  orderedUnique,
  useChartIds,
  type ChartCopy
} from "./shared";

export type SensitivityMetric =
  | "profileContamination"
  | "futureRecommendationRegret"
  | "taskUtility"
  | "attributionErrorRate";

export interface SensitivityDatum {
  condition: string;
  labelNoise: number;
  learningRate: number;
  runCount?: number;
  profileContamination: number;
  futureRecommendationRegret: number;
  taskUtility: number;
  attributionErrorRate: number;
}

export interface SensitivityHeatmapProps extends ChartCopy {
  data: SensitivityDatum[];
  metric?: SensitivityMetric;
  conditions?: string[];
  width?: number;
  height?: number;
  formatValue?: (value: number) => string;
  showTable?: boolean;
}

const METRIC_LABELS: Record<SensitivityMetric, string> = {
  profileContamination: "Profile contamination",
  futureRecommendationRegret: "Future recommendation regret",
  taskUtility: "Task utility",
  attributionErrorRate: "Attribution error rate"
};

export function SensitivityHeatmap({
  data,
  metric = "profileContamination",
  conditions: conditionOrder,
  width = 980,
  height,
  title,
  subtitle,
  description,
  note,
  className,
  formatValue,
  showTable = true
}: SensitivityHeatmapProps) {
  const ids = useChartIds("sensitivity-heatmap");
  const conditions =
    conditionOrder ?? orderedUnique(data.map((datum) => datum.condition));
  const noiseValues = orderedUnique(data.map((datum) => datum.labelNoise)).sort(
    (left, right) => left - right
  );
  const learningRates = orderedUnique(
    data.map((datum) => datum.learningRate)
  ).sort((left, right) => right - left);
  const metricLabel = METRIC_LABELS[metric];
  const formatter =
    formatValue ??
    (metric === "taskUtility" || metric === "attributionErrorRate"
      ? (value: number) => formatRate(value)
      : (value: number) => formatDecimal(value));
  const columns = conditions.length > 1 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(conditions.length / columns));
  const resolvedHeight = height ?? 120 + rows * 310;
  const margin = { top: 42, right: 22, bottom: 76, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = resolvedHeight - margin.top - margin.bottom;
  const facetGapX = 62;
  const facetGapY = 64;
  const facetWidth =
    (innerWidth - facetGapX * Math.max(0, columns - 1)) / columns;
  const facetHeight =
    (innerHeight - facetGapY * Math.max(0, rows - 1)) / rows;
  const x = scaleBand<number>()
    .domain(noiseValues)
    .range([0, facetWidth])
    .paddingInner(0.06);
  const y = scaleBand<number>()
    .domain(learningRates)
    .range([34, facetHeight])
    .paddingInner(0.06);
  const values = data.map((datum) => datum[metric]);
  const [rawMin = 0, rawMax = 1] = extent(values);
  const domainMin = Math.min(0, rawMin);
  const domainMax = Math.max(domainMin + 0.0001, rawMax);
  const color = scaleSequential(
    interpolateRgb(VIS_COLORS.paperDeep, VIS_COLORS.provenance)
  ).domain([domainMin, domainMax]);
  const lookup = new Map(
    data.map((datum) => [
      `${datum.condition}\u0000${datum.labelNoise}\u0000${datum.learningRate}`,
      datum
    ])
  );
  const lowest = data.find((datum) => datum[metric] === min(values));
  const highest = data.find((datum) => datum[metric] === max(values));
  const semanticSummary =
    lowest && highest
      ? `${metricLabel} ranges from ${formatter(lowest[metric])} at ${
          lowest.condition
        }, ${formatRate(lowest.labelNoise)} label noise and ${formatDecimal(
          lowest.learningRate,
          2
        )} learning rate, to ${formatter(highest[metric])} at ${
          highest.condition
        }, ${formatRate(highest.labelNoise)} noise and ${formatDecimal(
          highest.learningRate,
          2
        )} learning rate.`
      : "No sensitivity observations are available.";
  const resolvedTitle = title ?? `${metricLabel} sensitivity`;
  const resolvedSubtitle =
    subtitle ??
    "Shared color scale across interface conditions; cells vary label noise and profile learning rate.";
  const gradientWidth = 190;

  return (
    <figure className={cx("vis", "vis--sensitivity-heatmap", className)}>
      <ChartHeader title={resolvedTitle} subtitle={resolvedSubtitle} />
      <p className="vis__semantic-summary">{semanticSummary}</p>
      <div className="vis__scroll-region" style={{ overflowX: "auto" }}>
        <svg
          className="vis__svg sensitivity-heatmap__svg"
          viewBox={`0 0 ${width} ${resolvedHeight}`}
          role="img"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
          style={{
            display: "block",
            width: "100%",
            minWidth: "720px",
            height: "auto",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
          }}
        >
          <title id={ids.titleId}>{resolvedTitle}</title>
          <desc id={ids.descriptionId}>
            {description ?? semanticSummary}
          </desc>
          <defs>
            <linearGradient id={ids.gradientId} x1="0%" x2="100%">
              <stop offset="0%" stopColor={color(domainMin)} />
              <stop offset="100%" stopColor={color(domainMax)} />
            </linearGradient>
            <pattern
              id={ids.missingPatternId}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="8" height="8" fill={VIS_COLORS.paper} />
              <line
                x1="0"
                x2="0"
                y1="0"
                y2="8"
                stroke={VIS_COLORS.rule}
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {conditions.map((condition, conditionIndex) => {
              const columnIndex = conditionIndex % columns;
              const rowIndex = Math.floor(conditionIndex / columns);
              const offsetX = columnIndex * (facetWidth + facetGapX);
              const offsetY = rowIndex * (facetHeight + facetGapY);
              return (
                <g
                  className={`sensitivity-heatmap__facet condition-${condition}`}
                  data-condition={condition}
                  key={condition}
                  transform={`translate(${offsetX},${offsetY})`}
                >
                  <text
                    className="sensitivity-heatmap__facet-title"
                    x={0}
                    y={14}
                    fill={VIS_COLORS.ink}
                    fontSize={14}
                    fontWeight={600}
                  >
                    {humanizeCondition(condition)}
                  </text>
                  {noiseValues.map((noise) => (
                    <text
                      className="sensitivity-heatmap__x-label"
                      x={(x(noise) ?? 0) + x.bandwidth() / 2}
                      y={facetHeight + 20}
                      textAnchor="middle"
                      fill={VIS_COLORS.muted}
                      fontFamily="'IBM Plex Mono', monospace"
                      fontSize={11.5}
                      key={noise}
                    >
                      {formatRate(noise)}
                    </text>
                  ))}
                  {learningRates.map((rate) => (
                    <text
                      className="sensitivity-heatmap__y-label"
                      x={-10}
                      y={(y(rate) ?? 0) + y.bandwidth() / 2 + 4}
                      textAnchor="end"
                      fill={VIS_COLORS.muted}
                      fontFamily="'IBM Plex Mono', monospace"
                      fontSize={11.5}
                      key={rate}
                    >
                      {formatDecimal(rate, 2)}
                    </text>
                  ))}
                  {learningRates.flatMap((rate) =>
                    noiseValues.map((noise) => {
                      const datum = lookup.get(
                        `${condition}\u0000${noise}\u0000${rate}`
                      );
                      const value = datum?.[metric];
                      const normalized =
                        value === undefined
                          ? 0
                          : (value - domainMin) /
                            Math.max(0.0001, domainMax - domainMin);
                      return (
                        <g
                          className="sensitivity-heatmap__cell"
                          data-learning-rate={rate}
                          data-label-noise={noise}
                          key={`${condition}-${noise}-${rate}`}
                        >
                          <rect
                            x={x(noise)}
                            y={y(rate)}
                            width={x.bandwidth()}
                            height={y.bandwidth()}
                            fill={
                              value === undefined
                                ? `url(#${ids.missingPatternId})`
                                : color(value)
                            }
                            stroke={VIS_COLORS.paper}
                            strokeWidth={1}
                          >
                            <title>
                              {value === undefined
                                ? `${condition}, ${formatRate(
                                    noise
                                  )} noise, ${formatDecimal(
                                    rate,
                                    2
                                  )} learning rate: no observation`
                                : `${condition}, ${formatRate(
                                    noise
                                  )} noise, ${formatDecimal(
                                    rate,
                                    2
                                  )} learning rate: ${metricLabel} ${formatter(
                                    value
                                  )}${datum?.runCount ? `, ${datum.runCount} runs` : ""}`}
                            </title>
                          </rect>
                          <text
                            x={(x(noise) ?? 0) + x.bandwidth() / 2}
                            y={(y(rate) ?? 0) + y.bandwidth() / 2 + 4}
                            textAnchor="middle"
                            fill={
                              normalized > 0.6
                                ? "#ffffff"
                                : VIS_COLORS.ink
                            }
                            fontFamily="'IBM Plex Mono', monospace"
                            fontSize={11}
                            pointerEvents="none"
                          >
                            {value === undefined ? "—" : formatter(value)}
                          </text>
                        </g>
                      );
                    })
                  )}
                  <text
                    className="vis__axis-label"
                    x={facetWidth / 2}
                    y={facetHeight + 43}
                    textAnchor="middle"
                    fill={VIS_COLORS.ink}
                    fontSize={12.5}
                  >
                    Label noise
                  </text>
                  <text
                    className="vis__axis-label"
                    transform={`translate(${-47},${
                      34 + (facetHeight - 34) / 2
                    }) rotate(-90)`}
                    textAnchor="middle"
                    fill={VIS_COLORS.ink}
                    fontSize={12.5}
                  >
                    Learning rate
                  </text>
                </g>
              );
            })}

            <g
              className="sensitivity-heatmap__legend"
              transform={`translate(${innerWidth - gradientWidth},${
                innerHeight + 42
              })`}
            >
              <text
                x={0}
                y={-8}
                fill={VIS_COLORS.ink}
                fontSize={11.5}
              >
                {metricLabel}
              </text>
              <rect
                width={gradientWidth}
                height={8}
                fill={`url(#${ids.gradientId})`}
              />
              <text
                x={0}
                y={24}
                fill={VIS_COLORS.muted}
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={10.5}
              >
                {formatter(domainMin)}
              </text>
              <text
                x={gradientWidth}
                y={24}
                textAnchor="end"
                fill={VIS_COLORS.muted}
                fontFamily="'IBM Plex Mono', monospace"
                fontSize={10.5}
              >
                {formatter(domainMax)}
              </text>
            </g>
          </g>
        </svg>
      </div>
      {note ? <figcaption className="vis__note">{note}</figcaption> : null}
      {showTable ? (
        <AccessibleDataTable
          caption={`${resolvedTitle}. ${resolvedSubtitle}`}
          rows={data}
          rowKey={(row, index) =>
            `${row.condition}-${row.labelNoise}-${row.learningRate}-${index}`
          }
          columns={[
            {
              key: "condition",
              header: "Condition",
              render: (row) => humanizeCondition(row.condition)
            },
            {
              key: "noise",
              header: "Label noise",
              render: (row) => formatRate(row.labelNoise)
            },
            {
              key: "rate",
              header: "Learning rate",
              render: (row) => formatDecimal(row.learningRate, 2)
            },
            {
              key: "metric",
              header: metricLabel,
              render: (row) => formatter(row[metric])
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

