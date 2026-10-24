"""Validate the schema-v3 CMO evidence contract before it is published."""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import importlib.util

import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from artifact_safety import load_contract, manifest_assets_exist

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "frontend" / "public" / "dashboard-data-v3.json"
REQUIRED_DATASETS = {"population_reconciliation", "source_coverage", "channel_scorecard", "channel_trends", "content_metadata_coverage", "ad_rankings", "creative_bundles", "email_content", "web_content", "attribution_overlap", "attribution_model_sensitivity", "attribution_year_coverage", "journey_outcomes", "conversion_decomposition", "loss_reason_summary", "audience_exclusions", "audience_priority", "experiment_scenarios", "pilot_design", "mrr_amount_relationship", "source_group_scorecard"}
APPENDIX_TITLES = {
    "appendix-01": "Population and source coverage",
    "appendix-02": "Metric definitions and unavailable denominators",
    "appendix-03": "Attribution models, windows, and shared-domain sensitivity",
    "appendix-04": "Conversion decomposition and loss reasons",
    "appendix-05": "Targeting eligibility and sample uncertainty",
    "appendix-06": "Recorded value: amount and MRR",
}
APPENDIX_SIGNALS = {
    "appendix-01": [("canonical", "non-deleted"), ("crm history", "2018"), ("marketing logs", "2024"), ("domain",), ("timestamp",)],
    "appendix-02": [("won",), ("resolved",), ("sent",), ("delivered",), ("denominator",), ("recorded pipeline", "source-recorded amount")],
    "appendix-03": [("first touch",), ("last touch",), ("linear",), ("time decay",), ("30/90/180/365", "30, 90, 180, and 365"), ("shared-domain", "shared domain", "normalized domain")],
    "appendix-04": [("2022 h1",), ("2024 h1",), ("mix",), ("within",), ("loss reason",), ("mapping", "unavailable")],
    "appendix-05": [("customer",), ("active opportunity",), ("icp",), ("50/50", "equal allocation"), ("power",), ("feasib", "uncertainty")],
    "appendix-06": [("zero-amount", "zero or blank"), ("mrr",), ("open pipeline",), ("closed-lost",), ("withdrawn",)],
}
GENERIC_APPENDIX_TEXT = {
    "supporting methodology, definitions, and limitations for judge questions.",
    "validated source extracts",
    "this slide supports interpretation; it does not change the main decision.",
    "use this only when a judge asks for methodological detail.",
    "make the evidence auditable.",
    "how was this calculated?",
    "the visible definitions and source references document the method.",
}

def finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        return False
    if isinstance(value, dict): return all(finite(v) for v in value.values())
    if isinstance(value, list): return all(finite(v) for v in value)
    return True


def metric_ref_resolves(data: dict, ref: str) -> bool:
    if ref in data["metric_definitions"]:
        return True
    dataset_name, separator, field = ref.partition(".")
    rows = data["datasets"].get(dataset_name)
    return bool(separator and isinstance(rows, list) and any(isinstance(row, dict) and field in row for row in rows))


def validate_appendix(appendix: list[dict]) -> None:
    expected_ids = list(APPENDIX_TITLES)
    assert [slide["id"] for slide in appendix] == expected_ids, "Appendix IDs must be appendix-01 through appendix-06 in order"
    assert [slide["order"] for slide in appendix] == list(range(1, 7)), "Appendix order fields must be 1 through 6"
    for slide in appendix:
        slide_id = slide["id"]
        for field in ("body", "visible_caveat", "source_footer"):
            value = str(slide.get(field, "")).strip()
            assert value, f"Appendix {slide_id} has an empty {field}"
            assert value.lower() not in GENERIC_APPENDIX_TEXT, f"Appendix {slide_id} {field} is generic"
        assert len(slide["body"].split()) >= 18, f"Appendix {slide_id} body is not substantive"
        assert ".parquet" in slide["source_footer"].lower(), f"Appendix {slide_id} needs a specific source footer"
        assert slide["finding_ids"] or slide["chart_refs"] or slide["metric_refs"], f"Appendix {slide_id} needs evidence references"
        notes = slide.get("speaker_notes", {})
        for field in ("say", "why", "do_not_claim", "transition", "judge_question", "answer"):
            value = str(notes.get(field, "")).strip()
            assert value, f"Appendix {slide_id} is missing speaker_notes.{field}"
            assert value.lower() not in GENERIC_APPENDIX_TEXT, f"Appendix {slide_id} speaker_notes.{field} is generic"
        assert len(notes["say"].split()) >= 12, f"Appendix {slide_id} needs a useful talk track"
        assert len(notes["answer"].split()) >= 10, f"Appendix {slide_id} needs a useful judge answer"
        assert "?" in notes["judge_question"], f"Appendix {slide_id} judge question must be phrased as a question"
        assert notes.get("sources"), f"Appendix {slide_id} speaker notes need evidence sources"
        searchable = json.dumps(slide, ensure_ascii=False).lower()
        for alternatives in APPENDIX_SIGNALS[slide_id]:
            assert any(signal in searchable for signal in alternatives), f"Appendix {slide_id} is missing subject signal: {' / '.join(alternatives)}"
        assert slide["title"] == APPENDIX_TITLES[slide_id], f"Appendix {slide_id} has the wrong subject title"

def per_arm_requirement(baseline: float, lift: float) -> float:
    spec = importlib.util.spec_from_file_location("case_analysis", Path(__file__).with_name("03d_case_analysis.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.per_arm_requirement(baseline, lift)


def validate_evidence_datasets(datasets: dict, summary: dict) -> None:
    pilot = datasets["pilot_design"]
    assert pilot, "Pilot design must have rows"
    for row in pilot:
        assert row["arm_size"] * 2 <= summary["eligible_domains"], "Pilot arms exceed the eligible audience"
        assert row["detectable_lift"] > 0, "Pilot detectable lift must be positive"
        required = per_arm_requirement(row["baseline_rate"], row["detectable_lift"])
        assert abs(required - row["arm_size"]) <= 1, f"Pilot lift does not reproduce arm size at baseline {row['baseline_rate']}"
    five = [row for row in pilot if math.isclose(row["baseline_rate"], 0.05)]
    assert five and summary["pilot_detectable_lift_pp_at_5pct"] == five[0]["detectable_lift_pp"], "Pilot summary must match the 5% baseline row"
    assert summary["pilot_treatment_accounts"] == summary["pilot_arm_size"] == five[0]["arm_size"], "Pilot summary arm sizes disagree"
    mrr = datasets["mrr_amount_relationship"]
    assert math.isclose(sum(row["share"] for row in mrr), 1.0, abs_tol=1e-9), "MRR relationship shares must sum to 1"
    assert sum(row["wins"] for row in mrr) == summary["mrr_both_positive_wins"], "MRR relationship wins must reconcile"


def main() -> int:
    data = load_contract(CONTRACT, 3)
    assert data["schema_version"] == 3, "Expected schema version 3"
    assert data["meta"].get("snapshot_id"), "Missing deterministic snapshot ID"
    assert REQUIRED_DATASETS <= set(data["datasets"]), f"Missing datasets: {REQUIRED_DATASETS - set(data['datasets'])}"
    assert set(data["datasets"]) <= set(data["dataset_status"]), "Every dataset needs a status record"
    assert finite(data), "No NaN or infinity may enter the browser contract"
    slides = data["presentation"]["slides"]
    main_slides = [s for s in slides if s["sequence"] == "main"]
    appendix = [s for s in slides if s["sequence"] == "appendix"]
    assert len(main_slides) == 16 and len(appendix) == 6, "Deck must have exactly 16 main and 6 appendix slides"
    validate_appendix(appendix)
    assert sum(s["target_duration_seconds"] for s in main_slides) == 1080, "Main deck must be 18 minutes"
    ids = [item["id"] for item in slides] + [item["id"] for item in data["findings"]] + [item["id"] for item in data["recommendations"]]
    assert len(ids) == len(set(ids)), "Contract IDs must be unique across slides, findings, recommendations"
    finding_ids = {item["id"] for item in data["findings"]}
    for slide in slides:
        assert set(slide["finding_ids"]) <= finding_ids, f"Unresolved finding on {slide['id']}"
        assert set(slide["chart_refs"]) <= (set(data["datasets"]) | {"recommendations"}), f"Unresolved chart on {slide['id']}"
        assert all(metric_ref_resolves(data, ref) for ref in slide["metric_refs"]), f"Unresolved metric on {slide['id']}"
        assert "speaker_notes" in slide and slide["speaker_notes"].get("do_not_claim"), f"Missing notes on {slide['id']}"
    overlap = data["datasets"]["attribution_overlap"]
    population = data["datasets"]["population_reconciliation"][-1]["opportunities"]
    if overlap:
        assert sum(int(row["opportunities"]) for row in overlap) == population, "Attribution overlap must partition population"
    summary = data["datasets"]["summary"][0]
    assert summary["opportunities"] == population
    scorecard = [row for row in data["datasets"]["channel_scorecard"] if row["scope"] == "All history" and row["business_motion"] == "All"]
    assert sum(row["opportunities"] for row in scorecard) == population, "Channel scorecard must reconcile canonical population"
    assert math.isclose(sum(row["recorded_pipeline"] for row in scorecard), summary["recorded_pipeline"], abs_tol=.01)
    assert sum(row["won_opportunities"] for row in overlap) == summary["won"]
    assert sum(row["opportunities"] for row in overlap if row["overlap_group"] in {"Both", "Linked only"}) == summary["linked_365"]
    for row in data["datasets"]["conversion_decomposition"]:
        if not row["period_a_resolved"] or not row["period_b_resolved"]:
            assert row["mix_effect_pp"] is None and row["within_effect_pp"] is None, "Absent-period effects must not invent a rate"
        total = sum(row.get(key) or 0 for key in ["mix_effect_pp", "within_effect_pp", "entry_exit_effect_pp"])
        assert math.isclose(total, row["total_effect_pp"], abs_tol=1e-8)
    assert not {"model_diagnostics", "model_score_bands"} & set(data["datasets"]), "Withdrawn win-probability model must not be published"
    groups = [row for row in data["datasets"]["source_group_scorecard"] if row["scope"] == "All history"]
    all_motion = [row for row in data["datasets"]["channel_scorecard"] if row["scope"] == "All history" and row["business_motion"] == "Acquisition"]
    assert sum(row["opportunities"] for row in groups) == sum(row["opportunities"] for row in all_motion), "Source groups must reconcile the acquisition population"
    validate_evidence_datasets(data["datasets"], summary)
    assert summary["zero_amount_wins"] <= summary["won"], "Zero-amount wins cannot exceed wins"
    assert str(summary["eligible_domains"]) in json.dumps(data["presentation"]) or f"{summary['eligible_domains']:,}" in json.dumps(data["presentation"], ensure_ascii=False), "Deck must quote the computed eligible audience"
    legacy_path = CONTRACT.with_name("dashboard-data.json")
    if legacy_path.exists():
        legacy = load_contract(legacy_path, 2)
        count = int(re.sub(r"[^0-9]", "", str(legacy["context"]["metrics"]["total_opportunities"])))
        assert count == population, "Dashboard and browser brief opportunity counts differ"
        assert math.isclose(sum(row["total_pipeline"] for row in legacy["datasets"]["channel_pipeline"]), summary["recorded_pipeline"], abs_tol=.01), "Dashboard pipeline differs"
    deployed = ROOT / "public" / "dashboard-data-v3.json"
    if deployed.exists():
        assert deployed.read_bytes() == CONTRACT.read_bytes(), "Compiled deployment contains a stale v3 contract"
    assert manifest_assets_exist(ROOT / "public"), "Compiled imported/lazy assets missing or manifest invalid"
    load_contract(ROOT / "public" / "dashboard-data.json", 2)
    load_contract(ROOT / "public" / "dashboard_context.json")
    serialized = json.dumps(data).lower()
    assert "80/10/10" not in serialized, "Retired fixed budget allocation present"
    print(f"PASS v3 contract | snapshot {data['meta']['snapshot_id']} | 16 main + 6 appendix slides | {len(data['datasets'])} datasets")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
