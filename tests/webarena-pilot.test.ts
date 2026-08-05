import { describe, expect, it } from "vitest";
import {
  adaptWebArenaTask,
  classifyWebArenaTask,
  corroborateTargetWithOcr,
  mapReleasedAction,
  replayPilotTask
} from "../src/webarena/task-pilot";

describe("WebArena task-pressure pilot", () => {
  it("separates purchase, staging, and operational tasks", () => {
    expect(classifyWebArenaTask("Buy the highest rated product")).toBe(
      "purchase"
    );
    expect(classifyWebArenaTask("Add a detergent to my wish list")).toBe(
      "preference-staging"
    );
    expect(classifyWebArenaTask("Tell me the status of my latest order")).toBe(
      "account-or-order-operation"
    );
    expect(classifyWebArenaTask("Rate my recent purchase with 5 stars")).toBe(
      "communication"
    );
    expect(
      classifyWebArenaTask("What is the date of my first purchase?")
    ).toBe("account-or-order-operation");
  });

  it("replays a frozen minimal trace across updater contracts", () => {
    const task = adaptWebArenaTask({
      task_id: 1,
      intent_template_id: 1,
      sites: ["shopping"],
      intent: "Buy the highest rated product"
    });
    const blind = replayPilotTask(task, "actor-blind");
    const logged = replayPilotTask(task, "logged-only");
    const matched = replayPilotTask(task, "matched-attenuation");
    const provenance = replayPilotTask(task, "provenance-aware");
    const scoped = replayPilotTask(task, "scope-gated");
    const none = replayPilotTask(task, "no-update");

    expect(logged.persistentEvidenceMass).toBe(blind.persistentEvidenceMass);
    expect(matched.persistentEvidenceMass).toBe(
      provenance.persistentEvidenceMass
    );
    expect(scoped.nonCommitPersistentMass).toBe(0);
    expect(none.persistentEvidenceMass).toBe(0);
  });

  it("does not treat an order lookup as a purchase commitment", () => {
    const task = adaptWebArenaTask({
      task_id: 2,
      intent_template_id: 2,
      sites: ["shopping"],
      intent: "Show the shipping method for order number 187"
    });
    expect(replayPilotTask(task, "scope-gated").persistentEvidenceMass).toBe(0);
  });

  it("maps only interpretable released click targets into evidence", () => {
    expect(
      mapReleasedAction(
        "click [26792] where [26792] is [26792] button 'Add to Cart'",
        "preference-staging"
      )
    ).toMatchObject({
      action: "shortlist",
      intent: "consider",
      evidenceKind: "shortlist",
      primaryEligible: true
    });
    expect(
      mapReleasedAction(
        "click [8717] where [8717] is [8717] link 'Reorder'",
        "purchase"
      )
    ).toMatchObject({ action: "purchase", intent: "commit" });
    expect(
      mapReleasedAction(
        "click [4307] where [4307] is [4307] link 'My Orders'",
        "product-discovery"
      )
    ).toBeNull();
    expect(
      mapReleasedAction("type [1] [usb wifi]", "product-discovery")
    ).toBeNull();
    expect(
      mapReleasedAction(
        "click [1] where [1] is [1] link '\ue608 Page Next'",
        "product-discovery"
      )
    ).toBeNull();
    expect(
      mapReleasedAction(
        "click [2] where [2] is [2] link '\ue614 Set Ascending Direction'",
        "product-discovery"
      )
    ).toBeNull();
    expect(
      mapReleasedAction(
        "click [3] where [3] is [3] link 'Living Room Furniture(3138 item)'",
        "product-discovery"
      )
    ).toMatchObject({
      action: "view",
      evidenceKind: "category",
      primaryEligible: false
    });
    expect(
      mapReleasedAction(
        "click [4] where [4] is [4] link 'Solid Oak Writing Desk'",
        "product-discovery"
      )
    ).toMatchObject({
      action: "view",
      evidenceKind: "product",
      primaryEligible: true
    });
  });

  it("uses screenshot OCR as auxiliary target corroboration", () => {
    expect(
      corroborateTargetWithOcr(
        "Add to Cart",
        "Purchase option: A yellow button saying Add to Cart"
      )
    ).toMatchObject({ available: true, corroborated: true });
    expect(corroborateTargetWithOcr("Reorder", null)).toEqual({
      available: false,
      corroborated: false,
      tokenRecall: 0
    });
  });
});
