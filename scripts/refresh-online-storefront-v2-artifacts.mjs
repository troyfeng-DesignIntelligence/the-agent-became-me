import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const protocolPath = resolve(
  root,
  "experiments/online-storefront-v2/protocol.json"
);
const resultRoot = resolve(root, "public/results/online-storefront-v2/v1");
const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
const protocolSha256 = digest(
  (await readFile(protocolPath, "utf8")).replace(/\r\n/g, "\n")
);
const styles = {
  "summary.json": true,
  "rows.json": false,
  "contrasts.json": false,
  "model-bundle.json": true
};
const payloads = Object.fromEntries(
  await Promise.all(
    Object.keys(styles).map(async (name) => [
      name,
      JSON.parse(await readFile(resolve(resultRoot, name), "utf8"))
    ])
  )
);
Object.values(payloads).forEach((payload) => {
  payload.protocolSha256 = protocolSha256;
});

const mean = (values) =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
const summarize = (rows) => ({
  pairCount: rows.length,
  fixedT1Displacement: mean(
    rows
      .filter((row) => row.mode === "fixed-trace")
      .map((row) => row.t1ImmediateHeldDisplacement)
  ),
  freeT1Displacement: mean(
    rows
      .filter((row) => row.mode === "free-running")
      .map((row) => row.t1ImmediateHeldDisplacement)
  ),
  freeTraceDivergenceRate: mean(
    rows
      .filter((row) => row.mode === "free-running")
      .map((row) => Number(row.traceDiverged))
  ),
  heldMinusImmediateDecisionAccuracy: mean(
    rows
      .filter((row) => row.mode === "free-running")
      .map((row) => row.heldMinusImmediateDecisionAccuracy)
  ),
  heldMinusImmediateSelectedUtility: mean(
    rows
      .filter((row) => row.mode === "free-running")
      .map((row) => row.heldMinusImmediateSelectedUtility)
  )
});
const contrastRows = payloads["contrasts.json"].rows;
const groupBy = (key) =>
  Object.fromEntries(
    [...new Set(contrastRows.map((row) => row[key]))].map((value) => [
      value,
      summarize(contrastRows.filter((row) => row[key] === value))
    ])
  );
payloads["summary.json"].descriptive = {
  byAgentConfig: groupBy("agentConfig"),
  byCategory: groupBy("category")
};

for (const [name, pretty] of Object.entries(styles)) {
  const path = resolve(resultRoot, name);
  await writeFile(
    path,
    `${JSON.stringify(payloads[name], null, pretty ? 2 : undefined)}\n`,
    "utf8"
  );
}

const files = {};
for (const name of Object.keys(styles)) {
  const path = resolve(resultRoot, name);
  const bytes = await readFile(path);
  const metadata = await stat(path);
  files[name] = { sha256: digest(bytes), bytes: metadata.size };
}
await writeFile(
  resolve(resultRoot, "manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: "online-storefront-v2-manifest.v1",
      protocolSha256,
      files
    },
    null,
    2
  )}\n`,
  "utf8"
);
process.stdout.write(`${JSON.stringify({ protocolSha256, files })}\n`);
