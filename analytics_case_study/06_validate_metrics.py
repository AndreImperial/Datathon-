"""
Validation checks for headline analytics numbers.

Run after regenerating the pipeline:
  python analytics_case_study/06_validate_metrics.py
"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, ANALYSIS_DIR


TOLERANCE = 0.01


def _load_clean(name: str) -> pd.DataFrame:
    return pd.read_parquet(os.path.join(CLEANED_DATA_DIR, f"{name}.parquet"))


def _load_int(name: str) -> pd.DataFrame:
    return pd.read_parquet(os.path.join(INTEGRATED_DATA_DIR, f"{name}.parquet"))


def _assert_close(label: str, actual: float, expected: float, tolerance: float = TOLERANCE):
    if abs(float(actual) - float(expected)) > tolerance:
        raise AssertionError(f"{label}: actual={actual:,.2f}, expected={expected:,.2f}")
    print(f"OK {label}: {actual:,.2f}")


def _assert_equal(label: str, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: actual={actual}, expected={expected}")
    print(f"OK {label}: {actual}")


def main():
    opps = _load_clean("opportunities")
    campaign6s = _load_clean("6sense_campaign")
    ad_metrics = _load_clean("ad_metrics")
    email = _load_clean("email_engagements")
    web = _load_clean("web_engagements")

    master = _load_int("master_account")
    channel = _load_int("channel_pipeline")
    funnel = _load_int("funnel_metrics")
    attribution = _load_int("attribution_results")

    roi = pd.read_excel(os.path.join(ANALYSIS_DIR, "channel_roi.xlsx"),
                        sheet_name="Channel ROI Summary")

    won_col = "iswon" if "iswon" in opps.columns else "_iswon"
    opp_pipeline = opps["_amount"].sum()
    opp_won = opps.loc[opps[won_col] == True, "_amount"].sum()
    opp_won_count = int((opps[won_col] == True).sum())

    _assert_equal("unique opportunities", len(opps), opps["_opportunity_id"].nunique())
    _assert_close("opportunity pipeline vs channel pipeline",
                  channel["total_pipeline"].sum(), opp_pipeline)
    _assert_close("opportunity won revenue vs channel won revenue",
                  channel["won_pipeline"].sum(), opp_won)
    _assert_equal("opportunity won count vs channel won count",
                  int(channel["won_count"].sum()), opp_won_count)
    _assert_close("master account pipeline vs opportunity pipeline",
                  master["total_pipeline"].sum(), opp_pipeline)
    _assert_close("channel workbook won revenue vs channel parquet",
                  roi["Won Revenue ($)"].sum(), channel["won_pipeline"].sum())
    _assert_equal("channel workbook won count vs channel parquet",
                  int(roi["Won Deals"].sum()), int(channel["won_count"].sum()))

    expected_funnel = {
        "Impressions": int(campaign6s["_impressions"].sum() + ad_metrics["_impressions"].sum()),
        "Clicks": int(campaign6s["_clicks"].sum() + ad_metrics["_clicks"].sum()),
        "Form Fills / Goal Completions": int(campaign6s["_influencedformfills"].sum()
                                             + web["is_goal_completed"].sum()),
        "Email Engagements": int(len(email)),
        "Email Clicks": int(email["is_click"].sum()),
        "All Opportunities": int(len(opps)),
        "Marketing-Sourced Opps": int(opps["is_marketing_sourced"].sum()),
        "Closed Won (All)": opp_won_count,
        "Marketing-Sourced Won": int(((opps["is_marketing_sourced"] == True)
                                      & (opps[won_col] == True)).sum()),
    }
    actual_funnel = dict(zip(funnel["stage"], funnel["count"].astype(int)))
    for stage, expected in expected_funnel.items():
        _assert_equal(f"funnel stage {stage}", actual_funnel.get(stage), expected)

    influenced = attribution[attribution["attribution_model"] == "Marketing Influenced"]
    first_touch = attribution[attribution["attribution_model"] == "First-Touch"]
    _assert_close("influenced pipeline vs first-touch pipeline",
                  influenced["attributed_pipeline"].sum(),
                  first_touch["attributed_pipeline"].sum())
    _assert_close("influenced won revenue vs first-touch won revenue",
                  influenced["attributed_won"].sum(),
                  first_touch["attributed_won"].sum())

    print("\nAll validation checks passed.")


if __name__ == "__main__":
    main()
