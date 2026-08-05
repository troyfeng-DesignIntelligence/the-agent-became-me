import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = resolve(root, "artifacts/webarena-provenance/raw");
const outputDir = resolve(rawDir, "released-agent-traces");

const members = [
  {
    input: "webarena-ocr.member.bin",
    output: "ocr-sft-qwenvl-v2.json",
    expectedName:
      "AgentTrajectories/webarena/webarena-gpt4cot-release2/captions/ocr-sft-qwenvl-v2.json",
    compressedSize: 3763821,
    uncompressedSize: 13811800,
    crc32: 0x92423504
  },
  {
    input: "webarena-trajectory-log.member.bin",
    output: "trajectory_log.json",
    expectedName:
      "AgentTrajectories/webarena/webarena-gpt4cot-release2/trajectory_log.json",
    compressedSize: 280085,
    uncompressedSize: 2216100,
    crc32: 0xf2f0413b
  },
  {
    input: "webarena-evals.member.bin",
    output: "v0.jsonl",
    expectedName:
      "AgentTrajectories/webarena/webarena-gpt4cot-release2/evals/v0.jsonl",
    compressedSize: 4813,
    uncompressedSize: 119512,
    crc32: 0x2ecc83ad
  }
];

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
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

await mkdir(outputDir, { recursive: true });

for (const member of members) {
  const bytes = await readFile(resolve(rawDir, member.input));
  if (bytes.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`${member.input}: missing local ZIP header`);
  }
  const compression = bytes.readUInt16LE(8);
  const nameLength = bytes.readUInt16LE(26);
  const extraLength = bytes.readUInt16LE(28);
  const name = bytes.subarray(30, 30 + nameLength).toString("utf8");
  if (name !== member.expectedName || compression !== 8) {
    throw new Error(`${member.input}: unexpected member header`);
  }
  const dataStart = 30 + nameLength + extraLength;
  const compressed = bytes.subarray(
    dataStart,
    dataStart + member.compressedSize
  );
  const output = inflateRawSync(compressed);
  if (
    output.length !== member.uncompressedSize ||
    crc32(output) !== member.crc32
  ) {
    throw new Error(`${member.input}: size or CRC-32 mismatch`);
  }
  await writeFile(resolve(outputDir, member.output), output);
  process.stdout.write(
    `verified ${member.output}: ${output.length} bytes, CRC-32 ${member.crc32
      .toString(16)
      .padStart(8, "0")}\n`
  );
}
