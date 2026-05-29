"""
Phase 6: Validate generated analysis artifacts.

This script checks that the pipeline produced the expected files, that core
metric columns are present, and that the static dashboard copy in public/ is
in sync with the generated dashboard.
"""
import hashlib
import os
import ast
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, OUTPUTS_DIR


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_HTML = os.path.join(BASE_DIR, "public", "index.html")
DASHBOARD_HTML = os.path.join(OUTPUTS_DIR, "dashboard", "Marketing_Analytics_Dashboard.html")
PRESENTATION_DECK = os.path.join(OUTPUTS_DIR, "presentation", "Marketing_Analytics_Executive_Deck_v4.pptx")
DASHBOARD_SOURCE = os.path.join(BASE_DIR, "analytics_case_study", "04_html_dashboard.py")
PIPELINE_RUNNER = os.path.join(BASE_DIR, "run_pipeline.py")
RUBRIC_ALIGNMENT = os.path.join(BASE_DIR, "RUBRIC_ALIGNMENT.md")


REQUIRED_CLEANED = {
    "opportunities": ["_opportunity_id", "_amount", "channel_category", "is_marketing_sourced"],
    "accounts": ["accountid", "domain__c"],
    "email_engagements": ["_domain"],
    "web_engagements": ["has_domain"],
    "6sense_campaign": ["_6sensedomain"],
    "ad_metrics": ["_spend", "_clicks", "_impressions"],
}

REQUIRED_INTEGRATED = {
    "master_account": ["domain__c"],
    "channel_pipeline": ["channel_category", "deal_count", "total_pipeline", "won_pipeline"],
    "funnel_metrics": ["channel", "stage", "count"],
    "creative_performance": ["ctr"],
    "attribution_results": ["channel", "attribution_model", "attributed_pipeline"],
    "win_probability": ["win_probability"],
    "model_stats": ["auc", "accuracy"],
    "account_coverage": ["domain", "coverage_tier"],
    "cohort_analysis": ["quarter", "pipeline", "win_rate"],
}


def _hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_parquet(folder, name, required, errors, warnings):
    path = os.path.join(folder, f"{name}.parquet")
    if not os.path.exists(path):
        errors.append(f"Missing {path}")
        return pd.DataFrame()

    df = pd.read_parquet(path)
    missing = [c for c in required if c not in df.columns]
    if missing:
        errors.append(f"{name}.parquet missing columns: {', '.join(missing)}")
    if df.empty:
        warnings.append(f"{name}.parquet is empty")
    return df


def _validate_cleaned(errors, warnings):
    cleaned = {
        name: _read_parquet(CLEANED_DATA_DIR, name, cols, errors, warnings)
        for name, cols in REQUIRED_CLEANED.items()
    }

    opps = cleaned.get("opportunities", pd.DataFrame())
    if not opps.empty:
        won_cols = [c for c in ["iswon", "_iswon"] if c in opps.columns]
        if not won_cols:
            errors.append("opportunities.parquet needs either iswon or _iswon")
        else:
            won = opps[won_cols[0]]
            if won.notna().sum() == 0:
                errors.append(f"opportunities.parquet {won_cols[0]} is entirely null")
            elif not won.dropna().isin([True, False]).all():
                errors.append(f"opportunities.parquet {won_cols[0]} contains non-boolean values")
        if "_opportunity_id" in opps.columns and opps["_opportunity_id"].duplicated().any():
            errors.append("opportunities.parquet contains duplicate _opportunity_id rows")
        if "_amount" in opps.columns and pd.to_numeric(opps["_amount"], errors="coerce").isna().all():
            errors.append("opportunities.parquet _amount is entirely non-numeric/null")
        closed_cols = [c for c in ["isclosed", "_isclosed"] if c in opps.columns]
        if won_cols and closed_cols:
            leakage = (opps[won_cols[0]] == True) & (opps[closed_cols[0]] == False)
            if leakage.any():
                errors.append(f"opportunities.parquet has {int(leakage.sum())} won opportunities not marked closed")
        if won_cols:
            date_col = next((c for c in ["_closedate", "closedate", "close_date"] if c in opps.columns), None)
            if date_col:
                missing_won_close_dates = (opps[won_cols[0]] == True) & pd.to_datetime(opps[date_col], errors="coerce").isna()
                if missing_won_close_dates.any():
                    warnings.append(f"opportunities.parquet has {int(missing_won_close_dates.sum())} won opportunities missing close dates")

    accounts = cleaned.get("accounts", pd.DataFrame())
    if not accounts.empty and "accountid" in accounts.columns and accounts["accountid"].duplicated().any():
        warnings.append("accounts.parquet still has duplicate accountid values")


def _validate_integrated(errors, warnings):
    integrated = {
        name: _read_parquet(INTEGRATED_DATA_DIR, name, cols, errors, warnings)
        for name, cols in REQUIRED_INTEGRATED.items()
    }

    channel = integrated.get("channel_pipeline", pd.DataFrame())
    if not channel.empty and {"deal_count", "total_pipeline"}.issubset(channel.columns):
        if (channel["deal_count"] < 0).any() or (channel["total_pipeline"] < 0).any():
            errors.append("channel_pipeline has negative deal_count or total_pipeline")

    funnel = integrated.get("funnel_metrics", pd.DataFrame())
    if not funnel.empty:
        stale_channels = funnel[funnel["channel"] == "All Channels"]
        if not stale_channels.empty:
            warnings.append("funnel_metrics contains legacy All Channels rows")
        if "conversion_from_prev" in funnel.columns:
            bad_conversion = funnel["conversion_from_prev"].dropna() > 1
            if bad_conversion.any():
                warnings.append("funnel_metrics has conversion_from_prev values above 100%")
        expected_outcomes = {"All Opportunity Outcomes", "Marketing-Sourced Outcomes"}
        missing_outcomes = sorted(expected_outcomes - set(funnel["channel"].dropna()))
        if missing_outcomes:
            warnings.append(f"funnel_metrics missing outcome channels: {', '.join(missing_outcomes)}")

    attribution = integrated.get("attribution_results", pd.DataFrame())
    if not attribution.empty:
        models = set(attribution.get("attribution_model", []))
        expected = {"Marketing Sourced", "Marketing Influenced", "First-Touch", "Last-Touch"}
        missing_models = sorted(expected - models)
        if missing_models:
            warnings.append(f"attribution_results missing models: {', '.join(missing_models)}")


def _validate_outputs(errors, warnings):
    for path in [DASHBOARD_HTML, PUBLIC_HTML]:
        if not os.path.exists(path):
            errors.append(f"Missing {path}")

    if os.path.exists(DASHBOARD_HTML) and os.path.exists(PUBLIC_HTML):
        if _hash(DASHBOARD_HTML) != _hash(PUBLIC_HTML):
            errors.append("public/index.html is not in sync with outputs/dashboard/Marketing_Analytics_Dashboard.html")
        with open(DASHBOARD_HTML, "r", encoding="utf-8") as f:
            dashboard_text = f.read()
        required_fragments = [
            "quality-strip",
            "s-essential",
            "Case Deliverable Coverage",
            "metric-lens",
            "caveats-drawer",
            "chart-caption",
            "chart-story",
            "Finding",
            "Meaning",
            "Action",
            "nav-progress",
            "data-lens=\"dollars\"",
            "dashboard-search",
            "menu-button",
            "export-button",
            "prefers-reduced-motion",
        ]
        missing_fragments = [fragment for fragment in required_fragments if fragment not in dashboard_text]
        if missing_fragments:
            errors.append(f"dashboard HTML missing UX/audit fragments: {', '.join(missing_fragments)}")

    analysis_dir = os.path.join(OUTPUTS_DIR, "analysis")
    expected_workbooks = [
        "channel_roi.xlsx",
        "segment_conversion.xlsx",
        "creative_performance.xlsx",
        "email_campaign_performance.xlsx",
        "attribution_models.xlsx",
        "advanced_analytics.xlsx",
    ]
    for filename in expected_workbooks:
        path = os.path.join(analysis_dir, filename)
        if not os.path.exists(path):
            warnings.append(f"Missing analysis workbook: {path}")

    if not os.path.exists(PRESENTATION_DECK):
        warnings.append(f"Missing presentation deck: {PRESENTATION_DECK}")
    elif os.path.getsize(PRESENTATION_DECK) < 100 * 1024:
        warnings.append(f"Presentation deck looks unexpectedly small: {PRESENTATION_DECK}")


def _validate_source_health(errors, warnings):
    for path in [DASHBOARD_SOURCE, PIPELINE_RUNNER]:
        if not os.path.exists(path):
            errors.append(f"Missing source artifact: {path}")

    if os.path.exists(DASHBOARD_SOURCE):
        with open(DASHBOARD_SOURCE, "r", encoding="utf-8") as f:
            source = f.read()
        tree = ast.parse(source, filename=DASHBOARD_SOURCE)
        defs = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                defs.setdefault(node.name, []).append(node.lineno)
        dupes = {name: lines for name, lines in defs.items() if len(lines) > 1}
        if dupes:
            details = "; ".join(f"{name} at lines {lines}" for name, lines in sorted(dupes.items()))
            errors.append(f"04_html_dashboard.py has duplicate function definitions: {details}")

    if os.path.exists(PIPELINE_RUNNER):
        with open(PIPELINE_RUNNER, "r", encoding="utf-8") as f:
            runner = f.read()
        expected_steps = [
            "01_data_cleaning.py",
            "02_data_integration.py",
            "03_analysis.py",
            "03b_attribution.py",
            "03c_advanced_analytics.py",
            "04_html_dashboard.py",
            "05_presentation.py",
            "06_validate_metrics.py",
        ]
        missing_steps = [step for step in expected_steps if step not in runner]
        if missing_steps:
            errors.append(f"run_pipeline.py missing pipeline steps: {', '.join(missing_steps)}")

    if not os.path.exists(RUBRIC_ALIGNMENT):
        errors.append(f"Missing rubric alignment document: {RUBRIC_ALIGNMENT}")
    else:
        with open(RUBRIC_ALIGNMENT, "r", encoding="utf-8") as f:
            rubric = f.read()
        required_rubric_sections = [
            "Data Processing",
            "Data Integrity",
            "Data Storytelling",
            "Dashboard Design",
            "Reporting And Analysis",
            "Marketing Strategy",
            "Presentation Skills",
            "Presentation Design",
        ]
        missing_sections = [section for section in required_rubric_sections if section not in rubric]
        if missing_sections:
            errors.append(f"RUBRIC_ALIGNMENT.md missing rubric sections: {', '.join(missing_sections)}")


def main():
    errors = []
    warnings = []

    print("=" * 60)
    print("Phase 6: Validation")
    print("=" * 60)

    _validate_cleaned(errors, warnings)
    _validate_integrated(errors, warnings)
    _validate_outputs(errors, warnings)
    _validate_source_health(errors, warnings)

    for warning in warnings:
        print(f"WARNING {warning}")
    for error in errors:
        print(f"ERROR {error}")

    if errors:
        print(f"\nFAILED validation with {len(errors)} error(s) and {len(warnings)} warning(s)")
        raise SystemExit(1)

    print(f"\nOK Validation passed with {len(warnings)} warning(s)")


if __name__ == "__main__":
    main()
