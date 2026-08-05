import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_v2";
const categories = [
  { slug: "luxury-beauty", file: "Luxury_Beauty", label: "Luxury Beauty" },
  { slug: "software", file: "Software", label: "Software" },
  { slug: "industrial-and-scientific", file: "Industrial_and_Scientific", label: "Industrial and Scientific" },
  { slug: "prime-pantry", file: "Prime_Pantry", label: "Prime Pantry" }
];

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

for (const category of categories) {
  const directory = resolve(root, `artifacts/datasets/amazon-${category.slug}-2018`);
  const sources = [
    { name: `${category.file}_5.json.gz`, url: `${base}/categoryFilesSmall/${category.file}_5.json.gz` },
    { name: `meta_${category.file}.json.gz`, url: `${base}/metaFiles2/meta_${category.file}.json.gz` }
  ];
  await mkdir(directory, { recursive: true });
  for (const source of sources) {
    const target = resolve(directory, source.name);
    let present = false;
    try { present = (await stat(target)).size > 0; } catch { present = false; }
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
    const target = resolve(directory, source.name);
    files[source.name] = {
      url: source.url,
      bytes: (await stat(target)).size,
      sha256: await sha256(target)
    };
  }
  const manifest = {
    schemaVersion: "amazon-cross-category-source.v1",
    fetchedAt: new Date().toISOString(),
    publisher: "UCSD McAuley Lab",
    dataset: `Amazon Reviews 2018 / ${category.label} 5-core`,
    category,
    files
  };
  await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}
