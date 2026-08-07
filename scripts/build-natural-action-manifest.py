"""Build a deterministic integrity manifest for the public v6 action artifact."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public/results/online-storefront-natural-action-v2/v1"
PROTOCOL = ROOT / "experiments/online-storefront-v6/natural-action-study-protocol.json"
FILES = [
    "evaluation.json",
    "preflight.json",
    "call-stability-audit.json",
    "deepseek/rows.json",
    "deepseek/summary.json",
    "mimo/rows.json",
    "mimo/summary.json",
]


def digest(path: Path) -> dict[str, int | str]:
    payload = path.read_bytes()
    return {
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def main() -> None:
    protocol_text = PROTOCOL.read_text(encoding="utf-8").replace("\r\n", "\n")
    output = {
        "schemaVersion": "online-storefront-natural-action-manifest.v2",
        "protocolSha256": hashlib.sha256(protocol_text.encode("utf-8")).hexdigest(),
        "files": {name: digest(PUBLIC_ROOT / name) for name in FILES},
    }
    target = PUBLIC_ROOT / "manifest.json"
    target.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
