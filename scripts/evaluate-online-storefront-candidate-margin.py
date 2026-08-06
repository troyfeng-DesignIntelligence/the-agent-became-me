"""Evaluate the frozen candidate-margin diagnostic from actual sent states.

The ignored response cache preserves the pseudonymous derived candidate state
that each provider actually received. This analysis never reconstructs a shelf
from the recommender because historical storefront runs accidentally left
recommender dropout active. Public outputs exclude prompts and responses.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/candidate-margin-protocol.json"
OUTPUT_ROOT = ROOT / "public/results/online-storefront-candidate-margin/v1"
CONTRAST_ROOT = ROOT / "public/results/online-storefront-decoding-sensitivity/v1"
ARTIFACT_ROOT = ROOT / "artifacts/online-storefront-decoding-sensitivity"
PERMUTATIONS = 100_000
PERMUTATION_SEED = 2026080603
ALIAS_ITEM_SEARCH_LIMIT = 10_000
SCOPES = ("immediate-remove", "held-outcome", "held-sham-a", "held-sham-b")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def item_alias(category: str, task_id: str, item: int) -> str:
    digest = hashlib.sha256(
        f"llm-pilot|{category}|{task_id}|{item}".encode("utf-8")
    ).hexdigest()
    return f"P-{digest[:8].upper()}"


def load_contrasts(provider: str) -> tuple[list[dict], Path]:
    path = CONTRAST_ROOT / f"{provider}-forced-inspection-t0/contrasts.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("contrasts", payload.get("rows"))
    if not isinstance(rows, list) or len(rows) != 32:
        raise RuntimeError(f"Expected 32 contrasts in {path}")
    return rows, path


def request_state(record: dict, provider: str) -> dict:
    request = record["request"]
    if provider == "mimo":
        text = request["input"]
    else:
        text = next(
            message["content"]
            for message in request["messages"]
            if message["role"] == "user"
        )
    state = json.loads(text)
    if state.get("phase") not in {"browse", "terminal"}:
        raise RuntimeError("Unexpected candidate-state phase")
    return state


def response_decision(record: dict, provider: str) -> dict:
    if provider == "mimo":
        text = record["response"]["output_text"]
    else:
        text = record["response"]["choices"][0]["message"]["content"]
    decision = json.loads(text)
    if decision.get("action") not in {"view", "select", "abandon"}:
        raise RuntimeError("Unexpected provider action in validated cache")
    return decision


def directory_digest(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def load_requests(provider: str) -> tuple[list[dict], dict]:
    directory = ARTIFACT_ROOT / f"{provider}-forced-inspection-t0/responses"
    paths = sorted(directory.glob("*.json"))
    records = []
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        state = request_state(payload, provider)
        candidates = state.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise RuntimeError(f"Missing candidate list in {path}")
        records.append(
            {
                "file": path.name,
                "scope": payload["cacheScope"],
                "phase": state["phase"],
                "candidates": candidates,
                "candidateIds": {row["candidateId"] for row in candidates},
                "decision": response_decision(payload, provider),
            }
        )
    return records, {
        "responseFileCount": len(paths),
        "directorySha256": directory_digest(paths),
    }


def componentize(records: list[dict]) -> list[list[dict]]:
    parents = list(range(len(records)))

    def find(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    owner = {}
    for index, record in enumerate(records):
        for candidate_id in record["candidateIds"]:
            if candidate_id in owner:
                union(index, owner[candidate_id])
            else:
                owner[candidate_id] = index
    grouped = defaultdict(list)
    for index, record in enumerate(records):
        grouped[find(index)].append(record)
    components = list(grouped.values())
    if len(components) != 32:
        raise RuntimeError(f"Expected 32 request components, found {len(components)}")
    for component in components:
        if {record["scope"] for record in component} != set(SCOPES):
            raise RuntimeError("A request component does not contain all four arms")
        for scope in SCOPES:
            if sum(
                record["scope"] == scope and record["phase"] == "browse"
                for record in component
            ) != 1:
                raise RuntimeError("Each component-arm must contain one browse state")
    return components


def map_components_to_tasks(
    components: list[list[dict]], contrasts: list[dict]
) -> dict[int, tuple[str, str]]:
    actual_aliases = {
        candidate_id
        for component in components
        for record in component
        for candidate_id in record["candidateIds"]
    }
    alias_owners = defaultdict(set)
    task_keys = sorted({(row["category"], row["taskId"]) for row in contrasts})
    for task_key in task_keys:
        category, task_id = task_key
        for item in range(1, ALIAS_ITEM_SEARCH_LIMIT + 1):
            alias = item_alias(category, task_id, item)
            if alias in actual_aliases:
                alias_owners[alias].add(task_key)

    mapping = {}
    claimed_tasks = set()
    for index, component in enumerate(components):
        component_aliases = {
            candidate_id for record in component for candidate_id in record["candidateIds"]
        }
        scores = defaultdict(int)
        for alias in component_aliases:
            for task_key in alias_owners.get(alias, ()):
                scores[task_key] += 1
        ranked = sorted(scores.items(), key=lambda row: (-row[1], row[0]))
        if not ranked or ranked[0][1] < 2:
            raise RuntimeError("Could not map a request component to a frozen task")
        if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
            raise RuntimeError("Ambiguous request-component task mapping")
        task_key = ranked[0][0]
        if task_key in claimed_tasks:
            raise RuntimeError("Two request components mapped to the same task")
        mapping[index] = task_key
        claimed_tasks.add(task_key)
    if claimed_tasks != set(task_keys):
        raise RuntimeError("Request components do not cover the frozen task set")
    return mapping


def browse_state(component: list[dict], scope: str) -> dict:
    return next(
        record
        for record in component
        if record["scope"] == scope and record["phase"] == "browse"
    )


def final_decision(component: list[dict], scope: str) -> tuple[str, str | None]:
    scoped = [record for record in component if record["scope"] == scope]
    terminal = next((record for record in scoped if record["phase"] == "terminal"), None)
    record = terminal or next(record for record in scoped if record["phase"] == "browse")
    decision = record["decision"]
    if decision["action"] == "select":
        return "selected", decision["candidateId"]
    if decision["action"] == "abandon":
        return "abandoned", None
    raise RuntimeError("A final cached decision cannot remain a view")


def state_metrics(record: dict) -> dict:
    candidates = record["candidates"]
    eligible = sorted(
        (
            (float(candidate["taskUtility"]), candidate["candidateId"])
            for candidate in candidates
            if candidate["constraintMatch"]
        ),
        reverse=True,
    )
    margin = round(eligible[0][0] - eligible[1][0], 6) if len(eligible) >= 2 else None
    return {
        "candidateIds": {candidate["candidateId"] for candidate in candidates},
        "bestEligibleCandidate": eligible[0][1] if eligible else None,
        "eligibleCount": len(eligible),
        "candidateCount": len(candidates),
        "margin": margin,
    }


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return 1.0 if not union else len(left & right) / len(union)


def provider_rows(provider: str) -> tuple[list[dict], dict]:
    contrasts, contrast_path = load_contrasts(provider)
    contrast_by_task = {(row["category"], row["taskId"]): row for row in contrasts}
    records, raw_source = load_requests(provider)
    components = componentize(records)
    component_tasks = map_components_to_tasks(components, contrasts)
    rows = []
    resolved_matches = 0
    sham_matches = 0
    for index, component in enumerate(components):
        task_key = component_tasks[index]
        contrast = contrast_by_task[task_key]
        immediate = state_metrics(browse_state(component, "immediate-remove"))
        held = state_metrics(browse_state(component, "held-outcome"))
        margins = [immediate["margin"], held["margin"]]
        analyzable = all(value is not None for value in margins)
        overlap = jaccard(immediate["candidateIds"], held["candidateIds"])
        immediate_final = final_decision(component, "immediate-remove")
        held_final = final_decision(component, "held-outcome")
        sham_a_final = final_decision(component, "held-sham-a")
        sham_b_final = final_decision(component, "held-sham-b")
        raw_resolved = immediate_final != held_final
        raw_sham = sham_a_final != sham_b_final
        expected_resolved = bool(contrast["exposureResolvedActionDiverged"])
        expected_sham = bool(contrast["shamResolvedActionDiverged"])
        if raw_resolved != expected_resolved or raw_sham != expected_sham:
            raise RuntimeError("Raw final decision does not match public contrast")
        resolved_matches += raw_resolved == expected_resolved
        sham_matches += raw_sham == expected_sham
        rows.append(
            {
                "provider": provider,
                "category": task_key[0],
                "taskId": task_key[1],
                "modelFamily": contrast["modelFamily"],
                "modelSeed": contrast["modelSeed"],
                "analyzable": analyzable,
                "immediateEligibleCount": immediate["eligibleCount"],
                "heldEligibleCount": held["eligibleCount"],
                "immediateCandidateCount": immediate["candidateCount"],
                "heldCandidateCount": held["candidateCount"],
                "immediateTopTwoEligibleUtilityMargin": immediate["margin"],
                "heldTopTwoEligibleUtilityMargin": held["margin"],
                "minimumTopTwoEligibleUtilityMargin": (
                    round(min(margins), 6) if analyzable else None
                ),
                "postInspectionCandidateJaccard": round(overlap, 6),
                "postInspectionCandidateSetDifferent": overlap < 1.0,
                "bestEligibleCandidateDifferent": (
                    immediate["bestEligibleCandidate"]
                    != held["bestEligibleCandidate"]
                ),
                "exposureOpportunityChange": overlap < 1.0,
                "event": bool(contrast["persistentResolvedActionFeedback"]),
                "shamEvent": bool(contrast["shamPersistentResolvedActionFeedback"]),
                "resolvedActionDiverged": expected_resolved,
            }
        )
    source = {
        "contrastPath": str(contrast_path.relative_to(ROOT)).replace("\\", "/"),
        "contrastSha256": sha256_file(contrast_path),
        **raw_source,
        "componentCount": len(components),
        "resolvedActionValidationMatches": resolved_matches,
        "shamResolvedActionValidationMatches": sham_matches,
        "aliasItemSearchLimit": ALIAS_ITEM_SEARCH_LIMIT,
    }
    return rows, source


def margin_auc(rows: list[dict]) -> float | None:
    events = [row["minimumTopTwoEligibleUtilityMargin"] for row in rows if row["event"]]
    controls = [row["minimumTopTwoEligibleUtilityMargin"] for row in rows if not row["event"]]
    if not events or not controls:
        return None
    score = sum(
        1.0 if event < control else 0.5 if event == control else 0.0
        for event in events
        for control in controls
    )
    return score / (len(events) * len(controls))


def permutation_p(rows: list[dict], observed_auc: float | None) -> float | None:
    if observed_auc is None:
        return None
    margins = np.array([row["minimumTopTwoEligibleUtilityMargin"] for row in rows])
    event_count = sum(row["event"] for row in rows)
    if event_count == 0 or event_count == len(rows):
        return None
    rng = np.random.default_rng(PERMUTATION_SEED)
    indices = np.arange(len(rows))
    extreme = 0
    for _ in range(PERMUTATIONS):
        chosen = set(rng.choice(indices, size=event_count, replace=False).tolist())
        permuted = [
            {"minimumTopTwoEligibleUtilityMargin": float(margins[i]), "event": i in chosen}
            for i in indices
        ]
        value = margin_auc(permuted)
        if value is not None and value >= observed_auc - 1e-12:
            extreme += 1
    return (extreme + 1) / (PERMUTATIONS + 1)


def summarize(rows: list[dict], provider: str) -> dict:
    provider_subset = [row for row in rows if row["provider"] == provider]
    analyzable = [row for row in provider_subset if row["analyzable"]]
    total_events = [row for row in provider_subset if row["event"]]
    analyzable_events = [row for row in analyzable if row["event"]]
    auc = margin_auc(analyzable)
    p_value = permutation_p(analyzable, auc)
    margins = [row["minimumTopTwoEligibleUtilityMargin"] for row in analyzable]
    threshold = float(np.quantile(margins, 1 / 3, method="linear")) if margins else None
    bottom_events = (
        sum(row["minimumTopTwoEligibleUtilityMargin"] <= threshold for row in analyzable_events)
        if threshold is not None
        else 0
    )
    return {
        "taskCount": len(provider_subset),
        "analyzableCount": len(analyzable),
        "analyzableRate": round(len(analyzable) / len(provider_subset), 6),
        "persistentResolvedActionEventCount": len(total_events),
        "analyzablePersistentResolvedActionEventCount": len(analyzable_events),
        "shamPersistentResolvedActionEventCount": sum(row["shamEvent"] for row in provider_subset),
        "marginAuc": round(auc, 6) if auc is not None else None,
        "oneSidedPermutationP": round(p_value, 6) if p_value is not None else None,
        "bottomTertileThreshold": round(threshold, 6) if threshold is not None else None,
        "eventCountInBottomTertile": bottom_events,
        "eventFractionInBottomTertile": (
            round(bottom_events / len(analyzable_events), 6) if analyzable_events else None
        ),
        "zeroMarginRateAmongAnalyzable": (
            round(sum(value == 0 for value in margins) / len(margins), 6)
            if margins
            else None
        ),
        "allEventsHaveExposureOpportunityChange": bool(total_events)
        and all(row["exposureOpportunityChange"] for row in total_events),
        "candidateSetDifferentRate": round(
            sum(row["postInspectionCandidateSetDifferent"] for row in provider_subset)
            / len(provider_subset),
            6,
        ),
        "bestEligibleCandidateDifferentRate": round(
            sum(row["bestEligibleCandidateDifferent"] for row in provider_subset)
            / len(provider_subset),
            6,
        ),
        "bestEligibleCandidateDifferentEventCount": sum(
            row["bestEligibleCandidateDifferent"] and row["event"]
            for row in provider_subset
        ),
    }


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol = json.loads(protocol_bytes)
    all_rows = []
    source_files = {}
    for provider in ("mimo", "deepseek"):
        rows, source = provider_rows(provider)
        all_rows.extend(rows)
        source_files[provider] = source
    providers = {provider: summarize(all_rows, provider) for provider in ("mimo", "deepseek")}
    deepseek = providers["deepseek"]
    analyzable_ok = deepseek["analyzableRate"] >= 0.90
    direction_no_go = deepseek["marginAuc"] is None or deepseek["marginAuc"] <= 0.50
    opportunity_ok = deepseek["allEventsHaveExposureOpportunityChange"]
    go = (
        analyzable_ok
        and deepseek["marginAuc"] is not None
        and deepseek["marginAuc"] >= 0.70
        and deepseek["oneSidedPermutationP"] is not None
        and deepseek["oneSidedPermutationP"] <= 0.10
        and deepseek["eventFractionInBottomTertile"] is not None
        and deepseek["eventFractionInBottomTertile"] >= 2 / 3
        and opportunity_ok
    )
    if not analyzable_ok or direction_no_go or not opportunity_ok:
        decision = "no-go"
    elif go:
        decision = "go-near-tie-margin"
    else:
        decision = "pivot-candidate-state-opportunity"
    summary = {
        "schemaVersion": "online-storefront-candidate-margin-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocolSha256": sha256_bytes(protocol_bytes),
        "historicalStateSource": "actual pseudonymous candidate features sent to each provider",
        "sourceFiles": source_files,
        "predictor": protocol["predictor"],
        "permutationCount": PERMUTATIONS,
        "permutationSeed": PERMUTATION_SEED,
        "providers": providers,
        "decision": decision,
        "decisionRules": protocol["decisionRules"],
        "dataQualityBoundary": "Historical storefront recommenders were inadvertently left in training mode. This diagnostic uses actual sent candidate states and does not reconstruct historical shelves.",
        "claimBoundary": protocol["claimBoundary"],
    }
    rows_payload = {
        "schemaVersion": "online-storefront-candidate-margin-rows.v1",
        "protocolSha256": summary["protocolSha256"],
        "rows": all_rows,
    }
    write_json(OUTPUT_ROOT / "summary.json", summary, pretty=True)
    write_json(OUTPUT_ROOT / "rows.json", rows_payload)
    files = {}
    for name in ("summary.json", "rows.json"):
        path = OUTPUT_ROOT / name
        files[name] = {"sha256": sha256_file(path), "bytes": path.stat().st_size}
    write_json(
        OUTPUT_ROOT / "manifest.json",
        {
            "schemaVersion": "online-storefront-candidate-margin-manifest.v1",
            "protocolSha256": summary["protocolSha256"],
            "files": files,
        },
        pretty=True,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
