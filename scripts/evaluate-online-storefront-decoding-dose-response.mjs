import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const preflight = process.argv.includes("--preflight");
const protocolPath = path.join(root, "experiments/online-storefront-v4/decoding-dose-response-protocol.json");
const resultRoot = path.join(root, "public/results/online-storefront-decoding-sensitivity/v1");
const baselineRoot = path.join(root, "public/results/online-storefront-cross-llm-pilot/v1");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const taskKey = (row) => `${row.category}|${row.taskId}|${row.modelSeed}|${row.modelFamily}|${row.agentConfig}`;
const keySet = (payload) => new Set(payload.rows.map(taskKey));
const sameSet = (a, b) => a.size === b.size && [...a].every((value) => b.has(value));
const label = (temperature) => String(temperature).replace(".", "p");

const protocolText = (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n");
const protocol = JSON.parse(protocolText);
if (protocol.status !== "frozen-before-any-temperature-0.1-or-0.2-provider-call") throw new Error("Dose-response protocol is not frozen.");
if (JSON.stringify(protocol.generation.temperatureGrid) !== JSON.stringify([0.1, 0.2])) throw new Error("Unexpected frozen temperature grid.");

const baseline = {};
for (const provider of ["mimo", "deepseek"]) {
  baseline[provider] = {
    summary: await readJson(path.join(baselineRoot, provider, "summary.json")),
    contrasts: await readJson(path.join(baselineRoot, provider, "contrasts.json"))
  };
}
const frozenKeys = keySet(baseline.mimo.contrasts);
if (frozenKeys.size !== 64 || !sameSet(frozenKeys, keySet(baseline.deepseek.contrasts))) throw new Error("Baseline task-cell mismatch.");

if (preflight) {
  console.log(JSON.stringify({pass:true, mode:"preflight", protocolSha256:sha256(Buffer.from(protocolText)), frozenTaskCellCount:frozenKeys.size, temperatureGrid:protocol.generation.temperatureGrid, decisionRules:protocol.decisionRules}, null, 2));
  process.exit(0);
}

const summaries = {mimo: {}, deepseek: {}};
const sources = {
  0: (provider) => path.join(baselineRoot, provider),
  0.1: (provider) => path.join(resultRoot, `${provider}-temperature-0p1`),
  0.2: (provider) => path.join(resultRoot, `${provider}-temperature-0p2`),
  0.3: (provider) => path.join(resultRoot, `${provider}-temperature-0p3`)
};

for (const provider of ["mimo", "deepseek"]) {
  for (const temperature of [0, 0.1, 0.2, 0.3]) {
    const source = sources[temperature](provider);
    const summary = await readJson(path.join(source, "summary.json"));
    const contrasts = await readJson(path.join(source, "contrasts.json"));
    if (summary.design.pairedContrastCount !== 64 || !sameSet(frozenKeys, keySet(contrasts))) throw new Error(`${provider} temperature ${temperature} is incomplete or changed task cells.`);
    if ((summary.design.temperature ?? 0) !== temperature) throw new Error(`${provider} temperature ${temperature} metadata mismatch.`);
    if (summary.api.validActionRate < 0.95 || summary.api.timeoutCount / Math.max(1, summary.api.requestCount) >= 0.05) throw new Error(`${provider} temperature ${temperature} reliability gate failed.`);
    const d = summary.descriptive;
    summaries[provider][`temperature${label(temperature)}`] = {
      temperature,
      exposureTraceDivergenceRate:d.exposureTraceDivergenceRate,
      shamTraceDivergenceRate:d.shamTraceDivergenceRate,
      adjustedTraceDivergence:d.adjustedTraceDivergence,
      persistentBehavioralFeedbackRate:d.persistentBehavioralFeedbackRate,
      shamPersistentBehavioralFeedbackRate:d.shamPersistentBehavioralFeedbackRate,
      adjustedPersistentFeedback:d.adjustedPersistentFeedback,
      meanExposureT1:d.meanExposureT1,
      validActionRate:summary.api.validActionRate,
      timeoutCount:summary.api.timeoutCount,
      requestCount:summary.api.requestCount,
      currency:summary.api.currency,
      observedCostAtPublishedRates:summary.api.observedCostAtPublishedRates,
      cleanExposureCell:d.adjustedPersistentFeedback > 0 && d.shamPersistentBehavioralFeedbackRate <= 0.05
    };
  }
}

const lowCells = (provider) => [0, 0.1, 0.2].map((temperature) => summaries[provider][`temperature${label(temperature)}`]);
const lowTemperatureShamFailure = ["mimo", "deepseek"].some((provider) => lowCells(provider).some((cell) => cell.shamPersistentBehavioralFeedbackRate > 0.05));
const mimoClean = lowCells("mimo").some((cell) => cell.cleanExposureCell);
const deepseekClean = lowCells("deepseek").some((cell) => cell.cleanExposureCell);
let decision = "mixed-dose-response";
if (lowTemperatureShamFailure) decision = "stochasticity-obscures-low-temperature";
else if (mimoClean && deepseekClean) decision = "shared-decoding-sensitivity";
else if (!mimoClean && deepseekClean) decision = "provider-contingent-low-temperature";
else if (!mimoClean && !deepseekClean) decision = "no-clean-behavioral-propagation";

const output = {
  schemaVersion:"online-storefront-decoding-dose-response-summary.v1",
  generatedAt:new Date().toISOString(),
  protocolSha256:sha256(Buffer.from(protocolText)),
  temperatures:[0,0.1,0.2,0.3],
  taskCellsPerProviderTemperature:64,
  providers:summaries,
  decision,
  claimBoundary:protocol.claimBoundary
};
await mkdir(resultRoot,{recursive:true});
const outputPath = path.join(resultRoot,"dose-response-summary.json");
await writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`,`utf8`);
await writeFile(path.join(resultRoot,"dose-response-manifest.json"),`${JSON.stringify({schemaVersion:"online-storefront-decoding-dose-response-manifest.v1",protocolSha256:output.protocolSha256,files:{"dose-response-summary.json":{sha256:sha256(await readFile(outputPath)),bytes:(await readFile(outputPath)).byteLength}}},null,2)}\n`,`utf8`);
console.log(JSON.stringify({pass:true,decision,providers:Object.fromEntries(Object.entries(summaries).map(([provider,cells])=>[provider,Object.values(cells).map(({temperature,adjustedPersistentFeedback,shamPersistentBehavioralFeedbackRate,cleanExposureCell})=>({temperature,adjustedPersistentFeedback,shamPersistentBehavioralFeedbackRate,cleanExposureCell}))]))},null,2));
