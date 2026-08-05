import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const sourceDirectory = join(root, "artifacts", "amazon-field-probe", "live");
const outputDirectory = join(root, "public", "evidence", "amazon-field", "v1");
const conditions = ["idle-control", "search-only", "product-view", "cart-stage"];
const states = ["baseline", "post"];
const crop = { x: 0, y: 240, width: 1440, height: 450, scale: 0.75 };

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 500 } });
const records = [];

try {
  for (const condition of conditions) {
    for (const state of states) {
      const sourcePath = join(sourceDirectory, `${condition}-${state}.png`);
      const sourceBuffer = await readFile(sourcePath);
      const sourceDataUrl = `data:image/png;base64,${sourceBuffer.toString("base64")}`;

      const outputDataUrl = await page.evaluate(
        async ({ sourceDataUrl, crop }) => {
          const image = new Image();
          image.src = sourceDataUrl;
          await image.decode();

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(crop.width * crop.scale);
          canvas.height = Math.round(crop.height * crop.scale);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas context unavailable.");

          context.fillStyle = "#e5e7e7";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const columnOffsets = [0, 355, 710, 1065];
          const imageTiles = columnOffsets.flatMap((offset) => [
            { x: 40 + offset, y: 307, width: 140, height: 116 },
            { x: 195 + offset, y: 307, width: 140, height: 116 },
            { x: 40 + offset, y: 467, width: 140, height: 116 },
            { x: 195 + offset, y: 467, width: 140, height: 116 }
          ]);

          for (const tile of imageTiles) {
            const destinationX = (tile.x - crop.x) * crop.scale;
            const destinationY = (tile.y - crop.y) * crop.scale;
            const destinationWidth = tile.width * crop.scale;
            const destinationHeight = tile.height * crop.scale;
            context.save();
            context.filter = "blur(18px) saturate(0.35)";
            context.drawImage(
              image,
              tile.x,
              tile.y,
              tile.width,
              tile.height,
              destinationX,
              destinationY,
              destinationWidth,
              destinationHeight
            );
            context.restore();
            context.fillStyle = "rgba(222, 218, 207, 0.28)";
            context.fillRect(
              destinationX,
              destinationY,
              destinationWidth,
              destinationHeight
            );
          }

          return canvas.toDataURL("image/png");
        },
        { sourceDataUrl, crop }
      );

      const outputBuffer = Buffer.from(outputDataUrl.split(",")[1], "base64");
      const outputName = `${condition}-${state}-redacted.png`;
      const outputPath = join(outputDirectory, outputName);
      await writeFile(outputPath, outputBuffer);
      records.push({
        condition,
        state,
        source: relative(root, sourcePath).replaceAll("\\", "/"),
        sourceSha256: sha256(sourceBuffer),
        output: relative(root, outputPath).replaceAll("\\", "/"),
        outputSha256: sha256(outputBuffer),
        crop,
        redaction: {
          method: "deterministic-canvas-region-blur",
          regionCount: 16,
          note: "Product imagery and brand-bearing pixels were blurred; module headings and page geometry were retained."
        }
      });
    }
  }
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: "amazon-field-evidence-slices.v1",
  evidenceStatus: "deterministically-cropped-and-redacted-live-screenshots",
  generatedAt: new Date().toISOString(),
  generationScript: basename(import.meta.filename),
  records
};
await writeFile(
  join(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`Prepared ${records.length} redacted evidence slices.`);
