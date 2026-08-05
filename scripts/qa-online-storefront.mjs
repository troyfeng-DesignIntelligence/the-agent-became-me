import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:4173/";
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const outputDirectory = path.resolve("artifacts/qa-online-storefront");
const failures = [];
const observations = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function urlFor(arm) {
  const url = new URL(siteUrl);
  url.searchParams.set("view", "storefront");
  url.searchParams.set("task", "cereal-selected");
  url.searchParams.set("arm", arm);
  return url.href;
}

async function runFlow(browser, arm, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(urlFor(arm), { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="platform-recommendations"]').waitFor();
  const initial = await page.evaluate(() => window.__STORE_RESEARCH__);
  check(initial?.phase === "task-start", `${label}: initial checkpoint missing.`);
  check(initial?.platformRecommendationIds.length === 10, `${label}: initial platform shelf incomplete.`);
  check(initial?.taskRecommendationIds.length === 10, `${label}: task-local shelf incomplete.`);
  await page.locator('[data-action="search"]').click();
  const viewButtons = page.locator('[data-action="view-product"]');
  for (let index = 0; index < 3; index += 1) await viewButtons.nth(index).click();
  const inProgress = await page.evaluate(() => window.__STORE_RESEARCH__);
  check(inProgress?.phase === "task-in-progress", `${label}: in-progress checkpoint missing.`);
  check(inProgress?.viewedIds.length === 3, `${label}: expected three viewed products.`);
  check(
    arm === "held" ? inProgress?.stagedIds.length === 3 : inProgress?.stagedIds.length === 0,
    `${label}: evidence firewall count is wrong.`
  );
  await page.locator('[data-action="resolve-selected"]').click();
  check((await page.evaluate(() => window.__STORE_RESEARCH__?.phase)) === "outcome-resolved", `${label}: resolved checkpoint missing.`);
  await page.locator('[data-action="begin-next-task"]').click();
  check((await page.evaluate(() => window.__STORE_RESEARCH__?.phase)) === "next-task", `${label}: next-task checkpoint missing.`);
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector("h1")?.textContent?.trim(),
    buttons: document.querySelectorAll("button").length,
    externalProductLinks: [...document.querySelectorAll("a[href]")].filter((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return /^https?:/i.test(href);
    }).length
  }));
  check(dimensions.scrollWidth === dimensions.clientWidth, `${label}: horizontal overflow detected.`);
  check(dimensions.externalProductLinks === 0, `${label}: external product link exposed.`);
  check(errors.length === 0, `${label}: console errors: ${errors.join(" | ")}`);
  await page.screenshot({ path: path.join(outputDirectory, `${label}.png`), fullPage: true });
  observations.push({ label, arm, viewport, errors, dimensions });
  await context.close();
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch(
  browserChannel === "bundled" ? { headless: true } : { channel: browserChannel, headless: true }
);
try {
  await runFlow(browser, "immediate", { width: 1440, height: 1000 }, "desktop-immediate");
  await runFlow(browser, "held", { width: 1440, height: 1000 }, "desktop-held");
  await runFlow(browser, "held", { width: 390, height: 844 }, "mobile-held");
} finally {
  await browser.close();
}

const report = {
  schemaVersion: "online-storefront-qa.v1",
  siteUrl,
  browserChannel,
  checkedAt: new Date().toISOString(),
  passed: failures.length === 0,
  failures,
  observations
};
await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (failures.length > 0) process.exitCode = 1;
