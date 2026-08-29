"""
Run the full Marketing Analytics Datathon pipeline from a single command.

Usage:
    python run_pipeline.py
    python run_pipeline.py --dry-run
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent

STEPS = [
    ("Clean raw data", "analytics_case_study/01_data_cleaning.py"),
    ("Build integrated marts", "analytics_case_study/02_data_integration.py"),
    ("Export core analysis", "analytics_case_study/03_analysis.py"),
    ("Run attribution models", "analytics_case_study/03b_attribution.py"),
    ("Run advanced analytics", "analytics_case_study/03c_advanced_analytics.py"),
    ("Generate improved content-preserving dashboard", "analytics_case_study/04_html_dashboard.py"),
    ("Generate presentation", "analytics_case_study/05_presentation.py"),
    ("Validate outputs", "analytics_case_study/06_validate_metrics.py"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the complete datathon analytics pipeline.")
    parser.add_argument("--dry-run", action="store_true", help="Print steps without running them.")
    args = parser.parse_args()

    for label, script in STEPS:
        script_path = ROOT / script
        if args.dry_run:
            print(f"[dry-run] {label}: {script_path}")
            continue

        print(f"\n==> {label}")
        result = subprocess.run([sys.executable, str(script_path)], cwd=ROOT)
        if result.returncode != 0:
            print(f"\nPipeline stopped at: {label}", file=sys.stderr)
            return result.returncode

    print("\nPipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
