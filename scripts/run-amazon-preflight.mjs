import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(root, "artifacts/amazon-field-probe");
const resultPath = resolve(
  root,
  "experiments/amazon-field-probe/preflight-result.json"
);
const targetUrl = "https://www.amazon.com/";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  locale: "en-US",
  viewport: { width: 1440, height: 1000 }
});
const page = await context.newPage();

let responseStatus = null;
let failure = null;
let bodyText = "";
try {
  const response = await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  responseStatus = response?.status() ?? null;
  await page.waitForTimeout(1500);
  bodyText = await page.locator("body").innerText({ timeout: 5000 });
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
}

await mkdir(artifactDir, { recursive: true });
await page.screenshot({
  path: resolve(artifactDir, "preflight.png"),
  fullPage: false
});

const normalized = bodyText.toLowerCase();
const guardSignals = {
  captcha: /captcha|enter the characters you see|type the characters/.test(
    normalized
  ),
  robotCheck: /not a robot|automated access|api-services-support@amazon/.test(
    normalized
  ),
  signInRequired: /sign in to continue|authentication required/.test(
    normalized
  ),
  throttled: responseStatus === 429 || responseStatus === 503
};
const blocked =
  failure !== null ||
  responseStatus === null ||
  responseStatus >= 400 ||
  Object.values(guardSignals).some(Boolean);
const result = {
  schemaVersion: "amazon-field-preflight.v1",
  target: "amazon.com signed-out homepage",
  attemptedAt: new Date().toISOString(),
  browser: "Microsoft Edge via Playwright; default automation signals retained",
  navigationCount: 1,
  responseStatus,
  finalOrigin: new URL(page.url()).origin,
  pageTitle: await page.title(),
  bodyTextSha256: createHash("sha256").update(bodyText).digest("hex"),
  screenshotSha256: createHash("sha256")
    .update(await page.screenshot({ fullPage: false }))
    .digest("hex"),
  guardSignals,
  blocked,
  fieldProbeDecision: blocked ? "pivot-no-evasion" : "go-bounded-probe",
  failure
};

await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await context.close();
await browser.close();
process.stdout.write(`${JSON.stringify(result)}\n`);
