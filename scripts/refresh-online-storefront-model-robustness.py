"""Refresh descriptive cross-family intervals without rerunning model inference."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/results/online-storefront-model-robustness/v1"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_module(
    "model_robustness_runner",
    ROOT / "scripts/run-online-storefront-model-robustness.py",
)
summary_path = OUTPUT / "summary.json"
contrasts_path = OUTPUT / "contrasts.json"
manifest_path = OUTPUT / "manifest.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))
contrasts = json.loads(contrasts_path.read_text(encoding="utf-8"))["rows"]
bootstrap_protocol = json.loads(runner.V2_PROTOCOL_PATH.read_text(encoding="utf-8"))
model_protocol = json.loads(runner.PROTOCOL_PATH.read_text(encoding="utf-8"))
bootstrap_protocol["uncertainty"] = model_protocol["uncertainty"]
summary["descriptiveBetweenFamily"] = runner.bootstrap_family_difference(
    contrasts, bootstrap_protocol
)
runner.write_json(summary_path, summary, pretty=True)
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for filename in ["summary.json", "rows.json", "contrasts.json"]:
    path = OUTPUT / filename
    manifest["files"][filename] = {
        "sha256": runner.sha256(path.read_bytes()),
        "bytes": path.stat().st_size,
    }
runner.write_json(manifest_path, manifest, pretty=True)
print(json.dumps(summary["descriptiveBetweenFamily"], indent=2))
