import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CROSS_TASK_SCENARIOS,
  simulateCrossTaskExposure
} from "../src/amazon/cross-task-exposure";
import type { AmazonLifecycleCondition } from "../src/amazon/field-lifecycle";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(
  root,
  "public/results/cross-task-sensitivity/v1"
);
const profileWeights = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
const decayRates = [0, 0.15, 0.35, 0.6, 0.85] as const;
const taskSimilarities = [0, 0.25, 0.5, 0.75, 1] as const;
const conditions = [
  "persist-all",
  "intent-weighted"
] as const satisfies readonly AmazonLifecycleCondition[];
const seedsPerScenario = 20;
const round = (value: number) => Number(value.toFixed(6));

const rows = conditions.flatMap((condition) =>
  profileWeights.flatMap((profileWeight) =>
    decayRates.flatMap((decayRate) =>
      taskSimilarities.flatMap((taskSimilarity) =>
        CROSS_TASK_SCENARIOS.flatMap((scenario) =>
          Array.from({ length: seedsPerScenario }, (_, index) => index + 1).map(
            (seed) => {
              const run = simulateCrossTaskExposure(
                scenario,
                condition,
                seed,
                "abandoned",
                { profileWeight, decayRate, taskSimilarity }
              );
              return {
                condition,
                profileWeight,
                decayRate,
                taskSimilarity,
                scenarioId: scenario.id,
                seed,
                postTaskExcessExposureCount:
                  run.postTaskExcessExposureCount,
                postTaskExcessExposureRounds:
                  run.postTaskExcessExposureRounds,
                currentTaskRecommendationShare:
                  run.currentTaskRecommendationShare,
                finalTemporaryProfileMass: run.finalTemporaryProfileMass
              };
            }
          )
        )
      )
    )
  )
);

const cells = conditions.flatMap((condition) =>
  profileWeights.flatMap((profileWeight) =>
    decayRates.flatMap((decayRate) =>
      taskSimilarities.map((taskSimilarity) => {
        const members = rows.filter(
          (row) =>
            row.condition === condition &&
            row.profileWeight === profileWeight &&
            row.decayRate === decayRate &&
            row.taskSimilarity === taskSimilarity
        );
        const mean = (
          key:
            | "postTaskExcessExposureCount"
            | "postTaskExcessExposureRounds"
            | "currentTaskRecommendationShare"
            | "finalTemporaryProfileMass"
        ) =>
          round(
            members.reduce((total, row) => total + row[key], 0) /
              members.length
          );
        return {
          condition,
          profileWeight,
          decayRate,
          taskSimilarity,
          runCount: members.length,
          meanPostTaskExcessExposureCount: mean(
            "postTaskExcessExposureCount"
          ),
          meanPostTaskExcessExposureRounds: mean(
            "postTaskExcessExposureRounds"
          ),
          pollutionRunRate: round(
            members.filter((row) => row.postTaskExcessExposureCount > 0)
              .length / members.length
          ),
          meanCurrentTaskRecommendationShare: mean(
            "currentTaskRecommendationShare"
          ),
          meanFinalTemporaryProfileMass: mean("finalTemporaryProfileMass")
        };
      })
    )
  )
);

const aggregate = (
  predicate: (cell: (typeof cells)[number]) => boolean,
  key: keyof Pick<
    (typeof cells)[number],
    | "meanPostTaskExcessExposureCount"
    | "pollutionRunRate"
    | "meanCurrentTaskRecommendationShare"
  >
) => {
  const members = cells.filter(predicate);
  return round(
    members.reduce((total, cell) => total + Number(cell[key]), 0) /
      members.length
  );
};

const positiveCells = cells.filter(
  (cell) => cell.meanPostTaskExcessExposureCount > 0
);
const peakCell = [...cells].sort(
  (left, right) =>
    right.meanPostTaskExcessExposureCount -
    left.meanPostTaskExcessExposureCount
)[0];
const summary = {
  schemaVersion: "cross-task-pollution-sensitivity.v1",
  evidenceStatus: "controlled-synthetic-sensitivity-experiment",
  generatedAt: new Date().toISOString(),
  design: {
    scenarioCount: CROSS_TASK_SCENARIOS.length,
    seedsPerScenario,
    conditions,
    profileWeights,
    decayRates,
    taskSimilarities,
    followUpRoundCount: 8,
    recommendationSlotsPerRound: 6,
    cellCount: cells.length,
    runsPerCell: CROSS_TASK_SCENARIOS.length * seedsPerScenario,
    runCount: rows.length,
    pollutionDefinition:
      "Temporary-topic slots above a paired no-temporary-profile counterfactual at identical task similarity."
  },
  cells,
  observedComparisons: {
    zeroPollutionCellShare: round(
      cells.filter((cell) => cell.meanPostTaskExcessExposureCount === 0)
        .length / cells.length
    ),
    positivePollutionCellShare: round(positiveCells.length / cells.length),
    peakCell,
    highVsLowProfileWeightDifference: round(
      aggregate(
        (cell) => cell.profileWeight === 0.8,
        "meanPostTaskExcessExposureCount"
      ) -
        aggregate(
          (cell) => cell.profileWeight === 0.2,
          "meanPostTaskExcessExposureCount"
        )
    ),
    noVsFastDecayDifference: round(
      aggregate(
        (cell) => cell.decayRate === 0,
        "meanPostTaskExcessExposureCount"
      ) -
        aggregate(
          (cell) => cell.decayRate === 0.85,
          "meanPostTaskExcessExposureCount"
        )
    ),
    persistVsIntentDifference: round(
      aggregate(
        (cell) => cell.condition === "persist-all",
        "meanPostTaskExcessExposureCount"
      ) -
        aggregate(
          (cell) => cell.condition === "intent-weighted",
          "meanPostTaskExcessExposureCount"
        )
    )
  },
  claims: {
    observed: [
      "Cross-task pollution occupied bounded regions of the frozen ranking parameter grid rather than appearing uniformly.",
      "Faster decay and intent weighting changed the pollution boundary relative to unrestricted persistence.",
      "Paired no-temporary-profile counterfactuals separated task-similar content from profile-driven excess exposure."
    ],
    notEstablished: [
      "The phase boundary estimates Amazon.com or another commercial recommender.",
      "The hand-authored weights, decay rates, or similarities are behaviorally calibrated.",
      "Recommendation exposure is equivalent to human attention, preference change, or harm."
    ]
  }
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDirectory, "rows.json"),
  `${JSON.stringify(
    { schemaVersion: "cross-task-pollution-sensitivity-rows.v1", rows },
    null,
    2
  )}\n`,
  "utf8"
);
process.stdout.write(`Wrote ${rows.length} sensitivity runs in ${cells.length} cells\n`);
