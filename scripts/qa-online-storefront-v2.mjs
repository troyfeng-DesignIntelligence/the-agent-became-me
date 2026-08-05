import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:4173/";
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const outputDirectory = path.resolve("artifacts/qa-online-storefront-v2");
const failures = [];
const observations = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const modelUrl = () => {
  const url = new URL(siteUrl);
  url.searchParams.set("view", "storefront-v2");
  url.searchParams.set("mode", "free-running");
  url.searchParams.set("phase", "task-in-progress");
  return url.href;
};

async function run(browser, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(modelUrl(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__STORE_V2_RESEARCH__?.model === "SASRec");
  const initial = await page.evaluate(() => window.__STORE_V2_RESEARCH__);
  check(initial?.mode === "free-running", `${label}: free-running mode did not load.`);
  check(initial?.phase === "task-in-progress", `${label}: T1 did not load.`);
  check(initial?.currentSlate.length === 10, `${label}: current model slate incomplete.`);
  check(initial?.immediateSlate.length === 10, `${label}: immediate model slate incomplete.`);
  check(initial?.heldSlate.length === 10, `${label}: held model slate incomplete.`);
  check(
    initial?.immediateSlate.join("|") !== initial?.heldSlate.join("|"),
    `${label}: representative T1 slates should differ.`
  );

  for (const phase of ["task-start", "outcome-resolved", "next-task"]) {
    await page.locator(`[data-phase="${phase}"]`).click();
    const state = await page.evaluate(() => window.__STORE_V2_RESEARCH__);
    check(state?.phase === phase, `${label}: ${phase} control failed.`);
    check(
      state?.immediateSlate.join("|") === state?.heldSlate.join("|"),
      `${label}: ${phase} fixed boundary should match.`
    );
  }
  await page.locator('[data-mode="fixed-trace"]').click();
  await page.locator('[data-phase="task-in-progress"]').click();
  await page.locator('[data-condition="immediate-remove"]').click();
  await page.locator('[data-case-index="1"]').click();
  const finalState = await page.evaluate(() => window.__STORE_V2_RESEARCH__);
  check(finalState?.mode === "fixed-trace", `${label}: fixed mode control failed.`);
  check(finalState?.condition === "immediate-remove", `${label}: condition control failed.`);
  check(finalState?.caseIndex === 1, `${label}: case control failed.`);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    shelves: document.querySelectorAll(".v2-model-shelf").length,
    externalLinks: [...document.querySelectorAll("a[href]")].filter((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return /^https?:/i.test(href);
    }).length
  }));
  check(dimensions.scrollWidth === dimensions.clientWidth, `${label}: horizontal overflow detected.`);
  check(dimensions.shelves === 3, `${label}: expected three model shelves.`);
  check(dimensions.externalLinks === 0, `${label}: unexpected external navigation exposed.`);
  check(errors.length === 0, `${label}: console errors: ${errors.join(" | ")}`);
  await page.screenshot({ path: path.join(outputDirectory, `${label}.png`), fullPage: true });
  observations.push({ label, viewport, initial, finalState, dimensions, errors });
  await context.close();
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch(
  browserChannel === "bundled"
    ? { headless: true }
    : { channel: browserChannel, headless: true }
);
try {
  await run(browser, { width: 1440, height: 1000 }, "desktop-model-store");
  await run(browser, { width: 390, height: 844 }, "mobile-model-store");
} finally {
  await browser.close();
}

const report = {
  schemaVersion: "online-storefront-v2-qa.v1",
  siteUrl,
  browserChannel,
  checkedAt: new Date().toISOString(),
  passed: failures.length === 0,
  failures,
  observations
};
await writeFile(
  path.join(outputDirectory, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (failures.length > 0) process.exitCode = 1;
