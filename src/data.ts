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

export interface WebArenaSummary {
  schemaVersion: "webarena-released-trajectory-replay.v1";
  studyMode: "released-webarena-trajectory-replay";
  evidenceStatus: "pilot-observation";
  corpus: {
    shoppingTaskCount: number;
    uniqueTemplateCount: number;
    parseRate: number;
    auditedStepCount: number;
    mappedEvidenceEventCount: number;
    tracesWithMappedEvidence: number;
    successfulTaskCount: number;
    failedTaskCount: number;
  };
  results: Array<{
    condition: string;
    runCount: number;
    meanPersistentEvidenceMass: number;
    meanNonCommitPersistentMass: number;
  }>;
  outcomeStrata: Array<{
    outcome: string;
    taskCount: number;
    tracesWithMappedEvidence: number;
    totalMappedEvidenceEvents: number;
    meanAuditedSteps: number;
  }>;
  observedComparisons: {
    loggingOnlyMassDifference: number;
    provenanceVsMatchedMassDifference: number;
    scopeGatedNonCommitMass: number;
    scopeGatedMassReductionVsActorBlind: number;
  };
}

export interface WebArenaFailureSummary {
  schemaVersion: "webarena-failure-lifecycle.v1";
  evidenceStatus: "released-trajectory-observation";
  corpus: {
    traceCount: number;
    auditedStepCount: number;
    mappedEventCount: number;
    successfulTraceCount: number;
    failedTraceCount: number;
  };
  mapperValidation: {
    ocrAvailabilityRate: number;
    ocrCorroborationRate: number;
    knownUiControlEventCount: number;
  };
  screenshotValidation: {
    status: string;
    recordCount: number;
    boundaryCount: number;
    controlCount: number;
    visibleCount: number;
    validEvidenceTargetCount: number;
  };
  loopAnalysis: {
    conservativeExactTarget: {
      repeatedCount: number;
      repeatedShare: number;
      tracesWithRepeats: number;
    };
    labelOnlySensitivity: {
      repeatedCount: number;
      repeatedShare: number;
      tracesWithRepeats: number;
    };
  };
  conditions: Array<{
    condition: string;
    runCount: number;
    meanProvisionalProfileMass: number;
    meanFinalPersistentMass: number;
    totalFailedResidualMass: number;
    totalRollbackMass: number;
    successfulEvidenceRetention: number;
  }>;
  observedComparisons: {
    quarantineRollbackFinalDifference: number;
    quarantineProvisionalMass: number;
    rollbackProvisionalMass: number;
    rollbackRemovedMass: number;
    failedResidualReductionUnderQuarantine: number;
    labelOnlyDedupFailedResidualMass: number;
    labelOnlyDedupFailedResidualReduction: number;
    labelOnlyDedupSuccessfulEvidenceRetention: number;
  };
}

export interface AmazonFieldSummary {
  schemaVersion: "amazon-signed-out-field-probe.v1";
  evidenceStatus: "live-interface-observation";
  executedAt: string;
  design: {
    task: string;
    conditions: string[];
    signedOut: boolean;
    isolatedContexts: boolean;
    maximumNavigations: number;
    minimumNavigationIntervalMs: number;
    prohibitedActions: string[];
  };
  execution: {
    totalNavigations: number;
    researchCumulativeNavigations: number;
    completedConditionCount: number;
    stopped: boolean;
    stop: string | null;
    fatal: string | null;
  };
  observations: Array<{
    condition: string;
    asinJaccard: number;
    taskTokenDelta: Record<string, number>;
    moduleDelta: string[];
    baselineAsinCount: number;
    postAsinCount: number;
    cleanup: {
      attempted: boolean;
      cartCountAfter: number | null;
    };
  }>;
  claims: {
    permitted: string[];
    notEstablished: string[];
  };
}

export interface AmazonControlledSummary {
  schemaVersion: "amazon-field-controlled-lifecycle.v1";
  evidenceStatus: "controlled-counterfactual-replay";
  fieldArtifactSha256: string;
  sourceFieldExecutedAt: string;
  design: {
    traceCount: number;
    conditions: string[];
    rowCount: number;
    outcome: string;
    awsStatus: string;
  };
  conditions: Array<{
    condition: string;
    runCount: number;
    totalProvisionalProfileMass: number;
    totalStagedEvidenceMass: number;
    totalFinalPersistentMass: number;
    totalRollbackMass: number;
    totalFailedResidualMass: number;
  }>;
  observedComparisons: {
    quarantineRollbackFinalDifference: number;
    quarantineProvisionalMass: number;
    rollbackProvisionalMass: number;
    rollbackRemovedMass: number;
  };
  claims: {
    observed: string[];
    notEstablished: string[];
  };
}

export interface CrossTaskSensitivitySummary {
  schemaVersion: "cross-task-pollution-sensitivity.v1";
  evidenceStatus: "controlled-synthetic-sensitivity-experiment";
  generatedAt: string;
  design: {
    scenarioCount: number;
    seedsPerScenario: number;
    conditions: string[];
    profileWeights: number[];
    decayRates: number[];
    taskSimilarities: number[];
    followUpRoundCount: number;
    recommendationSlotsPerRound: number;
    cellCount: number;
    runsPerCell: number;
    runCount: number;
    pollutionDefinition: string;
  };
  cells: Array<{
    condition: string;
    profileWeight: number;
    decayRate: number;
    taskSimilarity: number;
    runCount: number;
    meanPostTaskExcessExposureCount: number;
    meanPostTaskExcessExposureRounds: number;
    pollutionRunRate: number;
    meanCurrentTaskRecommendationShare: number;
    meanFinalTemporaryProfileMass: number;
  }>;
  observedComparisons: {
    zeroPollutionCellShare: number;
    positivePollutionCellShare: number;
    peakCell: {
      condition: string;
      profileWeight: number;
      decayRate: number;
      taskSimilarity: number;
      meanPostTaskExcessExposureCount: number;
    };
    highVsLowProfileWeightDifference: number;
    noVsFastDecayDifference: number;
    persistVsIntentDifference: number;
  };
  claims: { observed: string[]; notEstablished: string[] };
}

export interface ExternalValiditySummary {
  schemaVersion: "external-validity-cross-task.v1";
  evidenceStatus: "real-history-counterfactual-injection";
  dataset: {
    name: string;
    ratingCount: number;
    itemCount: number;
    eligibleUserCount: number;
    positiveDefinition: string;
    chronologicalSplit: string;
    rawRedistributed: boolean;
  };
  design: {
    algorithmCount: number;
    algorithms: string[];
    personalizedAlgorithmCount: number;
    lifecycles: string[];
    similarityBands: string[];
    rowCount: number;
    pairedDefinition: string;
    similarityDefinition: string;
    domainBoundary: string;
  };
  algorithmLifecycle: Array<{
    algorithm: string;
    lifecycle: string;
    pairedCaseCount: number;
    meanMeasuredTaskSimilarity: number;
    meanExcessTargetSlotsAt10: number;
    spilloverRate: number;
    meanRankingDisplacementAt10: number;
    meanRecallDeltaAt10: number;
  }>;
  observedComparisons: {
    positivePersistAlgorithms: string[];
    positivePersistAlgorithmCount: number;
    personalizedPersistMeanExcess: number;
    personalizedIntentMeanExcess: number;
    quarantineMaxExcess: number;
    quarantineMaxDisplacement: number;
    popularityMaxDisplacement: number;
  };
  claims: { observed: string[]; notEstablished: string[] };
}

export interface AmazonSasrecSummary {
  schemaVersion: "amazon-sasrec-sequence-validation.v1";
  dataset: {
    source: string;
    reviewCount: number;
    retainedEventCount: number;
    userCount: number;
    itemCount: number;
    minimumSequenceLength: number;
  };
  model: {
    name: "SASRec";
    trainingRuns: Array<{
      seed: number;
      initialTrainingLoss: number;
      finalTrainingLoss: number;
      test: {
        sasrec: { hitRateAt10: number; ndcgAt10: number };
        popularity: { hitRateAt10: number; ndcgAt10: number };
        firstOrderTransition: { hitRateAt10: number; ndcgAt10: number };
        orderSensitivity: {
          changedTop10Rate: number;
          meanTop10Displacement: number;
        };
      };
    }>;
  };
  taskBoundary: {
    lifecycle: Array<{
      lifecycle: string;
      rowCount: number;
      meanExcessTargetSlotsAt10: number;
      meanRankingDisplacementAt10: number;
      spilloverRate: number;
      meanNextItemHitDeltaAt10: number;
    }>;
    observedComparisons: {
      positivePersistSeedCount: number;
      quarantineMaxExcess: number;
      quarantineMaxDisplacement: number;
    };
  };
}

export interface EstimateInterval {
  estimate: number;
  lower95: number;
  upper95: number;
  positiveProbability: number;
}

export interface AmazonCrossCategorySummary {
  schemaVersion: "amazon-cross-category-sasrec.v1";
  design: {
    categories: string[];
    modelSeeds: number[];
    taskUserLimitPerCategory: number;
  };
  categories: Array<{
    slug: string;
    label: string;
    dataset: {
      reviewCount: number;
      retainedEventCount: number;
      userCount: number;
      itemCount: number;
    };
    taskUserCount: number;
    performanceUncertainty: {
      ndcgGainVsPopularity: EstimateInterval;
      sasrecHitRateAt10: EstimateInterval;
      orderChangedTop10Rate: EstimateInterval;
    };
    uncertainty: {
      persistExcess: EstimateInterval;
      commitExcess: EstimateInterval;
      persistMinusCommit: EstimateInterval;
    };
  }>;
  inference: {
    unit: string;
    replicates: number;
    fixedSetEqualCategoryPooledPersistExcess: EstimateInterval;
    categoryResampledPooledPersistExcess: EstimateInterval;
    leaveOneCategoryOut: Array<EstimateInterval & { omittedCategory: string }>;
    betweenCategoryDescriptive: { range: number };
  };
  observedComparisons: {
    positivePersistIntervalCategoryCount: number;
    attenuatedPointEstimateCategoryCount: number;
    learnedModelBeatsPopularityCategoryCount: number;
    allQuarantineInvariant: boolean;
    allLeaveOneOutPositive: boolean;
  };
}

export interface DelegatedActivationSummary {
  schemaVersion: "delegated-activation-timing.v1";
  evidenceStatus: string;
  design: {
    categories: string[];
    taskCount: number;
    taskCountPerCategory: number;
    modelSeeds: number[];
    model: string;
    agent: string;
    agentActions: string[];
    lifecycleConditions: string[];
    timepoints: string[];
    pairedDefinition: string;
    taskLocalContract: string;
  };
  categories: Array<{
    slug: string;
    label: string;
    taskCount: number;
    selectedTaskCount: number;
    abandonedTaskCount: number;
    taskLocalRecommendationUseRate: number;
    meanSelectedUtility: number;
    noLocalMeanSelectedUtility: number;
    maxStagedMinusImmediateTaskUtility: number;
    maxOutcomeResolvedDisplacement: number;
    maxNextTaskDisplacement: number;
    uncertainty: {
      provisionalExposureAuc: EstimateInterval;
      inProgressDisplacementAt10: EstimateInterval;
      inProgressExcessTargetSlotsAt10: EstimateInterval;
    };
  }>;
  pooledUncertainty: {
    provisionalExposureAuc: EstimateInterval;
    inProgressDisplacementAt10: EstimateInterval;
    inProgressExcessTargetSlotsAt10: EstimateInterval;
  };
  observedComparisons: {
    positiveInProgressIntervalCategoryCount: number;
    allResolvedFinalStatesMatched: boolean;
    allNextTaskStatesMatched: boolean;
    taskUtilityIdenticalAcrossLifecycleArms: boolean;
    allAgentsConsumedTaskLocalRecommendations: boolean;
  };
  claims: {
    observed: string[];
    notEstablished: string[];
  };
}

export interface OnlineStorefrontV2Summary {
  schemaVersion: "online-storefront-v2-summary.v1";
  protocolSha256: string;
  evidenceStatus: string;
  design: {
    taskCount: number;
    tasksPerCategory: number;
    categoryCounts: Array<{ category: string; taskCount: number }>;
    modelSeeds: number[];
    agentConfigurations: string[];
    conditions: string[];
    modes: string[];
    timepoints: string[];
    conditionRowCount: number;
    pairedContrastRowCount: number;
  };
  confirmatory: {
    fixedTrace: {
      primaryT1ImmediateHeldDisplacement: OnlineV2Interval;
      t2ImmediateHeldDisplacement: OnlineV2Interval;
      t3ImmediateHeldDisplacement: OnlineV2Interval;
    };
    freeRunning: {
      t1ImmediateHeldDisplacement: OnlineV2Interval;
      traceDivergenceRate: OnlineV2Interval;
      heldMinusImmediateDecisionAccuracy: OnlineV2Interval;
      heldMinusImmediateSelectedUtility: OnlineV2Interval;
    };
    gates: Record<string, boolean>;
  };
  descriptive: {
    byAgentConfig: Record<string, OnlineV2Breakdown>;
    byCategory: Record<string, OnlineV2Breakdown>;
  };
  failuresAndNegativeCases: Record<string, number>;
  claims: { observed: string[]; notEstablished: string[] };
}

export interface OnlineV2Interval {
  estimate: number;
  lower95: number;
  upper95: number;
}

export interface OnlineV2Breakdown {
  pairCount: number;
  fixedT1Displacement: number;
  freeT1Displacement: number;
  freeTraceDivergenceRate: number;
  heldMinusImmediateDecisionAccuracy: number;
  heldMinusImmediateSelectedUtility: number;
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

const WebArenaSummarySchema = z.object({
  schemaVersion: z.literal("webarena-released-trajectory-replay.v1"),
  studyMode: z.literal("released-webarena-trajectory-replay"),
  evidenceStatus: z.literal("pilot-observation"),
  corpus: z.object({
    shoppingTaskCount: z.number().int().positive(),
    uniqueTemplateCount: z.number().int().positive(),
    parseRate: z.number().min(0).max(1),
    auditedStepCount: z.number().int().nonnegative(),
    mappedEvidenceEventCount: z.number().int().nonnegative(),
    tracesWithMappedEvidence: z.number().int().nonnegative(),
    successfulTaskCount: z.number().int().nonnegative(),
    failedTaskCount: z.number().int().nonnegative()
  }),
  results: z.array(
    z.object({
      condition: z.string(),
      runCount: z.number().int().positive(),
      meanPersistentEvidenceMass: z.number().nonnegative(),
      meanNonCommitPersistentMass: z.number().nonnegative()
    })
  ),
  outcomeStrata: z.array(
    z.object({
      outcome: z.string(),
      taskCount: z.number().int().nonnegative(),
      tracesWithMappedEvidence: z.number().int().nonnegative(),
      totalMappedEvidenceEvents: z.number().int().nonnegative(),
      meanAuditedSteps: z.number().nonnegative()
    })
  ),
  observedComparisons: z.object({
    loggingOnlyMassDifference: z.number(),
    provenanceVsMatchedMassDifference: z.number(),
    scopeGatedNonCommitMass: z.number().nonnegative(),
    scopeGatedMassReductionVsActorBlind: z.number()
  })
});

const WebArenaFailureSummarySchema = z.object({
  schemaVersion: z.literal("webarena-failure-lifecycle.v1"),
  evidenceStatus: z.literal("released-trajectory-observation"),
  corpus: z.object({
    traceCount: z.number().int().positive(),
    auditedStepCount: z.number().int().nonnegative(),
    mappedEventCount: z.number().int().nonnegative(),
    successfulTraceCount: z.number().int().nonnegative(),
    failedTraceCount: z.number().int().nonnegative()
  }),
  mapperValidation: z.object({
    ocrAvailabilityRate: z.number().min(0).max(1),
    ocrCorroborationRate: z.number().min(0).max(1),
    knownUiControlEventCount: z.number().int().nonnegative()
  }),
  screenshotValidation: z.object({
    status: z.string(),
    recordCount: z.number().int().nonnegative(),
    boundaryCount: z.number().int().nonnegative(),
    controlCount: z.number().int().nonnegative(),
    visibleCount: z.number().int().nonnegative(),
    validEvidenceTargetCount: z.number().int().nonnegative()
  }),
  loopAnalysis: z.object({
    conservativeExactTarget: z.object({
      repeatedCount: z.number().int().nonnegative(),
      repeatedShare: z.number().min(0).max(1),
      tracesWithRepeats: z.number().int().nonnegative()
    }),
    labelOnlySensitivity: z.object({
      repeatedCount: z.number().int().nonnegative(),
      repeatedShare: z.number().min(0).max(1),
      tracesWithRepeats: z.number().int().nonnegative()
    })
  }),
  conditions: z.array(
    z.object({
      condition: z.string(),
      runCount: z.number().int().positive(),
      meanProvisionalProfileMass: z.number().nonnegative(),
      meanFinalPersistentMass: z.number().nonnegative(),
      totalFailedResidualMass: z.number().nonnegative(),
      totalRollbackMass: z.number().nonnegative(),
      successfulEvidenceRetention: z.number().min(0).max(1)
    })
  ),
  observedComparisons: z.object({
    quarantineRollbackFinalDifference: z.number(),
    quarantineProvisionalMass: z.number().nonnegative(),
    rollbackProvisionalMass: z.number().nonnegative(),
    rollbackRemovedMass: z.number().nonnegative(),
    failedResidualReductionUnderQuarantine: z.number().min(0).max(1),
    labelOnlyDedupFailedResidualMass: z.number().nonnegative(),
    labelOnlyDedupFailedResidualReduction: z.number().min(0).max(1),
    labelOnlyDedupSuccessfulEvidenceRetention: z.number().min(0).max(1)
  })
});

const AmazonFieldSummarySchema = z.object({
  schemaVersion: z.literal("amazon-signed-out-field-probe.v1"),
  evidenceStatus: z.literal("live-interface-observation"),
  executedAt: z.string(),
  design: z.object({
    task: z.string(),
    conditions: z.array(z.string()),
    signedOut: z.boolean(),
    isolatedContexts: z.boolean(),
    maximumNavigations: z.number().int().positive(),
    minimumNavigationIntervalMs: z.number().int().nonnegative(),
    prohibitedActions: z.array(z.string())
  }),
  execution: z.object({
    totalNavigations: z.number().int().nonnegative(),
    researchCumulativeNavigations: z.number().int().nonnegative(),
    completedConditionCount: z.number().int().nonnegative(),
    stopped: z.boolean(),
    stop: z.string().nullable(),
    fatal: z.string().nullable()
  }),
  observations: z.array(
    z.object({
      condition: z.string(),
      asinJaccard: z.number().min(0).max(1),
      taskTokenDelta: z.record(z.string(), z.number()),
      moduleDelta: z.array(z.string()),
      baselineAsinCount: z.number().int().nonnegative(),
      postAsinCount: z.number().int().nonnegative(),
      cleanup: z.object({
        attempted: z.boolean(),
        cartCountAfter: z.number().int().nonnegative().nullable()
      })
    })
  ),
  claims: z.object({
    permitted: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const AmazonControlledSummarySchema = z.object({
  schemaVersion: z.literal("amazon-field-controlled-lifecycle.v1"),
  evidenceStatus: z.literal("controlled-counterfactual-replay"),
  fieldArtifactSha256: z.string().length(64),
  sourceFieldExecutedAt: z.string(),
  design: z.object({
    traceCount: z.number().int().positive(),
    conditions: z.array(z.string()),
    rowCount: z.number().int().positive(),
    outcome: z.string(),
    awsStatus: z.string()
  }),
  conditions: z.array(
    z.object({
      condition: z.string(),
      runCount: z.number().int().positive(),
      totalProvisionalProfileMass: z.number().nonnegative(),
      totalStagedEvidenceMass: z.number().nonnegative(),
      totalFinalPersistentMass: z.number().nonnegative(),
      totalRollbackMass: z.number().nonnegative(),
      totalFailedResidualMass: z.number().nonnegative()
    })
  ),
  observedComparisons: z.object({
    quarantineRollbackFinalDifference: z.number(),
    quarantineProvisionalMass: z.number().nonnegative(),
    rollbackProvisionalMass: z.number().nonnegative(),
    rollbackRemovedMass: z.number().nonnegative()
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const CrossTaskExposureSummarySchema = z.object({
  schemaVersion: z.literal("cross-task-recommendation-exposure.v1"),
  evidenceStatus: z.literal("controlled-synthetic-experiment"),
  fieldArtifactSha256: z.string().length(64),
  generatedAt: z.string(),
  design: z.object({
    scenarioCount: z.number().int().positive(),
    seedsPerScenario: z.number().int().positive(),
    conditionCount: z.number().int().positive(),
    runCount: z.number().int().positive(),
    provisionalSurfaceCount: z.number().int().positive(),
    followUpRoundCount: z.number().int().positive(),
    recommendationSlotsPerRound: z.number().int().positive(),
    outcome: z.string(),
    frozenCurrentTaskTopic: z.string()
  }),
  scenarios: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      temporaryBrief: z.string(),
      temporaryTopic: z.string(),
      followUpBrief: z.string()
    })
  ),
  conditions: z.array(
    z.object({
      condition: z.string(),
      runCount: z.number().int().positive(),
      meanProvisionalExposureCount: z.number().nonnegative(),
      meanProvisionalExcessExposureCount: z.number().nonnegative(),
      meanPostTaskExposureCount: z.number().nonnegative(),
      meanPostTaskExposureRounds: z.number().nonnegative(),
      meanFirstCleanRound: z.number().positive(),
      meanCurrentTaskRecommendationShare: z.number().min(0).max(1),
      meanTemporaryEvidenceMass: z.number().nonnegative()
    })
  ),
  observedComparisons: z.object({
    persistVsIntentPostExposureDifference: z.number(),
    quarantineRollbackPostExposureDifference: z.number(),
    rollbackVsQuarantineProvisionalExposureDifference: z.number(),
    quarantinePostTaskExposureCount: z.number().nonnegative(),
    scopePostTaskExposureCount: z.number().nonnegative(),
    currentTaskShareGainQuarantineVsPersist: z.number()
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const CrossTaskSensitivitySummarySchema = z.object({
  schemaVersion: z.literal("cross-task-pollution-sensitivity.v1"),
  evidenceStatus: z.literal("controlled-synthetic-sensitivity-experiment"),
  generatedAt: z.string(),
  design: z.object({
    scenarioCount: z.number().int().positive(),
    seedsPerScenario: z.number().int().positive(),
    conditions: z.array(z.string()),
    profileWeights: z.array(z.number()),
    decayRates: z.array(z.number().min(0).max(1)),
    taskSimilarities: z.array(z.number().min(0).max(1)),
    followUpRoundCount: z.number().int().positive(),
    recommendationSlotsPerRound: z.number().int().positive(),
    cellCount: z.number().int().positive(),
    runsPerCell: z.number().int().positive(),
    runCount: z.number().int().positive(),
    pollutionDefinition: z.string()
  }),
  cells: z.array(
    z.object({
      condition: z.string(),
      profileWeight: z.number(),
      decayRate: z.number().min(0).max(1),
      taskSimilarity: z.number().min(0).max(1),
      runCount: z.number().int().positive(),
      meanPostTaskExcessExposureCount: z.number().nonnegative(),
      meanPostTaskExcessExposureRounds: z.number().nonnegative(),
      pollutionRunRate: z.number().min(0).max(1),
      meanCurrentTaskRecommendationShare: z.number().min(0).max(1),
      meanFinalTemporaryProfileMass: z.number().nonnegative()
    })
  ),
  observedComparisons: z.object({
    zeroPollutionCellShare: z.number().min(0).max(1),
    positivePollutionCellShare: z.number().min(0).max(1),
    peakCell: z.object({
      condition: z.string(),
      profileWeight: z.number(),
      decayRate: z.number(),
      taskSimilarity: z.number(),
      meanPostTaskExcessExposureCount: z.number().nonnegative()
    }),
    highVsLowProfileWeightDifference: z.number(),
    noVsFastDecayDifference: z.number(),
    persistVsIntentDifference: z.number()
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const ExternalValiditySummarySchema = z.object({
  schemaVersion: z.literal("external-validity-cross-task.v1"),
  evidenceStatus: z.literal("real-history-counterfactual-injection"),
  dataset: z.object({
    name: z.string(),
    ratingCount: z.number().int().positive(),
    itemCount: z.number().int().positive(),
    eligibleUserCount: z.number().int().positive(),
    positiveDefinition: z.string(),
    chronologicalSplit: z.string(),
    rawRedistributed: z.boolean()
  }).passthrough(),
  design: z.object({
    algorithmCount: z.number().int().positive(),
    algorithms: z.array(z.string()),
    personalizedAlgorithmCount: z.number().int().positive(),
    lifecycles: z.array(z.string()),
    similarityBands: z.array(z.string()),
    rowCount: z.number().int().positive(),
    pairedDefinition: z.string(),
    similarityDefinition: z.string(),
    domainBoundary: z.string()
  }).passthrough(),
  algorithmLifecycle: z.array(z.object({
    algorithm: z.string(),
    lifecycle: z.string(),
    pairedCaseCount: z.number().int().positive(),
    meanMeasuredTaskSimilarity: z.number().min(0).max(1),
    meanExcessTargetSlotsAt10: z.number().nonnegative(),
    spilloverRate: z.number().min(0).max(1),
    meanRankingDisplacementAt10: z.number().min(0).max(1),
    meanRecallDeltaAt10: z.number()
  })),
  observedComparisons: z.object({
    positivePersistAlgorithms: z.array(z.string()),
    positivePersistAlgorithmCount: z.number().int().nonnegative(),
    personalizedPersistMeanExcess: z.number().nonnegative(),
    personalizedIntentMeanExcess: z.number().nonnegative(),
    quarantineMaxExcess: z.number().nonnegative(),
    quarantineMaxDisplacement: z.number().min(0).max(1),
    popularityMaxDisplacement: z.number().min(0).max(1)
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const AmazonSasrecSummarySchema = z.object({
  schemaVersion: z.literal("amazon-sasrec-sequence-validation.v1"),
  dataset: z.object({
    source: z.string(),
    reviewCount: z.number().int().positive(),
    retainedEventCount: z.number().int().positive(),
    userCount: z.number().int().positive(),
    itemCount: z.number().int().positive(),
    minimumSequenceLength: z.number().int().positive()
  }).passthrough(),
  model: z.object({
    name: z.literal("SASRec"),
    trainingRuns: z.array(z.object({
      seed: z.number().int(),
      initialTrainingLoss: z.number().positive(),
      finalTrainingLoss: z.number().positive(),
      test: z.object({
        sasrec: z.object({ hitRateAt10: z.number(), ndcgAt10: z.number() }),
        popularity: z.object({ hitRateAt10: z.number(), ndcgAt10: z.number() }),
        firstOrderTransition: z.object({ hitRateAt10: z.number(), ndcgAt10: z.number() }),
        orderSensitivity: z.object({
          changedTop10Rate: z.number(),
          meanTop10Displacement: z.number()
        })
      })
    }).passthrough())
  }).passthrough(),
  taskBoundary: z.object({
    lifecycle: z.array(z.object({
      lifecycle: z.string(),
      rowCount: z.number().int().positive(),
      meanExcessTargetSlotsAt10: z.number(),
      meanRankingDisplacementAt10: z.number(),
      spilloverRate: z.number(),
      meanNextItemHitDeltaAt10: z.number()
    })),
    observedComparisons: z.object({
      positivePersistSeedCount: z.number().int(),
      quarantineMaxExcess: z.number(),
      quarantineMaxDisplacement: z.number()
    })
  }).passthrough()
});

const EstimateIntervalSchema = z.object({
  estimate: z.number(),
  lower95: z.number(),
  upper95: z.number(),
  positiveProbability: z.number().min(0).max(1)
});

const AmazonCrossCategorySummarySchema = z.object({
  schemaVersion: z.literal("amazon-cross-category-sasrec.v1"),
  design: z.object({
    categories: z.array(z.string()).length(4),
    modelSeeds: z.array(z.number().int()).length(3),
    taskUserLimitPerCategory: z.number().int().positive()
  }).passthrough(),
  categories: z.array(z.object({
    slug: z.string(),
    label: z.string(),
    dataset: z.object({
      reviewCount: z.number().int().positive(),
      retainedEventCount: z.number().int().positive(),
      userCount: z.number().int().positive(),
      itemCount: z.number().int().positive()
    }).passthrough(),
    taskUserCount: z.number().int().positive(),
    performanceUncertainty: z.object({
      ndcgGainVsPopularity: EstimateIntervalSchema,
      sasrecHitRateAt10: EstimateIntervalSchema,
      orderChangedTop10Rate: EstimateIntervalSchema
    }),
    uncertainty: z.object({
      persistExcess: EstimateIntervalSchema,
      commitExcess: EstimateIntervalSchema,
      persistMinusCommit: EstimateIntervalSchema
    })
  }).passthrough()).length(4),
  inference: z.object({
    unit: z.string(),
    replicates: z.number().int().positive(),
    fixedSetEqualCategoryPooledPersistExcess: EstimateIntervalSchema,
    categoryResampledPooledPersistExcess: EstimateIntervalSchema,
    leaveOneCategoryOut: z.array(
      EstimateIntervalSchema.extend({ omittedCategory: z.string() })
    ).length(4),
    betweenCategoryDescriptive: z.object({ range: z.number().nonnegative() }).passthrough()
  }).passthrough(),
  observedComparisons: z.object({
    positivePersistIntervalCategoryCount: z.number().int(),
    attenuatedPointEstimateCategoryCount: z.number().int(),
    learnedModelBeatsPopularityCategoryCount: z.number().int(),
    allQuarantineInvariant: z.boolean(),
    allLeaveOneOutPositive: z.boolean()
  })
});

const DelegatedActivationSummarySchema = z.object({
  schemaVersion: z.literal("delegated-activation-timing.v1"),
  evidenceStatus: z.string(),
  design: z.object({
    categories: z.array(z.string()).length(4),
    taskCount: z.number().int().positive(),
    taskCountPerCategory: z.number().int().positive(),
    modelSeeds: z.array(z.number().int()).nonempty(),
    model: z.string(),
    agent: z.string(),
    agentActions: z.array(z.string()).nonempty(),
    lifecycleConditions: z.array(z.string()).length(2),
    timepoints: z.array(z.string()).length(4),
    pairedDefinition: z.string(),
    taskLocalContract: z.string()
  }).passthrough(),
  categories: z.array(z.object({
    slug: z.string(),
    label: z.string(),
    taskCount: z.number().int().positive(),
    selectedTaskCount: z.number().int().nonnegative(),
    abandonedTaskCount: z.number().int().nonnegative(),
    taskLocalRecommendationUseRate: z.number().min(0).max(1),
    meanSelectedUtility: z.number().min(0).max(1),
    noLocalMeanSelectedUtility: z.number().min(0).max(1),
    maxStagedMinusImmediateTaskUtility: z.number(),
    maxOutcomeResolvedDisplacement: z.number().nonnegative(),
    maxNextTaskDisplacement: z.number().nonnegative(),
    uncertainty: z.object({
      provisionalExposureAuc: EstimateIntervalSchema,
      inProgressDisplacementAt10: EstimateIntervalSchema,
      inProgressExcessTargetSlotsAt10: EstimateIntervalSchema
    })
  }).passthrough()).length(4),
  pooledUncertainty: z.object({
    provisionalExposureAuc: EstimateIntervalSchema,
    inProgressDisplacementAt10: EstimateIntervalSchema,
    inProgressExcessTargetSlotsAt10: EstimateIntervalSchema
  }),
  observedComparisons: z.object({
    positiveInProgressIntervalCategoryCount: z.number().int(),
    allResolvedFinalStatesMatched: z.boolean(),
    allNextTaskStatesMatched: z.boolean(),
    taskUtilityIdenticalAcrossLifecycleArms: z.boolean(),
    allAgentsConsumedTaskLocalRecommendations: z.boolean()
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const OnlineV2IntervalSchema = z.object({
  estimate: z.number(),
  lower95: z.number(),
  upper95: z.number()
});
const OnlineV2BreakdownSchema = z.object({
  pairCount: z.number().int().positive(),
  fixedT1Displacement: z.number().min(0).max(1),
  freeT1Displacement: z.number().min(0).max(1),
  freeTraceDivergenceRate: z.number().min(0).max(1),
  heldMinusImmediateDecisionAccuracy: z.number(),
  heldMinusImmediateSelectedUtility: z.number()
});
const OnlineStorefrontV2SummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-v2-summary.v1"),
  protocolSha256: z.string().length(64),
  evidenceStatus: z.string(),
  design: z.object({
    taskCount: z.number().int().positive(),
    tasksPerCategory: z.number().int().positive(),
    categoryCounts: z.array(z.object({
      category: z.string(),
      taskCount: z.number().int().positive()
    })).length(4),
    modelSeeds: z.array(z.number().int()).length(3),
    agentConfigurations: z.array(z.string()).length(2),
    conditions: z.array(z.string()).length(4),
    modes: z.array(z.string()).length(2),
    timepoints: z.array(z.string()).length(4),
    conditionRowCount: z.number().int().positive(),
    pairedContrastRowCount: z.number().int().positive()
  }).passthrough(),
  confirmatory: z.object({
    fixedTrace: z.object({
      primaryT1ImmediateHeldDisplacement: OnlineV2IntervalSchema,
      t2ImmediateHeldDisplacement: OnlineV2IntervalSchema,
      t3ImmediateHeldDisplacement: OnlineV2IntervalSchema
    }),
    freeRunning: z.object({
      t1ImmediateHeldDisplacement: OnlineV2IntervalSchema,
      traceDivergenceRate: OnlineV2IntervalSchema,
      heldMinusImmediateDecisionAccuracy: OnlineV2IntervalSchema,
      heldMinusImmediateSelectedUtility: OnlineV2IntervalSchema
    }),
    gates: z.record(z.string(), z.boolean())
  }),
  descriptive: z.object({
    byAgentConfig: z.record(z.string(), OnlineV2BreakdownSchema),
    byCategory: z.record(z.string(), OnlineV2BreakdownSchema)
  }),
  failuresAndNegativeCases: z.record(z.string(), z.number().int().nonnegative()),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const MiMoLlmPilotSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-llm-pilot-summary.v1"),
  design: z.object({
    taskCount: z.number().int().positive(),
    trajectoryCount: z.number().int().positive(),
    pairedContrastCount: z.number().int().positive(),
    model: z.string()
  }).passthrough(),
  api: z.object({
    validActionRate: z.number().min(0).max(1),
    observedCostRmbAtPublishedRates: z.number().nonnegative()
  }).passthrough(),
  descriptive: z.object({
    meanT1Displacement: z.number().min(0).max(1),
    traceDivergenceRate: z.number().min(0).max(1),
    decisionAccuracy: z.number().min(0).max(1)
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const CrossLlmPilotSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-cross-llm-pilot-summary.v1"),
  design: z.object({
    provider: z.string(),
    model: z.string(),
    taskCount: z.number().int().positive(),
    trajectoryCount: z.number().int().positive(),
    pairedContrastCount: z.number().int().positive()
  }).passthrough(),
  api: z.object({
    validActionRate: z.number().min(0).max(1),
    observedCostAtPublishedRates: z.number().nonnegative(),
    currency: z.string(),
    systemFingerprints: z.array(z.string())
  }).passthrough(),
  descriptive: z.object({
    meanExposureT1: z.number().min(0).max(1),
    exposureTraceDivergenceRate: z.number().min(0).max(1),
    shamTraceDivergenceRate: z.number().min(0).max(1),
    persistentBehavioralFeedbackRate: z.number().min(0).max(1),
    shamPersistentBehavioralFeedbackRate: z.number().min(0).max(1),
    adjustedPersistentFeedback: z.number().min(-1).max(1),
    heldMinusImmediateDecisionAccuracy: z.number().min(-1).max(1),
    heldMinusImmediateSelectedUtility: z.number().min(-1).max(1)
  }),
  claims: z.object({
    observed: z.array(z.string()),
    notEstablished: z.array(z.string())
  })
});

const DecodingDoseCellSchema = z.object({
  temperature: z.number().min(0).max(1),
  exposureTraceDivergenceRate: z.number().min(0).max(1),
  shamTraceDivergenceRate: z.number().min(0).max(1),
  adjustedTraceDivergence: z.number().min(-1).max(1),
  persistentBehavioralFeedbackRate: z.number().min(0).max(1),
  shamPersistentBehavioralFeedbackRate: z.number().min(0).max(1),
  adjustedPersistentFeedback: z.number().min(-1).max(1),
  meanExposureT1: z.number().min(0).max(1),
  cleanExposureCell: z.boolean()
}).passthrough();

const DecodingDoseSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-decoding-dose-response-summary.v1"),
  temperatures: z.array(z.number()),
  providers: z.object({
    mimo: z.record(z.string(), DecodingDoseCellSchema),
    deepseek: z.record(z.string(), DecodingDoseCellSchema)
  }),
  decision: z.string(),
  claimBoundary: z.string()
});

const ForcedInspectionProviderSchema = z.object({
  model: z.string(),
  taskCount: z.number().int().positive(),
  pairedContrastCount: z.number().int().positive(),
  wholeTraceDivergenceRate: z.number().min(0).max(1),
  wholePersistentFeedbackRate: z.number().min(0).max(1),
  resolvedActionDivergenceCount: z.number().int().nonnegative(),
  shamResolvedActionDivergenceCount: z.number().int().nonnegative(),
  persistentResolvedActionFeedbackCount: z.number().int().nonnegative(),
  shamPersistentResolvedActionFeedbackCount: z.number().int().nonnegative(),
  adjustedPersistentResolvedActionFeedback: z.number().min(-1).max(1),
  shamPersistentResolvedActionRate: z.number().min(0).max(1)
}).passthrough();

const ForcedInspectionSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-forced-inspection-summary.v1"),
  providers: z.object({
    mimo: ForcedInspectionProviderSchema,
    deepseek: ForcedInspectionProviderSchema
  }),
  decision: z.string(),
  claimBoundary: z.string()
});

const CandidateMarginProviderSchema = z.object({
  taskCount: z.number().int().positive(),
  analyzableCount: z.number().int().nonnegative(),
  analyzableRate: z.number().min(0).max(1),
  persistentResolvedActionEventCount: z.number().int().nonnegative(),
  analyzablePersistentResolvedActionEventCount: z.number().int().nonnegative(),
  shamPersistentResolvedActionEventCount: z.number().int().nonnegative(),
  marginAuc: z.number().min(0).max(1).nullable(),
  oneSidedPermutationP: z.number().min(0).max(1).nullable(),
  zeroMarginRateAmongAnalyzable: z.number().min(0).max(1).nullable(),
  candidateSetDifferentRate: z.number().min(0).max(1),
  bestEligibleCandidateDifferentRate: z.number().min(0).max(1)
}).passthrough();

const CandidateMarginSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-candidate-margin-summary.v1"),
  historicalStateSource: z.string(),
  providers: z.object({
    mimo: CandidateMarginProviderSchema,
    deepseek: CandidateMarginProviderSchema
  }),
  decision: z.string(),
  dataQualityBoundary: z.string(),
  claimBoundary: z.string()
});

const DeterministicRepairProviderSchema = z.object({
  taskCount: z.number().int().positive(),
  persistentResolvedActionEventCount: z.number().int().nonnegative(),
  persistentResolvedActionEventRate: z.number().min(0).max(1),
  shamPersistentResolvedActionEventCount: z.number().int().nonnegative(),
  shamPersistentResolvedActionEventRate: z.number().min(0).max(1),
  shamAdjustedEventRate: z.number().min(-1).max(1),
  mechanismAuc: z.number().min(0).max(1),
  oneSidedExactPermutationP: z.number().min(0).max(1),
  eventCountInBottomTertile: z.number().int().nonnegative(),
  eventFractionInBottomTertile: z.number().min(0).max(1),
  eventCountOnOpportunityChangedTasks: z.number().int().nonnegative(),
  eventCountOutsideOpportunityChangedTasks: z.number().int().nonnegative(),
  actualStateAudit: z.object({
    componentCount: z.number().int().positive(),
    predictorMatchCount: z.number().int().nonnegative(),
    resolvedActionMatchCount: z.number().int().nonnegative(),
    shamResolvedActionMatchCount: z.number().int().nonnegative()
  }).passthrough()
}).passthrough();

const DeterministicRepairSummarySchema = z.object({
  schemaVersion: z.literal(
    "online-storefront-deterministic-repair-pilot-evaluation-summary.v1"
  ),
  providers: z.object({
    mimo: DeterministicRepairProviderSchema,
    deepseek: DeterministicRepairProviderSchema
  }),
  gates: z.record(z.string(), z.boolean()),
  decision: z.string(),
  claimBoundary: z.string()
}).passthrough();

export type MiMoLlmPilotSummary = z.infer<typeof MiMoLlmPilotSummarySchema>;
export type CrossLlmPilotSummary = z.infer<typeof CrossLlmPilotSummarySchema>;
export type DecodingDoseSummary = z.infer<typeof DecodingDoseSummarySchema>;
export type ForcedInspectionSummary = z.infer<typeof ForcedInspectionSummarySchema>;
export type CandidateMarginSummary = z.infer<typeof CandidateMarginSummarySchema>;
export type DeterministicRepairSummary = z.infer<
  typeof DeterministicRepairSummarySchema
>;

const NaturalActionEstimateSchema = z.object({
  estimate: z.number(),
  ci95: z.tuple([z.number(), z.number()])
});

const NaturalActionProviderSchema = z.object({
  provider: z.string(),
  taskCount: z.number().int().positive(),
  taskModelUnitCount: z.number().int().positive(),
  estimates: z.object({
    exposureManipulationRate: NaturalActionEstimateSchema,
    naturalOpportunityRate: NaturalActionEstimateSchema,
    overallActionDistributionDistance: NaturalActionEstimateSchema,
    conditionalActionDistributionDistance: NaturalActionEstimateSchema,
    sameLayoutDivergence: NaturalActionEstimateSchema,
    immediateWithinDivergence: NaturalActionEstimateSchema,
    heldWithinDivergence: NaturalActionEstimateSchema,
    completeCaseQualityDifference: NaturalActionEstimateSchema,
    worstCaseQualityDifference: NaturalActionEstimateSchema,
    protocolFailureRate: NaturalActionEstimateSchema
  }),
  runApi: z.object({
    requestCount: z.number().int().nonnegative(),
    validActionCount: z.number().int().nonnegative(),
    terminalFailureCount: z.number().int().nonnegative(),
    observedCostAtPublishedRates: z.number().nonnegative(),
    currency: z.string()
  }).passthrough()
});

const NaturalActionEvaluationSchema = z.object({
  schemaVersion: z.literal("online-storefront-natural-action-evaluation.v3"),
  protocolSha256: z.string(),
  providers: z.object({
    mimo: NaturalActionProviderSchema,
    deepseek: NaturalActionProviderSchema
  }),
  gates: z.record(z.string(), z.boolean()),
  claimDecision: z.string(),
  withdrawnAnalyses: z.array(z.string()),
  claimBoundary: z.string()
});

export type NaturalActionEvaluation = z.infer<
  typeof NaturalActionEvaluationSchema
>;

const InstrumentModeEstimateSchema = z.object({
  categoricalEnergyDistance: NaturalActionEstimateSchema,
  matchedCrossArmActionChangeRate: NaturalActionEstimateSchema,
  matchedCrossArmActionChangeCount: z.number().int().nonnegative()
}).passthrough();

const InstrumentProviderSchema = z.object({
  provider: z.string(),
  model: z.string(),
  taskModelUnitCount: z.number().int().positive(),
  estimates: z.object({
    "rank-only": InstrumentModeEstimateSchema,
    "inspection-only": InstrumentModeEstimateSchema,
    "masked-control": InstrumentModeEstimateSchema,
    "served-order": InstrumentModeEstimateSchema
  }),
  runApi: z.object({
    validActionCount: z.number().int().nonnegative(),
    terminalFailureCount: z.number().int().nonnegative(),
    observedCostAtPublishedRates: z.number().nonnegative(),
    currency: z.string()
  }).passthrough()
});

const InstrumentAblationEvaluationSchema = z.object({
  schemaVersion: z.literal("online-storefront-instrument-ablation-evaluation.v1"),
  protocolSha256: z.string(),
  providers: z.object({
    deepseek: InstrumentProviderSchema,
    mimo: InstrumentProviderSchema
  }),
  gates: z.record(z.string(), z.boolean()),
  decision: z.string(),
  claimBoundary: z.string(),
  remainingExternalValidityRequirement: z.string()
});

export type InstrumentAblationEvaluation = z.infer<
  typeof InstrumentAblationEvaluationSchema
>;

const FeedbackBridgeModeSchema = z.object({
  unitCount: z.number().int().positive(),
  slateEnergyDistance: NaturalActionEstimateSchema,
  meanMatchedSlateDisplacement: NaturalActionEstimateSchema,
  anyMatchedSlateChangeRate: NaturalActionEstimateSchema,
  matchedTopItemChangeRate: NaturalActionEstimateSchema,
  selectedActionChangeRate: NaturalActionEstimateSchema
}).passthrough();

const FeedbackBridgeSummarySchema = z.object({
  schemaVersion: z.literal("online-storefront-feedback-bridge-summary.v1"),
  evidenceStatus: z.literal("feedback-exposure-gate-passed"),
  design: z.object({
    taskCount: z.number().int().positive(),
    taskModelUnitCount: z.number().int().positive(),
    publicRowCount: z.number().int().positive(),
    providerCalls: z.number().int().nonnegative()
  }).passthrough(),
  groups: z.object({
    deepseek: z.object({
      "served-order": FeedbackBridgeModeSchema,
      "masked-control": FeedbackBridgeModeSchema
    }),
    mimo: z.object({
      "served-order": FeedbackBridgeModeSchema,
      "masked-control": FeedbackBridgeModeSchema
    })
  }),
  gates: z.record(z.string(), z.boolean())
}).passthrough();

const FeedbackActionModeSchema = z.object({
  unitCount: z.number().int().positive(),
  categoricalEnergyDistance: NaturalActionEstimateSchema,
  matchedActionChangeRate: NaturalActionEstimateSchema,
  meanDecisionQuality: NaturalActionEstimateSchema,
  abandonRate: NaturalActionEstimateSchema,
  protocolFailureRate: NaturalActionEstimateSchema
}).passthrough();

const FeedbackActionEvaluationSchema = z.object({
  schemaVersion: z.literal("online-storefront-feedback-action-evaluation.v1"),
  evidenceStatus: z.literal("one-step-feedback-gate-passed"),
  results: z.object({
    "primary-feedback": FeedbackActionModeSchema,
    "identical-control": FeedbackActionModeSchema
  }),
  gates: z.record(z.string(), z.boolean()),
  claimBoundary: z.string(),
  interpretation: z.string()
}).passthrough();

export type FeedbackBridgeSummary = z.infer<typeof FeedbackBridgeSummarySchema>;
export type FeedbackActionEvaluation = z.infer<
  typeof FeedbackActionEvaluationSchema
>;

export type CrossTaskExposureSummary = z.infer<
  typeof CrossTaskExposureSummarySchema
>;

interface ProjectDataState {
  summary: ProjectSummary | null;
  webarena: WebArenaSummary | null;
  webarenaFailure: WebArenaFailureSummary | null;
  amazonField: AmazonFieldSummary | null;
  amazonControlled: AmazonControlledSummary | null;
  crossTaskExposure: CrossTaskExposureSummary | null;
  crossTaskSensitivity: CrossTaskSensitivitySummary | null;
  externalValidity: ExternalValiditySummary | null;
  amazonSasrec: AmazonSasrecSummary | null;
  amazonCrossCategory: AmazonCrossCategorySummary | null;
  delegatedActivation: DelegatedActivationSummary | null;
  onlineStorefrontV2: OnlineStorefrontV2Summary | null;
  mimoLlmPilot: MiMoLlmPilotSummary | null;
  mimoMatchedLlmPilot: CrossLlmPilotSummary | null;
  deepseekLlmPilot: CrossLlmPilotSummary | null;
  decodingDoseResponse: DecodingDoseSummary | null;
  forcedInspection: ForcedInspectionSummary | null;
  candidateMargin: CandidateMarginSummary | null;
  deterministicRepairPilot: DeterministicRepairSummary | null;
  naturalActionEvaluation: NaturalActionEvaluation | null;
  instrumentAblationEvaluation: InstrumentAblationEvaluation | null;
  feedbackBridgeSummary: FeedbackBridgeSummary | null;
  feedbackActionEvaluation: FeedbackActionEvaluation | null;
  catalog: Catalog | null;
  error: string | null;
  loading: boolean;
}

export function useProjectData(): ProjectDataState {
  const [state, setState] = useState<ProjectDataState>({
    summary: null,
    webarena: null,
    webarenaFailure: null,
    amazonField: null,
    amazonControlled: null,
    crossTaskExposure: null,
    crossTaskSensitivity: null,
    externalValidity: null,
    amazonSasrec: null,
    amazonCrossCategory: null,
    delegatedActivation: null,
    onlineStorefrontV2: null,
    mimoLlmPilot: null,
    mimoMatchedLlmPilot: null,
    deepseekLlmPilot: null,
    decodingDoseResponse: null,
    forcedInspection: null,
    candidateMargin: null,
    deterministicRepairPilot: null,
    naturalActionEvaluation: null,
    instrumentAblationEvaluation: null,
    feedbackBridgeSummary: null,
    feedbackActionEvaluation: null,
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
      }),
      fetch(`${base}results/webarena-pilot/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load WebArena replay.");
          return WebArenaSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/webarena-failure/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load WebArena failure replay.");
          }
          return WebArenaFailureSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/amazon-field-probe/v1/field-summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load Amazon field probe.");
          return AmazonFieldSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/amazon-field-probe/v1/controlled-summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load Amazon controlled replay.");
          }
          return AmazonControlledSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/cross-task-exposure/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load cross-task exposure experiment.");
          }
          return CrossTaskExposureSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/cross-task-sensitivity/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load cross-task sensitivity experiment.");
          }
          return CrossTaskSensitivitySummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/external-validity/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load external-validity experiment.");
          }
          return ExternalValiditySummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/amazon-sasrec/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load Amazon SASRec experiment.");
          }
          return AmazonSasrecSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/amazon-cross-category/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load Amazon cross-category experiment.");
          }
          return AmazonCrossCategorySummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/delegated-activation/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load delegated-activation experiment.");
          }
          return DelegatedActivationSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-v2/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load online storefront v2 experiment.");
          }
          return OnlineStorefrontV2SummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-llm-pilot/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load MiMo LLM pilot.");
          return MiMoLlmPilotSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-cross-llm-pilot/v1/mimo/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load matched MiMo LLM pilot.");
          return CrossLlmPilotSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-cross-llm-pilot/v1/deepseek/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load DeepSeek LLM pilot.");
          return CrossLlmPilotSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-decoding-sensitivity/v1/dose-response-summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load decoding dose response.");
          return DecodingDoseSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-forced-inspection/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load forced-inspection probe.");
          return ForcedInspectionSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-candidate-margin/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) throw new Error("Could not load candidate-margin audit.");
          return CandidateMarginSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-deterministic-repair-pilot/v1/evaluation/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load deterministic repair pilot.");
          }
          return DeterministicRepairSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-natural-action-v2/v1/evaluation.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load natural-frame action study.");
          }
          return NaturalActionEvaluationSchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-instrument-ablation-confirmatory/v1/evaluation.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load confirmatory instrument ablation.");
          }
          return InstrumentAblationEvaluationSchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-feedback-bridge/v1/summary.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load the feedback-exposure bridge.");
          }
          return FeedbackBridgeSummarySchema.parse(await response.json());
        }
      ),
      fetch(`${base}results/online-storefront-feedback-action/v1/evaluation.json`).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("Could not load the downstream feedback action study.");
          }
          return FeedbackActionEvaluationSchema.parse(await response.json());
        }
      )
    ])
      .then(
        ([
          summary,
          catalog,
          webarena,
          webarenaFailure,
          amazonField,
          amazonControlled,
          crossTaskExposure,
          crossTaskSensitivity,
          externalValidity,
          amazonSasrec,
          amazonCrossCategory,
          delegatedActivation,
          onlineStorefrontV2,
          mimoLlmPilot,
          mimoMatchedLlmPilot,
          deepseekLlmPilot,
          decodingDoseResponse,
          forcedInspection,
          candidateMargin,
          deterministicRepairPilot,
          naturalActionEvaluation,
          instrumentAblationEvaluation,
          feedbackBridgeSummary,
          feedbackActionEvaluation
        ]) => {
        if (!cancelled) {
          setState({
            summary,
            webarena,
            webarenaFailure,
            amazonField,
            amazonControlled,
            crossTaskExposure,
            crossTaskSensitivity,
            externalValidity,
            amazonSasrec,
            amazonCrossCategory,
            delegatedActivation,
            onlineStorefrontV2,
            mimoLlmPilot,
            mimoMatchedLlmPilot,
            deepseekLlmPilot,
            decodingDoseResponse,
            forcedInspection,
            candidateMargin,
            deterministicRepairPilot,
            naturalActionEvaluation,
            instrumentAblationEvaluation,
            feedbackBridgeSummary,
            feedbackActionEvaluation,
            catalog,
            error: null,
            loading: false
          });
        }
        }
      )
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            summary: null,
            webarena: null,
            webarenaFailure: null,
            amazonField: null,
            amazonControlled: null,
            crossTaskExposure: null,
            crossTaskSensitivity: null,
            externalValidity: null,
            amazonSasrec: null,
            amazonCrossCategory: null,
            delegatedActivation: null,
            onlineStorefrontV2: null,
            mimoLlmPilot: null,
            mimoMatchedLlmPilot: null,
            deepseekLlmPilot: null,
            decodingDoseResponse: null,
            forcedInspection: null,
            candidateMargin: null,
            deterministicRepairPilot: null,
            naturalActionEvaluation: null,
            instrumentAblationEvaluation: null,
            feedbackBridgeSummary: null,
            feedbackActionEvaluation: null,
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
