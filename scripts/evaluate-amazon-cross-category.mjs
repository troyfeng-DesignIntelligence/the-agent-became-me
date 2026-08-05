import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, "public/results/amazon-cross-category/v1");
const summary = JSON.parse(await readFile(resolve(directory, "summary.json"), "utf8"));
const payload = JSON.parse(await readFile(resolve(directory, "rows.json"), "utf8"));
const categories = summary.categories;
const taskRows = payload.taskRows;
const validationRows = payload.validationRows;
const publicText = JSON.stringify(payload);

const components = {
  fourDistinctCategories: Boolean(
    categories.length === 4 && new Set(categories.map((row) => row.slug)).size === 4
  ),
  sourceIntegrity: Boolean(categories.every((category) => {
    const files = Object.values(category.dataset.files);
    return files.length === 2 && files.every((file) =>
      typeof file.sha256 === "string" && file.sha256.length === 64 && file.bytes > 1_000_000
    );
  })),
  sharedProtocol: Boolean(
    summary.design.split === "per-user leave-two-out" &&
    summary.design.modelSeeds.length === 3 &&
    summary.design.similarityBands.length === 3 &&
    summary.design.lifecycles.length === 3 &&
    summary.design.evaluationCandidates.includes("99 fixed unseen negatives")
  ),
  twelveLearnedModels: Boolean(categories.every((category) =>
    category.trainingRuns.length === 3 && category.trainingRuns.every((run) =>
      [7, 17, 29].includes(run.seed) &&
      (run.checkpointReused === true ||
        (run.epochsCompleted >= 3 && run.finalTrainingLoss < run.initialTrainingLoss))
    )
  )),
  nextItemValidity: Boolean(categories.every((category) =>
    category.performanceUncertainty.ndcgGainVsPopularity.estimate > 0 &&
    category.performanceUncertainty.sasrecHitRateAt10.estimate > 0.1
  )),
  orderSensitivity: Boolean(categories.every((category) =>
    category.performanceUncertainty.orderChangedTop10Rate.estimate >= 0.5
  )),
  completePairedDesign: Boolean(categories.every((category) => {
    const rows = taskRows.filter((row) => row.category === category.slug);
    return category.taskUserCount >= 300 &&
      rows.length === category.taskUserCount * 3 * 3 * 3 &&
      new Set(rows.map((row) => row.similarityBand)).size === 3 &&
      new Set(rows.map((row) => row.lifecycle)).size === 3;
  })),
  hierarchicalBootstrap: Boolean(
    summary.inference.unit === "user history" &&
    summary.inference.replicates === 2000 &&
    summary.inference.seed === 20260805 &&
    summary.inference.method.includes("model seeds and users resampled") &&
    summary.inference.method.includes("within-user similarity bands retained")
  ),
  categoryReplication: Boolean(
    summary.observedComparisons.positivePersistIntervalCategoryCount >= 3
  ),
  equalCategoryPooled: Boolean(
    summary.inference.fixedSetEqualCategoryPooledPersistExcess.lower95 > 0
  ),
  leaveOneOutRobustness: Boolean(
    summary.inference.leaveOneCategoryOut.length === 4 &&
    summary.inference.leaveOneCategoryOut.every((row) => row.lower95 > 0)
  ),
  outcomeAttenuation: Boolean(
    summary.observedComparisons.attenuatedPointEstimateCategoryCount >= 3
  ),
  quarantineInvariant: Boolean(
    summary.observedComparisons.allQuarantineInvariant === true &&
    categories.every((category) =>
      category.quarantineMaxAbsoluteExcess === 0 &&
      category.quarantineMaxDisplacement === 0
    )
  ),
  privacyBoundary: Boolean(
    payload.privacy.originalUserIdsIncluded === false &&
    payload.privacy.originalItemIdsIncluded === false &&
    taskRows.every((row) => /^[a-f0-9]{16}$/.test(row.userCaseId) && /^[a-f0-9]{16}$/.test(row.caseId)) &&
    validationRows.every((row) => /^[a-f0-9]{16}$/.test(row.userCaseId)) &&
    !publicText.includes("reviewerID") && !publicText.includes("asin")
  ),
  calibratedClaims: Boolean(
    summary.claims.observed.length >= 4 &&
    summary.claims.notEstablished.length >= 5 &&
    summary.inference.betweenCategoryDescriptive.randomEffectsMetaAnalysisOmitted.includes("too few")
  )
};

const weights = {
  fourDistinctCategories: 0.06,
  sourceIntegrity: 0.06,
  sharedProtocol: 0.06,
  twelveLearnedModels: 0.10,
  nextItemValidity: 0.08,
  orderSensitivity: 0.05,
  completePairedDesign: 0.08,
  hierarchicalBootstrap: 0.12,
  categoryReplication: 0.12,
  equalCategoryPooled: 0.07,
  leaveOneOutRobustness: 0.06,
  outcomeAttenuation: 0.04,
  quarantineInvariant: 0.05,
  privacyBoundary: 0.03,
  calibratedClaims: 0.02
};
const score = Number(Object.entries(components).reduce(
  (total, [key, passed]) => total + (passed ? weights[key] : 0), 0
).toFixed(3));
const mustPass = [
  "fourDistinctCategories", "sourceIntegrity", "sharedProtocol",
  "twelveLearnedModels", "completePairedDesign", "hierarchicalBootstrap",
  "quarantineInvariant", "privacyBoundary"
];
const pass = score >= 0.9 && mustPass.every((key) => components[key]);
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
