import { useId, type ReactNode } from "react";

export const VIS_COLORS = {
  paper: "#f2efe8",
  paperDeep: "#e6e0d5",
  ink: "#151518",
  muted: "#69676d",
  rule: "#d4cec3",
  error: "#d94f36",
  provenance: "#315bd6",
  negotiated: "#16836f",
  intermediary: "#7656d8"
} as const;

const CONDITION_COLORS: Record<string, string> = {
  "actor-blind": VIS_COLORS.error,
  "action-only": VIS_COLORS.error,
  "logged-only": VIS_COLORS.intermediary,
  "impact-preview": VIS_COLORS.provenance,
  "provenance-aware": VIS_COLORS.provenance,
  "approval-gated": VIS_COLORS.negotiated,
  "preview-and-repair": VIS_COLORS.negotiated
};

const CONDITION_DASHES: Record<string, string | undefined> = {
  "actor-blind": undefined,
  "action-only": undefined,
  "logged-only": "8 4",
  "impact-preview": "8 4",
  "provenance-aware": "3 3",
  "approval-gated": "10 3 2 3",
  "preview-and-repair": "10 3 2 3"
};

const FALLBACK_COLORS = [
  VIS_COLORS.error,
  VIS_COLORS.provenance,
  VIS_COLORS.negotiated,
  VIS_COLORS.intermediary,
  "#9a6b18"
];

export interface ChartCopy {
  title?: string;
  subtitle?: string;
  description?: string;
  note?: string;
  className?: string;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function humanizeCondition(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function conditionStyle(
  condition: string,
  index: number,
  color?: string,
  dash?: string
) {
  return {
    color:
      color ??
      CONDITION_COLORS[condition] ??
      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    dash:
      dash === ""
        ? undefined
        : dash ?? CONDITION_DASHES[condition] ?? undefined
  };
}

export function orderedUnique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function clamp(value: number, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

export function formatRate(value: number, digits = 0) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: digits
  }).format(value);
}

export function formatDecimal(value: number, digits = 3) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function useChartIds(prefix: string) {
  const reactId = useId().replace(/:/g, "");
  return {
    titleId: `${prefix}-${reactId}-title`,
    descriptionId: `${prefix}-${reactId}-description`,
    gradientId: `${prefix}-${reactId}-gradient`,
    missingPatternId: `${prefix}-${reactId}-missing`
  };
}

export function ChartHeader({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="vis__header">
      <h3 className="vis__title">{title}</h3>
      {subtitle ? <p className="vis__subtitle">{subtitle}</p> : null}
    </header>
  );
}

export function ConditionLegend({
  items
}: {
  items: Array<{
    id: string;
    label: string;
    color: string;
    dash?: string;
    shape?: "line" | "circle" | "square" | "triangle" | "diamond";
  }>;
}) {
  return (
    <ul
      className="vis__legend"
      aria-label="Series legend"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.55rem 1.25rem",
        margin: "0.75rem 0",
        padding: 0,
        listStyle: "none"
      }}
    >
      {items.map((item) => (
        <li
          className="vis__legend-item"
          key={item.id}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg width="28" height="12" aria-hidden="true">
            {item.shape === "circle" ? (
              <circle
                cx="14"
                cy="6"
                r="4.5"
                fill={item.color}
                stroke={VIS_COLORS.ink}
                strokeWidth="0.8"
              />
            ) : item.shape === "square" ? (
              <rect
                x="9.5"
                y="1.5"
                width="9"
                height="9"
                fill={item.color}
                stroke={VIS_COLORS.ink}
                strokeWidth="0.8"
              />
            ) : item.shape === "triangle" ? (
              <path
                d="M14 1 L19 10 L9 10 Z"
                fill={item.color}
                stroke={VIS_COLORS.ink}
                strokeWidth="0.8"
              />
            ) : item.shape === "diamond" ? (
              <path
                d="M14 1 L19 6 L14 11 L9 6 Z"
                fill={item.color}
                stroke={VIS_COLORS.ink}
                strokeWidth="0.8"
              />
            ) : (
              <line
                x1="1"
                x2="27"
                y1="6"
                y2="6"
                stroke={item.color}
                strokeDasharray={item.dash}
                strokeWidth="2.5"
              />
            )}
          </svg>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function AccessibleDataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  open = false
}: {
  caption: string;
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  open?: boolean;
}) {
  return (
    <details className="vis__data-fallback" open={open}>
      <summary>View exact values</summary>
      <div style={{ maxWidth: "100%", overflowX: "auto" }}>
        <table className="vis__data-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column.key}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index)}>
                {columns.map((column, columnIndex) => {
                  const Cell = columnIndex === 0 ? "th" : "td";
                  return (
                    <Cell
                      key={column.key}
                      {...(columnIndex === 0 ? { scope: "row" } : {})}
                    >
                      {column.render(row)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
