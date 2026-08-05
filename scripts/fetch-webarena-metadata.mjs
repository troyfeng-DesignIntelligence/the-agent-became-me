import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(
  root,
  "experiments/webarena-provenance/source-manifest.json"
);
const outputDir = resolve(root, "artifacts/webarena-provenance/raw/metadata");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(outputDir, { recursive: true });

for (const source of manifest.files) {
  const response = await fetch(source.url, {
    headers: { "user-agent": "the-agent-became-me/research-artifact" }
  });
  if (!response.ok) {
    throw new Error(`${source.name}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== source.sha256 || bytes.length !== source.bytes) {
    throw new Error(
      `${source.name}: integrity mismatch (${bytes.length} bytes, ${hash})`
    );
  }
  await writeFile(resolve(outputDir, source.name), bytes);
  process.stdout.write(`verified ${source.name}\n`);
}
