import { z } from "zod";

export const AXES = [
  "nutrition",
  "sustainability",
  "plantBased",
  "lowProcessing",
  "indulgence"
] as const;

export const ACTIONS = ["view", "compare", "shortlist", "purchase"] as const;
export const INTENTS = ["explore", "consider", "commit"] as const;
export const POLICIES = [
  "goal-bound",
  "exploratory",
  "recommendation-following"
] as const;
export const STUDY_A_CONDITIONS = [
  "actor-blind",
  "logged-only",
  "matched-attenuation",
  "provenance-aware",
  "scope-gated",
  "no-update"
] as const;
export const STUDY_B_CONDITIONS = [
  "action-only",
  "impact-proxy",
  "impact-proxy-with-quarantine"
] as const;

export const AxisSchema = z.enum(AXES);
export const ActionSchema = z.enum(ACTIONS);
export const IntentSchema = z.enum(INTENTS);
export const PolicySchema = z.enum(POLICIES);
export const StudyAConditionSchema = z.enum(STUDY_A_CONDITIONS);
export const StudyBConditionSchema = z.enum(STUDY_B_CONDITIONS);

export const VectorSchema = z.object({
  nutrition: z.number().min(0).max(1),
  sustainability: z.number().min(0).max(1),
  plantBased: z.number().min(0).max(1),
  lowProcessing: z.number().min(0).max(1),
  indulgence: z.number().min(0).max(1)
});

export const SignedVectorSchema = z.object({
  nutrition: z.number().min(-1).max(1),
  sustainability: z.number().min(-1).max(1),
  plantBased: z.number().min(-1).max(1),
  lowProcessing: z.number().min(-1).max(1),
  indulgence: z.number().min(-1).max(1)
});

export const ProductSchema = z.object({
  id: z.string(),
  sourceCode: z.string(),
  name: z.string().min(1),
  category: z.string(),
  sourceCategoryTags: z.array(z.string()),
  attributes: VectorSchema,
  popularity: z.number().min(0).max(1),
  allergens: z.array(z.string()),
  labels: z.array(z.string()),
  evidence: z.object({
    nutriScore: z.string().nullable(),
    ecoScore: z.string().nullable(),
    novaGroup: z.number().nullable(),
    uniqueScans: z.number().nonnegative()
  }),
  sourceUrl: z.string().url()
});

export const CatalogSchema = z.object({
  schemaVersion: z.literal("catalog.v1"),
  generatedAt: z.string(),
  source: z.object({
    name: z.string(),
    api: z.string().url(),
    documentation: z.string().url(),
    license: z.string(),
    licenseUrl: z.string().url(),
    attribution: z.string()
  }),
  transformations: z.array(z.string()),
  categories: z.array(z.string()),
  productCount: z.number().int().positive(),
  products: z.array(ProductSchema).min(1)
});

export const ScenarioSchema = z.object({
  id: z.string(),
  label: z.string(),
  brief: z.string(),
  principalLabel: z.string(),
  principalReference: VectorSchema,
  disclosedReference: VectorSchema,
  taskVector: VectorSchema,
  forbiddenAllergens: z.array(z.string()),
  learningScope: z.enum(["none", "commit-only"]),
  expectedConflict: z.enum(["low", "medium", "high"])
});

export const BehaviorEventSchema = z.object({
  id: z.string(),
  step: z.number().int().nonnegative(),
  actor: z.literal("agent"),
  action: ActionSchema,
  productId: z.string(),
  actualIntent: IntentSchema,
  observedIntent: IntentSchema,
  confidence: z.number().min(0).max(1),
  reasonCodes: z.array(z.string())
});

export const BehaviorTraceSchema = z.object({
  schemaVersion: z.literal("trace.v1"),
  protocolVersion: z.literal("protocol.v1"),
  scenarioId: z.string(),
  seed: z.number().int(),
  policy: PolicySchema,
  events: z.array(BehaviorEventSchema)
});

export const UpdateReceiptSchema = z.object({
  eventId: z.string(),
  step: z.number().int().nonnegative(),
  productId: z.string(),
  recordedActor: z.enum(["principal", "agent"]),
  recordedIntent: IntentSchema,
  updaterUsedProvenance: z.boolean(),
  status: z.enum([
    "counted",
    "downweighted",
    "excluded",
    "quarantined",
    "confirmed"
  ]),
  effectiveWeight: z.number().min(0),
  profileBefore: VectorSchema,
  profileAfter: VectorSchema,
  delta: SignedVectorSchema
});

export const RunMetricsSchema = z.object({
  profileContamination: z.number().min(0),
  futureRecommendationRegret: z.number().min(0),
  taskUtility: z.number().min(0).max(1),
  attributionErrorRate: z.number().min(0).max(1),
  actorRecordingErrorRate: z.number().min(0).max(1),
  intentLabelErrorRate: z.number().min(0).max(1),
  provenanceUseRate: z.number().min(0).max(1),
  persistentUpdateRate: z.number().min(0).max(1),
  interactionCost: z.number().nonnegative(),
  constraintViolations: z.number().int().nonnegative()
});

export type Axis = z.infer<typeof AxisSchema>;
export type ProfileVector = z.infer<typeof VectorSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type StudyACondition = z.infer<typeof StudyAConditionSchema>;
export type StudyBCondition = z.infer<typeof StudyBConditionSchema>;
export type BehaviorEvent = z.infer<typeof BehaviorEventSchema>;
export type BehaviorTrace = z.infer<typeof BehaviorTraceSchema>;
export type UpdateReceipt = z.infer<typeof UpdateReceiptSchema>;
export type RunMetrics = z.infer<typeof RunMetricsSchema>;
