import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const siteUrl =
  process.env.SITE_URL ?? process.argv[2] ?? "http://127.0.0.1:4173";
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

async function positionForScreenshot(page, selector, topOffset = 96) {
  await page.locator(selector).first().evaluate((element, offset) => {
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "instant" });
  }, topOffset);
}

async function checkHeroSeparation(page, viewportLabel) {
  const copy = await page.locator(".hero-copy").boundingBox();
  const brief = await page.locator(".hero-brief").boundingBox();
  check(
    Boolean(copy && brief && copy.y + copy.height + 20 <= brief.y),
    `${viewportLabel}: hero copy overlaps the supporting brief.`
  );
}

async function checkHeadingHierarchy(page, viewportLabel) {
  const audit = await page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    return [...document.querySelectorAll("main h2")]
      .filter((heading) => {
        const style = getComputedStyle(heading);
        const rect = heading.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map((heading) => {
        const style = getComputedStyle(heading);
        const rect = heading.getBoundingClientRect();
        const text = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const wordCount = text ? text.split(" ").length : 0;
        const fontSize = Number.parseFloat(style.fontSize);
        const heightRatio = rect.height / viewportHeight;
        return {
          section:
            heading.closest("section")?.getAttribute("class") ?? "unknown",
          text,
          wordCount,
          fontSize: Math.round(fontSize),
          height: Math.round(rect.height),
          heightRatio: Number(heightRatio.toFixed(2)),
          oversized:
            heightRatio > 0.58 || (wordCount > 24 && fontSize >= 44)
        };
      });
  });
  const oversized = audit.filter((item) => item.oversized);
  check(
    oversized.length === 0,
    `${viewportLabel}: oversized long-form heading blocks the reading hierarchy (${oversized
      .map((item) => item.text)
      .join(" | ")}).`
  );
  return audit;
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

async function sensitivityLayout(page, viewportLabel) {
  const layout = await page.evaluate(() => {
    const panel = document.querySelector(".sensitivity-panel");
    const header = panel?.querySelector(":scope > header");
    const figure = panel?.querySelector(":scope > div > .vis");
    const legend = panel?.querySelector(".sensitivity-heatmap__legend");
    const axisLabels = [
      ...document.querySelectorAll(
        ".sensitivity-panel .sensitivity-heatmap__svg .vis__axis-label"
      )
    ];
    const rect = (element) => {
      if (!(element instanceof Element)) return null;
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      };
    };
    const overlaps = (left, right) =>
      Boolean(
        left &&
          right &&
          left.left < right.right &&
          left.right > right.left &&
          left.top < right.bottom &&
          left.bottom > right.top
      );
    const panelRect = rect(panel);
    const headerRect = rect(header);
    const figureRect = rect(figure);
    const legendRect = rect(legend);
    const axisRects = axisLabels.map(rect).filter(Boolean);
    return {
      panelRect,
      headerRect,
      figureRect,
      legendRect,
      axisRects,
      insetLeft:
        panelRect && headerRect ? headerRect.left - panelRect.left : null,
      insetRight:
        panelRect && figureRect ? panelRect.right - figureRect.right : null,
      legendAxisOverlap: axisRects.some((axisRect) =>
        overlaps(legendRect, axisRect)
      )
    };
  });

  check(
    layout.insetLeft !== null && layout.insetLeft >= 40,
    `${viewportLabel}: sensitivity copy lacks a safe left inset.`
  );
  check(
    layout.insetRight !== null && layout.insetRight >= 40,
    `${viewportLabel}: sensitivity chart lacks a safe right inset.`
  );
  check(
    !layout.legendAxisOverlap,
    `${viewportLabel}: sensitivity legend overlaps an axis label.`
  );
  return layout;
}

async function checkScrollExperience(page) {
  await positionForScreenshot(page, "#question", 108);
  await page.waitForTimeout(250);
  const questionIsActive = await page
    .locator('.nav-links a[href="#question"]')
    .evaluate((element) => element.classList.contains("is-active"));

  await positionForScreenshot(page, "#lab", 108);
  await page.waitForTimeout(1100);
  const traceIsActive = await page
    .locator('.nav-links a[href="#lab"]')
    .evaluate((element) => element.classList.contains("is-active"));
  const labReveal = await page.locator(".interface-lab").evaluate((element) => ({
    revealed: element.classList.contains("is-revealed"),
    opacity: Number.parseFloat(getComputedStyle(element).opacity)
  }));

  await positionForScreenshot(page, ".trace-field-interlude", 90);
  await page.waitForTimeout(120);
  const shiftBefore = await page
    .locator(".trace-field-interlude > img")
    .evaluate((element) =>
      Number.parseFloat(
        element.style.getPropertyValue("--scroll-shift") || "0"
      )
    );
  await page.evaluate(() => window.scrollBy({ top: 320, behavior: "instant" }));
  await page.waitForTimeout(120);
  const shiftAfter = await page
    .locator(".trace-field-interlude > img")
    .evaluate((element) =>
      Number.parseFloat(
        element.style.getPropertyValue("--scroll-shift") || "0"
      )
    );
  const activeRailMarks = await page.locator(".chapter-rail i.is-active").count();

  check(questionIsActive, "Desktop: question chapter did not become active.");
  check(traceIsActive, "Desktop: trace chapter did not become active.");
  check(
    labReveal.revealed && labReveal.opacity > 0.98,
    "Desktop: the lab did not complete its scroll reveal."
  );
  check(
    Math.abs(shiftAfter - shiftBefore) >= 1,
    "Desktop: the narrative image parallax did not respond to scrolling."
  );
  check(
    activeRailMarks === 1,
    `Desktop: expected one active chapter rail mark, found ${activeRailMarks}.`
  );

  return {
    questionIsActive,
    traceIsActive,
    labReveal,
    shiftBefore,
    shiftAfter,
    activeRailMarks
  };
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
  const headingHierarchy = await checkHeadingHierarchy(page, "Desktop");
  const typography = await page.evaluate(async () => {
    await document.fonts.ready;
    const heroFamily = getComputedStyle(document.querySelector("h1")).fontFamily;
    const questionFamily = getComputedStyle(
      document.querySelector(".question-copy h2")
    ).fontFamily;
    return {
      displayLoaded: document.fonts.check('700 32px "Syne Variable"'),
      editorialLoaded: document.fonts.check(
        '400 32px "Source Serif 4 Variable"'
      ),
      monoLoaded: document.fonts.check('400 16px "IBM Plex Mono"'),
      heroFamily,
      questionFamily
    };
  });
  check(
    typography.displayLoaded && typography.heroFamily.includes("Syne"),
    "Desktop: Syne display type did not load or apply to the hero."
  );
  check(
    typography.editorialLoaded &&
      typography.questionFamily.includes("Source Serif 4"),
    "Desktop: Source Serif 4 did not load or apply to the research question."
  );
  check(
    typography.monoLoaded,
    "Desktop: IBM Plex Mono did not load for data labels."
  );

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
    (await page.locator(".interface-lab").getByRole("tab").count()) === 6,
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
  check(
    (await page.locator(".amazon-condition").count()) === 4,
    "Desktop: the Amazon field probe does not expose all four conditions."
  );
  check(
    (await page.locator(".amazon-lifecycle-row").count()) === 6,
    "Desktop: the Amazon controlled replay does not expose all six lifecycle contracts."
  );
  check(
    (await page.locator(".cross-task-contracts button").count()) === 5,
    "Desktop: the cross-task prototype does not expose all five user-facing lifecycle choices."
  );
  check(
    (await page.locator('.activation-store-link[href*="view=storefront"]').count()) === 1,
    "Desktop: the online research-store link is missing."
  );
  check(
    (await page.locator(".llm-feedback-dose__row").count()) === 2,
    "Desktop: the decoding dose table did not render both LLM providers."
  );
  check(
    (await page.locator(".llm-feedback-resolved article").count()) === 2,
    "Desktop: the forced-inspection comparison did not render both LLM providers."
  );
  check(
    (await page.locator(".llm-feedback-audit").innerText()).includes("NO-GO"),
    "Desktop: the frozen candidate-margin no-go did not render."
  );

  await page.screenshot({
    path: path.join(outputDirectory, "desktop-hero.png")
  });
  const scrollExperience = await checkScrollExperience(page);
  await positionForScreenshot(page, ".question-copy", 108);
  await page.waitForTimeout(1050);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-question-hierarchy.png")
  });
  await waitForImage(page, ".question-specimen img");
  await page.locator(".question-specimen").screenshot({
    path: path.join(outputDirectory, "desktop-question-specimen.png")
  });
  await positionForScreenshot(page, ".gap-section .section-header", 108);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-charcoal-paper.png")
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
  await positionForScreenshot(page, ".webarena-replay .section-header", 108);
  await page.waitForTimeout(1100);
  await page.locator(".webarena-replay").screenshot({
    path: path.join(outputDirectory, "desktop-webarena-replay.png")
  });
  await positionForScreenshot(page, ".webarena-loop-keys", 108);
  await page.waitForTimeout(1100);
  const loopOpacity = await page
    .locator(".webarena-loop-keys article")
    .first()
    .evaluate((element) => getComputedStyle(element).opacity);
  check(
    Number.parseFloat(loopOpacity) >= 0.99,
    "Desktop: WebArena loop comparison remained hidden after scroll."
  );
  await page.locator(".webarena-loop-keys").screenshot({
    path: path.join(outputDirectory, "desktop-webarena-loop-keys.png")
  });
  await positionForScreenshot(page, ".webarena-contracts", 108);
  await page.waitForTimeout(500);
  const contractOpacity = await page
    .locator(".webarena-contract")
    .first()
    .evaluate((element) => getComputedStyle(element).opacity);
  check(contractOpacity === "1", "Desktop: WebArena lifecycle rows remained hidden after scroll.");
  await page.locator(".webarena-contracts").screenshot({
    path: path.join(outputDirectory, "desktop-webarena-lifecycle.png")
  });
  await positionForScreenshot(page, ".amazon-field .section-header", 108);
  await page.waitForTimeout(1100);
  await positionForScreenshot(page, ".amazon-condition-grid", 108);
  await page.waitForTimeout(1100);
  const amazonSignalText = (
    await page.locator(".amazon-condition.is-signal").innerText()
  ).toLowerCase();
  check(
    amazonSignalText.includes("new known modules") &&
      amazonSignalText.includes("telephone +6"),
    "Desktop: the Amazon product-view signal is incomplete."
  );
  await page.locator(".amazon-condition-grid").screenshot({
    path: path.join(outputDirectory, "desktop-amazon-conditions.png")
  });
  await waitForImage(page, ".amazon-evidence-pair img");
  check(
    (await page.locator(".amazon-evidence-pair img").count()) === 2,
    "Desktop: the before/after Amazon evidence pair is incomplete."
  );
  await page
    .locator(".amazon-evidence-tabs")
    .getByRole("tab", { name: /search only/i })
    .click();
  check(
    (await page.locator(".amazon-evidence-pair img").first().getAttribute("src"))?.includes(
      "search-only-baseline-redacted"
    ),
    "Desktop: the Amazon evidence tabs did not change the source pair."
  );
  await page
    .locator(".amazon-evidence-tabs")
    .getByRole("tab", { name: /product views/i })
    .click();
  await page.locator(".amazon-evidence").screenshot({
    path: path.join(outputDirectory, "desktop-amazon-evidence.png")
  });
  await positionForScreenshot(page, ".amazon-lifecycle-row", 180);
  await page.waitForTimeout(1100);
  const amazonRowOpacity = await page
    .locator(".amazon-lifecycle-row")
    .first()
    .evaluate((element) => getComputedStyle(element).opacity);
  check(
    amazonRowOpacity === "1",
    "Desktop: Amazon lifecycle rows remained hidden after scroll."
  );
  await page.locator(".amazon-controlled").screenshot({
    path: path.join(outputDirectory, "desktop-amazon-controlled.png")
  });
  await positionForScreenshot(page, ".external-validation", 88);
  await page.waitForTimeout(550);
  check(
    (await page.locator(".external-validation-models article").count()) === 3,
    "Desktop: the external-validity panel did not render three recommender families."
  );
  check(
    (await page.locator(".external-validation").innerText()).includes("50.2%"),
    "Desktop: the sequential spillover result did not load."
  );
  await page.locator(".external-validation").screenshot({
    path: path.join(outputDirectory, "desktop-external-validation.png")
  });
  await positionForScreenshot(page, ".learned-commerce", 88);
  await page.waitForTimeout(550);
  check(
    (await page.locator(".learned-commerce-lifecycles article").count()) === 3,
    "Desktop: the learned-commerce panel did not render three lifecycle conditions."
  );
  check(
    (await page.locator(".learned-commerce").innerText()).includes("0.464"),
    "Desktop: the learned SASRec NDCG result did not load."
  );
  await page.locator(".learned-commerce").screenshot({
    path: path.join(outputDirectory, "desktop-learned-commerce.png")
  });
  await positionForScreenshot(page, ".llm-feedback-panel", 88);
  await page.waitForTimeout(550);
  check(
    (await page.locator(".llm-feedback-resolved__note").innerText()).includes("24/32"),
    "Desktop: the trace-versus-decision result did not load."
  );
  await page.locator(".llm-feedback-panel").screenshot({
    path: path.join(outputDirectory, "desktop-llm-feedback-boundary.png")
  });
  await positionForScreenshot(page, ".cross-category-replication", 88);
  await page.waitForTimeout(550);
  check(
    (await page.locator(".replication-forest-row").count()) === 5,
    "Desktop: cross-category forest plot did not render four categories and one pooled row."
  );
  check(
    (await page.locator(".cross-category-replication").innerText()).includes("+0.321"),
    "Desktop: pooled cross-category interval did not load."
  );
  await page.locator(".cross-category-replication").screenshot({
    path: path.join(outputDirectory, "desktop-cross-category-replication.png")
  });
  await positionForScreenshot(page, ".activation-study", 88);
  await page.waitForTimeout(1100);
  await waitForImage(page, ".activation-evidence img");
  check(
    (await page.locator(".activation-timeline article").count()) === 4,
    "Desktop: activation-timing panel did not render four checkpoints."
  );
  check(
    (await page.locator(".activation-study").innerText()).includes("0.766"),
    "Desktop: activation-timing result did not load."
  );
  await page.locator(".activation-study").screenshot({
    path: path.join(outputDirectory, "desktop-activation-timing.png")
  });
  await positionForScreenshot(page, ".pollution-map", 88);
  await page.waitForTimeout(550);
  check(
    (await page.locator(".pollution-cell").count()) === 25,
    "Desktop: the selected pollution phase slice does not contain 25 cells."
  );
  check(
    (await page.locator(".pollution-map > footer").innerText()).includes("54%"),
    "Desktop: the pollution phase summary did not load."
  );
  await page
    .locator(".pollution-controls")
    .getByRole("button", { name: /intent weighted/i })
    .click();
  await page
    .locator(".pollution-controls fieldset")
    .nth(1)
    .getByRole("button", { name: "1.00", exact: true })
    .click();
  check(
    (await page.locator(".pollution-detail").innerText()).includes("Task similarity"),
    "Desktop: the pollution-cell detail panel did not render."
  );
  await page.locator(".pollution-map").screenshot({
    path: path.join(outputDirectory, "desktop-pollution-phase-map.png")
  });
  await positionForScreenshot(page, ".cross-task-control-lab", 96);
  await page.waitForTimeout(1100);
  check(
    (await page.locator(".cross-task-results").innerText()).includes("24.17"),
    "Desktop: the cross-task aggregate result did not load."
  );
  await page.getByRole("button", { name: /hold until outcome/i }).click();
  await page.locator('input[aria-label="Cross-task timeline"]').fill("3");
  check(
    (await page.locator(".cross-task-status").innerText())
      .toLowerCase()
      .includes("held outside profile"),
    "Desktop: quarantine did not expose the held profile state."
  );
  await page.locator('input[aria-label="Cross-task timeline"]').fill("4");
  check(
    (await page.locator(".cross-task-shelf output").innerText()).startsWith("0 / 6"),
    "Desktop: abandoned quarantined evidence leaked into the follow-up shelf."
  );
  await page.getByRole("button", { name: /undo on failure/i }).click();
  await page.locator('input[aria-label="Cross-task timeline"]').fill("3");
  check(
    Number.parseFloat(await page.locator(".cross-task-meter > strong").innerText()) > 0.9,
    "Desktop: rollback did not expose provisional profile evidence."
  );
  await page.locator('input[aria-label="Cross-task timeline"]').fill("4");
  check(
    (await page.locator(".cross-task-status").innerText())
      .toLowerCase()
      .includes("removed"),
    "Desktop: rollback did not remove abandoned-task evidence after the boundary."
  );
  await page.getByRole("button", { name: /learn now/i }).click();
  await page.locator('input[aria-label="Cross-task timeline"]').fill("4");
  await page.locator(".cross-task-control-lab").screenshot({
    path: path.join(outputDirectory, "desktop-cross-task-control.png")
  });
  await positionForScreenshot(page, ".webarena-replay .section-header", 108);
  await page.waitForTimeout(250);
  await page.locator(".webarena-replay").screenshot({
    path: path.join(outputDirectory, "desktop-webarena-replay.png")
  });
  await waitForImage(page, ".reliquary-interlude img");
  await page.locator(".reliquary-interlude").screenshot({
    path: path.join(outputDirectory, "desktop-reliquary-interlude.png")
  });
  await page.locator(".implications-section").screenshot({
    path: path.join(outputDirectory, "desktop-implications-paper.png")
  });
  await positionForScreenshot(page, ".findings-section .section-header", 108);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-cotton-paper.png")
  });
  await page.locator("#methods").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-methods.png")
  });
  await positionForScreenshot(page, ".sensitivity-panel", 90);
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-sensitivity-panel.png")
  });
  const sensitivity = await sensitivityLayout(page, "Desktop");

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
  observations.push({
    viewport: "desktop",
    overflow,
    consoleErrors,
    headingHierarchy,
    sensitivity,
    scrollExperience,
    typography
  });
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
  const headingHierarchy = await checkHeadingHierarchy(
    page,
    "Compact desktop"
  );
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
  observations.push({
    viewport: "compact-desktop",
    overflow,
    consoleErrors,
    headingHierarchy
  });
  await context.close();
}

async function tabletHeroPass(browser) {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1000 },
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
  await page.waitForTimeout(1400);
  await checkHeroSeparation(page, "Tablet");

  const heroTypography = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const title = document.querySelector(".hero h1");
    const identity = document.querySelector(".identity-cut");
    const spans = [...document.querySelectorAll(".hero h1 > span")].map(
      (span) => {
        const box = span.getBoundingClientRect();
        return {
          text: span.textContent?.trim() ?? "",
          left: Math.round(box.left),
          right: Math.round(box.right)
        };
      }
    );
    const titleStyle = getComputedStyle(title);
    const identityStyle = getComputedStyle(identity);
    return {
      viewportWidth,
      spans,
      titleSize: Number.parseFloat(titleStyle.fontSize),
      identitySize: Number.parseFloat(identityStyle.fontSize),
      identityFamily: identityStyle.fontFamily,
      identityWeight: Number.parseFloat(identityStyle.fontWeight)
    };
  });
  check(
    heroTypography.spans.every(
      (span) => span.left >= 0 && span.right <= heroTypography.viewportWidth
    ),
    "Tablet: a hero title line is clipped by the viewport."
  );
  check(
    heroTypography.identityFamily.includes("Source Serif 4") &&
      heroTypography.identitySize > heroTypography.titleSize &&
      heroTypography.identityWeight >= 550,
    "Tablet: the Me signature treatment did not apply."
  );

  await page.screenshot({
    path: path.join(outputDirectory, "tablet-hero.png")
  });
  const overflow = await pageOverflow(page);
  check(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Tablet: document overflows horizontally (${overflow.scrollWidth}px > ${overflow.clientWidth}px).`
  );
  check(
    consoleErrors.length === 0,
    `Tablet: browser console errors: ${consoleErrors.join(" | ")}`
  );
  observations.push({
    viewport: "tablet",
    overflow,
    consoleErrors,
    heroTypography
  });
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
  const headingHierarchy = await checkHeadingHierarchy(page, "Mobile");
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-hero.png")
  });
  await positionForScreenshot(page, ".question-copy", 78);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-question-hierarchy.png")
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
  await positionForScreenshot(page, ".amazon-field .section-header", 78);
  await page.waitForTimeout(650);
  await page.locator(".amazon-field-lead").screenshot({
    path: path.join(outputDirectory, "mobile-amazon-field.png")
  });
  await page.locator(".amazon-evidence").screenshot({
    path: path.join(outputDirectory, "mobile-amazon-evidence.png")
  });
  await page.locator(".amazon-controlled").screenshot({
    path: path.join(outputDirectory, "mobile-amazon-controlled.png")
  });
  await page.locator(".external-validation").screenshot({
    path: path.join(outputDirectory, "mobile-external-validation.png")
  });
  await positionForScreenshot(page, ".learned-commerce", 72);
  await page.waitForTimeout(650);
  await page.locator(".learned-commerce").screenshot({
    path: path.join(outputDirectory, "mobile-learned-commerce.png")
  });
  await positionForScreenshot(page, ".llm-feedback-panel", 72);
  await page.waitForTimeout(650);
  check(
    (await page.locator(".llm-feedback-dose__row").count()) === 2,
    "Mobile: the decoding dose table did not render both LLM providers."
  );
  check(
    (await page.locator(".llm-feedback-audit").innerText()).includes("0.50"),
    "Mobile: the candidate-margin audit metrics did not render."
  );
  await page.locator(".llm-feedback-panel").screenshot({
    path: path.join(outputDirectory, "mobile-llm-feedback-boundary.png")
  });
  await positionForScreenshot(page, ".cross-category-replication", 72);
  await page.waitForTimeout(650);
  await page.locator(".cross-category-replication").screenshot({
    path: path.join(outputDirectory, "mobile-cross-category-replication.png")
  });
  await positionForScreenshot(page, ".activation-study", 72);
  await page.waitForTimeout(1100);
  await waitForImage(page, ".activation-evidence img");
  check(
    await page.locator(".activation-study").evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).opacity) > 0.98
    ),
    "Mobile: activation-timing panel remained hidden after scroll reveal."
  );
  await page.locator(".activation-study").screenshot({
    path: path.join(outputDirectory, "mobile-activation-timing.png")
  });
  await page.locator(".pollution-map").screenshot({
    path: path.join(outputDirectory, "mobile-pollution-phase-map.png")
  });
  await positionForScreenshot(page, ".cross-task-control-lab", 72);
  await page.waitForTimeout(650);
  await page.locator(".cross-task-control-bar").screenshot({
    path: path.join(outputDirectory, "mobile-cross-task-controls.png")
  });
  await page.locator(".cross-task-shelf").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.locator(".cross-task-shelf").screenshot({
    path: path.join(outputDirectory, "mobile-cross-task-shelf.png")
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
  observations.push({
    viewport: "mobile",
    overflow,
    consoleErrors,
    headingHierarchy
  });
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
  const revealState = await page.locator(".question-copy > *").first().evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    animationName: getComputedStyle(element).animationName,
    revealed: element.classList.contains("is-revealed")
  }));
  check(mediaMatches, "Reduced motion: emulation did not activate.");
  check(
    duration === "1e-05s" || duration === "0.01ms" || duration === "0s",
    `Reduced motion: animation duration remained ${duration}.`
  );
  check(
    revealState.opacity === "1" && revealState.animationName === "none",
    "Reduced motion: scroll-reveal content still animates or remains hidden."
  );
  observations.push({
    viewport: "reduced-motion",
    mediaMatches,
    duration,
    revealState
  });
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
  await tabletHeroPass(browser);
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
