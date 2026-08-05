import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SimilarityBand = "low" | "medium" | "high";
type Lifecycle = "persist-all" | "intent-weighted" | "outcome-quarantine";
type Algorithm = "content-centroid" | "item-neighborhood" | "sequential-transition" | "global-popularity";

interface Interaction {
  userId: number;
  itemId: number;
  rating: number;
  timestamp: number;
}

interface Movie {
  id: number;
  title: string;
  genres: number[];
}

interface WeightedEvent {
  itemId: number;
  weight: number;
}

interface ExperimentRow {
  caseId: string;
  similarityBand: SimilarityBand;
  measuredTaskSimilarity: number;
  targetGenre: string;
  algorithm: Algorithm;
  lifecycle: Lifecycle;
  baselineTargetSlotsAt10: number;
  treatmentTargetSlotsAt10: number;
  excessTargetSlotsAt10: number;
  rankingDisplacementAt10: number;
  baselineRecallAt10: number;
  treatmentRecallAt10: number;
  recallDeltaAt10: number;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputDirectory = resolve(root, "artifacts/datasets/movielens-100k");
const outputDirectory = resolve(root, "public/results/external-validity/v1");
const genreNames = [
  "unknown", "Action", "Adventure", "Animation", "Children's", "Comedy",
  "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror",
  "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"
];
const algorithms: Algorithm[] = [
  "content-centroid", "item-neighborhood", "sequential-transition", "global-popularity"
];
const lifecycles: Lifecycle[] = ["persist-all", "intent-weighted", "outcome-quarantine"];
const bands: SimilarityBand[] = ["low", "medium", "high"];
const lifecycleWeight: Record<Lifecycle, number> = {
  "persist-all": 1,
  "intent-weighted": 0.25,
  "outcome-quarantine": 0
};
const round = (value: number) => Number(value.toFixed(6));

function parseInteractions(text: string): Interaction[] {
  return text.trim().split(/\r?\n/).map((line) => {
    const [userId, itemId, rating, timestamp] = line.split("\t").map(Number);
    return { userId, itemId, rating, timestamp };
  });
}

function parseMovies(text: string): Movie[] {
  return text.trim().split(/\r?\n/).map((line) => {
    const fields = line.split("|");
    return {
      id: Number(fields[0]),
      title: fields[1],
      genres: fields.slice(5, 24).map(Number)
    };
  });
}

function mean<T>(rows: T[], accessor: (row: T) => number) {
  return rows.length === 0 ? 0 : rows.reduce((total, row) => total + accessor(row), 0) / rows.length;
}

function topKFromScores(
  candidates: number[],
  scores: Map<number, number>,
  support: Map<number, number>,
  k = 10
) {
  return [...candidates]
    .sort((left, right) =>
      (scores.get(right) ?? 0) - (scores.get(left) ?? 0) ||
      (support.get(right) ?? 0) - (support.get(left) ?? 0) ||
      left - right
    )
    .slice(0, k);
}

function buildGlobalModels(trainingByUser: Map<number, Interaction[]>, maxItemId: number) {
  const support = new Map<number, number>();
  const pairCounts = new Map<number, number>();
  const transitions = new Map<number, Map<number, number>>();
  const pairBase = maxItemId + 1;

  for (const events of trainingByUser.values()) {
    const uniqueRecent = [...new Set(events.slice(-80).map((event) => event.itemId))];
    uniqueRecent.forEach((itemId) => support.set(itemId, (support.get(itemId) ?? 0) + 1));
    for (let leftIndex = 0; leftIndex < uniqueRecent.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < uniqueRecent.length; rightIndex += 1) {
        const left = Math.min(uniqueRecent[leftIndex], uniqueRecent[rightIndex]);
        const right = Math.max(uniqueRecent[leftIndex], uniqueRecent[rightIndex]);
        const key = left * pairBase + right;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
    for (let index = 1; index < events.length; index += 1) {
      const from = events[index - 1].itemId;
      const to = events[index].itemId;
      const row = transitions.get(from) ?? new Map<number, number>();
      row.set(to, (row.get(to) ?? 0) + 1);
      transitions.set(from, row);
    }
  }

  const neighbors = new Map<number, Array<{ itemId: number; score: number }>>();
  for (const [key, count] of pairCounts) {
    const left = Math.floor(key / pairBase);
    const right = key % pairBase;
    const similarity = count / Math.sqrt((support.get(left) ?? 1) * (support.get(right) ?? 1));
    const leftRows = neighbors.get(left) ?? [];
    const rightRows = neighbors.get(right) ?? [];
    leftRows.push({ itemId: right, score: similarity });
    rightRows.push({ itemId: left, score: similarity });
    neighbors.set(left, leftRows);
    neighbors.set(right, rightRows);
  }
  for (const [itemId, rows] of neighbors) {
    neighbors.set(itemId, rows.sort((a, b) => b.score - a.score || a.itemId - b.itemId).slice(0, 120));
  }

  const transitionProbabilities = new Map<number, Array<{ itemId: number; score: number }>>();
  for (const [from, counts] of transitions) {
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    transitionProbabilities.set(
      from,
      [...counts].map(([itemId, count]) => ({ itemId, score: count / total }))
        .sort((a, b) => b.score - a.score || a.itemId - b.itemId)
        .slice(0, 120)
    );
  }
  return { support, neighbors, transitionProbabilities };
}

function rank(
  algorithm: Algorithm,
  events: WeightedEvent[],
  candidates: number[],
  movieById: Map<number, Movie>,
  support: Map<number, number>,
  neighbors: Map<number, Array<{ itemId: number; score: number }>>,
  transitionProbabilities: Map<number, Array<{ itemId: number; score: number }>>
) {
  const active = events.filter((event) => event.weight > 0);
  const scores = new Map<number, number>();
  if (algorithm === "global-popularity") {
    for (const itemId of candidates) scores.set(itemId, support.get(itemId) ?? 0);
  } else if (algorithm === "content-centroid") {
    const profile = Array(genreNames.length).fill(0) as number[];
    active.forEach((event, index) => {
      const recency = Math.pow(0.985, active.length - index - 1);
      movieById.get(event.itemId)?.genres.forEach((value, genre) => {
        profile[genre] += value * event.weight * recency;
      });
    });
    for (const itemId of candidates) {
      const movie = movieById.get(itemId)!;
      const genreCount = Math.max(1, movie.genres.reduce((sum, value) => sum + value, 0));
      const content = movie.genres.reduce((sum, value, genre) => sum + value * profile[genre], 0) / Math.sqrt(genreCount);
      scores.set(itemId, content + (support.get(itemId) ?? 0) * 1e-5);
    }
  } else if (algorithm === "item-neighborhood") {
    active.slice(-40).forEach((event, index, recent) => {
      const recency = Math.pow(0.97, recent.length - index - 1);
      for (const neighbor of neighbors.get(event.itemId) ?? []) {
        scores.set(neighbor.itemId, (scores.get(neighbor.itemId) ?? 0) + neighbor.score * event.weight * recency);
      }
    });
    for (const itemId of candidates) scores.set(itemId, (scores.get(itemId) ?? 0) + (support.get(itemId) ?? 0) * 1e-6);
  } else {
    active.slice(-8).forEach((event, index, recent) => {
      const recency = Math.pow(0.58, recent.length - index - 1);
      for (const next of transitionProbabilities.get(event.itemId) ?? []) {
        scores.set(next.itemId, (scores.get(next.itemId) ?? 0) + next.score * event.weight * recency);
      }
    });
    for (const itemId of candidates) scores.set(itemId, (scores.get(itemId) ?? 0) + (support.get(itemId) ?? 0) * 1e-7);
  }
  return topKFromScores(candidates, scores, support);
}

function measuredSimilarity(history: Interaction[], targetGenre: number, movieById: Map<number, Movie>) {
  const profile = Array(genreNames.length).fill(0) as number[];
  for (const event of history) {
    movieById.get(event.itemId)?.genres.forEach((value, genre) => { profile[genre] += value; });
  }
  const norm = Math.sqrt(profile.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? 0 : profile[targetGenre] / norm;
}

function selectTasks(
  userId: number,
  history: Interaction[],
  allUserItems: Set<number>,
  movies: Movie[],
  movieById: Map<number, Movie>,
  support: Map<number, number>
) {
  const eligibleGenres = genreNames.slice(1).map((_, index) => index + 1)
    .map((genre) => ({
      genre,
      similarity: measuredSimilarity(history, genre, movieById),
      candidates: movies.filter((movie) => movie.genres[genre] === 1 && !allUserItems.has(movie.id) && (support.get(movie.id) ?? 0) >= 5)
    }))
    .filter((row) => row.candidates.length >= 4)
    .sort((a, b) => a.similarity - b.similarity || a.genre - b.genre);
  if (eligibleGenres.length < 3) return [];
  const indexes = [0, Math.floor((eligibleGenres.length - 1) / 2), eligibleGenres.length - 1];
  return indexes.map((index, bandIndex) => {
    const selected = eligibleGenres[index];
    const ordered = [...selected.candidates].sort((a, b) =>
      (support.get(b.id) ?? 0) - (support.get(a.id) ?? 0) || a.id - b.id
    );
    const offset = (userId * 17 + selected.genre * 13) % Math.max(1, ordered.length - 3);
    return {
      band: bands[bandIndex],
      genre: selected.genre,
      similarity: selected.similarity,
      injected: ordered.slice(offset, offset + 4).map((movie) => movie.id)
    };
  });
}

const dataBytes = await readFile(resolve(inputDirectory, "u.data"));
const itemBytes = await readFile(resolve(inputDirectory, "u.item"));
const inputManifest = JSON.parse(await readFile(resolve(inputDirectory, "manifest.json"), "utf8"));
const interactions = parseInteractions(dataBytes.toString("utf8"));
const movies = parseMovies(itemBytes.toString("latin1"));
const movieById = new Map(movies.map((movie) => [movie.id, movie]));
const positiveByUser = new Map<number, Interaction[]>();
for (const interaction of interactions.filter((row) => row.rating >= 4)) {
  const rows = positiveByUser.get(interaction.userId) ?? [];
  rows.push(interaction);
  positiveByUser.set(interaction.userId, rows);
}
for (const [userId, rows] of positiveByUser) {
  positiveByUser.set(userId, rows.sort((a, b) => a.timestamp - b.timestamp || a.itemId - b.itemId));
}

const eligibleUsers = [...positiveByUser].filter(([, rows]) => rows.length >= 20);
const trainingByUser = new Map<number, Interaction[]>();
const futureByUser = new Map<number, Interaction[]>();
for (const [userId, rows] of eligibleUsers) {
  const split = Math.max(14, Math.min(rows.length - 5, Math.floor(rows.length * 0.7)));
  trainingByUser.set(userId, rows.slice(0, split));
  futureByUser.set(userId, rows.slice(split));
}
const { support, neighbors, transitionProbabilities } = buildGlobalModels(trainingByUser, Math.max(...movies.map((movie) => movie.id)));
const rows: ExperimentRow[] = [];

for (const [userId, history] of trainingByUser) {
  const future = futureByUser.get(userId)!;
  const allUserItems = new Set(positiveByUser.get(userId)!.map((event) => event.itemId));
  const tasks = selectTasks(userId, history, allUserItems, movies, movieById, support);
  for (const task of tasks) {
    const excluded = new Set([...history.map((event) => event.itemId), ...task.injected]);
    const candidates = movies.filter((movie) => !excluded.has(movie.id) && (support.get(movie.id) ?? 0) >= 5).map((movie) => movie.id);
    const futureSet = new Set(future.map((event) => event.itemId).filter((itemId) => candidates.includes(itemId)));
    const baseEvents = history.map((event) => ({ itemId: event.itemId, weight: 1 }));
    for (const algorithm of algorithms) {
      const baseline = rank(algorithm, baseEvents, candidates, movieById, support, neighbors, transitionProbabilities);
      const baselineTarget = baseline.filter((itemId) => movieById.get(itemId)!.genres[task.genre] === 1).length;
      const recallDenominator = Math.max(1, Math.min(10, futureSet.size));
      const baselineRecall = baseline.filter((itemId) => futureSet.has(itemId)).length / recallDenominator;
      for (const lifecycle of lifecycles) {
        const treatmentEvents = [
          ...baseEvents,
          ...task.injected.map((itemId) => ({ itemId, weight: lifecycleWeight[lifecycle] }))
        ];
        const treatment = rank(algorithm, treatmentEvents, candidates, movieById, support, neighbors, transitionProbabilities);
        const treatmentTarget = treatment.filter((itemId) => movieById.get(itemId)!.genres[task.genre] === 1).length;
        const treatmentRecall = treatment.filter((itemId) => futureSet.has(itemId)).length / recallDenominator;
        const overlap = treatment.filter((itemId) => baseline.includes(itemId)).length;
        rows.push({
          caseId: createHash("sha256")
            .update(`${userId}:${task.band}`)
            .digest("hex")
            .slice(0, 12),
          similarityBand: task.band,
          measuredTaskSimilarity: round(task.similarity),
          targetGenre: genreNames[task.genre],
          algorithm,
          lifecycle,
          baselineTargetSlotsAt10: baselineTarget,
          treatmentTargetSlotsAt10: treatmentTarget,
          excessTargetSlotsAt10: Math.max(0, treatmentTarget - baselineTarget),
          rankingDisplacementAt10: round(1 - overlap / 10),
          baselineRecallAt10: round(baselineRecall),
          treatmentRecallAt10: round(treatmentRecall),
          recallDeltaAt10: round(treatmentRecall - baselineRecall)
        });
      }
    }
  }
}

const aggregate = (members: ExperimentRow[]) => ({
  pairedCaseCount: members.length,
  meanMeasuredTaskSimilarity: round(mean(members, (row) => row.measuredTaskSimilarity)),
  meanExcessTargetSlotsAt10: round(mean(members, (row) => row.excessTargetSlotsAt10)),
  spilloverRate: round(mean(members, (row) => Number(row.excessTargetSlotsAt10 > 0))),
  meanRankingDisplacementAt10: round(mean(members, (row) => row.rankingDisplacementAt10)),
  meanRecallDeltaAt10: round(mean(members, (row) => row.recallDeltaAt10))
});
const cells = algorithms.flatMap((algorithm) =>
  lifecycles.flatMap((lifecycle) =>
    bands.map((similarityBand) => ({
      algorithm,
      lifecycle,
      similarityBand,
      ...aggregate(rows.filter((row) => row.algorithm === algorithm && row.lifecycle === lifecycle && row.similarityBand === similarityBand))
    }))
  )
);
const algorithmLifecycle = algorithms.flatMap((algorithm) =>
  lifecycles.map((lifecycle) => ({
    algorithm,
    lifecycle,
    ...aggregate(rows.filter((row) => row.algorithm === algorithm && row.lifecycle === lifecycle))
  }))
);
const personalized = algorithms.filter((algorithm) => algorithm !== "global-popularity");
const lookup = (algorithm: Algorithm, lifecycle: Lifecycle) => algorithmLifecycle.find((row) => row.algorithm === algorithm && row.lifecycle === lifecycle)!;
const positivePersistAlgorithms = personalized.filter((algorithm) => lookup(algorithm, "persist-all").meanExcessTargetSlotsAt10 > 0);
const summary = {
  schemaVersion: "external-validity-cross-task.v1",
  evidenceStatus: "real-history-counterfactual-injection",
  generatedAt: new Date().toISOString(),
  dataset: {
    name: "MovieLens 100K",
    sourcePage: inputManifest.sourcePage,
    ratingCount: interactions.length,
    itemCount: movies.length,
    eligibleUserCount: trainingByUser.size,
    positiveDefinition: "rating >= 4",
    chronologicalSplit: "70% observed prefix with at least 5 positive events held out",
    rawRedistributed: false,
    files: inputManifest.files
  },
  design: {
    algorithmCount: algorithms.length,
    algorithms,
    personalizedAlgorithmCount: personalized.length,
    lifecycles,
    similarityBands: bands,
    taskCountPerUser: 3,
    injectedEventsPerTask: 4,
    topK: 10,
    rowCount: rows.length,
    pairedDefinition: "Same real history, candidate set, held-out future, global model, and tie-breaking; only activation weight of four counterfactual temporary-task events changes.",
    similarityDefinition: "Cosine between the observed-history genre centroid and the one-hot injected target genre; bands are within-user quantiles.",
    domainBoundary: "Real movie-rating histories with counterfactual delegated-task injection; not observed agent behavior and not an e-commerce estimate."
  },
  cells,
  algorithmLifecycle,
  observedComparisons: {
    positivePersistAlgorithms,
    positivePersistAlgorithmCount: positivePersistAlgorithms.length,
    personalizedPersistMeanExcess: round(mean(personalized, (algorithm) => lookup(algorithm, "persist-all").meanExcessTargetSlotsAt10)),
    personalizedIntentMeanExcess: round(mean(personalized, (algorithm) => lookup(algorithm, "intent-weighted").meanExcessTargetSlotsAt10)),
    quarantineMaxExcess: Math.max(...rows.filter((row) => row.lifecycle === "outcome-quarantine").map((row) => row.excessTargetSlotsAt10)),
    quarantineMaxDisplacement: Math.max(...rows.filter((row) => row.lifecycle === "outcome-quarantine").map((row) => row.rankingDisplacementAt10)),
    popularityMaxDisplacement: Math.max(...rows.filter((row) => row.algorithm === "global-popularity").map((row) => row.rankingDisplacementAt10))
  },
  claims: {
    observed: [
      "The paired injection effect was evaluated on real chronological histories across three personalized recommender families.",
      "Pre-activation quarantine reproduced the no-injection ranking exactly by construction and verification.",
      "A global-popularity negative control remained invariant because user-history activation cannot affect its scores."
    ],
    notEstablished: [
      "MovieLens users performed delegated tasks or interacted through AI agents.",
      "Movie genres transfer directly to shopping intent, commerce, or commercial ranking systems.",
      "Recommendation displacement implies human attention, preference change, annoyance, or harm."
    ]
  }
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(
  resolve(outputDirectory, "rows.json"),
  `${JSON.stringify({ schemaVersion: "external-validity-cross-task-rows.v1", rows }, null, 2)}\n`,
  "utf8"
);
const outputHash = createHash("sha256").update(JSON.stringify({ rows })).digest("hex");
process.stdout.write(`Wrote ${rows.length} paired rows for ${trainingByUser.size} real histories (${outputHash.slice(0, 12)})\n`);
