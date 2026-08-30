"""Validate metric semantics, cross-artifact consistency, and share readiness."""
from __future__ import annotations

import ast
import hashlib
from html import unescape
import json
import os
from pathlib import Path
import re
import sys
import zipfile

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, OUTPUTS_DIR
from analytics_case_study.utils.metrics import resolved_stage_mask


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_HTML = ROOT / "public/index.html"
PUBLIC_CONTEXT = ROOT / "public/dashboard_context.json"
PUBLIC_DASHBOARD_DATA = ROOT / "public/dashboard-data.json"
PUBLIC_LEGACY_HTML = ROOT / "public/full-analysis/index.html"
DASHBOARD_HTML = Path(OUTPUTS_DIR) / "dashboard/Marketing_Analytics_Dashboard.html"
DASHBOARD_CONTEXT = Path(OUTPUTS_DIR) / "dashboard/dashboard_context.json"
PRESENTATION_DECK = Path(OUTPUTS_DIR) / "presentation/Marketing_Analytics_Executive_Deck.pptx"

REQUIRED_CLEANED = {
    "opportunities": ["_opportunity_id", "_amount", "_current_stage", "channel_category", "iswon"],
    "accounts": ["accountid", "domain__c"],
    "email_engagements": ["_domain", "is_open", "is_click", "is_register"],
    "web_engagements": ["has_domain"],
    "6sense_campaign": ["_6sensedomain"],
    "ad_metrics": ["_spend", "_clicks", "_impressions"],
}

REQUIRED_INTEGRATED = {
    "master_account": ["domain__c"],
    "channel_pipeline": ["channel_category", "deal_count", "resolved_count", "won_count", "win_rate", "resolved_share"],
    "funnel_metrics": ["channel", "stage", "count", "event_share", "metric_type"],
    "creative_performance": ["ctr"],
    "attribution_results": ["channel", "attribution_model", "attributed_pipeline"],
    "attribution_coverage": ["linked_opportunities", "linked_share_of_all_opportunities", "linked_won_opportunities", "linked_share_of_won_opportunities"],
    "attribution_touchpoint_quality": ["channel", "is_marketing_touch", "raw_rows"],
    "win_probability": ["_opportunity_id", "win_probability"],
    "model_stats": ["auc", "precision", "recall", "brier_score", "active_scored_rows", "validation", "feature_policy"],
    "account_coverage": ["domain", "coverage_tier"],
    "account_coverage_summary": ["coverage_tier", "accounts", "opp_rate", "opp_rate_ci_low", "opp_rate_ci_high"],
    "cohort_analysis": ["quarter", "resolved", "closed_win_rate", "win_rate", "resolved_share", "is_mature"],
    "targeting_matrix": ["resolved_deals", "adjusted_win_rate", "win_rate_ci_low", "win_rate_ci_high", "evidence_tier"],
    "budget_scenarios": ["Scenario", "Channel", "Active Spend ($)", "Holdout Reserve ($)", "Experiment Pool ($)", "Total Budget ($)"],
    "data_quality_summary": ["metric", "value", "denominator", "rate", "severity", "interpretation"],
}


def _hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read(folder: str | Path, name: str, columns: list[str], errors: list[str], warnings: list[str]) -> pd.DataFrame:
    path = Path(folder) / f"{name}.parquet"
    if not path.exists():
        errors.append(f"Missing {path}")
        return pd.DataFrame()
    frame = pd.read_parquet(path)
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        errors.append(f"{name}.parquet missing columns: {', '.join(missing)}")
    if frame.empty:
        warnings.append(f"{name}.parquet is empty")
    return frame


def _metric(quality: pd.DataFrame, name: str) -> pd.Series:
    rows = quality[quality["metric"].eq(name)]
    return rows.iloc[0] if not rows.empty else pd.Series(dtype=object)


def _validate_data(errors: list[str], warnings: list[str]) -> None:
    cleaned = {name: _read(CLEANED_DATA_DIR, name, cols, errors, warnings) for name, cols in REQUIRED_CLEANED.items()}
    integrated = {name: _read(INTEGRATED_DATA_DIR, name, cols, errors, warnings) for name, cols in REQUIRED_INTEGRATED.items()}
    opps = cleaned["opportunities"]
    if opps.empty:
        return

    if opps["_opportunity_id"].duplicated().any():
        errors.append("opportunities contains duplicate opportunity ids after latest-snapshot deduplication")
    if not opps["iswon"].dropna().isin([True, False]).all():
        errors.append("opportunities.iswon contains non-boolean values")

    resolved = resolved_stage_mask(opps["_current_stage"])
    won = opps["iswon"].eq(True)
    active = ~resolved
    zero = opps["_amount"].fillna(0).eq(0)

    channel = integrated["channel_pipeline"]
    if not channel.empty:
        if int(channel["deal_count"].sum()) != len(opps):
            errors.append("channel_pipeline deal counts do not reconcile to deduplicated opportunities")
        expected = channel["won_count"] / channel["resolved_count"].replace(0, np.nan)
        if not np.allclose(channel["win_rate"].fillna(-1), expected.fillna(-1), rtol=0, atol=5e-5):
            errors.append("channel_pipeline win_rate is not won / resolved")

    scores = integrated["win_probability"]
    if not scores.empty:
        active_ids = set(opps.loc[active, "_opportunity_id"].astype(str))
        score_ids = set(scores["_opportunity_id"].astype(str))
        if len(scores) != int(active.sum()) or score_ids != active_ids:
            errors.append("win_probability must score every active opportunity and no resolved opportunity")
        if not scores["win_probability"].between(0, 1).all():
            errors.append("win_probability contains values outside [0, 1]")
    stats = integrated["model_stats"]
    if not stats.empty:
        row = stats.iloc[0]
        if int(row["active_scored_rows"]) != int(active.sum()):
            errors.append("model_stats active_scored_rows does not match active opportunities")
        if "time-based" not in str(row["validation"]).lower() or "present-day" not in str(row["feature_policy"]).lower():
            errors.append("model diagnostics do not document time-based validation and present-day feature exclusion")

    cohort = integrated["cohort_analysis"]
    if not cohort.empty:
        if not np.allclose(cohort["win_rate"], cohort["closed_win_rate"], equal_nan=True):
            errors.append("cohort canonical win_rate must equal closed_win_rate")
        expected_mature = cohort["resolved_share"].ge(0.80)
        if not cohort["is_mature"].eq(expected_mature).all():
            errors.append("cohort is_mature must be resolved_share >= 80%")

    funnel = integrated["funnel_metrics"]
    email_mix = funnel[funnel["channel"].eq("Email Event Mix")]
    if email_mix.empty:
        errors.append("funnel_metrics is missing the explicitly scoped Email Event Mix")
    elif not email_mix["metric_type"].eq("event_composition").all() or email_mix["event_share"].isna().any():
        errors.append("Email Event Mix must use event_composition and explicit event shares")
    if funnel["stage"].astype(str).str.contains("open rate|click rate", case=False, regex=True).any():
        errors.append("funnel_metrics contains unsupported send-based email rates")

    touch_quality = integrated["attribution_touchpoint_quality"]
    web_unclassified = touch_quality[touch_quality["channel"].eq("web_unclassified")]
    if web_unclassified.empty or web_unclassified["is_marketing_touch"].astype(bool).any():
        errors.append("blank-UTM web rows must be recorded as non-marketing web_unclassified")

    coverage = integrated["attribution_coverage"]
    if not coverage.empty:
        row = coverage.iloc[0]
        if not np.isclose(row["linked_share_of_all_opportunities"], row["linked_opportunities"] / len(opps)):
            errors.append("attribution linked-opportunity share does not reconcile")
        if not np.isclose(row["linked_share_of_won_opportunities"], row["linked_won_opportunities"] / won.sum()):
            errors.append("attribution linked-won share does not reconcile")

    budget = integrated["budget_scenarios"]
    if not budget.empty:
        components = budget[["Active Spend ($)", "Holdout Reserve ($)", "Experiment Pool ($)"]].sum(axis=1)
        if not np.allclose(components, budget["Total Budget ($)"]):
            errors.append("budget scenario components do not sum to total budget")
        scenario_totals = budget.groupby("Scenario")["Total Budget ($)"].sum()
        if not np.allclose(scenario_totals, scenario_totals.iloc[0]):
            errors.append("budget scenarios are not budget neutral")

    quality = integrated["data_quality_summary"]
    q_zero = _metric(quality, "zero_amount_won_opportunities")
    expected_zero = int((zero & won).sum())
    if q_zero.empty or int(q_zero["value"]) != expected_zero or int(q_zero["denominator"]) != int(won.sum()):
        errors.append("data-quality zero-amount-won metric does not reconcile")


def _validate_dashboard(errors: list[str]) -> None:
    dashboard_paths = [DASHBOARD_HTML, DASHBOARD_CONTEXT, PUBLIC_HTML, PUBLIC_CONTEXT, PUBLIC_DASHBOARD_DATA, PUBLIC_LEGACY_HTML]
    missing_paths = [path for path in dashboard_paths if not path.exists()]
    for path in dashboard_paths:
        if not path.exists():
            errors.append(f"Missing {path}")
    if missing_paths:
        return
    if _hash(DASHBOARD_HTML) != _hash(PUBLIC_LEGACY_HTML):
        errors.append("public/full-analysis/index.html is not synchronized with the generated legacy dashboard")
    if _hash(DASHBOARD_CONTEXT) != _hash(PUBLIC_CONTEXT):
        errors.append("public/dashboard_context.json is not synchronized with the generated context")
    html = PUBLIC_HTML.read_text(encoding="utf-8")
    # Vite keeps the application copy in hashed JavaScript chunks; validate
    # the rendered contract across the entry HTML and those local bundles.
    bundles = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in (PUBLIC_HTML.parent / "assets").glob("*.js"))
    data_text = PUBLIC_DASHBOARD_DATA.read_text(encoding="utf-8", errors="ignore")
    rendered_artifact = html + "\n" + bundles + "\n" + data_text
    required = [
        "Decision dashboard", "Essential View", "Attribution", "Channel ROI",
        "Recommendation", "Analyst Appendix", "dashboard-data.json", "full-analysis",
        "Email Event Mix", "Budget-Neutral Measurement Plans", "time-based 80/20 holdout",
    ]
    missing = [fragment for fragment in required if fragment not in rendered_artifact]
    if missing:
        errors.append("dashboard missing audit-critical labels: " + ", ".join(missing))
    forbidden = ["$176M", "545 open deals", "Every won deal", "ROI-Optimized", "Growth Mode", "projected pipeline"]
    present = [fragment for fragment in forbidden if fragment.lower() in rendered_artifact.lower()]
    if present:
        errors.append("dashboard contains stale claims: " + ", ".join(present))
    external_tags = re.findall(r"<(?:script|link)\b[^>]+(?:src|href)=[\"']https?://[^\"']+[\"']", html, flags=re.IGNORECASE)
    if external_tags:
        errors.append("dashboard is not self-contained; external script or stylesheet tags were found")
    if "plotly.js v" in html:
        errors.append("Plotly is still present in the default React dashboard bundle")

    context = json.loads(PUBLIC_CONTEXT.read_text(encoding="utf-8"))
    dashboard_data = json.loads(PUBLIC_DASHBOARD_DATA.read_text(encoding="utf-8"))
    if dashboard_data.get("context") != context:
        errors.append("dashboard-data.json context is not synchronized with dashboard_context.json")
    if dashboard_data.get("schema_version") != 2:
        errors.append("dashboard-data.json must use schema_version 2")
    datasets = dashboard_data.get("datasets", {})
    expected_datasets = {
        "channel_pipeline", "cohorts", "coverage", "attribution", "attribution_coverage", "quality",
        "feature_importance", "model_stats", "budget_scenarios", "targeting", "monthly_pipeline",
        "funnel_metrics", "segment_industry", "segment_win_rate", "creative_ctr", "creative_tone",
        "email_seniority", "deal_velocity", "journey_sequences", "win_probability", "account_coverage_detail",
        "attribution_touchpoint_quality", "qa_performance",
    }
    missing_datasets = sorted(name for name in expected_datasets if not isinstance(datasets.get(name), list))
    if missing_datasets:
        errors.append("dashboard-data.json is missing datasets: " + ", ".join(missing_datasets))
    empty_datasets = sorted(name for name in expected_datasets if isinstance(datasets.get(name), list) and not datasets[name])
    if empty_datasets:
        errors.append("dashboard-data.json contains empty required datasets: " + ", ".join(empty_datasets))

    manifest = dashboard_data.get("manifest", {})
    expected_sections = ["s-essential", "s-exec", "s-attrib", "s-channel", "s-segment", "s-creative", "s-budget", "s-advanced", "s-appendix", "s-conclusion"]
    expected_nav = ["Essential View", "Attribution", "Channel ROI", "Recommendation", "Analyst Appendix"]
    expected_charts = [
        "c-essential-contribution", "c-essential-coverage", "c-essential-cohort", "c-bar-channel", "c-donut-won",
        "c-monthly-trend", "c-attrib-comparison", "c-sourced-influenced", "c-attrib-waterfall", "c-spend-pipeline",
        "c-funnel", "c-seg-heatmap", "c-seg-winrate", "c-creative-ctr", "c-creative-attr", "c-email-seniority",
        "c-budget-scenario", "c-feat-imp", "c-win-prob", "c-account-coverage", "c-deal-velocity", "c-journey",
        "c-targeting-matrix", "c-cohort",
    ]
    expected_tables = ["essential_action_plan", "attribution_models", "channel_roi_summary", "decision_confidence", "recommended_actions", "case_deliverable_coverage"]
    if manifest.get("section_sequence") != expected_sections or manifest.get("section_ids") != expected_sections:
        errors.append("dashboard preservation manifest section sequence does not match the legacy dashboard")
    if manifest.get("primary_navigation") != expected_nav:
        errors.append("dashboard preservation manifest primary navigation is incomplete")
    if manifest.get("chart_placements") != expected_charts or manifest.get("chart_placement_count") != 24 or manifest.get("distinct_chart_count") != 21:
        errors.append("dashboard preservation manifest chart placement counts do not match 24 placements / 21 definitions")
    if manifest.get("table_ids") != expected_tables or manifest.get("table_count") != 6:
        errors.append("dashboard preservation manifest table contract does not contain the six visible evidence tables")
    if not all(phrase in manifest.get("required_audit_phrases", []) for phrase in ["Email Event Mix", "Budget-Neutral Measurement Plans", "time-based 80/20 holdout"]):
        errors.append("dashboard preservation manifest is missing required audit phrases")

    metadata = dashboard_data.get("chart_metadata", [])
    metadata_ids = [item.get("chart_id") for item in metadata if isinstance(item, dict)]
    if metadata_ids != expected_charts:
        errors.append("chart_metadata IDs do not match the 24-placement preservation contract")
    for item in metadata:
        if not isinstance(item, dict):
            errors.append("chart_metadata contains a non-object entry")
            continue
        if not item.get("fields") or item.get("source_dataset") not in datasets:
            errors.append(f"chart metadata is missing fields or source dataset: {item.get('chart_id')}")
    tables = dashboard_data.get("tables", {})
    for table_id in expected_tables:
        contract = tables.get(table_id)
        if not isinstance(contract, dict) or not contract.get("columns") or not isinstance(contract.get("rows"), list):
            errors.append(f"table contract is incomplete: {table_id}")
    metrics = context.get("metrics", {})
    quality = pd.read_parquet(Path(INTEGRATED_DATA_DIR) / "data_quality_summary.parquet")
    attr = pd.read_parquet(Path(INTEGRATED_DATA_DIR) / "attribution_coverage.parquet").iloc[0]
    model = pd.read_parquet(Path(INTEGRATED_DATA_DIR) / "model_stats.parquet").iloc[0]
    q_zero = _metric(quality, "zero_amount_won_opportunities")
    expected = {
        "zero_amount_won_share": f"{q_zero['rate']:.1%}",
        "attribution_linked_won_share": f"{attr['linked_share_of_won_opportunities']:.1%}",
        "active_scored_opportunities": f"{int(model['active_scored_rows']):,}",
    }
    mismatches = [f"{key}: expected {value}, got {metrics.get(key)}" for key, value in expected.items() if metrics.get(key) != value]
    if mismatches:
        errors.append("dashboard context does not reconcile: " + "; ".join(mismatches))


def _validate_presentation(errors: list[str]) -> None:
    if not PRESENTATION_DECK.exists():
        errors.append(f"Missing {PRESENTATION_DECK}")
        return
    if PRESENTATION_DECK.stat().st_size < 40_000:
        errors.append("presentation deck is unexpectedly small")
    with zipfile.ZipFile(PRESENTATION_DECK) as archive:
        slides = sorted(name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
        notes = sorted(name for name in archive.namelist() if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name))
        if len(slides) != 12:
            errors.append(f"executive deck must contain 12 slides, found {len(slides)}")
        if len(notes) != len(slides):
            errors.append(f"every slide needs source notes; found {len(notes)} notes for {len(slides)} slides")
        for name in notes:
            raw = archive.read(name).decode("utf-8", errors="ignore")
            note_text = unescape(re.sub(r"<[^>]+>", " ", raw))
            if "[Sources]" not in note_text or "[Methodology]" not in note_text:
                errors.append(f"{name} is missing [Sources] or [Methodology]")


def _validate_outputs_and_source(errors: list[str], warnings: list[str]) -> None:
    analysis_dir = Path(OUTPUTS_DIR) / "analysis"
    workbooks = [
        "channel_roi.xlsx", "segment_conversion.xlsx", "creative_performance.xlsx",
        "email_campaign_performance.xlsx", "attribution_models.xlsx", "advanced_analytics.xlsx",
        "budget_recommendation.xlsx", "data_quality_report.xlsx",
    ]
    for filename in workbooks:
        if not (analysis_dir / filename).exists():
            errors.append(f"Missing analysis workbook: {filename}")

    dashboard_source = ROOT / "analytics_case_study/04_html_dashboard.py"
    react_dashboard_source = ROOT / "analytics_case_study/04_react_dashboard.py"
    runner = ROOT / "run_pipeline.py"
    for path in [dashboard_source, react_dashboard_source, runner, ROOT / "ANALYSIS_METHODOLOGY.md", ROOT / "RUBRIC_ALIGNMENT.md"]:
        if not path.exists():
            errors.append(f"Missing source artifact: {path}")
    if dashboard_source.exists():
        tree = ast.parse(dashboard_source.read_text(encoding="utf-8"), filename=str(dashboard_source))
        definitions: dict[str, list[int]] = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                definitions.setdefault(node.name, []).append(node.lineno)
        duplicate = {name: lines for name, lines in definitions.items() if len(lines) > 1}
        if duplicate:
            errors.append(f"dashboard source has duplicate function definitions: {duplicate}")

    if runner.exists():
        source = runner.read_text(encoding="utf-8")
        steps = ["01_data_cleaning.py", "02_data_integration.py", "03_analysis.py", "03b_attribution.py", "03c_advanced_analytics.py", "04_html_dashboard.py", "04_react_dashboard.py", "05_presentation.py", "06_validate_metrics.py"]
        missing = [step for step in steps if step not in source]
        if missing:
            errors.append("pipeline runner missing steps: " + ", ".join(missing))

    doc_paths = [ROOT / name for name in ["README.md", "ANALYSIS_METHODOLOGY.md", "ANALYTICS_EXPLAINED.md", "SLIDE_BY_SLIDE_EXPLAINED.md", "RUBRIC_ALIGNMENT.md"]]
    stale = ["545 open", "$176M", "94.7% open rate", "ROI-optimized", "AUC 0.796", "AUC 0.811", "22-slide", "21-slide"]
    for path in doc_paths:
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8", errors="ignore").lower()
        hits = [phrase for phrase in stale if phrase.lower() in content]
        if hits:
            errors.append(f"{path.name} contains stale claims: {', '.join(hits)}")


def main() -> None:
    errors: list[str] = []
    warnings: list[str] = []
    print("=" * 66)
    print("Phase 6: Metric, artifact, and share-readiness validation")
    print("=" * 66)
    _validate_data(errors, warnings)
    _validate_dashboard(errors)
    _validate_presentation(errors)
    _validate_outputs_and_source(errors, warnings)
    for warning in warnings:
        print(f"WARNING {warning}")
    for error in errors:
        print(f"ERROR {error}")
    if errors:
        print(f"\nFAILED with {len(errors)} error(s) and {len(warnings)} warning(s)")
        raise SystemExit(1)
    print(f"\nOK Validation passed with {len(warnings)} warning(s)")


if __name__ == "__main__":
    main()
