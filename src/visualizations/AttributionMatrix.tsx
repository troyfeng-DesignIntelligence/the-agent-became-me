import { interpolateRgb, max, scaleBand, scaleSequential } from "d3";
import {
  AccessibleDataTable,
  ChartHeader,
  VIS_COLORS,
  cx,
  formatRate,
  orderedUnique,
  readableTextColor,
  useChartIds,
  type ChartCopy
} from "./shared";

export interface AttributionMatrixCell {
  row: string;
  column: string;
  value: number;
  runCount?: number;
  note?: string;
}

export interface AttributionMatrixProps extends ChartCopy {
  data: AttributionMatrixCell[];
  rows?: string[];
  columns?: string[];
  width?: number;
  height?: number;
  rowAxisLabel?: string;
  columnAxisLabel?: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
  showTable?: boolean;
}

export function AttributionMatrix({
  data,
  rows: rowOrder,
  columns: columnOrder,
  width = 920,
  height,
  title = "Attribution error by scenario and interface condition",
  subtitle = "Share of agent events attributed incorrectly; exact values are printed in every cell.",
  description,
  note,
  className,
  rowAxisLabel = "Synthetic scenario",
  columnAxisLabel = "Interface condition",
  valueLabel = "Attribution error rate",
  formatValue = (value) => formatRate(value),
  showTable = true
}: AttributionMatrixProps) {
  const ids = useChartIds("attribution-matrix");
  const rows = rowOrder ?? orderedUnique(data.map((cell) => cell.row));
  const columns =
    columnOrder ?? orderedUnique(data.map((cell) => cell.column));
  const resolvedHeight =
    height ?? Math.max(330, 132 + Math.max(1, rows.length) * 48);
  const margin = { top: 78, right: 26, bottom: 60, left: 178 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = resolvedHeight - margin.top - margin.bottom;
  const x = scaleBand<string>()
    .domain(columns)
    .range([0, innerWidth])
    .paddingInner(0.06);
  const y = scaleBand<string>()
    .domain(rows)
    .range([0, innerHeight])
    .paddingInner(0.08);
  const highest = max(data, (cell) => cell.value) ?? 1;
  const color = scaleSequential(
    interpolateRgb(VIS_COLORS.paperDeep, VIS_COLORS.error)
  ).domain([0, Math.max(0.0001, highest)]);
  const lookup = new Map(
    data.map((cell) => [`${cell.row}\u0000${cell.column}`, cell])
  );
  const populated = data.filter((cell) => Number.isFinite(cell.value));
  const lowestCell = [...populated].sort(
    (left, right) => left.value - right.value
  )[0];
  const highestCell = [...populated].sort(
    (left, right) => right.value - left.value
  )[0];
  const semanticSummary =
    lowestCell && highestCell
      ? `The lowest ${valueLabel.toLowerCase()} is ${formatValue(
          lowestCell.value
        )} for ${lowestCell.row}, ${lowestCell.column}; the highest is ${formatValue(
          highestCell.value
        )} for ${highestCell.row}, ${highestCell.column}.`
      : "No attribution observations are available.";

  return (
    <figure className={cx("vis", "vis--attribution-matrix", className)}>
      <ChartHeader title={title} subtitle={subtitle} />
      <p className="vis__semantic-summary">{semanticSummary}</p>
      <div
        aria-label="Scrollable trace-handling matrix"
        className="vis__scroll-region"
        style={{ overflowX: "auto" }}
        tabIndex={0}
      >
        <svg
          className="vis__svg attribution-matrix__svg"
          viewBox={`0 0 ${width} ${resolvedHeight}`}
          role="img"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
          style={{
            display: "block",
            width: "100%",
            minWidth: "700px",
            height: "auto",
            fontFamily: "'Syne Variable', 'Syne', system-ui, sans-serif"
          }}
        >
          <title id={ids.titleId}>{title}</title>
          <desc id={ids.descriptionId}>
            {description ?? semanticSummary}
          </desc>
          <defs>
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
            {columns.map((column) => (
              <text
                className="attribution-matrix__column-label"
                x={(x(column) ?? 0) + x.bandwidth() / 2}
                y={-18}
                textAnchor="middle"
                fill={VIS_COLORS.ink}
                fontSize={12}
                key={column}
              >
                {column}
              </text>
            ))}
            {rows.map((row) => (
              <text
                className="attribution-matrix__row-label"
                x={-14}
                y={(y(row) ?? 0) + y.bandwidth() / 2 + 4}
                textAnchor="end"
                fill={VIS_COLORS.ink}
                fontSize={12.5}
                key={row}
              >
                {row}
              </text>
            ))}

            {rows.flatMap((row) =>
              columns.map((column) => {
                const cell = lookup.get(`${row}\u0000${column}`);
                const background = cell
                  ? color(cell.value)
                  : VIS_COLORS.paper;
                return (
                  <g
                    className="attribution-matrix__cell"
                    data-column={column}
                    data-row={row}
                    key={`${row}-${column}`}
                  >
                    <rect
                      x={x(column)}
                      y={y(row)}
                      width={x.bandwidth()}
                      height={y.bandwidth()}
                      fill={
                        cell
                          ? background
                          : `url(#${ids.missingPatternId})`
                      }
                      stroke={VIS_COLORS.paper}
                      strokeWidth={1}
                    >
                      <title>
                        {cell
                          ? `${row}, ${column}: ${formatValue(cell.value)}${
                              cell.runCount
                                ? ` across ${cell.runCount} runs`
                                : ""
                            }`
                          : `${row}, ${column}: no observation`}
                      </title>
                    </rect>
                    <text
                      x={(x(column) ?? 0) + x.bandwidth() / 2}
                      y={(y(row) ?? 0) + y.bandwidth() / 2 + 4}
                      textAnchor="middle"
                      fill={readableTextColor(background)}
                      fontFamily="'IBM Plex Mono', monospace"
                      fontSize={12}
                      pointerEvents="none"
                    >
                      {cell ? formatValue(cell.value) : "—"}
                    </text>
                  </g>
                );
              })
            )}

            <text
              className="vis__axis-label"
              x={innerWidth / 2}
              y={innerHeight + 47}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              {columnAxisLabel}
            </text>
            <text
              className="vis__axis-label"
              transform={`translate(${-148},${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fill={VIS_COLORS.ink}
              fontSize={13}
            >
              {rowAxisLabel}
            </text>
          </g>
        </svg>
      </div>
      {note ? <figcaption className="vis__note">{note}</figcaption> : null}
      {showTable ? (
        <AccessibleDataTable
          caption={`${title}. ${subtitle}`}
          rows={data}
          rowKey={(row, index) => `${row.row}-${row.column}-${index}`}
          columns={[
            { key: "row", header: rowAxisLabel, render: (row) => row.row },
            {
              key: "column",
              header: columnAxisLabel,
              render: (row) => row.column
            },
            {
              key: "value",
              header: valueLabel,
              render: (row) => formatValue(row.value)
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
