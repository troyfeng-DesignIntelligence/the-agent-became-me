import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CROSS_TASK_SCENARIOS,
  generateCrossTaskRuns,
  summarizeCrossTaskRuns
} from "../src/amazon/cross-task-exposure";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "public/results/cross-task-exposure/v1");
const fieldPath = resolve(
  root,
  "public/results/amazon-field-probe/v1/field-summary.json"
);
const fieldArtifactSha256 = createHash("sha256")
  .update(await readFile(fieldPath))
  .digest("hex");

const runs = generateCrossTaskRuns(40, "abandoned");
const conditions = summarizeCrossTaskRuns(runs);
const byCondition = new Map(conditions.map((row) => [row.condition, row]));
const persist = byCondition.get("persist-all")!;
const weighted = byCondition.get("intent-weighted")!;
const quarantine = byCondition.get("outcome-quarantine")!;
const rollback = byCondition.get("rollback-on-failure")!;
const scope = byCondition.get("scope-gated")!;
const round = (value: number) => Number(value.toFixed(6));

const summary = {
  schemaVersion: "cross-task-recommendation-exposure.v1",
  evidenceStatus: "controlled-synthetic-experiment",
  fieldArtifactSha256,
  generatedAt: new Date().toISOString(),
  design: {
    scenarioCount: CROSS_TASK_SCENARIOS.length,
    seedsPerScenario: 40,
    conditionCount: conditions.length,
    runCount: runs.length,
    provisionalSurfaceCount: 4,
    followUpRoundCount: 8,
    recommendationSlotsPerRound: 6,
    outcome: "abandoned temporary task",
    frozenCurrentTaskTopic: "everyday-home"
  },
  scenarios: CROSS_TASK_SCENARIOS,
  conditions,
  observedComparisons: {
    persistVsIntentPostExposureDifference: round(
      persist.meanPostTaskExposureCount - weighted.meanPostTaskExposureCount
    ),
    quarantineRollbackPostExposureDifference: round(
      quarantine.meanPostTaskExposureCount - rollback.meanPostTaskExposureCount
    ),
    rollbackVsQuarantineProvisionalExposureDifference: round(
      rollback.meanProvisionalExcessExposureCount -
        quarantine.meanProvisionalExcessExposureCount
    ),
    quarantinePostTaskExposureCount: quarantine.meanPostTaskExposureCount,
    scopePostTaskExposureCount: scope.meanPostTaskExposureCount,
    currentTaskShareGainQuarantineVsPersist: round(
      quarantine.meanCurrentTaskRecommendationShare -
        persist.meanCurrentTaskRecommendationShare
    )
  },
  claims: {
    observed: [
      "In the controlled recommender, temporary-task profile evidence produced measurable recommendation exposure during later unrelated tasks.",
      "Quarantine and rollback removed post-outcome spillover for abandoned tasks, but rollback allowed provisional recommendation exposure before outcome resolution.",
      "Intent weighting reduced exposure relative to persist-all without guaranteeing zero spillover."
    ],
    notEstablished: [
      "The exposure counts estimate Amazon.com or another commercial platform.",
      "People would notice, dislike, or be harmed by the simulated recommendations.",
      "The hand-authored ranking weights are behaviorally or commercially calibrated."
    ]
  }
};

const compactRows = runs.map(({ snapshots: _snapshots, ...run }) => run);
await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDir, "rows.json"),
  `${JSON.stringify(
    { schemaVersion: "cross-task-recommendation-exposure-rows.v1", rows: compactRows },
    null,
    2
  )}\n`,
  "utf8"
);
process.stdout.write(`Wrote ${runs.length} cross-task exposure runs\n`);
