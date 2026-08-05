import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));
const field = await readJson(
  "public/results/amazon-field-probe/v1/field-summary.json"
);
const controlled = await readJson(
  "public/results/amazon-field-probe/v1/controlled-summary.json"
);
const rows = await readJson(
  "public/results/amazon-field-probe/v1/controlled-rows.json"
);
const preflight = await readJson(
  "experiments/amazon-field-probe/preflight-result.json"
);
const interactions = await readFile(
  resolve(
    root,
    "public/results/amazon-field-probe/v1/personalize-interactions.csv"
  ),
  "utf8"
);
const fieldHash = createHash("sha256")
  .update(
    await readFile(
      resolve(root, "public/results/amazon-field-probe/v1/field-summary.json")
    )
  )
  .digest("hex");

const cart = field.observations.find(
  (row) => row.condition === "cart-stage"
);
const productView = field.observations.find(
  (row) => row.condition === "product-view"
);
const components = {
  complianceGate: Boolean(
    preflight.navigationCount === 1 &&
      preflight.blocked === false &&
      Object.values(preflight.guardSignals).every((value) => value === false)
  ),
  liveCoverage: Boolean(
    field.execution.completedConditionCount === 4 &&
      field.execution.stopped === false &&
      field.execution.fatal === null &&
      field.execution.totalNavigations <= 24 &&
      field.execution.researchCumulativeNavigations === 24
  ),
  cleanup: Boolean(
    cart?.cleanup?.attempted === true && cart?.cleanup?.cartCountAfter === 0
  ),
  visibleObservation: Boolean(
    productView?.moduleDelta?.length >= 1 &&
      Object.values(productView?.taskTokenDelta ?? {}).some(
        (value) => value > 0
      )
  ),
  controlledCompleteness: Boolean(
    controlled.design.traceCount === 4 &&
      controlled.design.conditions.length === 6 &&
      controlled.design.rowCount === 24 &&
      rows.rows.length === 24 &&
      controlled.observedComparisons.quarantineRollbackFinalDifference === 0
  ),
  targetIdentity: Boolean(
    controlled.conditions.find((row) => row.condition === "persist-all")
      ?.totalFailedResidualMass ===
      controlled.conditions.find(
        (row) => row.condition === "deduplicate-target"
      )?.totalFailedResidualMass
  ),
  provisionalDistinction: Boolean(
    controlled.observedComparisons.quarantineProvisionalMass === 0 &&
      controlled.observedComparisons.rollbackProvisionalMass > 0 &&
      controlled.observedComparisons.rollbackRemovedMass ===
        controlled.observedComparisons.rollbackProvisionalMass
  ),
  artifactLinkage: Boolean(
    controlled.fieldArtifactSha256 === fieldHash &&
      interactions.startsWith("USER_ID,ITEM_ID,TIMESTAMP,EVENT_TYPE") &&
      interactions.trim().split(/\r?\n/).length === 8
  ),
  calibratedClaims: Boolean(
    field.claims.notEstablished.length >= 3 &&
      controlled.claims.notEstablished.length >= 3
  )
};
const weights = {
  complianceGate: 0.1,
  liveCoverage: 0.15,
  cleanup: 0.1,
  visibleObservation: 0.1,
  controlledCompleteness: 0.1,
  targetIdentity: 0.1,
  provisionalDistinction: 0.15,
  artifactLinkage: 0.1,
  calibratedClaims: 0.1
};
const score = Number(
  Object.entries(components)
    .reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0)
    .toFixed(3)
);
const pass =
  score >= 0.9 &&
  components.liveCoverage &&
  components.cleanup &&
  components.controlledCompleteness &&
  components.targetIdentity &&
  components.provisionalDistinction;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
