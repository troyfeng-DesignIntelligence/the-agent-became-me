import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const results = path.resolve(root, "public/results/online-storefront-pilot/v1");
const evidence = path.resolve(root, "public/evidence/online-storefront-pilot/v1");
const summary = JSON.parse(await readFile(path.join(results, "summary.json"), "utf8"));
const rows = JSON.parse(await readFile(path.join(results, "rows.json"), "utf8"));
const traces = JSON.parse(await readFile(path.join(results, "traces.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(evidence, "manifest.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const components = {
  schemas:
    summary.schemaVersion === "online-storefront-pilot.v1" &&
    rows.schemaVersion === "online-storefront-rows.v1" &&
    traces.schemaVersion === "online-storefront-traces.v1" &&
    manifest.schemaVersion === "online-storefront-evidence.v1",
  coverage:
    summary.design.taskCount === 8 &&
    summary.design.snapshotCount === 64 &&
    rows.rows.length === 32 &&
    traces.runs.length === 16,
  fixedTraces: summary.observedComparisons.allFixedTracesMatched === true,
  taskLocalFirewall:
    summary.observedComparisons.allTaskLocalRecommendationsMatched === true &&
    rows.rows.every((row) => row.taskLocalDisplacementAt10 === 0),
  matchedBoundaries:
    summary.observedComparisons.allStartStatesMatched === true &&
    summary.observedComparisons.allResolvedStatesMatched === true &&
    summary.observedComparisons.allNextTaskStatesMatched === true,
  cleanBrowserRun:
    summary.observedComparisons.consoleErrorCount === 0 &&
    summary.observedComparisons.popupCount === 0,
  allowedCapabilities:
    summary.design.prohibitedCapabilities.includes("checkout") &&
    traces.runs.every((run) =>
      run.trace.every((event) => ["view", "select", "abandon", "next-task"].includes(event.action))
    ),
  publicPrivacy:
    !JSON.stringify({ summary, rows, traces }).includes("off-") &&
    traces.runs.every((run) => run.snapshots.every((snapshot) =>
      [...snapshot.platform, ...snapshot.taskLocal, ...snapshot.viewedIds].every((id) => /^P[A-F0-9]{10}$/.test(id))
    )),
  calibratedClaims:
    summary.claims.notEstablished.some((claim) => claim.includes("third-party commerce platform")) &&
    summary.evidenceStatus.includes("research-owned storefront"),
  evidenceIntegrity: true
};

for (const file of manifest.files) {
  const bytes = await readFile(path.join(evidence, file.name));
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
    components.evidenceIntegrity = false;
  }
}

const pass = Object.values(components).every(Boolean);
process.stdout.write(`${JSON.stringify({
  pass,
  score: Object.values(components).filter(Boolean).length / Object.keys(components).length,
  components,
  observedInProgressChangedTaskCount: summary.observedComparisons.inProgressChangedTaskCount
})}\n`);
if (!pass) process.exitCode = 1;
