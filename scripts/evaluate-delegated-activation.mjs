import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));
const summary = await readJson(
  "public/results/delegated-activation/v1/summary.json"
);
const rows = await readJson(
  "public/results/delegated-activation/v1/rows.json"
);
const trajectories = await readJson(
  "public/results/delegated-activation/v1/trajectories.json"
);
const manifest = await readJson(
  "public/evidence/delegated-activation/v1/manifest.json"
);

const categorySlugs = [
  "luxury-beauty",
  "software",
  "industrial-and-scientific",
  "prime-pantry"
];
const requiredActions = [
  "search",
  "product-view",
  "request-task-recommendations",
  "compare"
];
const terminalActions = new Set(["select", "abandon"]);
const outcomeCounts = trajectories.trajectories.reduce(
  (counts, trajectory) => {
    counts[trajectory.agent.outcome] =
      (counts[trajectory.agent.outcome] ?? 0) + 1;
    return counts;
  },
  {}
);
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const evidenceValid = await Promise.all(
  Object.entries(manifest.files).map(async ([name, expected]) => {
    const path = resolve(
      root,
      "public/evidence/delegated-activation/v1",
      name
    );
    const bytes = await readFile(path);
    const metadata = await stat(path);
    return (
      metadata.size === expected.bytes &&
      createHash("sha256").update(bytes).digest("hex") === expected.sha256
    );
  })
);
const summaryHash = createHash("sha256")
  .update(
    await readFile(
      resolve(root, "public/results/delegated-activation/v1/summary.json")
    )
  )
  .digest("hex");

const components = {
  schemas: Boolean(
    summary.schemaVersion === "delegated-activation-timing.v1" &&
      rows.schemaVersion === "delegated-activation-paired-rows.v1" &&
      trajectories.schemaVersion ===
        "delegated-shopping-agent-trajectories.v1" &&
      manifest.schemaVersion ===
        "delegated-activation-evidence-manifest.v1"
  ),
  coverage: Boolean(
    summary.design.taskCount === 320 &&
      trajectories.trajectories.length === 320 &&
      rows.rows.length === 960 &&
      summary.categories.length === 4 &&
      categorySlugs.every((slug) =>
        summary.categories.some(
          (category) => category.slug === slug && category.taskCount === 80
        )
      )
  ),
  autonomousTraceCompleteness: trajectories.trajectories.every(
    (trajectory) => {
      const actions = trajectory.agent.actions.map((action) => action.action);
      return (
        requiredActions.every((action) => actions.includes(action)) &&
        terminalActions.has(actions.at(-1)) &&
        trajectory.agent.stepCount === trajectory.agent.actions.length &&
        trajectory.agent.taskLocalViewCount > 0
      );
    }
  ),
  outcomeVariation: Boolean(
    (outcomeCounts.selected ?? 0) >= 100 &&
      (outcomeCounts.abandoned ?? 0) >= 100
  ),
  agentDecisionGate: summary.categories.every(
    (category) =>
      category.feasibleDecisionAccuracy >= 0.9 &&
      category.infeasibleDecisionAccuracy >= 0.9 &&
      category.taskLocalRecommendationUseRate === 1
  ),
  temporalEffect: Boolean(
    summary.observedComparisons
      .positiveInProgressIntervalCategoryCount === 4 &&
      summary.pooledUncertainty.provisionalExposureAuc.lower95 > 0 &&
      summary.pooledUncertainty.inProgressDisplacementAt10.lower95 > 0 &&
      summary.pooledUncertainty.inProgressExcessTargetSlotsAt10.lower95 > 0
  ),
  finalStateIdentity: Boolean(
    summary.observedComparisons.allResolvedFinalStatesMatched &&
      summary.observedComparisons.allNextTaskStatesMatched &&
      rows.rows.every(
        (row) =>
          row.taskStartDisplacementAt10 === 0 &&
          row.outcomeResolvedDisplacementAt10 === 0 &&
          row.nextTaskDisplacementAt10 === 0
      )
  ),
  taskUtilityPreserved: Boolean(
    summary.observedComparisons.taskUtilityIdenticalAcrossLifecycleArms &&
      summary.observedComparisons.allAgentsConsumedTaskLocalRecommendations &&
      rows.rows.every(
        (row) => row.stagedMinusImmediateTaskUtility === 0
      ) &&
      mean(
        summary.categories.map((category) => category.meanSelectedUtility)
      ) >=
        mean(
          summary.categories.map(
            (category) => category.noLocalMeanSelectedUtility
          )
        )
  ),
  representativeSnapshots: Boolean(
    summary.representativeCases.length === 2 &&
      ["selected", "abandoned"].every((outcome) =>
        summary.representativeCases.some(
          (entry) =>
            entry.outcome === outcome &&
            summary.design.lifecycleConditions.every((lifecycle) =>
              summary.design.timepoints.every(
                (timepoint) =>
                  entry.publicSlates[lifecycle][timepoint].length === 5
              )
            )
        )
      )
  ),
  privacyAndEvidence: Boolean(
    rows.privacy.originalUserIdsIncluded === false &&
      rows.privacy.originalItemIdsIncluded === false &&
      rows.privacy.productTitlesIncluded === false &&
      trajectories.privacy.reviewTextIncluded === false &&
      manifest.sourceSummarySha256 === summaryHash &&
      Object.keys(manifest.files).length === 2 &&
      evidenceValid.every(Boolean)
  ),
  calibratedClaims: Boolean(
    summary.claims.observed.length >= 4 &&
      summary.claims.notEstablished.length >= 5 &&
      summary.claims.notEstablished.some((claim) =>
        claim.includes("deterministic")
      ) &&
      summary.claims.notEstablished.some((claim) =>
        claim.includes("not Amazon.com")
      )
  )
};
const weights = {
  schemas: 0.05,
  coverage: 0.1,
  autonomousTraceCompleteness: 0.12,
  outcomeVariation: 0.08,
  agentDecisionGate: 0.08,
  temporalEffect: 0.15,
  finalStateIdentity: 0.15,
  taskUtilityPreserved: 0.1,
  representativeSnapshots: 0.07,
  privacyAndEvidence: 0.07,
  calibratedClaims: 0.03
};
const score = Number(
  Object.entries(components)
    .reduce(
      (total, [key, passed]) => total + (passed ? weights[key] : 0),
      0
    )
    .toFixed(3)
);
const pass =
  score >= 0.9 &&
  components.autonomousTraceCompleteness &&
  components.temporalEffect &&
  components.finalStateIdentity &&
  components.taskUtilityPreserved &&
  components.privacyAndEvidence;

process.stdout.write(
  `${JSON.stringify({ pass, score, outcomeCounts, components })}\n`
);
if (!pass) process.exitCode = 1;

