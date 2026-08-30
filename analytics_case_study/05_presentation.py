"""Build the 12-slide executive deck from validated integrated datasets.

The visual deck is authored with @oai/artifact-tool so charts and text remain
editable. The Python layer only prepares a compact, traceable JSON payload.

Run: python analytics_case_study/05_presentation.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, PRESENTATION_DIR
from analytics_case_study.utils.metrics import resolved_stage_mask


ROOT = Path(__file__).resolve().parents[1]
BUILDER = Path(__file__).with_name("presentation_builder.mjs")
OUTPUT = Path(PRESENTATION_DIR) / "Marketing_Analytics_Executive_Deck.pptx"


def _load(folder: str, name: str) -> pd.DataFrame:
    path = Path(folder) / f"{name}.parquet"
    return pd.read_parquet(path) if path.exists() else pd.DataFrame()


def _metric(frame: pd.DataFrame, name: str, column: str = "rate", default: float = 0.0) -> float:
    row = frame.loc[frame.get("metric", pd.Series(dtype=str)).eq(name)]
    return float(row.iloc[0][column]) if not row.empty else default


def _records(frame: pd.DataFrame, columns: list[str]) -> list[dict]:
    if frame.empty:
        return []
    clean = frame.loc[:, [c for c in columns if c in frame.columns]].copy()
    return json.loads(clean.to_json(orient="records"))


def build_payload() -> dict:
    opps = _load(CLEANED_DATA_DIR, "opportunities")
    email = _load(CLEANED_DATA_DIR, "email_engagements")
    quality = _load(INTEGRATED_DATA_DIR, "data_quality_summary")
    cohort = _load(INTEGRATED_DATA_DIR, "cohort_analysis")
    attribution = _load(INTEGRATED_DATA_DIR, "attribution_results")
    attr_coverage = _load(INTEGRATED_DATA_DIR, "attribution_coverage")
    coverage = _load(INTEGRATED_DATA_DIR, "account_coverage_summary")
    model_stats = _load(INTEGRATED_DATA_DIR, "model_stats")
    feature_importance = _load(INTEGRATED_DATA_DIR, "feature_importance")
    budget = _load(INTEGRATED_DATA_DIR, "budget_scenarios")
    creative = _load(INTEGRATED_DATA_DIR, "creative_performance")

    stage_col = next(c for c in opps.columns if "current_stage" in c.lower())
    resolved = resolved_stage_mask(opps[stage_col])
    won = opps["iswon"].eq(True)
    total_pipeline = float(opps["_amount"].fillna(0).sum())
    won_revenue = float(opps.loc[won, "_amount"].fillna(0).sum())
    closed_win_rate = float(won.sum() / resolved.sum())

    contribution = attribution[attribution["attribution_model"].isin(["Marketing Sourced", "Marketing Influenced"])].groupby("attribution_model", as_index=False)["attributed_pipeline"].sum()
    journey = attribution[attribution["attribution_model"].isin(["First-Touch", "Last-Touch", "Time-Decay"])].copy()
    journey = journey[journey["channel"].isin(["email_mqa", "6sense_display"])]

    recent_mature = cohort[(cohort["quarter"] >= "2022Q1") & cohort["is_mature"].eq(True)].copy()
    recent_mature = recent_mature.sort_values("quarter").tail(10)

    event_counts = {
        "Open events": int(email.get("is_open", pd.Series(dtype=int)).sum()),
        "Click events": int(email.get("is_click", pd.Series(dtype=int)).sum()),
        "Registration events": int(email.get("is_register", pd.Series(dtype=int)).sum()),
    }
    event_total = int(len(email))
    engaged_people = int(email.get("_email", pd.Series(dtype=str)).nunique())

    platform = creative.groupby("_platform", as_index=False).agg(clicks=("_clicks", "sum"), impressions=("_impressions", "sum"), spend=("_spend", "sum")) if not creative.empty else pd.DataFrame()
    if not platform.empty:
        platform["ctr"] = platform["clicks"] / platform["impressions"].replace(0, pd.NA)
        platform = platform.dropna(subset=["ctr"])

    fi = feature_importance.copy()
    if not fi.empty:
        name_col = "feature" if "feature" in fi.columns else fi.columns[0]
        value_col = "importance" if "importance" in fi.columns else fi.columns[1]
        fi = fi.groupby(name_col, as_index=False)[value_col].sum().nlargest(6, value_col)
        fi.columns = ["feature", "importance"]

    payload = {
        "totals": {
            "pipeline": total_pipeline,
            "won_revenue": won_revenue,
            "opportunities": int(len(opps)),
            "resolved": int(resolved.sum()),
            "active": int((~resolved).sum()),
            "won": int(won.sum()),
            "closed_win_rate": closed_win_rate,
            "zero_amount_won_rate": _metric(quality, "zero_amount_won_opportunities"),
            "unreached_rate": float(coverage.loc[coverage["coverage_tier"].eq("Not Reached"), "pct_of_total"].iloc[0]),
        },
        "quality": _records(quality, ["metric", "value", "denominator", "rate", "severity", "interpretation"]),
        "cohorts": _records(recent_mature, ["quarter", "pipeline", "closed_win_rate", "resolved_share", "resolved", "win_rate_ci_low", "win_rate_ci_high"]),
        "contribution": _records(contribution, ["attribution_model", "attributed_pipeline"]),
        "attribution_coverage": _records(attr_coverage, list(attr_coverage.columns)),
        "journey": _records(journey, ["channel", "attributed_pipeline", "attribution_model"]),
        "coverage": _records(coverage, ["coverage_tier", "accounts", "with_opp", "pct_of_total", "opp_rate", "opp_rate_ci_low", "opp_rate_ci_high"]),
        "email": {"events": event_counts, "event_total": event_total, "engaged_people": engaged_people},
        "creative": _records(platform, ["_platform", "clicks", "impressions", "spend", "ctr"]),
        "model": _records(model_stats, list(model_stats.columns))[0] if not model_stats.empty else {},
        "feature_importance": _records(fi, ["feature", "importance"]),
        "budget": _records(budget, list(budget.columns)),
    }
    return payload


def _runtime() -> tuple[Path, Path]:
    """Resolve the bundled presentation runtime without mutating its install.

    The artifact-tool package is intentionally mounted read-only by Codex.  A
    temporary node_modules junction (created below) gives the user-authored
    builder normal ESM resolution while keeping the repository self-contained.
    """
    node = Path(os.environ.get("RUNTIME_NODE", "")) if os.environ.get("RUNTIME_NODE") else None
    if not node or not node.exists():
        node = Path(os.environ.get("NODE_EXE", "")) if os.environ.get("NODE_EXE") else None
    if not node or not node.exists():
        node = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
    if not node.exists():
        found = shutil.which("node")
        if not found:
            raise RuntimeError("Node.js was not found. Set RUNTIME_NODE or NODE_EXE.")
        node = Path(found)

    modules = Path(os.environ.get("RUNTIME_NODE_MODULES", "")) if os.environ.get("RUNTIME_NODE_MODULES") else None
    if not modules or not modules.exists():
        modules = node.parent.parent / "node_modules"
    if not modules.exists():
        raise RuntimeError("Bundled Node.js packages were not found. Set RUNTIME_NODE_MODULES.")
    return node, modules


def _link_runtime_modules(workspace: Path, runtime_modules: Path) -> None:
    target = workspace / "node_modules"
    try:
        target.symlink_to(runtime_modules, target_is_directory=True)
    except (OSError, NotImplementedError):
        if os.name != "nt":
            raise
        # Junctions work on standard Windows developer machines without
        # requiring Administrator privileges.
        subprocess.run(["cmd", "/c", "mklink", "/J", str(target), str(runtime_modules)], check=True, capture_output=True)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload()
    node, runtime_modules = _runtime()

    with tempfile.TemporaryDirectory(prefix="marketing-deck-") as tmp_name:
        tmp = Path(tmp_name)
        payload_path = tmp / "payload.json"
        render_dir = tmp / "render"
        payload_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        shutil.copy2(BUILDER, tmp / BUILDER.name)
        _link_runtime_modules(tmp, runtime_modules)
        subprocess.run(
            [str(node), str(tmp / BUILDER.name), "--data", str(payload_path), "--output", str(OUTPUT), "--render-dir", str(render_dir)],
            cwd=tmp,
            check=True,
        )
        evidence_dir = OUTPUT.parent / "rendered"
        if evidence_dir.exists():
            shutil.rmtree(evidence_dir)
        shutil.copytree(render_dir, evidence_dir)

    print(f"Saved executive deck: {OUTPUT}")


if __name__ == "__main__":
    main()
