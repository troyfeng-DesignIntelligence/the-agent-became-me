import {
  AMAZON_LIFECYCLE_CONDITIONS,
  AMAZON_ACTION_WEIGHTS,
  type AmazonFieldEvent,
  type AmazonLifecycleCondition
} from "./field-lifecycle";

export const CROSS_TASK_TOPICS = [
  "accessible-phone",
  "baby-care",
  "cat-care",
  "first-aid",
  "office-party",
  "everyday-home"
] as const;

export type CrossTaskTopic = (typeof CROSS_TASK_TOPICS)[number];
export type CrossTaskOutcome = "abandoned" | "completed";

export interface CrossTaskScenario {
  id: string;
  label: string;
  temporaryBrief: string;
  temporaryTopic: Exclude<CrossTaskTopic, "everyday-home">;
  followUpBrief: string;
}

export interface ExposureItem {
  id: string;
  label: string;
  topic: CrossTaskTopic;
  quality: number;
}

export interface ExposureSnapshot {
  phase: "provisional" | "follow-up";
  round: number;
  profile: Record<CrossTaskTopic, number>;
  recommendations: ExposureItem[];
  temporaryTopicExposure: number;
  currentTaskExposure: number;
}

export interface CrossTaskSimulationParameters {
  /** Share of the 0.92 relevance/profile score budget assigned to profile evidence. */
  profileWeight: number;
  /** Fraction of temporary evidence removed before each follow-up surface. */
  decayRate: number;
  /** Contextual relevance of the temporary topic to the follow-up task, from 0 to 1. */
  taskSimilarity: number;
}

export const DEFAULT_CROSS_TASK_PARAMETERS: CrossTaskSimulationParameters = {
  profileWeight: 0.72,
  decayRate: 0,
  taskSimilarity: 0.095238
};

export interface CrossTaskRun {
  scenarioId: string;
  seed: number;
  condition: AmazonLifecycleCondition;
  outcome: CrossTaskOutcome;
  provisionalExposureCount: number;
  provisionalExcessExposureCount: number;
  postTaskExposureCount: number;
  postTaskExposureRounds: number;
  postTaskExcessExposureCount: number;
  postTaskExcessExposureRounds: number;
  firstExcessCleanRound: number;
  firstCleanRound: number;
  currentTaskRecommendationShare: number;
  temporaryEvidenceMass: number;
  finalTemporaryProfileMass: number;
  snapshots: ExposureSnapshot[];
}

export const CROSS_TASK_SCENARIOS: CrossTaskScenario[] = [
  {
    id: "senior-phone",
    label: "Phone for an older relative",
    temporaryBrief: "Find a large-button corded phone for an older relative.",
    temporaryTopic: "accessible-phone",
    followUpBrief: "Return to ordinary household shopping for yourself."
  },
  {
    id: "newborn-gift",
    label: "Gift for a newborn",
    temporaryBrief: "Compare practical newborn gifts for a colleague.",
    temporaryTopic: "baby-care",
    followUpBrief: "Return to ordinary household shopping for yourself."
  },
  {
    id: "cat-sitting",
    label: "Supplies while cat-sitting",
    temporaryBrief: "Buy short-term cat supplies while pet-sitting for a friend.",
    temporaryTopic: "cat-care",
    followUpBrief: "Return to ordinary household shopping for yourself."
  },
  {
    id: "first-aid-research",
    label: "First-aid research",
    temporaryBrief: "Research first-aid supplies for an office kit.",
    temporaryTopic: "first-aid",
    followUpBrief: "Return to ordinary household shopping for yourself."
  },
  {
    id: "office-party",
    label: "Office party supplies",
    temporaryBrief: "Compare disposable party supplies for a one-off office event.",
    temporaryTopic: "office-party",
    followUpBrief: "Return to ordinary household shopping for yourself."
  }
];

const TOPIC_LABELS: Record<CrossTaskTopic, string[]> = {
  "accessible-phone": [
    "Amplified corded phone",
    "Large-button desk phone",
    "Photo-dial telephone",
    "High-volume ringer",
    "Low-vision keypad phone",
    "Emergency contact phone",
    "Hearing-compatible handset",
    "Simple caller-ID phone"
  ],
  "baby-care": [
    "Newborn swaddle",
    "Bottle starter set",
    "Muslin cloth pack",
    "Changing mat",
    "Baby bath towel",
    "Newborn sleep suit",
    "Nappy caddy",
    "Soft rattle"
  ],
  "cat-care": [
    "Cat litter tray",
    "Dry cat food",
    "Cat water bowl",
    "Scratch pad",
    "Cat carrier liner",
    "Litter scoop",
    "Cat toy wand",
    "Odour-control litter"
  ],
  "first-aid": [
    "Adhesive bandages",
    "Instant cold pack",
    "Sterile gauze kit",
    "Antiseptic wipes",
    "First-aid scissors",
    "Burn dressing",
    "Elastic support bandage",
    "Emergency blanket"
  ],
  "office-party": [
    "Paper cup set",
    "Compostable plates",
    "Party napkins",
    "Serving tongs",
    "Table cover",
    "Reusable bunting",
    "Snack bowls",
    "Wooden cutlery set"
  ],
  "everyday-home": [
    "Laundry basket",
    "Kitchen storage jars",
    "Desk organiser",
    "Cotton hand towels",
    "Reusable shopping bags",
    "LED reading lamp",
    "Shoe storage rack",
    "Glass food containers"
  ]
};

const temporaryEvents: AmazonFieldEvent[] = [
  { action: "search", intent: "explore", targetKey: "search:temporary-task" },
  { action: "product-view", intent: "explore", targetKey: "view:result-1" },
  { action: "product-view", intent: "explore", targetKey: "view:result-2" },
  { action: "add-to-cart", intent: "consider", targetKey: "cart:result-1" }
];

const intentMultiplier = {
  explore: 0.22,
  consider: 0.55,
  commit: 1
} as const;

const round = (value: number) => Number(value.toFixed(6));

function hashFloat(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function initialProfile(): Record<CrossTaskTopic, number> {
  return {
    "accessible-phone": 0.04,
    "baby-care": 0.04,
    "cat-care": 0.04,
    "first-aid": 0.04,
    "office-party": 0.04,
    "everyday-home": 0.22
  };
}

function copyProfile(profile: Record<CrossTaskTopic, number>) {
  return { ...profile };
}

export function createExposureCatalog(seed: number): ExposureItem[] {
  return CROSS_TASK_TOPICS.flatMap((topic) =>
    TOPIC_LABELS[topic].map((label, index) => ({
      id: `${topic}:${index + 1}`,
      label,
      topic,
      quality: round(0.45 + hashFloat(`${seed}:${topic}:${index}`) * 0.5)
    }))
  );
}

function eventWeight(
  event: AmazonFieldEvent,
  condition: AmazonLifecycleCondition
) {
  const base = AMAZON_ACTION_WEIGHTS[event.action];
  if (condition === "intent-weighted") {
    return base * intentMultiplier[event.intent];
  }
  if (condition === "scope-gated") {
    return event.action === "purchase" && event.intent === "commit" ? base : 0;
  }
  return base;
}

function rankRecommendations(
  catalog: ExposureItem[],
  profile: Record<CrossTaskTopic, number>,
  temporaryTopic: CrossTaskScenario["temporaryTopic"],
  phase: ExposureSnapshot["phase"],
  seed: number,
  roundIndex: number,
  parameters: CrossTaskSimulationParameters
) {
  const profileWeight = Math.min(0.86, Math.max(0.06, parameters.profileWeight));
  const taskWeight = 0.92 - profileWeight;
  const taskSimilarity = Math.min(1, Math.max(0, parameters.taskSimilarity));
  return [...catalog]
    .map((item) => {
      const relevance =
        phase === "provisional"
          ? item.topic === temporaryTopic
            ? 0.88
            : item.topic === "everyday-home"
              ? 0.12
              : 0.04
          : item.topic === "everyday-home"
            ? 0.88
            : item.topic === temporaryTopic
              ? 0.04 + taskSimilarity * 0.84
              : 0.04;
      const jitter = hashFloat(`${seed}:${roundIndex}:${item.id}`) * 0.012;
      return {
        item,
        score:
          relevance * taskWeight +
          profile[item.topic] * profileWeight +
          item.quality * 0.08 +
          jitter
      };
    })
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, 6)
    .map(({ item }) => item);
}

function snapshot(
  phase: ExposureSnapshot["phase"],
  roundIndex: number,
  catalog: ExposureItem[],
  profile: Record<CrossTaskTopic, number>,
  scenario: CrossTaskScenario,
  seed: number,
  parameters: CrossTaskSimulationParameters
): ExposureSnapshot {
  const recommendations = rankRecommendations(
    catalog,
    profile,
    scenario.temporaryTopic,
    phase,
    seed,
    roundIndex,
    parameters
  );
  return {
    phase,
    round: roundIndex,
    profile: copyProfile(profile),
    recommendations,
    temporaryTopicExposure: recommendations.filter(
      (item) => item.topic === scenario.temporaryTopic
    ).length,
    currentTaskExposure: recommendations.filter(
      (item) => item.topic === (phase === "provisional" ? scenario.temporaryTopic : "everyday-home")
    ).length
  };
}

export function simulateCrossTaskExposure(
  scenario: CrossTaskScenario,
  condition: AmazonLifecycleCondition,
  seed: number,
  outcome: CrossTaskOutcome = "abandoned",
  parameters: CrossTaskSimulationParameters = DEFAULT_CROSS_TASK_PARAMETERS
): CrossTaskRun {
  const catalog = createExposureCatalog(seed);
  const baseline = initialProfile();
  const active = copyProfile(baseline);
  let stagedTemporaryMass = 0;
  const snapshots: ExposureSnapshot[] = [];
  const seen = new Set<string>();

  temporaryEvents.forEach((event, index) => {
    if (condition === "deduplicate-target" && seen.has(event.targetKey)) return;
    seen.add(event.targetKey);
    const weight = eventWeight(event, condition);
    if (condition === "outcome-quarantine") {
      stagedTemporaryMass += weight;
    } else {
      active[scenario.temporaryTopic] += weight;
    }
    snapshots.push(
      snapshot(
        "provisional",
        index + 1,
        catalog,
        active,
        scenario,
        seed,
        parameters
      )
    );
  });

  const temporaryEvidenceMass =
    active[scenario.temporaryTopic] - baseline[scenario.temporaryTopic] + stagedTemporaryMass;

  if (condition === "outcome-quarantine" && outcome === "completed") {
    active[scenario.temporaryTopic] += stagedTemporaryMass;
  }
  if (condition === "rollback-on-failure" && outcome === "abandoned") {
    active[scenario.temporaryTopic] = baseline[scenario.temporaryTopic];
  }
  if (condition === "outcome-quarantine" && outcome === "abandoned") {
    stagedTemporaryMass = 0;
  }

  const followUpExcesses: number[] = [];
  const counterfactual = copyProfile(baseline);
  for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
    const retainedTemporaryMass = Math.max(
      0,
      active[scenario.temporaryTopic] - baseline[scenario.temporaryTopic]
    );
    active[scenario.temporaryTopic] =
      baseline[scenario.temporaryTopic] +
      retainedTemporaryMass * (1 - Math.min(1, Math.max(0, parameters.decayRate)));
    const observed = snapshot(
      "follow-up",
      roundIndex,
      catalog,
      active,
      scenario,
      seed + 1000,
      parameters
    );
    const withoutTemporaryProfile = snapshot(
      "follow-up",
      roundIndex,
      catalog,
      counterfactual,
      scenario,
      seed + 1000,
      parameters
    );
    snapshots.push(observed);
    followUpExcesses.push(
      Math.max(
        0,
        observed.temporaryTopicExposure -
          withoutTemporaryProfile.temporaryTopicExposure
      )
    );
    active["everyday-home"] = Math.min(1.2, active["everyday-home"] + 0.16);
    counterfactual["everyday-home"] = Math.min(
      1.2,
      counterfactual["everyday-home"] + 0.16
    );
  }

  const provisional = snapshots.filter((row) => row.phase === "provisional");
  const followUp = snapshots.filter((row) => row.phase === "follow-up");
  const provisionalExcessExposureCount = provisional.reduce((total, row) => {
    const counterfactual = snapshot(
      "provisional",
      row.round,
      catalog,
      baseline,
      scenario,
      seed,
      parameters
    );
    return (
      total +
      Math.max(
        0,
        row.temporaryTopicExposure - counterfactual.temporaryTopicExposure
      )
    );
  }, 0);
  const clean = followUp.find((row) => row.temporaryTopicExposure === 0);
  const firstExcessCleanIndex = followUpExcesses.findIndex((value) => value === 0);
  const currentExposure = followUp.reduce(
    (total, row) => total + row.currentTaskExposure,
    0
  );

  return {
    scenarioId: scenario.id,
    seed,
    condition,
    outcome,
    provisionalExposureCount: provisional.reduce(
      (total, row) => total + row.temporaryTopicExposure,
      0
    ),
    provisionalExcessExposureCount,
    postTaskExposureCount: followUp.reduce(
      (total, row) => total + row.temporaryTopicExposure,
      0
    ),
    postTaskExposureRounds: followUp.filter(
      (row) => row.temporaryTopicExposure > 0
    ).length,
    postTaskExcessExposureCount: followUpExcesses.reduce(
      (total, value) => total + value,
      0
    ),
    postTaskExcessExposureRounds: followUpExcesses.filter((value) => value > 0)
      .length,
    firstExcessCleanRound:
      firstExcessCleanIndex === -1 ? 9 : firstExcessCleanIndex + 1,
    firstCleanRound: clean?.round ?? 9,
    currentTaskRecommendationShare: round(currentExposure / (followUp.length * 6)),
    temporaryEvidenceMass: round(temporaryEvidenceMass),
    finalTemporaryProfileMass: round(active[scenario.temporaryTopic]),
    snapshots
  };
}

export function generateCrossTaskRuns(
  seedsPerScenario = 40,
  outcome: CrossTaskOutcome = "abandoned"
) {
  return CROSS_TASK_SCENARIOS.flatMap((scenario) =>
    Array.from({ length: seedsPerScenario }, (_, index) => index + 1).flatMap(
      (seed) =>
        AMAZON_LIFECYCLE_CONDITIONS.map((condition) =>
          simulateCrossTaskExposure(scenario, condition, seed, outcome)
        )
    )
  );
}

export function summarizeCrossTaskRuns(runs: CrossTaskRun[]) {
  return AMAZON_LIFECYCLE_CONDITIONS.map((condition) => {
    const rows = runs.filter((run) => run.condition === condition);
    const mean = (key: keyof CrossTaskRun) =>
      round(
        rows.reduce((total, row) => total + Number(row[key]), 0) /
          Math.max(1, rows.length)
      );
    return {
      condition,
      runCount: rows.length,
      meanProvisionalExposureCount: mean("provisionalExposureCount"),
      meanProvisionalExcessExposureCount: mean(
        "provisionalExcessExposureCount"
      ),
      meanPostTaskExposureCount: mean("postTaskExposureCount"),
      meanPostTaskExposureRounds: mean("postTaskExposureRounds"),
      meanFirstCleanRound: mean("firstCleanRound"),
      meanCurrentTaskRecommendationShare: mean("currentTaskRecommendationShare"),
      meanTemporaryEvidenceMass: mean("temporaryEvidenceMass")
    };
  });
}
