import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundled = process.env.USERPROFILE
  ? resolve(
      process.env.USERPROFILE,
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
    )
  : "";
const candidates = [process.env.PYTHON_EXECUTABLE, bundled, "python", "python3"].filter(Boolean);
let python = "";
for (const candidate of candidates) {
  if (!candidate.includes("\\") && !candidate.includes("/")) {
    python = candidate;
    break;
  }
  try {
    await access(candidate);
    python = candidate;
    break;
  } catch {
    // Try next runtime.
  }
}
if (!python) throw new Error("Python 3.12+ not found. Set PYTHON_EXECUTABLE.");

const child = spawn(
  python,
  [resolve(root, "scripts/run-online-storefront-model-robustness.py")],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: [resolve(root, "artifacts/python-packages"), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(delimiter)
    }
  }
);
child.on("exit", (code) => process.exit(code ?? 1));
