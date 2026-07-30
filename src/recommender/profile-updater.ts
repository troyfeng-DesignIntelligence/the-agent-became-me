import {
  type BehaviorTrace,
  type BehaviorEvent,
  type Product,
  type ProfileVector,
  type Scenario,
  type StudyACondition,
  type StudyBCondition,
  type UpdateReceipt
} from "../domain/schema";
import { blend, roundVector, subtract } from "../sim/vector";

export const ACTION_WEIGHTS = {
  view: 0.18,
  compare: 0.32,
  shortlist: 0.56,
  purchase: 1
} as const;

export const INTENT_WEIGHTS = {
  explore: 0.06,
  consider: 0.28,
  commit: 0.82
} as const;

export interface UpdateOptions {
  learningRate: number;
  studyACondition?: StudyACondition;
  studyBCondition?: StudyBCondition;
  matchedAttenuationScale?: number;
}

function statusForWeight(
  effectiveWeight: number,
  baseWeight: number,
  confirmed: boolean,
  quarantined: boolean
): UpdateReceipt["status"] {
  if (quarantined) return "quarantined";
  if (confirmed) return "confirmed";
  if (effectiveWeight === 0) return "excluded";
  if (effectiveWeight < baseWeight * 0.8) return "downweighted";
  return "counted";
}

export function matchedAttenuationScale(trace: BehaviorTrace): number {
  const fullMass = trace.events.reduce(
    (total, event) => total + ACTION_WEIGHTS[event.action],
    0
  );
  if (fullMass === 0) return 0;
  const provenanceMass = trace.events.reduce(
    (total, event) =>
      total +
      ACTION_WEIGHTS[event.action] * INTENT_WEIGHTS[event.observedIntent],
    0
  );
  return provenanceMass / fullMass;
}

export function updateProfile(
  current: ProfileVector,
  event: BehaviorEvent,
  product: Product,
  scenario: Scenario,
  options: UpdateOptions
): UpdateReceipt {
  const baseWeight = ACTION_WEIGHTS[event.action];
  let effectiveWeight: number = baseWeight;
  let recordedActor: UpdateReceipt["recordedActor"] = "agent";
  let updaterUsedProvenance = true;
  let confirmed = false;
  let quarantined = false;

  if (options.studyACondition === "actor-blind") {
    recordedActor = "principal";
    updaterUsedProvenance = false;
  } else if (options.studyACondition === "logged-only") {
    updaterUsedProvenance = false;
  } else if (options.studyACondition === "matched-attenuation") {
    updaterUsedProvenance = false;
    effectiveWeight *= options.matchedAttenuationScale ?? 0;
  } else if (options.studyACondition === "provenance-aware") {
    effectiveWeight *= INTENT_WEIGHTS[event.observedIntent];
  } else if (options.studyACondition === "scope-gated") {
    confirmed =
      scenario.learningScope === "commit-only" &&
      event.action === "purchase" &&
      event.observedIntent === "commit";
    effectiveWeight = confirmed ? baseWeight * INTENT_WEIGHTS.commit : 0;
  } else if (options.studyACondition === "no-update") {
    updaterUsedProvenance = false;
    effectiveWeight = 0;
  }

  if (options.studyBCondition) {
    effectiveWeight = baseWeight * INTENT_WEIGHTS[event.observedIntent];
    if (
      options.studyBCondition === "impact-proxy-with-quarantine" &&
      event.observedIntent !== "commit"
    ) {
      quarantined = true;
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
      quarantined
    ),
    effectiveWeight: Number(effectiveWeight.toFixed(6)),
    profileBefore,
    profileAfter,
    delta
  };
}
