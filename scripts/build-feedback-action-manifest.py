"""Build a hash manifest for a public feedback-action result bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROTOCOL = ROOT / "experiments/online-storefront-v9/mimo-downstream-action-protocol.json"
FILES = ["preflight.json", "run-summary.json", "rows.json", "evaluation.json", "validation.json"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default=str(DEFAULT_PROTOCOL.relative_to(ROOT)))
    args = parser.parse_args()
    protocol_path = (ROOT / args.protocol).resolve()
    if ROOT not in protocol_path.parents:
        raise RuntimeError("Protocol path must remain inside the repository")
    protocol_text = protocol_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    protocol = json.loads(protocol_text)
    output = ROOT / protocol["outputs"]["publicRoot"]
    missing = [name for name in FILES if not (output / name).exists()]
    if missing:
        raise RuntimeError(f"Cannot build manifest; missing files: {missing}")
    payload = {
        "schemaVersion": "online-storefront-feedback-action-manifest.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": hashlib.sha256(protocol_text.encode("utf-8")).hexdigest(),
        "files": {
            name: {
                "bytes": (output / name).stat().st_size,
                "sha256": hashlib.sha256((output / name).read_bytes()).hexdigest(),
            }
            for name in FILES
        },
    }
    (output / "manifest.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
