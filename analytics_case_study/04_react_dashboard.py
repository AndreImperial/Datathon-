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
    if build_result.returncode:
        return build_result.returncode

    # GitHub Pages cannot call Flask's /full-analysis route, so keep the
    # generated Plotly baseline inside the static artifact as well. Render
    # continues to serve the same file through app.py.
    legacy = ROOT / "outputs" / "dashboard" / "Marketing_Analytics_Dashboard.html"
    legacy_target = ROOT / "public" / "full-analysis" / "index.html"
    if not legacy.exists():
        print(f"Missing legacy dashboard; cannot create rollback artifact: {legacy}", file=sys.stderr)
        return 1
    legacy_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(legacy, legacy_target)
    print(f"Legacy Plotly baseline preserved at {legacy_target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
