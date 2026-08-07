"""Evaluate the frozen v7 recommendation-instrument ablation pilot."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v7/instrument-ablation-pilot-protocol.json"
MODES = ["rank-only", "inspection-only", "masked-control", "served-order"]
CONDITIONS = ["immediate-a", "held-a", "immediate-b", "held-b"]


def canonical_protocol() -> tuple[dict, str]:
    text = PROTOCOL_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    return json.loads(text), hashlib.sha256(text.encode("utf-8")).hexdigest()


def interval(values: list[float]) -> list[float]:
    return [
        round(float(np.quantile(values, 0.025)), 6),
        round(float(np.quantile(values, 0.975)), 6),
    ]


def recompute_row(row: dict, provider: str) -> dict:
    if row.get("provider") != provider:
        raise RuntimeError("Row provider does not match its public directory")
    if row.get("mode") not in MODES:
        raise RuntimeError("Row contains an unknown instrument mode")
    labels = row.get("actions", {})
    if set(labels) != set(CONDITIONS):
        raise RuntimeError("Row does not contain exactly four action cells")
    cross = [
        labels["immediate-a"] != labels["held-a"],
        labels["immediate-a"] != labels["held-b"],
        labels["immediate-b"] != labels["held-a"],
        labels["immediate-b"] != labels["held-b"],
    ]
    immediate_within = int(labels["immediate-a"] != labels["immediate-b"])
    held_within = int(labels["held-a"] != labels["held-b"])
    distance = 2 * float(np.mean(cross)) - immediate_within - held_within
    matched_changes = sum(
        labels[f"immediate-{replicate}"] != labels[f"held-{replicate}"]
        for replicate in ["a", "b"]
    )

    audit = row.get("auditPrimitives") or {}
    hashes = audit.get("stateHashes") or {}
    layouts = audit.get("candidateLayouts") or {}
    if set(hashes) != set(CONDITIONS) or set(layouts) != set(CONDITIONS):
        raise RuntimeError("Row is missing state-hash or candidate-layout primitives")
    layout_tuples = {condition: tuple(layouts[condition]) for condition in CONDITIONS}
    if any(not layout or len(layout) != len(set(layout)) for layout in layout_tuples.values()):
        raise RuntimeError("Candidate layout is empty or contains duplicate aliases")
    if len({frozenset(layout) for layout in layout_tuples.values()}) != 1:
        raise RuntimeError("Candidate sets differ across matched calls")
    if hashes["immediate-a"] != hashes["immediate-b"] or hashes["held-a"] != hashes["held-b"]:
        raise RuntimeError("Within-arm repeated task states are not byte-identical")
    if row["mode"] == "masked-control" and len(set(hashes.values())) != 1:
        raise RuntimeError("Masked-control immediate and held states are not byte-identical")
    if row["mode"] != "served-order" and len(set(layout_tuples.values())) != 1:
        raise RuntimeError("A metadata or control mode changed candidate order")

    recomputed = {
        "actionDistributionDistance": round(distance, 6),
        "immediateWithinDivergence": immediate_within,
        "heldWithinDivergence": held_within,
        "matchedCrossArmActionChangeCount": matched_changes,
        "servedOrderChanged": (
            layout_tuples["immediate-a"] != layout_tuples["held-a"]
            if row["mode"] == "served-order"
            else False
        ),
        "protocolFailureCount": sum(label == "__PROTOCOL_FAILURE__" for label in labels.values()),
    }
    for name, value in recomputed.items():
        if name in row and row[name] != value:
            raise RuntimeError(f"Stored field {name} disagrees with public primitives")
    return {**row, **recomputed}


def validate_frame(rows: list[dict], protocol: dict, provider: str) -> None:
    expected_units = int(protocol["sampling"]["taskModelUnitCount"])
    expected_rows = expected_units * len(MODES)
    if len(rows) != expected_rows:
        raise RuntimeError(f"{provider} has {len(rows)} mode rows; expected {expected_rows}")
    keys = [(row["category"], row["taskId"], row["modelFamily"], row["mode"]) for row in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError(f"{provider} contains duplicate task-family-mode cells")
    unit_modes = defaultdict(set)
    for row in rows:
        unit_modes[(row["category"], row["taskId"], row["modelFamily"])].add(row["mode"])
    if len(unit_modes) != expected_units or any(modes != set(MODES) for modes in unit_modes.values()):
        raise RuntimeError(f"{provider} does not contain four modes for every frozen unit")
    categories = protocol["sampling"]["categories"]
    for category in categories:
        tasks = {row["taskId"] for row in rows if row["category"] == category}
        if len(tasks) != int(protocol["sampling"]["tasksPerCategory"]):
            raise RuntimeError(f"{provider}/{category} has the wrong task count")


def mode_metrics(rows: list[dict]) -> dict[str, float | int]:
    failure_count = sum(row["protocolFailureCount"] for row in rows)
    matched_changes = sum(row["matchedCrossArmActionChangeCount"] for row in rows)
    return {
        "categoricalEnergyDistance": float(np.mean([row["actionDistributionDistance"] for row in rows])),
        "matchedCrossArmActionChangeRate": matched_changes / (2 * len(rows)),
        "matchedCrossArmActionChangeCount": matched_changes,
        "immediateWithinDivergenceRate": float(np.mean([row["immediateWithinDivergence"] for row in rows])),
        "heldWithinDivergenceRate": float(np.mean([row["heldWithinDivergence"] for row in rows])),
        "protocolFailureRate": failure_count / (4 * len(rows)),
        "servedOrderChangeRate": float(np.mean([row["servedOrderChanged"] for row in rows])),
    }


def bootstrap(rows: list[dict], protocol: dict) -> dict:
    clusters = defaultdict(list)
    for row in rows:
        clusters[(row["category"], row["taskId"], row["modelFamily"])].append(row)
    keys_by_category = defaultdict(list)
    for key in sorted(clusters):
        keys_by_category[key[0]].append(key)
    replicates = int(protocol["uncertainty"]["replicates"])
    rng = np.random.default_rng(int(protocol["uncertainty"]["seed"]))
    samples = {mode: defaultdict(list) for mode in MODES}
    for _ in range(replicates):
        sampled = []
        for category in protocol["sampling"]["categories"]:
            keys = keys_by_category[category]
            indices = rng.integers(0, len(keys), size=len(keys))
            sampled.extend(row for index in indices for row in clusters[keys[index]])
        for mode in MODES:
            values = mode_metrics([row for row in sampled if row["mode"] == mode])
            for name, value in values.items():
                samples[mode][name].append(float(value))
    result = {}
    for mode in MODES:
        subset = [row for row in rows if row["mode"] == mode]
        point = mode_metrics(subset)
        result[mode] = {
            name: {
                "estimate": round(float(value), 6),
                "ci95": interval(samples[mode][name]),
            }
            for name, value in point.items()
            if name != "matchedCrossArmActionChangeCount"
        }
        result[mode]["matchedCrossArmActionChangeCount"] = int(point["matchedCrossArmActionChangeCount"])
    return result


def transitions(rows: list[dict]) -> dict:
    counts = Counter()
    for row in rows:
        for replicate in ["a", "b"]:
            immediate = row["actions"][f"immediate-{replicate}"]
            held = row["actions"][f"held-{replicate}"]
            if immediate == held:
                label = "same"
            elif immediate == "__ABANDON__":
                label = "abandon-to-select"
            elif held == "__ABANDON__":
                label = "select-to-abandon"
            else:
                label = "selected-candidate-swap"
            counts[label] += 1
    return dict(sorted(counts.items()))


def evaluate_provider(protocol: dict, protocol_hash: str, provider: str) -> dict:
    root = ROOT / protocol["outputs"]["publicRoot"] / provider
    summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
    if summary.get("protocolSha256") != protocol_hash:
        raise RuntimeError(f"{provider} summary was generated under a different protocol")
    payload = json.loads((root / "rows.json").read_text(encoding="utf-8"))
    rows = [recompute_row(row, provider) for row in payload["rows"]]
    validate_frame(rows, protocol, provider)
    estimates = bootstrap(rows, protocol)
    return {
        "provider": provider,
        "model": summary["model"],
        "taskModelUnitCount": protocol["sampling"]["taskModelUnitCount"],
        "estimates": estimates,
        "transitions": {
            mode: transitions([row for row in rows if row["mode"] == mode]) for mode in MODES
        },
        "runApi": summary["api"],
    }


def build_manifest(protocol: dict, protocol_hash: str, providers: list[str]) -> dict:
    root = ROOT / protocol["outputs"]["publicRoot"]
    names = ["preflight.json", "evaluation.json"]
    for provider in providers:
        names.extend([f"{provider}/rows.json", f"{provider}/summary.json"])
    files = {}
    for name in names:
        payload = (root / name).read_bytes()
        files[name] = {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}
    manifest = {
        "schemaVersion": "online-storefront-instrument-ablation-manifest.v1",
        "protocolSha256": protocol_hash,
        "files": files,
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["mimo", "deepseek", "both"], default="both")
    args = parser.parse_args()
    protocol, protocol_hash = canonical_protocol()
    providers = ["deepseek", "mimo"] if args.provider == "both" else [args.provider]
    preflight = json.loads((ROOT / protocol["outputs"]["publicRoot"] / "preflight.json").read_text(encoding="utf-8"))
    if not preflight.get("passed") or preflight.get("protocolSha256") != protocol_hash:
        raise RuntimeError("A passing preflight under the frozen protocol is required")
    results = {provider: evaluate_provider(protocol, protocol_hash, provider) for provider in providers}

    gates = {
        "preflightPassed": True,
        "instrumentOrderChangeRateAtLeast075": preflight["servedOrderChangeRate"] >= 0.75,
        "allProviderFailureRatesBelow005": all(
            result["estimates"][mode]["protocolFailureRate"]["estimate"] < 0.05
            for result in results.values()
            for mode in MODES
        ),
    }
    if "deepseek" in results:
        deepseek = results["deepseek"]["estimates"]
        served = deepseek["served-order"]
        masked = deepseek["masked-control"]
        gates.update(
            {
                "deepseekServedPointAtLeast008": served["categoricalEnergyDistance"]["estimate"] >= 0.08,
                "deepseekServedMinusMaskedAtLeast005": (
                    served["categoricalEnergyDistance"]["estimate"]
                    - masked["categoricalEnergyDistance"]["estimate"]
                    >= 0.05
                ),
                "deepseekServedMatchedChangesAtLeast4": served["matchedCrossArmActionChangeCount"] >= 4,
                "fullV7ServedLowerBoundAboveZero": served["categoricalEnergyDistance"]["ci95"][0] > 0,
                "fullV7MaskedUpperBoundBelow005": masked["categoricalEnergyDistance"]["ci95"][1] < 0.05,
            }
        )
    pilot_gate_names = [
        "preflightPassed",
        "instrumentOrderChangeRateAtLeast075",
        "allProviderFailureRatesBelow005",
        "deepseekServedPointAtLeast008",
        "deepseekServedMinusMaskedAtLeast005",
        "deepseekServedMatchedChangesAtLeast4",
    ]
    scale_up = all(gates.get(name, False) for name in pilot_gate_names)
    confirmatory = bool(
        scale_up
        and gates.get("fullV7ServedLowerBoundAboveZero", False)
        and gates.get("fullV7MaskedUpperBoundBelow005", False)
    )
    payload = {
        "schemaVersion": "online-storefront-instrument-ablation-evaluation.v1",
        "protocolSha256": protocol_hash,
        "providers": results,
        "gates": gates,
        "decision": (
            "confirmatory-gate-already-passed-in-pilot"
            if confirmatory
            else "go-scale-to-natural-frame-v7"
            if scale_up
            else "no-go-for-full-v7-under-frozen-pilot-gate"
        ),
        "interpretationPolicy": {
            "servedOrder": "Only a passing served-order result supports further testing of a recommendation-order account.",
            "metadataOnly": "Positive rank-only or inspection-only results without the served-order gate bound v6 to prompt-feature sensitivity.",
            "maskedControl": "A positive masked-control result indicates provider instability or temporal drift that the energy-distance correction did not remove adequately.",
        },
        "inferenceScope": "Opportunity-enriched 32-unit mechanism pilot with one frozen recommender checkpoint per task. Intervals resample tasks within category and are not natural-frame prevalence intervals.",
        "claimBoundary": protocol["claimBoundary"],
        "remainingExternalValidityRequirement": protocol["remainingExternalValidityRequirement"],
    }
    root = ROOT / protocol["outputs"]["publicRoot"]
    root.mkdir(parents=True, exist_ok=True)
    (root / "evaluation.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    build_manifest(protocol, protocol_hash, providers)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
