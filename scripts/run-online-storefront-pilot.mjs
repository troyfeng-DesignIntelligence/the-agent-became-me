import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const root = process.cwd();
const siteUrl = process.env.SITE_URL ?? process.argv[2] ?? "http://127.0.0.1:4173/";
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const tasks = [
  ["cereal-selected", "selected"],
  ["snack-abandoned", "abandoned"],
  ["drink-selected", "selected"],
  ["bar-abandoned", "abandoned"],
  ["yogurt-selected", "selected"],
  ["cereal-abandoned", "abandoned"],
  ["snack-selected", "selected"],
  ["drink-abandoned", "abandoned"]
];
const arms = ["immediate", "held"];
const phases = ["task-start", "task-in-progress", "outcome-resolved", "next-task"];
const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const artifactDir = path.resolve(root, "artifacts/online-storefront-pilot", runId);
const resultDir = path.resolve(root, "public/results/online-storefront-pilot/v1");
const evidenceDir = path.resolve(root, "public/evidence/online-storefront-pilot/v1");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const publicId = (domain, value) =>
  `${domain}${sha256(`online-storefront-pilot.v1:${domain}:${value}`).slice(0, 10).toUpperCase()}`;

function experimentUrl(taskId, arm) {
  const url = new URL(siteUrl);
  url.searchParams.set("view", "storefront");
  url.searchParams.set("task", taskId);
  url.searchParams.set("arm", arm);
  return url.href;
}

async function capture(page, taskId, arm, expectedPhase) {
  await page.waitForFunction(
    (phase) => window.__STORE_RESEARCH__?.phase === phase,
    expectedPhase
  );
  const state = await page.evaluate(() => window.__STORE_RESEARCH__);
  if (!state) throw new Error("Research state was not exposed.");
  const platform = await page.locator('[data-testid="platform-recommendations"] [data-product-id]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute("data-product-id"))
  );
  const taskLocal = await page.locator('[data-testid="task-recommendations"] [data-product-id]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute("data-product-id"))
  );
  const screenshotPath = path.join(artifactDir, `${taskId}-${arm}-${expectedPhase}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return {
    taskId,
    arm,
    phase: expectedPhase,
    platform,
    taskLocal,
    viewedIds: state.viewedIds,
    stagedIds: state.stagedIds,
    eventLog: state.eventLog,
    screenshotPath,
    screenshotSha256: sha256(await readFile(screenshotPath))
  };
}

async function runArm(browser, taskId, outcome, arm) {
  const context = await browser.newContext({
    viewport: { width: 1360, height: 920 },
    locale: "en-US",
    timezoneId: "Asia/Shanghai",
    serviceWorkers: "block",
    acceptDownloads: false
  });
  const pages = [];
  const page = await context.newPage();
  page.on("popup", async (popup) => {
    pages.push(popup.url());
    await popup.close();
  });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  try {
    await page.goto(experimentUrl(taskId, arm), { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="platform-recommendations"]').waitFor();
    const snapshots = [await capture(page, taskId, arm, "task-start")];
    await page.locator('[data-action="search"]').click();
    await page.locator('[data-testid="search-results"]').waitFor();
    const viewButtons = page.locator('[data-action="view-product"]');
    for (let index = 0; index < 3; index += 1) {
      await viewButtons.nth(index).click();
    }
    snapshots.push(await capture(page, taskId, arm, "task-in-progress"));
    await page.locator(`[data-action="resolve-${outcome}"]`).click();
    snapshots.push(await capture(page, taskId, arm, "outcome-resolved"));
    await page.locator('[data-action="begin-next-task"]').click();
    snapshots.push(await capture(page, taskId, arm, "next-task"));
    return { taskId, arm, outcome, status: "completed", consoleErrors, popups: pages, snapshots };
  } finally {
    await context.close();
  }
}

function displacement(left, right) {
  const overlap = left.slice(0, 10).filter((id) => right.slice(0, 10).includes(id)).length;
  return Number((1 - overlap / 10).toFixed(6));
}

await mkdir(artifactDir, { recursive: true });
await mkdir(resultDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch(
  browserChannel === "bundled" ? { headless: true } : { channel: browserChannel, headless: true }
);
let privateRuns;
try {
  privateRuns = [];
  for (const [taskId, outcome] of tasks) {
    for (const arm of arms) {
      privateRuns.push(await runArm(browser, taskId, outcome, arm));
    }
  }
} finally {
  await browser.close();
}

const publicRuns = privateRuns.map((run) => ({
  taskId: publicId("T", run.taskId),
  taskLabel: run.taskId,
  arm: run.arm,
  outcome: run.outcome,
  status: run.status,
  consoleErrorCount: run.consoleErrors.length,
  popupCount: run.popups.length,
  trace: run.snapshots.at(-1).eventLog.map((event) => ({
    ...event,
    productId: event.productId ? publicId("P", event.productId) : null
  })),
  snapshots: run.snapshots.map((snapshot) => ({
    phase: snapshot.phase,
    platform: snapshot.platform.map((id) => publicId("P", id)),
    taskLocal: snapshot.taskLocal.map((id) => publicId("P", id)),
    viewedIds: snapshot.viewedIds.map((id) => publicId("P", id)),
    heldEvidenceCount: snapshot.stagedIds.length,
    screenshotSha256: snapshot.screenshotSha256
  }))
}));

const rows = [];
const behaviorTrace = (run) =>
  run.trace.map(({ sequence, action, productId }) => ({ sequence, action, productId }));
for (const [taskId, outcome] of tasks) {
  const immediate = publicRuns.find((run) => run.taskLabel === taskId && run.arm === "immediate");
  const held = publicRuns.find((run) => run.taskLabel === taskId && run.arm === "held");
  for (const phase of phases) {
    const left = immediate.snapshots.find((snapshot) => snapshot.phase === phase);
    const right = held.snapshots.find((snapshot) => snapshot.phase === phase);
    rows.push({
      taskId: immediate.taskId,
      taskLabel: taskId,
      outcome,
      phase,
      platformDisplacementAt10: displacement(left.platform, right.platform),
      taskLocalDisplacementAt10: displacement(left.taskLocal, right.taskLocal),
      traceMatched:
        JSON.stringify(behaviorTrace(immediate)) ===
        JSON.stringify(behaviorTrace(held))
    });
  }
}

const phaseMetrics = phases.map((phase) => {
  const phaseRows = rows.filter((row) => row.phase === phase);
  return {
    phase,
    meanPlatformDisplacementAt10: Number((phaseRows.reduce((sum, row) => sum + row.platformDisplacementAt10, 0) / phaseRows.length).toFixed(6)),
    maxTaskLocalDisplacementAt10: Math.max(...phaseRows.map((row) => row.taskLocalDisplacementAt10)),
    matchedTraceCount: phaseRows.filter((row) => row.traceMatched).length
  };
});

const representative = [
  ["cereal-selected", "selected"],
  ["snack-abandoned", "abandoned"]
];
const evidenceFiles = [];
for (const [taskId, label] of representative) {
  for (const arm of arms) {
    for (const phase of phases) {
      const run = privateRuns.find((candidate) => candidate.taskId === taskId && candidate.arm === arm);
      const snapshot = run.snapshots.find((candidate) => candidate.phase === phase);
      const name = `${label}-${arm}-${phase}.png`;
      const target = path.join(evidenceDir, name);
      await copyFile(snapshot.screenshotPath, target);
      const bytes = await readFile(target);
      evidenceFiles.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
}

const summary = {
  schemaVersion: "online-storefront-pilot.v1",
  generatedAt: new Date().toISOString(),
  sourceUrl: siteUrl,
  evidenceStatus: "browser-agent experiment on a research-owned storefront",
  design: {
    taskCount: tasks.length,
    armCount: arms.length,
    snapshotCount: publicRuns.length * phases.length,
    arms,
    phases,
    agent: "deterministic browser shopping agent",
    productSource: "frozen Open Food Facts snapshot",
    prohibitedCapabilities: ["account", "cart", "checkout", "payment", "external product navigation"]
  },
  phaseMetrics,
  observedComparisons: {
    allFixedTracesMatched: rows.every((row) => row.traceMatched),
    allTaskLocalRecommendationsMatched: rows.every((row) => row.taskLocalDisplacementAt10 === 0),
    allStartStatesMatched: rows.filter((row) => row.phase === "task-start").every((row) => row.platformDisplacementAt10 === 0),
    allResolvedStatesMatched: rows.filter((row) => row.phase === "outcome-resolved").every((row) => row.platformDisplacementAt10 === 0),
    allNextTaskStatesMatched: rows.filter((row) => row.phase === "next-task").every((row) => row.platformDisplacementAt10 === 0),
    inProgressChangedTaskCount: rows.filter((row) => row.phase === "task-in-progress" && row.platformDisplacementAt10 > 0).length,
    consoleErrorCount: publicRuns.reduce((sum, run) => sum + run.consoleErrorCount, 0),
    popupCount: publicRuns.reduce((sum, run) => sum + run.popupCount, 0)
  },
  claims: {
    observed: [
      "The browser agent completed search, product-view, outcome-resolution, and next-task actions on the deployed research storefront.",
      "Both activation arms used identical fixed traces and identical task-local recommendations.",
      "The research-owned platform state differed only while delegated evidence was pending and was matched after resolution."
    ],
    notEstablished: [
      "No third-party commerce platform or production recommender was manipulated.",
      "No purchase, account, human preference, trust, welfare, or real shopping utility was measured.",
      "The agent is deterministic and the product catalog is a frozen open-data snapshot."
    ]
  }
};

const manifest = {
  schemaVersion: "online-storefront-evidence.v1",
  generatedAt: summary.generatedAt,
  sourceUrl: siteUrl,
  files: evidenceFiles
};

await writeFile(path.join(artifactDir, "private-runs.json"), `${JSON.stringify(privateRuns, null, 2)}\n`);
await writeFile(path.join(resultDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(resultDir, "rows.json"), `${JSON.stringify({ schemaVersion: "online-storefront-rows.v1", rows }, null, 2)}\n`);
await writeFile(path.join(resultDir, "traces.json"), `${JSON.stringify({ schemaVersion: "online-storefront-traces.v1", runs: publicRuns }, null, 2)}\n`);
await writeFile(path.join(evidenceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ runId, artifactDir, summary })}\n`);
