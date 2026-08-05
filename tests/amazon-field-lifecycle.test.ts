import { describe, expect, it } from "vitest";
import {
  AMAZON_LIFECYCLE_CONDITIONS,
  assertAmazonLifecycle,
  replayAmazonLifecycle,
  type AmazonFieldTrace
} from "../src/amazon/field-lifecycle";

const abandonedCart: AmazonFieldTrace = {
  traceId: "cart-stage",
  outcome: "abandoned",
  events: [
    { action: "search", intent: "explore", targetKey: "query" },
    { action: "product-view", intent: "explore", targetKey: "view:phone-1" },
    { action: "add-to-cart", intent: "consider", targetKey: "cart:phone-1" }
  ]
};

describe("Amazon field-probe lifecycle", () => {
  it("separates quarantine from rollback provisional exposure", () => {
    const baseline = replayAmazonLifecycle(abandonedCart, "persist-all");
    const quarantine = replayAmazonLifecycle(
      abandonedCart,
      "outcome-quarantine"
    );
    const rollback = replayAmazonLifecycle(
      abandonedCart,
      "rollback-on-failure"
    );
    expect(quarantine.provisionalProfileMass).toBe(0);
    expect(quarantine.finalPersistentMass).toBe(0);
    expect(rollback.provisionalProfileMass).toBe(
      baseline.finalPersistentMass
    );
    expect(rollback.rollbackMass).toBe(baseline.finalPersistentMass);
  });

  it("keeps non-purchase abandoned tasks outside commit-only scope", () => {
    expect(
      replayAmazonLifecycle(abandonedCart, "scope-gated")
        .finalPersistentMass
    ).toBe(0);
  });

  it("passes frozen six-condition invariants", () => {
    const rows = AMAZON_LIFECYCLE_CONDITIONS.map((condition) =>
      replayAmazonLifecycle(abandonedCart, condition)
    );
    expect(() => assertAmazonLifecycle(rows, 1)).not.toThrow();
  });
});
