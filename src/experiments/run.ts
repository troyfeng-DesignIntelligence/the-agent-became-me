import {
  POLICIES,
  STUDY_A_CONDITIONS,
  STUDY_B_CONDITIONS,
  type Policy,
  type Product,
  type Scenario,
  type StudyACondition,
  type StudyBCondition
} from "../domain/schema";
import { SCENARIOS } from "../sim/scenarios";
import { generateBehaviorTrace } from "../sim/trace";
import { replayTrace, type ReplayResult } from "./replay";

export interface ExperimentRow {
  study: "A" | "B";
  condition: StudyACondition | StudyBCondition;
  scenarioId: string;
  scenarioLabel: string;
  expectedConflict: Scenario["expectedConflict"];
  policy: Policy;
  seed: number;
  labelNoise: number;
  learningRate: number;
  profileContamination: number;
  futureRecommendationRegret: number;
  taskUtility: number;
  attributionErrorRate: number;
  interactionCost: number;
  constraintViolations: number;
}

export interface RepresentativeReplay {
  scenario: Scenario;
  policy: Policy;
  seed: number;
  trace: ReturnType<typeof generateBehaviorTrace>;
  worlds: Record<
    "actor-blind" | "provenance-aware" | "approval-gated",
    ReplayResult
  >;
}

export interface ExperimentOutput {
  schemaVersion: "results.v1";
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
    studyAConditions: readonly StudyACondition[];
    studyBConditions: readonly StudyBCondition[];
    baselineLabelNoise: number;
    baselineLearningRate: number;
  };
  studyA: ExperimentRow[];
  studyB: ExperimentRow[];
  sensitivity: ExperimentRow[];
  representative: RepresentativeReplay;
}

const toRow = (
  study: "A" | "B",
  condition: StudyACondition | StudyBCondition,
  scenario: Scenario,
  policy: Policy,
  seed: number,
  labelNoise: number,
  learningRate: number,
  replay: ReplayResult
): ExperimentRow => ({
  study,
  condition,
  scenarioId: scenario.id,
  scenarioLabel: scenario.label,
  expectedConflict: scenario.expectedConflict,
  policy,
  seed,
  labelNoise,
  learningRate,
  ...replay.metrics
});

export function runExperiment(
  products: Product[],
  generatedAt: string,
  seedsPerCell = 40
): ExperimentOutput {
  const baselineLabelNoise = 0.1;
  const baselineLearningRate = 0.22;
  const studyA: ExperimentRow[] = [];
  const studyB: ExperimentRow[] = [];
  const sensitivity: ExperimentRow[] = [];

  for (const scenario of SCENARIOS) {
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= seedsPerCell; seed += 1) {
        const frozenTrace = generateBehaviorTrace(
          products,
          scenario,
          policy,
          seed,
          { labelNoise: baselineLabelNoise }
        );
        for (const condition of STUDY_A_CONDITIONS) {
          const replay = replayTrace(products, scenario, frozenTrace, {
            studyACondition: condition,
            learningRate: baselineLearningRate
          });
          studyA.push(
            toRow(
              "A",
              condition,
              scenario,
              policy,
              seed,
              baselineLabelNoise,
              baselineLearningRate,
              replay
            )
          );
        }

        for (const condition of STUDY_B_CONDITIONS) {
          const behavior = generateBehaviorTrace(
            products,
            scenario,
            policy,
            seed,
            {
              labelNoise: baselineLabelNoise,
              interfaceCondition: condition
            }
          );
          const replay = replayTrace(products, scenario, behavior, {
            studyBCondition: condition,
            learningRate: baselineLearningRate
          });
          studyB.push(
            toRow(
              "B",
              condition,
              scenario,
              policy,
              seed,
              baselineLabelNoise,
              baselineLearningRate,
              replay
            )
          );
        }
      }
    }
  }

  for (const labelNoise of [0, 0.1, 0.2, 0.35, 0.5]) {
    for (const learningRate of [0.1, 0.16, 0.22, 0.3]) {
      for (const scenario of SCENARIOS) {
        for (const policy of POLICIES) {
          for (let seed = 1; seed <= Math.min(20, seedsPerCell); seed += 1) {
            const trace = generateBehaviorTrace(
              products,
              scenario,
              policy,
              seed,
              { labelNoise }
            );
            for (const condition of [
              "actor-blind",
              "provenance-aware"
            ] as const) {
              const replay = replayTrace(products, scenario, trace, {
                studyACondition: condition,
                learningRate
              });
              sensitivity.push(
                toRow(
                  "A",
                  condition,
                  scenario,
                  policy,
                  seed,
                  labelNoise,
                  learningRate,
                  replay
                )
              );
            }
          }
        }
      }
    }
  }

  const representativeScenario = SCENARIOS[0];
  const representativePolicy: Policy = "exploratory";
  const representativeSeed = 17;
  const representativeTrace = generateBehaviorTrace(
    products,
    representativeScenario,
    representativePolicy,
    representativeSeed,
    { labelNoise: baselineLabelNoise }
  );

  return {
    schemaVersion: "results.v1",
    protocolVersion: "protocol.v1",
    generatedAt,
    observedStatus: "generated",
    catalog: {
      productCount: products.length,
      source: "Open Food Facts metadata snapshot",
      snapshotSchemaVersion: "catalog.v1"
    },
    design: {
      scenarioCount: SCENARIOS.length,
      policies: POLICIES,
      seedsPerCell,
      studyAConditions: STUDY_A_CONDITIONS,
      studyBConditions: STUDY_B_CONDITIONS,
      baselineLabelNoise,
      baselineLearningRate
    },
    studyA,
    studyB,
    sensitivity,
    representative: {
      scenario: representativeScenario,
      policy: representativePolicy,
      seed: representativeSeed,
      trace: representativeTrace,
      worlds: {
        "actor-blind": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "actor-blind",
            learningRate: baselineLearningRate
          }
        ),
        "provenance-aware": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "provenance-aware",
            learningRate: baselineLearningRate
          }
        ),
        "approval-gated": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "approval-gated",
            learningRate: baselineLearningRate
          }
        )
      }
    }
  };
}
