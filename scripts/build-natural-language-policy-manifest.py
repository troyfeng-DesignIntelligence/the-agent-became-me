"""Build a hash manifest for the public V9 natural-language policy bundle."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public/results/online-storefront-natural-language-policy/v1"
PROTOCOL = ROOT / "experiments/online-storefront-v9/natural-language-policy-protocol.json"
FILES = [
    "preflight.json",
    "evaluation.json",
    "validation.json",
    "deepseek/rows.json",
    "deepseek/summary.json",
    "mimo/rows.json",
    "mimo/summary.json",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    missing = [name for name in FILES if not (PUBLIC / name).exists()]
    if missing:
        raise RuntimeError(f"Cannot build manifest; missing files: {missing}")
    protocol_text = PROTOCOL.read_text(encoding="utf-8").replace("\r\n", "\n")
    payload = {
        "schemaVersion": "online-storefront-natural-language-policy-manifest.v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "protocolSha256": hashlib.sha256(protocol_text.encode("utf-8")).hexdigest(),
        "files": {
            name: {"bytes": (PUBLIC / name).stat().st_size, "sha256": digest(PUBLIC / name)}
            for name in FILES
        },
    }
    (PUBLIC / "manifest.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
