import {
  BehaviorTraceSchema,
  INTENTS,
  type Action,
  type BehaviorEvent,
  type BehaviorTrace,
  type Intent,
  type Policy,
  type Product,
  type Scenario,
  type StudyBCondition
} from "../domain/schema";
import { rankProducts, type RankedProduct } from "../recommender/rank";
import { NamedRandomStream } from "./rng";

export interface TraceOptions {
  labelNoise?: number;
  interfaceCondition?: StudyBCondition | null;
}

function noisyIntent(
  actual: Intent,
  noiseRate: number,
  nextRandom: () => number
): Intent {
  if (nextRandom() >= noiseRate) return actual;
  const alternatives = INTENTS.filter((intent) => intent !== actual);
  return alternatives[Math.floor(nextRandom() * alternatives.length)];
}

function reasonCodes(
  ranked: RankedProduct,
  action: Action,
  policy: Policy
): string[] {
  const reasons = [
    action === "view" ? "candidate_inspection" : "task_match",
    ranked.product.popularity > 0.65 ? "popular_choice" : "long_tail_candidate"
  ];
  if (ranked.profileImpact > 0.45) reasons.push("profile_impact_high");
  if (policy === "exploratory") reasons.push("uncertainty_reduction");
  if (policy === "recommendation-following") {
    reasons.push("followed_platform_ranking");
  }
  return reasons;
}

function selectExploratoryProducts(ranked: RankedProduct[]): RankedProduct[] {
  const chosen: RankedProduct[] = [];
  const seenCategories = new Set<string>();
  for (const candidate of ranked) {
    if (!seenCategories.has(candidate.product.category)) {
      chosen.push(candidate);
      seenCategories.add(candidate.product.category);
    }
    if (chosen.length === 5) break;
  }
  for (const candidate of ranked) {
    if (!chosen.some((item) => item.product.id === candidate.product.id)) {
      chosen.push(candidate);
    }
    if (chosen.length === 8) break;
  }
  return chosen;
}

export function generateBehaviorTrace(
  products: Product[],
  scenario: Scenario,
  policy: Policy,
  seed: number,
  options: TraceOptions = {}
): BehaviorTrace {
  const root = new NamedRandomStream(seed, `${scenario.id}:${policy}`);
  const ranked = rankProducts(
    products,
    scenario,
    policy,
    root.fork("ranking"),
    options.interfaceCondition ?? null
  );
  const viewed =
    policy === "exploratory"
      ? selectExploratoryProducts(ranked)
      : ranked.slice(0, 8);
  const compared = [...viewed]
    .sort(
      (left, right) =>
        right.taskScore - left.taskScore ||
        left.product.id.localeCompare(right.product.id)
    )
    .slice(0, 4);
  const shortlisted = compared.slice(0, 3);
  const purchased = shortlisted.slice(0, 2);

  const eventPlan: Array<{
    action: Action;
    item: RankedProduct;
    actualIntent: Intent;
  }> = [
    ...viewed.map((item, index) => ({
      action: "view" as const,
      item,
      actualIntent: (index < 5 ? "explore" : "consider") as Intent
    })),
    ...compared.map((item) => ({
      action: "compare" as const,
      item,
      actualIntent: "consider" as const
    })),
    ...shortlisted.map((item) => ({
      action: "shortlist" as const,
      item,
      actualIntent: "consider" as const
    })),
    ...purchased.map((item) => ({
      action: "purchase" as const,
      item,
      actualIntent: "commit" as const
    }))
  ];

  const labelRng = root.fork("intent-label-noise");
  const events: BehaviorEvent[] = eventPlan.map((planned, step) => ({
    id: `${scenario.id}:${policy}:${seed}:${String(step).padStart(2, "0")}`,
    step,
    actor: "agent",
    action: planned.action,
    productId: planned.item.product.id,
    actualIntent: planned.actualIntent,
    observedIntent: noisyIntent(
      planned.actualIntent,
      options.labelNoise ?? 0,
      () => labelRng.next()
    ),
    confidence: Number(
      Math.max(0.42, Math.min(0.98, planned.item.score)).toFixed(4)
    ),
    reasonCodes: reasonCodes(planned.item, planned.action, policy)
  }));

  return BehaviorTraceSchema.parse({
    schemaVersion: "trace.v1",
    protocolVersion: "protocol.v1",
    scenarioId: scenario.id,
    seed,
    policy,
    events
  });
}
