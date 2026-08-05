import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summary = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-exposure/v1/summary.json"),
    "utf8"
  )
);
const rows = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-exposure/v1/rows.json"),
    "utf8"
  )
);
const condition = (id) =>
  summary.conditions.find((row) => row.condition === id);
const persist = condition("persist-all");
const dedup = condition("deduplicate-target");
const weighted = condition("intent-weighted");
const quarantine = condition("outcome-quarantine");
const rollback = condition("rollback-on-failure");
const scope = condition("scope-gated");

const components = {
  completeDesign: Boolean(
    summary.design.scenarioCount === 5 &&
      summary.design.seedsPerScenario === 40 &&
      summary.design.conditionCount === 6 &&
      summary.design.runCount === 1200 &&
      rows.rows.length === 1200
  ),
  frozenSurfaces: Boolean(
    summary.design.provisionalSurfaceCount === 4 &&
      summary.design.followUpRoundCount === 8 &&
      summary.design.recommendationSlotsPerRound === 6
  ),
  targetIdentity: Boolean(
    persist.meanTemporaryEvidenceMass === dedup.meanTemporaryEvidenceMass &&
      persist.meanPostTaskExposureCount === dedup.meanPostTaskExposureCount
  ),
  exposureGradient: Boolean(
    persist.meanPostTaskExposureCount >
      weighted.meanPostTaskExposureCount &&
      weighted.meanPostTaskExposureCount > 0
  ),
  postOutcomeSafety: Boolean(
    quarantine.meanPostTaskExposureCount === 0 &&
      rollback.meanPostTaskExposureCount === 0 &&
      scope.meanPostTaskExposureCount === 0
  ),
  provisionalDistinction: Boolean(
    quarantine.meanProvisionalExcessExposureCount === 0 &&
      rollback.meanProvisionalExcessExposureCount > 0
  ),
  downstreamUtility: Boolean(
    quarantine.meanCurrentTaskRecommendationShare >
      persist.meanCurrentTaskRecommendationShare
  ),
  recoveryMeasured: Boolean(
    persist.meanFirstCleanRound > weighted.meanFirstCleanRound &&
      weighted.meanFirstCleanRound >= 1
  ),
  calibratedClaims: Boolean(
    summary.claims.observed.length >= 3 &&
      summary.claims.notEstablished.length >= 3
  )
};
const weights = {
  completeDesign: 0.15,
  frozenSurfaces: 0.1,
  targetIdentity: 0.1,
  exposureGradient: 0.15,
  postOutcomeSafety: 0.15,
  provisionalDistinction: 0.15,
  downstreamUtility: 0.08,
  recoveryMeasured: 0.07,
  calibratedClaims: 0.05
};
const score = Number(
  Object.entries(components)
    .reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0)
    .toFixed(3)
);
const pass =
  score >= 0.9 &&
  components.completeDesign &&
  components.exposureGradient &&
  components.postOutcomeSafety &&
  components.provisionalDistinction;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
