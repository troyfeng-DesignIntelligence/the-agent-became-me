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
  await page.locator(".hero-inferences span").last().waitFor();
  await page.waitForTimeout(2400);

  check(
    (await page.locator("h1").innerText()).includes("The Agent"),
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

  await page.screenshot({
    path: path.join(outputDirectory, "desktop-hero.png")
  });
  await page.locator("#lab").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-lab.png")
  });
  await page.locator("#evidence").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-evidence.png")
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
  await page.locator("#lab").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-lab.png")
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
    .locator(".system-column")
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
