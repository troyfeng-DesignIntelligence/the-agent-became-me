import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "artifacts/datasets/amazon-luxury-beauty-2018");
const sources = [
  {
    name: "Luxury_Beauty_5.json.gz",
    url: "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_v2/categoryFilesSmall/Luxury_Beauty_5.json.gz"
  },
  {
    name: "meta_Luxury_Beauty.json.gz",
    url: "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_v2/metaFiles2/meta_Luxury_Beauty.json.gz"
  }
];

await mkdir(outputDirectory, { recursive: true });

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

for (const source of sources) {
  const target = resolve(outputDirectory, source.name);
  let present = false;
  try {
    present = (await stat(target)).size > 0;
  } catch {
    present = false;
  }
  if (!present) {
    const response = await fetch(source.url, { redirect: "follow" });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed for ${source.url}: ${response.status}`);
    }
    await pipeline(response.body, createWriteStream(target));
  }
}

const files = {};
for (const source of sources) {
  const target = resolve(outputDirectory, source.name);
  files[source.name] = {
    url: source.url,
    bytes: (await stat(target)).size,
    sha256: await sha256(target)
  };
}

const manifest = {
  schemaVersion: "amazon-luxury-beauty-source.v1",
  fetchedAt: new Date().toISOString(),
  publisher: "UCSD McAuley Lab",
  dataset: "Amazon Reviews 2018 / Luxury Beauty 5-core",
  files
};
await writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

