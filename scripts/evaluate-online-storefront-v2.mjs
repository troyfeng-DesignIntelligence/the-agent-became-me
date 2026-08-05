import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const protocolPath = resolve(
  root,
  "experiments/online-storefront-v2/protocol.json"
);
const resultRoot = resolve(root, "public/results/online-storefront-v2/v1");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const digest = (value) =>
  createHash("sha256").update(value).digest("hex");

const protocol = await readJson(protocolPath);
const protocolSha256 = digest(canonical(protocol));
const summary = await readJson(resolve(resultRoot, "summary.json"));
const conditionRows = await readJson(resolve(resultRoot, "rows.json"));
const contrasts = await readJson(resolve(resultRoot, "contrasts.json"));
const bundle = await readJson(resolve(resultRoot, "model-bundle.json"));
const manifest = await readJson(resolve(resultRoot, "manifest.json"));

const requiredConditions = protocol.conditions.map((row) => row.id);
const requiredModes = protocol.modes;
const requiredConfigs = protocol.agentConfigurations.map((row) => row.id);
const expectedConditionRows =
  protocol.sampling.totalTaskCount *
  protocol.models.checkpointSeeds.length *
  requiredConfigs.length *
  requiredModes.length *
  requiredConditions.length;
const expectedContrasts =
  protocol.sampling.totalTaskCount *
  protocol.models.checkpointSeeds.length *
  requiredConfigs.length *
  requiredModes.length;

const manifestChecks = await Promise.all(
  Object.entries(manifest.files).map(async ([name, expected]) => {
    const path = resolve(resultRoot, name);
    const bytes = await readFile(path);
    const metadata = await stat(path);
    return (
      metadata.size === expected.bytes &&
      digest(bytes) === expected.sha256
    );
  })
);

const keys = new Set();
const collectKeys = (value) => {
  if (Array.isArray(value)) value.forEach(collectKeys);
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      keys.add(key.toLowerCase());
      collectKeys(child);
    });
  }
};
collectKeys(conditionRows);
collectKeys(contrasts);

const allConditions = new Set(conditionRows.rows.map((row) => row.condition));
const allModes = new Set(conditionRows.rows.map((row) => row.mode));
const allConfigs = new Set(conditionRows.rows.map((row) => row.agentConfig));
const fixed = contrasts.rows.filter((row) => row.mode === "fixed-trace");
const free = contrasts.rows.filter((row) => row.mode === "free-running");
const gates = summary.confirmatory.gates;
const failures = summary.failuresAndNegativeCases;

const components = {
  schemas:
    summary.schemaVersion === "online-storefront-v2-summary.v1" &&
    conditionRows.schemaVersion === "online-storefront-v2-condition-rows.v1" &&
    contrasts.schemaVersion === "online-storefront-v2-contrasts.v1" &&
    bundle.schemaVersion === "online-storefront-v2-model-bundle.v1" &&
    manifest.schemaVersion === "online-storefront-v2-manifest.v1",
  protocolFrozen:
    protocol.status === "frozen-before-v2-outcome-generation" &&
    [summary, conditionRows, contrasts, bundle, manifest].every(
      (artifact) => artifact.protocolSha256 === protocolSha256
    ),
  completeCoverage:
    summary.design.taskCount === protocol.sampling.totalTaskCount &&
    summary.design.categoryCounts.length === protocol.sampling.categoryCount &&
    summary.design.categoryCounts.every(
      (row) => row.taskCount === protocol.sampling.tasksPerCategory
    ) &&
    conditionRows.rows.length === expectedConditionRows &&
    contrasts.rows.length === expectedContrasts &&
    requiredConditions.every((condition) => allConditions.has(condition)) &&
    requiredModes.every((mode) => allModes.has(mode)) &&
    requiredConfigs.every((config) => allConfigs.has(config)),
  trainedModel:
    summary.evidenceStatus.includes("trained-SASRec") &&
    bundle.model.name === "SASRec" &&
    bundle.model.checkpointSeeds.length === 3 &&
    bundle.model.inference.includes("trained PyTorch checkpoints"),
  fixedTraceIntegrity:
    fixed.length === expectedContrasts / 2 &&
    fixed.every(
      (row) =>
        row.immediateTraceId === row.heldTraceId &&
        row.t0ImmediateHeldDisplacement === 0
    ),
  inertLoggingIntegrity:
    contrasts.rows.every(
      (row) =>
        row.noMemoryLoggedMaxDisplacement === 0 &&
        row.noMemoryLoggedTraceMatched
    ) && gates.noMemoryAndLoggedInertMatched,
  primaryGate:
    gates.primaryLowerBoundAbove015 &&
    summary.confirmatory.fixedTrace.primaryT1ImmediateHeldDisplacement.lower95 >
      protocol.primaryEstimand.goThreshold,
  equivalenceGates:
    gates.t2EquivalentWithin005 &&
    gates.t3EquivalentWithin005 &&
    summary.confirmatory.fixedTrace.t2ImmediateHeldDisplacement.upper95 <
      protocol.equivalence.margin &&
    summary.confirmatory.fixedTrace.t3ImmediateHeldDisplacement.upper95 <
      protocol.equivalence.margin,
  freeRunningAgents:
    free.length === expectedContrasts / 2 &&
    requiredConfigs.every((config) =>
      free.some((row) => row.agentConfig === config)
    ) &&
    Number.isFinite(
      summary.confirmatory.freeRunning.traceDivergenceRate.estimate
    ),
  utilityNonInferiority:
    gates.decisionAccuracyNonInferior &&
    gates.selectedUtilityNonInferior &&
    summary.confirmatory.freeRunning.heldMinusImmediateDecisionAccuracy.lower95 >
      protocol.taskUtility.nonInferiorityMargin &&
    summary.confirmatory.freeRunning.heldMinusImmediateSelectedUtility.lower95 >
      protocol.taskUtility.nonInferiorityMargin,
  failureAccounting:
    [
      "protocolDeviationCount",
      "emptySlateCount",
      "missingCheckpointCount",
      "agentTimeoutCount",
      "incorrectDecisionCount",
      "abandonedRunCount",
      "nullPrimaryPairCount"
    ].every((key) => Number.isInteger(failures[key]) && failures[key] >= 0),
  privacy:
    conditionRows.privacy.originalUserIdsIncluded === false &&
    conditionRows.privacy.originalItemIdsIncluded === false &&
    conditionRows.privacy.productTitlesIncluded === false &&
    conditionRows.privacy.reviewTextIncluded === false &&
    !["asin", "reviewerid", "reviewtext", "title", "rawuserid", "rawitemid"].some(
      (key) => keys.has(key)
    ),
  evidenceIntegrity:
    Object.keys(manifest.files).length === 4 &&
    manifestChecks.every(Boolean) &&
    bundle.representativeCases.length === 4,
  calibratedClaims:
    summary.claims.observed.length >= 3 &&
    summary.claims.notEstablished.length >= 4 &&
    summary.claims.notEstablished.some((claim) => claim.includes("not frontier LLM")) &&
    summary.claims.notEstablished.some((claim) => claim.includes("does not manipulate Amazon.com"))
};

const weights = {
  schemas: 0.05,
  protocolFrozen: 0.1,
  completeCoverage: 0.1,
  trainedModel: 0.1,
  fixedTraceIntegrity: 0.1,
  inertLoggingIntegrity: 0.08,
  primaryGate: 0.12,
  equivalenceGates: 0.1,
  freeRunningAgents: 0.08,
  utilityNonInferiority: 0.07,
  failureAccounting: 0.03,
  privacy: 0.03,
  evidenceIntegrity: 0.02,
  calibratedClaims: 0.02
};
const score = Number(
  Object.entries(components)
    .reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0)
    .toFixed(3)
);
const pass = Object.values(components).every(Boolean);

process.stdout.write(
  `${JSON.stringify({
    pass,
    score,
    components,
    observed: {
      fixedT1: summary.confirmatory.fixedTrace.primaryT1ImmediateHeldDisplacement,
      freeTraceDivergence: summary.confirmatory.freeRunning.traceDivergenceRate,
      failureCounts: failures
    }
  })}\n`
);
if (!pass) process.exitCode = 1;
