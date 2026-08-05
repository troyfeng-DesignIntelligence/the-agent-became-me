import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AMAZON_LIFECYCLE_CONDITIONS,
  assertAmazonLifecycle,
  replayAmazonLifecycle,
  type AmazonFieldTrace,
  type AmazonLifecycleRow
} from "../src/amazon/field-lifecycle";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fieldPath = resolve(
  root,
  "public/results/amazon-field-probe/v1/field-summary.json"
);
const outputDir = resolve(root, "public/results/amazon-field-probe/v1");
const fieldBytes = await readFile(fieldPath);
const field = JSON.parse(fieldBytes.toString("utf8")) as {
  executedAt: string;
  execution: {
    completedConditionCount: number;
    stopped: boolean;
    totalNavigations: number;
    researchCumulativeNavigations: number;
  };
  observations: Array<{
    condition: string;
    cleanup: { attempted: boolean; cartCountAfter: number | null };
  }>;
};

if (
  field.execution.completedConditionCount !== 4 ||
  field.execution.stopped ||
  field.execution.researchCumulativeNavigations > 24
) {
  throw new Error("Live field probe did not satisfy the frozen execution gate");
}
const cart = field.observations.find((row) => row.condition === "cart-stage");
if (!cart?.cleanup.attempted || cart.cleanup.cartCountAfter !== 0) {
  throw new Error("Anonymous cart was not verified empty after the probe");
}

const traces: AmazonFieldTrace[] = [
  { traceId: "idle-control", outcome: "abandoned", events: [] },
  {
    traceId: "search-only",
    outcome: "abandoned",
    events: [
      { action: "search", intent: "explore", targetKey: "phone-task-query" }
    ]
  },
  {
    traceId: "product-view",
    outcome: "abandoned",
    events: [
      { action: "search", intent: "explore", targetKey: "phone-task-query" },
      { action: "product-view", intent: "explore", targetKey: "view:phone-result-1" },
      { action: "product-view", intent: "explore", targetKey: "view:phone-result-2" }
    ]
  },
  {
    traceId: "cart-stage",
    outcome: "abandoned",
    events: [
      { action: "search", intent: "explore", targetKey: "phone-task-query" },
      { action: "product-view", intent: "explore", targetKey: "view:phone-result-1" },
      { action: "add-to-cart", intent: "consider", targetKey: "cart:phone-result-1" }
    ]
  }
];

const rows = traces.flatMap((trace) =>
  AMAZON_LIFECYCLE_CONDITIONS.map((condition) =>
    replayAmazonLifecycle(trace, condition)
  )
);
assertAmazonLifecycle(rows, traces.length);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number) => Number(value.toFixed(6));
const aggregate = AMAZON_LIFECYCLE_CONDITIONS.map((condition) => {
  const group = rows.filter((row) => row.condition === condition);
  return {
    condition,
    runCount: group.length,
    totalProvisionalProfileMass: round(
      sum(group.map((row) => row.provisionalProfileMass))
    ),
    totalStagedEvidenceMass: round(
      sum(group.map((row) => row.stagedEvidenceMass))
    ),
    totalFinalPersistentMass: round(
      sum(group.map((row) => row.finalPersistentMass))
    ),
    totalRollbackMass: round(sum(group.map((row) => row.rollbackMass))),
    totalFailedResidualMass: round(
      sum(group.map((row) => row.failedResidualMass))
    )
  };
});
const quarantine = aggregate.find(
  (row) => row.condition === "outcome-quarantine"
)!;
const rollback = aggregate.find(
  (row) => row.condition === "rollback-on-failure"
)!;

const summary = {
  schemaVersion: "amazon-field-controlled-lifecycle.v1",
  evidenceStatus: "controlled-counterfactual-replay",
  fieldArtifactSha256: createHash("sha256").update(fieldBytes).digest("hex"),
  sourceFieldExecutedAt: field.executedAt,
  design: {
    traceCount: traces.length,
    conditions: AMAZON_LIFECYCLE_CONDITIONS,
    rowCount: rows.length,
    outcome: "abandoned temporary task",
    awsStatus:
      "Amazon Personalize-compatible interaction export prepared; no paid AWS resources provisioned"
  },
  conditions: aggregate,
  observedComparisons: {
    quarantineRollbackFinalDifference: round(
      quarantine.totalFinalPersistentMass - rollback.totalFinalPersistentMass
    ),
    quarantineProvisionalMass: quarantine.totalProvisionalProfileMass,
    rollbackProvisionalMass: rollback.totalProvisionalProfileMass,
    rollbackRemovedMass: rollback.totalRollbackMass
  },
  claims: {
    observed: [
      "The live signed-out action contracts create different provisional and final evidence mass under the executable local lifecycle policies.",
      "Quarantine and rollback finish identically for abandoned tasks but differ in provisional exposure."
    ],
    notEstablished: [
      "The local event weights or lifecycle policies reproduce Amazon.com internals.",
      "Amazon Personalize was provisioned or queried.",
      "The field probe establishes account-level or long-term personalization."
    ]
  }
};

const interactions = [
  "USER_ID,ITEM_ID,TIMESTAMP,EVENT_TYPE",
  "search-only,phone-task-results,1785844800,SEARCH_RESULT_EXPOSURE",
  "product-view,phone-task-results,1785844800,SEARCH_RESULT_EXPOSURE",
  "product-view,phone-result-1,1785844805,VIEW",
  "product-view,phone-result-2,1785844810,VIEW",
  "cart-stage,phone-task-results,1785844800,SEARCH_RESULT_EXPOSURE",
  "cart-stage,phone-result-1,1785844805,VIEW",
  "cart-stage,phone-result-1,1785844810,ADD_TO_CART"
].join("\n");

await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, "controlled-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDir, "controlled-rows.json"),
  `${JSON.stringify(
    { schemaVersion: "amazon-field-controlled-rows.v1", rows },
    null,
    2
  )}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDir, "personalize-interactions.csv"),
  `${interactions}\n`,
  "utf8"
);
process.stdout.write(`Wrote ${rows.length} controlled lifecycle rows\n`);
