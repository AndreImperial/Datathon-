"""Shared public-contract and compiled-artifact checks, independent of private data."""
import json
from pathlib import Path

DENIED_FIELDS = {"_opportunity_id", "opportunity_id", "opp_id", "accountid", "_account_id", "_account_name", "account_name", "_current_stage", "current_stage", "_amount", "email", "contact_email", "contact_name", "phone", "domain", "account_id"}

V2_DATASETS = {'creative_tone', 'cohorts', 'win_probability', 'model_stats', 'journey_sequences', 'monthly_pipeline', 'deal_velocity', 'channel_pipeline', 'segment_industry', 'budget_scenarios', 'email_seniority', 'account_coverage_detail', 'coverage', 'qa_performance', 'feature_importance', 'attribution', 'segment_win_rate', 'quality', 'funnel_metrics', 'attribution_touchpoint_quality', 'model_calibration', 'creative_ctr', 'attribution_sensitivity', 'targeting', 'attribution_coverage'}
V2_CHARTS = {'c-spend-pipeline', 'c-attrib-waterfall', 'c-cohort', 'c-account-coverage', 'c-seg-heatmap', 'c-monthly-trend', 'c-journey', 'c-email-seniority', 'c-feat-imp', 'c-bar-channel', 'c-win-prob', 'c-creative-attr', 'c-creative-ctr', 'c-essential-contribution', 'c-funnel', 'c-targeting-matrix', 'c-sourced-influenced', 'c-attrib-comparison', 'c-essential-coverage', 'c-deal-velocity', 'c-budget-scenario', 'c-seg-winrate', 'c-donut-won', 'c-essential-cohort'}
V2_TABLES = {'essential_action_plan', 'case_deliverable_coverage', 'decision_confidence', 'attribution_models', 'recommended_actions', 'channel_roi_summary'}
V3_DATASETS = {'model_diagnostics', 'journey_outcomes', 'attribution_model_sensitivity', 'email_content', 'population_reconciliation', 'model_score_bands', 'experiment_scenarios', 'channel_trends', 'conversion_decomposition', 'loss_reason_summary', 'channel_scorecard', 'summary', 'audience_priority', 'attribution_year_coverage', 'ad_rankings', 'audience_exclusions', 'content_metadata_coverage', 'web_content', 'source_coverage', 'attribution_overlap', 'creative_bundles'}

def assert_public_fields(value, path="root"):
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in DENIED_FIELDS:
                raise ValueError(f"Private public-artifact field: {path}.{key}")
            assert_public_fields(child, f"{path}.{key}")
    elif isinstance(value, list):
        for child in value:
            assert_public_fields(child, path)

def load_contract(path, version=None):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Contract must be an object")
    if version:
        if data.get("schema_version") != version or not isinstance(data.get("datasets"), dict) or not isinstance(data.get("meta"), dict):
            raise ValueError("Incompatible contract structure/version")
        assert_public_fields(data)
        required = V3_DATASETS if version == 3 else V2_DATASETS
        if not required <= set(data["datasets"]) or not all(isinstance(data["datasets"][name], list) for name in required):
            raise ValueError("Required named datasets missing or malformed")
        statuses = data.get("dataset_status", {})
        if not isinstance(statuses, dict) or any(not isinstance(statuses.get(name), dict) or statuses[name].get("status") not in {"available", "limited", "unavailable"} or not isinstance(statuses[name].get("reason"), str) for name in data["datasets"]):
            raise ValueError("Invalid dataset availability declarations")
        if version == 3:
            if not data["meta"].get("snapshot_id") or not isinstance(data.get("presentation", {}).get("slides"), list):
                raise ValueError("Missing v3 snapshot/presentation")
            slides = data["presentation"]["slides"]
            expected = {f"main-{i:02d}" for i in range(1,17)} | {f"appendix-{i:02d}" for i in range(1,7)}
            if len(slides) != 22 or any(not isinstance(slide, dict) for slide in slides) or {slide.get("id") for slide in slides} != expected or any(not slide.get("title") or not slide.get("speaker_notes") for slide in slides):
                raise ValueError("Missing/incompatible presentation slides")
            if not data["datasets"]["summary"] or not data["datasets"]["population_reconciliation"]:
                raise ValueError("Missing summary/population")
            if not set(data["datasets"]) <= set(data.get("dataset_status", {})):
                raise ValueError("Missing dataset availability declaration")
        elif not isinstance(data.get("chart_data"), dict) or not isinstance(data.get("context", {}).get("metrics"), dict):
            raise ValueError("Missing v2 chart/context structure")
        if version == 2:
            if not V2_CHARTS <= set(data["chart_data"]) or not all(isinstance(data["chart_data"][name], list) for name in V2_CHARTS):
                raise ValueError("Required named chart placements missing")
            metadata = data.get("chart_metadata", [])
            if not isinstance(metadata, list) or len(metadata) != 24 or any(not isinstance(item, dict) for item in metadata) or {item.get("chart_id") for item in metadata} != V2_CHARTS or any(not item.get("source_dataset") or not item.get("fields") for item in metadata):
                raise ValueError("Missing chart bindings")
            if not V2_TABLES <= set(data.get("tables", {})) or data.get("manifest", {}).get("chart_placement_count") != 24:
                raise ValueError("Missing evidence tables/manifest")
            if not data["context"]["metrics"].get("total_opportunities"):
                raise ValueError("Missing population metric")
    elif not isinstance(data.get("metrics"), dict) or not data["metrics"].get("total_opportunities"):
        raise ValueError("Missing context metrics")
    return data

def manifest_assets_exist(public_dir):
    public_dir = Path(public_dir).resolve()
    try:
        manifest = json.loads((public_dir / ".vite/manifest.json").read_text(encoding="utf-8"))
        if not manifest or not any(item.get("isEntry") for item in manifest.values()):
            return False
        for item in manifest.values():
            for ref in item.get("imports", []) + item.get("dynamicImports", []):
                if ref not in manifest:
                    return False
            for name in [item["file"]] + item.get("css", []) + item.get("assets", []):
                candidate = (public_dir / name).resolve()
                if not candidate.is_relative_to(public_dir) or not candidate.is_file():
                    return False
        return True
    except (OSError, ValueError, KeyError, TypeError):
        return False
