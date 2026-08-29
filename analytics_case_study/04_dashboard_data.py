"""Export a compact, browser-ready evidence contract for the React dashboard."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "integrated"
PUBLIC_DIR = ROOT / "frontend" / "public"
OUTPUT_DIR = ROOT / "outputs" / "dashboard"


def _clean(value):
    if value is None or value is pd.NA:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if math.isnan(float(value)) or math.isinf(float(value)) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value


def _records(name: str, columns: list[str] | None = None) -> list[dict]:
    frame = pd.read_parquet(DATA_DIR / f"{name}.parquet")
    if columns:
        frame = frame[[column for column in columns if column in frame.columns]]
    return [
        {key: _clean(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    context_path = ROOT / "public" / "dashboard_context.json"
    if not context_path.exists():
        context_path = OUTPUT_DIR / "dashboard_context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))

    payload = {
        "meta": {
            "title": "Marketing Analytics Decision Brief",
            "period": "2018–2024",
            "generated_from": "validated Parquet outputs",
            "methodology": "365-day first-touch attribution; resolved-outcome win rates; cohort maturity controls",
        },
        "context": context,
        "channel_pipeline": _records(
            "channel_pipeline",
            ["channel_category", "deal_count", "total_pipeline", "won_pipeline", "closed_win_rate", "win_rate", "resolved_share", "pipeline_pct", "channel_spend", "pipeline_roi", "revenue_roi"],
        ),
        "cohorts": _records(
            "cohort_analysis",
            ["quarter", "deals", "resolved", "won", "pipeline", "won_pipeline", "closed_win_rate", "win_rate", "resolved_share", "is_mature", "win_rate_ci_low", "win_rate_ci_high"],
        ),
        "coverage": _records(
            "account_coverage_summary",
            ["coverage_tier", "accounts", "with_opp", "pct_of_total", "opp_rate", "ci_low", "ci_high", "interpretation"],
        ),
        "attribution": _records(
            "attribution_results",
            ["channel", "attributed_pipeline", "deal_count", "attributed_won", "attribution_model"],
        ),
        "attribution_coverage": _records("attribution_coverage"),
        "quality": _records("data_quality_summary"),
        "feature_importance": _records("feature_importance", ["feature", "importance"]),
        "model_stats": _records("model_stats"),
        "budget_scenarios": _records("budget_scenarios"),
        "targeting": _records(
            "targeting_matrix",
            ["segment", "profile_fit", "resolved_deals", "won", "pipeline", "avg_deal", "active_accounts", "adjusted_win_rate", "ci_low", "ci_high", "evidence_tier", "priority"],
        ),
    }

    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    public_target = PUBLIC_DIR / "dashboard-data.json"
    output_target = OUTPUT_DIR / "dashboard_data.json"
    public_target.write_text(serialized, encoding="utf-8")
    output_target.write_text(serialized, encoding="utf-8")

    source_context = context_path
    if source_context.resolve() != (PUBLIC_DIR / "dashboard_context.json").resolve():
        shutil.copy2(source_context, PUBLIC_DIR / "dashboard_context.json")

    print(f"Dashboard data exported: {public_target}")


if __name__ == "__main__":
    main()
