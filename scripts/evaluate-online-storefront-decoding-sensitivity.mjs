import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const preflight = process.argv.includes("--preflight");
const protocolPath = path.join(
  root,
  "experiments/online-storefront-v4/decoding-sensitivity-protocol.json"
);
const baselineRoot = path.join(
  root,
  "public/results/online-storefront-cross-llm-pilot/v1"
);
const outputRoot = path.join(
  root,
  "public/results/online-storefront-decoding-sensitivity/v1"
);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function taskKeys(contrasts) {
  return new Set(
    contrasts.rows.map(
      (row) =>
        `${row.category}|${row.taskId}|${row.modelSeed}|${row.modelFamily}|${row.agentConfig}`
    )
  );
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function summarize(summary) {
  return {
    model: summary.design.model,
    temperature: summary.design.temperature ?? 0,
    taskCount: summary.design.taskCount,
    pairedContrastCount: summary.design.pairedContrastCount,
    validActionRate: summary.api.validActionRate,
    timeoutCount: summary.api.timeoutCount,
    requestCount: summary.api.requestCount,
    currency: summary.api.currency,
    observedCostAtPublishedRates: summary.api.observedCostAtPublishedRates,
    meanExposureT1: summary.descriptive.meanExposureT1,
    exposureTraceDivergenceRate:
      summary.descriptive.exposureTraceDivergenceRate,
    shamTraceDivergenceRate: summary.descriptive.shamTraceDivergenceRate,
    adjustedTraceDivergence: summary.descriptive.adjustedTraceDivergence,
    persistentBehavioralFeedbackRate:
      summary.descriptive.persistentBehavioralFeedbackRate,
    shamPersistentBehavioralFeedbackRate:
      summary.descriptive.shamPersistentBehavioralFeedbackRate,
    adjustedPersistentFeedback:
      summary.descriptive.adjustedPersistentFeedback
  };
}

const protocolText = (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n");
const protocol = JSON.parse(protocolText);
if (protocol.status !== "frozen-before-any-temperature-0.3-provider-call") {
  throw new Error("Decoding-sensitivity protocol is not in its frozen pre-call state.");
}
if (protocol.generation.temperature !== 0.3) {
  throw new Error("Frozen decoding-sensitivity temperature must be 0.3.");
}

const baseline = {};
for (const provider of ["mimo", "deepseek"]) {
  baseline[provider] = {
    summary: await readJson(path.join(baselineRoot, provider, "summary.json")),
    contrasts: await readJson(path.join(baselineRoot, provider, "contrasts.json"))
  };
  if (baseline[provider].summary.design.pairedContrastCount !== 64) {
    throw new Error(`${provider} temperature-0 baseline is not the frozen 64-pair pilot.`);
  }
}
if (!sameSet(taskKeys(baseline.mimo.contrasts), taskKeys(baseline.deepseek.contrasts))) {
  throw new Error("Temperature-0 provider baselines do not share the same task cells.");
}

if (preflight) {
  console.log(
    JSON.stringify(
      {
        pass: true,
        mode: "preflight-no-temperature-0.3-results-required",
        protocolSha256: sha256(Buffer.from(protocolText)),
        frozenTaskCellCount: taskKeys(baseline.mimo.contrasts).size,
        primaryEstimands: protocol.primaryEstimands,
        decisionRules: protocol.decisionRules
      },
      null,
      2
    )
  );
  process.exit(0);
}

const sensitivity = {};
for (const provider of ["mimo", "deepseek"]) {
  const providerRoot = path.join(outputRoot, `${provider}-temperature-0p3`);
  sensitivity[provider] = {
    summary: await readJson(path.join(providerRoot, "summary.json")),
    contrasts: await readJson(path.join(providerRoot, "contrasts.json"))
  };
  const summary = sensitivity[provider].summary;
  if (summary.protocolSha256 !== sha256(Buffer.from(protocolText))) {
    throw new Error(`${provider} temperature-0.3 protocol hash mismatch.`);
  }
  if (summary.design.temperature !== 0.3) {
    throw new Error(`${provider} output does not report temperature 0.3.`);
  }
  if (summary.design.pairedContrastCount !== 64) {
    throw new Error(`${provider} temperature-0.3 output is incomplete.`);
  }
  if (summary.api.validActionRate < 0.95 || summary.api.timeoutCount / Math.max(1, summary.api.requestCount) >= 0.05) {
    throw new Error(`${provider} temperature-0.3 reliability gate failed.`);
  }
  if (!sameSet(taskKeys(baseline[provider].contrasts), taskKeys(sensitivity[provider].contrasts))) {
    throw new Error(`${provider} temperature sweep changed the frozen task cells.`);
  }
}

const stochasticityDominated = ["mimo", "deepseek"].some((provider) => {
  const d = sensitivity[provider].summary.descriptive;
  return (
    (d.exposureTraceDivergenceRate > 0 &&
      d.shamTraceDivergenceRate >= d.exposureTraceDivergenceRate) ||
    d.shamPersistentBehavioralFeedbackRate > 0.05
  );
});
const mimoD = sensitivity.mimo.summary.descriptive;
const deepseekD = sensitivity.deepseek.summary.descriptive;
let decision = "mixed-boundary";
if (stochasticityDominated) {
  decision = "stochasticity-dominated";
} else if (
  mimoD.adjustedTraceDivergence > 0 &&
  mimoD.adjustedPersistentFeedback > 0 &&
  deepseekD.adjustedTraceDivergence >= 0
) {
  decision = "decoding-sensitive";
} else if (
  mimoD.adjustedTraceDivergence <= 0 &&
  deepseekD.adjustedTraceDivergence > 0
) {
  decision = "provider-contingent";
}

const result = {
  schemaVersion: "online-storefront-decoding-sensitivity-summary.v1",
  generatedAt: new Date().toISOString(),
  protocolSha256: sha256(Buffer.from(protocolText)),
  design: {
    taskCountPerProviderTemperature: 32,
    pairedContrastCountPerProviderTemperature: 64,
    temperatures: [0, 0.3],
    providers: ["mimo", "deepseek"]
  },
  cells: {
    mimo: {
      temperature0: summarize(baseline.mimo.summary),
      temperature0p3: summarize(sensitivity.mimo.summary)
    },
    deepseek: {
      temperature0: summarize(baseline.deepseek.summary),
      temperature0p3: summarize(sensitivity.deepseek.summary)
    }
  },
  temperatureDeltas: {
    mimoAdjustedTraceDivergence:
      mimoD.adjustedTraceDivergence -
      baseline.mimo.summary.descriptive.adjustedTraceDivergence,
    mimoAdjustedPersistentFeedback:
      mimoD.adjustedPersistentFeedback -
      baseline.mimo.summary.descriptive.adjustedPersistentFeedback,
    deepseekAdjustedTraceDivergence:
      deepseekD.adjustedTraceDivergence -
      baseline.deepseek.summary.descriptive.adjustedTraceDivergence,
    deepseekAdjustedPersistentFeedback:
      deepseekD.adjustedPersistentFeedback -
      baseline.deepseek.summary.descriptive.adjustedPersistentFeedback
  },
  decision,
  claimBoundary:
    "This mechanism pilot identifies decoding sensitivity or a provider-contingent boundary within the frozen research storefront; it does not establish a population, production, or architectural effect."
};

await mkdir(outputRoot, { recursive: true });
const summaryPath = path.join(outputRoot, "summary.json");
await writeFile(summaryPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: "online-storefront-decoding-sensitivity-manifest.v1",
      protocolSha256: result.protocolSha256,
      files: {
        "summary.json": {
          sha256: sha256(await readFile(summaryPath)),
          bytes: (await readFile(summaryPath)).byteLength
        }
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(JSON.stringify({ pass: true, decision, temperatureDeltas: result.temperatureDeltas }));
