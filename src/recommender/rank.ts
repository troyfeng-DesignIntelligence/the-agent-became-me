import type {
  Policy,
  Product,
  ProfileVector,
  Scenario,
  StudyBCondition
} from "../domain/schema";
import type { RandomStream } from "../sim/rng";
import { dot, normalizedDistance } from "../sim/vector";

export interface RankedProduct {
  product: Product;
  score: number;
  taskScore: number;
  profileImpact: number;
}

function hasForbiddenAllergen(product: Product, scenario: Scenario): boolean {
  return scenario.forbiddenAllergens.some((allergen) =>
    product.allergens.includes(allergen)
  );
}

export function rankProducts(
  products: Product[],
  scenario: Scenario,
  policy: Policy,
  rng: RandomStream,
  interfaceCondition: StudyBCondition | null = null
): RankedProduct[] {
  const eligible = products.filter(
    (product) => !hasForbiddenAllergen(product, scenario)
  );

  return eligible
    .map((product) => {
      const taskScore = dot(scenario.taskVector, product.attributes);
      const profileScore = dot(
        scenario.disclosedReference,
        product.attributes
      );
      const profileImpact = normalizedDistance(
        scenario.disclosedReference,
        product.attributes
      );
      const noise = (rng.next() - 0.5) * (policy === "exploratory" ? 0.2 : 0.06);
      const previewPenalty =
        interfaceCondition === "impact-preview" ||
        interfaceCondition === "preview-and-repair"
          ? profileImpact * 0.16
          : 0;

      const score =
        policy === "goal-bound"
          ? taskScore * 0.82 + product.popularity * 0.18 + noise - previewPenalty
          : policy === "exploratory"
            ? taskScore * 0.64 +
              product.popularity * 0.2 +
              profileImpact * 0.16 +
              noise -
              previewPenalty
            : taskScore * 0.55 +
              profileScore * 0.3 +
              product.popularity * 0.15 +
              noise -
              previewPenalty;

      return {
        product,
        score,
        taskScore,
        profileImpact
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.product.id.localeCompare(right.product.id)
    );
}

export function recommendForProfile(
  products: Product[],
  profile: ProfileVector,
  limit = 6
): Product[] {
  return products
    .map((product) => ({
      product,
      score: dot(profile, product.attributes) + product.popularity * 0.04
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.product.id.localeCompare(right.product.id)
    )
    .slice(0, limit)
    .map(({ product }) => product);
}
