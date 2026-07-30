import type {
  BehaviorTrace,
  Product,
  ProfileVector,
  RunMetrics,
  Scenario,
  UpdateReceipt
} from "../domain/schema";
import { recommendForProfile } from "../recommender/rank";
import { dot, normalizedDistance } from "../sim/vector";

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function evaluateRun(
  products: Product[],
  scenario: Scenario,
  trace: BehaviorTrace,
  finalProfile: ProfileVector,
  receipts: UpdateReceipt[],
  interactionCost = 0
): RunMetrics {
  const profileContamination = normalizedDistance(
    finalProfile,
    scenario.principalReference
  );
  const optimal = recommendForProfile(
    products,
    scenario.principalReference,
    6
  );
  const predicted = recommendForProfile(products, finalProfile, 6);
  const optimalUtility = mean(
    optimal.map((product) => dot(scenario.principalReference, product.attributes))
  );
  const predictedUtility = mean(
    predicted.map((product) =>
      dot(scenario.principalReference, product.attributes)
    )
  );
  const purchasedIds = new Set(
    trace.events
      .filter((event) => event.action === "purchase")
      .map((event) => event.productId)
  );
  const purchased = products.filter((product) => purchasedIds.has(product.id));
  const taskUtility = mean(
    purchased.map((product) => dot(scenario.taskVector, product.attributes))
  );
  const eventPairs = trace.events.map((event) => {
    const receipt = receipts.find((candidate) => candidate.eventId === event.id);
    return { event, receipt };
  });
  const actorRecordingErrors = eventPairs.filter(
    ({ event, receipt }) => !receipt || receipt.recordedActor !== event.actor
  ).length;
  const intentLabelErrors = eventPairs.filter(
    ({ event, receipt }) =>
      !receipt || receipt.recordedIntent !== event.actualIntent
  ).length;
  const attributionErrors = eventPairs.filter(
    ({ event, receipt }) =>
      !receipt ||
      receipt.recordedActor !== event.actor ||
      receipt.recordedIntent !== event.actualIntent
  ).length;
  const provenanceUses = eventPairs.filter(
    ({ receipt }) => receipt?.updaterUsedProvenance
  ).length;
  const persistentUpdates = eventPairs.filter(
    ({ receipt }) => receipt && receipt.effectiveWeight > 0
  ).length;
  const eventCount = Math.max(1, trace.events.length);
  const constraintViolations = purchased.filter((product) =>
    scenario.forbiddenAllergens.some((allergen) =>
      product.allergens.includes(allergen)
    )
  ).length;

  return {
    profileContamination: Number(profileContamination.toFixed(6)),
    futureRecommendationRegret: Number(
      Math.max(0, optimalUtility - predictedUtility).toFixed(6)
    ),
    taskUtility: Number(taskUtility.toFixed(6)),
    attributionErrorRate: Number(
      (attributionErrors / eventCount).toFixed(6)
    ),
    actorRecordingErrorRate: Number(
      (actorRecordingErrors / eventCount).toFixed(6)
    ),
    intentLabelErrorRate: Number(
      (intentLabelErrors / eventCount).toFixed(6)
    ),
    provenanceUseRate: Number((provenanceUses / eventCount).toFixed(6)),
    persistentUpdateRate: Number(
      (persistentUpdates / eventCount).toFixed(6)
    ),
    interactionCost,
    constraintViolations
  };
}
