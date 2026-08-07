"""Evaluate whether V7 choice divergence changes the next learned-recommender slate.

The frozen V8 bridge replays public V7 actions through the same private,
locally stored SASRec and GRU4Rec checkpoints. It makes no provider calls and
never writes raw catalog identifiers to the public result bundle.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v8/feedback-bridge-protocol.json"
V7_RUNNER_PATH = ROOT / "scripts/run-online-storefront-instrument-ablation.py"
CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]


def load_module(name: str, path: Path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


v7 = load_module("storefront_v7_feedback_source", V7_RUNNER_PATH)


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def public_item(category: str, task_id: str, item: int) -> str:
    return v7.pilot.item_alias(category, task_id, item)


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def load_protocol(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), text


def load_action_rows(protocol: dict) -> dict[tuple[str, str, str, str, str], dict]:
    rows = {}
    for provider, key in [("deepseek", "deepseekRows"), ("mimo", "mimoRows")]:
        payload = json.loads((ROOT / protocol["source"][key]).read_text(encoding="utf-8"))
        for row in payload["rows"]:
            if row["mode"] not in protocol["instrumentModes"]:
                continue
            lookup = (
                provider,
                row["category"],
                row["taskId"],
                row["modelFamily"],
                row["mode"],
            )
            if lookup in rows:
                raise RuntimeError(f"Duplicate V7 action row: {lookup}")
            rows[lookup] = row
    return rows


def top10_displacement(left: list[int], right: list[int], size: int) -> float:
    if len(left) != size or len(right) != size:
        raise RuntimeError("Every downstream slate must have the frozen slate size")
    return 1.0 - len(set(left).intersection(right)) / size


def energy_distance(slates: dict[str, list[int]], size: int) -> float:
    immediate = [slates["immediate-a"], slates["immediate-b"]]
    held = [slates["held-a"], slates["held-b"]]
    cross = [top10_displacement(left, right, size) for left in immediate for right in held]
    within_immediate = top10_displacement(immediate[0], immediate[1], size)
    within_held = top10_displacement(held[0], held[1], size)
    return float(2 * np.mean(cross) - within_immediate - within_held)


def matched_distances(slates: dict[str, list[int]], size: int) -> list[float]:
    return [
        top10_displacement(slates["immediate-a"], slates["held-a"], size),
        top10_displacement(slates["immediate-b"], slates["held-b"], size),
    ]


def v7_candidate_items(
    task: dict,
    products: dict[int, dict],
    scorer,
    candidate_limit: int,
) -> list[int]:
    v2_protocol = json.loads(v7.V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
    conditions = {row["id"]: row for row in v2_protocol["conditions"]}
    search = v7.delegate.search_catalog(task, products)
    initial_viewed = list(search[:2])
    mask = set(task["interacted"]) | set(initial_viewed) | {task["nextTaskItem"]}
    platforms = {}
    for arm, condition_id in [("immediate", "immediate-remove"), ("held", "held-outcome")]:
        context = v7.v2.condition_context(
            task, conditions[condition_id]["id"], initial_viewed, None, "task-in-progress"
        )
        platforms[arm] = scorer.top(context, mask)
    local = v7.delegate.local_recommendations(
        task, products, initial_viewed, set(task["history"]) | set(initial_viewed)
    )
    return v7.base.pooled_candidates(
        task,
        products,
        platforms["immediate"],
        platforms["held"],
        local,
        search,
        candidate_limit,
    )


def action_item_map(
    category: str,
    task_id: str,
    candidate_items: list[int],
) -> dict[str, int]:
    result = {}
    for item in candidate_items:
        alias = public_item(category, task_id, item)
        if alias in result:
            raise RuntimeError(f"Candidate-set alias collision in {category}/{task_id}: {alias}")
        result[alias] = item
    return result


def resolve_action(label: str, aliases: dict[str, int]) -> int | None:
    if label == "__ABANDON__":
        return None
    if label == "__FAILURE__":
        raise RuntimeError("The complete V7 input contains a provider failure")
    if label not in aliases:
        raise RuntimeError(f"Selected alias is absent from the private catalog map: {label}")
    return aliases[label]


def public_row(
    provider: str,
    category: str,
    task: dict,
    family: str,
    seed: int,
    mode: str,
    actions: dict[str, str],
    slates: dict[str, list[int]],
    mask: set[int],
    size: int,
) -> dict:
    paired = matched_distances(slates, size)
    selected_changed = [
        actions["immediate-a"] != actions["held-a"],
        actions["immediate-b"] != actions["held-b"],
    ]
    return {
        "provider": provider,
        "category": category,
        "taskId": task["taskId"],
        "modelFamily": family,
        "modelSeed": seed,
        "mode": mode,
        "selectedActionChanged": selected_changed,
        "matchedSlateDisplacement": [round(value, 6) for value in paired],
        "matchedSlateChanged": [value > 0 for value in paired],
        "matchedTopItemChanged": [
            slates["immediate-a"][0] != slates["held-a"][0],
            slates["immediate-b"][0] != slates["held-b"][0],
        ],
        "slateEnergyDistance": round(energy_distance(slates, size), 6),
        "actionLabels": actions,
        "nextSlateAliases": {
            condition: [public_item(category, task["taskId"], item) for item in slate]
            for condition, slate in slates.items()
        },
        "audit": {
            "conditionInvariantMaskHash": sha256(canonical(sorted(mask))),
            "slateUniqueCounts": {condition: len(set(slate)) for condition, slate in slates.items()},
            "historyContainsRawIdentifiers": False,
        },
    }


def task_cluster_bootstrap(rows: list[dict], field: str, replicates: int, seed: int) -> dict:
    generator = np.random.default_rng(seed)
    by_category: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        by_category[row["category"]][row["taskId"]].append(row)

    def value(selected_rows: list[dict]) -> float:
        return float(np.mean([row[field] for row in selected_rows])) if selected_rows else 0.0

    category_estimates = []
    for task_map in by_category.values():
        category_estimates.append(value([row for task_rows in task_map.values() for row in task_rows]))
    estimate = float(np.mean(category_estimates))

    draws = []
    for _ in range(replicates):
        category_draws = []
        for task_map in by_category.values():
            task_ids = list(task_map)
            sampled = generator.choice(task_ids, size=len(task_ids), replace=True)
            sampled_rows = [row for task_id in sampled for row in task_map[str(task_id)]]
            category_draws.append(value(sampled_rows))
        draws.append(float(np.mean(category_draws)))
    return {
        "estimate": round(estimate, 6),
        "ci95": [round(float(np.quantile(draws, 0.025)), 6), round(float(np.quantile(draws, 0.975)), 6)],
    }


def summarize(rows: list[dict], protocol: dict) -> dict:
    replicates = int(protocol["uncertainty"]["replicates"])
    seed = int(protocol["uncertainty"]["seed"])
    groups = {}
    for provider in protocol["sampling"]["llmActionSources"]:
        groups[provider] = {}
        for mode in protocol["instrumentModes"]:
            subset = [row for row in rows if row["provider"] == provider and row["mode"] == mode]
            augmented = []
            for row in subset:
                augmented.append(
                    {
                        **row,
                        "meanMatchedSlateDisplacement": float(np.mean(row["matchedSlateDisplacement"])),
                        "anyMatchedSlateChange": float(any(row["matchedSlateChanged"])),
                        "meanMatchedTopItemChange": float(np.mean(row["matchedTopItemChanged"])),
                        "meanSelectedActionChange": float(np.mean(row["selectedActionChanged"])),
                    }
                )
            result = {
                "unitCount": len(subset),
                "slateEnergyDistance": task_cluster_bootstrap(augmented, "slateEnergyDistance", replicates, seed),
                "meanMatchedSlateDisplacement": task_cluster_bootstrap(augmented, "meanMatchedSlateDisplacement", replicates, seed + 1),
                "anyMatchedSlateChangeRate": task_cluster_bootstrap(augmented, "anyMatchedSlateChange", replicates, seed + 2),
                "matchedTopItemChangeRate": task_cluster_bootstrap(augmented, "meanMatchedTopItemChange", replicates, seed + 3),
                "selectedActionChangeRate": task_cluster_bootstrap(augmented, "meanSelectedActionChange", replicates, seed + 4),
                "byRecommenderFamily": {},
            }
            for family in protocol["sampling"]["recommenderFamiliesPerTask"]:
                family_rows = [row for row in augmented if row["modelFamily"] == family]
                result["byRecommenderFamily"][family] = {
                    "unitCount": len(family_rows),
                    "slateEnergyDistance": task_cluster_bootstrap(
                        family_rows, "slateEnergyDistance", replicates, seed + (11 if family == "sasrec" else 17)
                    ),
                }
            groups[provider][mode] = result

    primary = groups["deepseek"]["served-order"]["slateEnergyDistance"]
    control = groups["deepseek"]["masked-control"]["slateEnergyDistance"]
    family = groups["deepseek"]["served-order"]["byRecommenderFamily"]
    gates = {
        "instrumentPassed": all(
            len(set(row["audit"]["slateUniqueCounts"].values())) == 1
            and next(iter(row["audit"]["slateUniqueCounts"].values())) == protocol["writeback"]["slateSize"]
            for row in rows
        ),
        "deepseekServedLowerBoundAboveZero": primary["ci95"][0] > 0,
        "deepseekMaskedUpperBoundBelow002": control["ci95"][1] < 0.02,
        "bothRecommenderFamilyPointEstimatesAboveZero": all(
            family[name]["slateEnergyDistance"]["estimate"] > 0
            for name in protocol["sampling"]["recommenderFamiliesPerTask"]
        ),
    }
    gates["feedbackExposureGatePassed"] = all(gates.values())
    return {"groups": groups, "gates": gates}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(PROTOCOL_PATH.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol, text = load_protocol(protocol_path)
    protocol_hash = sha256(text.encode("utf-8"))
    action_rows = load_action_rows(protocol)
    size = int(protocol["writeback"]["slateSize"])
    rows = []
    seen = set()

    v7_protocol = json.loads((ROOT / protocol["source"]["v7Protocol"]).read_text(encoding="utf-8"))
    candidate_limit = int(v7_protocol["decisionInstrument"]["candidateLimit"])
    for category, task, products, family, seed, scorer in v7.study_units(v7_protocol):
        unit_key = (category, task["taskId"], family)
        if unit_key in seen:
            raise RuntimeError(f"Duplicate study unit: {unit_key}")
        seen.add(unit_key)
        aliases = action_item_map(
            category,
            task["taskId"],
            v7_candidate_items(task, products, scorer, candidate_limit),
        )
        for provider in protocol["sampling"]["llmActionSources"]:
            for mode in protocol["instrumentModes"]:
                source = action_rows[(provider, category, task["taskId"], family, mode)]
                actions = source["actions"]
                resolved = {condition: resolve_action(actions[condition], aliases) for condition in CONDITIONS}
                selected_union = {item for item in resolved.values() if item is not None}
                mask = set(task["interacted"]) | selected_union | {task["nextTaskItem"]}
                slates = {}
                for condition in CONDITIONS:
                    context = list(task["history"])
                    if resolved[condition] is not None:
                        context.append(resolved[condition])
                    context.append(task["nextTaskItem"])
                    slates[condition] = scorer.top(context, mask, size)
                rows.append(
                    public_row(provider, category, task, family, seed, mode, actions, slates, mask, size)
                )

    expected = int(protocol["sampling"]["taskModelUnitCount"])
    if len(seen) != expected:
        raise RuntimeError(f"Expected {expected} study units, found {len(seen)}")
    expected_rows = expected * len(protocol["sampling"]["llmActionSources"]) * len(protocol["instrumentModes"])
    if len(rows) != expected_rows:
        raise RuntimeError(f"Expected {expected_rows} result rows, found {len(rows)}")

    analysis = summarize(rows, protocol)
    output = ROOT / protocol["outputs"]["publicRoot"]
    summary = {
        "schemaVersion": "online-storefront-feedback-bridge-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": protocol_hash,
        "evidenceStatus": (
            "feedback-exposure-gate-passed"
            if analysis["gates"]["feedbackExposureGatePassed"]
            else "feedback-exposure-gate-failed"
        ),
        "design": {
            "taskCount": 460,
            "taskModelUnitCount": expected,
            "publicRowCount": len(rows),
            "providers": protocol["sampling"]["llmActionSources"],
            "recommenderFamilies": protocol["sampling"]["recommenderFamiliesPerTask"],
            "instrumentModes": protocol["instrumentModes"],
            "providerCalls": 0,
        },
        **analysis,
        "claims": {
            "observedIfGatePasses": "V7 order-induced provider-output differences survived selected-action writeback as measurable one-step next-slate differences in the same frozen learned recommenders.",
            "notEstablished": [
                "The bridge does not yet show that the changed next slate changes a later agent action.",
                "It does not establish repeated amplification, purchases, human effects, or a production recommender outcome.",
                "The held-out next interaction is used as a standardized next-task event, not as proof of the user's intent.",
            ],
        },
    }
    write_json(output / "rows.json", {"schemaVersion": "online-storefront-feedback-bridge-rows.v1", "rows": rows})
    write_json(output / "summary.json", summary, pretty=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
