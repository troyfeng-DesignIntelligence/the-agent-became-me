import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rawRoot = resolve(root, "artifacts/webarena-provenance/raw");
const outputDir = resolve(rawRoot, "evidence-images");
const archiveUrl =
  "https://hf-mirror.com/datasets/Agent-Eval-Refine/Agent-Trajectories/resolve/ef1d8b4467e83ad54f119fe82a137169600a2679/trajectories.zip";
const prefix =
  "AgentTrajectories/webarena/webarena-gpt4cot-release2/images/";

const audit = JSON.parse(
  await readFile(
    resolve(root, "public/results/webarena-failure/v1/event-audit.json"),
    "utf8"
  )
).events;
const index = JSON.parse(
  await readFile(resolve(rawRoot, "trajectories-index.json"), "utf8")
);

const boundary = audit.filter((event) => !event.ocrCorroborated);
const controls = [];
for (const action of ["view", "compare", "shortlist", "purchase"]) {
  const match = audit.find(
    (event) => event.action === action && event.ocrCorroborated
  );
  if (match) controls.push(match);
}
const selected = [...boundary, ...controls].filter(
  (event, position, rows) =>
    event.imageId &&
    rows.findIndex((candidate) => candidate.imageId === event.imageId) === position
);

const crcTable = Array.from({ length: 256 }, (_, indexValue) => {
  let value = indexValue;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

async function fetchMember(event) {
  const memberName = `${prefix}${event.imageId}.png`;
  const entry = index.entries.find((candidate) => candidate.name === memberName);
  if (!entry) throw new Error(`Missing ZIP index entry: ${memberName}`);
  const rangeEnd = entry.localHeaderOffset + entry.compressedSize + 4095;
  const response = await fetch(archiveUrl, {
    headers: { Range: `bytes=${entry.localHeaderOffset}-${rangeEnd}` }
  });
  if (response.status !== 206) {
    throw new Error(`${memberName}: expected HTTP 206, received ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`${memberName}: missing local ZIP header`);
  }
  const compression = bytes.readUInt16LE(8);
  const nameLength = bytes.readUInt16LE(26);
  const extraLength = bytes.readUInt16LE(28);
  const actualName = bytes.subarray(30, 30 + nameLength).toString("utf8");
  if (compression !== 8 || actualName !== memberName) {
    throw new Error(`${memberName}: unexpected local header`);
  }
  const dataStart = 30 + nameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  const output = inflateRawSync(compressed);
  const expectedCrc = Number.parseInt(entry.crc32, 16) >>> 0;
  if (output.length !== entry.uncompressedSize || crc32(output) !== expectedCrc) {
    throw new Error(`${memberName}: size or CRC-32 mismatch`);
  }
  await writeFile(resolve(outputDir, `${event.imageId}.png`), output);
  return {
    taskId: event.taskId,
    imageId: event.imageId,
    action: event.action,
    targetLabel: event.targetLabel,
    ocrCorroborated: event.ocrCorroborated,
    bytes: output.length,
    crc32: entry.crc32,
    sha256: createHash("sha256").update(output).digest("hex")
  };
}

await mkdir(outputDir, { recursive: true });
const records = [];
for (const event of selected) records.push(await fetchMember(event));
await writeFile(
  resolve(outputDir, "manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: "webarena-evidence-image-audit.v1",
      archiveCommit: "ef1d8b4467e83ad54f119fe82a137169600a2679",
      selection: "all OCR-noncorroborated primary events plus one corroborated control per action",
      records
    },
    null,
    2
  )}\n`,
  "utf8"
);
process.stdout.write(`Verified and extracted ${records.length} evidence images\n`);
