import {
  STUDY_A_CONDITIONS,
  type Action,
  type Intent,
  type StudyACondition
} from "../domain/schema";
import {
  ACTION_WEIGHTS,
  INTENT_WEIGHTS
} from "../recommender/profile-updater";

export const WEB_ARENA_TASK_CLASSES = [
  "purchase",
  "preference-staging",
  "product-discovery",
  "review-research",
  "account-or-order-operation",
  "communication"
] as const;

export type WebArenaTaskClass = (typeof WEB_ARENA_TASK_CLASSES)[number];

export interface WebArenaTaskDefinition {
  task_id: number;
  sites: string[];
  intent: string;
  intent_template_id: number;
}

export interface PilotEvent {
  action: Action;
  intent: Intent;
  evidenceKind?:
    | "product"
    | "category"
    | "review"
    | "shortlist"
    | "purchase";
  primaryEligible?: boolean;
  targetId?: string;
  targetLabel?: string;
  targetKey?: string;
  imageId?: string;
  ocrAvailable?: boolean;
  ocrCorroborated?: boolean;
  ocrTokenRecall?: number;
}

export interface PilotTask {
  taskId: number;
  templateId: number;
  taskClass: WebArenaTaskClass;
  intent: string;
  events: PilotEvent[];
  auditedStepCount: number;
  mappedEvidenceEventCount: number;
  outcome: "Success" | "Failure" | "Unknown";
}

export interface PilotRow {
  taskId: number;
  templateId: number;
  taskClass: WebArenaTaskClass;
  condition: StudyACondition;
  eventCount: number;
  baseEvidenceMass: number;
  persistentEvidenceMass: number;
  nonCommitPersistentMass: number;
  persistentEventRate: number;
  actorRecordingErrorRate: number;
  provenanceUseRate: number;
  auditedStepCount: number;
  mappedEvidenceEventCount: number;
  outcome: "Success" | "Failure" | "Unknown";
}

export interface ReleasedAgentTrajectory {
  uid: string;
  intent: string;
  steps: Array<{ img?: string; other?: { raw_action?: string } }>;
}

const purchasePattern =
  /^\s*(?:buy|purchase|reorder)\b|\bcan you reorder\b/i;
const stagingPattern = /\b(cart|wish\s?list|wishlist)\b/i;
const communicationPattern =
  /contact us|draft (?:an )?(?:email|message)|subscribe|post them|rate my/i;
const accountPattern =
  /\b(order|purchase|refund|address|delivery|shipping|spent|spend|customer service|update my information)\b/i;
const reviewPattern =
  /\b(review|reviews|reviewer|reviewers|criticisms|rating|stars?)\b|customers say/i;

export function classifyWebArenaTask(intent: string): WebArenaTaskClass {
  if (purchasePattern.test(intent)) return "purchase";
  if (stagingPattern.test(intent)) return "preference-staging";
  if (communicationPattern.test(intent)) return "communication";
  if (accountPattern.test(intent)) return "account-or-order-operation";
  if (reviewPattern.test(intent)) return "review-research";
  return "product-discovery";
}

const eventTemplates: Record<WebArenaTaskClass, PilotEvent[]> = {
  purchase: [
    { action: "view", intent: "explore" },
    { action: "compare", intent: "consider" },
    { action: "purchase", intent: "commit" }
  ],
  "preference-staging": [
    { action: "view", intent: "explore" },
    { action: "shortlist", intent: "consider" }
  ],
  "product-discovery": [
    { action: "view", intent: "explore" },
    { action: "compare", intent: "consider" }
  ],
  "review-research": [
    { action: "view", intent: "explore" },
    { action: "compare", intent: "explore" }
  ],
  "account-or-order-operation": [{ action: "view", intent: "explore" }],
  communication: [{ action: "view", intent: "explore" }]
};

export function adaptWebArenaTask(task: WebArenaTaskDefinition): PilotTask {
  const taskClass = classifyWebArenaTask(task.intent);
  return {
    taskId: task.task_id,
    templateId: task.intent_template_id,
    taskClass,
    intent: task.intent,
    events: eventTemplates[taskClass].map((event) => ({ ...event })),
    auditedStepCount: eventTemplates[taskClass].length,
    mappedEvidenceEventCount: eventTemplates[taskClass].length,
    outcome: "Unknown"
  };
}

const purchaseActionPattern =
  /\b(place order|submit order|complete order|reorder|buy now|purchase now)\b/i;
const shortlistActionPattern = /\b(add to cart|add to wish\s?list)\b/i;
const reviewActionPattern = /\b(reviews?|ratings?|stars?)\b/i;
const genericControlPattern =
  /^(?:my account|my orders|my product reviews|view order|home|sign in|sign out|customer service|contact us|search|next|previous|back|cart|wish\s?list|sort|filter|catalog|menu|account)$/i;
const navigationControlPattern =
  /^(?:page\s+(?:next|previous|\d+)|set\s+(?:ascending|descending)\s+direction|sort\s+by|show\s+per\s+page|next\s+page|previous\s+page)$/i;
const categoryTargetPattern = /\(\s*\d+\s+items?\s*\)\s*$/i;
const evidenceEligibleClasses = new Set<WebArenaTaskClass>([
  "purchase",
  "preference-staging",
  "product-discovery",
  "review-research"
]);

function clickedLabel(rawAction: string): string | null {
  if (!/^\s*click\b/i.test(rawAction)) return null;
  const matches = [...rawAction.matchAll(/'([^']*)'/g)];
  return matches.at(-1)?.[1]?.replace(/\\xa0/g, " ").trim() ?? null;
}

function clickedTargetId(rawAction: string): string | null {
  return /^\s*click\s+\[(\d+)\]/i.exec(rawAction)?.[1] ?? null;
}

export function normalizeEvidenceTarget(label: string): string {
  return label
    .replace(/\\xa0/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(\s*\d+\s+items?\s*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function corroborateTargetWithOcr(label: string, ocr: string | null) {
  if (!ocr) {
    return { available: false, corroborated: false, tokenRecall: 0 };
  }
  const normalizedLabel = normalizeEvidenceTarget(label);
  const normalizedOcr = normalizeEvidenceTarget(ocr);
  const tokens = normalizedLabel
    .split(" ")
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
  const matched = tokens.filter((token) => normalizedOcr.includes(token));
  const tokenRecall = tokens.length === 0 ? 0 : matched.length / tokens.length;
  const corroborated =
    normalizedLabel.length >= 3 &&
    (normalizedOcr.includes(normalizedLabel) ||
      (tokens.length <= 2 ? tokenRecall === 1 : tokenRecall >= 0.6));
  return {
    available: true,
    corroborated,
    tokenRecall: Number(tokenRecall.toFixed(6))
  };
}

export function mapReleasedAction(
  rawAction: string,
  taskClass: WebArenaTaskClass
): PilotEvent | null {
  if (!/^\s*click\b/i.test(rawAction)) return null;
  const label = clickedLabel(rawAction);
  if (!label) return null;
  const targetId = clickedTargetId(rawAction) ?? "unknown";
  const targetKey = `${targetId}:${normalizeEvidenceTarget(label)}`;
  const controlLabel = label
    .replace(/\\u[eE][0-9a-fA-F]{3}/g, " ")
    .replace(/[\uE000-\uF8FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (purchaseActionPattern.test(label)) {
    return {
      action: "purchase",
      intent: "commit",
      evidenceKind: "purchase",
      primaryEligible: true,
      targetId,
      targetLabel: label,
      targetKey
    };
  }
  if (shortlistActionPattern.test(label)) {
    return {
      action: "shortlist",
      intent: "consider",
      evidenceKind: "shortlist",
      primaryEligible: true,
      targetId,
      targetLabel: label,
      targetKey
    };
  }
  if (
    genericControlPattern.test(controlLabel) ||
    navigationControlPattern.test(controlLabel) ||
    /^(?:page\s+\d+|\d+)$/i.test(controlLabel)
  ) {
    return null;
  }
  if (reviewActionPattern.test(label)) {
    return {
      action: "compare",
      intent: "explore",
      evidenceKind: "review",
      primaryEligible: true,
      targetId,
      targetLabel: label,
      targetKey
    };
  }
  if (
    evidenceEligibleClasses.has(taskClass) &&
    /\]\s+link\s+'/i.test(rawAction) &&
    controlLabel.length >= 4
  ) {
    const isCategory = categoryTargetPattern.test(controlLabel);
    return {
      action: "view",
      intent: "explore",
      evidenceKind: isCategory ? "category" : "product",
      primaryEligible: !isCategory,
      targetId,
      targetLabel: label,
      targetKey
    };
  }
  return null;
}

export function adaptReleasedWebArenaTrajectory(
  task: WebArenaTaskDefinition,
  trajectory: ReleasedAgentTrajectory,
  outcome: PilotTask["outcome"],
  ocrByImage: Record<string, string> = {}
): PilotTask {
  const taskClass = classifyWebArenaTask(task.intent);
  const rawActions = trajectory.steps.map(
    (step) => step.other?.raw_action ?? ""
  );
  const mappedEvents = rawActions.flatMap((action, index): PilotEvent[] => {
      const event = mapReleasedAction(action, taskClass);
      if (!event) return [];
      const imageId = trajectory.steps[index]?.img?.replace(/\.png$/i, "");
      const check = corroborateTargetWithOcr(
        event.targetLabel ?? "",
        imageId ? (ocrByImage[imageId] ?? null) : null
      );
      return [{
        ...event,
        imageId,
        ocrAvailable: check.available,
        ocrCorroborated: check.corroborated,
        ocrTokenRecall: check.tokenRecall
      }];
    });
  const events = mappedEvents.filter((event) => event.primaryEligible !== false);
  return {
    taskId: task.task_id,
    templateId: task.intent_template_id,
    taskClass,
    intent: task.intent,
    events,
    auditedStepCount: rawActions.length,
    mappedEvidenceEventCount: events.length,
    outcome
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function eventWeight(
  condition: StudyACondition,
  event: PilotEvent,
  attenuation: number
): number {
  const base = ACTION_WEIGHTS[event.action];
  if (condition === "actor-blind" || condition === "logged-only") return base;
  if (condition === "matched-attenuation") return base * attenuation;
  if (condition === "provenance-aware") {
    return base * INTENT_WEIGHTS[event.intent];
  }
  if (condition === "scope-gated") {
    return event.action === "purchase" && event.intent === "commit"
      ? base * INTENT_WEIGHTS.commit
      : 0;
  }
  return 0;
}

export function replayPilotTask(
  task: PilotTask,
  condition: StudyACondition
): PilotRow {
  const baseMass = task.events.reduce(
    (sum, event) => sum + ACTION_WEIGHTS[event.action],
    0
  );
  const provenanceMass = task.events.reduce(
    (sum, event) =>
      sum + ACTION_WEIGHTS[event.action] * INTENT_WEIGHTS[event.intent],
    0
  );
  const attenuation = baseMass === 0 ? 0 : provenanceMass / baseMass;
  const weights = task.events.map((event) =>
    eventWeight(condition, event, attenuation)
  );
  const persistentMass = weights.reduce((sum, value) => sum + value, 0);
  const nonCommitMass = weights.reduce(
    (sum, value, index) =>
      sum + (task.events[index].intent === "commit" ? 0 : value),
    0
  );
  const positiveEvents = weights.filter((weight) => weight > 0).length;

  return {
    taskId: task.taskId,
    templateId: task.templateId,
    taskClass: task.taskClass,
    condition,
    eventCount: task.events.length,
    baseEvidenceMass: round(baseMass),
    persistentEvidenceMass: round(persistentMass),
    nonCommitPersistentMass: round(nonCommitMass),
    persistentEventRate: round(
      task.events.length === 0 ? 0 : positiveEvents / task.events.length
    ),
    actorRecordingErrorRate: condition === "actor-blind" ? 1 : 0,
    provenanceUseRate:
      condition === "provenance-aware" || condition === "scope-gated" ? 1 : 0,
    auditedStepCount: task.auditedStepCount,
    mappedEvidenceEventCount: task.mappedEvidenceEventCount,
    outcome: task.outcome
  };
}

export function runWebArenaTaskPilot(tasks: WebArenaTaskDefinition[]) {
  const shopping = tasks
    .filter((task) => task.sites.includes("shopping"))
    .sort((left, right) => left.task_id - right.task_id)
    .map(adaptWebArenaTask);

  const rows = shopping.flatMap((task) =>
    STUDY_A_CONDITIONS.map((condition) => replayPilotTask(task, condition))
  );

  return { shopping, rows };
}

export function assertPilotInvariants(rows: PilotRow[], taskCount: number) {
  for (const condition of STUDY_A_CONDITIONS) {
    if (rows.filter((row) => row.condition === condition).length !== taskCount) {
      throw new Error(`Incomplete condition: ${condition}`);
    }
  }
  for (const row of rows) {
    if (row.persistentEvidenceMass < 0) {
      throw new Error(`Negative mass for task ${row.taskId}`);
    }
  }
}
