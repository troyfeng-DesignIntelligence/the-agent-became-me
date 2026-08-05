import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const provider = process.argv.includes("--provider")
  ? process.argv[process.argv.indexOf("--provider") + 1]
  : "";
if (!["mimo", "deepseek"].includes(provider)) {
  throw new Error("Use --provider mimo or --provider deepseek");
}

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/results/online-storefront-cross-llm-pilot/v1", provider);
const protocolPath = resolve(
  root,
  "experiments/online-storefront-v4/cross-llm-pilot-protocol.json"
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalizedProtocol = (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n");
const protocol = JSON.parse(normalizedProtocol);
const protocolSha256 = hash(Buffer.from(normalizedProtocol));
const names = ["summary.json", "rows.json", "contrasts.json", "manifest.json"];
const bytes = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await readFile(resolve(output, name))]))
);
const summary = JSON.parse(bytes["summary.json"]);
const rows = JSON.parse(bytes["rows.json"]);
const contrasts = JSON.parse(bytes["contrasts.json"]);
const manifest = JSON.parse(bytes["manifest.json"]);
const expectedTasks = protocol.tasksPerCategory * protocol.categories.length;
const expectedContrasts = expectedTasks * protocol.agentPolicies.length;
const expectedRows = expectedContrasts * protocol.conditions.length;
const rowKeys = new Set(
  rows.rows.map((row) =>
    [row.category, row.taskId, row.agentConfig, row.condition].join("|")
  )
);
const contrastKeys = new Set(
  contrasts.rows.map((row) => [row.category, row.taskId, row.agentConfig].join("|"))
);
const manifestMatches = ["summary.json", "rows.json", "contrasts.json"].every((name) => {
  const entry = manifest.files?.[name];
  return entry?.sha256 === hash(bytes[name]) && entry?.bytes === bytes[name].length;
});
const publicText = JSON.stringify({ summary, rows, contrasts, manifest });
const forbidden = ["output_text", "choices", "messages", "productTitle", "reviewText"];
const contrastShape = contrasts.rows.every(
  (row) =>
    typeof row.exposureTraceDiverged === "boolean" &&
    typeof row.shamTraceDiverged === "boolean" &&
    typeof row.persistentBehavioralFeedback === "boolean" &&
    typeof row.shamPersistentBehavioralFeedback === "boolean" &&
    [-1, 0, 1].includes(row.adjustedPersistentFeedback)
);
const expectedProvider = provider === "mimo" ? "xiaomi-mimo" : "deepseek";
const components = {
  schemas:
    summary.schemaVersion === "online-storefront-cross-llm-pilot-summary.v1" &&
    rows.schemaVersion === "online-storefront-cross-llm-pilot-rows.v1" &&
    contrasts.schemaVersion === "online-storefront-cross-llm-pilot-contrasts.v1" &&
    manifest.schemaVersion === "online-storefront-cross-llm-pilot-manifest.v1",
  protocolIntegrity:
    summary.protocolSha256 === protocolSha256 &&
    rows.protocolSha256 === protocolSha256 &&
    contrasts.protocolSha256 === protocolSha256 &&
    manifest.protocolSha256 === protocolSha256,
  completeCoverage:
    summary.design?.taskCount === expectedTasks &&
    rows.rows.length === expectedRows &&
    rowKeys.size === expectedRows &&
    contrasts.rows.length === expectedContrasts &&
    contrastKeys.size === expectedContrasts,
  providerIdentity:
    summary.design?.provider === expectedProvider &&
    (provider !== "deepseek" || (summary.api?.systemFingerprints?.length ?? 0) > 0),
  shamCalibration:
    contrastShape &&
    protocol.conditions.includes("held-sham-a") &&
    protocol.conditions.includes("held-sham-b"),
  requestDisclosure:
    Number.isFinite(summary.api?.attemptCount) &&
    Number.isFinite(summary.api?.validActionCount) &&
    Number.isFinite(summary.api?.inputTokens) &&
    Number.isFinite(summary.api?.outputTokens) &&
    Number.isFinite(summary.api?.observedCostAtPublishedRates),
  reliabilityGates:
    summary.gates?.validActionRateAtLeast095 === true &&
    summary.gates?.timeoutRateBelow005 === true,
  privacy: forbidden.every((key) => !publicText.includes(`"${key}"`)),
  evidenceIntegrity: manifestMatches,
  calibratedClaims:
    summary.claims?.notEstablished?.some((value) => value.includes("confirmatory")) &&
    summary.claims?.notEstablished?.some((value) => value.includes("human")) &&
    summary.claims?.notEstablished?.some((value) => value.includes("protocol-defined"))
};
const passed = Object.values(components).filter(Boolean).length;
const result = {
  pass: passed === Object.keys(components).length,
  score: passed / Object.keys(components).length,
  components,
  observed: {
    provider: summary.design?.provider,
    model: summary.design?.model,
    taskCount: summary.design?.taskCount,
    conditionRowCount: rows.rows.length,
    pairedContrastCount: contrasts.rows.length,
    adjustedPersistentFeedback: summary.descriptive?.adjustedPersistentFeedback,
    shamPersistentFeedback: summary.descriptive?.shamPersistentBehavioralFeedbackRate
  }
};
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
