"""Build the production React dashboard from validated analytics outputs."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    exporter = ROOT / "analytics_case_study" / "04_dashboard_data.py"
    export_result = subprocess.run([sys.executable, str(exporter)], cwd=ROOT)
    if export_result.returncode:
        return export_result.returncode

    npm = shutil.which("npm")
    if not npm:
        print("npm is required to build the React dashboard", file=sys.stderr)
        return 1
    build_result = subprocess.run([npm, "run", "build"], cwd=ROOT, shell=sys.platform == "win32")
    return build_result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
