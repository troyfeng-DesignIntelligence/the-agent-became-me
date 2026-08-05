import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summary = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-sensitivity/v1/summary.json"),
    "utf8"
  )
);
const rows = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-sensitivity/v1/rows.json"),
    "utf8"
  )
);
const cells = summary.cells;
const mean = (members, key) =>
  members.reduce((total, row) => total + row[key], 0) / members.length;
const atWeight = (weight) => cells.filter((cell) => cell.profileWeight === weight);
const atDecay = (decay) => cells.filter((cell) => cell.decayRate === decay);
const components = {
  completeGrid: Boolean(
    summary.design.cellCount === 250 &&
      summary.design.runCount === 25000 &&
      summary.design.runsPerCell === 100 &&
      rows.rows.length === 25000
  ),
  pairedCounterfactualDefinition: summary.design.pollutionDefinition.includes(
    "paired no-temporary-profile"
  ),
  phaseExists: Boolean(
    summary.observedComparisons.zeroPollutionCellShare > 0 &&
      summary.observedComparisons.positivePollutionCellShare > 0
  ),
  profileWeightGradient: Boolean(
    mean(atWeight(0.8), "meanPostTaskExcessExposureCount") >
      mean(atWeight(0.2), "meanPostTaskExcessExposureCount")
  ),
  decayGradient: Boolean(
    mean(atDecay(0), "meanPostTaskExcessExposureCount") >
      mean(atDecay(0.85), "meanPostTaskExcessExposureCount")
  ),
  conditionContrast:
    summary.observedComparisons.persistVsIntentDifference > 0,
  boundedMetric: cells.every(
    (cell) =>
      cell.pollutionRunRate >= 0 &&
      cell.pollutionRunRate <= 1 &&
      cell.meanPostTaskExcessExposureCount >= 0 &&
      cell.meanPostTaskExcessExposureCount <= 48
  ),
  calibratedClaims: Boolean(
    summary.claims.observed.length >= 3 &&
      summary.claims.notEstablished.length >= 3
  )
};
const weights = {
  completeGrid: 0.2,
  pairedCounterfactualDefinition: 0.15,
  phaseExists: 0.15,
  profileWeightGradient: 0.15,
  decayGradient: 0.15,
  conditionContrast: 0.08,
  boundedMetric: 0.07,
  calibratedClaims: 0.05
};
const score = Number(
  Object.entries(components)
    .reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0)
    .toFixed(3)
);
const pass =
  score >= 0.9 &&
  components.completeGrid &&
  components.pairedCounterfactualDefinition &&
  components.phaseExists;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
