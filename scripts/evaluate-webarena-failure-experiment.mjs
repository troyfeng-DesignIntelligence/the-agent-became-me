import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
const stableHash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const summary = await readJson(
  resolve(root, "public/results/webarena-failure/v1/summary.json")
);
const validation = await readJson(
  resolve(
    root,
    "artifacts/webarena-provenance/webarena-failure-validation.json"
  )
);

const components = {
  sourceIntegrity: Boolean(
    summary?.source?.trajectorySha256?.length === 64 &&
      summary?.source?.ocrSha256?.length === 64
  ),
  traceCoverage: Boolean(
    summary?.corpus?.traceCount === 192 &&
      summary?.corpus?.auditedStepCount === 1740
  ),
  ocrAvailability: Boolean(
    summary?.mapperValidation?.ocrAvailabilityRate >= 0.9 &&
      summary?.mapperValidation?.ocrCorroborationRate >= 0.9
  ),
  mapperPrecision: Boolean(
    summary?.mapperValidation?.knownUiControlEventCount === 0 &&
      summary?.mapperValidation?.evidenceKindCounts?.product > 0 &&
      summary?.mapperValidation?.evidenceKindCounts?.review > 0 &&
      summary?.mapperValidation?.evidenceKindCounts?.shortlist > 0 &&
      summary?.mapperValidation?.evidenceKindCounts?.purchase > 0
  ),
  screenshotAudit: Boolean(
    summary?.screenshotValidation?.recordCount === 8 &&
      summary?.screenshotValidation?.boundaryCount === 4 &&
      summary?.screenshotValidation?.controlCount === 4 &&
      summary?.screenshotValidation?.visibleCount === 8 &&
      summary?.screenshotValidation?.validEvidenceTargetCount === 8
  ),
  loopAnalysis: Boolean(
    summary?.loopAnalysis?.conservativeExactTarget?.eventCount ===
      summary?.corpus?.mappedEventCount &&
      summary?.loopAnalysis?.labelOnlySensitivity?.eventCount ===
        summary?.corpus?.mappedEventCount
  ),
  lifecycleConditions: Boolean(
    summary?.design?.conditions?.length === 6 &&
      summary?.conditions?.length === 6 &&
      summary.conditions.every((row) => row.runCount === 192) &&
      summary?.observedComparisons?.quarantineRollbackFinalDifference === 0
  ),
  deterministic: Boolean(
    validation?.deterministic === true &&
      validation?.summaryHash === stableHash(summary) &&
      validation?.rowCount === 1152
  ),
  calibratedReporting: Boolean(
    summary?.claims?.observed?.length >= 3 &&
      summary?.claims?.notEstablished?.length >= 4 &&
      summary?.limitations?.length >= 5
  )
};
const weights = {
  sourceIntegrity: 0.1,
  traceCoverage: 0.1,
  ocrAvailability: 0.1,
  mapperPrecision: 0.1,
  screenshotAudit: 0.1,
  loopAnalysis: 0.1,
  lifecycleConditions: 0.15,
  deterministic: 0.1,
  calibratedReporting: 0.15
};
const score = Number(
  Object.entries(components)
    .reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0)
    .toFixed(3)
);
const pass =
  score >= 0.9 &&
  components.ocrAvailability &&
  components.mapperPrecision &&
  components.screenshotAudit &&
  components.lifecycleConditions;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
