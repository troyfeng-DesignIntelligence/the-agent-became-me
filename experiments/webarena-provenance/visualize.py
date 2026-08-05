#!/usr/bin/env python3
import csv
import os
import sys

SKILL_ROOT = r"C:\Users\13088\.codex\skills\autoresearch"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(
    0, os.path.join(PROJECT_ROOT, "artifacts", "webarena-provenance", "python")
)
sys.path.insert(0, os.path.join(SKILL_ROOT, "scripts"))
import matplotlib

matplotlib.use("Agg")
from style_presets import rcparams

rcparams()

import matplotlib.pyplot as plt


ROOT = os.path.dirname(os.path.abspath(__file__))
rows = []
with open(os.path.join(ROOT, "autoresearch-results.tsv"), encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle, delimiter="\t"))

iterations = [int(row["iteration"]) for row in rows]
scores = [float(row["metric_value"]) for row in rows]
best = []
running = float("-inf")
for score in scores:
    running = max(running, score)
    best.append(running)

fig, ax = plt.subplots(figsize=(6.4, 4.4))
for row, iteration, score in zip(rows, iterations, scores):
    kept = row["status"] in {"baseline", "kept", "reference"}
    ax.scatter(
        iteration,
        score,
        color="#0072B2" if kept else "white",
        edgecolor="#0072B2" if kept else "#D55E00",
        linewidth=1.2,
        zorder=3,
    )
ax.plot(iterations, best, color="#009E73", label="best evidence readiness")
ax.axhline(0.9, color="#E69F00", linestyle="--", label="target")
ax.set_xlabel("Iteration")
ax.set_ylabel("Evidence-readiness score")
ax.set_xlim(0, max(1, max(iterations)))
ax.set_ylim(0, 1)
ax.set_xticks(range(0, max(1, max(iterations)) + 1))
ax.set_yticks([0, 0.25, 0.5, 0.75, 0.9, 1.0])
legend = ax.legend(frameon=True, edgecolor="black", framealpha=1, loc="lower right")
for text, color in zip(legend.get_texts(), ["#009E73", "#E69F00"]):
    text.set_color(color)
fig.tight_layout(pad=1.5)
fig.savefig(os.path.join(ROOT, "progress.png"), dpi=600, bbox_inches="tight")
fig.savefig(os.path.join(ROOT, "progress.pdf"), dpi=600, bbox_inches="tight")
