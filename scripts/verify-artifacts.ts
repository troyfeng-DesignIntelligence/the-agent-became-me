import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import {
  AXES,
  BehaviorTraceSchema,
  CatalogSchema,
  RunMetricsSchema,
  ScenarioSchema,
  UpdateReceiptSchema,
  VectorSchema,
  type BehaviorTrace,
  type Catalog,
  type ProfileVector,
  type Scenario,
  type UpdateReceipt
} from "../src/domain/schema";
import { runExperiment } from "../src/experiments/run";

type JsonRecord = Record<string, unknown>;

interface BaselineView {
  raw: JsonRecord;
  design: JsonRecord;
  catalog: JsonRecord;
  generatedAt: string;
  protocolVersion: string;
  studyA: JsonRecord[];
  studyB: JsonRecord[];
  studyC: JsonRecord[] | undefined;
  sensitivity: JsonRecord[];
  representative: JsonRecord;
}

interface DesignView {
  scenarioCount: number;
  policies: string[];
  seedsPerCell: number;
  studyAConditions: string[];
  studyBConditions: string[];
  baselineLabelNoise: number;
  baselineLearningRate: number;
  studyCScenarioId: string | undefined;
}

interface ProfileHistoryPoint {
  step: number;
  profile: ProfileVector;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(
  root,
  "public/data/open-food-facts.snapshot.json"
);
const baselinePath = resolve(root, "public/results/v1/baseline.json");
const summaryPath = resolve(root, "public/results/v1/summary.json");
const rowKeyFields = [
  "study",
  "condition",
  "scenarioId",
  "policy",
  "seed",
  "labelNoise",
  "learningRate"
] as const;
const maximumReportedFailures = 80;
const failures: string[] = [];
let omittedFailureCount = 0;

function fail(message: string): void {
  if (failures.length < maximumReportedFailures) {
    failures.push(message);
  } else {
    omittedFailureCount += 1;
  }
}

function check(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as JsonRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return value;
}

function asRecordArray(value: unknown, label: string): JsonRecord[] {
  return asArray(value, label).map((entry, index) =>
    asRecord(entry, `${label}[${index}]`)
  );
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function stringArray(
  record: JsonRecord,
  key: string,
  label: string
): string[] {
  return asArray(record[key], `${label}.${key}`).map((value, index) =>
    asString(value, `${label}.${key}[${index}]`)
  );
}

async function readJson(path: string, label: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function describeIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>
): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function verifyUniqueStrings(values: string[], label: string): void {
  const duplicates = duplicateValues(values);
  check(
    duplicates.length === 0,
    `${label} contains duplicate values: ${duplicates.join(", ")}.`
  );
}

function valuesAt(
  rows: JsonRecord[],
  field: string,
  label: string
): string[] {
  const values: string[] = [];
  rows.forEach((row, index) => {
    const value = row[field];
    if (typeof value !== "string") {
      fail(`${label}[${index}].${field} must be a string.`);
    } else {
      values.push(value);
    }
  });
  return values;
}

function scalarRowKey(
  row: JsonRecord,
  fields: readonly string[],
  label: string
): string | undefined {
  const values: Array<string | number> = [];
  for (const field of fields) {
    const value = row[field];
    if (typeof value !== "string" && typeof value !== "number") {
      fail(`${label}.${field} must be a string or number.`);
      return undefined;
    }
    values.push(value);
  }
  return JSON.stringify(values);
}

function verifyUniqueRowKeys(
  rows: JsonRecord[],
  label: string,
  fields: readonly string[] = rowKeyFields
): void {
  const firstIndexByKey = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = scalarRowKey(row, fields, `${label}[${index}]`);
    if (key === undefined) return;
    const firstIndex = firstIndexByKey.get(key);
    if (firstIndex !== undefined) {
      fail(
        `${label} has a duplicate row key at indexes ${firstIndex} and ${index}: ${key}.`
      );
    } else {
      firstIndexByKey.set(key, index);
    }
  });
}

function sameStringSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value) => expected.includes(value)) &&
    expected.every((value) => actual.includes(value))
  );
}

function rowNumber(
  row: JsonRecord,
  field: string,
  label: string
): number | undefined {
  const value = row[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label}.${field} must be a finite number.`);
    return undefined;
  }
  return value;
}

function verifyStudyRows(
  rows: JsonRecord[],
  label: string,
  expectedStudy: "A" | "B" | "C",
  conditions: string[],
  scenarioIds: string[],
  design: DesignView
): void {
  const expectedCount =
    conditions.length *
    scenarioIds.length *
    design.policies.length *
    design.seedsPerCell;
  check(
    rows.length === expectedCount,
    `${label} has ${rows.length} rows; design dimensions require exactly ${expectedCount} (${conditions.length} conditions x ${scenarioIds.length} scenarios x ${design.policies.length} policies x ${design.seedsPerCell} seeds).`
  );
  verifyUniqueRowKeys(rows, label);

  const cellCounts = new Map<string, number>();
  rows.forEach((row, index) => {
    const rowLabel = `${label}[${index}]`;
    check(
      row.study === expectedStudy,
      `${rowLabel}.study is ${String(row.study)}; expected ${expectedStudy}.`
    );

    const condition = row.condition;
    const scenarioId = row.scenarioId;
    const policy = row.policy;
    if (typeof condition !== "string") {
      fail(`${rowLabel}.condition must be a string.`);
    } else {
      check(
        conditions.includes(condition),
        `${rowLabel}.condition "${condition}" is not declared by the design.`
      );
    }
    if (typeof scenarioId !== "string") {
      fail(`${rowLabel}.scenarioId must be a string.`);
    } else {
      check(
        scenarioIds.includes(scenarioId),
        `${rowLabel}.scenarioId "${scenarioId}" is outside the design scenarios.`
      );
    }
    if (typeof policy !== "string") {
      fail(`${rowLabel}.policy must be a string.`);
    } else {
      check(
        design.policies.includes(policy),
        `${rowLabel}.policy "${policy}" is not declared by the design.`
      );
    }

    const seed = rowNumber(row, "seed", rowLabel);
    if (seed !== undefined) {
      check(
        Number.isInteger(seed) &&
          seed >= 1 &&
          seed <= design.seedsPerCell,
        `${rowLabel}.seed is ${seed}; expected an integer from 1 through ${design.seedsPerCell}.`
      );
    }
    const labelNoise = rowNumber(row, "labelNoise", rowLabel);
    if (labelNoise !== undefined) {
      check(
        labelNoise === design.baselineLabelNoise,
        `${rowLabel}.labelNoise is ${labelNoise}; baseline design declares ${design.baselineLabelNoise}.`
      );
    }
    const learningRate = rowNumber(row, "learningRate", rowLabel);
    if (learningRate !== undefined) {
      check(
        learningRate === design.baselineLearningRate,
        `${rowLabel}.learningRate is ${learningRate}; baseline design declares ${design.baselineLearningRate}.`
      );
    }

    if (
      typeof condition === "string" &&
      typeof scenarioId === "string" &&
      typeof policy === "string"
    ) {
      const key = JSON.stringify([condition, scenarioId, policy]);
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }
  });

  for (const condition of conditions) {
    for (const scenarioId of scenarioIds) {
      for (const policy of design.policies) {
        const key = JSON.stringify([condition, scenarioId, policy]);
        const actual = cellCounts.get(key) ?? 0;
        check(
          actual === design.seedsPerCell,
          `${label} cell ${condition}/${scenarioId}/${policy} has ${actual} rows; expected ${design.seedsPerCell}.`
        );
      }
    }
  }
}

function verifyStudyATraceFreezeProxy(
  rows: JsonRecord[],
  conditions: string[]
): void {
  const groups = new Map<string, JsonRecord[]>();
  rows.forEach((row, index) => {
    const key = scalarRowKey(
      row,
      ["scenarioId", "policy", "seed"],
      `baseline.studyA[${index}]`
    );
    if (key === undefined) return;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });

  for (const [key, group] of groups) {
    check(
      group.length === conditions.length,
      `Study A tuple ${key} has ${group.length} condition rows; expected ${conditions.length}.`
    );
    const groupConditions = group
      .map((row) => row.condition)
      .filter((value): value is string => typeof value === "string");
    check(
      sameStringSet([...new Set(groupConditions)], conditions),
      `Study A tuple ${key} does not contain exactly the declared conditions.`
    );

    // These metrics are functions of the frozen behavior trace, not of the
    // replay updater. Equality is an artifact-level proxy for trace reuse.
    for (const metric of ["taskUtility", "constraintViolations"] as const) {
      const values = group.map((row) => row[metric]);
      check(
        values.every((value) => Object.is(value, values[0])),
        `Study A tuple ${key} has condition-dependent ${metric}; this indicates that the supposedly frozen behavior trace may have drifted across replay worlds.`
      );
    }
  }
}

function verifySensitivityRows(
  rows: JsonRecord[],
  scenarioIds: string[],
  design: DesignView
): {
  conditions: string[];
  labelNoiseLevels: number[];
  learningRates: number[];
  seedsPerCell: number;
} {
  const label = "baseline.sensitivity";
  verifyUniqueRowKeys(rows, label);
  const conditions = [
    ...new Set(valuesAt(rows, "condition", label))
  ].sort();
  const labelNoiseLevels = [
    ...new Set(
      rows
        .map((row, index) => rowNumber(row, "labelNoise", `${label}[${index}]`))
        .filter((value): value is number => value !== undefined)
    )
  ].sort((left, right) => left - right);
  const learningRates = [
    ...new Set(
      rows
        .map((row, index) =>
          rowNumber(row, "learningRate", `${label}[${index}]`)
        )
        .filter((value): value is number => value !== undefined)
    )
  ].sort((left, right) => left - right);
  const seedsPerCell = Math.min(20, design.seedsPerCell);

  check(conditions.length > 0, `${label} has no condition dimension values.`);
  check(
    labelNoiseLevels.length > 0,
    `${label} has no label-noise dimension values.`
  );
  check(
    learningRates.length > 0,
    `${label} has no learning-rate dimension values.`
  );
  for (const condition of conditions) {
    check(
      design.studyAConditions.includes(condition),
      `${label} condition "${condition}" is not declared as a Study A condition.`
    );
  }

  const expectedCount =
    conditions.length *
    labelNoiseLevels.length *
    learningRates.length *
    scenarioIds.length *
    design.policies.length *
    seedsPerCell;
  check(
    rows.length === expectedCount,
    `${label} has ${rows.length} rows; its complete factorial dimensions require ${expectedCount}.`
  );

  const cellCounts = new Map<string, number>();
  rows.forEach((row, index) => {
    const rowLabel = `${label}[${index}]`;
    check(
      row.study === "A",
      `${rowLabel}.study is ${String(row.study)}; expected A.`
    );
    const condition = row.condition;
    const scenarioId = row.scenarioId;
    const policy = row.policy;
    const labelNoise = row.labelNoise;
    const learningRate = row.learningRate;
    const seed = rowNumber(row, "seed", rowLabel);

    if (typeof scenarioId === "string") {
      check(
        scenarioIds.includes(scenarioId),
        `${rowLabel}.scenarioId "${scenarioId}" is outside the design scenarios.`
      );
    } else {
      fail(`${rowLabel}.scenarioId must be a string.`);
    }
    if (typeof policy === "string") {
      check(
        design.policies.includes(policy),
        `${rowLabel}.policy "${policy}" is not declared by the design.`
      );
    } else {
      fail(`${rowLabel}.policy must be a string.`);
    }
    if (seed !== undefined) {
      check(
        Number.isInteger(seed) && seed >= 1 && seed <= seedsPerCell,
        `${rowLabel}.seed is ${seed}; expected an integer from 1 through ${seedsPerCell}.`
      );
    }

    if (
      typeof condition === "string" &&
      typeof scenarioId === "string" &&
      typeof policy === "string" &&
      typeof labelNoise === "number" &&
      typeof learningRate === "number"
    ) {
      const key = JSON.stringify([
        condition,
        labelNoise,
        learningRate,
        scenarioId,
        policy
      ]);
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }
  });

  for (const condition of conditions) {
    for (const labelNoise of labelNoiseLevels) {
      for (const learningRate of learningRates) {
        for (const scenarioId of scenarioIds) {
          for (const policy of design.policies) {
            const key = JSON.stringify([
              condition,
              labelNoise,
              learningRate,
              scenarioId,
              policy
            ]);
            const actual = cellCounts.get(key) ?? 0;
            check(
              actual === seedsPerCell,
              `${label} cell ${condition}/noise=${labelNoise}/rate=${learningRate}/${scenarioId}/${policy} has ${actual} rows; expected ${seedsPerCell}.`
            );
          }
        }
      }
    }
  }

  return { conditions, labelNoiseLevels, learningRates, seedsPerCell };
}

function vectorMismatch(
  actual: ProfileVector,
  expected: ProfileVector,
  tolerance = 1e-9
): string | undefined {
  for (const axis of AXES) {
    if (Math.abs(actual[axis] - expected[axis]) > tolerance) {
      return `${axis}: ${actual[axis]} !== ${expected[axis]}`;
    }
  }
  return undefined;
}

function verifySameVector(
  actual: ProfileVector,
  expected: ProfileVector,
  label: string
): void {
  const mismatch = vectorMismatch(actual, expected);
  check(mismatch === undefined, `${label} is discontinuous (${mismatch}).`);
}

function parseProfileHistory(
  value: unknown,
  label: string
): Array<ProfileHistoryPoint | undefined> {
  return asArray(value, label).map((entry, index) => {
    const point = asRecord(entry, `${label}[${index}]`);
    const step = point.step;
    if (typeof step !== "number" || !Number.isInteger(step)) {
      fail(`${label}[${index}].step must be an integer.`);
      return undefined;
    }
    const profileResult = VectorSchema.safeParse(point.profile);
    if (!profileResult.success) {
      fail(
        `${label}[${index}].profile is invalid: ${describeIssues(profileResult.error.issues)}.`
      );
      return undefined;
    }
    return { step, profile: profileResult.data };
  });
}

function parseReceipts(
  value: unknown,
  label: string
): Array<UpdateReceipt | undefined> {
  return asArray(value, label).map((entry, index) => {
    const result = UpdateReceiptSchema.safeParse(entry);
    if (!result.success) {
      fail(
        `${label}[${index}] is invalid: ${describeIssues(result.error.issues)}.`
      );
      return undefined;
    }
    return result.data;
  });
}

function verifyWorld(
  world: JsonRecord,
  worldLabel: string,
  trace: BehaviorTrace,
  scenario: Scenario,
  productIds: Set<string>
): void {
  const receipts = parseReceipts(world.receipts, `${worldLabel}.receipts`);
  const history = parseProfileHistory(
    world.profileHistory,
    `${worldLabel}.profileHistory`
  );
  const finalProfileResult = VectorSchema.safeParse(world.finalProfile);
  if (!finalProfileResult.success) {
    fail(
      `${worldLabel}.finalProfile is invalid: ${describeIssues(finalProfileResult.error.issues)}.`
    );
  }
  const metricsResult = RunMetricsSchema.safeParse(world.metrics);
  if (!metricsResult.success) {
    fail(
      `${worldLabel}.metrics is invalid: ${describeIssues(metricsResult.error.issues)}.`
    );
  }

  check(
    receipts.length === trace.events.length,
    `${worldLabel} has ${receipts.length} receipts for ${trace.events.length} trace events.`
  );
  check(
    history.length === trace.events.length + 1,
    `${worldLabel} has ${history.length} profile-history points; expected ${trace.events.length + 1}.`
  );

  const initialPoint = history[0];
  if (initialPoint !== undefined) {
    check(
      initialPoint.step === -1,
      `${worldLabel}.profileHistory[0].step is ${initialPoint.step}; expected -1.`
    );
    verifySameVector(
      initialPoint.profile,
      scenario.principalReference,
      `${worldLabel} initial profile`
    );
  }

  const receiptIds = new Set<string>();
  trace.events.forEach((event, index) => {
    const receipt = receipts[index];
    const beforePoint = history[index];
    const afterPoint = history[index + 1];
    if (receipt === undefined) return;

    check(
      !receiptIds.has(receipt.eventId),
      `${worldLabel}.receipts contains duplicate eventId "${receipt.eventId}".`
    );
    receiptIds.add(receipt.eventId);
    check(
      receipt.eventId === event.id,
      `${worldLabel}.receipts[${index}].eventId "${receipt.eventId}" does not align with trace event "${event.id}".`
    );
    check(
      receipt.step === event.step,
      `${worldLabel}.receipts[${index}].step is ${receipt.step}; trace step is ${event.step}.`
    );
    check(
      receipt.productId === event.productId,
      `${worldLabel}.receipts[${index}].productId "${receipt.productId}" does not align with trace product "${event.productId}".`
    );
    check(
      receipt.recordedIntent === event.observedIntent,
      `${worldLabel}.receipts[${index}].recordedIntent "${receipt.recordedIntent}" does not align with observed intent "${event.observedIntent}".`
    );
    check(
      productIds.has(receipt.productId),
      `${worldLabel}.receipts[${index}] references unknown product "${receipt.productId}".`
    );

    if (beforePoint !== undefined) {
      verifySameVector(
        receipt.profileBefore,
        beforePoint.profile,
        `${worldLabel}.receipts[${index}].profileBefore`
      );
    }
    if (index > 0) {
      const priorReceipt = receipts[index - 1];
      if (priorReceipt !== undefined) {
        verifySameVector(
          receipt.profileBefore,
          priorReceipt.profileAfter,
          `${worldLabel}.receipts[${index}] profile continuity`
        );
      }
    }
    if (afterPoint !== undefined) {
      check(
        afterPoint.step === event.step,
        `${worldLabel}.profileHistory[${index + 1}].step is ${afterPoint.step}; expected ${event.step}.`
      );
      verifySameVector(
        receipt.profileAfter,
        afterPoint.profile,
        `${worldLabel}.receipts[${index}].profileAfter`
      );
    }

    for (const axis of AXES) {
      const expectedDelta =
        Math.round(
          (receipt.profileAfter[axis] - receipt.profileBefore[axis]) * 1e6
        ) / 1e6;
      check(
        Math.abs(receipt.delta[axis] - expectedDelta) <= 1e-9,
        `${worldLabel}.receipts[${index}].delta.${axis} is ${receipt.delta[axis]}; profileAfter - profileBefore is ${expectedDelta}.`
      );
    }
  });

  if (finalProfileResult.success) {
    const finalExpected =
      receipts.at(-1)?.profileAfter ??
      history.at(-1)?.profile ??
      scenario.principalReference;
    if (finalExpected !== undefined) {
      verifySameVector(
        finalProfileResult.data,
        finalExpected,
        `${worldLabel}.finalProfile`
      );
    }
  }
}

function verifyRepresentative(
  representative: JsonRecord,
  label: string,
  productIds: Set<string>
): { worldCount: number; eventCount: number } | undefined {
  const scenarioResult = ScenarioSchema.safeParse(representative.scenario);
  if (!scenarioResult.success) {
    fail(
      `${label}.scenario is invalid: ${describeIssues(scenarioResult.error.issues)}.`
    );
    return undefined;
  }
  const traceResult = BehaviorTraceSchema.safeParse(representative.trace);
  if (!traceResult.success) {
    fail(
      `${label}.trace is invalid: ${describeIssues(traceResult.error.issues)}.`
    );
    return undefined;
  }
  const scenario = scenarioResult.data;
  const trace = traceResult.data;
  const worlds = asRecord(representative.worlds, `${label}.worlds`);
  const worldNames = Object.keys(worlds);
  check(worldNames.length > 0, `${label}.worlds must not be empty.`);

  check(
    trace.scenarioId === scenario.id,
    `${label}.trace.scenarioId "${trace.scenarioId}" does not match representative scenario "${scenario.id}".`
  );
  check(
    representative.policy === trace.policy,
    `${label}.policy "${String(representative.policy)}" does not match trace policy "${trace.policy}".`
  );
  check(
    representative.seed === trace.seed,
    `${label}.seed ${String(representative.seed)} does not match trace seed ${trace.seed}.`
  );

  const eventIds = new Set<string>();
  const steps = new Set<number>();
  trace.events.forEach((event, index) => {
    check(
      event.step === index,
      `${label}.trace.events[${index}].step is ${event.step}; expected sequential step ${index}.`
    );
    check(
      !steps.has(event.step),
      `${label}.trace has duplicate step ${event.step}.`
    );
    steps.add(event.step);
    check(
      !eventIds.has(event.id),
      `${label}.trace has duplicate event id "${event.id}".`
    );
    eventIds.add(event.id);
    check(
      productIds.has(event.productId),
      `${label}.trace.events[${index}] references unknown product "${event.productId}".`
    );
  });

  for (const worldName of worldNames) {
    verifyWorld(
      asRecord(worlds[worldName], `${label}.worlds.${worldName}`),
      `${label}.worlds.${worldName}`,
      trace,
      scenario,
      productIds
    );
  }

  // Baseline rows intentionally store only metrics, not one trace per cell.
  // Consequently, trace freezing can be checked directly only for this
  // representative scenario-policy-seed tuple. Every representative world is
  // required above to align its receipts to the one shared immutable trace.
  return { worldCount: worldNames.length, eventCount: trace.events.length };
}

function aggregateRunCount(
  rows: JsonRecord[],
  label: string
): number {
  return rows.reduce((total, row, index) => {
    const count = row.runCount;
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      fail(`${label}[${index}].runCount must be a nonnegative integer.`);
      return total;
    }
    return total + count;
  }, 0);
}

function verifyAggregateTable(
  rows: JsonRecord[],
  label: string,
  keyFields: readonly string[],
  expectedRowCount: number,
  expectedRunTotal: number,
  expectedRunsPerRow: number
): void {
  check(
    rows.length === expectedRowCount,
    `${label} has ${rows.length} rows; expected ${expectedRowCount}.`
  );
  verifyUniqueRowKeys(rows, label, keyFields);
  const runTotal = aggregateRunCount(rows, label);
  check(
    runTotal === expectedRunTotal,
    `${label} runCount total is ${runTotal}; baseline contains ${expectedRunTotal} runs.`
  );
  rows.forEach((row, index) => {
    if (typeof row.runCount === "number") {
      check(
        row.runCount === expectedRunsPerRow,
        `${label}[${index}].runCount is ${row.runCount}; expected ${expectedRunsPerRow}.`
      );
    }
  });
}

function verifyAggregateConditions(
  rows: JsonRecord[],
  label: string,
  expected: string[]
): void {
  const conditions = [...new Set(valuesAt(rows, "condition", label))];
  check(
    sameStringSet(conditions, expected),
    `${label} conditions are [${conditions.join(", ")}]; expected [${expected.join(", ")}].`
  );
}

function verifyAggregateKeysAgainstRows(
  aggregateRows: JsonRecord[],
  sourceRows: JsonRecord[],
  label: string,
  dimensions: readonly string[]
): void {
  const expectedCounts = new Map<string, number>();
  sourceRows.forEach((row, index) => {
    const key = scalarRowKey(
      row,
      dimensions,
      `${label} source row ${index}`
    );
    if (key === undefined) return;
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
  });

  const actualKeys = new Set<string>();
  aggregateRows.forEach((row, index) => {
    const key = scalarRowKey(row, dimensions, `${label}[${index}]`);
    if (key === undefined) return;
    actualKeys.add(key);
    const expectedCount = expectedCounts.get(key);
    check(
      expectedCount !== undefined,
      `${label}[${index}] key ${key} has no matching baseline rows.`
    );
    if (expectedCount !== undefined && typeof row.runCount === "number") {
      check(
        row.runCount === expectedCount,
        `${label}[${index}].runCount is ${row.runCount}; ${expectedCount} matching baseline rows exist for key ${key}.`
      );
    }
  });

  for (const key of expectedCounts.keys()) {
    check(
      actualKeys.has(key),
      `${label} is missing the aggregate row for baseline key ${key}.`
    );
  }
}

function verifySummary(
  summary: JsonRecord,
  baseline: BaselineView,
  design: DesignView,
  scenarioIds: string[],
  sensitivityDesign: ReturnType<typeof verifySensitivityRows>,
  productIds: Set<string>
): void {
  check(
    summary.schemaVersion === "summary.v1",
    `summary.schemaVersion is "${String(summary.schemaVersion)}"; expected "summary.v1".`
  );
  check(
    summary.protocolVersion === baseline.protocolVersion,
    `summary.protocolVersion does not match baseline.protocolVersion.`
  );
  check(
    summary.generatedAt === baseline.generatedAt,
    `summary.generatedAt does not match baseline.generatedAt.`
  );
  check(
    summary.observedStatus === baseline.raw.observedStatus,
    `summary.observedStatus does not match baseline.observedStatus.`
  );
  check(
    isDeepStrictEqual(summary.catalog, baseline.catalog),
    `summary.catalog does not exactly match baseline.catalog.`
  );
  check(
    isDeepStrictEqual(summary.design, baseline.design),
    `summary.design does not exactly match baseline.design.`
  );

  const overallA = asRecordArray(summary.overallA, "summary.overallA");
  const cellsA = asRecordArray(summary.cellsA, "summary.cellsA");
  const overallB = asRecordArray(summary.overallB, "summary.overallB");
  const cellsB = asRecordArray(summary.cellsB, "summary.cellsB");

  verifyAggregateTable(
    overallA,
    "summary.overallA",
    ["condition"],
    design.studyAConditions.length,
    baseline.studyA.length,
    design.scenarioCount *
      design.policies.length *
      design.seedsPerCell
  );
  verifyAggregateConditions(
    overallA,
    "summary.overallA",
    design.studyAConditions
  );
  verifyAggregateKeysAgainstRows(
    overallA,
    baseline.studyA,
    "summary.overallA",
    ["condition"]
  );
  verifyAggregateTable(
    cellsA,
    "summary.cellsA",
    ["condition", "scenarioId", "policy"],
    design.studyAConditions.length *
      design.scenarioCount *
      design.policies.length,
    baseline.studyA.length,
    design.seedsPerCell
  );
  verifyAggregateConditions(
    cellsA,
    "summary.cellsA",
    design.studyAConditions
  );
  verifyAggregateKeysAgainstRows(
    cellsA,
    baseline.studyA,
    "summary.cellsA",
    [
      "condition",
      "scenarioId",
      "scenarioLabel",
      "expectedConflict",
      "policy"
    ]
  );

  verifyAggregateTable(
    overallB,
    "summary.overallB",
    ["condition"],
    design.studyBConditions.length,
    baseline.studyB.length,
    design.scenarioCount *
      design.policies.length *
      design.seedsPerCell
  );
  verifyAggregateConditions(
    overallB,
    "summary.overallB",
    design.studyBConditions
  );
  verifyAggregateKeysAgainstRows(
    overallB,
    baseline.studyB,
    "summary.overallB",
    ["condition"]
  );
  verifyAggregateTable(
    cellsB,
    "summary.cellsB",
    ["condition", "scenarioId", "policy"],
    design.studyBConditions.length *
      design.scenarioCount *
      design.policies.length,
    baseline.studyB.length,
    design.seedsPerCell
  );
  verifyAggregateConditions(
    cellsB,
    "summary.cellsB",
    design.studyBConditions
  );
  verifyAggregateKeysAgainstRows(
    cellsB,
    baseline.studyB,
    "summary.cellsB",
    [
      "condition",
      "scenarioId",
      "scenarioLabel",
      "expectedConflict",
      "policy"
    ]
  );

  if (baseline.studyC !== undefined) {
    const overallC = asRecordArray(summary.overallC, "summary.overallC");
    const cellsC = asRecordArray(summary.cellsC, "summary.cellsC");
    verifyAggregateTable(
      overallC,
      "summary.overallC",
      ["condition"],
      design.studyAConditions.length,
      baseline.studyC.length,
      design.policies.length * design.seedsPerCell
    );
    verifyAggregateConditions(
      overallC,
      "summary.overallC",
      design.studyAConditions
    );
    verifyAggregateKeysAgainstRows(
      overallC,
      baseline.studyC,
      "summary.overallC",
      ["condition"]
    );
    verifyAggregateTable(
      cellsC,
      "summary.cellsC",
      ["condition", "policy"],
      design.studyAConditions.length * design.policies.length,
      baseline.studyC.length,
      design.seedsPerCell
    );
    verifyAggregateConditions(
      cellsC,
      "summary.cellsC",
      design.studyAConditions
    );
    verifyAggregateKeysAgainstRows(
      cellsC,
      baseline.studyC,
      "summary.cellsC",
      ["condition", "policy"]
    );
  } else {
    check(
      summary.overallC === undefined && summary.cellsC === undefined,
      `summary contains Study C aggregates but baseline has no studyC rows.`
    );
  }

  const sensitivity = asRecordArray(
    summary.sensitivity,
    "summary.sensitivity"
  );
  const sensitivityRowCount =
    sensitivityDesign.conditions.length *
    sensitivityDesign.labelNoiseLevels.length *
    sensitivityDesign.learningRates.length;
  verifyAggregateTable(
    sensitivity,
    "summary.sensitivity",
    ["condition", "labelNoise", "learningRate"],
    sensitivityRowCount,
    baseline.sensitivity.length,
    scenarioIds.length *
      design.policies.length *
      sensitivityDesign.seedsPerCell
  );
  verifyAggregateConditions(
    sensitivity,
    "summary.sensitivity",
    sensitivityDesign.conditions
  );
  verifyAggregateKeysAgainstRows(
    sensitivity,
    baseline.sensitivity,
    "summary.sensitivity",
    ["condition", "labelNoise", "learningRate"]
  );

  const pairedRows = asRecordArray(
    summary.pairedSeedExample,
    "summary.pairedSeedExample"
  );
  verifyUniqueRowKeys(pairedRows, "summary.pairedSeedExample");
  const baselineRowsByKey = new Map<string, JsonRecord>();
  baseline.studyA.forEach((row, index) => {
    const key = scalarRowKey(
      row,
      rowKeyFields,
      `baseline.studyA[${index}]`
    );
    if (key !== undefined) baselineRowsByKey.set(key, row);
  });
  pairedRows.forEach((row, index) => {
    const key = scalarRowKey(
      row,
      rowKeyFields,
      `summary.pairedSeedExample[${index}]`
    );
    if (key === undefined) return;
    const baselineRow = baselineRowsByKey.get(key);
    check(
      baselineRow !== undefined,
      `summary.pairedSeedExample[${index}] has no matching baseline Study A row.`
    );
    if (baselineRow !== undefined) {
      check(
        isDeepStrictEqual(row, baselineRow),
        `summary.pairedSeedExample[${index}] differs from its matching baseline Study A row.`
      );
    }
  });

  const summaryRepresentative = asRecord(
    summary.representative,
    "summary.representative"
  );
  check(
    isDeepStrictEqual(summaryRepresentative, baseline.representative),
    `summary.representative does not exactly match baseline.representative.`
  );
  verifyRepresentative(
    summaryRepresentative,
    "summary.representative",
    productIds
  );
}

function preview(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return String(value);
  return serialized.length <= 180
    ? serialized
    : `${serialized.slice(0, 177)}...`;
}

function firstDifference(
  committed: unknown,
  regenerated: unknown,
  path = "$"
): string | undefined {
  if (Object.is(committed, regenerated)) return undefined;
  if (typeof committed !== typeof regenerated) {
    return `${path}: committed type ${typeof committed}, regenerated type ${typeof regenerated}`;
  }
  if (
    committed === null ||
    regenerated === null ||
    typeof committed !== "object"
  ) {
    return `${path}: committed ${preview(committed)}, regenerated ${preview(regenerated)}`;
  }
  if (Array.isArray(committed) || Array.isArray(regenerated)) {
    if (!Array.isArray(committed) || !Array.isArray(regenerated)) {
      return `${path}: committed ${preview(committed)}, regenerated ${preview(regenerated)}`;
    }
    if (committed.length !== regenerated.length) {
      return `${path}.length: committed ${committed.length}, regenerated ${regenerated.length}`;
    }
    for (let index = 0; index < committed.length; index += 1) {
      const difference = firstDifference(
        committed[index],
        regenerated[index],
        `${path}[${index}]`
      );
      if (difference !== undefined) return difference;
    }
    return undefined;
  }

  const committedRecord = committed as JsonRecord;
  const regeneratedRecord = regenerated as JsonRecord;
  const committedKeys = Object.keys(committedRecord).sort();
  const regeneratedKeys = Object.keys(regeneratedRecord).sort();
  if (!isDeepStrictEqual(committedKeys, regeneratedKeys)) {
    const missing = regeneratedKeys.filter(
      (key) => !(key in committedRecord)
    );
    const extra = committedKeys.filter(
      (key) => !(key in regeneratedRecord)
    );
    return `${path}: object keys differ (missing from committed: ${missing.join(", ") || "none"}; extra in committed: ${extra.join(", ") || "none"})`;
  }
  for (const key of committedKeys) {
    const difference = firstDifference(
      committedRecord[key],
      regeneratedRecord[key],
      `${path}.${key}`
    );
    if (difference !== undefined) return difference;
  }
  return undefined;
}

function parseBaseline(raw: unknown): BaselineView {
  const baseline = asRecord(raw, "baseline");
  return {
    raw: baseline,
    design: asRecord(baseline.design, "baseline.design"),
    catalog: asRecord(baseline.catalog, "baseline.catalog"),
    generatedAt: asString(
      baseline.generatedAt,
      "baseline.generatedAt"
    ),
    protocolVersion: asString(
      baseline.protocolVersion,
      "baseline.protocolVersion"
    ),
    studyA: asRecordArray(baseline.studyA, "baseline.studyA"),
    studyB: asRecordArray(baseline.studyB, "baseline.studyB"),
    studyC:
      baseline.studyC === undefined
        ? undefined
        : asRecordArray(baseline.studyC, "baseline.studyC"),
    sensitivity: asRecordArray(
      baseline.sensitivity,
      "baseline.sensitivity"
    ),
    representative: asRecord(
      baseline.representative,
      "baseline.representative"
    )
  };
}

function parseDesign(design: JsonRecord): DesignView {
  const scenarioCount = asFiniteNumber(
    design.scenarioCount,
    "baseline.design.scenarioCount"
  );
  const seedsPerCell = asFiniteNumber(
    design.seedsPerCell,
    "baseline.design.seedsPerCell"
  );
  check(
    Number.isInteger(scenarioCount) && scenarioCount > 0,
    `baseline.design.scenarioCount must be a positive integer.`
  );
  check(
    Number.isInteger(seedsPerCell) && seedsPerCell > 0,
    `baseline.design.seedsPerCell must be a positive integer.`
  );
  return {
    scenarioCount,
    policies: stringArray(design, "policies", "baseline.design"),
    seedsPerCell,
    studyAConditions: stringArray(
      design,
      "studyAConditions",
      "baseline.design"
    ),
    studyBConditions: stringArray(
      design,
      "studyBConditions",
      "baseline.design"
    ),
    baselineLabelNoise: asFiniteNumber(
      design.baselineLabelNoise,
      "baseline.design.baselineLabelNoise"
    ),
    baselineLearningRate: asFiniteNumber(
      design.baselineLearningRate,
      "baseline.design.baselineLearningRate"
    ),
    studyCScenarioId:
      design.studyCScenarioId === undefined
        ? undefined
        : asString(
            design.studyCScenarioId,
            "baseline.design.studyCScenarioId"
          )
  };
}

async function main(): Promise<void> {
  const [catalogRaw, baselineRaw, summaryRaw] = await Promise.all([
    readJson(catalogPath, "catalog"),
    readJson(baselinePath, "baseline"),
    readJson(summaryPath, "summary")
  ]);

  const catalogResult = CatalogSchema.safeParse(catalogRaw);
  if (!catalogResult.success) {
    throw new Error(
      `Catalog schema validation failed: ${describeIssues(catalogResult.error.issues)}.`
    );
  }
  const catalog: Catalog = catalogResult.data;
  const baseline = parseBaseline(baselineRaw);
  const summary = asRecord(summaryRaw, "summary");
  const design = parseDesign(baseline.design);

  check(
    baseline.raw.schemaVersion === "results.v1",
    `baseline.schemaVersion is "${String(baseline.raw.schemaVersion)}"; expected "results.v1".`
  );
  check(
    baseline.catalog.productCount === catalog.productCount,
    `baseline.catalog.productCount (${String(baseline.catalog.productCount)}) does not match catalog.productCount (${catalog.productCount}).`
  );
  check(
    baseline.catalog.snapshotSchemaVersion === catalog.schemaVersion,
    `baseline.catalog.snapshotSchemaVersion does not match catalog.schemaVersion.`
  );
  check(
    catalog.productCount === catalog.products.length,
    `catalog.productCount declares ${catalog.productCount}, but catalog.products contains ${catalog.products.length} entries.`
  );

  const productIds = catalog.products.map((product) => product.id);
  const sourceCodes = catalog.products.map((product) => product.sourceCode);
  const productIdDuplicates = duplicateValues(productIds);
  const sourceCodeDuplicates = duplicateValues(sourceCodes);
  check(
    productIdDuplicates.length === 0,
    `Catalog product IDs are not unique: ${productIdDuplicates.join(", ")}.`
  );
  check(
    sourceCodeDuplicates.length === 0,
    `Catalog sourceCodes are not unique: ${sourceCodeDuplicates.join(", ")}.`
  );
  verifyUniqueStrings(catalog.categories, "catalog.categories");
  const actualCategories = [
    ...new Set(catalog.products.map((product) => product.category))
  ];
  check(
    sameStringSet(catalog.categories, actualCategories),
    `catalog.categories does not match the categories present in catalog.products (declared: ${catalog.categories.join(", ")}; actual: ${actualCategories.join(", ")}).`
  );

  verifyUniqueStrings(design.policies, "baseline.design.policies");
  verifyUniqueStrings(
    design.studyAConditions,
    "baseline.design.studyAConditions"
  );
  verifyUniqueStrings(
    design.studyBConditions,
    "baseline.design.studyBConditions"
  );

  const scenarioIds = [
    ...new Set(valuesAt(baseline.studyA, "scenarioId", "baseline.studyA"))
  ];
  check(
    scenarioIds.length === design.scenarioCount,
    `baseline.design.scenarioCount declares ${design.scenarioCount}, but Study A contains ${scenarioIds.length} distinct scenario IDs.`
  );
  verifyStudyRows(
    baseline.studyA,
    "baseline.studyA",
    "A",
    design.studyAConditions,
    scenarioIds,
    design
  );
  verifyStudyATraceFreezeProxy(
    baseline.studyA,
    design.studyAConditions
  );
  verifyStudyRows(
    baseline.studyB,
    "baseline.studyB",
    "B",
    design.studyBConditions,
    scenarioIds,
    design
  );

  if (baseline.studyC !== undefined) {
    check(
      design.studyCScenarioId !== undefined,
      `baseline has studyC rows but baseline.design.studyCScenarioId is missing.`
    );
    if (design.studyCScenarioId !== undefined) {
      check(
        scenarioIds.includes(design.studyCScenarioId),
        `baseline.design.studyCScenarioId "${design.studyCScenarioId}" is not one of the declared experiment scenarios.`
      );
      verifyStudyRows(
        baseline.studyC,
        "baseline.studyC",
        "C",
        design.studyAConditions,
        [design.studyCScenarioId],
        design
      );
    }
  } else {
    check(
      design.studyCScenarioId === undefined,
      `baseline.design declares Study C, but baseline.studyC is missing.`
    );
  }

  const sensitivityDesign = verifySensitivityRows(
    baseline.sensitivity,
    scenarioIds,
    design
  );
  const representativeCoverage = verifyRepresentative(
    baseline.representative,
    "baseline.representative",
    new Set(productIds)
  );

  verifySummary(
    summary,
    baseline,
    design,
    scenarioIds,
    sensitivityDesign,
    new Set(productIds)
  );

  const regenerated = JSON.parse(
    JSON.stringify(
      runExperiment(
        catalog.products,
        baseline.generatedAt,
        design.seedsPerCell
      )
    )
  ) as unknown;
  if (!isDeepStrictEqual(baseline.raw, regenerated)) {
    fail(
      `Committed baseline is not the exact JSON-form regeneration from runExperiment using generatedAt="${baseline.generatedAt}". First difference: ${firstDifference(baseline.raw, regenerated) ?? "unknown difference"}. Run "pnpm experiment" and commit both result artifacts after intentional experiment changes.`
    );
  }

  if (failures.length > 0) {
    const omitted =
      omittedFailureCount > 0
        ? `\n  ...and ${omittedFailureCount} additional failure(s).`
        : "";
    console.error(
      `Artifact verification failed with ${failures.length + omittedFailureCount} issue(s):\n${failures
        .map((message) => `  - ${message}`)
        .join("\n")}${omitted}`
    );
    process.exitCode = 1;
    return;
  }

  const studyCCount = baseline.studyC?.length ?? 0;
  const representativeNote =
    representativeCoverage === undefined
      ? ""
      : ` Representative coverage aligned ${representativeCoverage.worldCount} worlds to one ${representativeCoverage.eventCount}-event trace.`;
  console.log(
    `Artifact verification passed: ${catalog.products.length} products, ${baseline.studyA.length} Study A rows, ${baseline.studyB.length} Study B rows, ${studyCCount} Study C rows, and ${baseline.sensitivity.length} sensitivity rows.${representativeNote}`
  );
  console.log(
    "Study A trace-freeze limit: baseline rows store metrics rather than traces. Trace-derived metrics were checked across every condition tuple, but direct trace/receipt verification is limited to the representative tuple and its one shared trace."
  );
}

try {
  await main();
} catch (error) {
  console.error(
    `Artifact verification could not run: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
