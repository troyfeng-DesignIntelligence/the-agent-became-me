import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const baselineRoot = path.join(root, "public/results/online-storefront-cross-llm-pilot/v1");
const sensitivityRoot = path.join(root, "public/results/online-storefront-decoding-sensitivity/v1");
const temperatures = [0, 0.1, 0.2, 0.3];
const providers = ["mimo", "deepseek"];
const label = (value) => String(value).replace(".", "p");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const cells = {};
for (const provider of providers) {
  cells[provider] = [];
  for (const temperature of temperatures) {
    const source = temperature === 0
      ? path.join(baselineRoot, provider)
      : path.join(sensitivityRoot, `${provider}-temperature-${label(temperature)}`);
    const summary = await readJson(path.join(source, "summary.json"));
    const rows = (await readJson(path.join(source, "rows.json"))).rows;
    if (rows.length !== summary.design.trajectoryCount) throw new Error(`${provider} ${temperature} trajectory count mismatch.`);
    if (summary.api.validActionRate !== 1) throw new Error(`${provider} ${temperature} contains invalid model actions.`);
    const terminalActions = rows.length;
    const modelActions = summary.api.validActionCount;
    const viewActions = modelActions - terminalActions;
    if (viewActions < 0) throw new Error(`${provider} ${temperature} has fewer model actions than terminal traces.`);
    const selected = rows.filter((row) => row.outcome === "selected").length;
    const abandoned = rows.filter((row) => row.outcome === "abandoned").length;
    cells[provider].push({
      temperature,
      trajectoryCount: rows.length,
      modelActionCount: modelActions,
      modelViewActionCount: viewActions,
      meanModelActionsPerTrajectory: modelActions / rows.length,
      meanModelViewsPerTrajectory: viewActions / rows.length,
      selectedTrajectoryCount: selected,
      abandonedTrajectoryCount: abandoned,
      exposureTraceDivergenceRate: summary.descriptive.exposureTraceDivergenceRate,
      shamTraceDivergenceRate: summary.descriptive.shamTraceDivergenceRate,
      adjustedPersistentFeedback: summary.descriptive.adjustedPersistentFeedback
    });
  }
}

const mimoSingleDecisionAcrossGrid = cells.mimo.every((cell) => cell.modelViewActionCount === 0);
const deepseekExploresAcrossGrid = cells.deepseek.every((cell) => cell.modelViewActionCount > 0);
const output = {
  schemaVersion: "online-storefront-interaction-depth-diagnostic.v1",
  generatedAt: new Date().toISOString(),
  derivation: "Every valid trajectory has exactly one terminal select-or-abandon model action in the frozen runner. Model view actions therefore equal valid model actions minus completed trajectories.",
  cells,
  diagnostic: {
    mimoSingleDecisionAcrossGrid,
    deepseekExploresAcrossGrid,
    decision:
      mimoSingleDecisionAcrossGrid && deepseekExploresAcrossGrid
        ? "interaction-depth-confounded-with-provider"
        : "interaction-depth-does-not-separate-providers"
  },
  claimBoundary: "This accounting identifies a structural trace difference. It does not show that forcing additional inspection will cause exposure-mediated divergence; that requires a separate intervention."
};

const outputPath = path.join(sensitivityRoot, "interaction-depth-summary.json");
await mkdir(sensitivityRoot, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(
  path.join(sensitivityRoot, "interaction-depth-manifest.json"),
  `${JSON.stringify({
    schemaVersion: "online-storefront-interaction-depth-manifest.v1",
    files: {
      "interaction-depth-summary.json": {
        sha256: sha256(await readFile(outputPath)),
        bytes: (await readFile(outputPath)).byteLength
      }
    }
  }, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify({ pass: true, diagnostic: output.diagnostic, cells }, null, 2));
