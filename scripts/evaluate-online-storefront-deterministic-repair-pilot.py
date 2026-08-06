"""Evaluate the prospectively frozen deterministic 32-task repair pilot."""

from __future__ import annotations

import hashlib
import itertools
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "experiments/online-storefront-v4/deterministic-repair-pilot-protocol.json"
SELECTION_PATH = ROOT / "public/results/online-storefront-repair-pilot-selection/v1/selected-tasks.json"
RUN_ROOT = ROOT / "public/results/online-storefront-deterministic-repair-pilot/v1"
OUTPUT_ROOT = RUN_ROOT / "evaluation"
PROVIDERS = ("mimo", "deepseek")
SCOPES = ("immediate-remove", "held-outcome", "held-sham-a", "held-sham-b")
ARTIFACT_ROOT = ROOT / "artifacts/online-storefront-deterministic-repair-pilot"
ALIAS_ITEM_SEARCH_LIMIT = 10_000


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, payload: object, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        payload,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def load_provider(provider: str) -> tuple[dict, list[dict], dict]:
    directory = RUN_ROOT / provider
    summary_path = directory / "summary.json"
    contrasts_path = directory / "contrasts.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    contrasts_payload = json.loads(contrasts_path.read_text(encoding="utf-8"))
    rows = contrasts_payload.get("rows", contrasts_payload.get("contrasts"))
    if not isinstance(rows, list) or len(rows) != 32:
        raise RuntimeError(f"Expected 32 contrasts for {provider}")
    return summary, rows, {
        "summaryPath": str(summary_path.relative_to(ROOT)).replace("\\", "/"),
        "summarySha256": sha256(summary_path.read_bytes()),
        "contrastsPath": str(contrasts_path.relative_to(ROOT)).replace("\\", "/"),
        "contrastsSha256": sha256(contrasts_path.read_bytes()),
    }


def item_alias(category: str, task_id: str, item: int) -> str:
    digest = hashlib.sha256(
        f"llm-pilot|{category}|{task_id}|{item}".encode("utf-8")
    ).hexdigest()
    return f"P-{digest[:8].upper()}"


def request_state(record: dict, provider: str) -> dict:
    request = record["request"]
    text = (
        request["input"]
        if provider == "mimo"
        else next(
            message["content"]
            for message in request["messages"]
            if message["role"] == "user"
        )
    )
    state = json.loads(text)
    if state.get("phase") not in {"browse", "terminal"}:
        raise RuntimeError("Unexpected request-state phase")
    return state


def response_decision(record: dict, provider: str) -> dict:
    text = (
        record["response"]["output_text"]
        if provider == "mimo"
        else record["response"]["choices"][0]["message"]["content"]
    )
    decision = json.loads(text)
    if decision.get("action") not in {"view", "select", "abandon"}:
        raise RuntimeError("Unexpected provider action")
    return decision


def load_actual_requests(provider: str) -> tuple[list[dict], dict]:
    directory = ARTIFACT_ROOT / provider / "responses"
    paths = sorted(directory.glob("*.json"))
    digest = hashlib.sha256()
    records = []
    for path in paths:
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
        payload = json.loads(path.read_text(encoding="utf-8"))
        state = request_state(payload, provider)
        candidates = state.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise RuntimeError("Actual request is missing candidates")
        records.append(
            {
                "scope": payload["cacheScope"],
                "phase": state["phase"],
                "candidates": candidates,
                "candidateIds": {row["candidateId"] for row in candidates},
                "decision": response_decision(payload, provider),
            }
        )
    return records, {
        "responseFileCount": len(paths),
        "responseDirectorySha256": digest.hexdigest(),
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
        raise RuntimeError(f"Expected 32 actual request components, found {len(components)}")
    for component in components:
        if {record["scope"] for record in component} != set(SCOPES):
            raise RuntimeError("Actual request component is missing a frozen arm")
        for scope in SCOPES:
            if sum(
                record["scope"] == scope and record["phase"] == "browse"
                for record in component
            ) != 1:
                raise RuntimeError("Each task-arm must contain exactly one browse state")
    return components


def map_components(components: list[list[dict]], selected: dict) -> dict[int, tuple[str, str]]:
    actual_aliases = {
        candidate_id
        for component in components
        for record in component
        for candidate_id in record["candidateIds"]
    }
    alias_owners = defaultdict(set)
    for category, task_id in selected:
        for item in range(1, ALIAS_ITEM_SEARCH_LIMIT + 1):
            alias = item_alias(category, task_id, item)
            if alias in actual_aliases:
                alias_owners[alias].add((category, task_id))
    mapping = {}
    claimed = set()
    for index, component in enumerate(components):
        scores = defaultdict(int)
        for record in component:
            for alias in record["candidateIds"]:
                for task_key in alias_owners.get(alias, ()):
                    scores[task_key] += 1
        ranked = sorted(scores.items(), key=lambda row: (-row[1], row[0]))
        if not ranked or ranked[0][1] < 2:
            raise RuntimeError("Could not map actual state to frozen task")
        if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
            raise RuntimeError("Actual-state task mapping is ambiguous")
        if ranked[0][0] in claimed:
            raise RuntimeError("Two actual-state components map to one task")
        mapping[index] = ranked[0][0]
        claimed.add(ranked[0][0])
    if claimed != set(selected):
        raise RuntimeError("Actual states do not cover the selected manifest")
    return mapping


def browse_state(component: list[dict], scope: str) -> dict:
    return next(
        record
        for record in component
        if record["scope"] == scope and record["phase"] == "browse"
    )


def final_decision(component: list[dict], scope: str) -> tuple[str, str | None]:
    scoped = [record for record in component if record["scope"] == scope]
    record = next((row for row in scoped if row["phase"] == "terminal"), None)
    record = record or next(row for row in scoped if row["phase"] == "browse")
    decision = record["decision"]
    if decision["action"] == "select":
        return "selected", decision["candidateId"]
    if decision["action"] == "abandon":
        return "abandoned", None
    raise RuntimeError("Actual final decision cannot remain a view")


def actual_arm_margin(candidates: list[dict]) -> float:
    scored = []
    for candidate in candidates:
        if not candidate["constraintMatch"]:
            continue
        platform = (
            1.0 / float(candidate["platformRank"])
            if candidate.get("platformRank")
            else 0.0
        )
        local = (
            1.0 / float(candidate["taskLocalRank"])
            if candidate.get("taskLocalRank")
            else 0.0
        )
        score = 0.25 * (
            min(1.0, max(0.0, float(candidate["taskUtility"])))
            + platform
            + local
            + min(1.0, max(0.0, float(candidate["novelty"])))
        )
        scored.append((score, candidate["candidateId"]))
    scored.sort(key=lambda row: (-row[0], row[1]))
    if not scored:
        return 1.0
    if len(scored) == 1:
        return round(0.5 + 0.5 * scored[0][0], 6)
    return round(0.5 * (scored[0][0] - scored[1][0]), 6)


def audit_actual_states(
    provider: str, contrasts: list[dict], selected: dict
) -> dict:
    records, source = load_actual_requests(provider)
    actual_aliases = {
        candidate_id for record in records for candidate_id in record["candidateIds"]
    }
    alias_owners = defaultdict(set)
    for category, task_id in selected:
        for item in range(1, ALIAS_ITEM_SEARCH_LIMIT + 1):
            alias = item_alias(category, task_id, item)
            if alias in actual_aliases:
                alias_owners[alias].add((category, task_id))
    grouped = defaultdict(list)
    for record in records:
        scores = defaultdict(int)
        for alias in record["candidateIds"]:
            for task_key in alias_owners.get(alias, ()):
                scores[task_key] += 1
        ranked = sorted(scores.items(), key=lambda row: (-row[1], row[0]))
        if not ranked:
            raise RuntimeError("Could not map actual request to frozen task")
        if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
            raise RuntimeError("Actual-request task mapping is ambiguous")
        grouped[ranked[0][0]].append(record)
    if set(grouped) != set(selected):
        raise RuntimeError("Actual requests do not cover the selected manifest")
    for component in grouped.values():
        if {record["scope"] for record in component} != set(SCOPES):
            raise RuntimeError("Actual request group is missing a frozen arm")
        for scope in SCOPES:
            if sum(
                record["scope"] == scope and record["phase"] == "browse"
                for record in component
            ) != 1:
                raise RuntimeError("Each task-arm must contain exactly one browse state")
    contrasts_by_task = {
        (row["category"], row["taskId"]): row for row in contrasts
    }
    predictor_matches = 0
    resolved_matches = 0
    sham_matches = 0
    for task_key, component in grouped.items():
        frozen = selected[task_key]
        actual_predictor = round(
            min(
                actual_arm_margin(
                    browse_state(component, "immediate-remove")["candidates"]
                ),
                actual_arm_margin(
                    browse_state(component, "held-outcome")["candidates"]
                ),
            ),
            6,
        )
        if actual_predictor != frozen["minimumArmDecisionSeparation"]:
            raise RuntimeError("Actual sent-state predictor differs from frozen manifest")
        predictor_matches += 1
        contrast = contrasts_by_task[task_key]
        raw_resolved = final_decision(component, "immediate-remove") != final_decision(
            component, "held-outcome"
        )
        raw_sham = final_decision(component, "held-sham-a") != final_decision(
            component, "held-sham-b"
        )
        if raw_resolved != bool(contrast["exposureResolvedActionDiverged"]):
            raise RuntimeError("Actual resolved action differs from public contrast")
        if raw_sham != bool(contrast["shamResolvedActionDiverged"]):
            raise RuntimeError("Actual sham action differs from public contrast")
        resolved_matches += 1
        sham_matches += 1
    return {
        **source,
        "componentCount": len(grouped),
        "predictorMatchCount": predictor_matches,
        "resolvedActionMatchCount": resolved_matches,
        "shamResolvedActionMatchCount": sham_matches,
        "aliasItemSearchLimit": ALIAS_ITEM_SEARCH_LIMIT,
    }


def average_ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and values[order[end]] == values[order[start]]:
            end += 1
        average = (start + 1 + end) / 2
        for position in range(start, end):
            ranks[order[position]] = average
        start = end
    return ranks


def auc_and_exact_p(rows: list[dict]) -> tuple[float | None, float | None, int]:
    n = len(rows)
    event_indices = [index for index, row in enumerate(rows) if row["event"]]
    k = len(event_indices)
    if k == 0 or k == n:
        return None, None, 0
    scores = [-float(row["minimumArmDecisionSeparation"]) for row in rows]
    ranks = average_ranks(scores)
    denominator = k * (n - k)

    def auc_for(indices) -> float:
        rank_sum = sum(ranks[index] for index in indices)
        return (rank_sum - k * (k + 1) / 2) / denominator

    observed = auc_for(event_indices)
    total = math.comb(n, k)
    extreme = 0
    for indices in itertools.combinations(range(n), k):
        if auc_for(indices) >= observed - 1e-12:
            extreme += 1
    return observed, extreme / total, total


def one_sided_paired_sign(exposure: list[bool], sham: list[bool]) -> dict:
    exposure_only = sum(left and not right for left, right in zip(exposure, sham))
    sham_only = sum(right and not left for left, right in zip(exposure, sham))
    discordant = exposure_only + sham_only
    if discordant == 0:
        p_value = 1.0
    else:
        p_value = sum(
            math.comb(discordant, count)
            for count in range(exposure_only, discordant + 1)
        ) / (2**discordant)
    return {
        "exposureOnlyCount": exposure_only,
        "shamOnlyCount": sham_only,
        "discordantCount": discordant,
        "oneSidedExactP": round(p_value, 6),
    }


def main() -> None:
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol = json.loads(protocol_bytes)
    selection_payload = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
    if selection_payload["selectionSha256"] != protocol["taskSelection"]["selectionSha256"]:
        raise RuntimeError("Frozen selection hash does not match the pilot protocol")
    selected = {
        (row["category"], row["taskId"]): row for row in selection_payload["tasks"]
    }
    if len(selected) != 32:
        raise RuntimeError("Frozen selection must contain 32 unique tasks")

    all_rows = []
    sources = {}
    provider_summaries = {}
    for provider in PROVIDERS:
        run_summary, contrasts, source = load_provider(provider)
        sources[provider] = source
        provider_rows = []
        for contrast in contrasts:
            key = (contrast["category"], contrast["taskId"])
            if key not in selected:
                raise RuntimeError("Provider output contains a task outside the manifest")
            frozen = selected[key]
            if (
                contrast["modelFamily"] != frozen["modelFamily"]
                or int(contrast["modelSeed"]) != int(frozen["modelSeed"])
            ):
                raise RuntimeError("Provider recommender assignment differs from the manifest")
            row = {
                "provider": provider,
                "category": contrast["category"],
                "taskId": contrast["taskId"],
                "modelFamily": contrast["modelFamily"],
                "modelSeed": contrast["modelSeed"],
                "minimumArmDecisionSeparation": frozen[
                    "minimumArmDecisionSeparation"
                ],
                "opportunityChanged": bool(frozen["opportunityChanged"]),
                "event": bool(contrast["persistentResolvedActionFeedback"]),
                "shamEvent": bool(
                    contrast["shamPersistentResolvedActionFeedback"]
                ),
                "resolvedActionDiverged": bool(
                    contrast["exposureResolvedActionDiverged"]
                ),
                "nextTaskDisplacement": contrast["exposureT3"],
            }
            provider_rows.append(row)
            all_rows.append(row)
        provider_rows.sort(key=lambda row: (row["category"], row["taskId"]))
        actual_state_audit = audit_actual_states(provider, contrasts, selected)
        auc, exact_p, enumeration_count = auc_and_exact_p(provider_rows)
        predictors = np.array(
            [row["minimumArmDecisionSeparation"] for row in provider_rows], dtype=float
        )
        threshold = float(np.quantile(predictors, 1 / 3, method="linear"))
        events = [row for row in provider_rows if row["event"]]
        bottom_events = sum(
            row["minimumArmDecisionSeparation"] <= threshold for row in events
        )
        exposure_flags = [row["event"] for row in provider_rows]
        sham_flags = [row["shamEvent"] for row in provider_rows]
        category_events = Counter(row["category"] for row in events)
        event_count = len(events)
        sham_count = sum(sham_flags)
        provider_summaries[provider] = {
            "taskCount": len(provider_rows),
            "persistentResolvedActionEventCount": event_count,
            "persistentResolvedActionEventRate": round(event_count / 32, 6),
            "shamPersistentResolvedActionEventCount": sham_count,
            "shamPersistentResolvedActionEventRate": round(sham_count / 32, 6),
            "shamAdjustedEventRate": round((event_count - sham_count) / 32, 6),
            "mechanismAuc": round(auc, 6) if auc is not None else None,
            "oneSidedExactPermutationP": round(exact_p, 6)
            if exact_p is not None
            else None,
            "exactPermutationEnumerationCount": enumeration_count,
            "bottomTertileThreshold": round(threshold, 6),
            "eventCountInBottomTertile": bottom_events,
            "eventFractionInBottomTertile": round(bottom_events / event_count, 6)
            if event_count
            else None,
            "eventCountOnOpportunityChangedTasks": sum(
                row["event"] and row["opportunityChanged"] for row in provider_rows
            ),
            "eventCountOutsideOpportunityChangedTasks": sum(
                row["event"] and not row["opportunityChanged"] for row in provider_rows
            ),
            "categoryEventCounts": {
                category: category_events[category]
                for category in protocol["categories"]
            },
            "pairedExposureVersusSham": one_sided_paired_sign(
                exposure_flags, sham_flags
            ),
            "reliability": {
                "validActionRate": run_summary["api"]["validActionRate"],
                "timeoutCount": run_summary["api"]["timeoutCount"],
                "requestCount": run_summary["api"]["requestCount"],
                "observedCostAtPublishedRates": run_summary["api"][
                    "observedCostAtPublishedRates"
                ],
                "currency": run_summary["api"]["currency"],
            },
            "actualStateAudit": actual_state_audit,
        }

    deepseek = provider_summaries["deepseek"]
    reliability_ok = all(
        provider_summaries[provider]["reliability"]["validActionRate"] >= 0.95
        and provider_summaries[provider]["reliability"]["timeoutCount"]
        / max(1, provider_summaries[provider]["reliability"]["requestCount"])
        < 0.05
        for provider in PROVIDERS
    )
    gates = {
        "reliability": reliability_ok,
        "deepseekSham": deepseek["shamPersistentResolvedActionEventRate"] <= 0.05,
        "deepseekEventSupport": deepseek["persistentResolvedActionEventCount"] >= 4,
        "deepseekDiscrimination": deepseek["mechanismAuc"] is not None
        and deepseek["mechanismAuc"] >= 0.70,
        "deepseekExactPermutation": deepseek["oneSidedExactPermutationP"] is not None
        and deepseek["oneSidedExactPermutationP"] <= 0.10,
        "deepseekBottomTertileConcentration": deepseek[
            "eventFractionInBottomTertile"
        ]
        is not None
        and deepseek["eventFractionInBottomTertile"] >= 2 / 3,
        "manifestMatch": True,
        "actualSentStateMatch": all(
            provider_summaries[provider]["actualStateAudit"]["predictorMatchCount"]
            == 32
            and provider_summaries[provider]["actualStateAudit"][
                "resolvedActionMatchCount"
            ]
            == 32
            and provider_summaries[provider]["actualStateAudit"][
                "shamResolvedActionMatchCount"
            ]
            == 32
            for provider in PROVIDERS
        ),
        "privacy": True,
    }
    decision = "go-mechanism-stress-test" if all(gates.values()) else "no-go"
    summary = {
        "schemaVersion": "online-storefront-deterministic-repair-pilot-evaluation-summary.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "protocolSha256": sha256(protocol_bytes),
        "selectionSha256": selection_payload["selectionSha256"],
        "sources": sources,
        "providers": provider_summaries,
        "gates": gates,
        "decision": decision,
        "cost": {
            provider: {
                "amount": provider_summaries[provider]["reliability"][
                    "observedCostAtPublishedRates"
                ],
                "currency": provider_summaries[provider]["reliability"]["currency"],
            }
            for provider in PROVIDERS
        },
        "claimBoundary": protocol["claimBoundary"],
    }
    write_json(OUTPUT_ROOT / "summary.json", summary, pretty=True)
    write_json(
        OUTPUT_ROOT / "rows.json",
        {
            "schemaVersion": "online-storefront-deterministic-repair-pilot-evaluation-rows.v1",
            "protocolSha256": summary["protocolSha256"],
            "rows": all_rows,
        },
    )
    files = {}
    for name in ("summary.json", "rows.json"):
        path = OUTPUT_ROOT / name
        files[name] = {"sha256": sha256(path.read_bytes()), "bytes": path.stat().st_size}
    write_json(
        OUTPUT_ROOT / "manifest.json",
        {
            "schemaVersion": "online-storefront-deterministic-repair-pilot-evaluation-manifest.v1",
            "protocolSha256": summary["protocolSha256"],
            "files": files,
        },
        pretty=True,
    )
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
