import { useEffect, useState } from "react";
import { z } from "zod";
import {
  BehaviorTraceSchema,
  CatalogSchema,
  PolicySchema,
  RunMetricsSchema,
  ScenarioSchema,
  UpdateReceiptSchema,
  VectorSchema,
  type BehaviorTrace,
  type Catalog,
  type Policy,
  type ProfileVector,
  type RunMetrics,
  type Scenario,
  type UpdateReceipt
} from "./domain/schema";

export interface MetricSummary extends RunMetrics {
  condition: string;
  runCount: number;
  profileContaminationP10: number;
  profileContaminationP90: number;
  futureRecommendationRegretP10: number;
  futureRecommendationRegretP90: number;
  taskUtilityP10: number;
  taskUtilityP90: number;
  attributionErrorRateP10: number;
  attributionErrorRateP90: number;
  actorRecordingErrorRateP10: number;
  actorRecordingErrorRateP90: number;
  intentLabelErrorRateP10: number;
  intentLabelErrorRateP90: number;
  provenanceUseRateP10: number;
  provenanceUseRateP90: number;
  persistentUpdateRateP10: number;
  persistentUpdateRateP90: number;
  interactionCostP10: number;
  interactionCostP90: number;
  constraintViolationsP10: number;
  constraintViolationsP90: number;
}

export interface CellSummary extends MetricSummary {
  scenarioId: string;
  scenarioLabel: string;
  expectedConflict: "low" | "medium" | "high";
  policy: Policy;
}

export interface ExperimentRow extends RunMetrics {
  study: "A" | "B" | "C";
  condition: string;
  scenarioId: string;
  scenarioLabel: string;
  expectedConflict: "low" | "medium" | "high";
  policy: Policy;
  seed: number;
  labelNoise: number;
  learningRate: number;
}

export interface SensitivitySummary extends MetricSummary {
  labelNoise: number;
  learningRate: number;
}

export interface ProfileHistoryPoint {
  step: number;
  profile: ProfileVector;
}

export interface ReplayWorld {
  finalProfile: ProfileVector;
  profileHistory: ProfileHistoryPoint[];
  receipts: UpdateReceipt[];
  metrics: RunMetrics;
}

export interface RepresentativeReplay {
  scenario: Scenario;
  policy: Policy;
  seed: number;
  trace: BehaviorTrace;
  worlds: Record<
    | "actor-blind"
    | "logged-only"
    | "matched-attenuation"
    | "provenance-aware"
    | "scope-gated"
    | "no-update",
    ReplayWorld
  >;
}

export interface ProjectSummary {
  schemaVersion: "summary.v1";
  protocolVersion: "protocol.v1";
  generatedAt: string;
  observedStatus: "generated";
  catalog: {
    productCount: number;
    source: string;
    snapshotSchemaVersion: string;
  };
  design: {
    scenarioCount: number;
    policies: readonly Policy[];
    seedsPerCell: number;
    studyAConditions: readonly string[];
    studyBConditions: readonly string[];
    studyCScenarioId: string;
    studyCInitialProfile: "disclosed-reference";
    baselineLabelNoise: number;
    baselineLearningRate: number;
  };
  overallA: MetricSummary[];
  cellsA: CellSummary[];
  overallB: MetricSummary[];
  cellsB: CellSummary[];
  overallC: MetricSummary[];
  cellsC: Array<MetricSummary & { policy: Policy }>;
  pairedSeedExample: ExperimentRow[];
  sensitivity: SensitivitySummary[];
  representative: RepresentativeReplay;
}

const MetricSummarySchema = RunMetricsSchema.extend({
  condition: z.string(),
  runCount: z.number().int().nonnegative(),
  profileContaminationP10: z.number().nonnegative(),
  profileContaminationP90: z.number().nonnegative(),
  futureRecommendationRegretP10: z.number().nonnegative(),
  futureRecommendationRegretP90: z.number().nonnegative(),
  taskUtilityP10: z.number().min(0).max(1),
  taskUtilityP90: z.number().min(0).max(1),
  attributionErrorRateP10: z.number().min(0).max(1),
  attributionErrorRateP90: z.number().min(0).max(1),
  actorRecordingErrorRateP10: z.number().min(0).max(1),
  actorRecordingErrorRateP90: z.number().min(0).max(1),
  intentLabelErrorRateP10: z.number().min(0).max(1),
  intentLabelErrorRateP90: z.number().min(0).max(1),
  provenanceUseRateP10: z.number().min(0).max(1),
  provenanceUseRateP90: z.number().min(0).max(1),
  persistentUpdateRateP10: z.number().min(0).max(1),
  persistentUpdateRateP90: z.number().min(0).max(1),
  interactionCostP10: z.number().nonnegative(),
  interactionCostP90: z.number().nonnegative(),
  constraintViolationsP10: z.number().nonnegative(),
  constraintViolationsP90: z.number().nonnegative()
});

const ExperimentRowSchema = RunMetricsSchema.extend({
  study: z.enum(["A", "B", "C"]),
  condition: z.string(),
  scenarioId: z.string(),
  scenarioLabel: z.string(),
  expectedConflict: z.enum(["low", "medium", "high"]),
  policy: PolicySchema,
  seed: z.number().int(),
  labelNoise: z.number().min(0).max(1),
  learningRate: z.number().min(0)
});

const ReplayWorldSchema = z.object({
  finalProfile: VectorSchema,
  profileHistory: z.array(
    z.object({
      step: z.number().int(),
      profile: VectorSchema
    })
  ),
  receipts: z.array(UpdateReceiptSchema),
  metrics: RunMetricsSchema
});

const RepresentativeReplaySchema = z.object({
  scenario: ScenarioSchema,
  policy: PolicySchema,
  seed: z.number().int(),
  trace: BehaviorTraceSchema,
  worlds: z.object({
    "actor-blind": ReplayWorldSchema,
    "logged-only": ReplayWorldSchema,
    "matched-attenuation": ReplayWorldSchema,
    "provenance-aware": ReplayWorldSchema,
    "scope-gated": ReplayWorldSchema,
    "no-update": ReplayWorldSchema
  })
});

const ProjectSummarySchema = z.object({
  schemaVersion: z.literal("summary.v1"),
  protocolVersion: z.literal("protocol.v1"),
  generatedAt: z.string(),
  observedStatus: z.literal("generated"),
  catalog: z.object({
    productCount: z.number().int().positive(),
    source: z.string(),
    snapshotSchemaVersion: z.string()
  }),
  design: z.object({
    scenarioCount: z.number().int().positive(),
    policies: z.array(PolicySchema),
    seedsPerCell: z.number().int().positive(),
    studyAConditions: z.array(z.string()),
    studyBConditions: z.array(z.string()),
    studyCScenarioId: z.string(),
    studyCInitialProfile: z.literal("disclosed-reference"),
    baselineLabelNoise: z.number().min(0).max(1),
    baselineLearningRate: z.number().min(0)
  }),
  overallA: z.array(MetricSummarySchema),
  cellsA: z.array(
    MetricSummarySchema.extend({
      scenarioId: z.string(),
      scenarioLabel: z.string(),
      expectedConflict: z.enum(["low", "medium", "high"]),
      policy: PolicySchema
    })
  ),
  overallB: z.array(MetricSummarySchema),
  cellsB: z.array(
    MetricSummarySchema.extend({
      scenarioId: z.string(),
      scenarioLabel: z.string(),
      expectedConflict: z.enum(["low", "medium", "high"]),
      policy: PolicySchema
    })
  ),
  overallC: z.array(MetricSummarySchema),
  cellsC: z.array(
    MetricSummarySchema.extend({
      policy: PolicySchema
    })
  ),
  pairedSeedExample: z.array(ExperimentRowSchema),
  sensitivity: z.array(
    MetricSummarySchema.extend({
      labelNoise: z.number().min(0).max(1),
      learningRate: z.number().min(0)
    })
  ),
  representative: RepresentativeReplaySchema
});

interface ProjectDataState {
  summary: ProjectSummary | null;
  catalog: Catalog | null;
  error: string | null;
  loading: boolean;
}

export function useProjectData(): ProjectDataState {
  const [state, setState] = useState<ProjectDataState>({
    summary: null,
    catalog: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;

    Promise.all([
      fetch(`${base}results/v1/summary.json`).then(async (response) => {
        if (!response.ok) throw new Error("Could not load experiment summary.");
        return ProjectSummarySchema.parse(await response.json());
      }),
      fetch(`${base}data/open-food-facts.snapshot.json`).then(async (response) => {
        if (!response.ok) throw new Error("Could not load product snapshot.");
        return CatalogSchema.parse(await response.json());
      })
    ])
      .then(([summary, catalog]) => {
        if (!cancelled) {
          setState({ summary, catalog, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            summary: null,
            catalog: null,
            error:
              error instanceof Error ? error.message : "Unknown loading error.",
            loading: false
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
