"""Build the allowlisted anonymous artifact for the HAI 2026 poster."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TMP_ROOT = (ROOT / "tmp" / "pdfs").resolve()
STAGING = (TMP_ROOT / "hai-anonymous-artifact-v10").resolve()
OUTPUT = ROOT / "output" / "pdf" / "hai-2026-poster-release" / "HAI2026_Anonymous_Artifact.zip"

SINGLE_FILES = {
    "experiments/hai-2026-poster/ANONYMOUS_ARTIFACT_README.md": "README.md",
    "scripts/build-feedback-action-manifest.py": None,
    "scripts/build-natural-language-policy-manifest.py": None,
    "scripts/evaluate-delegated-activation.mjs": None,
    "scripts/evaluate-online-storefront-v2.mjs": None,
    "scripts/evaluate-online-storefront-feedback-action.py": None,
    "scripts/evaluate-online-storefront-feedback-bridge.py": None,
    "scripts/evaluate-online-storefront-instrument-ablation.py": None,
    "scripts/evaluate-online-storefront-natural-language-policy.py": None,
    "scripts/run-delegated-activation.mjs": None,
    "scripts/run-delegated-activation.py": None,
    "scripts/run-online-storefront-v2.mjs": None,
    "scripts/run-online-storefront-v2.py": None,
    "scripts/run-online-storefront-feedback-action.py": None,
    "scripts/run-online-storefront-instrument-ablation.py": None,
    "scripts/run-online-storefront-natural-language-policy.py": None,
    "scripts/validate-online-storefront-feedback-action.py": None,
    "scripts/validate-online-storefront-natural-language-policy.py": None,
    "experiments/delegated-activation/CHI_STUDY_PLAN.md": None,
    "experiments/delegated-activation/REPORT.md": None,
    "experiments/delegated-activation/research.md": None,
    "experiments/online-storefront-v2/protocol.json": None,
    "experiments/online-storefront-v2/PREREGISTRATION.md": None,
    "experiments/online-storefront-v2/final_report.md": None,
    "experiments/online-storefront-v2/research.md": None,
    "experiments/online-storefront-v7/instrument-ablation-confirmatory-protocol.json": None,
    "experiments/online-storefront-v8/downstream-action-protocol.json": None,
    "experiments/online-storefront-v8/feedback-bridge-protocol.json": None,
    "experiments/online-storefront-v9/mimo-downstream-action-protocol.json": None,
    "experiments/online-storefront-v9/natural-language-policy-protocol.json": None,
    "experiments/online-storefront-v9/REPORT.md": None,
    "experiments/online-storefront-v10/deepseek-counterbalanced-endpoint-protocol.json": None,
    "experiments/online-storefront-v10/mimo-counterbalanced-endpoint-protocol.json": None,
    "scripts/compare-online-storefront-feedback-action-counterbalance.py": None,
}

PUBLIC_DIRS = [
    "public/results/delegated-activation/v1",
    "public/results/online-storefront-v2/v1",
    "public/results/online-storefront-instrument-ablation-confirmatory/v1",
    "public/results/online-storefront-feedback-bridge/v1",
    "public/results/online-storefront-feedback-action/v1",
    "public/results/online-storefront-feedback-action-mimo/v1",
    "public/results/online-storefront-natural-language-policy/v1",
    "public/results/online-storefront-feedback-action-counterbalanced/v1",
]

FORBIDDEN_NAMES = {".env", ".env.local", "credentials.json", "secrets.json"}
SECRET_PATTERNS = {
    "OpenAI-style secret": re.compile(rb"(?<![A-Za-z0-9-])sk-[A-Za-z0-9_-]{20,}"),
    "literal bearer token": re.compile(rb"Bearer\s+[A-Za-z0-9._-]{24,}"),
    "absolute Windows user path": re.compile(rb"[A-Za-z]:\\Users\\[^\\\r\n]+"),
    "workspace absolute path": re.compile(rb"[A-Za-z]:\\Portfolio\\"),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_file(relative_source: str, relative_target: str | None = None) -> None:
    source = ROOT / relative_source
    target = STAGING / (relative_target or relative_source)
    if not source.is_file():
        raise FileNotFoundError(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def copy_public_directory(relative: str) -> None:
    source = ROOT / relative
    if not source.is_dir():
        raise FileNotFoundError(source)
    for path in sorted(source.rglob("*")):
        if not path.is_file() or path.name == ".gitkeep":
            continue
        copy_file(path.relative_to(ROOT).as_posix())


def validate_staging() -> list[Path]:
    files = sorted(path for path in STAGING.rglob("*") if path.is_file())
    if not files:
        raise RuntimeError("The anonymous artifact staging directory is empty")
    failures: list[str] = []
    for path in files:
        if path.name.lower() in FORBIDDEN_NAMES:
            failures.append(f"forbidden filename: {path.relative_to(STAGING)}")
        data = path.read_bytes()
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(data):
                failures.append(f"{label}: {path.relative_to(STAGING)}")
    if failures:
        raise RuntimeError("Anonymous artifact validation failed:\n" + "\n".join(failures))
    return files


def write_zip(files: list[Path]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".zip.tmp")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = path.relative_to(STAGING).as_posix()
            info = zipfile.ZipInfo(relative, date_time=(2026, 8, 7, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    temporary.replace(OUTPUT)


def main() -> None:
    if not STAGING.is_relative_to(TMP_ROOT) or STAGING == TMP_ROOT:
        raise RuntimeError(f"Unsafe staging target: {STAGING}")
    if STAGING.exists():
        shutil.rmtree(STAGING)
    STAGING.mkdir(parents=True)

    for source, target in SINGLE_FILES.items():
        copy_file(source, target)
    for directory in PUBLIC_DIRS:
        copy_public_directory(directory)

    files = validate_staging()
    write_zip(files)
    summary = {
        "output": str(OUTPUT),
        "fileCount": len(files),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha256(OUTPUT),
        "containsStudy1Confirmatory": (STAGING / "public/results/online-storefront-v2/v1/rows.json").is_file(),
        "containsCounterbalancedFinalEndpoint": (
            STAGING
            / "public/results/online-storefront-feedback-action-counterbalanced/v1/deepseek/rows.json"
        ).is_file(),
        "containsEnvironmentFile": any(path.name.lower() in FORBIDDEN_NAMES for path in files),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
