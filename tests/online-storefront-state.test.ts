import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogSchema } from "../src/domain/schema";
import {
  rankProducts,
  STOREFRONT_TASKS,
  taskLocalProfile
} from "../src/online-storefront/model";
import {
  beginNextTask,
  createStorefrontState,
  resolveTask,
  viewProduct
} from "../src/online-storefront/state";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync(resolve("public/data/open-food-facts.snapshot.json"), "utf8"))
);
const task = STOREFRONT_TASKS[0];
const viewed = catalog.products.filter((product) => product.category === task.category).slice(0, 3);

describe("online storefront activation state", () => {
  it("keeps held evidence out of the platform profile while preserving task-local adaptation", () => {
    const baseline = createStorefrontState();
    const held = viewed.reduce(
      (state, product) => viewProduct(state, catalog, "held", product.id),
      baseline
    );
    const immediate = viewed.reduce(
      (state, product) => viewProduct(state, catalog, "immediate", product.id),
      createStorefrontState()
    );
    expect(held.platformProfile).toEqual(baseline.platformProfile);
    expect(held.stagedIds).toHaveLength(3);
    expect(immediate.platformProfile).not.toEqual(baseline.platformProfile);
    expect(taskLocalProfile(catalog, task, held.viewedIds)).toEqual(
      taskLocalProfile(catalog, task, immediate.viewedIds)
    );
  });

  it.each(["selected", "abandoned"] as const)(
    "reaches matched %s resolved and next-task states",
    (outcome) => {
      const immediate = viewed.reduce(
        (state, product) => viewProduct(state, catalog, "immediate", product.id),
        createStorefrontState()
      );
      const held = viewed.reduce(
        (state, product) => viewProduct(state, catalog, "held", product.id),
        createStorefrontState()
      );
      const selectedId = outcome === "selected" ? viewed[0].id : null;
      const immediateResolved = resolveTask(immediate, catalog, outcome, selectedId);
      const heldResolved = resolveTask(held, catalog, outcome, selectedId);
      expect(immediateResolved.platformProfile).toEqual(heldResolved.platformProfile);
      expect(
        rankProducts(catalog, immediateResolved.platformProfile).map((product) => product.id)
      ).toEqual(rankProducts(catalog, heldResolved.platformProfile).map((product) => product.id));
      expect(beginNextTask(immediateResolved, catalog, task).platformProfile).toEqual(
        beginNextTask(heldResolved, catalog, task).platformProfile
      );
    }
  );
});
