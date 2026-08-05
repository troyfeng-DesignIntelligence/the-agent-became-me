import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/trajectories-central-directory.bin"
);
const outputPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/trajectories-index.json"
);
const bytes = await readFile(inputPath);
const entries = [];
let offset = 0;

while (offset + 46 <= bytes.length && bytes.readUInt32LE(offset) === 0x02014b50) {
  const flags = bytes.readUInt16LE(offset + 8);
  const compression = bytes.readUInt16LE(offset + 10);
  const crc32 = bytes.readUInt32LE(offset + 16);
  const compressedSize = bytes.readUInt32LE(offset + 20);
  const uncompressedSize = bytes.readUInt32LE(offset + 24);
  const nameLength = bytes.readUInt16LE(offset + 28);
  const extraLength = bytes.readUInt16LE(offset + 30);
  const commentLength = bytes.readUInt16LE(offset + 32);
  const localHeaderOffset = bytes.readUInt32LE(offset + 42);
  const name = bytes
    .subarray(offset + 46, offset + 46 + nameLength)
    .toString(flags & 0x800 ? "utf8" : "utf8");
  entries.push({
    name,
    compression,
    crc32: crc32.toString(16).padStart(8, "0"),
    compressedSize,
    uncompressedSize,
    localHeaderOffset
  });
  offset += 46 + nameLength + extraLength + commentLength;
}

if (entries.length !== 19787) {
  throw new Error(`Expected 19787 entries, parsed ${entries.length}`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      archiveBytes: 2887680098,
      centralDirectoryOffset: 2884919930,
      entryCount: entries.length,
      entries
    },
    null,
    2
  )}\n`,
  "utf8"
);

const webarena = entries.filter((entry) =>
  entry.name.toLowerCase().includes("webarena")
);
process.stdout.write(
  `${webarena.length} WebArena-named members\n${webarena
    .slice(0, 80)
    .map(
      (entry) =>
        `${entry.compressedSize}\t${entry.uncompressedSize}\t${entry.name}`
    )
    .join("\n")}\n`
);
