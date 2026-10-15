import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const siteUrl = process.env.SITE_URL ?? "http://127.0.0.1:5173/?view=service-design";
const outputDirectory = path.resolve("artifacts/service-design-review");
const failures = [];
const observations = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function inspect(page, viewport) {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(siteUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    plates: document.querySelectorAll(".sd-plate").length,
    blueprintRows: document.querySelectorAll(".sd-blueprint__row").length,
    recoveryPaths: document.querySelectorAll(".sd-recovery-card").length,
    decisionRows: document.querySelectorAll(".sd-decision-matrix article").length,
    systemMap: {
      clientWidth: document.querySelector(".sd-system-map")?.clientWidth ?? 0,
      scrollWidth: document.querySelector(".sd-system-map")?.scrollWidth ?? 0
    },
    blueprint: {
      clientWidth: document.querySelector(".sd-blueprint-wrap")?.clientWidth ?? 0,
      scrollWidth: document.querySelector(".sd-blueprint-wrap")?.scrollWidth ?? 0
    },
    matrix: {
      clientWidth: document.querySelector(".sd-matrix-wrap")?.clientWidth ?? 0,
      scrollWidth: document.querySelector(".sd-matrix-wrap")?.scrollWidth ?? 0
    },
    title: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim()
  }));

  check(layout.scrollWidth <= layout.clientWidth + 1, `${viewport}: document overflows horizontally.`);
  check(layout.plates === 4, `${viewport}: expected four service-design plates.`);
  check(layout.blueprintRows === 6, `${viewport}: expected six responsibility lanes.`);
  check(layout.recoveryPaths === 4, `${viewport}: expected four outcome recovery paths.`);
  check(layout.decisionRows === 4, `${viewport}: expected four evidence-to-design rows.`);
  check((await page.locator(".sd-back-link").count()) === 1, `${viewport}: back-to-case link is missing.`);
  check(!(await page.locator("body").innerText()).includes("not yet integrated"), `${viewport}: draft integration copy remains.`);
  if (viewport === "mobile") {
    check(layout.systemMap.scrollWidth > layout.systemMap.clientWidth, "mobile: system map should be an intentional internal scroller.");
    check(layout.blueprint.scrollWidth > layout.blueprint.clientWidth, "mobile: blueprint should be an intentional internal scroller.");
    check(layout.matrix.scrollWidth <= layout.matrix.clientWidth + 1, "mobile: evidence matrix cards should not require horizontal scrolling.");
  }
  check(consoleErrors.length === 0, `${viewport}: console errors: ${consoleErrors.join(" | ")}`);

  observations.push({ viewport, layout, consoleErrors });
  return layout;
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const desktopPage = await desktop.newPage();
  await inspect(desktopPage, "desktop");
  await desktopPage.locator(".sd-review__hero").screenshot({
    path: path.join(outputDirectory, "desktop-hero.png")
  });
  const plateNames = ["system-map", "service-blueprint", "outcome-recovery", "evidence-to-design"];
  for (let index = 0; index < plateNames.length; index += 1) {
    await desktopPage.locator(".sd-plate").nth(index).screenshot({
      path: path.join(outputDirectory, `desktop-${plateNames[index]}.png`)
    });
  }
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobile.newPage();
  await inspect(mobilePage, "mobile");
  await mobilePage.locator(".sd-review__hero").screenshot({
    path: path.join(outputDirectory, "mobile-hero.png")
  });
  await mobilePage.locator(".sd-system-map").screenshot({
    path: path.join(outputDirectory, "mobile-system-map-start.png")
  });
  await mobilePage.locator(".sd-system-map").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await mobilePage.locator(".sd-system-map").screenshot({
    path: path.join(outputDirectory, "mobile-system-map-end.png")
  });
  await mobilePage.locator(".sd-blueprint-wrap").screenshot({
    path: path.join(outputDirectory, "mobile-service-blueprint-start.png")
  });
  await mobilePage.locator(".sd-blueprint-wrap").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await mobilePage.locator(".sd-blueprint-wrap").screenshot({
    path: path.join(outputDirectory, "mobile-service-blueprint-end.png")
  });
  await mobilePage.locator(".sd-recovery-grid").screenshot({
    path: path.join(outputDirectory, "mobile-outcome-recovery.png")
  });
  await mobilePage.locator(".sd-decision-matrix").screenshot({
    path: path.join(outputDirectory, "mobile-evidence-to-design.png")
  });
  await mobile.close();
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
