import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:4173";
const outputDirectory = path.resolve(
  process.env.QA_OUTPUT ?? "artifacts/qa"
);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const maximumReadyAttempts = 30;
const readyRetryDelayMs = 500;
const readyRequestTimeoutMs = 1500;
const failures = [];
const observations = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function waitForSite() {
  let lastFailure = "no response";
  for (let attempt = 1; attempt <= maximumReadyAttempts; attempt += 1) {
    try {
      const response = await fetch(siteUrl, {
        signal: AbortSignal.timeout(readyRequestTimeoutMs)
      });
      await response.body?.cancel();
      if (response.ok) return;
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maximumReadyAttempts) {
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, readyRetryDelayMs)
      );
    }
  }

  throw new Error(
    `Site did not become ready at ${siteUrl} after ${maximumReadyAttempts} attempts (${lastFailure}).`
  );
}

async function waitForImage(page, selector) {
  const image = page.locator(selector).first();
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (target) => {
      const element = document.querySelector(target);
      return (
        element instanceof HTMLImageElement &&
        element.complete &&
        element.naturalWidth > 0
      );
    },
    selector
  );
}

async function checkHeroSeparation(page, viewportLabel) {
  const copy = await page.locator(".hero-copy").boundingBox();
  const brief = await page.locator(".hero-brief").boundingBox();
  check(
    Boolean(copy && brief && copy.y + copy.height + 20 <= brief.y),
    `${viewportLabel}: hero copy overlaps the supporting brief.`
  );
}

async function pageOverflow(page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    return {
      clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sources: [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: element.getAttribute("class") ?? "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            ancestors: [
              element.parentElement,
              element.parentElement?.parentElement,
              element.parentElement?.parentElement?.parentElement
            ]
              .filter(Boolean)
              .map((ancestor) => ({
                tag: ancestor.tagName.toLowerCase(),
                className: ancestor.getAttribute("class") ?? "",
                overflowX: getComputedStyle(ancestor).overflowX,
                width: Math.round(ancestor.getBoundingClientRect().width)
              }))
          };
        })
        .filter(
          (item) =>
            item.right > clientWidth + 2 ||
            item.left < -2 ||
            item.width > clientWidth + 2
        )
        .slice(0, 20)
    };
  });
}

async function desktopPass(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".interface-lab").waitFor();
  await waitForImage(page, ".hero-gallery-image");
  await page.waitForTimeout(2400);
  await checkHeroSeparation(page, "Desktop");

  check(
    (await page.locator("h1").innerText()).toLowerCase().includes("the agent"),
    "Desktop: the project title is missing."
  );
  check(
    (await page.locator(".evidence-intro").innerText()).includes(
      "Selective provenance did not beat"
    ),
    "Desktop: the falsification headline did not load."
  );
  check(
    (await page.getByRole("tab").count()) === 6,
    "Desktop: the interface lab does not expose all six Study A contracts."
  );
  check(
    (await page.locator(".vis--condition-outcomes").count()) === 3,
    "Desktop: the three separated outcome panels did not render."
  );
  check(
    (await page.locator(".plate-meta").count()) === 8,
    "Desktop: evidence plates are missing grain/protocol metadata."
  );
  check(
    (await page.locator("main img").count()) >= 6,
    "Desktop: the photographic evidence series is incomplete."
  );

  await page.screenshot({
    path: path.join(outputDirectory, "desktop-hero.png")
  });
  await waitForImage(page, ".question-specimen img");
  await page.locator(".question-specimen").screenshot({
    path: path.join(outputDirectory, "desktop-question-specimen.png")
  });
  await page.locator("#lab").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-lab.png")
  });
  await page.locator(".trace-field-interlude").screenshot({
    path: path.join(outputDirectory, "desktop-trace-field.png")
  });
  await page.locator("#evidence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-evidence.png")
  });
  await waitForImage(page, ".identity-specimen img");
  await page.locator(".identity-specimen").screenshot({
    path: path.join(outputDirectory, "desktop-identity-specimen.png")
  });
  await page.locator(".plate").nth(1).screenshot({
    path: path.join(outputDirectory, "desktop-contracts.png")
  });
  await page.locator(".plate").nth(2).screenshot({
    path: path.join(outputDirectory, "desktop-profile-strata.png")
  });
  await page.locator(".plate").nth(3).screenshot({
    path: path.join(outputDirectory, "desktop-provenance-braid.png")
  });
  await page.locator(".plate").nth(6).screenshot({
    path: path.join(outputDirectory, "desktop-outcomes.png")
  });
  await page.locator(".plate").nth(7).screenshot({
    path: path.join(outputDirectory, "desktop-counterexample.png")
  });
  await waitForImage(page, ".study-archive img");
  await page.locator(".study-archive").screenshot({
    path: path.join(outputDirectory, "desktop-study-archive.png")
  });
  await page.locator(".study-block.is-secondary").screenshot({
    path: path.join(outputDirectory, "desktop-study-blue-paper.png")
  });
  await page.locator(".study-block.is-tertiary").screenshot({
    path: path.join(outputDirectory, "desktop-study-red-paper.png")
  });
  await waitForImage(page, ".reliquary-interlude img");
  await page.locator(".reliquary-interlude").screenshot({
    path: path.join(outputDirectory, "desktop-reliquary-interlude.png")
  });
  await page.locator(".implications-section").screenshot({
    path: path.join(outputDirectory, "desktop-implications-paper.png")
  });
  await page.locator("#methods").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-methods.png")
  });

  await page.locator("#lab").scrollIntoViewIfNeeded();
  await page
    .getByRole("tab", { name: /scope-gated/i })
    .click();
  check(
    (await page.locator(".profile-inspector .status-pill").innerText())
      .toLowerCase()
      .includes("excluded"),
    "Desktop: scope-gated replay did not expose the excluded update state."
  );
  await page.locator('input[aria-label="Trace step"]').fill("16");
  check(
    (await page.locator(".trace-receipt").innerText()).includes("17 / 17"),
    "Desktop: the trace scrubber did not reach the final event."
  );

  const overflow = await pageOverflow(page);
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Desktop: document overflows horizontally (${overflow.scrollWidth}px > ${overflow.clientWidth}px).`
  );
  check(
    consoleErrors.length === 0,
    `Desktop: browser console errors: ${consoleErrors.join(" | ")}`
  );
  observations.push({ viewport: "desktop", overflow, consoleErrors });
  await context.close();
}

async function compactDesktopPass(browser) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    colorScheme: "light"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  await waitForImage(page, ".hero-gallery-image");
  await page.waitForTimeout(1200);
  await checkHeroSeparation(page, "Compact desktop");
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-compact-hero.png")
  });

  const overflow = await pageOverflow(page);
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Compact desktop: document overflows horizontally (${overflow.scrollWidth}px > ${overflow.clientWidth}px).`
  );
  check(
    consoleErrors.length === 0,
    `Compact desktop: browser console errors: ${consoleErrors.join(" | ")}`
  );
  observations.push({ viewport: "compact-desktop", overflow, consoleErrors });
  await context.close();
}

async function mobilePass(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".interface-lab").waitFor();
  await page.waitForTimeout(2400);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-hero.png")
  });
  await waitForImage(page, ".question-specimen img");
  await page.locator(".question-specimen").screenshot({
    path: path.join(outputDirectory, "mobile-question-specimen.png")
  });
  await page.locator("#lab").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-lab.png")
  });
  await page.locator(".trace-field-interlude").screenshot({
    path: path.join(outputDirectory, "mobile-trace-field.png")
  });
  await page.locator(".lab-toolbar").screenshot({
    path: path.join(outputDirectory, "mobile-contract-tabs.png")
  });
  await page.locator("#evidence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-evidence.png"),
    fullPage: false
  });
  await waitForImage(page, ".identity-specimen img");
  await page.locator(".identity-specimen").screenshot({
    path: path.join(outputDirectory, "mobile-identity-specimen.png")
  });
  await waitForImage(page, ".study-archive img");
  await page.locator(".study-archive").screenshot({
    path: path.join(outputDirectory, "mobile-study-archive.png")
  });
  await waitForImage(page, ".reliquary-interlude img");
  await page.locator(".reliquary-interlude").screenshot({
    path: path.join(outputDirectory, "mobile-reliquary-interlude.png")
  });
  await page.locator("#methods").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-methods.png"),
    fullPage: false
  });

  const overflow = await pageOverflow(page);
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Mobile: document overflows horizontally (${overflow.scrollWidth}px > ${overflow.clientWidth}px).`
  );
  check(
    consoleErrors.length === 0,
    `Mobile: browser console errors: ${consoleErrors.join(" | ")}`
  );
  observations.push({ viewport: "mobile", overflow, consoleErrors });
  await context.close();
}

async function reducedMotionPass(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  const mediaMatches = await page.evaluate(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const duration = await page
    .locator(".hero-gallery-art")
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  check(mediaMatches, "Reduced motion: emulation did not activate.");
  check(
    duration === "1e-05s" || duration === "0.01ms" || duration === "0s",
    `Reduced motion: animation duration remained ${duration}.`
  );
  observations.push({ viewport: "reduced-motion", mediaMatches, duration });
  await context.close();
}

await mkdir(outputDirectory, { recursive: true });
await waitForSite();
const browser = await chromium.launch(
  browserChannel === "bundled"
    ? { headless: true }
    : { channel: browserChannel, headless: true }
);

try {
  await desktopPass(browser);
  await compactDesktopPass(browser);
  await mobilePass(browser);
  await reducedMotionPass(browser);
} finally {
  await browser.close();
}

const report = {
  siteUrl,
  browserChannel,
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

if (failures.length > 0) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(report, null, 2));
}
