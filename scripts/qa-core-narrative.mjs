import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:4173/";
const outputDirectory = path.resolve(
  process.env.QA_OUTPUT ?? "artifacts/qa/core-narrative"
);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function waitForSite() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(siteUrl);
      if (response.ok) return;
    } catch {
      // The preview server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Site did not become available at ${siteUrl}`);
}

async function checkViewport(browser, viewport, name) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(siteUrl, { waitUntil: "networkidle" });

  const bodyText = await page.locator("body").innerText();
  check(!bodyText.toLowerCase().includes("third-family"), `${name}: third-family language remains on the main page.`);
  check((await page.locator("#lab").count()) === 0, `${name}: the synthetic lab is still in the main narrative.`);
  check((await page.locator(".webarena-replay").count()) === 0, `${name}: WebArena is still in the main narrative.`);
  check((await page.locator(".amazon-field").count()) === 0, `${name}: the Amazon probe is still in the main narrative.`);
  check((await page.locator(".cross-category-replication").count()) === 1, `${name}: cross-category evidence is missing.`);
  check((await page.locator(".online-v2-study").count()) === 1, `${name}: the four-contract storefront study is missing.`);
  check((await page.locator(".llm-feedback-panel").count()) === 1, `${name}: the deterministic LLM pilot is missing.`);
  check((await page.locator(".cross-task-control-lab").count()) === 1, `${name}: the control prototype is missing.`);
  check((await page.locator('.artifact-links a[href*="archive=1"]').count()) === 1, `${name}: the development archive link is missing.`);
  check(
    (await page.locator(".llm-feedback-repair").innerText()).includes("WHY IT FAILED"),
    `${name}: the invalidated LLM claim is still presented as a result.`
  );

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sources: Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          parentClassName: element.parentElement?.className ?? "",
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((row) => row.right > document.documentElement.clientWidth + 1 || row.left < -1)
      .sort((a, b) => Math.max(b.right - document.documentElement.clientWidth, -b.left) - Math.max(a.right - document.documentElement.clientWidth, -a.left))
      .slice(0, 30)
  }));
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `${name}: horizontal overflow (${overflow.scrollWidth}px > ${overflow.clientWidth}px).`
  );
  check(consoleErrors.length === 0, `${name}: console errors: ${consoleErrors.join(" | ")}`);

  await page.locator("#evidence").screenshot({
    path: path.join(outputDirectory, `${name}-evidence.png`)
  });
  await page.locator(".llm-feedback-panel").screenshot({
    path: path.join(outputDirectory, `${name}-llm-result.png`)
  });
  await context.close();
  return { name, overflow, consoleErrors };
}

await mkdir(outputDirectory, { recursive: true });
await waitForSite();
const browser = await chromium.launch(
  browserChannel === "bundled"
    ? { headless: true }
    : { channel: browserChannel, headless: true }
);

let observations;
try {
  observations = [
    await checkViewport(browser, { width: 1440, height: 1000 }, "desktop"),
    await checkViewport(browser, { width: 390, height: 844 }, "mobile")
  ];
} finally {
  await browser.close();
}

const report = {
  siteUrl,
  checkedAt: new Date().toISOString(),
  passed: failures.length === 0,
  failures,
  observations
};
await writeFile(
  path.join(outputDirectory, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
