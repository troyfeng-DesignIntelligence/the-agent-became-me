#!/usr/bin/env python3
import json
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
import numpy as np


SUMMARY = os.path.join(
    PROJECT_ROOT, "public", "results", "webarena-pilot", "v1", "summary.json"
)
OUTPUT = os.path.dirname(os.path.abspath(__file__))

with open(SUMMARY, encoding="utf-8") as handle:
    summary = json.load(handle)

class_labels = [
    "Product\ndiscovery",
    "Account / order\noperation",
    "Communication",
    "Preference\nstaging",
    "Review\nresearch",
    "Purchase",
]
class_keys = [
    "product-discovery",
    "account-or-order-operation",
    "communication",
    "preference-staging",
    "review-research",
    "purchase",
]
class_values = [summary["corpus"]["taskClassCounts"][key] for key in class_keys]

condition_labels = [
    "Actor-\nblind",
    "Logged\nonly",
    "Matched\nattenuation",
    "Provenance-\naware",
    "Scope-gated",
    "No\nupdate",
]
totals = np.array([row["meanPersistentEvidenceMass"] for row in summary["results"]])
noncommit = np.array(
    [row["meanNonCommitPersistentMass"] for row in summary["results"]]
)
commit = totals - noncommit

fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.8), gridspec_kw={"width_ratios": [0.9, 1.25]})

axes[0].barh(class_labels[::-1], class_values[::-1], color="#647C90")
for index, value in enumerate(class_values[::-1]):
    axes[0].text(value + 1, index, str(value), va="center", fontsize=9)
axes[0].set_xlim(0, max(class_values) + 12)
axes[0].set_xlabel("Official shopping tasks")
axes[0].set_title("A. Task intent mix", loc="left", fontweight="bold")

x = np.arange(len(condition_labels))
axes[1].bar(x, noncommit, color="#A96F61", label="non-commit evidence")
axes[1].bar(x, commit, bottom=noncommit, color="#536C86", label="commit evidence")
axes[1].set_xticks(x, condition_labels, fontsize=8)
axes[1].set_ylabel("Mean persistent evidence mass / task")
axes[1].set_title("B. Same released traces, six update contracts", loc="left", fontweight="bold")
axes[1].legend(frameon=False, loc="upper right")
axes[1].annotate(
    "−81.4% total mass\n0 non-commit mass",
    xy=(4, totals[4]),
    xytext=(3.25, totals[0] * 0.72),
    arrowprops={"arrowstyle": "->", "color": "#333333", "lw": 1},
    fontsize=9,
)

fig.suptitle(
    "Released WebArena shopping trajectories: downstream profile-evidence replay",
    x=0.06,
    y=1.02,
    ha="left",
    fontsize=14,
    fontweight="bold",
)
fig.text(
    0.06,
    -0.02,
    "192 GPT-4 CoT traces · 1,740 audited steps · 160 conservatively mapped evidence events · not human data",
    fontsize=9,
)
fig.tight_layout(pad=1.6)
fig.savefig(os.path.join(OUTPUT, "webarena-results.png"), dpi=600, bbox_inches="tight")
fig.savefig(os.path.join(OUTPUT, "webarena-results.pdf"), dpi=600, bbox_inches="tight")
