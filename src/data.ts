import { useEffect, useState } from "react";
import type {
  BehaviorTrace,
  Catalog,
  Policy,
  ProfileVector,
  RunMetrics,
  Scenario,
  UpdateReceipt
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
  study: "A" | "B";
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
    "actor-blind" | "provenance-aware" | "approval-gated",
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
    baselineLabelNoise: number;
    baselineLearningRate: number;
  };
  overallA: MetricSummary[];
  cellsA: CellSummary[];
  overallB: MetricSummary[];
  cellsB: CellSummary[];
  pairedSeedExample: ExperimentRow[];
  sensitivity: SensitivitySummary[];
  representative: RepresentativeReplay;
}

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
      fetch(`${base}results/v1/summary.json`).then((response) => {
        if (!response.ok) throw new Error("Could not load experiment summary.");
        return response.json() as Promise<ProjectSummary>;
      }),
      fetch(`${base}data/open-food-facts.snapshot.json`).then((response) => {
        if (!response.ok) throw new Error("Could not load product snapshot.");
        return response.json() as Promise<Catalog>;
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

