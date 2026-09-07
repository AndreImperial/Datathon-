"""Validate the schema-v3 CMO evidence contract before it is published."""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "frontend" / "public" / "dashboard-data-v3.json"
REQUIRED_DATASETS = {"population_reconciliation", "source_coverage", "channel_scorecard", "channel_trends", "content_metadata_coverage", "ad_rankings", "creative_bundles", "email_content", "web_content", "attribution_overlap", "attribution_model_sensitivity", "attribution_year_coverage", "journey_outcomes", "conversion_decomposition", "loss_reason_summary", "audience_exclusions", "audience_priority", "experiment_scenarios", "model_score_bands", "model_diagnostics"}

def finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        return False
    if isinstance(value, dict): return all(finite(v) for v in value.values())
    if isinstance(value, list): return all(finite(v) for v in value)
    return True

def main() -> int:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    assert data["schema_version"] == 3, "Expected schema version 3"
    assert data["meta"].get("snapshot_id"), "Missing deterministic snapshot ID"
    assert REQUIRED_DATASETS <= set(data["datasets"]), f"Missing datasets: {REQUIRED_DATASETS - set(data['datasets'])}"
    assert set(data["datasets"]) <= set(data["dataset_status"]), "Every dataset needs a status record"
    assert finite(data), "No NaN or infinity may enter the browser contract"
    slides = data["presentation"]["slides"]
    main_slides = [s for s in slides if s["sequence"] == "main"]
    appendix = [s for s in slides if s["sequence"] == "appendix"]
    assert len(main_slides) == 16 and len(appendix) == 6, "Deck must have exactly 16 main and 6 appendix slides"
    assert sum(s["target_duration_seconds"] for s in main_slides) == 1080, "Main deck must be 18 minutes"
    ids = [item["id"] for item in slides] + [item["id"] for item in data["findings"]] + [item["id"] for item in data["recommendations"]]
    assert len(ids) == len(set(ids)), "Contract IDs must be unique across slides, findings, recommendations"
    finding_ids = {item["id"] for item in data["findings"]}
    for slide in slides:
        assert set(slide["finding_ids"]) <= finding_ids, f"Unresolved finding on {slide['id']}"
        assert set(slide["chart_refs"]) <= (set(data["datasets"]) | {"recommendations"}), f"Unresolved chart on {slide['id']}"
        assert "speaker_notes" in slide and slide["speaker_notes"].get("do_not_claim"), f"Missing notes on {slide['id']}"
    overlap = data["datasets"]["attribution_overlap"]
    population = data["datasets"]["population_reconciliation"][-1]["opportunities"]
    if overlap:
        assert sum(int(row["opportunities"]) for row in overlap) == population, "Attribution overlap must partition population"
    serialized = json.dumps(data).lower()
    assert "80/10/10" not in serialized, "Retired fixed budget allocation present"
    print(f"PASS v3 contract | snapshot {data['meta']['snapshot_id']} | 16 main + 6 appendix slides | {len(data['datasets'])} datasets")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
