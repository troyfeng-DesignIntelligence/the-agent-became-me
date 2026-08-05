import { describe, expect, it } from "vitest";
import {
  assertFailureLifecycleInvariants,
  FAILURE_LIFECYCLE_CONDITIONS,
  replayFailureLifecycle
} from "../src/webarena/failure-lifecycle";
import type { PilotTask } from "../src/webarena/task-pilot";

function failureTask(outcome: PilotTask["outcome"] = "Failure"): PilotTask {
  return {
    taskId: 1,
    templateId: 1,
    taskClass: "product-discovery",
    intent: "Browse furniture",
    auditedStepCount: 5,
    mappedEvidenceEventCount: 3,
    outcome,
    events: [
      {
        action: "view",
        intent: "explore",
        targetKey: "10:furniture",
        ocrAvailable: true,
        ocrCorroborated: true
      },
      {
        action: "view",
        intent: "explore",
        targetKey: "10:furniture",
        ocrAvailable: true,
        ocrCorroborated: true
      },
      {
        action: "shortlist",
        intent: "consider",
        targetKey: "20:add to cart",
        ocrAvailable: true,
        ocrCorroborated: true
      }
    ]
  };
}

describe("failure lifecycle contracts", () => {
  it("separates pre-persistence quarantine from post-write rollback", () => {
    const task = failureTask();
    const baseline = replayFailureLifecycle(task, "persist-all");
    const quarantine = replayFailureLifecycle(task, "outcome-quarantine");
    const rollback = replayFailureLifecycle(task, "rollback-on-failure");
    expect(quarantine.finalPersistentMass).toBe(0);
    expect(rollback.finalPersistentMass).toBe(0);
    expect(quarantine.provisionalProfileMass).toBe(0);
    expect(rollback.provisionalProfileMass).toBe(
      baseline.finalPersistentMass
    );
    expect(rollback.rollbackMass).toBe(baseline.finalPersistentMass);
  });

  it("deduplicates the same node and normalized target", () => {
    const task = failureTask();
    const baseline = replayFailureLifecycle(task, "persist-all");
    const deduplicated = replayFailureLifecycle(
      task,
      "deduplicate-target"
    );
    expect(baseline.repeatedTargetEventCount).toBe(1);
    expect(deduplicated.finalPersistentMass).toBeLessThan(
      baseline.finalPersistentMass
    );
  });

  it("preserves successful mass under outcome gating and rollback", () => {
    const task = failureTask("Success");
    const rows = FAILURE_LIFECYCLE_CONDITIONS.map((condition) =>
      replayFailureLifecycle(task, condition)
    );
    const baseline = rows.find((row) => row.condition === "persist-all")!;
    expect(
      rows.find((row) => row.condition === "outcome-quarantine")!
        .finalPersistentMass
    ).toBe(baseline.finalPersistentMass);
    expect(
      rows.find((row) => row.condition === "rollback-on-failure")!
        .finalPersistentMass
    ).toBe(baseline.finalPersistentMass);
    expect(() => assertFailureLifecycleInvariants(rows, 1)).not.toThrow();
  });
});
