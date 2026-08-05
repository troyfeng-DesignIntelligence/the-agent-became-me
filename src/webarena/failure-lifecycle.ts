import type { PilotEvent, PilotTask } from "./task-pilot";
import {
  ACTION_WEIGHTS,
  INTENT_WEIGHTS
} from "../recommender/profile-updater";

export const FAILURE_LIFECYCLE_CONDITIONS = [
  "persist-all",
  "deduplicate-target",
  "intent-weighted",
  "outcome-quarantine",
  "rollback-on-failure",
  "scope-gated"
] as const;

export type FailureLifecycleCondition =
  (typeof FAILURE_LIFECYCLE_CONDITIONS)[number];

export interface FailureLifecycleRow {
  taskId: number;
  templateId: number;
  taskClass: PilotTask["taskClass"];
  outcome: PilotTask["outcome"];
  condition: FailureLifecycleCondition;
  auditedStepCount: number;
  mappedEventCount: number;
  ocrAvailableEventCount: number;
  ocrCorroboratedEventCount: number;
  repeatedTargetEventCount: number;
  repeatedTargetEventShare: number;
  baseEvidenceMass: number;
  repeatedTargetMass: number;
  stagedEvidenceMass: number;
  provisionalProfileMass: number;
  finalPersistentMass: number;
  rollbackMass: number;
  failedResidualMass: number;
}

const round = (value: number) => Number(value.toFixed(6));

function mass(events: PilotEvent[], weight: (event: PilotEvent) => number) {
  return events.reduce((sum, event) => sum + weight(event), 0);
}

function baseWeight(event: PilotEvent) {
  return ACTION_WEIGHTS[event.action];
}

function uniqueEvents(events: PilotEvent[]) {
  const seen = new Set<string>();
  const unique: PilotEvent[] = [];
  const repeated: PilotEvent[] = [];
  events.forEach((event, index) => {
    const key = event.targetKey ?? `unkeyed:${index}`;
    if (seen.has(key)) repeated.push(event);
    else {
      seen.add(key);
      unique.push(event);
    }
  });
  return { unique, repeated };
}

export function replayFailureLifecycle(
  task: PilotTask,
  condition: FailureLifecycleCondition
): FailureLifecycleRow {
  const { unique, repeated } = uniqueEvents(task.events);
  const baseEvidenceMass = mass(task.events, baseWeight);
  const deduplicatedMass = mass(unique, baseWeight);
  const intentMass = mass(
    task.events,
    (event) => baseWeight(event) * INTENT_WEIGHTS[event.intent]
  );
  const scopeMass = mass(task.events, (event) =>
    event.action === "purchase" && event.intent === "commit"
      ? baseWeight(event) * INTENT_WEIGHTS.commit
      : 0
  );
  const repeatedTargetMass = mass(repeated, baseWeight);
  const succeeded = task.outcome === "Success";

  let stagedEvidenceMass = 0;
  let provisionalProfileMass = 0;
  let finalPersistentMass = 0;
  let rollbackMass = 0;

  if (condition === "persist-all") {
    provisionalProfileMass = baseEvidenceMass;
    finalPersistentMass = baseEvidenceMass;
  } else if (condition === "deduplicate-target") {
    provisionalProfileMass = deduplicatedMass;
    finalPersistentMass = deduplicatedMass;
  } else if (condition === "intent-weighted") {
    provisionalProfileMass = intentMass;
    finalPersistentMass = intentMass;
  } else if (condition === "outcome-quarantine") {
    stagedEvidenceMass = baseEvidenceMass;
    finalPersistentMass = succeeded ? baseEvidenceMass : 0;
  } else if (condition === "rollback-on-failure") {
    provisionalProfileMass = baseEvidenceMass;
    finalPersistentMass = succeeded ? baseEvidenceMass : 0;
    rollbackMass = succeeded ? 0 : baseEvidenceMass;
  } else if (condition === "scope-gated") {
    provisionalProfileMass = scopeMass;
    finalPersistentMass = scopeMass;
  }

  return {
    taskId: task.taskId,
    templateId: task.templateId,
    taskClass: task.taskClass,
    outcome: task.outcome,
    condition,
    auditedStepCount: task.auditedStepCount,
    mappedEventCount: task.events.length,
    ocrAvailableEventCount: task.events.filter((event) => event.ocrAvailable)
      .length,
    ocrCorroboratedEventCount: task.events.filter(
      (event) => event.ocrCorroborated
    ).length,
    repeatedTargetEventCount: repeated.length,
    repeatedTargetEventShare: round(
      task.events.length === 0 ? 0 : repeated.length / task.events.length
    ),
    baseEvidenceMass: round(baseEvidenceMass),
    repeatedTargetMass: round(repeatedTargetMass),
    stagedEvidenceMass: round(stagedEvidenceMass),
    provisionalProfileMass: round(provisionalProfileMass),
    finalPersistentMass: round(finalPersistentMass),
    rollbackMass: round(rollbackMass),
    failedResidualMass: round(succeeded ? 0 : finalPersistentMass)
  };
}

export function assertFailureLifecycleInvariants(
  rows: FailureLifecycleRow[],
  taskCount: number
) {
  for (const condition of FAILURE_LIFECYCLE_CONDITIONS) {
    if (rows.filter((row) => row.condition === condition).length !== taskCount) {
      throw new Error(`Incomplete failure lifecycle condition: ${condition}`);
    }
  }
  const byTask = new Map<number, FailureLifecycleRow[]>();
  for (const row of rows) {
    const group = byTask.get(row.taskId) ?? [];
    group.push(row);
    byTask.set(row.taskId, group);
  }
  for (const [taskId, group] of byTask) {
    const baseline = group.find((row) => row.condition === "persist-all");
    const quarantine = group.find(
      (row) => row.condition === "outcome-quarantine"
    );
    const rollback = group.find(
      (row) => row.condition === "rollback-on-failure"
    );
    if (!baseline || !quarantine || !rollback) {
      throw new Error(`Missing invariant rows for task ${taskId}`);
    }
    if (quarantine.finalPersistentMass !== rollback.finalPersistentMass) {
      throw new Error(`Final quarantine/rollback mismatch for task ${taskId}`);
    }
    if (quarantine.provisionalProfileMass !== 0) {
      throw new Error(`Quarantine exposed provisional profile for task ${taskId}`);
    }
    if (
      baseline.outcome === "Failure" &&
      rollback.rollbackMass !== baseline.finalPersistentMass
    ) {
      throw new Error(`Incomplete rollback for failed task ${taskId}`);
    }
  }
}
