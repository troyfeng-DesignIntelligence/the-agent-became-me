import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CatalogSchema } from "../src/domain/schema";
import {
  runExperiment,
  type ExperimentRow
} from "../src/experiments/run";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(
  root,
  "public/data/open-food-facts.snapshot.json"
);
const outputPath = resolve(root, "public/results/v1/baseline.json");
const summaryPath = resolve(root, "public/results/v1/summary.json");

const metrics = [
  "profileContamination",
  "futureRecommendationRegret",
  "taskUtility",
  "attributionErrorRate",
  "interactionCost",
  "constraintViolations"
] as const;

function quantile(values: number[], probability: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  return (
    ordered[lower] * (upper - position) +
    ordered[upper] * (position - lower)
  );
}

function aggregateRows(
  rows: ExperimentRow[],
  dimensions: Array<keyof ExperimentRow>
) {
  const groups = new Map<string, ExperimentRow[]>();
  for (const row of rows) {
    const key = dimensions.map((dimension) => String(row[dimension])).join("|");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const dimensionValues = Object.fromEntries(
      dimensions.map((dimension) => [dimension, first[dimension]])
    );
    const metricValues = Object.fromEntries(
      metrics.flatMap((metric) => {
        const values = group.map((row) => row[metric]);
        const mean =
          values.reduce((total, value) => total + value, 0) / values.length;
        return [
          [metric, Number(mean.toFixed(6))],
          [`${metric}P10`, Number(quantile(values, 0.1).toFixed(6))],
          [`${metric}P90`, Number(quantile(values, 0.9).toFixed(6))]
        ];
      })
    );
    return {
      ...dimensionValues,
      runCount: group.length,
      ...metricValues
    };
  });
}

const catalog = CatalogSchema.parse(
  JSON.parse(await readFile(catalogPath, "utf8"))
);
const output = runExperiment(catalog.products, new Date().toISOString(), 40);
const summary = {
  schemaVersion: "summary.v1",
  protocolVersion: output.protocolVersion,
  generatedAt: output.generatedAt,
  observedStatus: output.observedStatus,
  catalog: output.catalog,
  design: output.design,
  overallA: aggregateRows(output.studyA, ["condition"]),
  cellsA: aggregateRows(output.studyA, [
    "condition",
    "scenarioId",
    "scenarioLabel",
    "expectedConflict",
    "policy"
  ]),
  overallB: aggregateRows(output.studyB, ["condition"]),
  cellsB: aggregateRows(output.studyB, [
    "condition",
    "scenarioId",
    "scenarioLabel",
    "expectedConflict",
    "policy"
  ]),
  pairedSeedExample: output.studyA.filter(
    (row) =>
      row.scenarioId === "party-snacks" &&
      row.policy === "exploratory" &&
      ["actor-blind", "provenance-aware", "approval-gated"].includes(
        row.condition
      )
  ),
  sensitivity: aggregateRows(output.sensitivity, [
    "condition",
    "labelNoise",
    "learningRate"
  ]),
  representative: output.representative
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

process.stdout.write(
  [
    `Wrote ${output.studyA.length} Study A rows`,
    `${output.studyB.length} Study B rows`,
    `${output.sensitivity.length} sensitivity rows`,
    `to ${outputPath}`,
    `summary to ${summaryPath}`
  ].join(" · ")
);
