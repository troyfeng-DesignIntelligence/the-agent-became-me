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

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const manifest = await readJson(
  resolve(root, "experiments/webarena-provenance/source-manifest.json")
);
const summary = await readJson(
  resolve(root, "public/results/webarena-pilot/v1/summary.json")
);
const validation = await readJson(
  resolve(root, "artifacts/webarena-provenance/validation.json")
);

let score = 0;
const components = {};

components.sourceProvenance = Boolean(
  manifest?.repository?.commit?.length === 40 &&
    manifest?.files?.length === 3 &&
    manifest.files.every((file) => file.sha256?.length === 64)
);
if (components.sourceProvenance) score += 0.15;

components.taskCorpus = Boolean(
  [
    "webarena-derived-task-pressure-pilot",
    "released-webarena-trajectory-replay"
  ].includes(summary?.studyMode) &&
    summary?.corpus?.shoppingTaskCount === 192 &&
    summary?.corpus?.classificationCoverage === 1
);
if (components.taskCorpus) score += 0.15;

components.externalTrajectories = Boolean(
  summary?.studyMode === "released-webarena-trajectory-replay" &&
    summary?.corpus?.parsedTrajectoryCount >= 20 &&
    summary?.corpus?.parseRate >= 0.9
);
if (components.externalTrajectories) score += 0.2;

components.completeConditions = Boolean(
  summary?.design?.conditions?.length === 6 &&
    summary?.design?.tasksPerCondition === 192 &&
    summary?.results?.length === 6 &&
    summary.results.every((row) => row.runCount === 192)
);
if (components.completeConditions) score += 0.2;

components.deterministic = Boolean(
  validation?.deterministic === true &&
    validation?.summaryHash === stableHash(summary)
);
if (components.deterministic) score += 0.1;

components.reporting = Boolean(
  summary?.evidenceStatus === "pilot-observation" &&
    summary?.limitations?.length >= 4 &&
    summary?.claims?.observed?.length >= 2 &&
    summary?.claims?.notEstablished?.length >= 3
);
if (components.reporting) score += 0.2;

score = Number(score.toFixed(3));
const pass = score >= 0.9 && components.externalTrajectories;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
