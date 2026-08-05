import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const figureDirectory = resolve(root, "experiments", "paper", "figures");
const crossTask = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-exposure/v1/summary.json"),
    "utf8"
  )
);
const sensitivity = JSON.parse(
  await readFile(
    resolve(root, "public/results/cross-task-sensitivity/v1/summary.json"),
    "utf8"
  )
);
const amazonSasrec = JSON.parse(
  await readFile(
    resolve(root, "public/results/amazon-sasrec/v1/summary.json"),
    "utf8"
  )
);
const amazonCrossCategory = JSON.parse(
  await readFile(
    resolve(root, "public/results/amazon-cross-category/v1/summary.json"),
    "utf8"
  )
);

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function lifecycleFigure() {
  const width = 1240;
  const height = 790;
  const plotX = 350;
  const plotWidth = 760;
  const maximum = 26;
  const rowHeight = 82;
  const bars = crossTask.conditions
    .map((row, index) => {
      const y = 205 + index * rowHeight;
      const provisionalWidth =
        (row.meanProvisionalExcessExposureCount / maximum) * plotWidth;
      const laterWidth = (row.meanPostTaskExposureCount / maximum) * plotWidth;
      return `
        <text x="40" y="${y + 25}" class="label">${escapeXml(
          row.condition.replaceAll("-", " ")
        )}</text>
        <rect x="${plotX}" y="${y}" width="${laterWidth}" height="28" fill="#61758d" />
        <rect x="${plotX}" y="${y + 34}" width="${provisionalWidth}" height="18" fill="#a75f52" />
        <text x="${plotX + laterWidth + 10}" y="${y + 20}" class="value">${row.meanPostTaskExposureCount.toFixed(
          2
        )}</text>
        <text x="${plotX + provisionalWidth + 10}" y="${y + 49}" class="value warm">${row.meanProvisionalExcessExposureCount.toFixed(
          2
        )}</text>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .kicker{font:700 13px Arial,sans-serif;letter-spacing:2px;fill:#9f574b}.title{font:500 48px Georgia,serif;fill:#211f1c}.subtitle{font:400 17px Arial,sans-serif;fill:#68635c}.label{font:600 17px Arial,sans-serif;fill:#282521;text-transform:capitalize}.value{font:700 13px monospace;fill:#4f6175}.value.warm{fill:#8e5046}.axis{font:600 12px monospace;fill:#79736a}.note{font:400 13px Arial,sans-serif;fill:#6a655d}
  </style>
  <rect width="100%" height="100%" fill="#eee9de" />
  <text x="40" y="48" class="kicker">FIGURE 4 / CONTROLLED CROSS-TASK EXPOSURE</text>
  <text x="40" y="104" class="title">When the task ended, what remained?</text>
  <text x="40" y="140" class="subtitle">Five scenarios × 40 paired seeds; abandoned outcome; six recommendation slots per surface.</text>
  <rect x="760" y="62" width="22" height="12" fill="#61758d" /><text x="792" y="73" class="axis">later temporary-topic slots</text>
  <rect x="760" y="90" width="22" height="12" fill="#a75f52" /><text x="792" y="101" class="axis">provisional excess slots</text>
  ${bars}
  <line x1="${plotX}" y1="690" x2="${plotX + plotWidth}" y2="690" stroke="#918b82" stroke-width="1" />
  ${[0, 5, 10, 15, 20, 25]
    .map(
      (tick) =>
        `<text x="${plotX + (tick / maximum) * plotWidth}" y="714" text-anchor="middle" class="axis">${tick}</text>`
    )
    .join("")}
  <text x="40" y="758" class="note">Later exposure is zero after abandoned-task quarantine, rollback, or purchase-only scope; rollback still exposes provisional slots before removal.</text>
</svg>`;
}

function phaseFigure() {
  const width = 1340;
  const height = 840;
  const similarity = 0.5;
  const conditions = ["persist-all", "intent-weighted"];
  const weights = sensitivity.design.profileWeights;
  const decays = [...sensitivity.design.decayRates].reverse();
  const slice = sensitivity.cells.filter(
    (cell) => cell.taskSimilarity === similarity && conditions.includes(cell.condition)
  );
  const maximum = Math.max(
    ...slice.map((cell) => cell.meanPostTaskExcessExposureCount)
  );
  const cellSize = 84;
  const gap = 6;
  const panelWidth = weights.length * (cellSize + gap);
  const color = (value) => {
    const ratio = maximum ? value / maximum : 0;
    const lightness = Math.round(94 - ratio * 53);
    return `hsl(8 35% ${lightness}%)`;
  };
  const panel = (condition, panelIndex) => {
    const x0 = 140 + panelIndex * 620;
    const y0 = 238;
    const cells = decays
      .flatMap((decay, rowIndex) =>
        weights.map((weight, columnIndex) => {
          const cell = slice.find(
            (candidate) =>
              candidate.condition === condition &&
              candidate.decayRate === decay &&
              candidate.profileWeight === weight
          );
          const value = cell?.meanPostTaskExcessExposureCount ?? 0;
          const x = x0 + columnIndex * (cellSize + gap);
          const y = y0 + rowIndex * (cellSize + gap);
          const textColor = value / maximum > 0.48 ? "#f5f0e6" : "#282521";
          return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color(
            value
          )}" stroke="#d0c9bd"/><text x="${x + cellSize / 2}" y="${
            y + cellSize / 2 + 5
          }" text-anchor="middle" class="cell" fill="${textColor}">${value.toFixed(
            1
          )}</text>`;
        })
      )
      .join("");
    const xLabels = weights
      .map(
        (weight, index) =>
          `<text x="${x0 + index * (cellSize + gap) + cellSize / 2}" y="${
            y0 + decays.length * (cellSize + gap) + 20
          }" text-anchor="middle" class="axis">${weight.toFixed(2)}</text>`
      )
      .join("");
    const yLabels = decays
      .map(
        (decay, index) =>
          `<text x="${x0 - 18}" y="${
            y0 + index * (cellSize + gap) + cellSize / 2 + 4
          }" text-anchor="end" class="axis">${decay.toFixed(2)}</text>`
      )
      .join("");
    return `<text x="${x0}" y="204" class="panel">${escapeXml(
      condition.replaceAll("-", " ")
    )}</text>${cells}${xLabels}${yLabels}<text x="${
      x0 + panelWidth / 2
    }" y="730" text-anchor="middle" class="axislabel">PROFILE WEIGHT →</text>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.kicker{font:700 13px Arial,sans-serif;letter-spacing:2px;fill:#9f574b}.title{font:500 48px Georgia,serif;fill:#211f1c}.subtitle{font:400 17px Arial,sans-serif;fill:#68635c}.panel{font:650 20px Arial,sans-serif;fill:#282521;text-transform:capitalize}.cell{font:700 14px monospace}.axis{font:600 11px monospace;fill:#726c63}.axislabel{font:700 11px monospace;letter-spacing:1.5px;fill:#726c63}.note{font:400 13px Arial,sans-serif;fill:#6a655d}</style>
  <rect width="100%" height="100%" fill="#eee9de" />
  <text x="50" y="48" class="kicker">FIGURE 5 / POLLUTION PHASE SLICE</text>
  <text x="50" y="104" class="title">Decay moves the pollution boundary.</text>
  <text x="50" y="140" class="subtitle">Mean excess temporary-topic slots at task similarity 0.50; 100 paired runs per cell.</text>
  <text x="54" y="490" transform="rotate(-90 54 490)" text-anchor="middle" class="axislabel">FASTER DECAY →</text>
  ${conditions.map(panel).join("")}
  <text x="50" y="790" class="note">Cell values subtract a no-temporary-profile counterfactual at the same task similarity. This is a synthetic ranking surface, not a platform estimate.</text>
</svg>`;
}

function learnedSasrecFigure() {
  const width = 1340;
  const height = 840;
  const runs = amazonSasrec.model.trainingRuns;
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const modelRows = [
    ["Popularity", average(runs.map((run) => run.test.popularity.ndcgAt10)), "#aaa69e"],
    ["First-order transition", average(runs.map((run) => run.test.firstOrderTransition.ndcgAt10)), "#74858b"],
    ["SASRec", average(runs.map((run) => run.test.sasrec.ndcgAt10)), "#a56659"]
  ];
  const lifecycleOrder = ["persist-all", "outcome-commit", "outcome-quarantine"];
  const lifecycleRows = lifecycleOrder.map((name) =>
    amazonSasrec.taskBoundary.lifecycle.find((row) => row.lifecycle === name)
  );
  const modelBars = modelRows.map(([label, value, color], index) => {
    const y = 250 + index * 112;
    const barWidth = Number(value) / 0.5 * 450;
    return `<text x="70" y="${y + 22}" class="label">${label}</text><rect x="280" y="${y}" width="${barWidth}" height="34" fill="${color}"/><text x="${290 + barWidth}" y="${y + 24}" class="value">${Number(value).toFixed(3)}</text>`;
  }).join("");
  const lifecycleBars = lifecycleRows.map((row, index) => {
    const y = 250 + index * 112;
    const value = row.meanExcessTargetSlotsAt10;
    const barWidth = value / 0.45 * 360;
    const color = row.lifecycle === "outcome-quarantine" ? "#74858b" : "#a56659";
    return `<text x="760" y="${y + 22}" class="label">${escapeXml(row.lifecycle.replaceAll("-", " "))}</text><rect x="990" y="${y}" width="${barWidth}" height="34" fill="${color}"/><text x="${1000 + barWidth}" y="${y + 24}" class="value">${value > 0 ? "+" : ""}${value.toFixed(3)}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.kicker{font:700 13px Arial,sans-serif;letter-spacing:2px;fill:#9f574b}.title{font:500 48px Georgia,serif;fill:#211f1c}.subtitle{font:400 17px Arial,sans-serif;fill:#68635c}.panel{font:650 17px Arial,sans-serif;letter-spacing:1px;fill:#282521}.label{font:600 15px Arial,sans-serif;fill:#35312d;text-transform:capitalize}.value{font:700 13px monospace;fill:#514d48}.note{font:400 13px Arial,sans-serif;fill:#6a655d}.metric{font:500 29px Georgia,serif;fill:#282521}</style>
  <rect width="100%" height="100%" fill="#eee9de" />
  <text x="50" y="48" class="kicker">FIGURE 6 / LEARNED COMMERCE SEQUENCE VALIDATION</text>
  <text x="50" y="104" class="title">The model learned. The temporary task travelled with it.</text>
  <text x="50" y="140" class="subtitle">Amazon Luxury Beauty; 3,811 histories; three SASRec seeds; held-out next item plus 99 fixed negatives.</text>
  <line x1="670" y1="190" x2="670" y2="650" stroke="#b8b1a7"/>
  <text x="70" y="205" class="panel">NEXT-ITEM NDCG@10</text>
  <text x="760" y="205" class="panel">EXCESS TARGET-FAMILY SLOTS @10</text>
  ${modelBars}
  ${lifecycleBars}
  <text x="70" y="690" class="metric">97.2% of reversed histories changed top-10</text>
  <text x="760" y="690" class="metric">Quarantine mismatches: 0</text>
  <text x="50" y="775" class="note">Reviews are real interaction chronologies; temporary delegation is counterfactual. Product-family tokens define evaluation only and are not model inputs.</text>
</svg>`;
}

function crossCategoryFigure() {
  const width = 1340;
  const height = 850;
  const plotX = 410;
  const plotWidth = 720;
  const maximum = 0.8;
  const pooled = amazonCrossCategory.inference.fixedSetEqualCategoryPooledPersistExcess;
  const rows = [
    ...amazonCrossCategory.categories.map((category) => ({
      label: category.label,
      interval: category.uncertainty.persistExcess,
      pooled: false
    })),
    { label: "Equal-category pooled", interval: pooled, pooled: true }
  ];
  const marks = rows.map((row, index) => {
    const y = 258 + index * 94;
    const lower = plotX + row.interval.lower95 / maximum * plotWidth;
    const upper = plotX + row.interval.upper95 / maximum * plotWidth;
    const point = plotX + row.interval.estimate / maximum * plotWidth;
    return `<line x1="70" y1="${y + 35}" x2="1260" y2="${y + 35}" stroke="${row.pooled ? "#6b665f" : "#cbc4b9"}" stroke-width="${row.pooled ? 2 : 1}"/>
      <text x="70" y="${y + 8}" class="${row.pooled ? "label pooled" : "label"}">${escapeXml(row.label)}</text>
      <line x1="${lower}" y1="${y}" x2="${upper}" y2="${y}" stroke="${row.pooled ? "#273a40" : "#74858b"}" stroke-width="${row.pooled ? 11 : 8}"/>
      <circle cx="${point}" cy="${y}" r="${row.pooled ? 11 : 8}" fill="${row.pooled ? "#273a40" : "#a56659"}"/>
      <text x="1190" y="${y + 5}" class="value" text-anchor="end">${row.interval.estimate.toFixed(3)} [${row.interval.lower95.toFixed(3)}, ${row.interval.upper95.toFixed(3)}]</text>`;
  }).join("");
  const ticks = [0, 0.2, 0.4, 0.6, 0.8].map((tick) => {
    const x = plotX + tick / maximum * plotWidth;
    return `<line x1="${x}" y1="205" x2="${x}" y2="690" stroke="#d6cfc4"/><text x="${x}" y="720" text-anchor="middle" class="axis">${tick.toFixed(1)}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.kicker{font:700 13px Arial,sans-serif;letter-spacing:2px;fill:#9f574b}.title{font:500 48px Georgia,serif;fill:#211f1c}.subtitle{font:400 17px Arial,sans-serif;fill:#68635c}.label{font:600 17px Arial,sans-serif;fill:#35312d}.label.pooled{font-weight:800}.value{font:700 13px monospace;fill:#514d48}.axis{font:600 12px monospace;fill:#79736a}.note{font:400 13px Arial,sans-serif;fill:#6a655d}</style>
  <rect width="100%" height="100%" fill="#eee9de"/>
  <text x="50" y="48" class="kicker">FIGURE 7 / CROSS-CATEGORY REPLICATION</text>
  <text x="50" y="104" class="title">The direction held. The size did not.</text>
  <text x="50" y="140" class="subtitle">Persist-all excess target-family slots @10; 2,000 hierarchical user/seed bootstrap replicates.</text>
  ${ticks}${marks}
  <text x="770" y="760" text-anchor="middle" class="axis">EXCESS TARGET-FAMILY SLOTS @10</text>
  <text x="50" y="815" class="note">Four public Amazon review categories; one SASRec protocol; category-specific and fixed-set equal-category 95% intervals. Temporary delegation remains counterfactual.</text>
</svg>`;
}

await mkdir(figureDirectory, { recursive: true });
await writeFile(
  resolve(figureDirectory, "figure-4-lifecycle-exposure.svg"),
  lifecycleFigure(),
  "utf8"
);
await writeFile(
  resolve(figureDirectory, "figure-5-pollution-phase-similarity-050.svg"),
  phaseFigure(),
  "utf8"
);
await writeFile(
  resolve(figureDirectory, "figure-6-learned-sasrec.svg"),
  learnedSasrecFigure(),
  "utf8"
);
await writeFile(
  resolve(figureDirectory, "figure-7-cross-category-uncertainty.svg"),
  crossCategoryFigure(),
  "utf8"
);
process.stdout.write("Generated 4 paper-ready SVG figures.\n");
