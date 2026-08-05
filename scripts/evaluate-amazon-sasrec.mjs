import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resultDirectory = resolve(root, "public/results/amazon-sasrec/v1");
const summary = JSON.parse(await readFile(resolve(resultDirectory, "summary.json"), "utf8"));
const rowPayload = JSON.parse(await readFile(resolve(resultDirectory, "rows.json"), "utf8"));
const rows = rowPayload.rows;
const runs = summary.model.trainingRuns;
const lifecycle = summary.taskBoundary.lifecycle;
const cell = (name) => lifecycle.find((row) => row.lifecycle === name);
const publicText = JSON.stringify(rowPayload);

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const components = {
  realCommerceScale: Boolean(
    summary.dataset.source === "Amazon Reviews 2018 / Luxury Beauty 5-core" &&
    summary.dataset.reviewCount >= 30000 &&
    summary.dataset.userCount >= 3000 &&
    summary.dataset.itemCount >= 1500 &&
    summary.dataset.minimumSequenceLength >= 5
  ),
  sourceIntegrity: Boolean(
    summary.dataset.files["Luxury_Beauty_5.json.gz"]?.sha256?.length === 64 &&
    summary.dataset.files["meta_Luxury_Beauty.json.gz"]?.sha256?.length === 64 &&
    summary.dataset.files["Luxury_Beauty_5.json.gz"].bytes > 1000000
  ),
  chronologicalSplit: Boolean(
    summary.design.split === "per-user leave-two-out" &&
    summary.design.testLeakageCount === 0 &&
    summary.design.validationLeakageCount === 0
  ),
  standardLearnedModel: Boolean(
    summary.model.name === "SASRec" &&
    summary.model.causalMask === true &&
    summary.model.learnedPositionEmbeddings === true &&
    summary.model.trainingObjective.includes("sampled binary cross-entropy") &&
    runs.length === 3 &&
    runs.every((run) => run.finalTrainingLoss < run.initialTrainingLoss && run.epochsCompleted >= 3)
  ),
  nextItemValidity: Boolean(
    mean(runs.map((run) => run.test.sasrec.ndcgAt10)) >
      mean(runs.map((run) => run.test.popularity.ndcgAt10)) + 0.005 &&
    mean(runs.map((run) => run.test.sasrec.hitRateAt10)) > 0.1
  ),
  orderSensitivity: Boolean(
    mean(runs.map((run) => run.test.orderSensitivity.changedTop10Rate)) >= 0.5 &&
    mean(runs.map((run) => run.test.orderSensitivity.meanTop10Displacement)) >= 0.1
  ),
  completePairedDesign: Boolean(
    summary.taskBoundary.design.modelSeeds.length === 3 &&
    summary.taskBoundary.design.similarityBands.length === 3 &&
    summary.taskBoundary.design.lifecycles.length === 3 &&
    rows.length === summary.taskBoundary.design.caseCount * 3 * 3 &&
    new Set(rows.map((row) => row.similarityBand)).size === 3
  ),
  learnedSpillover: Boolean(
    summary.taskBoundary.observedComparisons.positivePersistSeedCount >= 2 &&
    cell("persist-all").meanExcessTargetSlotsAt10 > 0.02 &&
    cell("persist-all").spilloverRate > cell("outcome-quarantine").spilloverRate
  ),
  outcomeAttenuation: Boolean(
    cell("outcome-commit").meanExcessTargetSlotsAt10 >= 0 &&
    cell("outcome-commit").meanExcessTargetSlotsAt10 < cell("persist-all").meanExcessTargetSlotsAt10
  ),
  quarantineInvariant: Boolean(
    summary.taskBoundary.observedComparisons.quarantineMaxExcess === 0 &&
    summary.taskBoundary.observedComparisons.quarantineMaxDisplacement === 0
  ),
  pairedCandidates: Boolean(
    summary.taskBoundary.design.pairedDefinition.includes("same candidate mask") &&
    summary.taskBoundary.design.injectedItemsExcludedFromEveryArm === true
  ),
  privacyBoundary: Boolean(
    rows.every((row) => /^[a-f0-9]{16}$/.test(row.caseId)) &&
    !publicText.includes("reviewerID") && !publicText.includes("asin") &&
    rowPayload.privacy.originalUserIdsIncluded === false &&
    rowPayload.privacy.originalItemIdsIncluded === false
  ),
  calibratedClaims: Boolean(
    summary.claims.observed.length >= 3 && summary.claims.notEstablished.length >= 4
  )
};

const weights = {
  realCommerceScale: 0.09,
  sourceIntegrity: 0.06,
  chronologicalSplit: 0.07,
  standardLearnedModel: 0.13,
  nextItemValidity: 0.12,
  orderSensitivity: 0.07,
  completePairedDesign: 0.09,
  learnedSpillover: 0.11,
  outcomeAttenuation: 0.06,
  quarantineInvariant: 0.08,
  pairedCandidates: 0.05,
  privacyBoundary: 0.04,
  calibratedClaims: 0.03
};
const score = Number(Object.entries(components).reduce(
  (total, [key, passed]) => total + (passed ? weights[key] : 0), 0
).toFixed(3));
const mustPass = [
  "realCommerceScale", "chronologicalSplit", "standardLearnedModel",
  "nextItemValidity", "completePairedDesign", "quarantineInvariant",
  "pairedCandidates", "privacyBoundary"
];
const pass = score >= 0.9 && mustPass.every((key) => components[key]);
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);

