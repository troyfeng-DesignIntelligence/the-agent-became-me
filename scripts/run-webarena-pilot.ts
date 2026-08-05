import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STUDY_A_CONDITIONS } from "../src/domain/schema";
import {
  assertPilotInvariants,
  adaptReleasedWebArenaTrajectory,
  replayPilotTask,
  WEB_ARENA_TASK_CLASSES,
  type PilotTask,
  type PilotRow,
  type ReleasedAgentTrajectory,
  type WebArenaTaskDefinition
} from "../src/webarena/task-pilot";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/metadata/test.raw.json"
);
const outputDir = resolve(root, "public/results/webarena-pilot/v1");
const validationPath = resolve(
  root,
  "artifacts/webarena-provenance/validation.json"
);
const trajectoryPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/released-agent-traces/trajectory_log.json"
);
const evalPath = resolve(
  root,
  "artifacts/webarena-provenance/raw/released-agent-traces/v0.jsonl"
);

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number) => Number(value.toFixed(6));
const stableHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function aggregate(rows: PilotRow[]) {
  return STUDY_A_CONDITIONS.map((condition) => {
    const group = rows.filter((row) => row.condition === condition);
    return {
      condition,
      runCount: group.length,
      meanPersistentEvidenceMass: round(
        mean(group.map((row) => row.persistentEvidenceMass))
      ),
      meanNonCommitPersistentMass: round(
        mean(group.map((row) => row.nonCommitPersistentMass))
      ),
      meanPersistentEventRate: round(
        mean(group.map((row) => row.persistentEventRate))
      ),
      actorRecordingErrorRate: round(
        mean(group.map((row) => row.actorRecordingErrorRate))
      ),
      provenanceUseRate: round(
        mean(group.map((row) => row.provenanceUseRate))
      )
    };
  });
}

const rawTasks = JSON.parse(
  await readFile(inputPath, "utf8")
) as WebArenaTaskDefinition[];
const releasedTrajectories = JSON.parse(
  await readFile(trajectoryPath, "utf8")
) as ReleasedAgentTrajectory[];
const releasedEvals = (await readFile(evalPath, "utf8"))
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line) as { task_uid: string; annotation: string });

function buildOutput() {
  const trajectoryById = new Map(
    releasedTrajectories.map((trajectory) => [trajectory.uid, trajectory])
  );
  const outcomeById = new Map(
    releasedEvals.map((evaluation) => [evaluation.task_uid, evaluation.annotation])
  );
  const shoppingDefinitions = rawTasks
    .filter((task) => task.sites.includes("shopping"))
    .sort((left, right) => left.task_id - right.task_id);
  const shopping = shoppingDefinitions.map((task) => {
    const trajectory = trajectoryById.get(String(task.task_id));
    if (!trajectory) throw new Error(`Missing released trajectory ${task.task_id}`);
    const annotation = outcomeById.get(String(task.task_id));
    const outcome =
      annotation === "Success" || annotation === "Failure"
        ? annotation
        : "Unknown";
    return adaptReleasedWebArenaTrajectory(task, trajectory, outcome);
  });
  const rows = shopping.flatMap((task) =>
    STUDY_A_CONDITIONS.map((condition) =>
      // The released action sequence is frozen; only the update contract changes.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      replayReleased(task, condition)
    )
  );
  assertPilotInvariants(rows, shopping.length);
  const classCounts = Object.fromEntries(
    WEB_ARENA_TASK_CLASSES.map((taskClass) => [
      taskClass,
      shopping.filter((task) => task.taskClass === taskClass).length
    ])
  );
  const results = aggregate(rows);
  const actorBlind = results.find((row) => row.condition === "actor-blind")!;
  const loggedOnly = results.find((row) => row.condition === "logged-only")!;
  const matched = results.find(
    (row) => row.condition === "matched-attenuation"
  )!;
  const provenance = results.find(
    (row) => row.condition === "provenance-aware"
  )!;
  const scoped = results.find((row) => row.condition === "scope-gated")!;
  const blindRows = rows.filter((row) => row.condition === "actor-blind");
  const outcomeStrata = ["Success", "Failure"].map((outcome) => {
    const group = blindRows.filter((row) => row.outcome === outcome);
    return {
      outcome,
      taskCount: group.length,
      tracesWithMappedEvidence: group.filter(
        (row) => row.mappedEvidenceEventCount > 0
      ).length,
      totalMappedEvidenceEvents: group.reduce(
        (sum, row) => sum + row.mappedEvidenceEventCount,
        0
      ),
      meanAuditedSteps: round(mean(group.map((row) => row.auditedStepCount))),
      meanMappedEvidenceEvents: round(
        mean(group.map((row) => row.mappedEvidenceEventCount))
      ),
      meanActorBlindEvidenceMass: round(
        mean(group.map((row) => row.persistentEvidenceMass))
      )
    };
  });

  return {
    schemaVersion: "webarena-released-trajectory-replay.v1",
    studyMode: "released-webarena-trajectory-replay",
    evidenceStatus: "pilot-observation",
    generatedFromCommit: "dce04686a56253aefba7b18a4fa0937cf1dc987b",
    corpus: {
      totalTaskCount: rawTasks.length,
      shoppingTaskCount: shopping.length,
      uniqueTemplateCount: new Set(shopping.map((task) => task.templateId)).size,
      classificationCoverage:
        shopping.filter((task) => Boolean(task.taskClass)).length / shopping.length,
      taskClassCounts: classCounts,
      releasedTrajectoryCount: releasedTrajectories.length,
      parsedTrajectoryCount: shopping.length,
      parseRate: shopping.length / shoppingDefinitions.length,
      auditedStepCount: shopping.reduce(
        (sum, task) => sum + task.auditedStepCount,
        0
      ),
      mappedEvidenceEventCount: shopping.reduce(
        (sum, task) => sum + task.mappedEvidenceEventCount,
        0
      ),
      tracesWithMappedEvidence: shopping.filter(
        (task) => task.mappedEvidenceEventCount > 0
      ).length,
      successfulTaskCount: shopping.filter((task) => task.outcome === "Success")
        .length,
      failedTaskCount: shopping.filter((task) => task.outcome === "Failure")
        .length
    },
    design: {
      unit: "released GPT-4 CoT WebArena shopping action trajectory",
      adapter:
        "deterministic conservative mapper from raw click target to view, compare, shortlist, or purchase evidence",
      conditions: STUDY_A_CONDITIONS,
      tasksPerCondition: shopping.length,
      primaryOutcome: "mean non-commit persistent evidence mass",
      controls: ["matched-attenuation", "no-update"]
    },
    results,
    outcomeStrata,
    observedComparisons: {
      loggingOnlyMassDifference: round(
        loggedOnly.meanPersistentEvidenceMass -
          actorBlind.meanPersistentEvidenceMass
      ),
      provenanceVsMatchedMassDifference: round(
        provenance.meanPersistentEvidenceMass - matched.meanPersistentEvidenceMass
      ),
      scopeGatedNonCommitMass: scoped.meanNonCommitPersistentMass,
      scopeGatedMassReductionVsActorBlind: round(
        1 - scoped.meanPersistentEvidenceMass / actorBlind.meanPersistentEvidenceMass
      )
    },
    claims: {
      observed: [
        "Logging agent provenance without using it leaves evidence mass unchanged in this executable model.",
        "Scope-gating excludes all non-commit evidence generated by the deterministic task adapter.",
        "Matched attenuation and provenance-aware weighting have equal total mass by construction, so a lower-mass result alone cannot identify a provenance-specific mechanism.",
        "Every official shopping task has a released GPT-4 CoT trajectory in the acquired archive; browser actions and outcome labels were parsed before replay.",
        `${outcomeStrata.find((row) => row.outcome === "Failure")!.totalMappedEvidenceEvents} mapped evidence events occurred in failed trajectories, so task failure did not imply absence of profile-update exposure.`
      ],
      notEstablished: [
        "Human trajectories were not acquired, so the study does not compare agent and human browsing styles.",
        "The evidence mapper interprets released click labels; it does not observe a production recommender's logging schema.",
        "The pilot does not estimate effects in Amazon, WebArena's deployed sites, or any production recommender.",
        "Evidence mass is an updater exposure measure, not user harm or preference accuracy."
      ]
    },
    limitations: [
      "The official Google Drive host was unreachable; the released GPT-4 CoT data came from the Agent-Eval-Refine archive mirror.",
      "Task classification and action mapping use inspectable lexical rules and can misclassify ambiguous labels.",
      "Only mapped product-facing clicks enter evidence mass; navigation, typing, scrolling, and stop actions remain audit-only.",
      "No human judgments, production profiles, or commercial recommendation outcomes are included.",
      "Equal evidence mass does not imply equal sequential profile effects."
    ]
  };
}

function replayReleased(
  task: PilotTask,
  condition: (typeof STUDY_A_CONDITIONS)[number]
) {
  // Kept as a local wrapper so both output builds execute the same pure replay.
  return replayPilotTask(task, condition);
}

const first = buildOutput();
const second = buildOutput();
const deterministic = stableHash(first) === stableHash(second);
if (!deterministic) throw new Error("Pilot output was not deterministic");

await mkdir(outputDir, { recursive: true });
await mkdir(dirname(validationPath), { recursive: true });
await writeFile(
  resolve(outputDir, "summary.json"),
  `${JSON.stringify(first, null, 2)}\n`,
  "utf8"
);
const trajectoryById = new Map(
  releasedTrajectories.map((trajectory) => [trajectory.uid, trajectory])
);
const outcomeById = new Map(
  releasedEvals.map((evaluation) => [evaluation.task_uid, evaluation.annotation])
);
const releasedTasks = rawTasks
  .filter((task) => task.sites.includes("shopping"))
  .map((task) =>
    adaptReleasedWebArenaTrajectory(
      task,
      trajectoryById.get(String(task.task_id))!,
      outcomeById.get(String(task.task_id)) === "Success" ? "Success" : "Failure"
    )
  );
const rows = releasedTasks.flatMap((task) =>
  STUDY_A_CONDITIONS.map((condition) => replayReleased(task, condition))
);
await writeFile(
  resolve(outputDir, "task-results.json"),
  `${JSON.stringify({ schemaVersion: "webarena-task-results.v1", rows }, null, 2)}\n`,
  "utf8"
);
await writeFile(
  validationPath,
  `${JSON.stringify(
    { deterministic, summaryHash: stableHash(first), rowCount: rows.length },
    null,
    2
  )}\n`,
  "utf8"
);

process.stdout.write(
  `Wrote ${first.corpus.shoppingTaskCount} tasks × ${STUDY_A_CONDITIONS.length} conditions (${rows.length} rows)\n`
);
