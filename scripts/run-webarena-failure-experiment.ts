import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adaptReleasedWebArenaTrajectory,
  normalizeEvidenceTarget,
  WEB_ARENA_TASK_CLASSES,
  type PilotTask,
  type ReleasedAgentTrajectory,
  type WebArenaTaskDefinition
} from "../src/webarena/task-pilot";
import { ACTION_WEIGHTS } from "../src/recommender/profile-updater";
import {
  assertFailureLifecycleInvariants,
  FAILURE_LIFECYCLE_CONDITIONS,
  replayFailureLifecycle,
  type FailureLifecycleRow
} from "../src/webarena/failure-lifecycle";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = resolve(
  root,
  "artifacts/webarena-provenance/raw/released-agent-traces"
);
const taskPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/metadata/test.raw.json"
);
const trajectoryPath = resolve(rawDir, "trajectory_log.json");
const evalPath = resolve(rawDir, "v0.jsonl");
const ocrPath = resolve(rawDir, "ocr-sft-qwenvl-v2.json");
const screenshotAuditPath = resolve(
  root,
  "experiments/webarena-failure-traces/screenshot-audit.json"
);
const outputDir = resolve(root, "public/results/webarena-failure/v1");
const validationPath = resolve(
  root,
  "artifacts/webarena-provenance/webarena-failure-validation.json"
);

const round = (value: number) => Number(value.toFixed(6));
const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const stableHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

const taskBytes = await readFile(taskPath);
const trajectoryBytes = await readFile(trajectoryPath);
const evalBytes = await readFile(evalPath);
const ocrBytes = await readFile(ocrPath);
const screenshotAuditBytes = await readFile(screenshotAuditPath);
const taskDefinitions = JSON.parse(taskBytes.toString("utf8")) as WebArenaTaskDefinition[];
const trajectories = JSON.parse(
  trajectoryBytes.toString("utf8")
) as ReleasedAgentTrajectory[];
const ocrByImage = JSON.parse(ocrBytes.toString("utf8")) as Record<string, string>;
const screenshotAudit = JSON.parse(screenshotAuditBytes.toString("utf8")) as {
  status: string;
  selection: string;
  records: Array<{
    imageId: string;
    stratum: "ocr-boundary" | "ocr-control";
    targetVisible: boolean;
    validEvidenceTarget: boolean;
    sha256: string;
  }>;
};
const evaluations = evalBytes
  .toString("utf8")
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line) as { task_uid: string; annotation: string });

function buildTasks(): PilotTask[] {
  const trajectoryById = new Map(
    trajectories.map((trajectory) => [trajectory.uid, trajectory])
  );
  const outcomeById = new Map(
    evaluations.map((evaluation) => [evaluation.task_uid, evaluation.annotation])
  );
  return taskDefinitions
    .filter((task) => task.sites.includes("shopping"))
    .sort((left, right) => left.task_id - right.task_id)
    .map((task) => {
      const trajectory = trajectoryById.get(String(task.task_id));
      if (!trajectory) throw new Error(`Missing trajectory ${task.task_id}`);
      const annotation = outcomeById.get(String(task.task_id));
      const outcome =
        annotation === "Success" || annotation === "Failure"
          ? annotation
          : "Unknown";
      return adaptReleasedWebArenaTrajectory(
        task,
        trajectory,
        outcome,
        ocrByImage
      );
    });
}

function aggregateConditions(rows: FailureLifecycleRow[]) {
  const baselineSuccessfulMass = sum(
    rows
      .filter(
        (row) => row.condition === "persist-all" && row.outcome === "Success"
      )
      .map((row) => row.finalPersistentMass)
  );
  return FAILURE_LIFECYCLE_CONDITIONS.map((condition) => {
    const group = rows.filter((row) => row.condition === condition);
    const successfulMass = sum(
      group
        .filter((row) => row.outcome === "Success")
        .map((row) => row.finalPersistentMass)
    );
    return {
      condition,
      runCount: group.length,
      meanProvisionalProfileMass: round(
        mean(group.map((row) => row.provisionalProfileMass))
      ),
      meanFinalPersistentMass: round(
        mean(group.map((row) => row.finalPersistentMass))
      ),
      totalFailedResidualMass: round(
        sum(group.map((row) => row.failedResidualMass))
      ),
      totalRollbackMass: round(sum(group.map((row) => row.rollbackMass))),
      successfulEvidenceRetention: round(
        baselineSuccessfulMass === 0
          ? 1
          : successfulMass / baselineSuccessfulMass
      )
    };
  });
}

function repeatedByKey(tasks: PilotTask[], key: "exact" | "label") {
  let eventCount = 0;
  let repeatedCount = 0;
  let tracesWithRepeats = 0;
  const byOutcome = ["Success", "Failure"].map((outcome) => ({
    outcome,
    eventCount: 0,
    repeatedCount: 0,
    tracesWithRepeats: 0
  }));
  for (const task of tasks) {
    const seen = new Set<string>();
    let taskRepeats = 0;
    for (const [index, event] of task.events.entries()) {
      const eventKey =
        key === "exact"
          ? (event.targetKey ?? `unkeyed:${index}`)
          : (event.targetLabel
              ? normalizeEvidenceTarget(event.targetLabel)
              : `unkeyed:${index}`);
      if (seen.has(eventKey)) taskRepeats += 1;
      else seen.add(eventKey);
    }
    eventCount += task.events.length;
    repeatedCount += taskRepeats;
    if (taskRepeats > 0) tracesWithRepeats += 1;
    const stratum = byOutcome.find((row) => row.outcome === task.outcome);
    if (stratum) {
      stratum.eventCount += task.events.length;
      stratum.repeatedCount += taskRepeats;
      if (taskRepeats > 0) stratum.tracesWithRepeats += 1;
    }
  }
  return {
    key,
    eventCount,
    repeatedCount,
    repeatedShare: round(eventCount === 0 ? 0 : repeatedCount / eventCount),
    tracesWithRepeats,
    byOutcome: byOutcome.map((row) => ({
      ...row,
      repeatedShare: round(
        row.eventCount === 0 ? 0 : row.repeatedCount / row.eventCount
      )
    }))
  };
}

function buildOutput() {
  const tasks = buildTasks();
  const rows = tasks.flatMap((task) =>
    FAILURE_LIFECYCLE_CONDITIONS.map((condition) =>
      replayFailureLifecycle(task, condition)
    )
  );
  assertFailureLifecycleInvariants(rows, tasks.length);
  const mappedEvents = tasks.flatMap((task) => task.events);
  const ocrAvailable = mappedEvents.filter((event) => event.ocrAvailable).length;
  const ocrCorroborated = mappedEvents.filter(
    (event) => event.ocrCorroborated
  ).length;
  const mapperByAction = ["view", "compare", "shortlist", "purchase"].map(
    (action) => {
      const group = mappedEvents.filter((event) => event.action === action);
      const corroborated = group.filter((event) => event.ocrCorroborated).length;
      return {
        action,
        eventCount: group.length,
        corroboratedCount: corroborated,
        corroborationRate: round(
          group.length === 0 ? 0 : corroborated / group.length
        )
      };
    }
  );
  const eventAudit = tasks.flatMap((task) => {
    const exactSeen = new Set<string>();
    const labelSeen = new Set<string>();
    return task.events.map((event) => {
      const exactKey = event.targetKey ?? "unkeyed";
      const labelKey = event.targetLabel?.toLowerCase().trim() ?? "unkeyed";
      const exactRepeat = exactSeen.has(exactKey);
      const labelRepeat = labelSeen.has(labelKey);
      exactSeen.add(exactKey);
      labelSeen.add(labelKey);
      return {
        taskId: task.taskId,
        taskClass: task.taskClass,
        outcome: task.outcome,
        action: event.action,
        intent: event.intent,
        evidenceKind: event.evidenceKind,
        primaryEligible: event.primaryEligible,
        targetId: event.targetId,
        targetLabel: event.targetLabel,
        targetKey: event.targetKey,
        imageId: event.imageId,
        ocrAvailable: event.ocrAvailable,
        ocrCorroborated: event.ocrCorroborated,
        ocrTokenRecall: event.ocrTokenRecall,
        exactRepeat,
        labelRepeat
      };
    });
  });
  const exactRepeats = repeatedByKey(tasks, "exact");
  const labelRepeats = repeatedByKey(tasks, "label");
  const conditions = aggregateConditions(rows);
  const quarantine = conditions.find(
    (row) => row.condition === "outcome-quarantine"
  )!;
  const rollback = conditions.find(
    (row) => row.condition === "rollback-on-failure"
  )!;
  const baseline = conditions.find((row) => row.condition === "persist-all")!;
  const labelDeduplicatedMass = (task: PilotTask) => {
    const seen = new Set<string>();
    return round(
      sum(
        task.events.flatMap((event, index) => {
          const key = event.targetLabel
            ? normalizeEvidenceTarget(event.targetLabel)
            : `unkeyed:${index}`;
          if (seen.has(key)) return [];
          seen.add(key);
          return [ACTION_WEIGHTS[event.action]];
        })
      )
    );
  };
  const labelDedupFailedResidualMass = round(
    sum(
      tasks
        .filter((task) => task.outcome === "Failure")
        .map(labelDeduplicatedMass)
    )
  );
  const successfulBaselineMass = sum(
    tasks
      .filter((task) => task.outcome === "Success")
      .map((task) => sum(task.events.map((event) => ACTION_WEIGHTS[event.action])))
  );
  const successfulLabelDedupMass = sum(
    tasks
      .filter((task) => task.outcome === "Success")
      .map(labelDeduplicatedMass)
  );

  return {
    schemaVersion: "webarena-failure-lifecycle.v1",
    evidenceStatus: "released-trajectory-observation",
    source: {
      webarenaCommit: "dce04686a56253aefba7b18a4fa0937cf1dc987b",
      trajectoryArchiveCommit: "ef1d8b4467e83ad54f119fe82a137169600a2679",
      taskSha256: sha256(taskBytes),
      trajectorySha256: sha256(trajectoryBytes),
      evalSha256: sha256(evalBytes),
      ocrSha256: sha256(ocrBytes)
    },
    corpus: {
      traceCount: tasks.length,
      auditedStepCount: sum(tasks.map((task) => task.auditedStepCount)),
      mappedEventCount: mappedEvents.length,
      successfulTraceCount: tasks.filter((task) => task.outcome === "Success")
        .length,
      failedTraceCount: tasks.filter((task) => task.outcome === "Failure").length,
      taskClassCounts: Object.fromEntries(
        WEB_ARENA_TASK_CLASSES.map((taskClass) => [
          taskClass,
          tasks.filter((task) => task.taskClass === taskClass).length
        ])
      )
    },
    mapperValidation: {
      ocrRecordCount: Object.keys(ocrByImage).length,
      ocrAvailableEventCount: ocrAvailable,
      ocrAvailabilityRate: round(
        mappedEvents.length === 0 ? 0 : ocrAvailable / mappedEvents.length
      ),
      ocrCorroboratedEventCount: ocrCorroborated,
      ocrCorroborationRate: round(
        ocrAvailable === 0 ? 0 : ocrCorroborated / ocrAvailable
      ),
      knownUiControlEventCount: mappedEvents.filter((event) =>
        /(?:page next|page previous|set ascending direction|set descending direction)/i.test(
          event.targetLabel ?? ""
        )
      ).length,
      evidenceKindCounts: Object.fromEntries(
        ["product", "review", "shortlist", "purchase"].map((kind) => [
          kind,
          mappedEvents.filter((event) => event.evidenceKind === kind).length
        ])
      ),
      byAction: mapperByAction,
      interpretation:
        "OCR corroboration checks whether released screenshot descriptions contain the mapped click target; it is auxiliary model-generated evidence, not human annotation."
    },
    screenshotValidation: {
      status: screenshotAudit.status,
      selection: screenshotAudit.selection,
      auditSha256: sha256(screenshotAuditBytes),
      recordCount: screenshotAudit.records.length,
      boundaryCount: screenshotAudit.records.filter(
        (record) => record.stratum === "ocr-boundary"
      ).length,
      controlCount: screenshotAudit.records.filter(
        (record) => record.stratum === "ocr-control"
      ).length,
      visibleCount: screenshotAudit.records.filter(
        (record) => record.targetVisible
      ).length,
      validEvidenceTargetCount: screenshotAudit.records.filter(
        (record) => record.validEvidenceTarget
      ).length,
      interpretation:
        "Supplementary Codex visual inspection of source-verified screenshots; it is not independent human annotation."
    },
    loopAnalysis: {
      conservativeExactTarget: exactRepeats,
      labelOnlySensitivity: labelRepeats
    },
    design: {
      unit: "released WebArena shopping action trajectory",
      conditions: FAILURE_LIFECYCLE_CONDITIONS,
      tracesPerCondition: tasks.length,
      repeatedTargetDefinition:
        "same accessibility node id plus normalized target label within a trajectory",
      keyDistinction:
        "quarantine creates no provisional profile write; rollback writes provisionally and removes failed-task mass after outcome"
    },
    conditions,
    observedComparisons: {
      quarantineRollbackFinalDifference: round(
        quarantine.meanFinalPersistentMass - rollback.meanFinalPersistentMass
      ),
      quarantineProvisionalMass: quarantine.meanProvisionalProfileMass,
      rollbackProvisionalMass: rollback.meanProvisionalProfileMass,
      rollbackRemovedMass: rollback.totalRollbackMass,
      failedResidualReductionUnderQuarantine: round(
        baseline.totalFailedResidualMass === 0
          ? 0
          : 1 -
              quarantine.totalFailedResidualMass /
              baseline.totalFailedResidualMass
      ),
      labelOnlyDedupFailedResidualMass: labelDedupFailedResidualMass,
      labelOnlyDedupFailedResidualReduction: round(
        baseline.totalFailedResidualMass === 0
          ? 0
          : 1 -
              labelDedupFailedResidualMass /
                baseline.totalFailedResidualMass
      ),
      labelOnlyDedupSuccessfulEvidenceRetention: round(
        successfulBaselineMass === 0
          ? 1
          : successfulLabelDedupMass / successfulBaselineMass
      )
    },
    claims: {
      observed: [
        "Released failure traces can contain mapped product-facing actions even when task completion fails.",
        "Outcome quarantine and rollback produce the same final failed-task mass in this replay but differ in provisional profile exposure.",
        "Repeated-target prevalence is reported under both a conservative node-plus-label key and a broader label-only sensitivity rule."
      ],
      notEstablished: [
        "Failure is not shown to cause more profile evidence because task mix, trace length, and the release failure rate differ.",
      "OCR corroboration is generated metadata rather than human judgment or production logging ground truth.",
        "The screenshot audit was performed by Codex and is not an independent human reliability study.",
        "Evidence mass is not user harm, preference accuracy, or measured profile drift.",
        "No production platform is shown to quarantine, persist, or roll back events in these ways."
      ]
    },
    limitations: [
      "Only released GPT-4 CoT WebArena agent traces are analyzed.",
      "The conservative loop key can miss repeated targets when accessibility ids change.",
      "The label-only sensitivity key can merge identically named controls across different products.",
      "Task success is a WebArena outcome label, not a measure of user satisfaction.",
      "Lifecycle policies are executable counterfactual contracts, not observed deployments."
    ],
    rows,
    eventAudit
  };
}

const first = buildOutput();
const second = buildOutput();
const deterministic = stableHash(first) === stableHash(second);
if (!deterministic) throw new Error("Failure lifecycle output is not deterministic");

await mkdir(outputDir, { recursive: true });
await mkdir(dirname(validationPath), { recursive: true });
await writeFile(
  resolve(outputDir, "summary.json"),
  `${JSON.stringify({ ...first, rows: undefined, eventAudit: undefined }, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDir, "task-results.json"),
  `${JSON.stringify(
    { schemaVersion: "webarena-failure-task-results.v1", rows: first.rows },
    null,
    2
  )}\n`,
  "utf8"
);
await writeFile(
  resolve(outputDir, "event-audit.json"),
  `${JSON.stringify(
    { schemaVersion: "webarena-failure-event-audit.v1", events: first.eventAudit },
    null,
    2
  )}\n`,
  "utf8"
);
const summaryForHash = { ...first, rows: undefined, eventAudit: undefined };
await writeFile(
  validationPath,
  `${JSON.stringify(
    {
      deterministic,
      summaryHash: stableHash(summaryForHash),
      rowCount: first.rows.length
    },
    null,
    2
  )}\n`,
  "utf8"
);
process.stdout.write(
  `Wrote ${first.corpus.traceCount} traces × ${first.design.conditions.length} lifecycle conditions (${first.rows.length} rows)\n`
);
