import {
  ScenarioSchema,
  type ProfileVector,
  type Scenario
} from "../domain/schema";

const measuredRoutine: ProfileVector = {
  nutrition: 0.86,
  sustainability: 0.68,
  plantBased: 0.72,
  lowProcessing: 0.82,
  indulgence: 0.18
};

const lowImpactShopper: ProfileVector = {
  nutrition: 0.66,
  sustainability: 0.9,
  plantBased: 0.88,
  lowProcessing: 0.7,
  indulgence: 0.28
};

const ingredientMinimalist: ProfileVector = {
  nutrition: 0.78,
  sustainability: 0.6,
  plantBased: 0.54,
  lowProcessing: 0.94,
  indulgence: 0.2
};

const convenienceFirst: ProfileVector = {
  nutrition: 0.48,
  sustainability: 0.38,
  plantBased: 0.42,
  lowProcessing: 0.28,
  indulgence: 0.68
};

export const SCENARIOS: Scenario[] = [
  {
    id: "party-snacks",
    label: "Party snacks",
    brief:
      "Choose crowd-pleasing snacks for a children’s party. Avoid peanuts. This is a one-off purchase.",
    principalLabel: "Measured routine",
    principalReference: measuredRoutine,
    disclosedReference: {
      nutrition: 0.55,
      sustainability: 0.5,
      plantBased: 0.5,
      lowProcessing: 0.45,
      indulgence: 0.5
    },
    taskVector: {
      nutrition: 0.22,
      sustainability: 0.3,
      plantBased: 0.42,
      lowProcessing: 0.18,
      indulgence: 0.96
    },
    forbiddenAllergens: ["en:peanuts"],
    learningScope: "none",
    expectedConflict: "high"
  },
  {
    id: "hiking-fuel",
    label: "Hiking fuel",
    brief:
      "Find compact, popular food for a group hike. Prioritize energy and portability; avoid peanuts.",
    principalLabel: "Ingredient minimalist",
    principalReference: ingredientMinimalist,
    disclosedReference: {
      nutrition: 0.64,
      sustainability: 0.5,
      plantBased: 0.48,
      lowProcessing: 0.6,
      indulgence: 0.38
    },
    taskVector: {
      nutrition: 0.52,
      sustainability: 0.35,
      plantBased: 0.4,
      lowProcessing: 0.22,
      indulgence: 0.74
    },
    forbiddenAllergens: ["en:peanuts"],
    learningScope: "none",
    expectedConflict: "medium"
  },
  {
    id: "houseguest-breakfast",
    label: "Houseguest breakfast",
    brief:
      "Buy a plant-based breakfast for a weekend guest. Treat the guest’s diet as task context, not my preference.",
    principalLabel: "Convenience first",
    principalReference: convenienceFirst,
    disclosedReference: {
      nutrition: 0.48,
      sustainability: 0.45,
      plantBased: 0.5,
      lowProcessing: 0.34,
      indulgence: 0.58
    },
    taskVector: {
      nutrition: 0.64,
      sustainability: 0.76,
      plantBased: 1,
      lowProcessing: 0.62,
      indulgence: 0.3
    },
    forbiddenAllergens: [],
    learningScope: "none",
    expectedConflict: "high"
  },
  {
    id: "weekly-breakfast",
    label: "Weekly breakfast",
    brief:
      "Restock my usual breakfast. Favor nutritious, low-impact, minimally processed products.",
    principalLabel: "Low-impact shopper",
    principalReference: lowImpactShopper,
    disclosedReference: {
      nutrition: 0.64,
      sustainability: 0.74,
      plantBased: 0.76,
      lowProcessing: 0.6,
      indulgence: 0.34
    },
    taskVector: {
      nutrition: 0.76,
      sustainability: 0.82,
      plantBased: 0.82,
      lowProcessing: 0.7,
      indulgence: 0.26
    },
    forbiddenAllergens: [],
    learningScope: "commit-only",
    expectedConflict: "low"
  }
].map((scenario) => ScenarioSchema.parse(scenario));
