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
import type { UtilityIntegrityDatum } from "./UtilityIntegrityTradeoff";

export function profileDivergenceFromReplay(
  replay: RepresentativeReplay,
  conditions: Array<keyof RepresentativeReplay["worlds"]> = [
    "actor-blind",
    "provenance-aware",
    "approval-gated"
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
    futureRecommendationRegret: row.futureRecommendationRegret,
    taskUtility: row.taskUtility,
    attributionErrorRate: row.attributionErrorRate
  }));
}

export function utilityIntegrityFromMetrics(
  rows: readonly MetricSummary[],
  studyLabel = "Study"
): UtilityIntegrityDatum[] {
  return rows.map((row) => ({
    id: `${studyLabel}-${row.condition}`,
    label: row.condition,
    condition: row.condition,
    taskUtility: row.taskUtility,
    profileContamination: row.profileContamination,
    interactionCost: row.interactionCost,
    runCount: row.runCount,
    group: studyLabel
  }));
}

export function utilityIntegrityFromCells(
  rows: readonly CellSummary[],
  studyLabel = "Study"
): UtilityIntegrityDatum[] {
  return rows.map((row) => ({
    id: `${studyLabel}-${row.condition}-${row.scenarioId}-${row.policy}`,
    label: `${row.scenarioLabel} · ${row.policy}`,
    condition: row.condition,
    taskUtility: row.taskUtility,
    profileContamination: row.profileContamination,
    interactionCost: row.interactionCost,
    runCount: row.runCount,
    group: studyLabel
  }));
}

