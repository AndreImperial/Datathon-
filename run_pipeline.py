"""
Run the full Marketing Analytics Datathon pipeline from a single command.

Usage:
    python run_pipeline.py
    python run_pipeline.py --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from importlib.metadata import version
import subprocess
import sys
from pathlib import Path
from source_control import check_source_schema


ROOT = Path(__file__).resolve().parent

STEPS = [
    ("Clean raw data", "analytics_case_study/01_data_cleaning.py"),
    ("Build integrated marts", "analytics_case_study/02_data_integration.py"),
    ("Export core analysis", "analytics_case_study/03_analysis.py"),
    ("Run attribution models", "analytics_case_study/03b_attribution.py"),
    ("Run advanced analytics", "analytics_case_study/03c_advanced_analytics.py"),
    ("Build schema-v3 CMO evidence contract", "analytics_case_study/03d_case_analysis.py"),
    # Generate the Plotly dashboard first so it remains the immutable
    # analytical baseline, then build the React presentation from its
    # validated context and Parquet-backed data contract.
    ("Generate immutable legacy dashboard", "analytics_case_study/04_html_dashboard.py"),
    ("Build content-preserving React dashboard", "analytics_case_study/04_react_dashboard.py"),
    ("Validate outputs", "analytics_case_study/06_validate_metrics.py"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the complete datathon analytics pipeline.")
    parser.add_argument("--dry-run", action="store_true", help="Print steps without running them.")
    args = parser.parse_args()

    if not args.dry_run:
        source_status = check_source_schema(ROOT)
        sources = []
        for source in sorted((ROOT / "data" / "raw").glob("*.xlsx")):
            sources.append({"source_id": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "bytes": source.stat().st_size})
        metadata = {"python": platform.python_version(), "dependencies": {name: version(name) for name in ["pandas", "numpy", "scikit-learn", "pyarrow", "plotly", "openpyxl"]}, "started_at": datetime.now(timezone.utc).isoformat(), "source_files": sources, "source_freshness_status": "historical supplied extract; production expected-date/refresh policy pending", "release_status": "running", "source_control": source_status}
        metadata_path = ROOT / "outputs" / "run_metadata.json"
        metadata_path.parent.mkdir(exist_ok=True)
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
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

    if not args.dry_run:
        metadata["release_status"] = "validated"
        metadata["completed_at"] = datetime.now(timezone.utc).isoformat()
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print("\nPipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
