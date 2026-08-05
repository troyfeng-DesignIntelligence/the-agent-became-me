import { describe, expect, it } from "vitest";
import {
  CROSS_TASK_SCENARIOS,
  createExposureCatalog,
  generateCrossTaskRuns,
  simulateCrossTaskExposure
} from "../src/amazon/cross-task-exposure";

const scenario = CROSS_TASK_SCENARIOS[0];

describe("cross-task recommendation exposure", () => {
  it("is deterministic for the same paired seed", () => {
    expect(createExposureCatalog(7)).toEqual(createExposureCatalog(7));
    expect(simulateCrossTaskExposure(scenario, "persist-all", 7)).toEqual(
      simulateCrossTaskExposure(scenario, "persist-all", 7)
    );
  });

  it("separates rollback provisional exposure from quarantine", () => {
    const paired = Array.from({ length: 40 }, (_, index) => index + 1).map(
      (seed) => ({
        quarantine: simulateCrossTaskExposure(
          scenario,
          "outcome-quarantine",
          seed
        ),
        rollback: simulateCrossTaskExposure(
          scenario,
          "rollback-on-failure",
          seed
        )
      })
    );
    expect(
      paired.every(
        ({ quarantine }) => quarantine.provisionalExcessExposureCount === 0
      )
    ).toBe(true);
    expect(
      paired.reduce(
        (total, { rollback }) =>
          total + rollback.provisionalExcessExposureCount,
        0
      )
    ).toBeGreaterThan(0);
    expect(
      paired.every(
        ({ quarantine, rollback }) =>
          quarantine.postTaskExposureCount === 0 &&
          rollback.postTaskExposureCount === 0
      )
    ).toBe(true);
  });

  it("keeps the frozen factorial design complete", () => {
    const runs = generateCrossTaskRuns(40);
    expect(runs).toHaveLength(5 * 40 * 6);
    expect(new Set(runs.map((row) => row.scenarioId)).size).toBe(5);
  });

  it("retains completed quarantined evidence", () => {
    const abandoned = simulateCrossTaskExposure(
      scenario,
      "outcome-quarantine",
      11,
      "abandoned"
    );
    const completed = simulateCrossTaskExposure(
      scenario,
      "outcome-quarantine",
      11,
      "completed"
    );
    expect(abandoned.postTaskExposureCount).toBe(0);
    expect(completed.postTaskExposureCount).toBeGreaterThan(0);
  });

  it("does not count contextual similarity as profile pollution", () => {
    const run = simulateCrossTaskExposure(
      scenario,
      "outcome-quarantine",
      2,
      "abandoned",
      { profileWeight: 0.06, decayRate: 0, taskSimilarity: 1 }
    );
    expect(run.postTaskExposureCount).toBeGreaterThan(0);
    expect(run.postTaskExcessExposureCount).toBe(0);
  });

  it("reduces excess exposure when temporary evidence decays faster", () => {
    const noDecay = Array.from({ length: 20 }, (_, index) =>
      simulateCrossTaskExposure(
        scenario,
        "persist-all",
        index + 1,
        "abandoned",
        { profileWeight: 0.8, decayRate: 0, taskSimilarity: 0.5 }
      )
    );
    const fastDecay = Array.from({ length: 20 }, (_, index) =>
      simulateCrossTaskExposure(
        scenario,
        "persist-all",
        index + 1,
        "abandoned",
        { profileWeight: 0.8, decayRate: 0.85, taskSimilarity: 0.5 }
      )
    );
    expect(
      noDecay.reduce(
        (total, run) => total + run.postTaskExcessExposureCount,
        0
      )
    ).toBeGreaterThan(
      fastDecay.reduce(
        (total, run) => total + run.postTaskExcessExposureCount,
        0
      )
    );
  });
});
