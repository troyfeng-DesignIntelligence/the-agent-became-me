# WebArena Delegation-Provenance Research Log

## Baseline — Iteration 0

- **Observed:** The repository has a deterministic synthetic trace generator, profile updater, matched-attenuation baseline, scope-gated condition, no-update bound, and artifact verification.
- **Observed:** The current Windows host has no Docker executable and no installed WSL distribution.
- **Observed:** WebArena's official resource page reports 179 released human Playwright traces and multiple released agent execution-trace collections.
- **Missing evidence:** No released WebArena trajectory has yet been downloaded, parsed, paired, or replayed through the local updater.
- **Baseline evidence-readiness score:** `0.000`.
- **Next hypothesis:** A source manifest plus task metadata acquisition can establish provenance and identify shopping-task IDs before large trace downloads.

## Iteration 1 — Shallow repository clone

- **Hypothesis:** A shallow clone of the official WebArena repository will provide task configuration, resource metadata, and a fixed Git revision in one acquisition step.
- **Experiment:** Ran a five-minute-guarded `git clone --depth 1` against `https://github.com/web-arena-x/webarena.git`.
- **Observed result:** The connection reset while Git was reading the remote ref advertisement (`RPC failed; curl 28`); no repository revision was acquired.
- **Evaluation:** `0.000`, not kept. This is an acquisition failure, not evidence about the research hypothesis.
- **Next strategy:** Download the small raw configuration and resource files directly from `raw.githubusercontent.com`, record their hashes, and avoid Git protocol negotiation.

## Iteration 2 — Pinned metadata acquisition

- **Hypothesis:** Commit-pinned raw files can establish source provenance and enumerate the shopping task corpus without cloning the repository.
- **Experiment:** Downloaded the task config, resource index, license, and GitHub commit metadata; recorded byte counts and SHA-256 hashes.
- **Observed result:** Integrity checks passed. The pinned corpus contains 812 tasks, including 192 tasks whose site list contains `shopping`.
- **Evaluation:** `0.150`, kept. This establishes task-corpus provenance, not trajectory evidence.
- **Next strategy:** Attempt the official Drive trace source and a published mirror before invoking the protocol's task-corpus pivot.

## Iteration 3 — Released-trajectory acquisition gate

- **Hypothesis:** At least one released trajectory host will expose an index or range-readable archive from the current execution environment.
- **Experiment:** Requested the official human-trajectory Drive folder and the Agent-Eval-Refine Hugging Face archive endpoint under bounded timeouts.
- **Observed result:** Both hosts timed out at TCP connection setup. The official GitHub resource page remains reachable and documents the releases, but no raw trajectory was obtained.
- **Evaluation:** `0.150`, not kept as a data improvement. The no-go criterion for claiming a released-trajectory replay is active.
- **Pivot:** Run a WebArena-derived task-pressure pilot from the commit-pinned shopping task definitions. Label every output as a pilot and reserve the full trajectory claim.

## Iteration 4 — Task-pressure fallback

- **Hypothesis:** The official shopping task corpus can still pressure-test downstream update contracts if deterministic minimal-completion events are clearly separated from observed actions.
- **Experiment:** Classified all 192 shopping tasks into six intent classes, generated a fixed minimal event template for each class, and replayed every task through all six update contracts.
- **Observed result:** Classification coverage and condition completeness reached 100%; deterministic checks and focused tests passed.
- **Evaluation:** `0.800`, kept as a fallback artifact. The external-trajectory component remained false, so this did not satisfy the main target.
- **Next strategy:** Try a byte-range-readable mirror and inspect the large archive without downloading it in full.

## Iteration 5 — Released trajectory replay

- **Hypothesis:** A ZIP central-directory range request can locate the small structured WebArena members inside a multi-gigabyte public archive.
- **Experiment:** Read the archive's last 64 KiB, parsed 19,787 central-directory entries, and selectively fetched two compressed members. Verified member sizes, CRC-32 values, and SHA-256 hashes. Matched all 192 official shopping task IDs to released GPT-4 CoT action trajectories and outcome labels, then replayed their frozen mapped evidence through six contracts.
- **Observed result:** 192/192 shopping trajectories parsed, covering 1,740 browser steps. The conservative mapper admitted 160 evidence events across 67 traces. Failed trajectories contained 142 of those events. Scope gating reduced total evidence mass 81.36% relative to actor-blind replay and admitted zero non-commit mass. Logged-only and actor-blind mass were identical; matched attenuation and provenance-aware total mass were identical by construction.
- **Evaluation:** `1.000`, kept. Mechanical evaluator returned `pass: true`; the target was achieved.
- **Disposition:** Stop autonomous search. Preserve raw third-party members only under ignored `artifacts/`; commit code, hashes, aggregate derivatives, report, and figures.
