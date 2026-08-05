import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "artifacts/datasets/movielens-100k");
const baseUrl = "https://files.grouplens.org/datasets/movielens/ml-100k";
const files = ["README", "u.data", "u.item"];

await mkdir(outputDirectory, { recursive: true });

for (const file of files) {
  const response = await fetch(`${baseUrl}/${file}`);
  if (!response.ok) {
    throw new Error(`MovieLens fetch failed for ${file}: ${response.status}`);
  }
  await writeFile(resolve(outputDirectory, file), Buffer.from(await response.arrayBuffer()));
}

const manifest = {
  schemaVersion: "movielens-100k-input-manifest.v1",
  fetchedAt: new Date().toISOString(),
  source: "GroupLens MovieLens 100K",
  sourcePage: "https://grouplens.org/datasets/movielens/100k/",
  redistribution: "Raw files remain in ignored artifacts/ and are not redistributed.",
  files: Object.fromEntries(
    await Promise.all(
      files.map(async (file) => {
        const bytes = await readFile(resolve(outputDirectory, file));
        return [
          file,
          {
            url: `${baseUrl}/${file}`,
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex")
          }
        ];
      })
    )
  )
};

await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
