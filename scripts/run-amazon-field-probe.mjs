import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(root, "artifacts/amazon-field-probe/live");
const publicDir = resolve(root, "public/results/amazon-field-probe/v1");
const targetOrigin = "https://www.amazon.com";
const taskQuery = "large button corded telephone for seniors";
const taskTokens = ["large button", "corded", "telephone", "senior"];
const conditions = ["idle-control", "search-only", "product-view", "cart-stage"];
const maximumNavigations = 24;
const priorResearchNavigations = 8;
const minimumNavigationIntervalMs = 4000;
let totalNavigations = 0;

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
const round = (value) => Number(value.toFixed(6));
const sleep = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

class ProbeStop extends Error {
  constructor(message, diagnostic) {
    super(message);
    this.diagnostic = diagnostic;
  }
}

function guard(text, status, url) {
  const normalized = text.toLowerCase();
  const signals = {
    captcha: /captcha|enter the characters you see|type the characters/.test(
      normalized
    ),
    robotCheck: /not a robot|automated access|api-services-support@amazon/.test(
      normalized
    ),
    signInRequired: /sign in to continue|authentication required/.test(
      normalized
    ),
    checkout: /\/checkout\//i.test(url),
    throttled: status === 429 || status === 503
  };
  return { signals, stop: status === null || status >= 400 || Object.values(signals).some(Boolean) };
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 7000 }).catch(() => "");
}

async function waitForNavigationBudget() {
  if (totalNavigations >= maximumNavigations) {
    throw new ProbeStop("Navigation budget exhausted", {
      totalNavigations,
      maximumNavigations
    });
  }
  await sleep(minimumNavigationIntervalMs);
}

async function gotoGuarded(page, url, actionLog, label) {
  await waitForNavigationBudget();
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  totalNavigations += 1;
  await page.waitForTimeout(1200);
  const text = await bodyText(page);
  const status = response?.status() ?? null;
  const diagnostic = guard(text, status, page.url());
  actionLog.push({
    label,
    kind: "navigation",
    status,
    origin: new URL(page.url()).origin,
    textSha256: sha256(text)
  });
  if (diagnostic.stop) {
    throw new ProbeStop(`Guard stopped ${label}`, {
      label,
      status,
      url: page.url(),
      ...diagnostic
    });
  }
  return text;
}

async function clickGuarded(page, locator, actionLog, label) {
  await waitForNavigationBudget();
  const navigation = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12_000 })
    .catch(() => null);
  await locator.click({ timeout: 10_000 });
  const response = await navigation;
  if (response) {
    totalNavigations += 1;
    await page.waitForTimeout(1200);
  } else {
    await page.waitForTimeout(1500);
  }
  const text = await bodyText(page);
  const status = response?.status() ?? 200;
  const diagnostic = guard(text, status, page.url());
  actionLog.push({
    label,
    kind: response ? "navigation" : "interaction",
    status,
    origin: new URL(page.url()).origin,
    textSha256: sha256(text)
  });
  if (diagnostic.stop) {
    throw new ProbeStop(`Guard stopped ${label}`, {
      label,
      status,
      url: page.url(),
      ...diagnostic
    });
  }
  return text;
}

async function extractSurface(page, condition, phase) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.65));
  await page.waitForTimeout(900);
  const data = await page.evaluate(({ tokens }) => {
    const text = document.body?.innerText ?? "";
    const normalized = text.toLowerCase();
    const asinPattern = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i;
    const asins = [...document.querySelectorAll("a[href]")].flatMap((anchor) => {
      const match = asinPattern.exec(anchor.getAttribute("href") ?? "");
      return match ? [match[1].toUpperCase()] : [];
    });
    const headings = [...document.querySelectorAll("h1, h2, h3, [role='heading']")]
      .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const knownModules = headings.filter((heading) =>
      /keep shopping|inspired by|related to items|pick up where|browsing history|recommended for you/i.test(
        heading
      )
    );
    return {
      asins: [...new Set(asins)].sort(),
      linkCount: document.querySelectorAll("a[href]").length,
      taskTokenHits: Object.fromEntries(
        tokens.map((token) => [
          token,
          normalized.split(token).length - 1
        ])
      ),
      knownModules: [...new Set(knownModules)].sort(),
      textSha256: ""
    };
  }, { tokens: taskTokens });
  const text = await bodyText(page);
  const screenshotPath = resolve(artifactDir, `${condition}-${phase}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const screenshot = await page.screenshot({ fullPage: false });
  return {
    asinCount: data.asins.length,
    asinSetSha256: sha256(data.asins.join("\n")),
    _asins: data.asins,
    linkCount: data.linkCount,
    taskTokenHits: data.taskTokenHits,
    knownModules: data.knownModules,
    textSha256: sha256(text),
    screenshotSha256: sha256(screenshot)
  };
}

function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  return [...a].filter((value) => b.has(value)).length / union.size;
}

async function search(page, actionLog) {
  const input = page.locator("#twotabsearchtextbox");
  await input.fill(taskQuery);
  await clickGuarded(
    page,
    page.locator("#nav-search-submit-button"),
    actionLog,
    "submit-task-search"
  );
}

async function resultUrls(page) {
  return page
    .locator("[data-component-type='s-search-result'][data-asin]")
    .evaluateAll((cards) =>
      cards.flatMap((card) => {
        const anchor = [...card.querySelectorAll("a[href]")].find((candidate) =>
          /\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i.test(
            candidate.getAttribute("href") ?? ""
          )
        );
        return anchor instanceof HTMLAnchorElement ? [anchor.href] : [];
      }).slice(0, 2)
    );
}

async function runCondition(browser, condition) {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();
  const actionLog = [];
  let cleanup = { attempted: false, cartCountAfter: null };
  try {
    await gotoGuarded(page, `${targetOrigin}/`, actionLog, "baseline-home");
    const baseline = await extractSurface(page, condition, "baseline");

    if (condition === "idle-control") {
      await gotoGuarded(page, `${targetOrigin}/`, actionLog, "post-home");
    } else {
      await search(page, actionLog);
      if (condition === "product-view" || condition === "cart-stage") {
        const urls = await resultUrls(page);
        if (urls.length === 0) {
          throw new ProbeStop("No product result URLs found", { condition });
        }
        const visits = condition === "product-view" ? urls : urls.slice(0, 1);
        for (const [index, url] of visits.entries()) {
          await gotoGuarded(page, url, actionLog, `open-product-${index + 1}`);
        }
        if (condition === "cart-stage") {
          const addButton = page.locator("#add-to-cart-button").first();
          if (!(await addButton.isVisible().catch(() => false))) {
            throw new ProbeStop("Add-to-cart control unavailable", { condition });
          }
          await clickGuarded(page, addButton, actionLog, "add-to-cart");
        }
      }
      await gotoGuarded(page, `${targetOrigin}/`, actionLog, "post-home");
    }

    const post = await extractSurface(page, condition, "post");

    if (condition === "cart-stage") {
      cleanup.attempted = true;
      await gotoGuarded(page, `${targetOrigin}/gp/cart/view.html`, actionLog, "cart-cleanup");
      const deleteControl = page
        .locator("input[value='Delete'], [data-action='delete'] input")
        .first();
      if (await deleteControl.isVisible().catch(() => false)) {
        await clickGuarded(page, deleteControl, actionLog, "remove-from-cart");
      }
      const countText = await page.locator("#nav-cart-count").textContent().catch(() => null);
      cleanup.cartCountAfter = countText === null ? null : Number.parseInt(countText, 10);
    }

    return {
      condition,
      status: "completed",
      baseline: { ...baseline, _asins: undefined },
      post: { ...post, _asins: undefined },
      asinJaccard: round(jaccard(baseline._asins, post._asins)),
      taskTokenDelta: Object.fromEntries(
        taskTokens.map((token) => [
          token,
          (post.taskTokenHits[token] ?? 0) -
            (baseline.taskTokenHits[token] ?? 0)
        ])
      ),
      moduleDelta: post.knownModules.filter(
        (module) => !baseline.knownModules.includes(module)
      ),
      actionLog,
      cleanup
    };
  } finally {
    await context.close();
  }
}

await mkdir(artifactDir, { recursive: true });
await mkdir(publicDir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const rows = [];
let stop = null;
let fatal = null;
try {
  for (const condition of conditions) {
    try {
      rows.push(await runCondition(browser, condition));
    } catch (error) {
      const diagnostic =
        error instanceof ProbeStop
          ? error.diagnostic
          : { message: error instanceof Error ? error.message : String(error) };
      rows.push({ condition, status: "stopped", diagnostic });
      stop = { condition, diagnostic };
      await writeFile(
        resolve(artifactDir, "checkpoint.json"),
        `${JSON.stringify({ rows, totalNavigations, stop }, null, 2)}\n`,
        "utf8"
      );
      break;
    }
    await writeFile(
      resolve(artifactDir, "checkpoint.json"),
      `${JSON.stringify({ rows, totalNavigations, stop }, null, 2)}\n`,
      "utf8"
    );
  }
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close().catch(() => undefined);
}

const completed = rows.filter((row) => row.status === "completed");
const summary = {
  schemaVersion: "amazon-signed-out-field-probe.v1",
  evidenceStatus: "live-interface-observation",
  executedAt: new Date().toISOString(),
  design: {
    task: "temporary accessibility-oriented landline-phone shopping task",
    conditions,
    signedOut: true,
    isolatedContexts: true,
    maximumNavigations,
    minimumNavigationIntervalMs,
    prohibitedActions: [
      "login",
      "account creation",
      "purchase",
      "checkout",
      "CAPTCHA solving",
      "automation evasion"
    ]
  },
  execution: {
    totalNavigations,
    researchCumulativeNavigations: priorResearchNavigations + totalNavigations,
    completedConditionCount: completed.length,
    stopped: stop !== null,
    stop,
    fatal
  },
  observations: completed.map((row) => ({
    condition: row.condition,
    asinJaccard: row.asinJaccard,
    taskTokenDelta: row.taskTokenDelta,
    moduleDelta: row.moduleDelta,
    baselineAsinCount: row.baseline.asinCount,
    postAsinCount: row.post.asinCount,
    cleanup: row.cleanup
  })),
  claims: {
    permitted: [
      "A bounded signed-out Amazon session displayed the recorded visible surfaces under the specified condition.",
      "Differences are interface observations and can motivate a controlled lifecycle test."
    ],
    notEstablished: [
      "Amazon changed an internal user profile.",
      "The task caused long-term or account-level personalization.",
      "Observed modules are personalized rather than contextual, item-to-item, advertised, or A/B tested."
    ]
  }
};

await writeFile(
  resolve(artifactDir, "detailed-results.json"),
  `${JSON.stringify(rows, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolve(publicDir, "field-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8"
);
process.stdout.write(`${JSON.stringify(summary)}\n`);
