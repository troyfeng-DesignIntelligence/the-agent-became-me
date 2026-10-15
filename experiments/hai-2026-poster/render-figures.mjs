import { chromium } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const figures = [
  { name: "feedback-chain", width: 1600, height: 510 },
  { name: "outcome-gated-interface", width: 1200, height: 650 }
];

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
});
try {
  for (const figure of figures) {
    const page = await browser.newPage({
      viewport: { width: figure.width, height: figure.height },
      deviceScaleFactor: 2
    });
    const source = resolve(root, "figures", `${figure.name}.svg`);
    await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
    await page.screenshot({
      path: resolve(root, "figures", `${figure.name}.png`),
      clip: { x: 0, y: 0, width: figure.width, height: figure.height },
      omitBackground: false,
      timeout: 120000
    });
    await page.close();
  }
} finally {
  await browser.close();
}
