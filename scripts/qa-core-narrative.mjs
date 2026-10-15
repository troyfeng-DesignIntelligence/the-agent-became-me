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
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

  const bodyText = await page.locator("body").innerText();
  check(!bodyText.toLowerCase().includes("third-family"), `${name}: third-family language remains on the main page.`);
  check((await page.locator("#lab").count()) === 0, `${name}: the synthetic lab is still in the main narrative.`);
  check((await page.locator(".webarena-replay").count()) === 0, `${name}: WebArena is still in the main narrative.`);
  check((await page.locator(".amazon-field").count()) === 0, `${name}: the Amazon probe is still in the main narrative.`);
  check((await page.locator(".project-ownership").count()) === 1, `${name}: project ownership is missing.`);
  check((await page.locator(".project-decision").count()) === 3, `${name}: the three design decisions are incomplete.`);
  check((await page.locator(".portfolio-outcome-summary").count()) === 1, `${name}: concise outcome summary is missing.`);
  check((await page.locator(".cross-category-replication").count()) === 0, `${name}: detailed cross-category evidence remains in the default case.`);
  check((await page.locator(".online-v2-study").count()) === 0, `${name}: detailed storefront study remains in the default case.`);
  check((await page.locator(".llm-feedback-panel").count()) === 0, `${name}: detailed LLM history remains in the default case.`);
  check((await page.locator(".cross-task-control-lab").count()) === 1, `${name}: the control prototype is missing.`);
  check(
    (await page.locator(".activation-gate-blueprint").count()) === 1,
    `${name}: the paired activation-gate blueprint is missing.`
  );
  check(
    (await page.locator(".activation-gate-arm").count()) === 2,
    `${name}: the paired service policies are incomplete.`
  );
  check(
    (await page.locator(".hero-ledger").innerText()).includes("7,360"),
    `${name}: the hero still reports an obsolete pilot count.`
  );
  check((await page.locator('.artifact-links a[href*="archive=1"]').count()) === 1, `${name}: the development archive link is missing.`);

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
  await page.locator(".portfolio-outcome-summary").screenshot({
    path: path.join(outputDirectory, `${name}-portfolio-outcomes.png`)
  });
  await page.locator(".project-ownership").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator(".project-ownership").screenshot({
    path: path.join(outputDirectory, `${name}-ownership.png`)
  });
  const activationGate = page.locator(".cross-task-control-lab");
  await activationGate.evaluate((element) => {
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY - 70
    });
  });
  await page.waitForTimeout(600);
  const defaultRankingStates = await page
    .locator(".activation-gate-state-grid > div:last-child dd")
    .allTextContents();
  check(
    defaultRankingStates.join("|") === "ACTIVE|HELD",
    `${name}: unresolved ranking states are not ACTIVE versus HELD.`
  );
  const mobileSummary = page.locator(".activation-gate-mobile-summary");
  const expectsCompactMobileGate = viewport.width <= 600;
  check(
    (await mobileSummary.isVisible()) === expectsCompactMobileGate,
    `${name}: the compact gate summary has the wrong responsive visibility.`
  );
  if (expectsCompactMobileGate) {
    check(
      !(await page.locator(".activation-gate-surface").first().isVisible()),
      `${name}: full shelves should be collapsed before the visitor asks to inspect them.`
    );
    await page.locator(".activation-gate-timeline").screenshot({
      path: path.join(outputDirectory, `${name}-activation-gate-control.png`)
    });
    await mobileSummary.getByRole("button", { name: "Inspect both shelves" }).click();
    check(
      await page.locator(".activation-gate-surface").first().isVisible(),
      `${name}: the shelf comparison did not open from the compact control.`
    );
    check(
      (await mobileSummary.getByRole("button").getAttribute("aria-expanded")) === "true",
      `${name}: the mobile shelf toggle does not expose its expanded state.`
    );
  }
  await page.screenshot({
    path: path.join(outputDirectory, `${name}-activation-gate.png`)
  });

  await page.locator(".activation-gate-timeline input").fill("4");
  const resolvedRankingStates = await page
    .locator(".activation-gate-state-grid > div:last-child dd")
    .allTextContents();
  check(
    resolvedRankingStates.join("|") === "REMOVED|DISCARDED",
    `${name}: abandoned outcome does not resolve to REMOVED versus DISCARDED.`
  );
  await page.locator(".activation-gate-readout").evaluate((element) => {
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY - 70
    });
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outputDirectory, `${name}-activation-gate-resolved.png`)
  });
  await context.close();
  return { name, overflow, consoleErrors };
}

async function checkResearchAppendix(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const researchUrl = new URL(siteUrl);
  researchUrl.searchParams.set("research", "1");
  researchUrl.hash = "evidence";
  await page.goto(researchUrl.href, { waitUntil: "networkidle" });
  check((await page.locator(".portfolio-outcome-summary").count()) === 0, "research: concise outcome summary should yield to the full evidence stack.");
  check((await page.locator(".cross-category-replication").count()) === 1, "research: cross-category evidence is missing.");
  check((await page.locator(".online-v2-study").count()) === 1, "research: storefront study is missing.");
  check((await page.locator(".llm-feedback-panel").count()) === 1, "research: LLM evidence is missing.");
  check((await page.locator(".references-block").count()) === 1, "research: reference appendix is missing.");
  check((await page.locator(".llm-feedback-repair").innerText()).includes("7,360"), "research: confirmatory action result is missing.");
  check((await page.locator(".llm-feedback-panel").innerText()).includes("ONE-STEP FEEDBACK CHAIN"), "research: feedback-chain result is missing.");
  check(consoleErrors.length === 0, `research: console errors: ${consoleErrors.join(" | ")}`);
  await page.locator(".llm-feedback-panel").screenshot({
    path: path.join(outputDirectory, "research-llm-result.png")
  });
  await context.close();
  return { name: "research", consoleErrors };
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
    await checkViewport(browser, { width: 390, height: 844 }, "mobile"),
    await checkResearchAppendix(browser)
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
