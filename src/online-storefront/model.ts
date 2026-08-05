import type { Catalog, Product, ProfileVector } from "../domain/schema";

export type ActivationArm = "immediate" | "held";
export type TaskOutcome = "selected" | "abandoned";
export type StorefrontPhase =
  | "task-start"
  | "task-in-progress"
  | "outcome-resolved"
  | "next-task";

export interface StorefrontTask {
  id: string;
  label: string;
  query: string;
  category: string;
  nextCategory: string;
  outcome: TaskOutcome;
}

export const STOREFRONT_TASKS: StorefrontTask[] = [
  { id: "cereal-selected", label: "Choose a weekday breakfast cereal", query: "breakfast cereal", category: "breakfast-cereals", nextCategory: "snacks", outcome: "selected" },
  { id: "snack-abandoned", label: "Compare a plant-forward afternoon snack", query: "plant based snack", category: "snacks", nextCategory: "yogurts", outcome: "abandoned" },
  { id: "drink-selected", label: "Choose a plant-based breakfast drink", query: "plant based beverage", category: "plant-based-beverages", nextCategory: "energy-bars", outcome: "selected" },
  { id: "bar-abandoned", label: "Compare energy bars for a short trip", query: "energy bar", category: "energy-bars", nextCategory: "breakfast-cereals", outcome: "abandoned" },
  { id: "yogurt-selected", label: "Choose a lightly processed yogurt", query: "yogurt", category: "yogurts", nextCategory: "plant-based-beverages", outcome: "selected" },
  { id: "cereal-abandoned", label: "Explore an indulgent weekend cereal", query: "weekend cereal", category: "breakfast-cereals", nextCategory: "energy-bars", outcome: "abandoned" },
  { id: "snack-selected", label: "Choose a lower-processing snack", query: "low processing snack", category: "snacks", nextCategory: "plant-based-beverages", outcome: "selected" },
  { id: "drink-abandoned", label: "Compare sustainable non-dairy drinks", query: "sustainable non dairy drink", category: "plant-based-beverages", nextCategory: "yogurts", outcome: "abandoned" }
];

const axes = [
  "nutrition",
  "sustainability",
  "plantBased",
  "lowProcessing",
  "indulgence"
] as const;

const neutralProfile: ProfileVector = {
  nutrition: 0.58,
  sustainability: 0.56,
  plantBased: 0.5,
  lowProcessing: 0.55,
  indulgence: 0.42
};

export function initialProfile(): ProfileVector {
  return { ...neutralProfile };
}

export function categoryProfile(catalog: Catalog, category: string): ProfileVector {
  const products = catalog.products.filter((product) => product.category === category);
  if (products.length === 0) return initialProfile();
  return Object.fromEntries(
    axes.map((axis) => [
      axis,
      products.reduce((total, product) => total + product.attributes[axis], 0) /
        products.length
    ])
  ) as ProfileVector;
}

export function incorporate(
  profile: ProfileVector,
  product: Product,
  weight: number
): ProfileVector {
  return Object.fromEntries(
    axes.map((axis) => [
      axis,
      profile[axis] * (1 - weight) + product.attributes[axis] * weight
    ])
  ) as ProfileVector;
}

function similarity(left: ProfileVector, right: ProfileVector) {
  return (
    1 -
    axes.reduce((total, axis) => total + Math.abs(left[axis] - right[axis]), 0) /
      axes.length
  );
}

export function rankProducts(
  catalog: Catalog,
  profile: ProfileVector,
  categoryBoost?: string,
  limit = 10
): Product[] {
  return [...catalog.products]
    .sort((left, right) => {
      const leftScore =
        similarity(left.attributes, profile) * 0.72 +
        left.popularity * 0.18 +
        (left.category === categoryBoost ? 0.1 : 0);
      const rightScore =
        similarity(right.attributes, profile) * 0.72 +
        right.popularity * 0.18 +
        (right.category === categoryBoost ? 0.1 : 0);
      return rightScore - leftScore || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export function taskLocalProfile(
  catalog: Catalog,
  task: StorefrontTask,
  viewedIds: string[]
): ProfileVector {
  return viewedIds.reduce((profile, id) => {
    const product = catalog.products.find((candidate) => candidate.id === id);
    return product ? incorporate(profile, product, 0.22) : profile;
  }, categoryProfile(catalog, task.category));
}

export function searchProducts(catalog: Catalog, task: StorefrontTask): Product[] {
  return catalog.products
    .filter((product) => product.category === task.category)
    .sort((left, right) => right.popularity - left.popularity || left.id.localeCompare(right.id))
    .slice(0, 12);
}

export function nextTaskProduct(catalog: Catalog, task: StorefrontTask): Product {
  const product = catalog.products
    .filter((candidate) => candidate.category === task.nextCategory)
    .sort((left, right) => right.popularity - left.popularity)[0];
  if (!product) throw new Error(`Missing next-task product for ${task.nextCategory}`);
  return product;
}

export function top10Displacement(left: string[], right: string[]) {
  const overlap = left.slice(0, 10).filter((id) => right.slice(0, 10).includes(id)).length;
  return 1 - overlap / 10;
}
