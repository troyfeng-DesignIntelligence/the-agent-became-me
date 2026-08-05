import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summary = JSON.parse(await readFile(resolve(root, "public/results/external-validity/v1/summary.json"), "utf8"));
const rows = JSON.parse(await readFile(resolve(root, "public/results/external-validity/v1/rows.json"), "utf8")).rows;
const personalized = summary.design.algorithms.filter((algorithm) => algorithm !== "global-popularity");
const cells = summary.algorithmLifecycle;
const cell = (algorithm, lifecycle) => cells.find((row) => row.algorithm === algorithm && row.lifecycle === lifecycle);
const components = {
  realHistoryScale: summary.dataset.eligibleUserCount >= 200 && summary.dataset.ratingCount === 100000,
  sourceIntegrity: Boolean(
    summary.dataset.files["u.data"].sha256 === "06416e597f82b7342361e41163890c81036900f418ad91315590814211dca490" &&
    summary.dataset.files["u.item"].sha256 === "553841ebc7de3a0fd0d6b62a204ea30c1e651aacfb2814c7a6584ac52f2c5701"
  ),
  completeFactorial: Boolean(
    summary.design.algorithmCount === 4 &&
    summary.design.personalizedAlgorithmCount === 3 &&
    summary.design.lifecycles.length === 3 &&
    summary.design.similarityBands.length === 3 &&
    rows.length === summary.dataset.eligibleUserCount * 3 * 4 * 3
  ),
  algorithmBreadth: summary.observedComparisons.positivePersistAlgorithmCount >= 2,
  attenuationGradient: personalized.filter((algorithm) =>
    cell(algorithm, "persist-all").meanExcessTargetSlotsAt10 > cell(algorithm, "intent-weighted").meanExcessTargetSlotsAt10
  ).length >= 2,
  quarantineInvariant: summary.observedComparisons.quarantineMaxExcess === 0 && summary.observedComparisons.quarantineMaxDisplacement === 0,
  popularityInvariant: summary.observedComparisons.popularityMaxDisplacement === 0,
  dataDerivedSimilarity: summary.design.similarityDefinition.includes("observed-history genre centroid") &&
    new Set(rows.map((row) => row.measuredTaskSimilarity)).size > 20,
  pairedCandidateClaim: summary.design.pairedDefinition.includes("candidate set") && summary.design.pairedDefinition.includes("only activation weight"),
  calibratedClaims: summary.claims.observed.length >= 3 && summary.claims.notEstablished.length >= 3
};
const weights = {
  realHistoryScale: 0.12,
  sourceIntegrity: 0.08,
  completeFactorial: 0.12,
  algorithmBreadth: 0.16,
  attenuationGradient: 0.12,
  quarantineInvariant: 0.12,
  popularityInvariant: 0.08,
  dataDerivedSimilarity: 0.08,
  pairedCandidateClaim: 0.07,
  calibratedClaims: 0.05
};
const score = Number(Object.entries(components).reduce((total, [key, passed]) => total + (passed ? weights[key] : 0), 0).toFixed(3));
const pass = score >= 0.9 && components.realHistoryScale && components.completeFactorial && components.algorithmBreadth && components.quarantineInvariant && components.popularityInvariant;
process.stdout.write(`${JSON.stringify({ pass, score, components })}\n`);
