import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public/results/online-storefront-llm-pilot/v1");
const protocolPath = resolve(root, "experiments/online-storefront-v3/llm-pilot-protocol.json");
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
const expectedContrasts = expectedTasks * protocol.promptPolicies.length;
const expectedRows = expectedContrasts * protocol.conditions.length;
const rowKeys = new Set(
  rows.rows.map((row) =>
    [row.category, row.taskId, row.agentConfig, row.condition].join("|")
  )
);
const contrastKeys = new Set(
  contrasts.rows.map((row) =>
    [row.category, row.taskId, row.agentConfig].join("|")
  )
);
const publicText = JSON.stringify({ summary, rows, contrasts, manifest });
const forbiddenKeys = ["output_text", "request", "response", "productTitle", "reviewText"];
const manifestMatches = ["summary.json", "rows.json", "contrasts.json"].every((name) => {
  const entry = manifest.files?.[name];
  return entry?.sha256 === hash(bytes[name]) && entry?.bytes === bytes[name].length;
});
const components = {
  schemas:
    summary.schemaVersion === "online-storefront-llm-pilot-summary.v1" &&
    rows.schemaVersion === "online-storefront-llm-pilot-rows.v1" &&
    contrasts.schemaVersion === "online-storefront-llm-pilot-contrasts.v1" &&
    manifest.schemaVersion === "online-storefront-llm-pilot-manifest.v1",
  protocolIntegrity:
    summary.protocolSha256 === protocolSha256 &&
    rows.protocolSha256 === protocolSha256 &&
    contrasts.protocolSha256 === protocolSha256 &&
    manifest.protocolSha256 === protocolSha256,
  completeCoverage:
    rows.rows.length === expectedRows &&
    rowKeys.size === expectedRows &&
    contrasts.rows.length === expectedContrasts &&
    contrastKeys.size === expectedContrasts,
  frozenConfigurations:
    summary.design?.model === "mimo-v2.5" &&
    JSON.stringify(summary.design?.promptPolicies?.sort()) ===
      JSON.stringify(protocol.promptPolicies.map((row) => row.id).sort()) &&
    new Set(rows.rows.map((row) => row.modelFamily)).size === 2,
  requestDisclosure:
    Number.isFinite(summary.api?.requestCount) &&
    Number.isFinite(summary.api?.inputTokens) &&
    Number.isFinite(summary.api?.outputTokens) &&
    Number.isFinite(summary.api?.observedCostRmbAtPublishedRates) &&
    Number.isFinite(summary.api?.validActionRate),
  privacy:
    forbiddenKeys.every((key) => !publicText.includes(`"${key}"`)) &&
    protocol.publishRawResponses === false,
  evidenceIntegrity: manifestMatches,
  calibratedClaims:
    summary.claims?.notEstablished?.some((value) => value.includes("single LLM family")) &&
    summary.claims?.notEstablished?.some((value) => value.includes("not the confirmatory")) &&
    summary.claims?.notEstablished?.some((value) => value.includes("did not browse Amazon.com"))
};
const passed = Object.values(components).filter(Boolean).length;
const result = {
  pass: passed === Object.keys(components).length,
  score: passed / Object.keys(components).length,
  components,
  observed: {
    taskCount: summary.design?.taskCount,
    conditionRowCount: rows.rows.length,
    pairedContrastCount: contrasts.rows.length,
    requestCount: summary.api?.requestCount,
    observedCostRmb: summary.api?.observedCostRmbAtPublishedRates
  }
};
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
