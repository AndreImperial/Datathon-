"""Compatibility launcher for the canonical self-contained dashboard.

The project previously maintained a second Dash implementation with duplicate
metric logic. Keeping one generated dashboard prevents semantic drift.

Run: python analytics_case_study/04_dashboard.py
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "public" / "index.html"


def main() -> None:
    if not DASHBOARD.exists():
        subprocess.run([sys.executable, str(Path(__file__).with_name("04_html_dashboard.py"))], cwd=ROOT, check=True)
    sys.path.insert(0, str(ROOT))
    from app import app

    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8050")))


if __name__ == "__main__":
    main()
