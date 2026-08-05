export const AMAZON_LIFECYCLE_CONDITIONS = [
  "persist-all",
  "deduplicate-target",
  "intent-weighted",
  "outcome-quarantine",
  "rollback-on-failure",
  "scope-gated"
] as const;

export type AmazonLifecycleCondition =
  (typeof AMAZON_LIFECYCLE_CONDITIONS)[number];

export type AmazonFieldAction =
  | "search"
  | "product-view"
  | "add-to-cart"
  | "purchase";

export interface AmazonFieldEvent {
  action: AmazonFieldAction;
  targetKey: string;
  intent: "explore" | "consider" | "commit";
}

export interface AmazonFieldTrace {
  traceId: string;
  outcome: "abandoned" | "completed";
  events: AmazonFieldEvent[];
}

export interface AmazonLifecycleRow {
  traceId: string;
  condition: AmazonLifecycleCondition;
  outcome: AmazonFieldTrace["outcome"];
  eventCount: number;
  baseEvidenceMass: number;
  provisionalProfileMass: number;
  stagedEvidenceMass: number;
  finalPersistentMass: number;
  rollbackMass: number;
  failedResidualMass: number;
}

export const AMAZON_ACTION_WEIGHTS: Record<AmazonFieldAction, number> = {
  search: 0.08,
  "product-view": 0.18,
  "add-to-cart": 0.55,
  purchase: 1
};

const intentWeights = {
  explore: 0.22,
  consider: 0.55,
  commit: 1
} as const;

const round = (value: number) => Number(value.toFixed(6));

function sum(events: AmazonFieldEvent[], weight: (event: AmazonFieldEvent) => number) {
  return events.reduce((total, event) => total + weight(event), 0);
}

function unique(events: AmazonFieldEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.targetKey)) return false;
    seen.add(event.targetKey);
    return true;
  });
}

export function replayAmazonLifecycle(
  trace: AmazonFieldTrace,
  condition: AmazonLifecycleCondition
): AmazonLifecycleRow {
  const base = sum(trace.events, (event) => AMAZON_ACTION_WEIGHTS[event.action]);
  const deduplicated = sum(
    unique(trace.events),
    (event) => AMAZON_ACTION_WEIGHTS[event.action]
  );
  const intentWeighted = sum(
    trace.events,
    (event) =>
      AMAZON_ACTION_WEIGHTS[event.action] * intentWeights[event.intent]
  );
  const commitOnly = sum(trace.events, (event) =>
    event.action === "purchase" && event.intent === "commit" ? 1 : 0
  );
  const succeeded = trace.outcome === "completed";

  let provisional = 0;
  let staged = 0;
  let final = 0;
  let rollback = 0;

  if (condition === "persist-all") provisional = final = base;
  if (condition === "deduplicate-target") provisional = final = deduplicated;
  if (condition === "intent-weighted") provisional = final = intentWeighted;
  if (condition === "outcome-quarantine") {
    staged = base;
    final = succeeded ? base : 0;
  }
  if (condition === "rollback-on-failure") {
    provisional = base;
    final = succeeded ? base : 0;
    rollback = succeeded ? 0 : base;
  }
  if (condition === "scope-gated") provisional = final = commitOnly;

  return {
    traceId: trace.traceId,
    condition,
    outcome: trace.outcome,
    eventCount: trace.events.length,
    baseEvidenceMass: round(base),
    provisionalProfileMass: round(provisional),
    stagedEvidenceMass: round(staged),
    finalPersistentMass: round(final),
    rollbackMass: round(rollback),
    failedResidualMass: round(succeeded ? 0 : final)
  };
}

export function assertAmazonLifecycle(rows: AmazonLifecycleRow[], traceCount: number) {
  for (const condition of AMAZON_LIFECYCLE_CONDITIONS) {
    if (rows.filter((row) => row.condition === condition).length !== traceCount) {
      throw new Error(`Incomplete Amazon lifecycle condition: ${condition}`);
    }
  }
  const traceIds = [...new Set(rows.map((row) => row.traceId))];
  for (const traceId of traceIds) {
    const group = rows.filter((row) => row.traceId === traceId);
    const baseline = group.find((row) => row.condition === "persist-all")!;
    const quarantine = group.find(
      (row) => row.condition === "outcome-quarantine"
    )!;
    const rollback = group.find(
      (row) => row.condition === "rollback-on-failure"
    )!;
    if (quarantine.finalPersistentMass !== rollback.finalPersistentMass) {
      throw new Error(`Quarantine/rollback final mismatch: ${traceId}`);
    }
    if (quarantine.provisionalProfileMass !== 0) {
      throw new Error(`Quarantine exposed provisional mass: ${traceId}`);
    }
    if (
      baseline.outcome === "abandoned" &&
      rollback.rollbackMass !== baseline.finalPersistentMass
    ) {
      throw new Error(`Rollback incomplete: ${traceId}`);
    }
  }
}
