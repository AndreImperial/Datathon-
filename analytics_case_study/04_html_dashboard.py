"""
Phase 4 (revised): Self-Contained Interactive HTML Dashboard
Generates a single .html file - no server required, open in any browser.
Output: outputs/dashboard/Marketing_Analytics_Dashboard.html
"""
import os
import sys
import json
import shutil
from datetime import datetime
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import plotly.io as pio
from plotly.offline import get_plotlyjs
from plotly.subplots import make_subplots

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, BRAND_COLORS, CHANNEL_COLOR_MAP
)
from analytics_case_study.utils.metrics import resolved_stage_mask, wilson_interval

OUTPUT_HTML = os.path.join(
    os.path.dirname(__file__), "..", "outputs", "dashboard", "Marketing_Analytics_Dashboard.html"
)
PUBLIC_HTML = os.path.join(os.path.dirname(__file__), "..", "public", "index.html")
OUTPUT_CONTEXT = os.path.join(os.path.dirname(__file__), "..", "outputs", "dashboard", "dashboard_context.json")
PUBLIC_CONTEXT = os.path.join(os.path.dirname(__file__), "..", "public", "dashboard_context.json")

# -----------------------------------------------------------------------------
# Data loaders
# -----------------------------------------------------------------------------
def _load_int(name):
    p = os.path.join(INTEGRATED_DATA_DIR, f"{name}.parquet")
    return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()

def _load_clean(name):
    p = os.path.join(CLEANED_DATA_DIR, f"{name}.parquet")
    return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()

channel_pipeline  = _load_int("channel_pipeline")
funnel_metrics    = _load_int("funnel_metrics")
creative_perf     = _load_int("creative_performance")
master_account    = _load_int("master_account")
attribution       = _load_int("attribution_results")
win_prob          = _load_int("win_probability")
account_coverage  = _load_int("account_coverage")
deal_velocity     = _load_int("deal_velocity")
journey_seq       = _load_int("journey_sequences")
qa_perf           = _load_int("qa_performance")
targeting_matrix  = _load_int("targeting_matrix")
cohort            = _load_int("cohort_analysis")
feat_imp          = _load_int("feature_importance")
model_stats       = _load_int("model_stats")
data_quality      = _load_int("data_quality_summary")
attribution_scope = _load_int("attribution_coverage")
coverage_summary  = _load_int("account_coverage_summary")
budget_scenarios  = _load_int("budget_scenarios")
opps              = _load_clean("opportunities")
accounts          = _load_clean("accounts")
email             = _load_clean("email_engagements")
ad_metrics        = _load_clean("ad_metrics")
won_col           = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)

# -----------------------------------------------------------------------------
# Global KPIs
# -----------------------------------------------------------------------------
total_pipeline  = opps["_amount"].sum() if "_amount" in opps.columns else 0
won_pipeline    = opps.loc[opps[won_col] == True, "_amount"].sum() if won_col and "_amount" in opps.columns else 0
mktg_pipeline   = opps.loc[opps["is_marketing_sourced"] == True, "_amount"].sum() \
                  if "is_marketing_sourced" in opps.columns else 0
total_deals     = len(opps)
won_deals       = (opps[won_col] == True).sum() if won_col else 0
stage_col       = next((c for c in opps.columns if "current_stage" in c.lower()), None)
resolved_deals  = int(resolved_stage_mask(opps[stage_col]).sum()) if stage_col else total_deals
win_rate        = won_deals / resolved_deals if resolved_deals else 0
mktg_pct        = mktg_pipeline / total_pipeline if total_pipeline else 0
open_deals      = len(win_prob)
create_col      = next((c for c in opps.columns if "createdate" in c.lower()), None)
create_dates    = pd.to_datetime(opps[create_col], errors="coerce", utc=True) if create_col else pd.Series(dtype="datetime64[ns, UTC]")
data_year_range = (
    f"{int(create_dates.dt.year.min())}-{int(create_dates.dt.year.max())}"
    if len(create_dates) and create_dates.notna().any() else "Date range unavailable"
)

def fmt(v, m="$"):
    if pd.isna(v) or v == 0: return f"{m}0"
    if v >= 1e6:  return f"{m}{v/1e6:.1f}M"
    if v >= 1e3:  return f"{m}{v/1e3:.0f}K"
    return f"{m}{v:.0f}"

def model_auc_text():
    if not model_stats.empty and "auc" in model_stats.columns and pd.notna(model_stats.loc[0, "auc"]):
        return f"{float(model_stats.loc[0, 'auc']):.3f}"
    return "N/A"

def model_validation_text():
    if not model_stats.empty and "validation" in model_stats.columns and pd.notna(model_stats.loc[0, "validation"]):
        return str(model_stats.loc[0, "validation"])
    return "cross-validated"

def sourced_pipeline_val():
    if attribution.empty:
        return "$0"
    v = attribution[attribution["attribution_model"] == "Marketing Sourced"]["attributed_pipeline"].sum()
    return fmt(v)


def attribution_scope_vals():
    defaults = {
        "linked_opportunities": "0",
        "linked_won_opportunities": "0",
        "linked_win_share": "0.0%",
        "attribution_eligible_opportunities": "0",
    }
    if attribution_scope.empty:
        return defaults
    row = attribution_scope.iloc[0]
    return {
        "linked_opportunities": f"{int(row.get('linked_opportunities', 0)):,}",
        "linked_won_opportunities": f"{int(row.get('linked_won_opportunities', 0)):,}",
        "linked_win_share": f"{float(row.get('linked_share_of_won_opportunities', 0)):.1%}",
        "attribution_eligible_opportunities": f"{int(row.get('eligible_domain_date_amount', 0)):,}",
    }


def email_scope_vals():
    defaults = {"email_events": "0", "email_people": "0", "email_click_share": "0.0%"}
    if email.empty:
        return defaults
    person_col = "_prospectID" if "_prospectID" in email.columns else "_email"
    clicks = int(email.get("is_click", pd.Series(dtype=int)).sum())
    return {
        "email_events": f"{len(email):,}",
        "email_people": f"{email[person_col].nunique():,}" if person_col in email.columns else "N/A",
        "email_click_share": f"{clicks / len(email):.1%}" if len(email) else "0.0%",
    }

def coverage_summary_vals():
    defaults = {
        "unreached_accounts": "0",
        "unreached_pct": "0.0%",
        "target_accounts": "0",
        "email_only_rate": "0.0%",
        "both_rate": "0.0%",
        "not_reached_rate": "0.0%",
    }
    if account_coverage.empty or "coverage_tier" not in account_coverage.columns:
        return defaults

    total = len(account_coverage)
    if total == 0:
        return defaults

    def tier_count(name):
        return int((account_coverage["coverage_tier"] == name).sum())

    def opp_rate(name):
        if "has_opportunity" not in account_coverage.columns:
            return "0.0%"
        rows = account_coverage[account_coverage["coverage_tier"] == name]
        return f"{rows['has_opportunity'].mean():.1%}" if len(rows) else "0.0%"

    unreached = tier_count("Not Reached")
    return {
        "unreached_accounts": f"{unreached:,}",
        "unreached_pct": f"{unreached / total:.1%}",
        "target_accounts": f"{total:,}",
        "email_only_rate": opp_rate("Email Only"),
        "both_rate": opp_rate("Both Channels"),
        "not_reached_rate": opp_rate("Not Reached"),
    }


def opportunity_cohort_view():
    """Rebuild cohort quality from opportunity-level data with maturity context.

    The pipeline extract contains open opportunities, so won / all opportunities
    understates recent cohorts simply because many deals are unresolved.  Use
    closed-only win rate for quality and expose the resolved share separately.
    """
    required = {"_opportunity_id", "_amount", "_createdate (Date)", "_current_stage"}
    if opps.empty or not won_col or not required.issubset(opps.columns):
        return pd.DataFrame()

    df = opps.dropna(subset=["_createdate (Date)"]).copy()
    created = pd.to_datetime(df["_createdate (Date)"], errors="coerce")
    df = df.loc[created.notna()].copy()
    df["quarter"] = created.loc[created.notna()].dt.to_period("Q").astype(str)
    df["is_closed"] = df["_current_stage"].astype(str).str.contains(
        "closed|discontinued", case=False, na=False
    )
    df["is_won"] = df[won_col].fillna(False).astype(bool)
    if "is_marketing_sourced" not in df.columns:
        df["is_marketing_sourced"] = False

    grouped = df.groupby("quarter", as_index=False).agg(
        deals=("_opportunity_id", "count"),
        won=("is_won", "sum"),
        closed=("is_closed", "sum"),
        pipeline=("_amount", "sum"),
        marketing_sourced=("is_marketing_sourced", "sum"),
    )
    closed_wins = (
        df[df["is_closed"]]
        .groupby("quarter")["is_won"]
        .sum()
        .rename("won_closed")
    )
    grouped = grouped.merge(closed_wins, on="quarter", how="left")
    grouped["won_closed"] = grouped["won_closed"].fillna(0)
    grouped["closed_win_rate"] = grouped["won_closed"] / grouped["closed"].replace(0, np.nan)
    grouped["closed_share"] = grouped["closed"] / grouped["deals"].replace(0, np.nan)
    grouped["mktg_pct"] = grouped["marketing_sourced"] / grouped["deals"].replace(0, np.nan)
    intervals = grouped.apply(lambda row: wilson_interval(int(row["won_closed"]), int(row["closed"])), axis=1)
    grouped["win_rate_ci_low"] = [interval[0] for interval in intervals]
    grouped["win_rate_ci_high"] = [interval[1] for interval in intervals]
    return grouped.sort_values("quarter")


def cohort_summary_vals():
    defaults = {
        "cohort_start_rate": "N/A",
        "cohort_end_rate": "N/A",
        "cohort_start_quarter": "start",
        "cohort_end_quarter": "latest quarter",
        "mktg_peak_pct": "N/A",
        "mktg_end_pct": "N/A",
    }
    cohort_view = opportunity_cohort_view()
    if cohort_view.empty:
        return defaults
    recent = cohort_view.dropna(subset=["closed_win_rate"]).copy()
    if recent.empty:
        return defaults
    recent_2022 = recent[recent["quarter"].astype(str) >= "2022Q1"].copy()
    if not recent_2022.empty:
        recent = recent_2022
    mature = recent[recent["closed_share"] >= 0.80].copy()
    if mature.empty:
        mature = recent
    start = mature.iloc[0]
    end = mature.iloc[-1]
    peak = recent["mktg_pct"].max() if "mktg_pct" in recent.columns else np.nan
    return {
        "cohort_start_rate": f"{start['closed_win_rate']:.0%}",
        "cohort_end_rate": f"{end['closed_win_rate']:.0%}",
        "cohort_start_quarter": str(start["quarter"]),
        "cohort_end_quarter": str(end["quarter"]),
        "mktg_peak_pct": f"{peak:.0%}" if pd.notna(peak) else "N/A",
        "mktg_end_pct": f"{end['mktg_pct']:.0%}" if "mktg_pct" in recent.columns and pd.notna(end["mktg_pct"]) else "N/A",
    }

def top_sourced_channels_text():
    if channel_pipeline.empty:
        return "Top sourced channels are unavailable."
    excluded = {"other", "existing_client", "referral"}
    df = channel_pipeline[~channel_pipeline["channel_category"].isin(excluded)].sort_values("total_pipeline", ascending=False).head(3)
    if df.empty:
        return "No net-new marketing channel pipeline is available."
    return " + ".join(f"{r['channel_category'].replace('_', ' ').title()} ({fmt(r['total_pipeline'])})" for _, r in df.iterrows())

def top_won_channels_text():
    if channel_pipeline.empty:
        return "Won revenue by channel is unavailable."
    df = channel_pipeline[channel_pipeline["won_pipeline"] > 0].sort_values("won_pipeline", ascending=False).head(2)
    return " and ".join(f"{r['channel_category'].replace('_', ' ').title()} ({fmt(r['won_pipeline'])} won)" for _, r in df.iterrows())

def tracked_spend_channels_text():
    if channel_pipeline.empty or "channel_spend" not in channel_pipeline.columns:
        return "tracked-spend channels"
    channels = channel_pipeline.loc[channel_pipeline["channel_spend"] > 0, "channel_category"].tolist()
    return ", ".join(channels) if channels else "tracked-spend channels"

def dashboard_quality_vals():
    defaults = {
        "domain_match_rate": "N/A",
        "missing_create_dates": "0",
        "missing_date_class": "",
        "unknown_channel_pct": "0.0%",
        "unknown_channel_class": "",
        "top3_pipeline_share": "0.0%",
        "attribution_reconciliation": "N/A",
        "zero_amount_won": "0.0%",
        "zero_amount_won_class": "",
        "attribution_linked_win_pct": "N/A",
    }
    if opps.empty:
        return defaults

    domain_series = None
    for col in ["_domain", "domain", "account_domain", "website"]:
        if col in opps.columns:
            domain_series = opps[col]
            break
    if domain_series is None and {"_account_id"}.issubset(opps.columns) and {"accountid", "domain__c"}.issubset(accounts.columns):
        domain_map = accounts.drop_duplicates("accountid").set_index("accountid")["domain__c"]
        domain_series = opps["_account_id"].map(domain_map)
    if domain_series is not None:
        valid_domains = domain_series.astype(str).str.strip().replace({"": np.nan, "nan": np.nan, "None": np.nan})
        defaults["domain_match_rate"] = f"{valid_domains.notna().mean():.1%}"

    create_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    if create_col:
        missing_dates = int(pd.to_datetime(opps[create_col], errors="coerce").isna().sum())
        defaults["missing_create_dates"] = f"{missing_dates:,}"
        defaults["missing_date_class"] = "warn" if missing_dates else ""

    if "channel_category" in opps.columns:
        channels = opps["channel_category"].fillna("unknown").astype(str).str.lower().str.strip()
        unknown_share = channels.isin(["", "unknown", "other", "nan", "none"]).mean()
        defaults["unknown_channel_pct"] = f"{unknown_share:.1%}"
        defaults["unknown_channel_class"] = "warn" if unknown_share > 0.10 else ""

    if not channel_pipeline.empty and {"total_pipeline", "channel_category"}.issubset(channel_pipeline.columns):
        total = float(channel_pipeline["total_pipeline"].sum())
        if total > 0:
            top3 = float(channel_pipeline.nlargest(3, "total_pipeline")["total_pipeline"].sum()) / total
            defaults["top3_pipeline_share"] = f"{top3:.1%}"

    if not attribution.empty and {"attribution_model", "attributed_pipeline"}.issubset(attribution.columns):
        sourced = attribution.loc[attribution["attribution_model"] == "Marketing Sourced", "attributed_pipeline"].sum()
        influenced = attribution.loc[attribution["attribution_model"] == "Marketing Influenced", "attributed_pipeline"].sum()
        if sourced > 0:
            defaults["attribution_reconciliation"] = f"{influenced / sourced:.1f}x"
        elif influenced > 0:
            defaults["attribution_reconciliation"] = "Influenced only"

    if won_col and "_amount" in opps.columns:
        won_rows = opps[opps[won_col].eq(True)]
        zero_won_rate = won_rows["_amount"].fillna(0).eq(0).mean() if len(won_rows) else np.nan
        defaults["zero_amount_won"] = f"{zero_won_rate:.1%}" if pd.notna(zero_won_rate) else "N/A"
        defaults["zero_amount_won_class"] = "warn" if pd.notna(zero_won_rate) and zero_won_rate > 0.05 else ""

    if not attribution_scope.empty and "linked_share_of_won_opportunities" in attribution_scope.columns:
        value = attribution_scope.loc[0, "linked_share_of_won_opportunities"]
        defaults["attribution_linked_win_pct"] = f"{value:.1%}" if pd.notna(value) else "N/A"

    return defaults

LAYOUT = dict(
    font=dict(family="Segoe UI, Arial, sans-serif", size=13, color="#152238"),
    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=46, r=24, t=56, b=44),
    legend=dict(bgcolor="rgba(0,0,0,0)", font_size=12, font=dict(color="#46566D")),
    hoverlabel=dict(
        bgcolor="#152238",
        bordercolor="#152238",
        font=dict(color="#FFFFFF", family="Segoe UI, Arial, sans-serif", size=12),
    ),
)

COLORS = ["#2563EB", "#0F766E", "#D97706", "#7C3AED", "#0E7490",
          "#64748B", "#B45309", "#475569", "#15803D", "#8B5CF6"]

# -----------------------------------------------------------------------------
# Chart builders
# -----------------------------------------------------------------------------

def channel_bar():
    if channel_pipeline.empty: return go.Figure()
    df = channel_pipeline.sort_values("total_pipeline", ascending=True).tail(12)
    colors = [CHANNEL_COLOR_MAP.get(c, COLORS[0]) for c in df["channel_category"]]
    fig = go.Figure(go.Bar(
        y=df["channel_category"], x=df["total_pipeline"],
        orientation="h",
        marker_color=colors,
        text=[fmt(v) for v in df["total_pipeline"]],
        textposition="outside",
        cliponaxis=False,
        hovertemplate="<b>%{y}</b><br>Pipeline: $%{x:,.0f}<extra></extra>",
    ))
    fig.update_layout(title="Pipeline by Channel", xaxis_title="", **LAYOUT)
    return fig


def channel_donut():
    if channel_pipeline.empty: return go.Figure()
    df = channel_pipeline[channel_pipeline["won_pipeline"] > 0].sort_values("won_pipeline", ascending=True)
    colors = [CHANNEL_COLOR_MAP.get(c, COLORS[0]) for c in df["channel_category"]]
    fig = go.Figure(go.Bar(
        y=df["channel_category"],
        x=df["won_pipeline"],
        orientation="h",
        marker_color=colors,
        text=[fmt(v) for v in df["won_pipeline"]],
        textposition="auto",
        hovertemplate="<b>%{y}</b><br>Won revenue: $%{x:,.0f}<extra></extra>",
    ))
    fig.update_layout(title="Won Revenue by Channel", xaxis_title="", **LAYOUT)
    return fig


def funnel_fig():
    if funnel_metrics.empty: return go.Figure()
    fig = go.Figure()
    for i, channel in enumerate(funnel_metrics["channel"].dropna().unique()):
        f = funnel_metrics[funnel_metrics["channel"] == channel].copy()
        fig.add_trace(go.Bar(
            name=channel,
            y=[f"{channel} - {stage}" for stage in f["stage"]],
            x=f["count"].tolist(),
            orientation="h",
            marker_color=COLORS[i % len(COLORS)],
            text=[f"{v:,}" for v in f["count"]],
            textposition="auto",
            hovertemplate=f"<b>{channel}</b><br>%{{y}}<br>Count: %{{x:,}}<extra></extra>",
        ))
    fig.update_layout(
        title="Channel Activity Volumes (Separate Populations)",
        xaxis_title="Count (log scale)",
        xaxis_type="log",
        barmode="group",
        **LAYOUT,
    )
    return fig


def attribution_comparison():
    """Compare common touchpoint channels across multi-touch model roles."""
    if attribution.empty: return go.Figure()
    model_order = ["First-Touch", "Last-Touch", "Linear", "Time-Decay"]
    models = [m for m in model_order if m in attribution["attribution_model"].unique()]
    role_rows = attribution[attribution["attribution_model"].isin(models)].copy()
    pivot = role_rows.pivot_table(
        index="channel",
        columns="attribution_model",
        values="attributed_pipeline",
        aggfunc="sum",
    ).fillna(0)
    pivot = pivot.reindex(columns=models)
    pivot = pivot.loc[pivot.sum(axis=1).sort_values(ascending=True).index]
    palette = ["#2563EB", "#0F766E", "#D97706", "#7C3AED"]
    patterns = ["", "/", ".", "x"]
    fig = go.Figure()
    for idx, model in enumerate(models):
        values = pivot[model]
        fig.add_trace(go.Bar(
            name=model,
            y=pivot.index,
            x=values,
            orientation="h",
            marker=dict(color=palette[idx], pattern=dict(shape=patterns[idx])),
            text=[fmt(v) for v in values],
            textposition="outside",
            hovertemplate=f"<b>%{{y}}</b><br>{model}: $%{{x:,.0f}}<extra></extra>",
        ))
    fig.update_layout(
        title="Multi-Touch Attribution by Channel and Model<br><sup>Common touchpoint-linked channels; sourced and influenced totals are shown separately</sup>",
        xaxis_title="Attributed Pipeline ($)", yaxis_title="",
        barmode="group",
        **LAYOUT,
    )
    return fig


def sourced_vs_influenced():
    """Bullet-style bars: easier than donuts for comparing share of total pipeline."""
    if attribution.empty: return go.Figure()
    sourced_total = attribution[attribution["attribution_model"] == "Marketing Sourced"]["attributed_pipeline"].sum()
    influenced_total = attribution[attribution["attribution_model"] == "Marketing Influenced"]["attributed_pipeline"].sum()
    df = pd.DataFrame({
        "Metric": ["Marketing Sourced", "Marketing Influenced"],
        "Pipeline": [sourced_total, influenced_total],
        "Share": [sourced_total / total_pipeline if total_pipeline else 0, influenced_total / total_pipeline if total_pipeline else 0],
    })
    fig = go.Figure(go.Bar(
        y=df["Metric"],
        x=df["Pipeline"],
        orientation="h",
        marker_color=["#2563EB", "#0F766E"],
        text=[f"{fmt(v)} ({s:.0%})" for v, s in zip(df["Pipeline"], df["Share"])],
        textposition="auto",
        hovertemplate="<b>%{y}</b><br>Pipeline: $%{x:,.0f}<extra></extra>",
    ))
    fig.add_vline(x=total_pipeline, line_color="#CBD5E1", line_dash="dot")
    fig.update_layout(title="Marketing Contribution vs Total Pipeline", xaxis_title="Pipeline ($)", **LAYOUT)
    return fig


def attribution_waterfall():
    """Waterfall showing credit shift from first-touch to last-touch for top channels."""
    if attribution.empty: return go.Figure()
    ft = attribution[attribution["attribution_model"] == "First-Touch"].set_index("channel")["attributed_pipeline"]
    lt = attribution[attribution["attribution_model"] == "Last-Touch"].set_index("channel")["attributed_pipeline"]
    channels = list(set(ft.index.tolist() + lt.index.tolist()))
    delta = [(lt.get(c, 0) - ft.get(c, 0)) for c in channels]
    colors = ["#0F766E" if d >= 0 else "#D97706" for d in delta]
    fig = go.Figure(go.Bar(
        x=channels, y=delta,
        marker_color=colors,
        text=[f"{'+' if d>=0 else ''}{fmt(d)}" for d in delta],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Last-Touch vs First-Touch: $%{y:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="Credit Shift: Last-Touch vs First-Touch by Channel",
        yaxis_title="Delta ($)", xaxis_title="",
        **LAYOUT,
    )
    fig.add_hline(y=0, line_color="#94A3B8", line_width=1)
    return fig


def spend_vs_pipeline():
    if channel_pipeline.empty: return go.Figure()
    df = channel_pipeline[channel_pipeline["channel_spend"] > 0].copy()
    if df.empty: return go.Figure()
    df = df.sort_values("pipeline_roi", ascending=True)
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Pipeline ROI",
        y=df["channel_category"],
        x=df["pipeline_roi"],
        orientation="h",
        marker_color="#2563EB",
        text=[f"{v:.1f}x" if pd.notna(v) else "" for v in df["pipeline_roi"]],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Pipeline ROI: %{x:.2f}x<extra></extra>",
    ))
    fig.add_trace(go.Bar(
        name="Revenue ROI",
        y=df["channel_category"],
        x=df["revenue_roi"],
        orientation="h",
        marker_color="#0F766E",
        text=[f"{v:.1f}x" if pd.notna(v) else "" for v in df["revenue_roi"]],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Revenue ROI: %{x:.2f}x<extra></extra>",
    ))
    fig.update_layout(title="Tracked-Spend ROI by Channel", xaxis_title="ROI multiple", barmode="group", **LAYOUT)
    return fig


def monthly_pipeline_trend():
    if opps.empty: return go.Figure()
    opp_date_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    if not opp_date_col: return go.Figure()
    df = opps.dropna(subset=[opp_date_col, "_amount", "channel_category"]).copy()
    df["month"] = pd.to_datetime(df[opp_date_col], errors="coerce").dt.to_period("M").astype(str)
    top_channels = (
        df.groupby("channel_category")["_amount"].sum().nlargest(5).index.tolist()
    )
    df["channel_group"] = np.where(
        df["channel_category"].isin(top_channels), df["channel_category"], "Other"
    )
    monthly = df.groupby(["month", "channel_group"])["_amount"].sum().reset_index()
    color_map = {c: CHANNEL_COLOR_MAP.get(c, COLORS[i % len(COLORS)]) for i, c in enumerate(top_channels)}
    color_map["Other"] = "#64748B"
    fig = px.area(monthly, x="month", y="_amount", color="channel_group",
                  color_discrete_map=color_map,
                  labels={"month": "", "_amount": "Pipeline ($)"},
                  title="Monthly Pipeline Mix - Top 5 Channels + Other")
    fig.update_layout(**LAYOUT)
    return fig


def segment_heatmap():
    if opps.empty: return go.Figure()
    if "segment__c" not in opps.columns or "_amount" not in opps.columns: return go.Figure()
    # Get industry from master_account join
    if "industry" in master_account.columns and "total_pipeline" in master_account.columns:
        seg_ind = master_account.dropna(subset=["segment__c","industry"]) \
            if "segment__c" in master_account.columns else pd.DataFrame()
        if not seg_ind.empty:
            pivot = seg_ind.pivot_table(values="total_pipeline", index="industry",
                                        columns="segment__c", aggfunc="sum").fillna(0)
            pivot = pivot.loc[pivot.sum(axis=1).nlargest(12).index]
            fig = go.Figure(go.Heatmap(
                z=pivot.values,
                x=pivot.columns.tolist(),
                y=pivot.index.tolist(),
                colorscale="Blues",
                hovertemplate="Industry: %{y}<br>Segment: %{x}<br>Pipeline: $%{z:,.0f}<extra></extra>",
                text=[[f"${v/1e3:.0f}K" if v > 0 else "" for v in row] for row in pivot.values],
                texttemplate="%{text}",
            ))
            fig.update_layout(title="Pipeline Heatmap: Industry x Segment", **LAYOUT)
            return fig
    return go.Figure()


def segment_win_rate():
    if opps.empty or "segment__c" not in opps.columns or not won_col: return go.Figure()
    source = opps[resolved_stage_mask(opps[stage_col])].copy() if stage_col else opps.copy()
    df = source.dropna(subset=["segment__c"]).groupby("segment__c").agg(
        deals=("_opportunity_id","count"),
        won=(won_col, lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        avg_deal=("_amount","mean"),
    ).reset_index()
    df["win_rate"] = df["won"] / df["deals"]
    intervals = df.apply(lambda row: wilson_interval(int(row["won"]), int(row["deals"])), axis=1)
    df["ci_low"] = [interval[0] for interval in intervals]
    df["ci_high"] = [interval[1] for interval in intervals]
    df = df.sort_values("win_rate", ascending=True)

    fig = go.Figure(go.Bar(
        x=df["win_rate"],
        y=df["segment__c"],
        orientation="h",
        marker_color="#2563EB",
        text=[f"{wr:.1%} | n={int(n):,} | avg {fmt(avg)}" for wr, n, avg in zip(df["win_rate"], df["deals"], df["avg_deal"])],
        textposition="outside",
        error_x=dict(
            type="data",
            array=(df["ci_high"] - df["win_rate"]).clip(lower=0),
            arrayminus=(df["win_rate"] - df["ci_low"]).clip(lower=0),
            color="#64748B",
            thickness=1.2,
        ),
        customdata=np.stack([df["deals"], df["avg_deal"], df["pipeline"]], axis=-1),
        hovertemplate="<b>%{y}</b><br>Win Rate: %{x:.1%}<br>Deals: %{customdata[0]:,.0f}<br>Avg Deal: $%{customdata[1]:,.0f}<br>Pipeline: $%{customdata[2]:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="Closed-Deal Win Rate by Segment<br><sup>95% Wilson interval; resolved opportunities only</sup>",
        xaxis=dict(title="Win Rate", tickformat=".0%"),
        yaxis=dict(title=""),
        **LAYOUT,
    )
    return fig


def email_seniority():
    if email.empty or "_seniority" not in email.columns: return go.Figure()
    person_col = "_prospectID" if "_prospectID" in email.columns else "_email"
    df = email.fillna({"_seniority": "Unknown"}).groupby("_seniority").agg(
        engagement_events=("_seniority","count"),
        engaged_people=(person_col, "nunique"),
        click_events=("is_click","sum"),
        registration_events=("is_register","sum"),
    ).reset_index()
    df["click_event_share"] = df["click_events"] / df["engagement_events"].replace(0, np.nan)
    df = df.sort_values("click_event_share", ascending=True)
    fig = go.Figure(go.Bar(
        x=df["click_event_share"], y=df["_seniority"], orientation="h",
        marker_color="#D97706",
        text=[f"{share:.1%} | {int(people):,} engaged people" for share, people in zip(df["click_event_share"], df["engaged_people"])],
        textposition="outside",
        customdata=np.stack([df["engagement_events"], df["click_events"], df["registration_events"]], axis=-1),
        hovertemplate="<b>%{y}</b><br>Click-event share: %{x:.1%}<br>Engagement events: %{customdata[0]:,.0f}<br>Click events: %{customdata[1]:,.0f}<br>Registration events: %{customdata[2]:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="Click-Event Share Within the Email Engagement Log by Seniority<br><sup>Event composition only; delivered-email counts are unavailable</sup>",
        xaxis=dict(title="Click events / all recorded engagement events", tickformat=".0%"),
        yaxis=dict(title=""),
        **LAYOUT,
    )
    return fig


def creative_ctr_bar():
    if creative_perf.empty or "ctr" not in creative_perf.columns: return go.Figure()
    if "_adname" not in creative_perf.columns or "_platform" not in creative_perf.columns: return go.Figure()
    source = creative_perf[creative_perf["_impressions"] >= 10000].copy()
    platforms = [p for p in ["LinkedIn", "6sense"] if p in source["_platform"].unique()]
    if not platforms: return go.Figure()
    fig = make_subplots(
        rows=len(platforms), cols=1,
        vertical_spacing=0.18,
        subplot_titles=[f"{platform}: top high-volume ads" for platform in platforms],
    )
    colors = {"LinkedIn": "#1E40AF", "6sense": "#D97706"}
    for row_idx, platform in enumerate(platforms, start=1):
        top = source[source["_platform"] == platform].nlargest(5, "ctr").sort_values("ctr")
        fig.add_trace(go.Bar(
            x=top["ctr"], y=[str(n)[:34] for n in top["_adname"]],
            orientation="h", marker_color=colors.get(platform, COLORS[0]),
            text=[f"{v:.2%} | {int(n):,} imp." for v, n in zip(top["ctr"], top["_impressions"])],
            textposition="outside",
            customdata=top["_impressions"],
            hovertemplate="<b>%{y}</b><br>CTR: %{x:.2%}<br>Impressions: %{customdata:,.0f}<extra></extra>",
            showlegend=False,
        ), row=row_idx, col=1)
        fig.update_xaxes(tickformat=".1%", rangemode="tozero", row=row_idx, col=1)
    fig.update_layout(
        title="Creative CTR Within Platform<br><sup>Top five ads per platform with at least 10,000 impressions; platform benchmarks differ</sup>",
        **LAYOUT,
    )
    return fig


def creative_attr_chart():
    if creative_perf.empty: return go.Figure()
    attr_col = "_copytone" if "_copytone" in creative_perf.columns else None
    if not attr_col or "_platform" not in creative_perf.columns: return go.Figure()
    source = creative_perf[creative_perf["_platform"] == "6sense"].copy()
    if source.empty: return go.Figure()
    grp = source.dropna(subset=[attr_col]).groupby(attr_col).agg(
        impressions=("_impressions","sum"), clicks=("_clicks","sum"), spend=("_spend","sum"),
        ads=("_adname", "nunique"),
    ).reset_index()
    grp["ctr"] = grp["clicks"] / grp["impressions"].replace(0, np.nan)
    grp = grp.sort_values("ctr", ascending=True)
    fig = go.Figure(go.Bar(
        x=grp["ctr"], y=grp[attr_col], orientation="h",
        marker_color="#1E40AF",
        text=[f"{ctr:.3%} | {int(imp):,} imp. | {int(ads)} ads" for ctr, imp, ads in zip(grp["ctr"], grp["impressions"], grp["ads"])],
        textposition="outside",
        customdata=np.stack([grp["impressions"], grp["ads"]], axis=-1),
        hovertemplate="<b>%{y}</b><br>CTR: %{x:.3%}<br>Impressions: %{customdata[0]:,.0f}<br>Ads: %{customdata[1]:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="6sense CTR by Recorded Copy Tone<br><sup>Unknown dominates delivery; labeled tone comparisons have limited volume</sup>",
        xaxis=dict(title="CTR", tickformat=".2%", rangemode="tozero"),
        yaxis=dict(title=""),
        **LAYOUT,
    )
    return fig


def budget_scenario_chart():
    if budget_scenarios.empty: return go.Figure()
    summary = budget_scenarios.groupby("Scenario", as_index=False).agg({
        "Active Spend ($)": "sum",
        "Holdout Reserve ($)": "sum",
        "Experiment Pool ($)": "sum",
        "Total Budget ($)": "sum",
    })
    order = ["Status Quo", "10% Holdout", "Measurement First"]
    summary["_order"] = summary["Scenario"].map({name: idx for idx, name in enumerate(order)})
    summary = summary.sort_values("_order")
    fig = go.Figure()
    for field, label, color in [
        ("Active Spend ($)", "Activated media", "#1E40AF"),
        ("Holdout Reserve ($)", "Holdout reserve", "#D97706"),
        ("Experiment Pool ($)", "Experiment pool", "#0F766E"),
    ]:
        fig.add_trace(go.Bar(
            name=label,
            x=summary["Scenario"],
            y=summary[field],
            marker_color=color,
            text=[fmt(v) if v else "" for v in summary[field]],
            textposition="inside",
            hovertemplate=f"<b>%{{x}}</b><br>{label}: $%{{y:,.0f}}<extra></extra>",
        ))
    fig.update_layout(
        title="Budget-Neutral Measurement Plans<br><sup>No pipeline forecast: only two paid channels have spend, and outcome evidence is insufficient for optimization</sup>",
        barmode="stack",
        yaxis_title="Tracked budget ($)",
        **LAYOUT,
    )
    return fig


# -----------------------------------------------------------------------------
# Advanced Analytics Charts
# -----------------------------------------------------------------------------

def feature_importance_chart():
    if feat_imp.empty: return go.Figure()
    df = feat_imp.head(12).sort_values("importance")
    fig = go.Figure(go.Bar(
        y=df["feature"], x=df["importance"], orientation="h",
        marker_color=COLORS[0],
        text=[f"{v:.3f}" for v in df["importance"]], textposition="outside",
        hovertemplate="<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>",
    ))
    fig.update_layout(title="Win Model: Opportunity-Time Feature Importance",
                      xaxis_title="Importance Score", **LAYOUT)
    return fig


def account_coverage_chart():
    if account_coverage.empty: return go.Figure()
    if not coverage_summary.empty:
        summary = coverage_summary.copy()
        summary["pct"] = summary["pct_of_total"]
    else:
        summary = account_coverage.groupby("coverage_tier").agg(
            accounts=("domain","count"),
            with_opp=("has_opportunity","sum")
        ).reset_index()
        summary["pct"] = summary["accounts"] / summary["accounts"].sum()
        summary["opp_rate"] = summary["with_opp"] / summary["accounts"]
        intervals = summary.apply(lambda row: wilson_interval(int(row["with_opp"]), int(row["accounts"])), axis=1)
        summary["opp_rate_ci_low"] = [interval[0] for interval in intervals]
        summary["opp_rate_ci_high"] = [interval[1] for interval in intervals]

    order = ["Not Reached","6sense Only","Email Only","Both Channels"]
    summary["_order"] = summary["coverage_tier"].map({v:i for i,v in enumerate(order)}).fillna(99)
    summary = summary.sort_values("_order")

    colors_cov = ["#94A3B8", "#60A5FA", "#D97706", "#0F766E"]
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.12,
        row_heights=[0.58, 0.42],
        subplot_titles=("CRM Account Domains by Coverage Tier", "Observed Opportunity Rate"),
    )
    fig.add_trace(go.Bar(
        name="# Accounts", x=summary["coverage_tier"], y=summary["accounts"],
        marker_color=colors_cov[:len(summary)],
        text=[f"{int(v):,}<br>({p:.0%})" for v,p in zip(summary["accounts"], summary["pct"])],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Accounts: %{y:,}<extra></extra>",
    ), row=1, col=1)
    if "opp_rate" in summary.columns:
        fig.add_trace(go.Scatter(
            name="Opp Rate", x=summary["coverage_tier"], y=summary["opp_rate"],
            mode="markers+text", marker=dict(size=12, color="#0F766E", symbol="diamond"),
            text=[f"{r:.1%} (n={int(n):,})" for r, n in zip(summary["opp_rate"], summary["accounts"])],
            textposition="top center",
            error_y=dict(
                type="data",
                array=(summary["opp_rate_ci_high"] - summary["opp_rate"]).clip(lower=0),
                arrayminus=(summary["opp_rate"] - summary["opp_rate_ci_low"]).clip(lower=0),
                color="#64748B",
                thickness=1.2,
            ),
            hovertemplate="<b>%{x}</b><br>Observed opportunity rate: %{y:.1%}<extra></extra>",
        ), row=2, col=1)
    fig.update_yaxes(title_text="# Accounts", rangemode="tozero", row=1, col=1)
    fig.update_yaxes(title_text="Opportunity Rate", tickformat=".0%", range=[0, 0.6], row=2, col=1)
    fig.update_layout(
        title="Account Coverage and Observed Opportunity Rate<br><sup>95% Wilson intervals; association only because coverage groups are not randomized</sup>",
        showlegend=False,
        **LAYOUT,
    )
    return fig




def journey_chart():
    if journey_seq.empty: return go.Figure()
    df = journey_seq.copy()
    if "sequence_2ch" not in df.columns: return go.Figure()
    top = df.groupby("sequence_2ch").agg(deals=("opp_id","count"), pipeline=("amount","sum")).reset_index()
    top = top.sort_values("deals", ascending=True).tail(10)
    fig = go.Figure(go.Bar(
        y=top["sequence_2ch"], x=top["deals"], orientation="h",
        marker_color=COLORS[:len(top)],
        text=[f"{int(d)} deals - {fmt(p)}" for d,p in zip(top["deals"], top["pipeline"])],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Deals: %{x}<extra></extra>",
    ))
    fig.update_layout(title="Winning Touchpoint Journey Sequences",
                      xaxis_title="Won Deals", **LAYOUT)
    return fig


def targeting_matrix_chart():
    if targeting_matrix.empty: return go.Figure()
    df = targeting_matrix.copy()
    if "segment__c" not in df.columns or "accountprofilefit6sense__c" not in df.columns:
        return go.Figure()
    pivot = df.pivot_table(values="win_rate", index="segment__c",
                           columns="accountprofilefit6sense__c", aggfunc="mean").fillna(0)
    counts = df.pivot_table(values="deals", index="segment__c",
                            columns="accountprofilefit6sense__c", aggfunc="sum").fillna(0)
    counts = counts.reindex(index=pivot.index, columns=pivot.columns).fillna(0)
    text_vals = []
    for rate_row, count_row in zip(pivot.values, counts.values):
        row = []
        for rate, n in zip(rate_row, count_row):
            low_n = "<br>Low N" if n < 30 else ""
            row.append(f"{rate:.0%}<br>n={int(n):,}{low_n}")
        text_vals.append(row)
    fig = go.Figure(go.Heatmap(
        z=pivot.values, x=pivot.columns.tolist(), y=pivot.index.tolist(),
        colorscale="Blues", zmin=0, zmax=0.55,
        text=text_vals, texttemplate="%{text}",
        customdata=counts.values,
        hovertemplate="Segment: %{y}<br>Profile: %{x}<br>Win Rate: %{z:.1%}<br>Deals: %{customdata:,.0f}<extra></extra>",
    ))
    fig.update_layout(title="Win Rate by Segment and 6sense Profile Fit<br><sup>Every cell shows deal count; cells below n=30 are exploratory</sup>",
                      **LAYOUT)
    return fig




def win_prob_chart():
    if win_prob.empty: return go.Figure()
    df = win_prob.copy()
    if "win_probability" not in df.columns: return go.Figure()
    # Histogram of win probabilities
    fig = go.Figure(go.Histogram(
        x=df["win_probability"], nbinsx=20,
        marker_color=COLORS[0], opacity=0.8,
        hovertemplate="Win Prob: %{x:.0%}<br>Count: %{y}<extra></extra>",
    ))
    fig.update_layout(
        title="Active Opportunity Score Distribution",
        xaxis=dict(title="Win Probability", tickformat=".0%"),
        yaxis_title="Number of Deals",
        **LAYOUT,
    )
    return fig


# -----------------------------------------------------------------------------
def deal_velocity_chart():
    if deal_velocity.empty: return go.Figure()
    df = deal_velocity[deal_velocity["deal_count"] >= 5].sort_values("median_days")
    if df.empty: return go.Figure()
    fig = go.Figure(go.Bar(
        name="Median Days",
        y=df["channel_category"],
        x=df["median_days"],
        orientation="h",
        marker_color="#2563EB",
        error_x=dict(
            type="data",
            array=(df["p75"] - df["median_days"]).clip(lower=0),
            arrayminus=(df["median_days"] - df["p25"]).clip(lower=0),
            color="#64748B",
            thickness=1.2,
        ),
        text=[f"{int(v)}d (n={int(n)})" for v, n in zip(df["median_days"], df["deal_count"])],
        textposition="outside",
        customdata=np.stack([df["p25"], df["p75"]], axis=-1),
        hovertemplate="<b>%{y}</b><br>Median days: %{x}<br>IQR: %{customdata[0]:.0f}-%{customdata[1]:.0f} days<extra></extra>",
    ))
    fig.update_layout(title="Deal Velocity - Median Days to Close with IQR<br><sup>Channels with at least 5 won deals</sup>",
                      xaxis_title="Days to Close", **LAYOUT)
    return fig


def cohort_chart():
    df = opportunity_cohort_view()
    if df.empty: return go.Figure()
    recent = df[df["quarter"].astype(str) >= "2022Q1"].copy()
    if not recent.empty:
        df = recent
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.08,
        row_heights=[0.58, 0.42],
        subplot_titles=("Pipeline Created", "Closed-Deal Quality and Cohort Maturity"),
    )
    fig.add_trace(go.Bar(
        name="Pipeline ($)",
        x=df["quarter"],
        y=df["pipeline"],
        marker_color="#2563EB",
        opacity=0.85,
        text=[fmt(v) for v in df["pipeline"]],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Pipeline: $%{y:,.0f}<extra></extra>",
    ), row=1, col=1)
    fig.add_trace(go.Scatter(
        name="Closed-Only Win Rate",
        x=df["quarter"],
        y=df["closed_win_rate"],
        mode="lines+markers",
        marker=dict(size=7, color="#D97706"),
        line=dict(dash="solid"),
        error_y=dict(
            type="data",
            array=(df["win_rate_ci_high"] - df["closed_win_rate"]).clip(lower=0),
            arrayminus=(df["closed_win_rate"] - df["win_rate_ci_low"]).clip(lower=0),
            color="#64748B",
            thickness=1.1,
        ),
        customdata=df["closed"],
        hovertemplate="<b>%{x}</b><br>Closed-only win rate: %{y:.0%}<br>Resolved deals: %{customdata:,.0f}<extra></extra>",
    ), row=2, col=1)
    fig.add_trace(go.Scatter(
        name="Cohort Resolved Share",
        x=df["quarter"],
        y=df["closed_share"],
        mode="lines+markers",
        marker=dict(size=7, color="#0F766E", symbol="diamond-open"),
        line=dict(dash="dash"),
        hovertemplate="<b>%{x}</b><br>Resolved share: %{y:.0%}<extra></extra>",
    ), row=2, col=1)
    fig.update_yaxes(title_text="Pipeline ($)", row=1, col=1)
    fig.update_yaxes(title_text="Rate", tickformat=".0%", range=[0, 1.0], row=2, col=1)
    fig.update_layout(title="Pipeline Cohorts - Volume, Closed-Deal Win Rate, and Maturity<br><sup>Recent cohorts with low resolved share are provisional</sup>", **LAYOUT)
    return fig


# Serialise figures to JSON (for embedding)
# -----------------------------------------------------------------------------
def fig_json(fig: go.Figure) -> str:
    fig.update_layout(title_font_size=15, title_x=0.01, title_xanchor="left")
    fig.update_xaxes(automargin=True)
    fig.update_yaxes(automargin=True)
    return json.dumps(fig.to_dict(), cls=PlotlyJSONEncoder)


# -----------------------------------------------------------------------------
# HTML Template
# -----------------------------------------------------------------------------
def clean_generated_html(html: str) -> str:
    """Repair mojibake from older template text and keep generated output ASCII-clean."""
    replacements = {
        chr(0x2014): " - ",
        chr(0x2013): "-",
        chr(0x2192): " to ",
        chr(0x00d7): "x",
        chr(0x00f7): "/",
        chr(0x25b2): "^",
        chr(0x25bc): "v",
        chr(0x2500): "-",
        chr(0x00a0): " ",
    }

    expanded = {}
    for bad, good in replacements.items():
        expanded[bad] = good
        variants = [bad]
        for _ in range(3):
            next_variants = []
            for variant in variants:
                for encoding in ("cp1252", "latin1"):
                    try:
                        mojibake = variant.encode("utf-8").decode(encoding, errors="ignore")
                    except UnicodeError:
                        continue
                    expanded[mojibake] = good
                    next_variants.append(mojibake)
            variants = next_variants

    replacements = expanded
    for bad, good in replacements.items():
        html = html.replace(bad, good)
    return "\n".join(line.rstrip() for line in html.splitlines()) + "\n"


def build_dashboard_context():
    quality_vals = dashboard_quality_vals()
    coverage_vals = coverage_summary_vals()
    cohort_vals = cohort_summary_vals()
    attribution_vals = attribution_scope_vals()
    email_vals = email_scope_vals()
    return {
        "project": "Marketing Analytics Datathon Dashboard",
        "scope": [
            "B2B marketing analytics",
            "Account-Based Marketing (ABM)",
            "Marketing attribution",
            "Pipeline and revenue analysis",
            "ICP, account coverage, 6sense, email, creative, and budget strategy",
        ],
        "guardrails": [
            "Answer only questions related to this dashboard, marketing analytics, ABM strategy, attribution, ROI, pipeline quality, ICP, 6sense, email, creative, budget testing, data quality, or presenting the findings.",
            "If a user asks about unrelated topics, politely redirect to dashboard and marketing questions.",
            "Do not invent new numbers. Use the facts below and clearly label directional assumptions.",
            "Attribution and ROI are planning signals, not proof of causality.",
        ],
        "metrics": {
            "total_pipeline": fmt(total_pipeline),
            "won_revenue": fmt(won_pipeline),
            "total_opportunities": f"{total_deals:,}",
            "resolved_opportunities": f"{resolved_deals:,}",
            "closed_deal_win_rate": f"{win_rate:.1%}",
            "data_year_range": data_year_range,
            "marketing_sourced_pipeline": fmt(mktg_pipeline),
            "marketing_sourced_share": f"{mktg_pct:.1%}",
            "marketing_influenced_pipeline": influenced_pipeline_val(),
            "sourced_pipeline": sourced_pipeline_val(),
            "unreached_accounts": coverage_vals["unreached_accounts"],
            "unreached_pct": coverage_vals["unreached_pct"],
            "target_accounts": coverage_vals["target_accounts"],
            "email_only_opportunity_rate": coverage_vals["email_only_rate"],
            "both_channels_opportunity_rate": coverage_vals["both_rate"],
            "not_reached_opportunity_rate": coverage_vals["not_reached_rate"],
            "cohort_start_win_rate": cohort_vals["cohort_start_rate"],
            "cohort_end_win_rate": cohort_vals["cohort_end_rate"],
            "cohort_start_quarter": cohort_vals["cohort_start_quarter"],
            "cohort_end_quarter": cohort_vals["cohort_end_quarter"],
            "latest_mature_marketing_sourced_share": cohort_vals["mktg_end_pct"],
            "model_auc": model_auc_text(),
            "model_validation": model_validation_text(),
            "active_scored_opportunities": f"{open_deals:,}",
            "domain_match_rate": quality_vals["domain_match_rate"],
            "missing_create_dates": quality_vals["missing_create_dates"],
            "unknown_channel_pct": quality_vals["unknown_channel_pct"],
            "top3_pipeline_share": quality_vals["top3_pipeline_share"],
            "attribution_reconciliation": quality_vals["attribution_reconciliation"],
            "zero_amount_won_share": quality_vals["zero_amount_won"],
            "attribution_linked_won_share": quality_vals["attribution_linked_win_pct"],
            **attribution_vals,
            **email_vals,
            "tracked_spend_channels": tracked_spend_channels_text(),
        },
        "recommendation": {
            "headline": "Targeted growth, not blanket budget expansion.",
            "actions": [
                "Protect pipeline quality by reviewing ICP and qualification before scaling broad top-of-funnel volume.",
                "Expand coverage to unreached strong-fit CRM account domains.",
                "Start with email coverage, then test a 6sense overlay with a holdout before scaling.",
                "Use sourced and influenced attribution together, with sourced as conservative credit and influenced as journey context.",
                "Run holdout or phased tests to measure incremental lift before large budget changes.",
            ],
        },
        "caveats": [
            "Attribution is directional and does not prove causality.",
            "Attribution coverage changes with lookback; the primary view uses 365 days and sensitivity checks use 30, 90, 180, and 365 days.",
            "Spend ROI only covers channels with reliable tracked spend.",
            "Low-volume channels and segments can be unstable.",
            "Web traffic is partially anonymous unless matched to account domains.",
            "Win probability supports prioritization, not guaranteed outcomes.",
            "The win model is directionally calibrated at the top score band but overpredicts middle test bands; use it for ranking, not probability promises.",
            "The email file is an engagement-event log; send-based open and click rates cannot be calculated.",
            "A large share of won opportunities has zero amount, so won revenue and revenue ROI are understated.",
        ],
        "marketing_concepts": {
            "abm": "ABM focuses sales and marketing on a defined CRM account universe instead of broad demand generation.",
            "icp": "ICP defines the accounts most worth pursuing using profile fit, segment, industry, win rate, and deal size.",
            "sourced_vs_influenced": "Sourced is conservative CRM origin credit; influenced is journey context for the subset of opportunities linked to eligible pre-opportunity touches.",
            "holdout_test": "Use treatment and holdout groups to measure whether coverage expansion creates incremental meetings, opportunities, pipeline, and win-rate quality.",
        },
    }


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Marketing Analytics Dashboard</title>
<script>{plotly_bundle}</script>
<style>
  :root{{
    --bg:#0A0F1A; --bg-2:#101827; --panel:rgba(17, 24, 39, .78);
    --panel-strong:rgba(21, 32, 49, .92); --panel-soft:rgba(255, 255, 255, .045);
    --border:rgba(148, 163, 184, .18); --border-strong:rgba(148, 163, 184, .32);
    --text:#F8FAFC; --text-soft:#DDE7F4; --muted:#9AA8BA; --muted-2:#748399;
    --primary:#4F8CFF; --primary-dark:#2563EB; --info:#22D3EE; --accent:#F5A524;
    --success:#2DD4BF; --danger:#FB7185; --violet:#A78BFA;
    --gradient-hot:linear-gradient(135deg, #4F8CFF 0%, #22D3EE 46%, #A78BFA 100%);
    --gradient-warm:linear-gradient(135deg, rgba(79,140,255,.22), rgba(45,212,191,.11) 52%, rgba(245,165,36,.16));
    --shadow-soft:0 16px 40px rgba(0, 0, 0, .28);
    --shadow-hover:0 20px 54px rgba(0, 0, 0, .38), 0 0 0 1px rgba(79,140,255,.16), 0 0 34px rgba(79,140,255,.13);
    --glass-blur:blur(18px);
    --mono:'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
    --ease:cubic-bezier(.2,.8,.2,1);
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  html {{ scroll-behavior:smooth; overflow-x:clip; }}
  body {{
    min-height:100vh; display:flex; color:var(--text);
    font-family:'Barlow',Arial,sans-serif; font-size:14px; line-height:1.5; letter-spacing:0;
    overflow-x:clip; background:
      radial-gradient(circle at 12% 0%, rgba(79,140,255,.16), transparent 32rem),
      radial-gradient(circle at 86% 12%, rgba(45,212,191,.10), transparent 30rem),
      linear-gradient(135deg, #070B13 0%, #111827 52%, #131A2A 100%);
  }}
  body::before {{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:-1;
    background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size:42px 42px; mask-image:linear-gradient(to bottom, rgba(0,0,0,.72), transparent 78%);
  }}
  body::after {{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:-1; opacity:.28;
    background:repeating-linear-gradient(135deg, transparent 0 10px, rgba(45,212,191,.045) 10px 11px);
    mix-blend-mode:screen;
  }}
  .skip-nav {{
    position:fixed; top:10px; left:10px; z-index:999; transform:translateY(-140%);
    padding:9px 12px; border-radius:8px; background:#F8FAFC; color:#0F172A;
    font-weight:800; text-decoration:none; box-shadow:0 12px 34px rgba(0,0,0,.32);
  }}
  .skip-nav:focus {{ transform:translateY(0); }}
  .sr-only {{
    position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
    clip:rect(0,0,0,0); white-space:nowrap; border:0;
  }}
  @keyframes fadeLift {{
    from {{ opacity:0; transform:translateY(10px); }}
    to {{ opacity:1; transform:translateY(0); }}
  }}
  @keyframes gradientShift {{
    0% {{ background-position:0% 50%; }}
    50% {{ background-position:100% 50%; }}
    100% {{ background-position:0% 50%; }}
  }}

  #sidebar {{
    width:248px; min-height:100vh; position:fixed; z-index:100; flex-shrink:0;
    display:flex; flex-direction:column; background:rgba(8, 13, 24, .88);
    border-right:1px solid var(--border); backdrop-filter:var(--glass-blur);
    -webkit-backdrop-filter:var(--glass-blur);
  }}
  .sidebar-brand {{
    padding:22px 22px 18px; color:var(--text); font-size:15px; font-weight:800;
    line-height:1.35; border-bottom:1px solid var(--border);
    background:linear-gradient(135deg, rgba(79,140,255,.16), rgba(34,211,238,.05));
  }}
  .sidebar-brand small {{ display:block; margin-top:4px; color:var(--muted); font-size:11px; font-weight:600; }}
  .nav-item {{ list-style:none; }}
  .nav-link {{
    display:flex; align-items:center; gap:11px; margin:4px 12px; padding:10px 12px;
    color:#B7C4D8; text-decoration:none; font-size:13px; font-weight:700;
    border-radius:8px; cursor:pointer; transition:background .16s ease, color .16s ease, transform .16s ease;
  }}
  .nav-link:hover {{ color:#FFFFFF; background:rgba(79,140,255,.14); transform:translateX(1px); }}
  .nav-link.hidden-by-search {{ display:none; }}
  .nav-link.active {{
    color:#FFFFFF; background:linear-gradient(135deg, rgba(79,140,255,.34), rgba(34,211,238,.14));
    box-shadow:inset 3px 0 0 var(--info), 0 8px 24px rgba(79,140,255,.12);
  }}
  .nav-icon {{ width:18px; height:18px; flex:0 0 18px; stroke-width:2; }}

  #main {{ margin-left:248px; flex:1; min-width:0; padding-bottom:44px; }}
  .top-bar {{
    position:sticky; top:0; z-index:50; min-height:74px; padding:16px 32px;
    display:flex; align-items:center; justify-content:space-between; gap:20px;
    background:
      linear-gradient(90deg, rgba(79,140,255,.13), rgba(34,211,238,.06), rgba(167,139,250,.10)),
      rgba(10, 15, 26, .82);
    border-bottom:1px solid var(--border);
    backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur);
  }}
  #nav-progress {{
    position:fixed; left:248px; right:0; top:0; height:3px; z-index:120;
    background:rgba(255,255,255,.06);
  }}
  #nav-progress span {{
    display:block; width:12.5%; height:100%; border-radius:0 999px 999px 0;
    background:var(--gradient-hot); background-size:220% 220%;
    box-shadow:0 0 18px rgba(34,211,238,.28); transition:width .22s ease;
  }}
  .top-bar::after {{
    content:""; position:absolute; left:0; right:0; bottom:-1px; height:1px;
    background:var(--gradient-hot); background-size:220% 220%; animation:gradientShift 12s ease infinite;
  }}
  .top-bar h1 {{
    margin:0; font-size:22px; line-height:1.2; font-weight:800;
    background:var(--gradient-hot); background-size:180% 180%;
    -webkit-background-clip:text; background-clip:text; color:transparent;
  }}
  .top-meta {{ display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; font-family:var(--mono); }}
  .top-actions {{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }}
  .dashboard-search {{
    min-height:32px; width:min(240px, 42vw); padding:0 10px; border-radius:8px;
    border:1px solid var(--border); background:rgba(255,255,255,.055); color:var(--text);
    font-size:12px; outline:none;
  }}
  .dashboard-search::placeholder {{ color:var(--muted); }}
  .dashboard-search:focus {{ border-color:rgba(34,211,238,.55); box-shadow:0 0 0 3px rgba(34,211,238,.10); }}
  .status-strip {{
    display:flex; flex-wrap:wrap; align-items:center; gap:8px;
    padding:8px 32px 0; color:var(--muted); font-size:11px;
  }}
  .status-chip {{
    display:inline-flex; align-items:center; gap:6px; min-height:26px; padding:0 10px;
    border:1px solid var(--border); border-radius:999px; background:rgba(255,255,255,.055);
    color:var(--text-soft); font-weight:800;
  }}
  .status-chip i {{ width:13px; height:13px; color:var(--success); }}
  .data-health {{ margin:8px 32px 0; }}
  .data-health summary {{
    display:inline-flex; align-items:center; min-height:32px; cursor:pointer; color:var(--text-soft);
    font-size:11px; font-weight:800; list-style:none;
  }}
  .data-health summary::-webkit-details-marker {{ display:none; }}
  .data-health summary::before {{ content:"+"; display:inline-grid; place-items:center; width:18px; height:18px; margin-right:7px; border:1px solid var(--border); border-radius:50%; color:var(--info); }}
  .data-health[open] summary::before {{ content:"−"; }}
  .quality-strip {{
    display:grid; grid-template-columns:repeat(5,minmax(150px,1fr)); gap:10px;
    padding:12px 32px 0;
  }}
  .quality-card {{
    border:1px solid var(--border); border-radius:8px; padding:10px 12px;
    background:rgba(255,255,255,.045); color:var(--text-soft); font-size:12px;
  }}
  .quality-card strong {{ display:block; color:var(--text); font-size:13px; margin-bottom:3px; }}
  .quality-card.warn {{ border-color:rgba(245,165,36,.42); background:rgba(245,165,36,.08); }}
  .badge-pill {{
    display:inline-flex; align-items:center; min-height:26px; padding:0 10px; border-radius:999px;
    color:#A7F3D0; background:rgba(45, 212, 191, .12); border:1px solid rgba(45, 212, 191, .32);
    font-size:11px; font-weight:800;
    box-shadow:0 0 18px rgba(45,212,191,.10);
  }}
  .mode-toggle {{
    min-height:32px; display:inline-flex; align-items:center; gap:7px; padding:0 11px;
    border:1px solid var(--border-strong); border-radius:8px; color:var(--text);
    background:linear-gradient(135deg, rgba(79,140,255,.18), rgba(255,255,255,.055));
    font-size:12px; font-weight:800; cursor:pointer;
    transition:background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
  }}
  .mode-toggle:hover {{ background:rgba(79,140,255,.18); border-color:rgba(79,140,255,.55); transform:translateY(-1px); box-shadow:0 10px 28px rgba(79,140,255,.16); }}
  .mode-toggle i {{ width:15px; height:15px; }}
  .action-button {{
    min-height:32px; display:inline-flex; align-items:center; gap:7px; padding:0 10px;
    border:1px solid var(--border); border-radius:8px; color:var(--text-soft);
    background:rgba(255,255,255,.045); font-size:12px; font-weight:800; cursor:pointer;
    transition:background .16s var(--ease), border-color .16s var(--ease), transform .16s var(--ease);
  }}
  .action-button:hover {{ transform:translateY(-1px); border-color:rgba(34,211,238,.42); background:rgba(34,211,238,.08); }}
  .action-button i {{ width:15px; height:15px; }}
  .menu-button {{ display:none; }}
  .export-button {{ margin:0 0 8px; }}
  a:focus-visible, button:focus-visible, input:focus-visible {{
    outline:2px solid rgba(34,211,238,.85); outline-offset:2px;
  }}

  .kpi-row {{ display:grid; grid-template-columns:repeat(4,minmax(170px,1fr)); gap:14px; padding:22px 32px 0; }}
  .kpi-card, .story-card, .decision-panel, .chart-card, .conclusion-card,
  .priority-card, .evidence-card {{
    position:relative; overflow:hidden;
    background:linear-gradient(145deg, rgba(255,255,255,.085), rgba(255,255,255,.035)), var(--panel);
    border:1px solid var(--border); box-shadow:var(--shadow-soft);
    backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur);
  }}
  .kpi-card::after, .story-card::after, .chart-card::after, .conclusion-card::after,
  .priority-card::after, .evidence-card::after {{
    content:""; position:absolute; inset:0; pointer-events:none; opacity:0;
    background:radial-gradient(circle at 22% 0%, rgba(79,140,255,.22), transparent 18rem);
    transition:opacity .22s ease;
  }}
  .kpi-card {{
    min-width:0; border-radius:8px; padding:15px 16px 14px;
    transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
  }}
  .chart-card:hover {{
    transform:translateY(-3px); box-shadow:var(--shadow-hover); border-color:rgba(79,140,255,.52);
  }}
  .chart-card:hover::after {{ opacity:1; }}
  .kpi-card::before {{
    content:""; display:block; width:34px; height:3px; border-radius:999px;
    background:var(--gradient-hot); margin-bottom:11px; box-shadow:0 0 18px rgba(79,140,255,.34);
  }}
  .kpi-card.green::before {{ background:var(--success); }}
  .kpi-card.orange::before {{ background:var(--accent); }}
  .kpi-card.purple::before {{ background:var(--info); }}
  .kpi-label {{ font-size:11px; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.04em; }}
  .kpi-value {{ margin-top:5px; color:var(--text); font-family:var(--mono); font-size:26px; font-weight:800; line-height:1.08; }}
  .kpi-sub {{ margin-top:6px; color:var(--muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}

  .section {{ display:none; padding:22px 32px 42px; }}
  .section.active {{ display:block; animation:fadeLift .28s ease both; }}
  .section-title {{ margin-bottom:4px; color:var(--text); font-size:19px; font-weight:800; }}
  .section-title::after {{
    content:""; display:block; width:46px; height:3px; margin-top:8px; border-radius:999px;
    background:var(--gradient-hot); box-shadow:0 0 20px rgba(34,211,238,.20);
  }}
  .section-desc {{ max-width:920px; margin-bottom:15px; color:var(--muted); font-size:14px; }}
  .story-strip {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; padding:14px 32px 0; }}
  .story-card {{ border-radius:8px; padding:14px 15px; min-width:0; position:relative; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }}
  .story-card::before {{ content:""; position:absolute; left:0; top:14px; bottom:14px; width:3px; background:var(--primary); border-radius:0 3px 3px 0; }}
  .story-card.coverage::before {{ background:var(--accent); }}
  .story-card.quality::before {{ background:var(--danger); }}
  .story-card h2 {{ margin:0 0 7px; color:var(--text); font-size:13px; font-weight:800; }}
  .story-card p {{ margin:0; color:var(--muted); font-size:12px; line-height:1.55; }}

  .decision-panel {{
    margin:18px 32px 0; display:grid; grid-template-columns:minmax(260px,1.15fr) repeat(3,minmax(160px,1fr));
    border-radius:8px; overflow:hidden;
  }}
  .decision-panel::before {{
    content:""; position:absolute; top:0; left:0; right:0; height:1px;
    background:var(--gradient-hot); opacity:.72;
  }}
  .decision-lead {{ padding:18px; border-right:1px solid var(--border); background:var(--gradient-warm); }}
  .decision-label {{ margin-bottom:7px; color:var(--info); font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:800; }}
  .decision-lead h2 {{ margin:0; color:var(--text); font-size:20px; line-height:1.2; font-weight:800; }}
  .decision-lead p, .decision-item span {{ color:var(--muted); font-size:12px; line-height:1.5; }}
  .decision-lead p {{ margin:9px 0 0; }}
  .decision-item {{ padding:17px 16px; border-right:1px solid var(--border); }}
  .decision-item:last-child {{ border-right:0; }}
  .decision-item strong {{ display:block; margin-bottom:7px; color:var(--text); font-size:13px; }}

  .scope-row {{ margin:12px 32px 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:11px; }}
  .scope-chip {{
    display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:0 10px;
    border:1px solid var(--border); border-radius:999px; background:rgba(255,255,255,.055);
    color:var(--text-soft); font-weight:800;
  }}
  .scope-chip i {{ width:13px; height:13px; color:var(--info); }}
  .command-rail {{
    margin:12px 32px 0; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;
  }}
  .command-tile {{
    position:relative; min-height:72px; padding:11px 12px 10px 14px; border:1px solid var(--border);
    border-radius:8px; background:linear-gradient(145deg, rgba(15,23,42,.78), rgba(255,255,255,.035));
    color:var(--text-soft); overflow:hidden;
  }}
  .command-tile::before {{
    content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--info);
  }}
  .command-tile.warn::before {{ background:var(--accent); }}
  .command-tile.risk::before {{ background:var(--danger); }}
  .command-tile strong {{
    display:block; margin-bottom:4px; color:var(--text); font-size:12px; text-transform:uppercase; letter-spacing:.05em;
  }}
  .command-tile span {{ display:block; color:var(--muted); font-size:12px; line-height:1.35; }}
  .section-takeaway {{
    display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:-2px 0 15px; padding:10px 12px;
    color:var(--text-soft); font-size:13px; line-height:1.45; border-radius:8px;
    background:rgba(245,165,36,.08); border:1px solid var(--border); border-left:3px solid var(--accent);
  }}
  .section-takeaway strong {{ color:var(--text); }}
  .evidence-badge {{
    display:inline-flex; align-items:center; white-space:nowrap; padding:3px 8px; border-radius:999px;
    background:rgba(79,140,255,.16); color:#AFCBFF; border:1px solid rgba(79,140,255,.42);
    font-size:11px; font-weight:800;
  }}
  .evidence-badge.orange {{ background:rgba(245,165,36,.15); color:#FBD38D; border-color:rgba(245,165,36,.45); }}
  .evidence-badge.green {{ background:rgba(45,212,191,.14); color:#99F6E4; border-color:rgba(45,212,191,.42); }}
  .evidence-badge.red {{ background:rgba(251,113,133,.14); color:#FDA4AF; border-color:rgba(251,113,133,.45); }}

  .chart-grid {{ display:grid; gap:14px; align-items:start; }}
  .chart-grid.cols-2 {{ grid-template-columns:1fr 1fr; }}
  .chart-grid.cols-3 {{ grid-template-columns:1fr 1fr 1fr; }}
  .chart-card {{ min-width:0; border-radius:8px; padding:14px; transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease; }}
  .chart-card::before {{
    content:""; position:absolute; top:0; left:14px; right:14px; height:1px;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,.36), transparent);
    opacity:.54;
  }}
  .chart-card.full {{ grid-column:1/-1; }}
  .js-plotly-plot, .plot-container {{ min-height:360px; }}
  .chart-caption {{
    margin-top:9px; padding:9px 10px; border:1px solid var(--border); border-radius:8px;
    color:var(--muted); background:rgba(255,255,255,.04); font-size:12px; line-height:1.45;
  }}
  .chart-caption strong {{ color:var(--text); }}
  .chart-caption .caption-row {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
  .caption-pill {{
    display:inline-flex; align-items:center; padding:2px 7px; border-radius:999px;
    border:1px solid var(--border); color:var(--text-soft); font-size:10px; font-weight:800;
  }}
  .chart-story {{
    margin-top:10px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;
  }}
  .story-step {{
    border:1px solid var(--border); border-radius:8px; padding:9px 10px;
    background:rgba(255,255,255,.045); color:var(--text-soft); font-size:12px; line-height:1.45;
  }}
  .story-step strong {{
    display:block; margin-bottom:4px; color:var(--text); font-size:11px; text-transform:uppercase; letter-spacing:.04em;
  }}
  .story-step.action {{ border-color:rgba(45,212,191,.30); background:rgba(45,212,191,.075); }}

  .context-box, .chart-explain {{
    border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,.055);
    color:var(--text-soft); font-size:12px; line-height:1.55;
  }}
  .context-box {{ margin-bottom:14px; padding:12px 14px; border-left:3px solid var(--primary); font-size:13px; }}
  .chart-explain {{ margin-top:10px; padding:10px 12px; }}
  .chart-explain .ex-title {{
    display:flex; align-items:center; gap:7px; margin-bottom:4px; color:var(--text); font-size:12px; font-weight:800;
  }}
  .chart-explain .ex-title::before {{ content:""; display:inline-block; width:6px; height:6px; border-radius:999px; background:var(--info); flex-shrink:0; }}
  .chart-explain .ex-insight {{
    margin-top:7px; padding:7px 9px; border-radius:6px; border-left:2px solid var(--info);
    background:rgba(34,211,238,.10); color:#CFFAFE; font-size:12px; font-weight:700;
  }}
  .ex-body {{ margin-top:8px; color:var(--muted); }}
  .learn-toggle {{
    margin-top:8px; display:inline-flex; align-items:center; gap:6px; padding:5px 9px;
    border:1px solid var(--border-strong); border-radius:8px; background:rgba(255,255,255,.06);
    color:var(--text); font-size:12px; font-weight:800; cursor:pointer;
    transition:background .16s ease, border-color .16s ease, transform .16s ease;
  }}
  .learn-toggle:hover {{ background:rgba(79,140,255,.16); border-color:rgba(79,140,255,.48); transform:translateY(-1px); }}
  .learn-toggle i {{ width:14px; height:14px; transition:transform .16s ease; }}
  .chart-explain.open .learn-toggle i {{ transform:rotate(180deg); }}
  .chart-explain.collapsed .ex-body {{ display:none; }}

  .model-legend {{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }}
  .model-pill {{ padding:4px 12px; border-radius:999px; color:#fff; background:var(--primary); font-size:11px; font-weight:800; }}
  .model-pill.lt {{ background:var(--accent); }}
  .model-pill.lin {{ background:var(--success); color:#062821; }}
  .model-pill.td {{ background:var(--violet); }}

  .dash-table {{ width:100%; border-collapse:separate; border-spacing:0; color:var(--text-soft); font-size:13px; }}
  .dash-table caption {{
    caption-side:top; padding:9px 12px; text-align:left; color:var(--muted); background:rgba(255,255,255,.035);
    border-bottom:1px solid var(--border); font-size:11px; line-height:1.4;
  }}
  .dash-table th {{
    position:sticky; top:0; z-index:1; padding:9px 12px; text-align:left; white-space:nowrap;
    color:var(--text); background:rgba(15, 23, 42, .96); border-bottom:1px solid var(--border);
    font-weight:800;
  }}
  .dash-table th[data-sort] {{ cursor:pointer; user-select:none; }}
  .dash-table th[data-sort]:focus-visible {{ outline:2px solid rgba(34,211,238,.85); outline-offset:-2px; }}
  .dash-table th[data-sort]::after {{ content:""; opacity:.55; margin-left:6px; font-size:10px; }}
  .dash-table th.sort-asc::after {{ content:"^"; }}
  .dash-table th.sort-desc::after {{ content:"v"; }}
  .dash-table td {{ padding:9px 12px; border-bottom:1px solid rgba(148,163,184,.13); vertical-align:top; }}
  .dash-table tr:nth-child(even) {{ background:rgba(255,255,255,.025); }}
  .dash-table tr:hover {{ background:rgba(79,140,255,.08); }}
  .green-text {{ color:#7DD3FC; font-weight:800; }}
  .red-text {{ color:var(--danger); font-weight:800; }}
  .badge-ch {{ background:rgba(255,255,255,.07); color:var(--text-soft); padding:3px 7px; border-radius:6px; font-size:11px; font-weight:800; }}
  .table-wrap {{ overflow:auto; border:1px solid var(--border); border-radius:8px; }}
  .low-sample {{ color:var(--accent); font-weight:800; }}
  .table-empty {{ padding:18px; color:var(--muted); text-align:center; border:1px dashed var(--border); border-radius:8px; }}
  .metric-lens {{
    display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:0 32px 12px;
    color:var(--muted); font-size:11px;
  }}
  .lens-button {{
    min-height:26px; padding:0 9px; border-radius:999px; border:1px solid var(--border);
    color:var(--text-soft); background:rgba(255,255,255,.045); font-size:11px; font-weight:800; cursor:pointer;
  }}
  .lens-button.active {{ background:rgba(79,140,255,.16); border-color:rgba(79,140,255,.42); color:var(--text); }}
  .chart-empty {{
    min-height:260px; display:flex; align-items:center; justify-content:center; text-align:center;
    border:1px dashed var(--border-strong); border-radius:8px; color:var(--muted);
    background:rgba(255,255,255,.035); padding:24px;
  }}
  .chart-empty strong {{ display:block; color:var(--text); margin-bottom:4px; }}

  .conclusion-grid, .priority-grid, .evidence-grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }}
  .conclusion-card, .priority-card, .evidence-card {{ border-radius:8px; padding:15px; min-width:0; transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease; }}
  .conclusion-card h3, .priority-card h3, .evidence-card h3 {{
    display:flex; align-items:center; gap:8px; margin:0 0 9px; color:var(--text); font-size:13px; font-weight:800;
  }}
  .priority-card p, .evidence-card p {{ margin:0; color:var(--muted); font-size:12px; line-height:1.55; }}
  .finding-list, .diagnosis-list {{ margin:0; padding-left:18px; color:var(--text-soft); font-size:12px; line-height:1.7; }}
  .finding-list li, .diagnosis-list li {{ margin-bottom:6px; }}
  .priority-tag, .confidence-pill {{
    display:inline-flex; align-items:center; justify-content:center; border:1px solid transparent;
    border-radius:999px; font-size:11px; font-weight:800;
  }}
  .priority-tag {{ min-width:34px; padding:3px 8px; background:rgba(79,140,255,.16); color:#BFD5FF; }}
  .priority-tag.p1 {{ background:rgba(251,113,133,.15); color:#FDA4AF; border-color:rgba(251,113,133,.35); }}
  .priority-tag.p2 {{ background:rgba(245,165,36,.15); color:#FBD38D; border-color:rgba(245,165,36,.35); }}
  .priority-tag.p3 {{ background:rgba(45,212,191,.14); color:#99F6E4; border-color:rgba(45,212,191,.34); }}
  .recommendation-table th {{ font-size:12px; }}
  .recommendation-table td, .confidence-table td {{ line-height:1.45; padding-top:9px; padding-bottom:9px; }}
  .conclusion-hero {{
    margin-bottom:16px; padding:18px 20px; border-radius:8px; color:#FFFFFF;
    background:var(--gradient-warm);
    border:1px solid var(--border-strong); box-shadow:var(--shadow-soft);
  }}
  .conclusion-hero .eyebrow {{ margin-bottom:7px; color:#BFD5FF; font-size:11px; text-transform:uppercase; letter-spacing:.08em; font-weight:800; }}
  .conclusion-hero h3 {{ margin:0 0 8px; font-size:20px; line-height:1.25; }}
  .conclusion-hero p {{ margin:0; max-width:980px; color:var(--text-soft); line-height:1.55; font-size:13px; }}
  .confidence-pill {{ min-width:74px; padding:3px 8px; }}
  .confidence-pill.high {{ background:rgba(45,212,191,.14); color:#99F6E4; border-color:rgba(45,212,191,.34); }}
  .confidence-pill.medium {{ background:rgba(245,165,36,.15); color:#FBD38D; border-color:rgba(245,165,36,.35); }}
  .confidence-pill.directional {{ background:rgba(79,140,255,.16); color:#BFD5FF; border-color:rgba(79,140,255,.36); }}
  .next-step-row {{ display:grid; grid-template-columns:160px 1fr; gap:12px; align-items:start; padding:10px 0; border-bottom:1px solid var(--border); font-size:12px; }}
  .next-step-row:last-child {{ border-bottom:0; }}
  .next-step-row strong {{ color:var(--text); }}
  .drawer-backdrop {{
    position:fixed; inset:0; background:rgba(2,6,23,.55); opacity:0; pointer-events:none;
    transition:opacity .18s ease; z-index:180;
  }}
  .caveats-drawer {{
    position:fixed; top:0; right:0; width:min(460px,92vw); height:100vh; z-index:190;
    transform:translateX(105%); transition:transform .22s ease; overflow:auto;
    background:rgba(10,15,26,.94); border-left:1px solid var(--border); color:var(--text-soft);
    backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur);
    padding:22px; box-shadow:-24px 0 60px rgba(0,0,0,.34);
  }}
  body.drawer-open .drawer-backdrop {{ opacity:1; pointer-events:auto; }}
  body.drawer-open .caveats-drawer {{ transform:translateX(0); }}
  .drawer-head {{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }}
  .drawer-head h2 {{ margin:0; color:var(--text); font-size:18px; }}
  .caveats-drawer ul {{ margin:0; padding-left:18px; }}
  .caveats-drawer li {{ margin-bottom:10px; line-height:1.55; }}
  body.presentation-mode .chart-explain .ex-body,
  body.presentation-mode .chart-explain .learn-toggle,
  body.presentation-mode .scope-row,
  body.presentation-mode .story-strip {{ display:none; }}
  body.presentation-mode .section {{ padding-top:18px; }}
  body.presentation-mode .chart-card {{ box-shadow:none; }}
  body.presentation-mode .decision-panel {{ margin-bottom:4px; }}
  body.presentation-mode .section-title {{ font-size:21px; }}
  body.presentation-mode .chart-grid {{ gap:18px; }}
  body.presentation-mode .dash-table {{ font-size:12px; }}
  body.presentation-mode .top-bar {{ position:sticky; }}

  @media (prefers-reduced-motion: reduce) {{
    *, *::before, *::after {{
      animation-duration:.001ms !important;
      animation-iteration-count:1 !important;
      scroll-behavior:auto !important;
      transition-duration:.001ms !important;
    }}
  }}

  @media(max-width:900px){{
    #sidebar {{ width:248px; transform:translateX(-104%); transition:transform .22s ease; z-index:170; }}
    body.sidebar-open #sidebar {{ transform:translateX(0); }}
    .menu-button {{ display:inline-flex; }}
    #main {{ margin-left:0; }}
    .top-bar {{ position:static; align-items:flex-start; gap:8px; flex-direction:column; padding:14px 18px; }}
    .top-meta,.top-actions,.status-strip {{ flex-wrap:wrap; gap:8px; justify-content:flex-start; }}
    #nav-progress {{ left:0; }}
    .section,.kpi-row,.story-strip,.status-strip,.quality-strip {{ padding-left:18px; padding-right:18px; }}
    .data-health {{ margin-left:18px; margin-right:18px; }}
    .quality-strip {{ grid-template-columns:1fr; }}
    .decision-panel,.scope-row {{ margin-left:18px; margin-right:18px; }}
    .chart-grid.cols-2,.chart-grid.cols-3,.kpi-row,.story-strip,.decision-panel,.chart-story,
    .conclusion-grid,.priority-grid,.evidence-grid,.command-rail {{ grid-template-columns:1fr; }}
    .command-rail {{ margin-left:18px; margin-right:18px; }}
    .decision-lead,.decision-item {{ border-right:0; border-bottom:1px solid var(--border); }}
    .decision-item:last-child {{ border-bottom:0; }}
    .next-step-row {{ grid-template-columns:1fr; gap:4px; }}
    .action-button,.mode-toggle,.dashboard-search {{ min-height:44px; }}
    .lens-button {{ min-height:44px; padding-left:14px; padding-right:14px; }}
    .dashboard-search {{ width:100%; font-size:16px; }}
    .top-actions {{ width:100%; }}
    .js-plotly-plot,.plot-container {{ min-height:280px; }}
    .table-wrap {{ max-width:100%; -webkit-overflow-scrolling:touch; }}
  }}
  @media(max-width:520px){{
    .top-actions {{
      display:grid; grid-template-columns:repeat(2, minmax(0, 1fr));
      align-items:stretch; width:100%;
    }}
    .top-meta,.dashboard-search {{ grid-column:1 / -1; min-width:0; }}
    .top-meta span {{ min-width:0; white-space:normal; overflow-wrap:anywhere; line-height:1.45; }}
    .badge-pill {{ justify-self:start; }}
    .top-actions .action-button,.top-actions .mode-toggle {{ width:100%; justify-content:center; min-width:0; }}
    .top-actions .mode-toggle {{ grid-column:1 / -1; }}
    .status-strip {{ flex-direction:column; align-items:stretch; }}
    .status-chip {{ width:100%; white-space:normal; line-height:1.3; }}
  }}
  @media print {{
    #sidebar,.top-actions,.status-strip,.scope-row,.chart-explain .learn-toggle,#nav-progress,.drawer-backdrop,.caveats-drawer {{ display:none !important; }}
    #main {{ margin-left:0; }}
    body {{ background:#fff; color:#111827; display:block; }}
    .top-bar {{ position:static; background:#fff; color:#111827; border-bottom:1px solid #CBD5E1; }}
    .section {{ display:block !important; page-break-before:always; }}
    .section:first-of-type {{ page-break-before:auto; }}
    .chart-card,.kpi-card,.decision-panel,.quality-card {{ box-shadow:none; background:#fff; border-color:#CBD5E1; }}
  }}

  /* Editorial operator-console refresh: warm canvas, ink typography, restrained accents. */
  :root {{
    --bg:#F4F6FA; --bg-2:#EAF0F7; --panel:#FFFFFF; --panel-strong:#FFFFFF; --panel-soft:#F8FAFC;
    --border:#D6DFEA; --border-strong:#B7C6D8; --text:#152238; --text-soft:#46566D;
    --muted:#5B6B82; --muted-2:#8B98AA; --primary:#1E40AF; --primary-dark:#17358F;
    --info:#3B82F6; --accent:#D97706; --accent-strong:#9A5A00; --success:#0F766E; --danger:#B42318; --violet:#6D4AFF;
    --gradient-hot:linear-gradient(90deg, #1E40AF, #3B82F6); --gradient-warm:#EDF3FF;
    --shadow-soft:0 8px 24px rgba(21,34,56,.07); --shadow-hover:0 12px 28px rgba(21,34,56,.12);
    --glass-blur:none; --mono:'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
    --ease:cubic-bezier(.2,.8,.2,1);
  }}
  body {{
    color:var(--text); font-family:'Segoe UI',Arial,sans-serif; background:var(--bg);
    letter-spacing:-.01em;
  }}
  body::before, body::after {{ display:none; }}
  #sidebar {{
    width:236px; background:#12233F; border-right:0; box-shadow:8px 0 24px rgba(18,35,63,.08);
    backdrop-filter:none; -webkit-backdrop-filter:none;
  }}
  .sidebar-brand {{
    padding:24px 22px 20px; color:#FFFFFF; background:#12233F; border-bottom:1px solid rgba(255,255,255,.14);
    font-family:Georgia,'Times New Roman',serif; font-size:17px; letter-spacing:-.02em;
  }}
  .sidebar-brand small {{ color:#B8C6DA; font-family:'Segoe UI',Arial,sans-serif; font-size:10px; letter-spacing:.02em; }}
  .nav-link {{ margin:5px 14px; padding:11px 12px; color:#B8C6DA; border-radius:7px; font-size:12px; }}
  .nav-link:hover {{ color:#FFFFFF; background:rgba(255,255,255,.10); transform:none; }}
  .nav-link.active {{
    color:#FFFFFF; background:#1E3A63; box-shadow:inset 3px 0 0 #F5B544; transform:none;
  }}
  #main {{ margin-left:236px; background:var(--bg); }}
  .top-bar {{
    min-height:72px; padding:15px 32px; background:rgba(255,255,255,.96); border-bottom:1px solid var(--border);
    box-shadow:0 2px 14px rgba(21,34,56,.05); backdrop-filter:none; -webkit-backdrop-filter:none;
  }}
  .top-bar::after {{ height:2px; background:#F5B544; animation:none; }}
  .top-bar h1 {{
    color:var(--text); background:none; -webkit-background-clip:initial; background-clip:initial;
    font-family:Georgia,'Times New Roman',serif; font-size:24px; letter-spacing:-.03em;
  }}
  .top-meta {{ color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:11px; }}
  .dashboard-search {{ border-color:var(--border); background:#FFFFFF; color:var(--text); border-radius:7px; }}
  .dashboard-search:focus {{ border-color:var(--primary); box-shadow:0 0 0 3px rgba(30,64,175,.12); }}
  .status-strip {{ padding-top:10px; }}
  .status-chip {{ border-color:var(--border); border-radius:6px; background:#FFFFFF; color:var(--text-soft); }}
  .status-chip i {{ color:var(--success); }}
  .data-health summary {{ color:var(--text-soft); }}
  .data-health summary::before {{ border-color:var(--border-strong); color:var(--primary); border-radius:5px; }}
  .quality-card {{ border-color:var(--border); border-radius:8px; background:#FFFFFF; color:var(--text-soft); }}
  .quality-card strong {{ color:var(--text); }}
  .quality-card.warn {{ border-color:#F1C27D; background:#FFF8EB; }}
  .badge-pill {{ color:#0F766E; background:#E8F5F2; border-color:#A9D5CC; box-shadow:none; border-radius:6px; }}
  .mode-toggle {{ color:var(--primary); border-color:#B9C9E4; background:#EDF3FF; border-radius:7px; }}
  .mode-toggle:hover {{ background:#E1EBFF; border-color:var(--primary); transform:none; box-shadow:none; }}
  .action-button {{ color:var(--text-soft); border-color:var(--border); background:#FFFFFF; border-radius:7px; }}
  .action-button:hover {{ transform:none; border-color:#8DA9D2; background:#F5F8FD; }}
  a:focus-visible, button:focus-visible, input:focus-visible {{ outline-color:var(--primary); }}

  .kpi-card, .story-card, .decision-panel, .chart-card, .conclusion-card, .priority-card, .evidence-card {{
    background:var(--panel); border-color:var(--border); box-shadow:var(--shadow-soft); backdrop-filter:none; -webkit-backdrop-filter:none;
  }}
  .kpi-card::after, .story-card::after, .chart-card::after, .conclusion-card::after, .priority-card::after, .evidence-card::after {{ display:none; }}
  .kpi-card {{ border-radius:10px; padding:17px 18px 16px; }}
  .kpi-card::before {{ width:30px; height:4px; border-radius:2px; background:var(--primary); box-shadow:none; }}
  .kpi-card.green::before {{ background:var(--success); }}
  .kpi-card.orange::before {{ background:var(--accent); }}
  .kpi-card.purple::before {{ background:var(--violet); }}
  .kpi-label {{ color:var(--muted); font-size:10px; letter-spacing:.08em; }}
  .kpi-value {{ color:var(--text); font-size:27px; }}
  .kpi-sub {{ color:var(--muted); }}
  .section-title {{ color:var(--text); font-family:Georgia,'Times New Roman',serif; font-size:21px; letter-spacing:-.02em; }}
  .section-title::after {{ width:36px; height:3px; margin-top:9px; background:#F5B544; box-shadow:none; }}
  .section-desc {{ color:var(--muted); }}
  .story-card {{ border-radius:10px; padding:15px 16px; }}
  .story-card::before {{ background:var(--primary); }}
  .story-card.coverage::before {{ background:var(--accent); }}
  .story-card.quality::before {{ background:var(--danger); }}
  .story-card h2 {{ color:var(--text); }}
  .story-card p {{ color:var(--muted); }}
  .decision-panel {{ border-radius:10px; }}
  .decision-panel::before {{ background:#F5B544; opacity:1; }}
  .decision-lead {{ background:#EDF3FF; border-right-color:var(--border); border-left:4px solid var(--primary); }}
  .decision-label {{ color:var(--primary); }}
  .decision-lead h2 {{ color:var(--text); font-family:Georgia,'Times New Roman',serif; letter-spacing:-.02em; }}
  i[data-lucide] {{ display:none; }}
  .decision-lead p, .decision-item span {{ color:var(--muted); }}
  .decision-item {{ border-right-color:var(--border); }}
  .decision-item strong {{ color:var(--text); }}
  .scope-chip {{ border-color:var(--border); border-radius:6px; background:#FFFFFF; color:var(--text-soft); }}
  .scope-chip i {{ color:var(--primary); }}
  .command-tile {{ border-color:var(--border); border-radius:8px; background:#FFFFFF; }}
  .command-tile span {{ color:var(--muted); }}
  .command-tile strong {{ color:var(--text); }}
  .command-tile::before {{ background:var(--primary); }}
  .command-tile.warn::before {{ background:var(--accent); }}
  .command-tile.risk::before {{ background:var(--danger); }}
  .section-takeaway {{ color:var(--text-soft); background:#FFF8EB; border-color:#F1D5A5; border-left-color:var(--accent); }}
  .section-takeaway strong {{ color:var(--text); }}
  .evidence-badge {{ background:#EDF3FF; color:var(--primary); border-color:#B9C9E4; border-radius:6px; }}
  .evidence-badge.orange {{ background:#FFF3DF; color:#9A5A00; border-color:#F1C27D; }}
  .evidence-badge.green {{ background:#E8F5F2; color:#0F766E; border-color:#A9D5CC; }}
  .evidence-badge.red {{ background:#FDEDEC; color:#B42318; border-color:#F0B7B0; }}
  .chart-card {{ border-radius:10px; padding:17px; }}
  .chart-card:hover {{ transform:none; box-shadow:var(--shadow-hover); border-color:#8DA9D2; }}
  .chart-card::before {{ background:#DCE5F1; opacity:1; }}
  .chart-caption {{ border-color:var(--border); border-radius:7px; background:#F8FAFC; color:var(--muted); }}
  .chart-caption strong {{ color:var(--text); }}
  .caption-pill {{ border-color:var(--border-strong); color:var(--primary); border-radius:5px; }}
  .story-step {{ border-color:var(--border); border-radius:7px; background:#F8FAFC; color:var(--text-soft); }}
  .story-step strong {{ color:var(--text); }}
  .story-step.action {{ border-color:#A9D5CC; background:#EDF8F5; }}
  .context-box, .chart-explain {{ border-color:var(--border); border-radius:8px; background:#F8FAFC; color:var(--text-soft); }}
  .context-box {{ border-left-color:var(--primary); }}
  .chart-explain .ex-title {{ color:var(--text); }}
  .chart-explain .ex-title::before {{ background:var(--accent); }}
  .chart-explain .ex-insight {{ border-left-color:var(--primary); background:#EDF3FF; color:#23427A; }}
  .ex-body {{ color:var(--muted); }}
  .learn-toggle {{ border-color:var(--border-strong); background:#FFFFFF; color:var(--primary); border-radius:6px; }}
  .learn-toggle:hover {{ background:#EDF3FF; border-color:#8DA9D2; transform:none; }}
  .dash-table {{ color:var(--text-soft); }}
  .dash-table caption {{ color:var(--muted); background:#F8FAFC; border-bottom-color:var(--border); }}
  .dash-table th {{ color:var(--text); background:#EEF3F9; border-bottom-color:var(--border); }}
  .dash-table td {{ border-bottom-color:#E6EBF2; }}
  .dash-table tr:nth-child(even) {{ background:#FAFBFD; }}
  .dash-table tr:hover {{ background:#EDF3FF; }}
  .green-text {{ color:var(--success); }}
  .red-text {{ color:var(--danger); }}
  .badge-ch {{ background:#F1F4F8; color:var(--text-soft); }}
  .table-wrap {{ border-color:var(--border); border-radius:8px; }}
  .metric-lens {{ color:var(--muted); }}
  .lens-button {{ border-color:var(--border); color:var(--text-soft); background:#FFFFFF; border-radius:6px; }}
  .lens-button.active {{ background:#EDF3FF; border-color:#8DA9D2; color:var(--primary); }}
  .chart-empty {{ border-color:var(--border-strong); background:#F8FAFC; color:var(--muted); }}
  .chart-empty strong {{ color:var(--text); }}
  .conclusion-card, .priority-card, .evidence-card {{ border-radius:10px; }}
  .conclusion-card h3, .priority-card h3, .evidence-card h3 {{ color:var(--text); }}
  .priority-card p, .evidence-card p {{ color:var(--muted); }}
  .finding-list, .diagnosis-list {{ color:var(--text-soft); }}
  .priority-tag {{ background:#EDF3FF; color:var(--primary); border-color:#B9C9E4; border-radius:5px; }}
  .priority-tag.p1 {{ background:#FDEDEC; color:var(--danger); border-color:#F0B7B0; }}
  .priority-tag.p2 {{ background:#FFF3DF; color:#9A5A00; border-color:#F1C27D; }}
  .priority-tag.p3 {{ background:#E8F5F2; color:var(--success); border-color:#A9D5CC; }}
  .conclusion-hero {{ color:#FFFFFF; background:#17335C; border-color:#17335C; box-shadow:var(--shadow-soft); border-radius:10px; }}
  .conclusion-hero .eyebrow {{ color:#F5C76B; }}
  .conclusion-hero p {{ color:#DDE7F4; }}
  .confidence-pill.high {{ background:#E8F5F2; color:var(--success); border-color:#A9D5CC; }}
  .confidence-pill.medium {{ background:#FFF3DF; color:#9A5A00; border-color:#F1C27D; }}
  .confidence-pill.directional {{ background:#EDF3FF; color:var(--primary); border-color:#B9C9E4; }}
  .model-pill.lt {{ background:var(--accent-strong); }}
  .low-sample {{ color:var(--accent-strong); }}
  .next-step-row {{ border-bottom-color:var(--border); }}
  .next-step-row strong {{ color:var(--text); }}
  .drawer-backdrop {{ background:rgba(21,34,56,.42); }}
  .caveats-drawer {{ background:#FFFFFF; border-left-color:var(--border); color:var(--text-soft); backdrop-filter:none; -webkit-backdrop-filter:none; box-shadow:-18px 0 42px rgba(21,34,56,.16); }}
  .drawer-head h2, .caveats-drawer strong {{ color:var(--text); }}
  #nav-progress {{ left:236px; background:#E6ECF5; }}
  #nav-progress span {{ background:#1E40AF; box-shadow:none; }}

  @media(max-width:900px){{
    #main {{ margin-left:0; }}
    #nav-progress {{ left:0; }}
    .top-bar {{ background:#FFFFFF; }}
  }}
  @media(max-width:520px){{
    .top-bar h1 {{ font-size:21px; }}
    .section {{ padding-left:18px; padding-right:18px; }}
  }}
</style>
</head>
<body>
<a class="skip-nav" href="#main">Skip to dashboard</a>
<div id="nav-progress" aria-hidden="true"><span></span></div>

<!-- Sidebar -->
<nav id="sidebar" aria-label="Dashboard sections">
  <div class="sidebar-brand">
    Marketing Analytics
    <small>B2B SaaS &nbsp;|&nbsp; {data_year_range}</small>
  </div>
  <ul class="nav flex-column mt-2" id="navMenu">
    <li class="nav-item"><a href="#s-essential" class="nav-link active" aria-current="page" aria-label="Essential View" data-section="s-essential" onclick="showSection(this,'s-essential'); return false;"><i class="nav-icon" data-lucide="sparkles" aria-hidden="true"></i><span>Essential View</span></a></li>
    <li class="nav-item"><a href="#s-attrib" class="nav-link" aria-label="Attribution Models" data-section="s-attrib" onclick="showSection(this,'s-attrib'); return false;"><i class="nav-icon" data-lucide="git-branch" aria-hidden="true"></i><span>Attribution</span></a></li>
    <li class="nav-item"><a href="#s-channel" class="nav-link" aria-label="Channel Performance" data-section="s-channel" onclick="showSection(this,'s-channel'); return false;"><i class="nav-icon" data-lucide="trending-up" aria-hidden="true"></i><span>Channel ROI</span></a></li>
    <li class="nav-item"><a href="#s-conclusion" class="nav-link" aria-label="Conclusion" data-section="s-conclusion" onclick="showSection(this,'s-conclusion'); return false;"><i class="nav-icon" data-lucide="check-circle-2" aria-hidden="true"></i><span>Recommendation</span></a></li>
    <li class="nav-item"><a href="#s-appendix" class="nav-link" aria-label="Analyst Appendix" data-section="s-appendix" onclick="showSection(this,'s-appendix'); return false;"><i class="nav-icon" data-lucide="archive" aria-hidden="true"></i><span>Analyst Appendix</span></a></li>
  </ul>
</nav>

<!-- Main -->
<main id="main" tabindex="-1">
  <header class="top-bar">
    <h1>Marketing Analytics Dashboard</h1>
    <div class="top-actions">
      <div class="top-meta">
      <span>Data: {data_year_range} &nbsp;|&nbsp; {total_deals} Opportunities &nbsp;|&nbsp; 8 Datasets</span>
      </div>
      <span class="badge-pill">Validated</span>
      <label class="sr-only" for="dashboard-search">Filter dashboard sections</label>
      <input class="dashboard-search" id="dashboard-search" type="search" placeholder="Filter sections" aria-describedby="search-feedback">
      <span class="sr-only" id="search-feedback" role="status" aria-live="polite"></span>
      <button class="action-button menu-button" id="menu-button" type="button" aria-expanded="false"><i data-lucide="menu" aria-hidden="true"></i><span>Menu</span></button>
      <button class="action-button" id="print-button" type="button"><i data-lucide="printer" aria-hidden="true"></i><span>Print</span></button>
      <button class="action-button" id="reset-button" type="button"><i data-lucide="rotate-ccw" aria-hidden="true"></i><span>Reset</span></button>
      <button class="action-button" id="recommendation-button" type="button"><i data-lucide="check-circle-2" aria-hidden="true"></i><span>Recommendation</span></button>
      <button class="action-button" id="caveats-button" type="button" aria-haspopup="dialog" aria-controls="caveats-drawer" aria-expanded="false"><i data-lucide="info" aria-hidden="true"></i><span>Caveats</span></button>
      <button class="mode-toggle" id="mode-toggle" type="button" aria-pressed="false"><i data-lucide="presentation" aria-hidden="true"></i><span>Presentation Mode</span></button>
    </div>
  </header>
  <div class="status-strip" aria-label="Dashboard generation status">
    <span class="status-chip"><i data-lucide="check-circle-2" aria-hidden="true"></i>Validated data · {generated_at}</span>
    <span class="status-chip"><i data-lucide="database" aria-hidden="true"></i>{total_deals} opportunities · 8 datasets</span>
  </div>
  <details class="data-health">
    <summary>Data Health and quality details</summary>
    <div class="quality-strip" aria-label="Data quality scorecard">
      <div class="quality-card"><strong>{domain_match_rate}</strong> Opportunity domain coverage</div>
      <div class="quality-card {missing_date_class}"><strong>{missing_create_dates}</strong> opportunities missing create date</div>
      <div class="quality-card {unknown_channel_class}"><strong>{unknown_channel_pct}</strong> unknown/other channel share</div>
      <div class="quality-card {zero_amount_won_class}"><strong>{zero_amount_won}</strong> won deals with zero amount</div>
      <div class="quality-card warn"><strong>{attribution_linked_win_pct}</strong> won deals linked to marketing touches</div>
    </div>
  </details>
  <div class="metric-lens" aria-label="Metric lens controls">
    <span>Metric lens:</span>
    <button class="lens-button active" data-lens="all" type="button" aria-pressed="true">All</button>
    <button class="lens-button" data-lens="dollars" type="button" aria-pressed="false">$</button>
    <button class="lens-button" data-lens="rates" type="button" aria-pressed="false">%</button>
    <button class="lens-button" data-lens="counts" type="button" aria-pressed="false">Counts</button>
  </div>

  <!-- KPI Row (always visible) -->
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Total Pipeline</div><div class="kpi-value">{total_pipeline}</div><div class="kpi-sub">{total_deals} opportunities</div></div>
    <div class="kpi-card green"><div class="kpi-label">Recorded Won Revenue</div><div class="kpi-value">{won_pipeline}</div><div class="kpi-sub">Closed-deal win rate: {win_rate} (n={resolved_deals})</div></div>
    <div class="kpi-card orange"><div class="kpi-label">Mktg-Sourced Pipeline</div><div class="kpi-value">{mktg_pipeline}</div><div class="kpi-sub">{mktg_pct} of total pipeline</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Observed Influenced Pipeline</div><div class="kpi-value">{influenced_pipeline}</div><div class="kpi-sub">{linked_opportunities} linked opportunities; association only</div></div>
  </div>

  <div class="decision-panel" aria-label="Primary dashboard decision path">
    <div class="decision-lead">
      <div class="decision-label">Primary decision</div>
      <h2>Where should marketing focus next without overstating causality?</h2>
      <p>Start with the executive answer, then drill into attribution, coverage, quality, and budget evidence as needed.</p>
    </div>
    <div class="decision-item">
      <strong>1. Protect quality</strong>
      <span>Among cohorts at least 80% resolved, closed-deal win rate moved from {cohort_start_rate} to {cohort_end_rate}; review ICP and qualification before scaling.</span>
    </div>
    <div class="decision-item">
      <strong>2. Expand coverage</strong>
      <span>{unreached_pct} of CRM account domains have no tracked email or 6sense touch; test expansion with a holdout.</span>
    </div>
    <div class="decision-item">
      <strong>3. Measure before scaling</strong>
      <span>Only two paid channels have spend data; reserve holdouts and an experiment pool instead of extrapolating unstable ROI.</span>
    </div>
  </div>

  <div class="scope-row" aria-label="Dashboard usage notes">
    <span class="scope-chip"><i data-lucide="target" aria-hidden="true"></i>Audience: executive marketing review</span>
    <span class="scope-chip"><i data-lucide="mouse-pointer-click" aria-hidden="true"></i>Judge path: Essential, Attribution, Channel ROI, Recommendation</span>
    <span class="scope-chip"><i data-lucide="shield-check" aria-hidden="true"></i>Confidence labels separate observed facts from testable hypotheses</span>
  </div>
  <div class="command-rail" aria-label="Dashboard reading path">
    <div class="command-tile"><strong>Start</strong><span>Read the essential view before opening deep-dive charts.</span></div>
    <div class="command-tile warn"><strong>Check</strong><span>Use attribution as planning evidence, not causality proof.</span></div>
    <div class="command-tile risk"><strong>Watch</strong><span>Quality risk matters because mature-cohort win rate softened.</span></div>
    <div class="command-tile"><strong>Decide</strong><span>Use the recommendation page to defend next actions.</span></div>
  </div>

  <div class="story-strip">
    <div class="story-card">
      <h2>Influence is visible, but coverage is limited</h2>
      <p><span class="evidence-badge">{influenced_pipeline} influenced</span> is based on {linked_opportunities} linked opportunities and only {linked_win_share} of won deals.</p>
    </div>
    <div class="story-card coverage">
      <h2>Coverage is the clearest test opportunity</h2>
      <p><span class="evidence-badge orange">{unreached_pct} unreached</span> CRM account domains define a measurable test audience, not guaranteed lift.</p>
    </div>
    <div class="story-card quality">
      <h2>Pipeline quality needs executive attention</h2>
      <p><span class="evidence-badge red">{cohort_start_rate} -> {cohort_end_rate} closed win rate</span> among mature cohorts means pipeline growth must be checked against conversion quality.</p>
    </div>
  </div>

  <!-- Executive Summary -->
  <div id="s-essential" class="section active">
    <h2 class="section-title">Essential View</h2>
    <div class="section-desc">A focused version for decision-makers: the answer, the few charts that support it, and the next actions.</div>
    <div class="section-takeaway"><strong>Recommended path:</strong> protect pipeline quality, test coverage on unreached CRM account domains, and treat attribution as directional planning evidence. <span class="evidence-badge">{influenced_pipeline} influenced</span><span class="evidence-badge orange">{unreached_pct} unreached</span><span class="evidence-badge red">{cohort_start_rate} to {cohort_end_rate} closed win rate</span></div>
    <div class="priority-grid">
      <div class="priority-card">
        <div class="priority-tag">Do first</div>
        <h3>Audit pipeline quality</h3>
        <p>Among cohorts at least 80% resolved, closed-deal win rate moved from {cohort_start_rate} to {cohort_end_rate}. Tighten ICP and qualification before increasing broad spend.</p>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Test opportunity</div>
        <h3>Reach unreached accounts</h3>
        <p>{unreached_accounts} CRM account domains, or {unreached_pct}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and use a holdout.</p>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Budget lens</div>
        <h3>Fund measurement first</h3>
        <p>Use a budget-neutral holdout and experiment reserve. Do not optimize from two paid channels with insufficient won outcomes.</p>
      </div>
    </div>
    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card"><div id="c-essential-contribution"></div></div>
      <div class="chart-card"><div id="c-essential-coverage"></div></div>
      <div class="chart-card full"><div id="c-essential-cohort"></div></div>
    </div>
    <div class="chart-card full" style="margin-top:16px">
      <h3 class="section-title" style="font-size:13px;margin-bottom:8px">Essential Action Plan</h3>
      <div class="table-wrap">
        <table class="dash-table">
          <thead><tr><th>Priority</th><th>Decision</th><th>Why</th><th>Next step</th></tr></thead>
          <tbody>
            <tr><td><span class="priority-tag">1</span></td><td>Protect quality</td><td>Closed-deal win rate moved from {cohort_start_rate} to {cohort_end_rate} across cohorts at least 80% resolved.</td><td>Run a quarterly ICP and qualification review before scaling volume.</td></tr>
            <tr><td><span class="priority-tag">2</span></td><td>Expand coverage</td><td>{unreached_pct} of CRM account domains are unreached by tracked email or 6sense.</td><td>Launch email-first coverage test with a holdout group.</td></tr>
            <tr><td><span class="priority-tag">3</span></td><td>Use attribution carefully</td><td>{linked_opportunities} opportunities link to classified marketing touches; {linked_win_share} of won deals are covered.</td><td>Use journey models for hypothesis generation, then validate lift with holdouts.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="scope-row" aria-label="Essential view drilldown">
      <span class="scope-chip"><i data-lucide="eye" aria-hidden="true"></i>Only 3 charts are shown here by design</span>
      <span class="scope-chip"><i data-lucide="layers" aria-hidden="true"></i>Deeper views are in the appendix</span>
      <span class="scope-chip"><i data-lucide="shield-check" aria-hidden="true"></i>Caveats remain available from the top bar</span>
    </div>
  </div>

  <div id="s-exec" class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="section-desc">High-level pipeline, revenue, and channel overview for a B2B ABM company targeting specific accounts with 6sense display ads, email, and events.</div>
    <div class="section-takeaway"><strong>Executive takeaway:</strong> The business has meaningful pipeline volume, but the strongest story is how marketing supports future revenue beyond direct source credit. <span class="evidence-badge">{total_pipeline} pipeline</span><span class="evidence-badge green">{won_pipeline} won</span></div>
    <div class="context-box">
      <strong>How to read this dashboard:</strong> This company uses Account-Based Marketing (ABM) - instead of advertising to everyone, it coordinates campaigns around a defined account universe. A deal is born when an account agrees to a sales conversation and eventually signs a contract. The job of this dashboard is to answer: <em>which marketing activities appeared in the path to those deals?</em>
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-bar-channel"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Pipeline by Channel</div>
          Each bar is the total recorded amount of opportunities (won, lost, discontinued, and active) grouped by CRM lead-source category. Marketing categories are sourced credit; sales, referral, and existing-client categories provide context.
          <br><br><strong>Why "Other" and "Existing Client" are biggest:</strong> Most B2B deals come from existing customer expansions or sales-led outreach - that's normal. Marketing's role is to generate the <em>net-new</em> pipeline (6sense, email, web inbound, events).
          <div class="ex-insight">Key takeaway: {top_sourced_channels} are the top net-new marketing channels by sourced pipeline.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-donut-won"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Won Revenue by Channel</div>
          Of all deals that were actually <strong>closed and won</strong> (signed contracts, real money), this shows which channel sourced them. Only channels with won revenue appear.
          <br><br><strong>Why Existing Client often dominates:</strong> Upselling to existing customers is usually a higher-conversion motion because the relationship already exists. New-business marketing channels need time to mature.
          <div class="ex-insight">Key takeaway: {top_won_channels} are the largest won-revenue channels. Marketing channels should be judged with pipeline maturity and conversion timing in view.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-monthly-trend"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Pipeline Created by Month</div>
          Each colored band represents pipeline created in that month. The view keeps the five largest channels and groups the long tail into Other, so the total shape remains readable without a 12-series legend.
          <br><br><strong>How to use it:</strong> Look for spikes - did they follow a campaign launch? Look for drops - did a channel go quiet? This helps connect campaign activity to deal creation with a time lag.
          <div class="ex-insight">Key takeaway: Compare this chart to your campaign calendar. Spikes are useful leads for investigation, but the chart alone does not prove campaign lift.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Attribution Models -->
  <div id="s-attrib" class="section">
    <h2 class="section-title">Attribution Analysis</h2>
    <div class="section-desc">How descriptive models allocate credit across classified, pre-opportunity marketing touchpoints.</div>
    <div class="section-takeaway"><strong>Attribution takeaway:</strong> Report source credit and linked-journey credit separately. Only {linked_opportunities} opportunities and {linked_win_share} of won deals have classified marketing-touch coverage. <span class="evidence-badge orange">{sourced_pipeline} sourced</span><span class="evidence-badge">{influenced_pipeline} linked influence</span></div>
    <div class="context-box">
      <strong>The core concept:</strong> For the subset of opportunities with classified marketing touches, attribution models answer: <em>how would observed pipeline credit move under different allocation rules?</em> They do not estimate incremental lift.
      <br><br>
      We link marketing touchpoints to opportunities within a 365-day lookback window before deal creation. Here are the 6 models:
      <br><br>
      <span class="model-pill">Sourced</span>&nbsp; CRM says marketing was the origin. Hard credit, no sharing. ({sourced_pipeline})
      &nbsp;<span class="model-pill lt">Influenced</span>&nbsp; Marketing touched the account at any point before the deal. Measures reach. ({influenced_pipeline})
      &nbsp;<span class="model-pill">First-Touch</span>&nbsp; 100% credit to the <em>first</em> marketing touch - finds who starts conversations.
      &nbsp;<span class="model-pill lt">Last-Touch</span>&nbsp; 100% credit to the <em>last</em> touch before the deal - finds who closes conversations.
      &nbsp;<span class="model-pill lin">Linear</span>&nbsp; Equal split across ALL channels that touched the account - fairest view.
      &nbsp;<span class="model-pill td">Time-Decay</span>&nbsp; More credit to <em>recent weekly channel presence</em>, less to old presence (half-life = 30 days). Use for journey hypotheses, not direct budget mandates.
    </div>
    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Proves</span> Marketing has measurable pipeline presence</h3>
        <p>Sourced credit reconciles to the full CRM source view; influenced credit reconciles within the 695 linked opportunities. Report both only with their populations.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill medium">Suggests</span> Channels play different journey roles</h3>
        <p>First-touch, last-touch, linear, and time-decay views show whether a channel starts, assists, or closes account journeys.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill directional">Does not prove</span> Single-touch causality</h3>
        <p>A touchpoint receiving credit does not mean it alone caused the deal; it means the touchpoint appeared in the pre-opportunity path.</p>
      </div>
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div id="c-attrib-comparison"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Attribution Model Comparison</div>
          This comparison isolates the common touchpoint-linked channels across first-touch, last-touch, linear, and time-decay models. Sourced and influenced totals are shown separately because they use different definitions and populations.
          <br><br>
          <strong>How to read it:</strong> Compare the same channel across different models. If Email's bar is tall in First-Touch but shorter in Last-Touch, Email is good at starting conversations but someone else closes them.
          <br><br>
          <strong>Method note:</strong> Source logs are normalized to one account-channel presence per ISO week before crediting. Blank-UTM web sessions are excluded rather than assumed to be marketing traffic.
          <div class="ex-insight">Key takeaway: Compare first-touch, last-touch, linear, and time-decay side by side. Differences show observed journey roles, not single-channel causality.</div>
        </div>
      </div>
    </div>
    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-sourced-influenced"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Sourced vs. Influenced Pipeline</div>
          Two horizontal bars, two definitions of marketing contribution:
          <br><br>
          <strong>Sourced:</strong> The CRM field "Lead Source" explicitly says this deal came from marketing. Hard attribution. Conservative.
          <br><br>
          <strong>Influenced:</strong> A classified email or 6sense touch occurred within 365 days before opportunity creation, even if CRM source credit belongs elsewhere.
          <br><br>
          The gap is a definition difference, not proof of hidden causal value. Sourced covers CRM origin; influenced covers the linked subset of classified journeys.
          <div class="ex-insight">Key takeaway: Report both definitions with their populations. Sourced is {sourced_pipeline}; linked influenced pipeline is {influenced_pipeline} across {linked_opportunities} opportunities.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-attrib-waterfall"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - First-Touch vs. Last-Touch Credit Shift</div>
          This shows how much each channel's credit <em>changes</em> when you switch from First-Touch to Last-Touch. Teal bars gain later-stage credit; amber bars lose it.
          <br><br>
          <strong>Why it matters:</strong> A channel that loses credit (red) is an <em>awareness channel</em> - it gets the conversation started but isn't involved at the decision point. A channel that gains credit (green) is a <em>conversion channel</em> - it's there when deals close.
          <div class="ex-insight">Key takeaway: Channels that gain last-touch credit appear later in tracked journeys; channels that lose it appear earlier. Treat the pattern as a planning signal to test.</div>
        </div>
      </div>
    </div>

    <!-- Attribution Table -->
    <div class="chart-card" style="margin-top:16px">
      <h3 class="section-title" style="font-size:13px;margin-bottom:6px">Full Attribution Table - All Models Side by Side</h3>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">Every channel across every model in one place. The last column identifies the largest-credit model descriptively; it is not a model recommendation.</div>
      <div style="overflow-x:auto">
        <table class="dash-table" id="attrib-table">
          <thead><tr><th>Channel</th><th>First-Touch ($)</th><th>Last-Touch ($)</th><th>Linear ($)</th><th>Time-Decay ($)</th><th>Sourced ($)</th><th>Influenced ($)</th><th>Largest-Credit Model</th></tr></thead>
          <tbody id="attrib-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Channel Performance -->
  <div id="s-channel" class="section">
    <h2 class="section-title">Channel Performance</h2>
    <div class="section-desc">ROI, win rate, and funnel conversion by marketing channel - the efficiency scorecard.</div>
    <div class="section-takeaway"><strong>Channel takeaway:</strong> Relationship channels close best, while marketing channels build the net-new funnel that needs time to mature. <span class="evidence-badge green">relationship channels</span><span class="evidence-badge">net-new pipeline</span></div>
    <div class="context-box">
      <strong>What "ROI" means here:</strong> Pipeline ROI = CRM-sourced pipeline associated with a channel / tracked ad spend. Revenue ROI uses recorded won amount. These are observational efficiency ratios, not incrementality estimates, and recorded revenue is understated because many won deals have zero amount.
    </div>
    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Strong signal</span> Relationship channels convert best</h3>
        <p>Existing client and referral performance explains why revenue is not only a paid-media story.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill medium">Efficiency signal</span> Marketing builds future pipeline</h3>
        <p>Net-new channels should be judged by pipeline creation, later win conversion, and time-to-close together.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill directional">Next test</span> Separate quality from volume</h3>
        <p>Track whether added channel spend creates qualified opportunities, not just more opportunities.</p>
      </div>
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-spend-pipeline"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Tracked-Spend ROI</div>
          Each bar compares return multiples for channels with tracked spend. Pipeline ROI uses total pipeline; Revenue ROI counts only won revenue.
          <br><br>
          <strong>How to read it:</strong> Longer bars mean more pipeline or won revenue per tracked spend dollar.
          <br><br>
          <strong>Why only some channels appear:</strong> Only channels with tracked ad spend show up. Referral and existing client have $0 media spend in this dataset.
          <div class="ex-insight">Key takeaway: Use this to choose where to investigate marginal spend. Only {tracked_spend_channels} have tracked spend, so this is not a full marketing budget model.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-funnel"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Channel Activity Volumes</div>
          This separates ad, email, web, and opportunity outcome populations so unrelated events are not presented as one linear conversion path.
          <br><br>
          <strong>How to read it:</strong><br>
          Each group has its own denominator. Ad rows show impression/click progression; email rows show the composition of the supplied engagement-event log; opportunity rows summarize CRM outcomes. A log scale keeps very large and small counts readable together.
          <div class="ex-insight">Key takeaway: This view is safer for analysis because it avoids implying that email events, website sessions, and CRM opportunities are one sequential funnel.</div>
        </div>
      </div>
      <div class="chart-card full">
        <h3 class="section-title" style="font-size:13px;margin-bottom:6px">Channel ROI Summary Table</h3>
        <div style="font-size:11px;color:#64748B;margin-bottom:10px">Pipeline ROI = total pipeline / spend. Revenue ROI = won revenue / spend. Channels with no spend tracked show - (they rely on sales effort, not ad budget).</div>
        <div style="overflow-x:auto">
          <table class="dash-table" id="channel-table">
            <thead><tr><th>Channel</th><th>Deals</th><th>Resolved</th><th>Pipeline ($)</th><th>Won ($)</th><th>Closed Win Rate</th><th>Avg Deal</th><th>Spend ($)</th><th>Pipeline ROI</th><th>Revenue ROI</th></tr></thead>
            <tbody id="channel-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Segment Analysis -->
  <div id="s-segment" class="section">
    <h2 class="section-title">Segment & ICP Analysis</h2>
    <div class="section-desc">Which account segments and industries have the most pipeline and highest win rates - your best ABM targeting zones.</div>
    <div class="section-takeaway"><strong>Segment takeaway:</strong> The best targeting decision balances revenue potential with win probability, not just the largest deal size. <span class="evidence-badge green">Commercial + Strong Fit wins most often</span></div>
    <div class="context-box">
      <strong>What is a "Segment" here?</strong> The CRM segment field groups opportunities into Commercial, Mid, and Enterprise markets. It is not a 6sense buying-stage label. The profile-fit field is analyzed separately, and win rates use resolved opportunities only.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-seg-heatmap"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Pipeline Heatmap: Industry x Segment</div>
          Each cell = total recorded pipeline from accounts in that industry and CRM market segment. Darker blue = more pipeline concentrated there.
          <br><br>
          <strong>How to use it:</strong> The darkest cells identify concentration worth investigating. Confirm positive-amount coverage and conversion quality before turning concentration into a targeting rule.
          <br><br>
          <strong>The dollar amounts</strong> in each cell show absolute pipeline value - useful for prioritizing where to spend ABM budget and sales time.
          <div class="ex-insight">Key takeaway: Use the highest-concentration cells to frame tests, then qualify them with resolved-deal win rate and sample size.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-seg-winrate"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Segment Tradeoff</div>
          Each bar is the closed-deal win rate for a CRM market segment, with a 95% Wilson interval:
          <br><br>
          <strong>X-axis:</strong> Won opportunities divided by resolved opportunities in the segment.
          <br><br>
          <strong>Labels:</strong> Resolved-deal count and average recorded deal amount provide scale context.
          <br><br>
          <strong>Decision rule:</strong> Prefer segments with a stable interval, adequate resolved volume, and meaningful positive deal amounts.
          <div class="ex-insight">Key takeaway: Use this as a market-segment baseline; the targeting matrix adds profile fit and explicit low-N flags.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Creative & Email -->
  <div id="s-creative" class="section">
    <h2 class="section-title">Creative & Email Performance</h2>
    <div class="section-desc">Which ad creatives and email campaigns drive the highest engagement - tells you what messaging resonates with the account universe.</div>
    <div class="section-takeaway"><strong>Creative takeaway:</strong> Creative performance is an efficiency lever: better messages improve account engagement before opportunities appear in CRM. <span class="evidence-badge">CTR and form fills</span><span class="evidence-badge orange">seniority engagement</span></div>
    <div class="context-box">
      <strong>Why creative matters in ABM:</strong> In ABM, you're showing ads specifically to people in the account universe - they'll see your ads repeatedly. If your creative is bad, they'll tune it out. If it's good, it builds brand recognition so when sales calls, the prospect already knows who you are. CTR (click-through rate) is the primary measure of creative effectiveness for display ads.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-creative-ctr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - High-Volume Creative CTR Within Platform</div>
          CTR = Click-Through Rate = clicks / impressions. If 1,000 people saw an ad and 5 clicked it, CTR = 0.5%.
          <br><br>
          <strong>Comparison rule:</strong> LinkedIn and 6sense are ranked separately because their delivery mechanics and baseline CTR differ. Only ads with at least 10,000 impressions are shown.
          <br><br>
          <strong>What to do with this:</strong> The top ads tell your creative team what visual style, message, and CTA is working. Brief new creative based on these patterns - don't start from scratch.
          <div class="ex-insight">Key takeaway: Use the highest-CTR ads as the next creative brief, then test budget shifts before making them always-on.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-creative-attr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - 6sense CTR by Recorded Copy Tone</div>
          This aggregates 6sense creative by copy-tone label and shows weighted CTR, impression volume, and distinct ad count.
          <br><br>
          <strong>How to use it:</strong> Most 6sense impressions have Unknown tone, while labeled tones have much smaller samples. Improve creative metadata before making a portfolio-wide tone recommendation.
          <div class="ex-insight">Key takeaway: Treat labeled tone differences as test hypotheses; fixing metadata coverage is the first action.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-email-seniority"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Email Engagement-Event Mix by Job Seniority</div>
          The supplied email file contains {email_events} engagement events across {email_people} people. It does not contain sent or delivered counts.
          <br><br>
          <strong>Click-event share:</strong> Click rows divided by all recorded engagement rows for the seniority group. This is event composition, not a send-based click rate.
          <br><br>
          <strong>How to use it:</strong> Treat higher click-event share as a hypothesis for message relevance. Acquire delivery denominators before judging subject lines, true open rates, or true click-through rates.
          <div class="ex-insight">Key takeaway: The current log can rank engagement composition, but it cannot measure campaign reach or send-based effectiveness.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Budget Scenarios -->
  <div id="s-budget" class="section">
    <h2 class="section-title">Budget Measurement Plan</h2>
    <div class="section-desc">Three budget-neutral operating plans that reserve spend for causal measurement instead of extrapolating unstable historical ROI.</div>
    <div class="section-takeaway"><strong>Budget takeaway:</strong> Do not claim an optimal mix from two tracked-spend channels—one has a single opportunity and neither has recorded won revenue. <span class="evidence-badge">{tracked_spend_channels}</span><span class="evidence-badge orange">measurement first</span></div>
    <div class="context-box">
      <strong>How the plan works:</strong> Every scenario preserves the current tracked budget. The alternatives reserve part of that budget for a randomized or phased holdout and a pre-registered experiment pool.
      <br><br>
      <strong>Three plans:</strong> (1) <em>Status Quo</em> activates all tracked spend. (2) <em>10% Holdout</em> reserves 10% for causal comparison. (3) <em>Measurement First</em> activates 80%, reserves 10% as holdout, and creates a 10% experiment pool.
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div id="c-budget-scenario"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Budget-Neutral Measurement Allocation</div>
          Each stacked bar is one operating plan. The segments show activated media, holdout reserve, and experiment pool; totals remain equal.
          <br><br>
          <strong>How to use it:</strong> Choose the measurement intensity the team can execute cleanly. Pre-register the target population, outcome window, and primary metric before launch.
          <br><br>
          <strong>Important caveat:</strong> No pipeline forecast is shown because the available paid-channel outcomes are too sparse for defensible extrapolation.
          <br><br>
          <strong>Decision gate:</strong> Scale only if the treatment creates incremental qualified opportunities or pipeline while maintaining closed-deal win-rate quality.
          <div class="ex-insight">Key takeaway: The data supports a measurement plan, not an optimization claim.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Advanced Analytics -->
  <div id="s-advanced" class="section">
    <h2 class="section-title">Advanced Analytics</h2>
    <div class="section-desc">ML win probability model, account coverage gap, deal velocity, journey sequences, and targeting matrix - datathon-level depth.</div>
    <div class="section-takeaway"><strong>Advanced takeaway:</strong> The predictive model and coverage analysis point to the same action: focus sales and marketing on high-fit accounts that are not yet fully activated. <span class="evidence-badge">AUC {model_auc}</span><span class="evidence-badge orange">{unreached_pct} unreached</span></div>
    <div class="context-box">
      <strong>What makes this section different:</strong> Standard marketing analytics tells you what happened. This section adds prioritization signals for where to focus. The leakage-reduced baseline (Random Forest, AUC = {model_auc}, {model_validation}) scores {open_deals} active opportunities. The coverage analysis reveals that {unreached_pct} of CRM account domains have no tracked email or 6sense touchpoint.
    </div>
    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Observed gap</span> Reached tiers show higher observed rates</h3>
        <p>Unreached accounts show a {not_reached_rate} opportunity rate, while email-only accounts show {email_only_rate} and both-channel accounts show {both_rate}. This association may reflect selection, so validate it with a holdout.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill medium">Quality diagnosis</span> Growth is not automatically healthy</h3>
        <p>Among cohorts at least 80% resolved, closed-deal win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill directional">Next test</span> Validate causality</h3>
        <p>Run a holdout or phased rollout so the team can measure incremental lift from email-first outreach and a tested 6sense overlay.</p>
      </div>
    </div>

    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-feat-imp"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Win Probability: Top Predictors</div>
          A Random Forest model was trained on resolved deals to prioritize active opportunities. Feature importance shows which opportunity-time fields the model relied on. <strong>AUC = {model_auc}</strong> using {model_validation} (1.0 = perfect, 0.5 = random).
          <br><br>
          <strong>Leakage policy:</strong> The model uses channel, CRM market segment, amount, and create-date features. Present-day account intent, contact counts, and current stage are excluded because they may post-date historical outcomes.
          <div class="ex-insight">Key insight: Use win probability for sales prioritization. Treat channel and account signals as predictive patterns, not proof that any single marketing touch caused a win.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-win-prob"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Active Opportunity Score Distribution</div>
          This histogram shows {open_deals} active opportunities scored by the baseline model. Each bar is the number of active opportunities in that probability range. Deals on the right side are higher-priority follow-up candidates.
          <br><br>
          <strong>How to use it:</strong> Use the score as one prioritization input alongside deal stage, account context, and seller judgment. Do not set an operating cutoff until calibration and precision/recall are validated at the proposed threshold.
          <div class="ex-insight">Key insight: Pilot the ranking with sales, measure conversion by score band, and choose a threshold only after observed performance supports it.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid" style="margin-top:16px">
      <div class="chart-card full">
        <div id="c-account-coverage"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - CRM Account Coverage</div>
          Of all {target_accounts} CRM account domains, this shows how many have been reached by email, 6sense, both, or neither. The orange line shows the observed opportunity rate (% of accounts in each group that have at least one CRM deal).
          <br><br>
          <strong>The critical finding:</strong> <strong>{unreached_accounts} accounts ({unreached_pct}) have never received a single marketing touchpoint.</strong> Yet accounts reached by email alone have a {email_only_rate} opportunity rate vs. {not_reached_rate} for unreached accounts.
          <br><br>
          <strong>What to do:</strong> The {unreached_accounts} unreached accounts define the largest testable audience. Prioritize strong-fit accounts and compare treatment with a holdout before interpreting the higher reached-account opportunity rates as lift.
          <div class="ex-insight">Key insight: Coverage and opportunity creation are associated, but account selection and sales activity may explain part of the gap. Only a controlled test can estimate incremental lift.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-deal-velocity"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Deal Velocity: How Fast Do Different Channels Close?</div>
          Median days from deal creation to close win, by channel. Error bars show the middle 50% range, so the chart shows both typical speed and variability.
          <br><br>
          <strong>Why it matters:</strong> Sales-cycle medians help planning only when the underlying channel has enough wins. This view suppresses channels with fewer than five won deals and shows the interquartile range to make variability visible.
          <div class="ex-insight">Key insight: Use the chart as a historical benchmark for established channels. Paid-channel samples are too small to support a speed or runway recommendation.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-journey"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Winning Touchpoint Journey Sequences</div>
          For won deals that had tracked marketing touchpoints, what was the sequence of channels in order? This shows the most common channel paths that led to a closed deal.
          <br><br>
          <strong>How to read:</strong> "email_mqa -> 6sense_display" means: email was the first touch, then 6sense display ads followed. Common winning sequences are planning clues, not proof that the sequence caused the win.
          <div class="ex-insight">Key insight: Build this as a controlled playbook: when email engagement is detected, test 6sense frequency against a holdout and measure meeting, opportunity, and win-rate lift.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-targeting-matrix"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - ABM Targeting Priority Matrix</div>
          Win rate heatmap crossing Segment (Enterprise/Commercial/Mid) vs. 6sense Profile Fit (Strong/Moderate/Weak). Every cell includes its deal count; cells below 30 deals are explicitly exploratory.
          <br><br>
          <strong>How to use it:</strong> Prioritize cells with both a strong adjusted win rate and decision-grade evidence. Cells with fewer than 30 resolved deals remain exploratory regardless of color.
          <div class="ex-insight">Key insight: Commercial + Strong Fit combines strong conversion with a large resolved sample. Enterprise + Strong Fit has greater deal potential but too little evidence for an allocation decision.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-cohort"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Pipeline Cohort Analysis by Quarter</div>
          Blue bars = pipeline created each quarter (growing). Green line = win rate per quarter (declining). Yellow dashed = marketing's share of deals per quarter (volatile).
          <br><br>
          <strong>The quality trend:</strong> Among cohorts at least 80% resolved, closed-deal win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}. The resolved-share line shows why newer cohorts should remain provisional.
          <div class="ex-insight">Key insight: Investigate whether the mature-cohort decline reflects ICP fit, qualification, or source mix. Do not treat unresolved recent cohorts as equivalent to fully matured cohorts.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Conclusion -->
  <div id="s-appendix" class="section">
    <h2 class="section-title">Analyst Appendix</h2>
    <div class="section-desc">Extra evidence is still available, but it is no longer part of the default judging path.</div>
    <div class="section-takeaway"><strong>Use this section when challenged:</strong> it holds the supporting analysis behind the recommendation without making the opening dashboard feel crowded.</div>
    <div class="priority-grid">
      <div class="priority-card">
        <div class="priority-tag">Overview</div>
        <h3>Executive Summary</h3>
        <p>Top-line pipeline, won revenue, and monthly trend views.</p>
        <button class="action-button" type="button" onclick="showAppendixSection('s-exec')"><i data-lucide="layout-dashboard" aria-hidden="true"></i><span>Open</span></button>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Targeting</div>
        <h3>Segment & ICP</h3>
        <p>Segment, industry, and ICP evidence for account prioritization.</p>
        <button class="action-button" type="button" onclick="showAppendixSection('s-segment')"><i data-lucide="building-2" aria-hidden="true"></i><span>Open</span></button>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Engagement</div>
        <h3>Creative & Email</h3>
        <p>Creative CTR and email engagement detail for messaging decisions.</p>
        <button class="action-button" type="button" onclick="showAppendixSection('s-creative')"><i data-lucide="mail" aria-hidden="true"></i><span>Open</span></button>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Planning</div>
        <h3>Budget Scenarios</h3>
        <p>Tracked-spend scenarios for sizing controlled budget tests.</p>
        <button class="action-button" type="button" onclick="showAppendixSection('s-budget')"><i data-lucide="circle-dollar-sign" aria-hidden="true"></i><span>Open</span></button>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Modeling</div>
        <h3>Advanced Analytics</h3>
        <p>Win probability, deal velocity, journey, and targeting matrix detail.</p>
        <button class="action-button" type="button" onclick="showAppendixSection('s-advanced')"><i data-lucide="brain-circuit" aria-hidden="true"></i><span>Open</span></button>
      </div>
    </div>
    <div class="chart-card full" style="margin-top:16px">
      <h3 class="section-title" style="font-size:13px;margin-bottom:8px">Case Deliverable Coverage</h3>
      <div class="table-wrap">
        <table class="dash-table">
          <thead><tr><th>Rubric Area</th><th>Where It Is Answered</th><th>What The Evaluator Should See</th></tr></thead>
          <tbody>
            <tr><td>Data Processing</td><td>Pipeline runner and methodology notes</td><td>Eight raw sources are cleaned, deduplicated, normalized by domain, and rebuilt through reproducible scripts.</td></tr>
            <tr><td>Data Integrity</td><td>Quality scorecard, validation script, caveats</td><td>Won revenue, attribution, funnel, and dashboard artifacts are checked for consistency before presentation.</td></tr>
            <tr><td>Data Storytelling</td><td>Essential View and Recommendation</td><td>The story is focused: marketing influence is broader than source credit, but growth must protect quality.</td></tr>
            <tr><td>Dashboard Design</td><td>Short judging path plus appendix</td><td>The default page prioritizes decision-critical charts; deeper charts are available but not forced.</td></tr>
            <tr><td>Reporting & Analysis</td><td>Attribution, coverage, cohort, targeting, budget sections</td><td>Findings connect to evidence and translate into specific CMO recommendations.</td></tr>
            <tr><td>Marketing Strategy</td><td>Action plan, targeting matrix, budget scenario</td><td>Recommended pivot: protect ICP quality, expand strong-fit account coverage, and test budget shifts before scaling.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="s-conclusion" class="section">
    <h2 class="section-title">Conclusion</h2>
    <div class="section-desc">The practical readout: what the analysis says, what risks matter, and what the next actions should be.</div>
    <div class="section-takeaway"><strong>Final takeaway:</strong> The recommendation is targeted, measured growth rather than blanket budget expansion. <span class="evidence-badge">{influenced_pipeline} influenced</span><span class="evidence-badge orange">{unreached_pct} unreached</span><span class="evidence-badge red">{cohort_start_rate} -> {cohort_end_rate} closed win rate</span></div>
    <div class="conclusion-hero">
      <div class="eyebrow">Bottom-line recommendation</div>
      <h3>Reach the right unreached accounts, start with email, test 6sense overlay with a holdout, and protect win rate as pipeline grows.</h3>
      <p>Marketing is not just a source channel. It influenced {influenced_pipeline} of pipeline, while {unreached_accounts} CRM account domains ({unreached_pct}) provide a large, measurable audience for a controlled coverage test.</p>
    </div>

    <div class="conclusion-grid">
      <div class="conclusion-card">
        <h3>What is working</h3>
        <ul class="finding-list">
          <li>Relationship-led channels remain the strongest won-revenue base.</li>
          <li>Touchpoint attribution shows different channels appearing at different journey stages.</li>
          <li>The win model is useful as a prioritization signal: AUC is {model_auc} using {model_validation}.</li>
        </ul>
      </div>
      <div class="conclusion-card">
        <h3>What is at risk</h3>
        <ul class="finding-list">
          <li>Among cohorts at least 80% resolved, closed-deal win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}.</li>
          <li>Marketing-sourced share was {mktg_end_pct} in the latest cohort meeting the 80% resolved threshold, so source mix deserves review.</li>
          <li>Most CRM account domains are unreached, which limits ABM learning and leaves pipeline potential untouched.</li>
        </ul>
      </div>
      <div class="conclusion-card">
        <h3>What to do next</h3>
        <ul class="finding-list">
          <li>Expand coverage to unreached strong-fit accounts before increasing broad demand generation spend.</li>
          <li>Test 6sense display after email engagement, using a holdout to prove whether the overlay creates lift.</li>
          <li>Review ICP and qualification each quarter until win rate stabilizes.</li>
        </ul>
      </div>
    </div>

    <div class="priority-grid">
      <div class="priority-card">
        <h3><span class="priority-tag p1">P1</span> Fix coverage and quality first</h3>
        <p>Activate unreached CRM account domains and tighten ICP qualification before chasing more broad top-of-funnel volume.</p>
      </div>
      <div class="priority-card">
        <h3><span class="priority-tag p2">P2</span> Operationalize the evidence</h3>
        <p>Report sourced plus influenced metrics together, and use win probability bands in weekly sales reviews.</p>
      </div>
      <div class="priority-card">
        <h3><span class="priority-tag p3">P3</span> Improve message efficiency</h3>
        <p>Scale the creative patterns that earn engagement and retire ads that do not move accounts forward.</p>
      </div>
    </div>

    <div class="chart-card full" style="margin-bottom:16px">
      <h3 class="section-title" style="font-size:13px;margin-bottom:6px">Decision Confidence</h3>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">This separates what the data directly supports from what should be treated as a testable business hypothesis.</div>
      <div style="overflow-x:auto">
        <table class="dash-table confidence-table">
          <thead><tr><th>Recommendation</th><th>Confidence</th><th>Why We Believe It</th><th>What To Test Next</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Expand coverage to unreached CRM account domains.</strong></td>
              <td><span class="confidence-pill high">High</span></td>
              <td>{unreached_accounts} CRM account domains are unreached, and reached groups show materially higher opportunity rates than unreached accounts.</td>
              <td>Prioritize strong-fit unreached accounts and compare opportunity creation against a holdout group.</td>
            </tr>
            <tr>
              <td><strong>Coordinate email engagement with 6sense display.</strong></td>
              <td><span class="confidence-pill medium">Medium</span></td>
              <td>Journey and attribution patterns show email often starts conversations while 6sense appears later in the path.</td>
              <td>Trigger display frequency after email engagement and measure lift in meetings, opportunities, pipeline, and win rate.</td>
            </tr>
            <tr>
              <td><strong>Tighten ICP and qualification criteria.</strong></td>
              <td><span class="confidence-pill high">High</span></td>
              <td>Cohort analysis shows pipeline growth alongside a mature-cohort closed-win-rate move from {cohort_start_rate} to {cohort_end_rate}.</td>
              <td>Track win rate, stage conversion, and disqualification reasons by source and profile fit.</td>
            </tr>
            <tr>
              <td><strong>Reserve budget for a causal measurement plan.</strong></td>
              <td><span class="confidence-pill high">High</span></td>
              <td>Only two paid channels have tracked spend, one has a single opportunity, and neither has recorded won revenue.</td>
              <td>Use a budget-neutral holdout and pre-register incremental qualified pipeline as the decision metric.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Direct observations</span></h3>
        <p>Pipeline, won revenue, marketing-sourced pipeline, marketing-influenced pipeline, account coverage gaps, and cohort win-rate movement are directly measurable.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill medium">What the data suggests</span></h3>
        <p>Email coverage is the strongest observed reach signal in this dataset, and 6sense overlay should be tested with a holdout.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill directional">What needs testing</span></h3>
        <p>Causality and budget scaling need experiments, holdouts, or phased rollouts before making large spend commitments.</p>
      </div>
    </div>

    <div class="chart-card full">
      <h3 class="section-title" style="font-size:13px;margin-bottom:6px">Recommended Action Plan</h3>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">Each row connects the dashboard evidence to a business action, so the analysis can be defended in a presentation.</div>
      <div style="overflow-x:auto">
        <table class="dash-table recommendation-table">
          <thead><tr><th>Priority</th><th>Action</th><th>Why</th><th>Measure Success With</th></tr></thead>
          <tbody>
            <tr>
              <td><span class="priority-tag p1">P1</span></td>
              <td><strong>Coverage:</strong> reach unreached CRM account domains with email first, then test 6sense overlay with a holdout.</td>
              <td>Email-only accounts show a {email_only_rate} opportunity rate and both-channel accounts show {both_rate}, compared with {not_reached_rate} for unreached accounts.</td>
              <td>Account coverage, opportunity rate, incremental lift, pipeline created.</td>
            </tr>
            <tr>
              <td><span class="priority-tag p1">P1</span></td>
              <td><strong>Pipeline quality:</strong> tighten ICP and qualification criteria.</td>
              <td>Quarterly pipeline is rising while closed-deal win rate moved from {cohort_start_rate} to {cohort_end_rate} among cohorts at least 80% resolved.</td>
              <td>Win rate, stage conversion, disqualification reasons.</td>
            </tr>
            <tr>
              <td><span class="priority-tag p2">P2</span></td>
              <td><strong>Attribution reporting:</strong> report sourced and influenced side by side.</td>
              <td>Sourced pipeline is {sourced_pipeline}, while influenced pipeline is {influenced_pipeline}. Both answer different executive questions.</td>
              <td>Sourced pipeline, influenced pipeline, influenced won revenue.</td>
            </tr>
            <tr>
              <td><span class="priority-tag p2">P2</span></td>
              <td><strong>Sales prioritization:</strong> use win probability bands in weekly pipeline review.</td>
              <td>The leakage-reduced baseline scored {open_deals} active deals using opportunity-time channel, segment, amount, and create-date fields.</td>
              <td>Close rate by probability band, sales follow-up SLA.</td>
            </tr>
            <tr>
              <td><span class="priority-tag p3">P3</span></td>
              <td><strong>Creative:</strong> scale high-CTR creative patterns and retire weak ads.</td>
              <td>Creative patterns are tied to click efficiency before accounts become opportunities.</td>
              <td>CTR, CPC, form fills, account engagement.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="chart-card full" style="margin-top:16px">
      <h3 class="section-title" style="font-size:13px;margin-bottom:8px">How to Present the Conclusion</h3>
      <div class="next-step-row">
        <strong>1. Start with contribution</strong>
        <span>Marketing created measurable pipeline directly, but the stronger story is influence across the account journey.</span>
      </div>
      <div class="next-step-row">
        <strong>2. Name the tension</strong>
        <span>The business is creating more pipeline, but lower recent win rates mean growth is not automatically healthy.</span>
      </div>
      <div class="next-step-row">
        <strong>3. Recommend the move</strong>
        <span>Prioritize strong-fit account coverage, lead with email, and test 6sense overlay with a holdout before simply adding budget.</span>
      </div>
      <div class="next-step-row">
        <strong>4. State confidence</strong>
        <span>Coverage expansion and ICP tightening are high-confidence recommendations; budget scaling is directional and should be tested in phases.</span>
      </div>
      <div class="chart-explain">
        <div class="ex-title">How to read this conclusion</div>
        The conclusion combines three signals: attribution tells us where marketing contributes, coverage tells us where growth is still available, and cohort analysis tells us whether pipeline quality is improving or declining.
        <div class="ex-insight">Key takeaway: The best recommendation is not "spend more everywhere." It is to reach the right unreached accounts, test channel overlays carefully, and protect win rate as pipeline grows.</div>
      </div>
    </div>
  </div>

</main><!-- /main -->

<div class="drawer-backdrop" id="drawer-backdrop"></div>
<aside class="caveats-drawer" id="caveats-drawer" role="dialog" aria-modal="true" aria-labelledby="caveats-title" aria-hidden="true" tabindex="-1">
  <div class="drawer-head">
    <h2 id="caveats-title">Data Caveats</h2>
    <button class="action-button" id="close-caveats" type="button"><i data-lucide="x" aria-hidden="true"></i><span>Close</span></button>
  </div>
  <ul>
    <li><strong>Attribution is directional.</strong> Sourced, influenced, first-touch, last-touch, linear, and time-decay answer different questions; no single model proves causality.</li>
    <li><strong>Web traffic is partially anonymous.</strong> Only sessions with a matched company domain can be connected to account-level journeys.</li>
    <li><strong>Low-volume categories are unstable.</strong> Channels or segments with very few won deals should be read as signals to investigate, not budget mandates.</li>
    <li><strong>Spend ROI is tracked-spend only.</strong> Channels without reliable spend data are excluded from ROI scenario math.</li>
    <li><strong>Model scores are prioritization aids.</strong> Win probability supports sales review, but should be validated against holdout performance and business context.</li>
  </ul>
</aside>

<!-- Scripts -->
<script>
// Navigation
function showSection(link, sectionId) {{
  document.querySelectorAll('.nav-link').forEach(l => {{
    l.classList.remove('active');
    l.removeAttribute('aria-current');
  }});
  link.classList.add('active');
  link.setAttribute('aria-current', 'page');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const activeSection = document.getElementById(sectionId);
  activeSection.classList.add('active');
  document.body.classList.remove('sidebar-open');
  const menuButton = document.getElementById('menu-button');
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  history.replaceState(null, '', `#${{sectionId}}`);
  updateProgress(link);
  if (window.innerWidth <= 900) {{
    setTimeout(() => activeSection.scrollIntoView({{ behavior: 'smooth', block: 'start' }}), 20);
  }} else {{
    window.scrollTo({{ top: 0, behavior: 'auto' }});
  }}
  // Trigger resize so Plotly charts re-fit
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}}

function showAppendixSection(sectionId) {{
  const appendixLink = document.querySelector('.nav-link[data-section="s-appendix"]');
  if (appendixLink) showSection(appendixLink, sectionId);
}}

function jumpToSection(sectionId) {{
  const link = document.querySelector(`.nav-link[data-section="${{sectionId}}"]`);
  if (link) showSection(link, sectionId);
}}

function updateProgress(activeLink) {{
  const links = Array.from(document.querySelectorAll('.nav-link'));
  const idx = Math.max(0, links.indexOf(activeLink));
  const pct = links.length ? ((idx + 1) / links.length) * 100 : 12.5;
  const bar = document.querySelector('#nav-progress span');
  if (bar) bar.style.width = `${{pct}}%`;
}}

if (window.lucide) {{
  lucide.createIcons();
}}

const modeToggle = document.getElementById('mode-toggle');
function setMode(mode) {{
  const presentation = mode === 'presentation';
  document.body.classList.toggle('presentation-mode', presentation);
  if (modeToggle) {{
    modeToggle.setAttribute('aria-pressed', String(presentation));
    modeToggle.querySelector('span').textContent = presentation ? 'Analyst Mode' : 'Presentation Mode';
    modeToggle.setAttribute('aria-label', presentation ? 'Switch to analyst mode' : 'Switch to presentation mode');
  }}
  localStorage.setItem('dashboardMode', mode);
}}

if (modeToggle) {{
  modeToggle.addEventListener('click', () => {{
    setMode(document.body.classList.contains('presentation-mode') ? 'analyst' : 'presentation');
  }});
  setMode(localStorage.getItem('dashboardMode') || 'analyst');
}}

const printButton = document.getElementById('print-button');
const resetButton = document.getElementById('reset-button');
const caveatsButton = document.getElementById('caveats-button');
const menuButton = document.getElementById('menu-button');
const dashboardSearch = document.getElementById('dashboard-search');
const searchFeedback = document.getElementById('search-feedback');
const closeCaveats = document.getElementById('close-caveats');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const caveatsDrawer = document.getElementById('caveats-drawer');
const recommendationButton = document.getElementById('recommendation-button');
let caveatsReturnFocus = null;

function getDrawerFocusables() {{
  return caveatsDrawer ? Array.from(caveatsDrawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
}}

function openCaveats() {{
  caveatsReturnFocus = document.activeElement;
  document.body.classList.add('drawer-open');
  if (caveatsDrawer) {{
    caveatsDrawer.setAttribute('aria-hidden', 'false');
    const focusables = getDrawerFocusables();
    (focusables[0] || caveatsDrawer).focus();
  }}
  if (caveatsButton) caveatsButton.setAttribute('aria-expanded', 'true');
}}
function closeCaveatsDrawer() {{
  const wasOpen = document.body.classList.contains('drawer-open');
  document.body.classList.remove('drawer-open');
  if (caveatsDrawer) caveatsDrawer.setAttribute('aria-hidden', 'true');
  if (caveatsButton) caveatsButton.setAttribute('aria-expanded', 'false');
  if (wasOpen && caveatsReturnFocus && typeof caveatsReturnFocus.focus === 'function') caveatsReturnFocus.focus();
}}
if (printButton) printButton.addEventListener('click', () => window.print());
if (caveatsButton) caveatsButton.addEventListener('click', openCaveats);
if (closeCaveats) closeCaveats.addEventListener('click', closeCaveatsDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeCaveatsDrawer);
if (recommendationButton) recommendationButton.addEventListener('click', () => jumpToSection('s-conclusion'));
if (menuButton) {{
  menuButton.addEventListener('click', () => {{
    const open = !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  }});
}}
if (dashboardSearch) {{
  dashboardSearch.addEventListener('input', () => {{
    const q = dashboardSearch.value.trim().toLowerCase();
    const links = Array.from(document.querySelectorAll('.nav-link'));
    let matches = 0;
    links.forEach(link => {{
      const label = link.textContent.toLowerCase();
      const match = !q || label.includes(q);
      link.classList.toggle('hidden-by-search', !match);
      if (match) matches += 1;
    }});
    if (searchFeedback) searchFeedback.textContent = q ? `${{matches}} matching section${{matches === 1 ? '' : 's'}}${{matches ? '' : '. Clear the filter to show all sections.'}}` : 'All dashboard sections are shown.';
  }});
}}
if (resetButton) {{
  resetButton.addEventListener('click', () => {{
    const first = document.querySelector('.nav-link[data-section="s-essential"]');
    if (first) showSection(first, 's-essential');
    setMode('analyst');
    closeCaveatsDrawer();
    window.scrollTo({{top:0, behavior:'smooth'}});
  }});
}}

document.addEventListener('keydown', (event) => {{
  if (document.body.classList.contains('drawer-open')) {{
    if (event.key === 'Escape') {{ event.preventDefault(); closeCaveatsDrawer(); return; }}
    if (event.key === 'Tab') {{
      const focusables = getDrawerFocusables();
      if (!focusables.length) {{ event.preventDefault(); caveatsDrawer?.focus(); return; }}
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {{ event.preventDefault(); last.focus(); }}
      else if (!event.shiftKey && document.activeElement === last) {{ event.preventDefault(); first.focus(); }}
    }}
    return;
  }}
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  const links = Array.from(document.querySelectorAll('.nav-link'));
  const active = document.querySelector('.nav-link.active');
  const idx = Math.max(0, links.indexOf(active));
  if (event.key === 'ArrowRight' && links[idx + 1]) {{
    links[idx + 1].click();
  }}
  if (event.key === 'ArrowLeft' && links[idx - 1]) {{
    links[idx - 1].click();
  }}
  if (event.key === 'Escape') {{
    closeCaveatsDrawer();
  }}
}});

const initialSection = window.location.hash ? window.location.hash.slice(1) : '';
if (initialSection) {{
  const initialLink = document.querySelector(`.nav-link[data-section="${{initialSection}}"]`);
  if (initialLink) {{
    showSection(initialLink, initialSection);
  }} else if (document.getElementById(initialSection)) {{
    showAppendixSection(initialSection);
  }}
}} else {{
  const activeLink = document.querySelector('.nav-link.active');
  if (activeLink) updateProgress(activeLink);
}}

document.querySelectorAll('.chart-explain').forEach((box, idx) => {{
  const title = box.querySelector('.ex-title');
  const insight = box.querySelector('.ex-insight');
  const bodyNodes = [];
  Array.from(box.childNodes).forEach(node => {{
    if (node !== title && node !== insight) bodyNodes.push(node);
  }});

  const body = document.createElement('div');
  body.className = 'ex-body';
  body.id = `learn-${{idx}}`;
  bodyNodes.forEach(node => body.appendChild(node));

  const toggle = document.createElement('button');
  toggle.className = 'learn-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', body.id);
  toggle.innerHTML = '<i data-lucide="chevron-down"></i><span>How to read this</span>';
  toggle.addEventListener('click', () => {{
    const open = box.classList.toggle('open');
    box.classList.toggle('collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
  }});

  box.innerHTML = '';
  if (title) box.appendChild(title);
  if (insight) box.appendChild(insight);
  if (body.textContent.trim()) {{
    box.classList.add('collapsed');
    box.appendChild(toggle);
    box.appendChild(body);
  }}
}});

// Chart data (injected by Python)
if (window.lucide) {{
  lucide.createIcons();
}}

// Chart data (injected by Python)
const CHARTS = {{
  "c-essential-contribution": {sourced_influenced},
  "c-essential-coverage":     {account_coverage_chart},
  "c-essential-cohort":       {cohort_chart},
  "c-essential-targeting":    {targeting_matrix_chart},
  "c-essential-budget":       {budget_scenario},
  "c-bar-channel":       {bar_channel},
  "c-donut-won":         {donut_won},
  "c-monthly-trend":     {monthly_trend},
  "c-attrib-comparison": {attrib_comparison},
  "c-sourced-influenced":{sourced_influenced},
  "c-attrib-waterfall":  {attrib_waterfall},
  "c-spend-pipeline":    {spend_pipeline},
  "c-funnel":            {funnel},
  "c-seg-heatmap":       {seg_heatmap},
  "c-seg-winrate":       {seg_winrate},
  "c-creative-ctr":      {creative_ctr},
  "c-creative-attr":     {creative_attr},
  "c-email-seniority":   {email_seniority},
  "c-budget-scenario":   {budget_scenario},
  "c-feat-imp":          {feat_imp_chart},
  "c-win-prob":          {win_prob_chart},
  "c-account-coverage":  {account_coverage_chart},
  "c-deal-velocity":     {deal_velocity_chart},
  "c-journey":           {journey_chart},
  "c-targeting-matrix":  {targeting_matrix_chart},
  "c-cohort":            {cohort_chart},
}};

const CHART_META = {{
  "c-essential-contribution": ["Question: how do CRM source credit and linked-journey credit differ?", "Population: sourced uses the CRM source population; influenced uses 695 touch-linked opportunities.", "Decision use: report both numbers with coverage, using sourced as conservative credit and influenced as linked-journey context."],
  "c-essential-coverage": ["Question: where is the largest measurable coverage test?", "Population: CRM account domains; groups are observational, not randomized.", "Decision use: test coverage with a holdout before claiming incremental lift."],
  "c-essential-cohort": ["Question: is growth protecting conversion quality?", "Population: opportunities by create quarter; win rate uses resolved deals only.", "Decision use: compare mature cohorts and keep low-resolution recent cohorts provisional."],
  "c-essential-targeting": ["Question: which account cells deserve ABM focus?", "Population: opportunities with segment and profile fit.", "Decision use: prioritize high-fit cells before expanding reach."],
  "c-essential-budget": ["Question: what budget tests are worth considering?", "Population: tracked-spend channels only.", "Decision use: use scenarios to size tests, not to promise revenue."],
  "c-bar-channel": ["Question: which CRM-sourced channels create the most pipeline?", "Population: all deduplicated opportunities.", "Benchmark: compare each bar against total pipeline share."],
  "c-donut-won": ["Question: which channels actually closed revenue?", "Population: closed-won opportunities only.", "Caution: low-volume channels can swing sharply."],
  "c-monthly-trend": ["Question: is pipeline creation changing over time?", "Population: opportunities with a create date; top five channels plus Other.", "Benchmark: look for sustained movement, not one-month spikes."],
  "c-attrib-comparison": ["Question: how does multi-touch credit change by model?", "Population: common touchpoint-linked channels across first-touch, last-touch, linear, and time-decay.", "Caution: sourced and influenced use different definitions and are shown separately."],
  "c-sourced-influenced": ["Question: how do CRM source credit and linked-journey credit compare?", "Population: sourced uses CRM source mapping; influenced covers 695 opportunities linked to eligible touches.", "Caution: influenced must be reported with its 21.1% opportunity and 11.7% won-opportunity coverage."],
  "c-attrib-waterfall": ["Question: which channels gain or lose credit near conversion?", "Population: first-touch vs last-touch attribution.", "Caution: this describes journey role, not causality."],
  "c-spend-pipeline": ["Question: where does tracked spend appear efficient?", "Population: channels with reliable spend.", "Caution: ROI excludes untracked channels."],
  "c-funnel": ["Question: what is the volume by channel activity and opportunity outcome?", "Population: separate activity populations, not one sequential funnel.", "Caution: do not read cross-channel bars as conversion steps."],
  "c-seg-heatmap": ["Question: which segment/industry cells hold pipeline?", "Population: opportunities with segment and industry values.", "Benchmark: prioritize cells with both value and enough volume."],
  "c-seg-winrate": ["Question: which segments convert most reliably?", "Population: deduplicated opportunities by segment; labels include deal count and average deal.", "Caution: this is a three-segment comparison, not a relationship analysis."],
  "c-creative-ctr": ["Question: which ad creatives earn attention?", "Population: creative rows with impressions and clicks.", "Benchmark: compare CTR before scaling spend."],
  "c-creative-attr": ["Question: which creative attributes correlate with engagement?", "Population: grouped creative metadata.", "Caution: this is correlation, not message causality."],
  "c-email-seniority": ["Question: which seniority contributes click events?", "Population: recorded email engagement events; no delivered-message denominator is available.", "Caution: this is event composition, not a send-based click rate."],
  "c-budget-scenario": ["Question: how much tracked budget should be reserved for measurement?", "Population: two tracked-spend channels; one has a single opportunity and neither has recorded won revenue.", "Decision use: choose a budget-neutral holdout plan, not a revenue forecast."],
  "c-feat-imp": ["Question: what signals drive the win model?", "Population: closed opportunities used for training.", "Caution: importance is predictive, not causal."],
  "c-win-prob": ["Question: how are active opportunities distributed by predicted probability?", "Population: active scored opportunities only; evaluation used a time-based holdout of resolved deals.", "Decision use: pilot bands for prioritization before setting an operating cutoff."],
  "c-account-coverage": ["Question: where is the account coverage gap?", "Population: CRM account domains; volume and opportunity rate use separate panels.", "Caution: reached-account rates are observational and may reflect selection or sales activity."],
  "c-deal-velocity": ["Question: how long do won deals take by channel?", "Population: closed-won opportunities with valid close dates and at least five wins per channel.", "Caution: medians describe historical cases, not guaranteed sales-cycle timing."],
  "c-journey": ["Question: what touchpoint sequences appear before wins?", "Population: won deals with linked pre-opportunity touchpoints.", "Caution: sequences are descriptive."],
  "c-targeting-matrix": ["Question: which segment/profile-fit cells deserve ABM priority?", "Population: opportunities with segment and profile fit; every cell shows n.", "Caution: cells below 30 deals are exploratory regardless of color."],
  "c-cohort": ["Question: is pipeline growth protecting conversion quality?", "Population: opportunities by create quarter; win rate uses resolved deals only.", "Benchmark: use the resolved-share line to identify provisional cohorts."]
}};

const CHART_STORY = {{
  "c-essential-contribution": {{
    finding: "Linked influenced pipeline is larger than CRM-sourced pipeline within its defined population.",
    meaning: "Touch linkage adds journey context for 695 opportunities; it does not cover the full opportunity population.",
    action: "Report sourced as conservative credit and place linkage coverage beside influenced credit."
  }},
  "c-essential-coverage": {{
    finding: "A large share of CRM account domains still has no tracked email or 6sense touch.",
    meaning: "The largest measurable opportunity is testing coverage among strong-fit accounts already in the ICP universe.",
    action: "Launch a strong-fit account coverage test with a holdout group before claiming lift."
  }},
  "c-essential-cohort": {{
    finding: "Pipeline volume rises while closed-deal win rate softens across sufficiently resolved cohorts.",
    meaning: "Recent unresolved cohorts cannot be compared directly with mature cohorts, but the mature trend still warrants review.",
    action: "Audit ICP and qualification before scaling broad top-of-funnel spend."
  }},
  "c-essential-targeting": {{
    finding: "Adjusted win rate varies by segment and 6sense profile fit.",
    meaning: "Decision-grade cells can narrow the population for an ABM coverage test; low-sample cells remain exploratory.",
    action: "Prioritize decision-grade high-fit cells within a controlled coverage experiment."
  }},
  "c-essential-budget": {{
    finding: "Tracked-spend evidence is too sparse to identify an optimal mix.",
    meaning: "The responsible budget decision is to create causal evidence before scaling.",
    action: "Reserve a holdout and experiment pool, then measure incremental qualified pipeline."
  }},
  "c-bar-channel": {{
    finding: "Pipeline is concentrated in a small set of source channels.",
    meaning: "Channel scale and channel quality need to be evaluated separately.",
    action: "Pair pipeline ranking with closed win rate, sample size, and deal velocity before forming a channel hypothesis."
  }},
  "c-sourced-influenced": {{
    finding: "Linked-journey credit is larger than CRM source credit within its defined population.",
    meaning: "The difference reflects allocation scope and touch linkage, not incremental lift.",
    action: "Use both views in CMO reporting and place linked-opportunity coverage beside influenced credit."
  }},
  "c-account-coverage": {{
    finding: "Many CRM account domains are not yet covered by tracked marketing touches.",
    meaning: "Unreached strong-fit accounts create a clean audience for learning without changing the ICP universe.",
    action: "Build a randomized or phased coverage test for unreached strong-fit accounts."
  }},
  "c-cohort": {{
    finding: "Pipeline and conversion quality are moving in different directions.",
    meaning: "More pipeline is not automatically better pipeline.",
    action: "Make quality control part of every growth recommendation."
  }},
  "c-targeting-matrix": {{
    finding: "Some segment/profile-fit combinations are much stronger than others.",
    meaning: "The best strategy is targeted growth, not equal coverage everywhere.",
    action: "Shift premium ABM effort to cells with stronger fit and win rate."
  }},
  "c-budget-scenario": {{
    finding: "The spend data supports measurement design, not optimization.",
    meaning: "Two tracked paid channels with sparse won outcomes cannot identify an optimal mix.",
    action: "Reserve a holdout and experiment pool before any scale decision."
  }}
}};

const PLOTLY_CONFIG = {{responsive:true, displayModeBar:true, displaylogo:false,
  modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d']}};

function showChartState(el, title, detail) {{
  el.innerHTML = `<div class="chart-empty"><div><strong>${{title}}</strong><span>${{detail}}</span></div></div>`;
}}

function addChartCaption(el, id) {{
  const meta = CHART_META[id];
  const story = CHART_STORY[id];
  if ((!meta && !story) || el.parentElement.querySelector('.chart-caption')) return;
  const caption = document.createElement('div');
  caption.className = 'chart-caption';
  const metaHtml = meta ? `<div class="caption-row"><span class="caption-pill">Question</span><strong>${{meta[0].replace('Question: ', '')}}</strong></div><div>${{meta[1]}}</div><div>${{meta[2]}}</div>` : '';
  const storyHtml = story ? `<div class="chart-story">
    <div class="story-step"><strong>Finding</strong>${{story.finding}}</div>
    <div class="story-step"><strong>Meaning</strong>${{story.meaning}}</div>
    <div class="story-step action"><strong>Action</strong>${{story.action}}</div>
  </div>` : '';
  caption.innerHTML = metaHtml + storyHtml;
  el.parentElement.appendChild(caption);
}}

Object.entries(CHARTS).forEach(([id, spec]) => {{
  const el = document.getElementById(id);
  if (!el) return;
  if (!window.Plotly) {{
    showChartState(el, 'Chart library unavailable', 'The embedded Plotly bundle could not be initialized. Refresh the file and retry.');
    return;
  }}
  if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {{
    showChartState(el, 'No chart data', 'This view has no records after the current data filters.');
    return;
  }}
  try {{
    const mobile = window.innerWidth <= 520;
    const chartData = mobile ? spec.data.map(trace => {{
      if (trace.type === 'bar' && trace.orientation === 'h') return {{...trace, textposition: 'outside', cliponaxis: false}};
      if (trace.type === 'bar') return {{...trace, textposition: trace.textposition === 'outside' ? 'auto' : trace.textposition}};
      return trace;
    }}) : spec.data;
    const chartLayout = JSON.parse(JSON.stringify(spec.layout || {{}}));
    if (mobile) {{
      const hasHorizontalBar = chartData.some(trace => trace.type === 'bar' && trace.orientation === 'h');
      chartLayout.height = Math.max(Number(chartLayout.height || 0), 430);
      chartLayout.margin = {{...(chartLayout.margin || {{}}), l: hasHorizontalBar ? 145 : 72, r: hasHorizontalBar ? 40 : 22, t: 92, b: 100}};
      chartLayout.legend = {{...(chartLayout.legend || {{}}), orientation: 'h', x: 0, xanchor: 'left', y: -0.22, yanchor: 'top'}};
      chartLayout.title = typeof chartLayout.title === 'string'
        ? {{text: chartLayout.title, font: {{size: 13}}, x: 0, xanchor: 'left'}}
        : {{...(chartLayout.title || {{}}), font: {{...((chartLayout.title || {{}}).font || {{}}), size: 13}}, x: 0, xanchor: 'left'}};
    }}
    Plotly.newPlot(el, chartData, chartLayout, PLOTLY_CONFIG);
    addChartCaption(el, id);
  }} catch (err) {{
    showChartState(el, 'Chart could not render', err && err.message ? err.message : 'Unexpected chart rendering error.');
  }}
}});

function parseCellValue(text) {{
  const raw = text.trim();
  const numeric = Number(raw.replace(/[$,%xKMB,\s]/g, '').replace(/^-$/, ''));
  if (raw.endsWith('M')) return numeric * 1000000;
  if (raw.endsWith('K')) return numeric * 1000;
  if (!Number.isNaN(numeric) && raw !== '' && raw !== '-') return numeric;
  return raw.toLowerCase();
}}

function makeTablesSortable() {{
  document.querySelectorAll('.dash-table').forEach(table => {{
    if (!table.querySelector('caption')) {{
      const caption = document.createElement('caption');
      const sectionTitle = table.closest('.section')?.querySelector('.section-title')?.textContent?.trim() || 'Dashboard data';
      caption.textContent = `${{sectionTitle}} table. Sort by any column or download it as CSV.`;
      table.prepend(caption);
    }}
    const headers = Array.from(table.querySelectorAll('thead th'));
    headers.forEach((th, idx) => {{
      th.dataset.sort = 'true';
      th.setAttribute('tabindex', '0');
      th.setAttribute('aria-sort', 'none');
      th.setAttribute('aria-label', `${{th.textContent.trim()}}. Activate to sort.`);
      const sortTable = () => {{
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const nextAsc = !th.classList.contains('sort-asc');
        headers.forEach(h => {{ h.classList.remove('sort-asc', 'sort-desc'); h.setAttribute('aria-sort', 'none'); }});
        th.classList.add(nextAsc ? 'sort-asc' : 'sort-desc');
        th.setAttribute('aria-sort', nextAsc ? 'ascending' : 'descending');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {{
          const av = parseCellValue(a.children[idx]?.textContent || '');
          const bv = parseCellValue(b.children[idx]?.textContent || '');
          if (typeof av === 'number' && typeof bv === 'number') return nextAsc ? av - bv : bv - av;
          return nextAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        }});
        rows.forEach(row => tbody.appendChild(row));
      }};
      th.addEventListener('click', sortTable);
      th.addEventListener('keydown', event => {{
        if (event.key === 'Enter' || event.key === ' ') {{ event.preventDefault(); sortTable(); }}
      }});
    }});
  }});
}}

function showTableEmptyStates() {{
  document.querySelectorAll('.dash-table').forEach(table => {{
    const tbody = table.querySelector('tbody');
    if (!tbody || tbody.children.length) return;
    const empty = document.createElement('div');
    empty.className = 'table-empty';
    empty.textContent = 'No table rows are available for this dataset.';
    table.parentElement.appendChild(empty);
  }});
}}

function applyMetricLens(lens) {{
  document.querySelectorAll('.lens-button').forEach(btn => {{
    const active = btn.dataset.lens === lens;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }});
  document.querySelectorAll('.dash-table').forEach(table => {{
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.toLowerCase());
    table.querySelectorAll('tr').forEach(row => {{
      Array.from(row.children).forEach((cell, idx) => {{
        const h = headers[idx] || '';
        const isDollar = h.includes('pipeline') || h.includes('revenue') || h.includes('deal size') || h.includes('spend') || h.includes('why');
        const isRate = h.includes('rate') || h.includes('roi') || h.includes('confidence');
        const isCount = h.includes('deals') || h.includes('priority') || h.includes('channel') || h.includes('action');
        const show = lens === 'all' || (lens === 'dollars' && isDollar) || (lens === 'rates' && isRate) || (lens === 'counts' && isCount);
        cell.style.display = show ? '' : 'none';
      }});
    }});
  }});
  localStorage.setItem('metricLens', lens);
}}

document.querySelectorAll('.lens-button').forEach(btn => {{
  btn.addEventListener('click', () => applyMetricLens(btn.dataset.lens));
}});

function addMetricTooltips() {{
  const defs = {{
    'Total Pipeline':'All opportunity amount across deduplicated deals.',
    'Won Revenue':'Opportunity amount for deals marked closed won.',
    'Mktg-Sourced Pipeline':'Pipeline where CRM lead source maps to a marketing channel.',
    'Influenced Pipeline':'Pipeline from accounts with marketing touchpoints before opportunity creation.'
  }};
  document.querySelectorAll('.kpi-label').forEach(label => {{
    const text = label.textContent.trim();
    if (defs[text]) label.setAttribute('title', defs[text]);
  }});
}}

function addTableExports() {{
  document.querySelectorAll('.dash-table').forEach((table, idx) => {{
    const wrap = table.closest('.table-wrap');
    if (!wrap || wrap.parentElement.querySelector(`[data-export-for="${{table.id || idx}}"]`)) return;
    const button = document.createElement('button');
    button.className = 'action-button export-button';
    button.type = 'button';
    button.dataset.exportFor = table.id || String(idx);
    button.innerHTML = '<i data-lucide="download" aria-hidden="true"></i><span>CSV</span>';
    button.addEventListener('click', () => {{
      const rows = Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.children).filter(cell => cell.style.display !== 'none').map(cell =>
          `"${{cell.textContent.trim().replace(/"/g, '""')}}"`
        ).join(',')
      ).join('\\n');
      const blob = new Blob([rows], {{type:'text/csv;charset=utf-8;'}});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${{table.id || 'dashboard-table'}}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }});
    wrap.parentElement.insertBefore(button, wrap);
  }});
}}

// Channel table
const channelRows = {channel_rows};
const ctbody = document.getElementById('channel-tbody');
if(ctbody && channelRows) {{
  channelRows.forEach(r => {{
    const roi = r.pipeline_roi === null || r.pipeline_roi === undefined ? '-' : r.pipeline_roi.toFixed(1)+'x';
    const rroi = r.revenue_roi === null || r.revenue_roi === undefined ? '-' : r.revenue_roi.toFixed(1)+'x';
    const wr = r.win_rate === null || r.win_rate === undefined ? '-' : (r.win_rate*100).toFixed(1)+'%';
    const cls = r.pipeline_roi && r.pipeline_roi > 5 ? 'green-text' : (r.pipeline_roi && r.pipeline_roi < 2 ? 'red-text' : '');
    const lowSample = r.won_count !== null && r.won_count !== undefined && r.won_count > 0 && r.won_count < 5;
    ctbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel_category}}</span></td>
      <td>${{r.deal_count}}</td>
      <td>${{r.resolved_count}}</td>
      <td>${{(r.total_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{(r.won_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{wr}}</td>
      <td>${{r.avg_deal_size ? '$'+(r.avg_deal_size/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.channel_spend ? '$'+(r.channel_spend/1e3).toFixed(0)+'K' : '$0'}}</td>
      <td class="${{cls}}">${{roi}}</td>
      <td>${{rroi}}${{lowSample ? ' <span class="low-sample" title="Low won-deal sample size">Low N</span>' : ''}}</td>
    </tr>`;
  }});
}}

// Attribution table
const attribRows = {attrib_rows};
const atbody = document.getElementById('attrib-tbody');
if(atbody && attribRows) {{
  attribRows.forEach(r => {{
    const bestModel = r.td > r.ft && r.td > r.lt && r.td > r.lin ? 'Time-Decay' :
                      r.lin > r.ft && r.lin > r.lt ? 'Linear' :
                      r.lt > r.ft ? 'Last-Touch' : 'First-Touch';
    atbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel}}</span></td>
      <td>${{r.ft ? '$'+(r.ft/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.lt ? '$'+(r.lt/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.lin ? '$'+(r.lin/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.td ? '$'+(r.td/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.sourced ? '$'+(r.sourced/1e3).toFixed(0)+'K' : '-'}}</td>
      <td>${{r.influenced ? '$'+(r.influenced/1e3).toFixed(0)+'K' : '-'}}</td>
      <td class="green-text">${{bestModel}}</td>
    </tr>`;
  }});
}}
makeTablesSortable();
showTableEmptyStates();
addMetricTooltips();
addTableExports();
applyMetricLens(localStorage.getItem('metricLens') || 'all');
if (window.lucide) {{
  lucide.createIcons();
}}
</script>
</body>
</html>
"""


# -----------------------------------------------------------------------------
# Build and write HTML
# -----------------------------------------------------------------------------
def build_channel_rows():
    if channel_pipeline.empty:
        return "[]"
    rows = []
    for _, r in channel_pipeline.iterrows():
        rows.append({
            "channel_category": str(r.get("channel_category", "")),
            "deal_count": int(r.get("deal_count", 0)),
            "resolved_count": int(r.get("resolved_count", 0) or 0),
            "won_count": int(r.get("won_count", 0) or 0),
            "total_pipeline": float(r.get("total_pipeline", 0) or 0),
            "won_pipeline": float(r.get("won_pipeline", 0) or 0),
            "win_rate": float(r.get("win_rate", 0) or 0),
            "avg_deal_size": float(r.get("avg_deal_size", 0) or 0),
            "channel_spend": float(r.get("channel_spend", 0) or 0),
            "pipeline_roi": float(r.get("pipeline_roi", 0) or 0) if pd.notna(r.get("pipeline_roi")) else None,
            "revenue_roi": float(r.get("revenue_roi", 0) or 0) if pd.notna(r.get("revenue_roi")) else None,
        })
    return json.dumps(rows)


def build_attrib_rows():
    if attribution.empty:
        return "[]"
    def _get(model, channel):
        m = attribution[(attribution["attribution_model"] == model) & (attribution["channel"] == channel)]
        return float(m["attributed_pipeline"].sum()) if not m.empty else 0
    channels = attribution["channel"].unique().tolist()
    rows = []
    for ch in channels:
        rows.append({
            "channel": ch,
            "ft":       _get("First-Touch", ch),
            "lt":       _get("Last-Touch", ch),
            "lin":      _get("Linear", ch),
            "td":       _get("Time-Decay", ch),
            "sourced":  _get("Marketing Sourced", ch),
            "influenced": _get("Marketing Influenced", ch),
        })
    return json.dumps(rows)


def influenced_pipeline_val():
    if attribution.empty: return "$0"
    v = attribution[attribution["attribution_model"] == "Marketing Influenced"]["attributed_pipeline"].sum()
    return fmt(v)


def main():
    os.makedirs(os.path.dirname(OUTPUT_HTML), exist_ok=True)
    print("Building interactive HTML dashboard ...")
    coverage_vals = coverage_summary_vals()
    cohort_vals = cohort_summary_vals()
    quality_vals = dashboard_quality_vals()
    attribution_vals = attribution_scope_vals()
    email_vals = email_scope_vals()

    print("  Rendering charts ...")
    charts = {
        "bar_channel":            fig_json(channel_bar()),
        "donut_won":              fig_json(channel_donut()),
        "monthly_trend":          fig_json(monthly_pipeline_trend()),
        "attrib_comparison":      fig_json(attribution_comparison()),
        "sourced_influenced":     fig_json(sourced_vs_influenced()),
        "attrib_waterfall":       fig_json(attribution_waterfall()),
        "spend_pipeline":         fig_json(spend_vs_pipeline()),
        "funnel":                 fig_json(funnel_fig()),
        "seg_heatmap":            fig_json(segment_heatmap()),
        "seg_winrate":            fig_json(segment_win_rate()),
        "creative_ctr":           fig_json(creative_ctr_bar()),
        "creative_attr":          fig_json(creative_attr_chart()),
        "email_seniority":        fig_json(email_seniority()),
        "budget_scenario":        fig_json(budget_scenario_chart()),
        # Advanced Analytics
        "feat_imp_chart":         fig_json(feature_importance_chart()),
        "win_prob_chart":         fig_json(win_prob_chart()),
        "account_coverage_chart": fig_json(account_coverage_chart()),
        "deal_velocity_chart":    fig_json(deal_velocity_chart()),
        "journey_chart":          fig_json(journey_chart()),
        "targeting_matrix_chart": fig_json(targeting_matrix_chart()),
        "cohort_chart":           fig_json(cohort_chart()),
    }

    html = HTML_TEMPLATE.format(
        plotly_bundle=get_plotlyjs(),
        total_deals=f"{total_deals:,}",
        resolved_deals=f"{resolved_deals:,}",
        total_pipeline=fmt(total_pipeline),
        won_pipeline=fmt(won_pipeline),
        mktg_pipeline=fmt(mktg_pipeline),
        win_rate=f"{win_rate:.1%}",
        mktg_pct=f"{mktg_pct:.1%}",
        influenced_pipeline=influenced_pipeline_val(),
        generated_at=datetime.now().strftime("%b %d, %Y %I:%M %p"),
        model_auc=model_auc_text(),
        model_validation=model_validation_text(),
        open_deals=f"{open_deals:,}",
        data_year_range=data_year_range,
        sourced_pipeline=sourced_pipeline_val(),
        top_sourced_channels=top_sourced_channels_text(),
        top_won_channels=top_won_channels_text(),
        tracked_spend_channels=tracked_spend_channels_text(),
        **quality_vals,
        **coverage_vals,
        **cohort_vals,
        **attribution_vals,
        **email_vals,
        channel_rows=build_channel_rows(),
        attrib_rows=build_attrib_rows(),
        **charts,
    )
    html = clean_generated_html(html)

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    context = build_dashboard_context()
    with open(OUTPUT_CONTEXT, "w", encoding="utf-8") as f:
        json.dump(context, f, indent=2)
    os.makedirs(os.path.dirname(PUBLIC_HTML), exist_ok=True)
    shutil.copyfile(OUTPUT_HTML, PUBLIC_HTML)
    shutil.copyfile(OUTPUT_CONTEXT, PUBLIC_CONTEXT)

    size_kb = os.path.getsize(OUTPUT_HTML) / 1024
    print(f"  OK Saved -> {OUTPUT_HTML}")
    print(f"  OK Copied -> {PUBLIC_HTML}")
    print(f"  OK Context -> {PUBLIC_CONTEXT}")
    print(f"  File size: {size_kb:.0f} KB")
    print("\n  Open in any browser - no server required.")


if __name__ == "__main__":
    main()
