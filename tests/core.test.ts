import {
  ProductSchema,
  UpdateReceiptSchema,
  type Product,
  type ProfileVector
} from "../src/domain/schema";
import { replayTrace } from "../src/experiments/replay";
import {
  ACTION_WEIGHTS,
  INTENT_WEIGHTS,
  matchedAttenuationScale
} from "../src/recommender/profile-updater";
import { SCENARIOS } from "../src/sim/scenarios";
import { NamedRandomStream } from "../src/sim/rng";
import { generateBehaviorTrace } from "../src/sim/trace";

function product(
  id: string,
  attributes: ProfileVector,
  popularity: number,
  allergens: string[] = []
): Product {
  return ProductSchema.parse({
    id,
    sourceCode: id,
    name: `Product ${id}`,
    category: id.includes("sweet") ? "snacks" : "breakfast-cereals",
    sourceCategoryTags: [],
    attributes,
    popularity,
    allergens,
    labels: [],
    evidence: {
      nutriScore: null,
      ecoScore: null,
      novaGroup: null,
      uniqueScans: Math.round(popularity * 1000)
    },
    sourceUrl: `https://example.com/${id}`
  });
}

const products: Product[] = [
  product(
    "oats",
    {
      nutrition: 0.96,
      sustainability: 0.82,
      plantBased: 0.86,
      lowProcessing: 0.94,
      indulgence: 0.08
    },
    0.7
  ),
  product(
    "soy",
    {
      nutrition: 0.76,
      sustainability: 0.82,
      plantBased: 1,
      lowProcessing: 0.64,
      indulgence: 0.18
    },
    0.58
  ),
  product(
    "sweet-1",
    {
      nutrition: 0.12,
      sustainability: 0.24,
      plantBased: 0.28,
      lowProcessing: 0.08,
      indulgence: 0.98
    },
    0.98
  ),
  product(
    "sweet-2",
    {
      nutrition: 0.18,
      sustainability: 0.28,
      plantBased: 0.34,
      lowProcessing: 0.12,
      indulgence: 0.94
    },
    0.94
  ),
  product(
    "sweet-3",
    {
      nutrition: 0.22,
      sustainability: 0.3,
      plantBased: 0.42,
      lowProcessing: 0.16,
      indulgence: 0.9
    },
    0.9
  ),
  product(
    "bar-1",
    {
      nutrition: 0.48,
      sustainability: 0.4,
      plantBased: 0.38,
      lowProcessing: 0.24,
      indulgence: 0.78
    },
    0.86
  ),
  product(
    "bar-2",
    {
      nutrition: 0.52,
      sustainability: 0.46,
      plantBased: 0.48,
      lowProcessing: 0.3,
      indulgence: 0.74
    },
    0.82
  ),
  product(
    "granola",
    {
      nutrition: 0.62,
      sustainability: 0.58,
      plantBased: 0.7,
      lowProcessing: 0.48,
      indulgence: 0.62
    },
    0.78
  ),
  product(
    "fruit",
    {
      nutrition: 0.9,
      sustainability: 0.68,
      plantBased: 1,
      lowProcessing: 1,
      indulgence: 0.24
    },
    0.68
  ),
  product(
    "peanut-sweet",
    {
      nutrition: 0.18,
      sustainability: 0.28,
      plantBased: 0.72,
      lowProcessing: 0.12,
      indulgence: 0.96
    },
    1,
    ["en:peanuts"]
  )
];

describe("deterministic simulation core", () => {
  it("produces stable named streams without cross-stream consumption", () => {
    const first = new NamedRandomStream(42, "root");
    const policyA = first.fork("policy");
    const labelsA = first.fork("labels");
    const policyValuesA = [policyA.next(), policyA.next(), policyA.next()];
    labelsA.next();
    labelsA.next();

    const second = new NamedRandomStream(42, "root");
    const policyB = second.fork("policy");
    const policyValuesB = [policyB.next(), policyB.next(), policyB.next()];

    expect(policyValuesA).toEqual(policyValuesB);
  });

  it("returns an identical trace for an identical configuration", () => {
    const scenario = SCENARIOS[0];
    const first = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      17,
      { labelNoise: 0.1 }
    );
    const second = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      17,
      { labelNoise: 0.1 }
    );

    expect(first).toEqual(second);
  });

  it("never purchases a product that violates a hard allergen constraint", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(products, scenario, "goal-bound", 4);
    const purchasedIds = trace.events
      .filter((event) => event.action === "purchase")
      .map((event) => event.productId);

    expect(purchasedIds).not.toContain("peanut-sweet");
  });

  it("keeps actor-blind and logged-only profiles identical", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      9,
      { labelNoise: 0.1 }
    );
    const actorBlind = replayTrace(products, scenario, trace, {
      studyACondition: "actor-blind"
    });
    const loggedOnly = replayTrace(products, scenario, trace, {
      studyACondition: "logged-only"
    });

    expect(actorBlind.finalProfile).toEqual(loggedOnly.finalProfile);
    expect(actorBlind.metrics.profileContamination).toBe(
      loggedOnly.metrics.profileContamination
    );
  });

  it("replays one fixed trace across provenance and scope contracts", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      13
    );
    const actorBlind = replayTrace(products, scenario, trace, {
      studyACondition: "actor-blind"
    });
    const provenance = replayTrace(products, scenario, trace, {
      studyACondition: "provenance-aware"
    });
    const scope = replayTrace(products, scenario, trace, {
      studyACondition: "scope-gated"
    });

    expect(provenance.metrics.profileContamination).toBeLessThan(
      actorBlind.metrics.profileContamination
    );
    expect(scope.metrics.profileContamination).toBeLessThanOrEqual(
      provenance.metrics.profileContamination
    );
    expect(provenance.metrics.taskUtility).toBe(actorBlind.metrics.taskUtility);
  });

  it("keeps impact-proxy traces fixed when only quarantine changes", () => {
    const scenario = SCENARIOS[0];
    const proxyTrace = generateBehaviorTrace(
      products,
      scenario,
      "goal-bound",
      3,
      { interfaceCondition: "impact-proxy" }
    );
    const quarantineTrace = generateBehaviorTrace(
      products,
      scenario,
      "goal-bound",
      3,
      { interfaceCondition: "impact-proxy-with-quarantine" }
    );
    const quarantined = replayTrace(products, scenario, quarantineTrace, {
      studyBCondition: "impact-proxy-with-quarantine"
    });

    expect(quarantineTrace).toEqual(proxyTrace);
    expect(quarantined.metrics.interactionCost).toBe(8);
    expect(
      quarantined.receipts.some(
        (receipt) => receipt.status === "quarantined"
      )
    ).toBe(true);
  });

  it("matches total update mass without using intent selectively", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      21,
      { labelNoise: 0.1 }
    );
    const scale = matchedAttenuationScale(trace);
    const matchedMass = trace.events.reduce(
      (total, event) => total + ACTION_WEIGHTS[event.action] * scale,
      0
    );
    const provenanceMass = trace.events.reduce(
      (total, event) =>
        total +
        ACTION_WEIGHTS[event.action] * INTENT_WEIGHTS[event.observedIntent],
      0
    );

    expect(matchedMass).toBeCloseTo(provenanceMass, 12);
  });

  it("exposes no-update as an explicit aligned-profile floor", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(products, scenario, "goal-bound", 5);
    const result = replayTrace(products, scenario, trace, {
      studyACondition: "no-update"
    });

    expect(result.finalProfile).toEqual(scenario.principalReference);
    expect(result.metrics.profileContamination).toBe(0);
    expect(result.metrics.persistentUpdateRate).toBe(0);
  });

  it("validates signed profile deltas in update receipts", () => {
    const scenario = SCENARIOS[0];
    const trace = generateBehaviorTrace(
      products,
      scenario,
      "exploratory",
      17
    );
    const replay = replayTrace(products, scenario, trace, {
      studyACondition: "actor-blind"
    });
    const signedReceipt = replay.receipts.find((receipt) =>
      Object.values(receipt.delta).some((value) => value < 0)
    );

    expect(signedReceipt).toBeDefined();
    expect(() => UpdateReceiptSchema.parse(signedReceipt)).not.toThrow();
  });
});
