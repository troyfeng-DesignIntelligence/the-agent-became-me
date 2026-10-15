"""Build validated HAI 2026 pp1206 camera-ready upload files.

This script never uploads anything. It packages an explicit allowlist into the
ACM TAPS source/pdf/supplements directory structure.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "experiments" / "hai-2026-camera-ready"
SOURCE = WORK / "source"
OUT = ROOT / "output" / "pdf" / "hai-2026-camera-ready-final"
BUILD = ROOT / "output" / "pdf" / "hai-2026-camera-ready-draft"
RELEASE = ROOT / "output" / "pdf" / "hai-2026-poster-release"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def zip_allowlist(target: Path, entries: list[tuple[Path, str]]) -> dict:
    require(len({name for _, name in entries}) == len(entries), "Duplicate ZIP entry")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for source, name in entries:
            require(source.is_file(), f"Missing required file: {source}")
            require(not name.startswith("/") and ".." not in Path(name).parts, "Unsafe archive path")
            require(".env" not in name.lower(), "Environment file prohibited")
            archive.write(source, name)
    return {"file": target.name, "sha256": sha256(target), "entries": [name for _, name in entries]}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manuscript = BUILD / "main.pdf"
    require(manuscript.is_file(), "Compile main.tex before final packaging")
    reader = PdfReader(manuscript)
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    require(len(reader.pages) == 3, "Expected two content pages plus references")
    require("Generative AI disclosure" in text, "Missing generative AI disclosure")
    require("10.1145/3841580.3845761" in text, "Missing DOI")
    require("2354251@tongji.edu.cn" in text, "Wrong author email")
    require("1308825834@qq.com" not in text, "Old email remains")
    require("DRAFT" not in text.upper(), "Draft marker remains in manuscript")

    reference_pdf = OUT / "HAI2026_pp1206_Reference.pdf"
    shutil.copyfile(manuscript, reference_pdf)

    source_names = [
        "main.tex", "references.bib", "rights.tex", "acmart.cls",
        "ACM-Reference-Format.bst", "figures/feedback-chain-restored.pdf",
    ]
    source_entries = [(SOURCE / name, f"source/{name}") for name in source_names]
    source_entries.append((reference_pdf, "pdf/main.pdf"))

    supplement_names = [
        "README.md", "deepseek-served-order-requests.json",
        "mimo-served-order-requests.json", "prompt-invariance-audit.json",
        "deepseek-summary-original.json", "mimo-summary-original.json",
    ]
    supplement_entries = [
        (BUILD / "HAI2026_S1_Prompt_Record.pdf", "supplements/HAI2026_S1_Prompt_Record.pdf"),
        *[(WORK / "supplement" / name, f"supplements/{name}") for name in supplement_names],
        (RELEASE / "HAI2026_Anonymous_Artifact.zip", "supplements/HAI2026_Anonymous_Artifact.zip"),
        (SOURCE / "figures" / "feedback-chain-restored.svg", "supplements/figure-source/feedback-chain-restored.svg"),
        (ROOT / "scripts" / "prepare-hai-camera-ready.py", "supplements/provenance/prepare-hai-camera-ready.py"),
    ]

    final_zip = OUT / "HAI2026_pp1206_Source.zip"
    source_info = zip_allowlist(final_zip, source_entries + supplement_entries)
    supplement_zip = OUT / "HAI2026_pp1206_Supplement.zip"
    supplement_info = zip_allowlist(
        supplement_zip,
        [(path, name.removeprefix("supplements/")) for path, name in supplement_entries],
    )

    with zipfile.ZipFile(final_zip) as archive:
        names = archive.namelist()
        require(all(name.startswith(("source/", "pdf/", "supplements/")) for name in names), "Unexpected ZIP root")
        require(names.count("source/main.tex") == 1, "Source ZIP must contain one main.tex")
        require(names.count("pdf/main.pdf") == 1, "Source ZIP must contain one reference PDF")
        tex_count = 0
        for name in names:
            if name.endswith(".tex"):
                body = archive.read(name).decode("utf-8", errors="replace")
                tex_count += len(re.findall(r"\\documentclass(?:\[[^\]]*\])?\{acmart\}", body))
        require(tex_count == 1, "TAPS package must contain exactly one acmart documentclass")

    report = {
        "status": "READY_FOR_AUTHOR_UPLOAD",
        "submission": "HAI 2026 Poster pp1206",
        "referencePdf": {"file": reference_pdf.name, "sha256": sha256(reference_pdf), "pages": 3},
        "sourceZip": source_info,
        "supplementZip": supplement_info,
        "tapsRoots": ["source", "pdf", "supplements"],
        "editableFigureSourceIncluded": True,
        "externalSubmissionPerformed": False,
    }
    (OUT / "FINAL_VALIDATION.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()