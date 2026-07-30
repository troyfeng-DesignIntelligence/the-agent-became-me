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
  study: "A" | "B" | "C";
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
  actorRecordingErrorRate: number;
  intentLabelErrorRate: number;
  provenanceUseRate: number;
  persistentUpdateRate: number;
  interactionCost: number;
  constraintViolations: number;
}

export interface RepresentativeReplay {
  scenario: Scenario;
  policy: Policy;
  seed: number;
  trace: ReturnType<typeof generateBehaviorTrace>;
  worlds: Record<
    | "actor-blind"
    | "logged-only"
    | "matched-attenuation"
    | "provenance-aware"
    | "scope-gated"
    | "no-update",
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
    studyCScenarioId: string;
    studyCInitialProfile: "disclosed-reference";
    baselineLabelNoise: number;
    baselineLearningRate: number;
  };
  studyA: ExperimentRow[];
  studyB: ExperimentRow[];
  studyC: ExperimentRow[];
  sensitivity: ExperimentRow[];
  representative: RepresentativeReplay;
}

const toRow = (
  study: "A" | "B" | "C",
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
  const studyC: ExperimentRow[] = [];
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

  const learningNeededScenario = SCENARIOS.find(
    (scenario) => scenario.id === "weekly-breakfast"
  );
  if (!learningNeededScenario) {
    throw new Error("Missing registered weekly-breakfast stress scenario.");
  }
  for (const policy of POLICIES) {
    for (let seed = 1; seed <= seedsPerCell; seed += 1) {
      const trace = generateBehaviorTrace(
        products,
        learningNeededScenario,
        policy,
        seed,
        { labelNoise: baselineLabelNoise }
      );
      for (const condition of STUDY_A_CONDITIONS) {
        const replay = replayTrace(
          products,
          learningNeededScenario,
          trace,
          {
            studyACondition: condition,
            learningRate: baselineLearningRate,
            initialProfile: learningNeededScenario.disclosedReference
          }
        );
        studyC.push(
          toRow(
            "C",
            condition,
            learningNeededScenario,
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
      studyCScenarioId: learningNeededScenario.id,
      studyCInitialProfile: "disclosed-reference",
      baselineLabelNoise,
      baselineLearningRate
    },
    studyA,
    studyB,
    studyC,
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
        "logged-only": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "logged-only",
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
        "scope-gated": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "scope-gated",
            learningRate: baselineLearningRate
          }
        ),
        "matched-attenuation": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "matched-attenuation",
            learningRate: baselineLearningRate
          }
        ),
        "no-update": replayTrace(
          products,
          representativeScenario,
          representativeTrace,
          {
            studyACondition: "no-update",
            learningRate: baselineLearningRate
          }
        )
      }
    }
  };
}
