import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const preflight = process.argv.includes("--preflight");
const protocolPath = path.join(root, "experiments/online-storefront-v4/forced-inspection-protocol.json");
const outputRoot = path.join(root, "public/results/online-storefront-forced-inspection/v1");
const depthPath = path.join(root, "public/results/online-storefront-decoding-sensitivity/v1/interaction-depth-summary.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const key = (row) => `${row.category}|${row.taskId}|${row.modelSeed}|${row.modelFamily}|${row.agentConfig}`;

const protocolText = (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n");
const protocol = JSON.parse(protocolText);
const depth = await readJson(depthPath);
if (protocol.status !== "frozen-before-any-forced-inspection-provider-call") throw new Error("Forced-inspection protocol is not frozen.");
if (!depth.diagnostic.mimoSingleDecisionAcrossGrid || !depth.diagnostic.deepseekExploresAcrossGrid) throw new Error("Interaction-depth premise is not supported by the frozen diagnostic.");

if (preflight) {
  console.log(JSON.stringify({pass:true,mode:"preflight",protocolSha256:sha256(Buffer.from(protocolText)),premise:depth.diagnostic,primaryEstimands:protocol.primaryEstimands,decisionRules:protocol.decisionRules},null,2));
  process.exit(0);
}

const providers = {};
let taskSet = null;
for (const provider of ["mimo", "deepseek"]) {
  const rootForProvider = path.join(outputRoot, `${provider}-forced-inspection-t0`);
  const summary = await readJson(path.join(rootForProvider, "summary.json"));
  const contrasts = (await readJson(path.join(rootForProvider, "contrasts.json"))).rows;
  if (summary.protocolSha256 !== sha256(Buffer.from(protocolText))) throw new Error(`${provider} protocol hash mismatch.`);
  if (summary.design.temperature !== 0 || summary.design.pairedContrastCount !== 32) throw new Error(`${provider} design mismatch.`);
  if (summary.api.validActionRate < 0.95 || summary.api.timeoutCount / Math.max(1,summary.api.requestCount) >= 0.05) throw new Error(`${provider} reliability gate failed.`);
  const keys = new Set(contrasts.map((row) => `${row.category}|${row.taskId}|${row.modelSeed}|${row.modelFamily}`));
  if (taskSet === null) taskSet = keys;
  else if (keys.size !== taskSet.size || [...keys].some((value) => !taskSet.has(value))) throw new Error("Provider task sets differ.");
  const exposure = contrasts.filter((row) => row.persistentResolvedActionFeedback).length;
  const sham = contrasts.filter((row) => row.shamPersistentResolvedActionFeedback).length;
  const resolved = contrasts.filter((row) => row.exposureResolvedActionDiverged).length;
  const shamResolved = contrasts.filter((row) => row.shamResolvedActionDiverged).length;
  providers[provider] = {
    model: summary.design.model,
    taskCount: summary.design.taskCount,
    pairedContrastCount: contrasts.length,
    resolvedActionDivergenceCount: resolved,
    shamResolvedActionDivergenceCount: shamResolved,
    persistentResolvedActionFeedbackCount: exposure,
    shamPersistentResolvedActionFeedbackCount: sham,
    adjustedPersistentResolvedActionFeedback: (exposure-sham)/contrasts.length,
    shamPersistentResolvedActionRate: sham/contrasts.length,
    validActionRate: summary.api.validActionRate,
    timeoutCount: summary.api.timeoutCount,
    requestCount: summary.api.requestCount,
    currency: summary.api.currency,
    observedCostAtPublishedRates: summary.api.observedCostAtPublishedRates
  };
}

let decision = "interaction-depth-insufficient";
if (Object.values(providers).some((cell) => cell.shamPersistentResolvedActionRate > 0.05)) decision = "stochasticity-dominated";
else if (providers.mimo.adjustedPersistentResolvedActionFeedback > 0) decision = "interaction-depth-mediates";

const output = {schemaVersion:"online-storefront-forced-inspection-summary.v1",generatedAt:new Date().toISOString(),protocolSha256:sha256(Buffer.from(protocolText)),providers,decision,claimBoundary:protocol.claimBoundary};
await mkdir(outputRoot,{recursive:true});
const outputPath=path.join(outputRoot,"summary.json");
await writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`,`utf8`);
await writeFile(path.join(outputRoot,"manifest.json"),`${JSON.stringify({schemaVersion:"online-storefront-forced-inspection-manifest.v1",protocolSha256:output.protocolSha256,files:{"summary.json":{sha256:sha256(await readFile(outputPath)),bytes:(await readFile(outputPath)).byteLength}}},null,2)}\n`,`utf8`);
console.log(JSON.stringify({pass:true,decision,providers},null,2));
