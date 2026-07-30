import {
  type BehaviorEvent,
  type Product,
  type ProfileVector,
  type Scenario,
  type StudyACondition,
  type StudyBCondition,
  type UpdateReceipt
} from "../domain/schema";
import { blend, roundVector, subtract } from "../sim/vector";

const actionWeights = {
  view: 0.18,
  compare: 0.32,
  shortlist: 0.56,
  purchase: 1
} as const;

const intentWeights = {
  explore: 0.06,
  consider: 0.28,
  commit: 0.82
} as const;

export interface UpdateOptions {
  learningRate: number;
  studyACondition?: StudyACondition;
  studyBCondition?: StudyBCondition;
}

function statusForWeight(
  effectiveWeight: number,
  baseWeight: number,
  confirmed: boolean,
  temporary: boolean
): UpdateReceipt["status"] {
  if (temporary) return "temporary";
  if (confirmed) return "confirmed";
  if (effectiveWeight === 0) return "excluded";
  if (effectiveWeight < baseWeight * 0.8) return "downweighted";
  return "counted";
}

export function updateProfile(
  current: ProfileVector,
  event: BehaviorEvent,
  product: Product,
  scenario: Scenario,
  options: UpdateOptions
): UpdateReceipt {
  const baseWeight = actionWeights[event.action];
  let effectiveWeight: number = baseWeight;
  let recordedActor: UpdateReceipt["recordedActor"] = "agent";
  let updaterUsedProvenance = true;
  let confirmed = false;
  let temporary = false;

  if (options.studyACondition === "actor-blind") {
    recordedActor = "principal";
    updaterUsedProvenance = false;
  } else if (options.studyACondition === "logged-only") {
    updaterUsedProvenance = false;
  } else if (options.studyACondition === "provenance-aware") {
    effectiveWeight *= intentWeights[event.observedIntent];
  } else if (options.studyACondition === "approval-gated") {
    confirmed =
      scenario.learningScope === "commit-only" &&
      event.action === "purchase" &&
      event.observedIntent === "commit";
    effectiveWeight = confirmed ? baseWeight * intentWeights.commit : 0;
  }

  if (options.studyBCondition) {
    effectiveWeight = baseWeight * intentWeights[event.observedIntent];
    if (
      options.studyBCondition === "preview-and-repair" &&
      event.observedIntent !== "commit"
    ) {
      temporary = true;
      effectiveWeight = 0;
    }
  }

  const profileBefore = roundVector(current);
  const rate = Math.min(0.95, options.learningRate * effectiveWeight);
  const profileAfter = roundVector(blend(profileBefore, product.attributes, rate));
  const delta = roundVector(subtract(profileAfter, profileBefore));

  return {
    eventId: event.id,
    step: event.step,
    productId: product.id,
    recordedActor,
    recordedIntent: event.observedIntent,
    updaterUsedProvenance,
    status: statusForWeight(
      effectiveWeight,
      baseWeight,
      confirmed,
      temporary
    ),
    effectiveWeight: Number(effectiveWeight.toFixed(6)),
    profileBefore,
    profileAfter,
    delta
  };
}
