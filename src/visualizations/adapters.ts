import type {
  CellSummary,
  MetricSummary,
  RepresentativeReplay,
  SensitivitySummary
} from "../data";
import { normalizedDistance } from "../sim/vector";
import type { AttributionMatrixCell } from "./AttributionMatrix";
import type {
  ProfileDivergenceSeries
} from "./ProfileDivergenceChart";
import type { SensitivityDatum } from "./SensitivityHeatmap";

export function profileDivergenceFromReplay(
  replay: RepresentativeReplay,
  conditions: Array<keyof RepresentativeReplay["worlds"]> = [
    "actor-blind",
    "matched-attenuation",
    "provenance-aware",
    "scope-gated",
    "no-update"
  ]
): ProfileDivergenceSeries[] {
  return conditions.map((condition) => ({
    condition,
    points: replay.worlds[condition].profileHistory.map((point) => ({
      step: point.step,
      value: normalizedDistance(
        point.profile,
        replay.scenario.principalReference
      )
    }))
  }));
}

export function traceHandlingMatrix(
  rows: readonly MetricSummary[]
): AttributionMatrixCell[] {
  const diagnostics: Array<{
    row: string;
    field:
      | "actorRecordingErrorRate"
      | "intentLabelErrorRate"
      | "provenanceUseRate"
      | "persistentUpdateRate";
  }> = [
    { row: "Actor-recording error", field: "actorRecordingErrorRate" },
    { row: "Intent-label error", field: "intentLabelErrorRate" },
    { row: "Event provenance used", field: "provenanceUseRate" },
    { row: "Events persisted", field: "persistentUpdateRate" }
  ];

  return diagnostics.flatMap(({ row, field }) =>
    rows.map((summary) => ({
      row,
      column: summary.condition,
      value: summary[field],
      runCount: summary.runCount
    }))
  );
}

export function attributionMatrixFromCells(
  cells: readonly CellSummary[],
  options: {
    includePolicyInRow?: boolean;
  } = {}
): AttributionMatrixCell[] {
  const groups = new Map<
    string,
    {
      row: string;
      column: string;
      weightedValue: number;
      runCount: number;
    }
  >();

  for (const cell of cells) {
    const row = options.includePolicyInRow
      ? `${cell.scenarioLabel} · ${cell.policy}`
      : cell.scenarioLabel;
    const key = `${row}\u0000${cell.condition}`;
    const current = groups.get(key) ?? {
      row,
      column: cell.condition,
      weightedValue: 0,
      runCount: 0
    };
    current.weightedValue += cell.attributionErrorRate * cell.runCount;
    current.runCount += cell.runCount;
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => ({
    row: group.row,
    column: group.column,
    value:
      group.runCount === 0 ? 0 : group.weightedValue / group.runCount,
    runCount: group.runCount
  }));
}

export function sensitivityData(
  rows: readonly SensitivitySummary[]
): SensitivityDatum[] {
  return rows.map((row) => ({
    condition: row.condition,
    labelNoise: row.labelNoise,
    learningRate: row.learningRate,
    runCount: row.runCount,
    profileContamination: row.profileContamination,
    profileContaminationP10: row.profileContaminationP10,
    profileContaminationP90: row.profileContaminationP90,
    futureRecommendationRegret: row.futureRecommendationRegret,
    futureRecommendationRegretP10: row.futureRecommendationRegretP10,
    futureRecommendationRegretP90: row.futureRecommendationRegretP90,
    taskUtility: row.taskUtility,
    taskUtilityP10: row.taskUtilityP10,
    taskUtilityP90: row.taskUtilityP90,
    attributionErrorRate: row.attributionErrorRate,
    attributionErrorRateP10: row.attributionErrorRateP10,
    attributionErrorRateP90: row.attributionErrorRateP90
  }));
}
