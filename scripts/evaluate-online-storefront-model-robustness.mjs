import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/results/online-storefront-model-robustness/v1");
const protocolPath = resolve(root, "experiments/online-storefront-v3/model-protocol.json");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalizedProtocol = (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n");
const protocol = JSON.parse(normalizedProtocol);
const protocolSha256 = hash(Buffer.from(normalizedProtocol));
const summaryBytes = await readFile(resolve(output, "summary.json"));
const rowsBytes = await readFile(resolve(output, "rows.json"));
const contrastsBytes = await readFile(resolve(output, "contrasts.json"));
const manifestBytes = await readFile(resolve(output, "manifest.json"));
const summary = JSON.parse(summaryBytes);
const rows = JSON.parse(rowsBytes);
const contrasts = JSON.parse(contrastsBytes);
const manifest = JSON.parse(manifestBytes);

const expectedRows =
  protocol.tasksPerCategory *
  protocol.categories.length *
  protocol.models.length *
  protocol.checkpointSeeds.length *
  protocol.agentConfigurations.length *
  protocol.modes.length *
  protocol.conditions.length;
const expectedContrasts =
  protocol.tasksPerCategory *
  protocol.categories.length *
  protocol.models.length *
  protocol.checkpointSeeds.length *
  protocol.agentConfigurations.length *
  protocol.modes.length;
const resultFamilies = Object.keys(summary.results ?? {}).sort();
const expectedFamilies = protocol.models.map((row) => row.id).sort();
const coverageKeys = new Set(
  rows.rows.map((row) =>
    [
      row.modelFamily,
      row.category,
      row.taskId,
      row.modelSeed,
      row.agentConfig,
      row.mode,
      row.condition
    ].join("|")
  )
);
const contrastKeys = new Set(
  contrasts.rows.map((row) =>
    [
      row.modelFamily,
      row.category,
      row.taskId,
      row.modelSeed,
      row.agentConfig,
      row.mode
    ].join("|")
  )
);
const fileBytes = {
  "summary.json": summaryBytes,
  "rows.json": rowsBytes,
  "contrasts.json": contrastsBytes
};
const manifestMatches = Object.entries(fileBytes).every(([name, bytes]) => {
  const entry = manifest.files?.[name];
  return entry?.sha256 === hash(bytes) && entry?.bytes === bytes.length;
});
const validationCells = summary.validation ?? [];
const validationCoverage =
  validationCells.length === expectedFamilies.length * protocol.categories.length &&
  validationCells.every(
    (row) =>
      row.seedCount === protocol.checkpointSeeds.length &&
      Number.isFinite(row.meanNdcgAt10) &&
      Number.isFinite(row.meanPopularityNdcgAt10) &&
      Number.isFinite(row.meanOrderChangedTop10Rate)
  );
const familyGateShape = expectedFamilies.every((family) => {
  const result = summary.results?.[family];
  const gates = summary.gates?.byFamily?.[family];
  return (
    result?.fixedTrace?.t1ImmediateHeldDisplacement?.lower95 > 0.15 &&
    result?.fixedTrace?.t2ImmediateHeldDisplacement?.upper95 < 0.05 &&
    result?.fixedTrace?.t3ImmediateHeldDisplacement?.upper95 < 0.05 &&
    gates?.primaryRecurrence === true &&
    gates?.t2Equivalent === true &&
    gates?.t3Equivalent === true &&
    gates?.inertLoggingMatched === true
  );
});
const privacy =
  rows.privacy?.originalUserIdsIncluded === false &&
  rows.privacy?.originalItemIdsIncluded === false &&
  rows.privacy?.productTitlesIncluded === false &&
  rows.privacy?.reviewTextIncluded === false;
const calibratedClaims =
  summary.claims?.notEstablished?.some((value) => value.includes("architecture independence")) &&
  summary.claims?.notEstablished?.some((value) => value.includes("session-parallel")) &&
  summary.claims?.notEstablished?.some((value) => value.includes("production-platform"));

const components = {
  schemas:
    summary.schemaVersion === "online-storefront-model-robustness-summary.v1" &&
    rows.schemaVersion === "online-storefront-model-robustness-rows.v1" &&
    contrasts.schemaVersion === "online-storefront-model-robustness-contrasts.v1" &&
    manifest.schemaVersion === "online-storefront-model-robustness-manifest.v1",
  protocolFrozen:
    protocol.status === "frozen-before-gru4rec-outcome-generation" &&
    summary.protocolSha256 === protocolSha256 &&
    rows.protocolSha256 === protocolSha256 &&
    contrasts.protocolSha256 === protocolSha256 &&
    manifest.protocolSha256 === protocolSha256,
  modelFamilies:
    JSON.stringify(resultFamilies) === JSON.stringify(expectedFamilies) &&
    expectedFamilies.includes("sasrec") &&
    expectedFamilies.includes("gru4rec"),
  completeCoverage:
    rows.rows.length === expectedRows &&
    coverageKeys.size === expectedRows &&
    contrasts.rows.length === expectedContrasts &&
    contrastKeys.size === expectedContrasts,
  learnedValidity:
    validationCoverage &&
    summary.gates?.learnedAndOrderSensitiveInEveryCategory === true,
  recurrenceAndEquivalence: familyGateShape && summary.gates?.allPassed === true,
  privacy,
  evidenceIntegrity: manifestMatches,
  calibratedClaims: Boolean(calibratedClaims)
};
const passed = Object.values(components).filter(Boolean).length;
const result = {
  pass: passed === Object.keys(components).length,
  score: passed / Object.keys(components).length,
  components,
  observed: {
    conditionRowCount: rows.rows.length,
    pairedContrastRowCount: contrasts.rows.length,
    families: Object.fromEntries(
      expectedFamilies.map((family) => [
        family,
        {
          fixedT1: summary.results?.[family]?.fixedTrace?.t1ImmediateHeldDisplacement,
          freeTraceDivergence: summary.results?.[family]?.freeRunning?.traceDivergenceRate
        }
      ])
    )
  }
};
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
