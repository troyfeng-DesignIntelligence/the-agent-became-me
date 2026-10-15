"""Validate the anonymous HAI 2026 poster release bundle."""

from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "output" / "pdf" / "hai-2026-poster-release"
PDF = RELEASE / "HAI2026_Poster_Anonymous.pdf"
SOURCE_ZIP = RELEASE / "HAI2026_Poster_Source.zip"
ARTIFACT_ZIP = RELEASE / "HAI2026_Anonymous_Artifact.zip"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def validate_pdf() -> dict[str, object]:
    reader = PdfReader(PDF)
    texts = [page.extract_text() or "" for page in reader.pages]
    content_text = " ".join(
        re.sub(r"(?<=[A-Za-z])-\s*\n\s*(?=[A-Za-z])", "", "\n".join(texts[:2])).split()
    )
    full_text = " ".join(
        re.sub(r"(?<=[A-Za-z])-\s*\n\s*(?=[A-Za-z])", "", "\n".join(texts)).split()
    )
    metadata = dict(reader.metadata or {})
    require(len(reader.pages) == 3, f"Expected two content pages plus one references-only page, found {len(reader.pages)}")
    require("/Author" not in metadata, "PDF metadata contains an Author field")
    require("Anonymous Author(s)" in texts[0], "Review PDF is not visibly anonymous")
    require("Generative AI disclosure" in texts[1], "Generative AI disclosure is missing from content page 2")
    for phrase in ["34/1,840", "24/1,840", "cyclic Latin square", "deterministic random realization", "cannot establish equivalence"]:
        require(phrase in content_text, f"Required calibrated phrase missing: {phrase}")
    for phrase in ["no selection-specific amplification", "proportional, smaller"]:
        require(phrase not in full_text, f"Overbroad phrase remains: {phrase}")
    for heading in ["Introduction", "Research Storefront and Protocols", "Results", "Implications and Limits", "Generative AI disclosure"]:
        require(heading not in texts[2], f"Content spilled onto references-only page: {heading}")
    return {"pages": len(reader.pages), "metadata": metadata}


def validate_source_zip() -> dict[str, object]:
    expected = {
        "main.tex",
        "references.bib",
        "SOURCE_README.md",
        "acmart.cls",
        "ACM-Reference-Format.bst",
        "figures/feedback-chain.png",
    }
    with zipfile.ZipFile(SOURCE_ZIP) as archive:
        names = {name.replace("\\", "/") for name in archive.namelist() if not name.endswith(("/", "\\"))}
        require(expected <= names, f"Source zip is missing: {sorted(expected - names)}")
        require(not any(Path(name).name.lower().startswith(".env") for name in names), "Source zip contains an environment file")
        require(
            archive.read("main.tex") == (ROOT / "experiments/hai-2026-poster/main.tex").read_bytes(),
            "Packaged main.tex differs from the reviewed source",
        )
    return {"fileCount": len(names)}


def validate_artifact_zip() -> dict[str, object]:
    with zipfile.ZipFile(ARTIFACT_ZIP) as archive:
        names = {name.replace("\\", "/") for name in archive.namelist() if not name.endswith(("/", "\\"))}
        require("public/results/online-storefront-v2/v1/rows.json" in names, "460-task Study 1 rows are missing")
        require("public/results/online-storefront-v2/v1/contrasts.json" in names, "460-task Study 1 contrasts are missing")
        require("scripts/evaluate-online-storefront-v2.mjs" in names, "Study 1 evaluator is missing")
        require("public/results/delegated-activation/v1/rows.json" in names, "Study 1 sizing pilot is missing")
        for provider in ["deepseek", "mimo"]:
            prefix = f"public/results/online-storefront-feedback-action-counterbalanced/v1/{provider}"
            require(f"{prefix}/rows.json" in names, f"Counterbalanced {provider} rows are missing")
            require(f"{prefix}/evaluation.json" in names, f"Counterbalanced {provider} evaluation is missing")
            evaluation = json.loads(archive.read(f"{prefix}/evaluation.json"))
            require(
                evaluation["gates"]["oneStepAgentRecommenderAgentFeedbackGatePassed"],
                f"Counterbalanced {provider} endpoint gate did not pass",
            )
            require(
                evaluation["gates"]["conditionOrderBalancePassed"],
                f"Counterbalanced {provider} order-balance gate did not pass",
            )
        comparison = "public/results/online-storefront-feedback-action-counterbalanced/v1/comparison.json"
        require(comparison in names, "Fixed-order sensitivity comparison is missing")
        require(not any(Path(name).name.lower().startswith(".env") for name in names), "Artifact zip contains an environment file")
        readme = archive.read("README.md").decode("utf-8")
        require("320-task" in readme and "460-task" in readme, "Artifact README does not distinguish pilot and confirmatory Study 1")
        require("does not establish equivalence or absence" in readme, "Artifact README overstates the random baseline")
    return {"fileCount": len(names)}


def main() -> None:
    for path in [PDF, SOURCE_ZIP, ARTIFACT_ZIP]:
        require(path.is_file(), f"Missing release file: {path}")
    result = {
        "passed": True,
        "pdf": validate_pdf(),
        "source": validate_source_zip(),
        "artifact": validate_artifact_zip(),
        "sha256": {path.name: digest(path) for path in [PDF, SOURCE_ZIP, ARTIFACT_ZIP]},
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
