import {
  type BehaviorTrace,
  type Product,
  type ProfileVector,
  type RunMetrics,
  type Scenario,
  type StudyACondition,
  type StudyBCondition,
  type UpdateReceipt
} from "../domain/schema";
import { updateProfile } from "../recommender/profile-updater";
import { evaluateRun } from "./metrics";

export interface ProfileHistoryPoint {
  step: number;
  profile: ProfileVector;
}

export interface ReplayResult {
  finalProfile: ProfileVector;
  profileHistory: ProfileHistoryPoint[];
  receipts: UpdateReceipt[];
  metrics: RunMetrics;
}

interface ReplayOptions {
  studyACondition?: StudyACondition;
  studyBCondition?: StudyBCondition;
  learningRate?: number;
}

export function replayTrace(
  products: Product[],
  scenario: Scenario,
  trace: BehaviorTrace,
  options: ReplayOptions
): ReplayResult {
  const productById = new Map(products.map((product) => [product.id, product]));
  let profile = scenario.principalReference;
  const profileHistory: ProfileHistoryPoint[] = [
    { step: -1, profile: scenario.principalReference }
  ];
  const receipts: UpdateReceipt[] = [];

  for (const event of trace.events) {
    const product = productById.get(event.productId);
    if (!product) {
      throw new Error(`Unknown product in trace: ${event.productId}`);
    }
    const receipt = updateProfile(profile, event, product, scenario, {
      learningRate: options.learningRate ?? 0.22,
      studyACondition: options.studyACondition,
      studyBCondition: options.studyBCondition
    });
    receipts.push(receipt);
    profile = receipt.profileAfter;
    profileHistory.push({ step: event.step, profile });
  }

  const interactionCost =
    options.studyBCondition === "impact-preview"
      ? 3
      : options.studyBCondition === "preview-and-repair"
        ? 8
        : 0;

  return {
    finalProfile: profile,
    profileHistory,
    receipts,
    metrics: evaluateRun(
      products,
      scenario,
      trace,
      profile,
      receipts,
      interactionCost
    )
  };
}
