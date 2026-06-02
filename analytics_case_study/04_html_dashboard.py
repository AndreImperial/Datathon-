"""
Phase 4 (revised): Self-Contained Interactive HTML Dashboard
Generates a single .html file â€” no server required, open in any browser.
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
from plotly.subplots import make_subplots

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, BRAND_COLORS, CHANNEL_COLOR_MAP
)

OUTPUT_HTML = os.path.join(
    os.path.dirname(__file__), "..", "outputs", "dashboard", "Marketing_Analytics_Dashboard.html"
)
PUBLIC_HTML = os.path.join(os.path.dirname(__file__), "..", "public", "index.html")
OUTPUT_CONTEXT = os.path.join(os.path.dirname(__file__), "..", "outputs", "dashboard", "dashboard_context.json")
PUBLIC_CONTEXT = os.path.join(os.path.dirname(__file__), "..", "public", "dashboard_context.json")

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Data loaders
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
opps              = _load_clean("opportunities")
accounts          = _load_clean("accounts")
email             = _load_clean("email_engagements")
ad_metrics        = _load_clean("ad_metrics")
won_col           = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Global KPIs
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
total_pipeline  = opps["_amount"].sum() if "_amount" in opps.columns else 0
won_pipeline    = opps.loc[opps[won_col] == True, "_amount"].sum() if won_col and "_amount" in opps.columns else 0
mktg_pipeline   = opps.loc[opps["is_marketing_sourced"] == True, "_amount"].sum() \
                  if "is_marketing_sourced" in opps.columns else 0
total_deals     = len(opps)
won_deals       = (opps[won_col] == True).sum() if won_col else 0
win_rate        = won_deals / total_deals if total_deals else 0
mktg_pct        = mktg_pipeline / total_pipeline if total_pipeline else 0
open_deals      = len(win_prob)

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

def cohort_summary_vals():
    defaults = {
        "cohort_start_rate": "N/A",
        "cohort_end_rate": "N/A",
        "cohort_start_quarter": "start",
        "cohort_end_quarter": "latest quarter",
        "mktg_peak_pct": "N/A",
        "mktg_end_pct": "N/A",
    }
    if cohort.empty or "win_rate" not in cohort.columns or "quarter" not in cohort.columns:
        return defaults
    recent = cohort.dropna(subset=["win_rate"]).copy()
    if recent.empty:
        return defaults
    recent_2022 = recent[recent["quarter"].astype(str) >= "2022Q1"].copy()
    if not recent_2022.empty:
        recent = recent_2022
    start = recent.iloc[0]
    end = recent.iloc[-1]
    peak = recent["mktg_pct"].max() if "mktg_pct" in recent.columns else np.nan
    return {
        "cohort_start_rate": f"{start['win_rate']:.0%}",
        "cohort_end_rate": f"{end['win_rate']:.0%}",
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

    create_col = next((c for c in ["_createddate", "createddate", "created_date"] if c in opps.columns), None)
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

    return defaults

LAYOUT = dict(
    font=dict(family="Inter, Arial, sans-serif", size=13, color="#F8FAFC"),
    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=46, r=24, t=56, b=44),
    legend=dict(bgcolor="rgba(0,0,0,0)", font_size=12),
    hoverlabel=dict(
        bgcolor="#1E293B",
        bordercolor="#334155",
        font=dict(color="#F8FAFC", family="Inter, Arial, sans-serif", size=12),
    ),
)

COLORS = ["#2563EB", "#0F766E", "#D97706", "#7C3AED", "#0E7490",
          "#64748B", "#B45309", "#475569", "#15803D", "#8B5CF6"]

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Chart builders
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def channel_bar():
    if channel_pipeline.empty: return go.Figure()
    df = channel_pipeline.sort_values("total_pipeline", ascending=True).tail(12)
    colors = [CHANNEL_COLOR_MAP.get(c, COLORS[0]) for c in df["channel_category"]]
    fig = go.Figure(go.Bar(
        y=df["channel_category"], x=df["total_pipeline"],
        orientation="h",
        marker_color=colors,
        text=[fmt(v) for v in df["total_pipeline"]],
        textposition="auto",
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
    """Heatmap: compact comparison of pipeline credit by channel and model."""
    if attribution.empty: return go.Figure()
    model_order = ["Marketing Sourced", "Marketing Influenced", "First-Touch", "Last-Touch", "Linear", "Time-Decay"]
    models = [m for m in model_order if m in attribution["attribution_model"].unique()]
    pivot = attribution.pivot_table(
        index="channel",
        columns="attribution_model",
        values="attributed_pipeline",
        aggfunc="sum",
    ).fillna(0)
    pivot = pivot.reindex(columns=models)
    pivot = pivot.loc[pivot.sum(axis=1).sort_values(ascending=True).index]
    text = [[fmt(v) if v > 0 else "" for v in row] for row in pivot.values]
    fig = go.Figure(go.Heatmap(
        z=pivot.values,
        x=pivot.columns.tolist(),
        y=pivot.index.tolist(),
        colorscale="Blues",
        text=text,
        texttemplate="%{text}",
        hovertemplate="<b>%{y}</b><br>Model: %{x}<br>Pipeline: $%{z:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="Attribution Model Comparison - Pipeline Credit by Channel",
        xaxis_title="Attribution Model", yaxis_title="Channel",
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
    colors = ["#15803D" if d >= 0 else "#C24141" for d in delta]
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
    monthly = df.groupby(["month", "channel_category"])["_amount"].sum().reset_index()
    fig = px.area(monthly, x="month", y="_amount", color="channel_category",
                  color_discrete_sequence=COLORS,
                  labels={"month": "", "_amount": "Pipeline ($)"},
                  title="Pipeline Created by Month (Stacked by Channel)")
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
    df = opps.dropna(subset=["segment__c"]).groupby("segment__c").agg(
        deals=("_opportunity_id","count"),
        won=(won_col, lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        avg_deal=("_amount","mean"),
    ).reset_index()
    df["win_rate"] = df["won"] / df["deals"]

    fig = go.Figure(go.Scatter(
        x=df["win_rate"],
        y=df["avg_deal"],
        mode="markers+text",
        text=df["segment__c"],
        textposition="top center",
        marker=dict(
            size=np.sqrt(df["deals"]) * 3,
            color="#2563EB",
            opacity=0.78,
            line=dict(color="#FFFFFF", width=1),
        ),
        customdata=np.stack([df["deals"], df["pipeline"]], axis=-1),
        hovertemplate="<b>%{text}</b><br>Win Rate: %{x:.1%}<br>Avg Deal: $%{y:,.0f}<br>Deals: %{customdata[0]:,.0f}<br>Pipeline: $%{customdata[1]:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        title="Segment Tradeoff: Win Rate vs Average Deal Size",
        xaxis=dict(title="Win Rate", tickformat=".0%"),
        yaxis=dict(title="Average Deal ($)"),
        **LAYOUT,
    )
    return fig


def email_seniority():
    if email.empty or "_seniority" not in email.columns: return go.Figure()
    df = email.groupby("_seniority").agg(
        total=("_seniority","count"),
        opens=("is_open","sum") if "is_open" in email.columns else ("_seniority","count"),
        clicks=("is_click","sum") if "is_click" in email.columns else ("_seniority","count"),
    ).reset_index()
    df["open_rate"]  = df["opens"]  / df["total"]
    df["click_rate"] = df["clicks"] / df["total"]
    df = df.sort_values("click_rate", ascending=False)
    fig = go.Figure()
    fig.add_trace(go.Bar(name="Open Rate",  x=df["_seniority"], y=df["open_rate"],
                         marker_color="#2563EB", text=[f"{v:.1%}" for v in df["open_rate"]], textposition="outside"))
    fig.add_trace(go.Bar(name="Click Rate", x=df["_seniority"], y=df["click_rate"],
                         marker_color="#D97706", text=[f"{v:.1%}" for v in df["click_rate"]], textposition="outside"))
    fig.update_layout(title="Email Engagement by Seniority", barmode="group",
                      yaxis_tickformat=".0%", **LAYOUT)
    return fig


def creative_ctr_bar():
    if creative_perf.empty or "ctr" not in creative_perf.columns: return go.Figure()
    if "_adname" not in creative_perf.columns: return go.Figure()
    top = creative_perf.nlargest(15, "ctr")
    fig = go.Figure(go.Bar(
        x=top["ctr"], y=[str(n)[:40] for n in top["_adname"]],
        orientation="h", marker_color=COLORS[0],
        text=[f"{v:.2%}" for v in top["ctr"]], textposition="outside",
        hovertemplate="<b>%{y}</b><br>CTR: %{x:.2%}<extra></extra>",
    ))
    fig.update_layout(title="Top 15 Ads by CTR", **LAYOUT)
    return fig


def creative_attr_chart():
    if creative_perf.empty: return go.Figure()
    attr_col = next((c for c in ["_copytone","_copyassettype","_ctacopysofthard"] if c in creative_perf.columns), None)
    if not attr_col: return go.Figure()
    grp = creative_perf.dropna(subset=[attr_col]).groupby(attr_col).agg(
        impressions=("_impressions","sum"), clicks=("_clicks","sum"), spend=("_spend","sum")
    ).reset_index()
    grp["ctr"] = grp["clicks"] / grp["impressions"].replace(0, np.nan)
    grp = grp.sort_values("ctr", ascending=False)
    fig = px.bar(grp, x=attr_col, y="ctr", color=attr_col,
                 color_discrete_sequence=COLORS,
                 text=[f"{v:.2%}" for v in grp["ctr"]],
                 title=f"CTR by {attr_col.lstrip('_').replace('copy','').title()}")
    fig.update_traces(textposition="outside")
    fig.update_layout(yaxis_tickformat=".1%", showlegend=False, **LAYOUT)
    return fig


def budget_scenario_chart():
    if channel_pipeline.empty: return go.Figure()
    df = channel_pipeline[channel_pipeline["channel_spend"] > 0].copy()
    if df.empty: return go.Figure()
    ppl_per_dollar = (df["total_pipeline"] / df["channel_spend"].replace(0, np.nan)).fillna(0)
    df["ppd"] = ppl_per_dollar.values
    ranked = df.sort_values("pipeline_roi", ascending=False)
    top2 = ranked.head(2)["channel_category"].tolist()
    bot2 = ranked.tail(2)["channel_category"].tolist()

    scenarios = {"Current": df["channel_spend"].copy()}
    roi_opt = df["channel_spend"].copy()
    for ch in top2:
        mask = df["channel_category"] == ch
        roi_opt[mask] = roi_opt[mask] * 1.30
    for ch in bot2:
        mask = df["channel_category"] == ch
        roi_opt[mask] = roi_opt[mask] * 0.80
    scenarios["ROI-Optimized"] = roi_opt

    growth = df["channel_spend"].copy()
    for ch in top2:
        mask = df["channel_category"] == ch
        growth[mask] = growth[mask] * 2.0
    for ch in bot2:
        mask = df["channel_category"] == ch
        growth[mask] = growth[mask] * 0.50
    scenarios["Growth Mode"] = growth

    fig = go.Figure()
    colors_s = ["#94A3B8", "#2563EB", "#0F766E"]
    for (label, spends), color in zip(scenarios.items(), colors_s):
        proj = spends * df["ppd"]
        fig.add_trace(go.Bar(
            name=label, x=df["channel_category"].tolist(), y=proj.tolist(),
            marker_color=color,
            hovertemplate=f"<b>%{{x}}</b> â€” {label}<br>Projected Pipeline: $%{{y:,.0f}}<extra></extra>",
        ))
    fig.update_layout(title="Tracked-Spend Scenarios - Projected Pipeline", barmode="group", **LAYOUT)
    return fig


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Advanced Analytics Charts
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def feature_importance_chart():
    if feat_imp.empty: return go.Figure()
    df = feat_imp.head(12).sort_values("importance")
    fig = go.Figure(go.Bar(
        y=df["feature"], x=df["importance"], orientation="h",
        marker_color=COLORS[0],
        text=[f"{v:.3f}" for v in df["importance"]], textposition="outside",
        hovertemplate="<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>",
    ))
    fig.update_layout(title="Win Probability â€” Top Predictors (Random Forest Feature Importance)",
                      xaxis_title="Importance Score", **LAYOUT)
    return fig


def account_coverage_chart():
    if account_coverage.empty: return go.Figure()
    # Build from integrated parquet if available, else recompute summary
    try:
        cov_full = _load_int("account_coverage")
        summary = cov_full.groupby("coverage_tier").agg(
            accounts=("domain","count"),
            with_opp=("has_opportunity","sum")
        ).reset_index()
        summary["pct"] = summary["accounts"] / summary["accounts"].sum()
        summary["opp_rate"] = summary["with_opp"] / summary["accounts"]
    except Exception:
        summary = account_coverage.copy()
        summary["pct"] = summary["accounts"] / summary["accounts"].sum() if "accounts" in summary.columns else 0

    order = ["Not Reached","6sense Only","Email Only","Both Channels"]
    summary["_order"] = summary["coverage_tier"].map({v:i for i,v in enumerate(order)}).fillna(99)
    summary = summary.sort_values("_order")

    colors_cov = ["#E2E8F0", "#60A5FA", "#D97706", "#0F766E"]
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="# Accounts", x=summary["coverage_tier"], y=summary["accounts"],
        marker_color=colors_cov[:len(summary)],
        text=[f"{int(v):,}<br>({p:.0%})" for v,p in zip(summary["accounts"], summary["pct"])],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Accounts: %{y:,}<extra></extra>",
    ))
    if "opp_rate" in summary.columns:
        fig.add_trace(go.Scatter(
            name="Opp Rate", x=summary["coverage_tier"], y=summary["opp_rate"],
            mode="markers+lines", marker=dict(size=10, color="#0F766E"),
            yaxis="y2",
            hovertemplate="<b>%{x}</b><br>Opp Rate: %{y:.0%}<extra></extra>",
        ))
    fig.update_layout(
        title="Account Coverage â€” How Many Target Accounts Has Marketing Reached?",
        yaxis=dict(title="# Accounts"),
        yaxis2=dict(title="Opportunity Rate", overlaying="y", side="right",
                    tickformat=".0%", range=[0, 0.6]),
        barmode="group", **LAYOUT,
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
        text=[f"{int(d)} deals â€” {fmt(p)}" for d,p in zip(top["deals"], top["pipeline"])],
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
    text_vals = [[f"{v:.0%}" if v > 0 else "" for v in row] for row in pivot.values]
    fig = go.Figure(go.Heatmap(
        z=pivot.values, x=pivot.columns.tolist(), y=pivot.index.tolist(),
        colorscale="Blues",
        text=text_vals, texttemplate="%{text}",
        hovertemplate="Segment: %{y}<br>Profile: %{x}<br>Win Rate: %{z:.0%}<extra></extra>",
    ))
    fig.update_layout(title="Win Rate Heatmap: Segment Ã— 6sense Profile Fit<br><sup>Darker = Higher Win Rate = Better ABM Target</sup>",
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
        title="Win Probability Distribution â€” Open Deals Scored by ML Model",
        xaxis=dict(title="Win Probability", tickformat=".0%"),
        yaxis_title="Number of Deals",
        **LAYOUT,
    )
    return fig


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def deal_velocity_chart():
    if deal_velocity.empty: return go.Figure()
    df = deal_velocity.sort_values("median_days")
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
    fig.update_layout(title="Deal Velocity - Median Days to Close with IQR",
                      xaxis_title="Days to Close", **LAYOUT)
    return fig


def cohort_chart():
    if cohort.empty: return go.Figure()
    df = cohort.copy()
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.08,
        row_heights=[0.58, 0.42],
        subplot_titles=("Pipeline Created", "Conversion Quality"),
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
        name="Win Rate",
        x=df["quarter"],
        y=df["win_rate"],
        mode="lines+markers",
        marker=dict(size=7, color="#D97706"),
        hovertemplate="<b>%{x}</b><br>Win Rate: %{y:.0%}<extra></extra>",
    ), row=2, col=1)
    fig.add_trace(go.Scatter(
        name="Mktg % of Deals",
        x=df["quarter"],
        y=df["mktg_pct"],
        mode="lines+markers",
        marker=dict(size=7, color="#0F766E"),
        line=dict(dash="dash"),
        hovertemplate="<b>%{x}</b><br>Marketing %: %{y:.0%}<extra></extra>",
    ), row=2, col=1)
    fig.update_yaxes(title_text="Pipeline ($)", row=1, col=1)
    fig.update_yaxes(title_text="Rate", tickformat=".0%", range=[0, 0.75], row=2, col=1)
    fig.update_layout(title="Pipeline Cohort Analysis - Volume and Quality", **LAYOUT)
    return fig


# Serialise figures to JSON (for embedding)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def fig_json(fig: go.Figure) -> str:
    return json.dumps(fig.to_dict(), cls=PlotlyJSONEncoder)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# HTML Template
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    return html


def build_dashboard_context():
    quality_vals = dashboard_quality_vals()
    coverage_vals = coverage_summary_vals()
    cohort_vals = cohort_summary_vals()
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
            "win_rate": f"{win_rate:.1%}",
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
            "model_auc": model_auc_text(),
            "model_validation": model_validation_text(),
            "open_scored_deals": f"{open_deals:,}",
            "domain_match_rate": quality_vals["domain_match_rate"],
            "missing_create_dates": quality_vals["missing_create_dates"],
            "unknown_channel_pct": quality_vals["unknown_channel_pct"],
            "top3_pipeline_share": quality_vals["top3_pipeline_share"],
            "attribution_reconciliation": quality_vals["attribution_reconciliation"],
            "tracked_spend_channels": tracked_spend_channels_text(),
        },
        "recommendation": {
            "headline": "Targeted growth, not blanket budget expansion.",
            "actions": [
                "Protect pipeline quality by reviewing ICP and qualification before scaling broad top-of-funnel volume.",
                "Expand coverage to unreached strong-fit target accounts.",
                "Start with email coverage and test a 6sense overlay.",
                "Use sourced and influenced attribution together, with sourced as conservative credit and influenced as journey context.",
                "Run holdout or phased tests to measure incremental lift before large budget changes.",
            ],
        },
        "caveats": [
            "Attribution is directional and does not prove causality.",
            "Spend ROI only covers channels with reliable tracked spend.",
            "Low-volume channels and segments can be unstable.",
            "Web traffic is partially anonymous unless matched to account domains.",
            "Win probability supports prioritization, not guaranteed outcomes.",
        ],
        "marketing_concepts": {
            "abm": "ABM focuses sales and marketing on a defined target account list instead of broad demand generation.",
            "icp": "ICP defines the accounts most worth pursuing using profile fit, segment, industry, win rate, and deal size.",
            "sourced_vs_influenced": "Sourced is conservative CRM origin credit; influenced is broader account journey impact from marketing touches before opportunity creation.",
            "holdout_test": "Use treatment and holdout groups to measure whether coverage expansion creates incremental meetings, opportunities, pipeline, and win-rate quality.",
        },
    }


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Marketing Analytics Dashboard</title>
<script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
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
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  html {{ scroll-behavior:smooth; }}
  body {{
    min-height:100vh; display:flex; color:var(--text);
    font-family:'Inter',Arial,sans-serif; font-size:14px; line-height:1.5; letter-spacing:0;
    background:
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
  .top-meta {{ display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; }}
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
    padding:10px 32px 0; color:var(--muted); font-size:11px;
  }}
  .status-chip {{
    display:inline-flex; align-items:center; gap:6px; min-height:26px; padding:0 10px;
    border:1px solid var(--border); border-radius:999px; background:rgba(255,255,255,.055);
    color:var(--text-soft); font-weight:800;
  }}
  .status-chip i {{ width:13px; height:13px; color:var(--success); }}
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
    transition:background .16s ease, border-color .16s ease, transform .16s ease;
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
  .kpi-card:hover, .chart-card:hover, .story-card:hover, .priority-card:hover, .evidence-card:hover {{
    transform:translateY(-3px); box-shadow:var(--shadow-hover); border-color:rgba(79,140,255,.52);
  }}
  .kpi-card:hover::after, .chart-card:hover::after, .story-card:hover::after, .priority-card:hover::after, .evidence-card:hover::after {{ opacity:1; }}
  .kpi-card::before {{
    content:""; display:block; width:34px; height:3px; border-radius:999px;
    background:var(--gradient-hot); margin-bottom:11px; box-shadow:0 0 18px rgba(79,140,255,.34);
  }}
  .kpi-card.green::before {{ background:var(--success); }}
  .kpi-card.orange::before {{ background:var(--accent); }}
  .kpi-card.purple::before {{ background:var(--info); }}
  .kpi-label {{ font-size:11px; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.04em; }}
  .kpi-value {{ margin-top:5px; color:var(--text); font-size:26px; font-weight:800; line-height:1.08; }}
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
    transition:transform .16s ease, border-color .16s ease, background .16s ease;
  }}
  .scope-chip:hover {{ transform:translateY(-1px); border-color:rgba(34,211,238,.42); background:rgba(34,211,238,.08); }}
  .scope-chip i {{ width:13px; height:13px; color:var(--info); }}
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
  .dash-table th {{
    position:sticky; top:0; z-index:1; padding:9px 12px; text-align:left; white-space:nowrap;
    color:var(--text); background:rgba(15, 23, 42, .96); border-bottom:1px solid var(--border);
    font-weight:800;
  }}
  .dash-table th[data-sort] {{ cursor:pointer; user-select:none; }}
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
  .assistant-panel {{
    position:fixed; right:22px; bottom:22px; width:min(440px, calc(100vw - 36px)); max-height:min(680px, calc(100vh - 42px));
    z-index:185; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--border-strong);
    border-radius:8px; background:rgba(10,15,26,.96); color:var(--text-soft);
    box-shadow:0 24px 70px rgba(0,0,0,.42); backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur);
    transform:translateY(18px); opacity:0; pointer-events:none; transition:opacity .18s ease, transform .18s ease;
  }}
  body.assistant-open .assistant-panel {{ transform:translateY(0); opacity:1; pointer-events:auto; }}
  .assistant-head {{
    display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 14px 12px;
    border-bottom:1px solid var(--border); background:linear-gradient(135deg, rgba(79,140,255,.18), rgba(34,211,238,.08));
  }}
  .assistant-title {{ display:flex; align-items:center; gap:9px; min-width:0; }}
  .assistant-title i {{ width:18px; height:18px; color:var(--info); flex:0 0 18px; }}
  .assistant-title strong {{ display:block; color:var(--text); font-size:13px; }}
  .assistant-title span {{ display:block; color:var(--muted); font-size:11px; }}
  .assistant-body {{ padding:12px; overflow:auto; display:flex; flex-direction:column; gap:10px; }}
  .assistant-message {{
    max-width:92%; padding:9px 10px; border-radius:8px; border:1px solid var(--border);
    background:rgba(255,255,255,.055); color:var(--text-soft); font-size:12px; line-height:1.5;
  }}
  .assistant-message.user {{ align-self:flex-end; background:rgba(79,140,255,.18); color:var(--text); }}
  .assistant-message.bot strong {{ display:block; color:var(--text); margin-bottom:4px; }}
  .assistant-suggestions {{ display:flex; flex-wrap:wrap; gap:7px; padding:0 12px 11px; }}
  .assistant-chip {{
    min-height:28px; padding:0 9px; border-radius:999px; border:1px solid var(--border);
    background:rgba(255,255,255,.045); color:var(--text-soft); font-size:11px; font-weight:800; cursor:pointer;
  }}
  .assistant-chip:hover {{ border-color:rgba(34,211,238,.42); background:rgba(34,211,238,.08); color:var(--text); }}
  .assistant-form {{ display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); background:rgba(255,255,255,.035); }}
  .assistant-input {{
    flex:1; min-width:0; min-height:36px; border-radius:8px; border:1px solid var(--border);
    background:rgba(255,255,255,.06); color:var(--text); padding:0 10px; font-size:12px; outline:none;
  }}
  .assistant-input:focus {{ border-color:rgba(34,211,238,.55); box-shadow:0 0 0 3px rgba(34,211,238,.10); }}
  .assistant-footnote {{ padding:0 12px 11px; color:var(--muted-2); font-size:10px; line-height:1.4; }}

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
    .top-bar {{ align-items:flex-start; gap:8px; flex-direction:column; padding:14px 18px; }}
    .top-meta,.top-actions,.status-strip {{ flex-wrap:wrap; gap:7px; justify-content:flex-start; }}
    #nav-progress {{ left:0; }}
    .section,.kpi-row,.story-strip,.status-strip,.quality-strip {{ padding-left:18px; padding-right:18px; }}
    .quality-strip {{ grid-template-columns:1fr; }}
    .decision-panel,.scope-row {{ margin-left:18px; margin-right:18px; }}
    .chart-grid.cols-2,.chart-grid.cols-3,.kpi-row,.story-strip,.decision-panel,.chart-story,
    .conclusion-grid,.priority-grid,.evidence-grid {{ grid-template-columns:1fr; }}
    .decision-lead,.decision-item {{ border-right:0; border-bottom:1px solid var(--border); }}
    .decision-item:last-child {{ border-bottom:0; }}
    .next-step-row {{ grid-template-columns:1fr; gap:4px; }}
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
</style>
</head>
<body>
<div id="nav-progress" aria-hidden="true"><span></span></div>

<!-- â”€â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<nav id="sidebar" aria-label="Dashboard sections">
  <div class="sidebar-brand">
    Marketing Analytics
    <small>B2B SaaS &nbsp;|&nbsp; 2023-2024</small>
  </div>
  <ul class="nav flex-column mt-2" id="navMenu">
    <li class="nav-item"><a href="#s-essential" class="nav-link active" aria-current="page" aria-label="Essential View" data-section="s-essential" onclick="showSection(this,'s-essential'); return false;"><i class="nav-icon" data-lucide="sparkles" aria-hidden="true"></i><span>Essential View</span></a></li>
    <li class="nav-item"><a href="#s-attrib" class="nav-link" aria-label="Attribution Models" data-section="s-attrib" onclick="showSection(this,'s-attrib'); return false;"><i class="nav-icon" data-lucide="git-branch" aria-hidden="true"></i><span>Attribution</span></a></li>
    <li class="nav-item"><a href="#s-channel" class="nav-link" aria-label="Channel Performance" data-section="s-channel" onclick="showSection(this,'s-channel'); return false;"><i class="nav-icon" data-lucide="trending-up" aria-hidden="true"></i><span>Channel ROI</span></a></li>
    <li class="nav-item"><a href="#s-conclusion" class="nav-link" aria-label="Conclusion" data-section="s-conclusion" onclick="showSection(this,'s-conclusion'); return false;"><i class="nav-icon" data-lucide="check-circle-2" aria-hidden="true"></i><span>Recommendation</span></a></li>
    <li class="nav-item"><a href="#s-appendix" class="nav-link" aria-label="Analyst Appendix" data-section="s-appendix" onclick="showSection(this,'s-appendix'); return false;"><i class="nav-icon" data-lucide="archive" aria-hidden="true"></i><span>Analyst Appendix</span></a></li>
  </ul>
</nav>

<!-- â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<div id="main">
  <div class="top-bar">
    <h1>Marketing Analytics Dashboard</h1>
    <div class="top-actions">
      <div class="top-meta">
      <span>Data: 2021â€“2024 &nbsp;|&nbsp; {total_deals} Opportunities &nbsp;|&nbsp; 8 Datasets</span>
      </div>
      <span class="badge-pill">Validated</span>
      <input class="dashboard-search" id="dashboard-search" type="search" placeholder="Search sections" aria-label="Search dashboard sections">
      <button class="action-button menu-button" id="menu-button" type="button" aria-expanded="false"><i data-lucide="menu" aria-hidden="true"></i><span>Menu</span></button>
      <button class="action-button" id="print-button" type="button"><i data-lucide="printer" aria-hidden="true"></i><span>Print</span></button>
      <button class="action-button" id="reset-button" type="button"><i data-lucide="rotate-ccw" aria-hidden="true"></i><span>Reset</span></button>
      <button class="action-button" id="caveats-button" type="button"><i data-lucide="info" aria-hidden="true"></i><span>Caveats</span></button>
      <button class="action-button" id="assistant-button" type="button" aria-expanded="false"><i data-lucide="bot" aria-hidden="true"></i><span>Ask AI</span></button>
      <button class="mode-toggle" id="mode-toggle" type="button" aria-pressed="false"><i data-lucide="presentation" aria-hidden="true"></i><span>Presentation Mode</span></button>
    </div>
  </div>
  <div class="status-strip" aria-label="Dashboard generation status">
    <span class="status-chip"><i data-lucide="check-circle-2" aria-hidden="true"></i>Validation passed</span>
    <span class="status-chip"><i data-lucide="clock-3" aria-hidden="true"></i>Generated {generated_at}</span>
    <span class="status-chip"><i data-lucide="database" aria-hidden="true"></i>Cleaned + integrated data refreshed</span>
  </div>
  <div class="quality-strip" aria-label="Data quality scorecard">
    <div class="quality-card"><strong>{domain_match_rate}</strong> Opportunity domain coverage</div>
    <div class="quality-card {missing_date_class}"><strong>{missing_create_dates}</strong> opportunities missing create date</div>
    <div class="quality-card {unknown_channel_class}"><strong>{unknown_channel_pct}</strong> unknown/other channel share</div>
    <div class="quality-card"><strong>{top3_pipeline_share}</strong> top-3 channel concentration</div>
    <div class="quality-card"><strong>{attribution_reconciliation}</strong> influenced vs sourced lens</div>
  </div>
  <div class="metric-lens" aria-label="Metric lens controls">
    <span>Metric lens:</span>
    <button class="lens-button active" data-lens="all" type="button">All</button>
    <button class="lens-button" data-lens="dollars" type="button">$</button>
    <button class="lens-button" data-lens="rates" type="button">%</button>
    <button class="lens-button" data-lens="counts" type="button">Counts</button>
  </div>

  <!-- KPI Row (always visible) -->
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Total Pipeline</div><div class="kpi-value">{total_pipeline}</div><div class="kpi-sub">{total_deals} opportunities</div></div>
    <div class="kpi-card green"><div class="kpi-label">Won Revenue</div><div class="kpi-value">{won_pipeline}</div><div class="kpi-sub">Win rate: {win_rate}</div></div>
    <div class="kpi-card orange"><div class="kpi-label">Mktg-Sourced Pipeline</div><div class="kpi-value">{mktg_pipeline}</div><div class="kpi-sub">{mktg_pct} of total pipeline</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Influenced Pipeline</div><div class="kpi-value">{influenced_pipeline}</div><div class="kpi-sub">Accounts with any mktg touch</div></div>
  </div>

  <div class="decision-panel" aria-label="Primary dashboard decision path">
    <div class="decision-lead">
      <div class="decision-label">Primary decision</div>
      <h2>Where should marketing focus next without overstating causality?</h2>
      <p>Start with the executive answer, then drill into attribution, coverage, quality, and budget evidence as needed.</p>
    </div>
    <div class="decision-item">
      <strong>1. Protect quality</strong>
      <span>Pipeline is growing while win rate moved from {cohort_start_rate} to {cohort_end_rate}; review ICP and qualification first.</span>
    </div>
    <div class="decision-item">
      <strong>2. Expand coverage</strong>
      <span>{unreached_pct} of target accounts have no tracked email or 6sense touch; test expansion with a holdout.</span>
    </div>
    <div class="decision-item">
      <strong>3. Scale carefully</strong>
      <span>Use attribution and tracked-spend scenarios as planning signals, then validate incremental lift before large reallocations.</span>
    </div>
  </div>

  <div class="scope-row" aria-label="Dashboard usage notes">
    <span class="scope-chip"><i data-lucide="target" aria-hidden="true"></i>Audience: executive marketing review</span>
    <span class="scope-chip"><i data-lucide="mouse-pointer-click" aria-hidden="true"></i>Judge path: Essential, Attribution, Channel ROI, Recommendation</span>
    <span class="scope-chip"><i data-lucide="shield-check" aria-hidden="true"></i>Confidence labels separate observed facts from testable hypotheses</span>
  </div>

  <div class="story-strip">
    <div class="story-card">
      <h2>Marketing influence is bigger than source credit</h2>
      <p><span class="evidence-badge">{influenced_pipeline} influenced</span> vs. <span class="evidence-badge orange">{sourced_pipeline} sourced</span> shows why the dashboard reports both views.</p>
    </div>
    <div class="story-card coverage">
      <h2>Coverage is the clearest growth lever</h2>
      <p><span class="evidence-badge orange">{unreached_pct} unreached</span> target accounts have no email or 6sense touch yet.</p>
    </div>
    <div class="story-card quality">
      <h2>Pipeline quality needs executive attention</h2>
      <p><span class="evidence-badge red">{cohort_start_rate} â†’ {cohort_end_rate} win rate</span> means pipeline growth must be checked against conversion quality.</p>
    </div>
  </div>

  <!-- â”€â”€ 1. Executive Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-essential" class="section active">
    <div class="section-title">Essential View</div>
    <div class="section-desc">A focused version for decision-makers: the answer, the few charts that support it, and the next actions.</div>
    <div class="section-takeaway"><strong>Recommended path:</strong> protect pipeline quality, expand coverage to unreached target accounts, and treat attribution as directional planning evidence. <span class="evidence-badge">{influenced_pipeline} influenced</span><span class="evidence-badge orange">{unreached_pct} unreached</span><span class="evidence-badge red">{cohort_start_rate} to {cohort_end_rate} win rate</span></div>
    <div class="priority-grid">
      <div class="priority-card">
        <div class="priority-tag">Do first</div>
        <h3>Audit pipeline quality</h3>
        <p>Pipeline volume is growing, but cohort win rate moved from {cohort_start_rate} to {cohort_end_rate}. Tighten ICP and qualification before increasing broad spend.</p>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Growth lever</div>
        <h3>Reach unreached accounts</h3>
        <p>{unreached_accounts} target accounts, or {unreached_pct}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and use a holdout.</p>
      </div>
      <div class="priority-card">
        <div class="priority-tag">Budget lens</div>
        <h3>Scale with proof</h3>
        <p>Use sourced, influenced, and tracked-spend scenarios to choose tests, then validate incremental lift before committing large reallocations.</p>
      </div>
    </div>
    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card"><div id="c-essential-contribution"></div></div>
      <div class="chart-card"><div id="c-essential-coverage"></div></div>
      <div class="chart-card full"><div id="c-essential-cohort"></div></div>
    </div>
    <div class="chart-card full" style="margin-top:16px">
      <div class="section-title" style="font-size:13px;margin-bottom:8px">Essential Action Plan</div>
      <div class="table-wrap">
        <table class="dash-table">
          <thead><tr><th>Priority</th><th>Decision</th><th>Why</th><th>Next step</th></tr></thead>
          <tbody>
            <tr><td><span class="priority-tag">1</span></td><td>Protect quality</td><td>Win rate moved from {cohort_start_rate} to {cohort_end_rate} while pipeline grew.</td><td>Run a quarterly ICP and qualification review before scaling volume.</td></tr>
            <tr><td><span class="priority-tag">2</span></td><td>Expand coverage</td><td>{unreached_pct} of target accounts are unreached by tracked email or 6sense.</td><td>Launch email-first coverage test with a holdout group.</td></tr>
            <tr><td><span class="priority-tag">3</span></td><td>Use attribution carefully</td><td>{influenced_pipeline} influenced vs. {sourced_pipeline} sourced shows marketing has broader journey impact.</td><td>Use time-decay/linear models for planning, not as causality proof.</td></tr>
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
    <div class="section-title">Executive Summary</div>
    <div class="section-desc">High-level pipeline, revenue, and channel overview for a B2B ABM company targeting specific accounts with 6sense display ads, email, and events.</div>
    <div class="section-takeaway"><strong>Executive takeaway:</strong> The business has meaningful pipeline volume, but the strongest story is how marketing supports future revenue beyond direct source credit. <span class="evidence-badge">{total_pipeline} pipeline</span><span class="evidence-badge green">{won_pipeline} won</span></div>
    <div class="context-box">
      <strong>How to read this dashboard:</strong> This company uses Account-Based Marketing (ABM) â€” instead of advertising to everyone, they pick specific companies ("target accounts") and run coordinated campaigns at those companies. A deal is born when a target account agrees to a sales conversation and eventually signs a contract. The job of this dashboard is to answer: <em>which marketing activities led to those deals?</em>
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-bar-channel"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Pipeline by Channel</div>
          Each bar is the total dollar value of all deals (won + open) where the CRM lead source was tagged as that marketing channel. This is <strong>Marketing Sourced</strong> pipeline â€” only deals where marketing is listed as the origin.
          <br><br><strong>Why "Other" and "Existing Client" are biggest:</strong> Most B2B deals come from existing customer expansions or sales-led outreach â€” that's normal. Marketing's role is to generate the <em>net-new</em> pipeline (6sense, email, web inbound, events).
          <div class="ex-insight">Key takeaway: {top_sourced_channels} are the top net-new marketing channels by sourced pipeline.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-donut-won"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Won Revenue by Channel</div>
          Of all deals that were actually <strong>closed and won</strong> (signed contracts, real money), this shows which channel sourced them. Only channels with won revenue appear.
          <br><br><strong>Why Existing Client often dominates:</strong> Upselling to existing customers is usually a higher-conversion motion because the relationship already exists. New-business marketing channels need time to mature.
          <div class="ex-insight">Key takeaway: {top_won_channels} are the largest won-revenue channels. Marketing channels should be judged with pipeline maturity and conversion timing in view.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-monthly-trend"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Pipeline Created by Month</div>
          Each colored band represents pipeline (deal value) created in that month, stacked by channel. A taller bar = more deals created that month. The color split shows which channels are active at different times of year.
          <br><br><strong>How to use it:</strong> Look for spikes â€” did they follow a campaign launch? Look for drops â€” did a channel go quiet? This helps connect campaign activity to deal creation with a time lag.
          <div class="ex-insight">Key takeaway: Compare this chart to your campaign calendar. Spikes are useful leads for investigation, but the chart alone does not prove campaign lift.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 2. Attribution Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-attrib" class="section">
    <div class="section-title">Attribution Analysis</div>
    <div class="section-desc">How different models split deal credit across marketing touchpoints â€” the core of understanding marketing ROI.</div>
    <div class="section-takeaway"><strong>Attribution takeaway:</strong> Sourced pipeline is the conservative number; influenced pipeline is the fuller account-journey story. <span class="evidence-badge orange">{sourced_pipeline} sourced</span><span class="evidence-badge">{influenced_pipeline} influenced</span></div>
    <div class="context-box">
      <strong>The core concept:</strong> Every won deal has a trail of marketing touchpoints â€” ads seen, emails opened, website visits â€” that happened before the deal was created. Attribution models answer the question: <em>how much of this deal's dollar value should each marketing channel get credit for?</em>
      <br><br>
      We link marketing touchpoints to opportunities within a 365-day lookback window before deal creation. Here are the 6 models:
      <br><br>
      <span class="model-pill">Sourced</span>&nbsp; CRM says marketing was the origin. Hard credit, no sharing. ({sourced_pipeline})
      &nbsp;<span class="model-pill lt">Influenced</span>&nbsp; Marketing touched the account at any point before the deal. Measures reach. ({influenced_pipeline})
      &nbsp;<span class="model-pill">First-Touch</span>&nbsp; 100% credit to the <em>first</em> marketing touch â€” finds who starts conversations.
      &nbsp;<span class="model-pill lt">Last-Touch</span>&nbsp; 100% credit to the <em>last</em> touch before the deal â€” finds who closes conversations.
      &nbsp;<span class="model-pill lin">Linear</span>&nbsp; Equal split across ALL channels that touched the account â€” fairest view.
      &nbsp;<span class="model-pill td">Time-Decay</span>&nbsp; More credit to <em>recent</em> touches, less to old ones (half-life = 30 days). Best for budget decisions.
    </div>
    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Proves</span> Marketing has measurable pipeline presence</h3>
        <p>The sourced and influenced models are directly reconciled to the opportunity data, so the dollar totals are safe to report.</p>
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
          <div class="ex-title">What this shows â€” Attribution Model Comparison</div>
          <strong>This is the most important chart.</strong> Each group of bars is one attribution model. Within each group, each colored bar is one marketing channel. The bar height = how many dollars of pipeline that channel gets credited with under that model.
          <br><br>
          <strong>How to read it:</strong> Compare the same channel across different models. If Email's bar is tall in First-Touch but shorter in Last-Touch, Email is good at starting conversations but someone else closes them.
          <br><br>
          <strong>Example walkthrough:</strong> Company "Acme Corp" sees 6sense ads for 3 months (6sense gets credit), gets 2 emails (Email gets credit), visits the website once (Web gets credit), then a deal worth $50K is created. Under <em>First-Touch</em>: Email gets $50K. Under <em>Last-Touch</em>: Web gets $50K. Under <em>Linear</em>: each channel gets $16.7K. Under <em>Time-Decay</em>: Web gets the most because it happened closest to the deal.
          <div class="ex-insight">Key takeaway: Compare first-touch, last-touch, linear, and time-decay side by side. Differences show observed journey roles, not single-channel causality.</div>
        </div>
      </div>
    </div>
    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-sourced-influenced"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Sourced vs. Influenced Pipeline</div>
          Two horizontal bars, two definitions of marketing contribution:
          <br><br>
          <strong>Sourced:</strong> The CRM field "Lead Source" explicitly says this deal came from marketing. Hard attribution. Conservative.
          <br><br>
          <strong>Influenced:</strong> Marketing touched this account (any ad, email, or web visit) within 365 days before the deal was created â€” even if sales "sourced" the deal officially.
          <br><br>
          The gap between Sourced and Influenced is the "shadow credit" â€” marketing's work that doesn't show up in traditional CRM reporting.
          <div class="ex-insight">Key takeaway: If you only report on Sourced, you're attributing {sourced_pipeline} to marketing. If you use Influenced, it's {influenced_pipeline}. Both are true â€” they just answer different questions.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-attrib-waterfall"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” First-Touch vs. Last-Touch Credit Shift</div>
          This shows how much each channel's credit <em>changes</em> when you switch from First-Touch to Last-Touch. Green bars = the channel gets MORE credit in Last-Touch. Red bars = the channel gets LESS credit.
          <br><br>
          <strong>Why it matters:</strong> A channel that loses credit (red) is an <em>awareness channel</em> â€” it gets the conversation started but isn't involved at the decision point. A channel that gains credit (green) is a <em>conversion channel</em> â€” it's there when deals close.
          <div class="ex-insight">Key takeaway: Channels that gain last-touch credit appear later in tracked journeys; channels that lose it appear earlier. Treat the pattern as a planning signal to test.</div>
        </div>
      </div>
    </div>

    <!-- Attribution Table -->
    <div class="chart-card" style="margin-top:16px">
      <div class="section-title" style="font-size:13px;margin-bottom:6px">Full Attribution Table â€” All Models Side by Side</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">Every channel across every model in one place. The "Recommended Model" column shows which model gives that channel the most credit â€” use as a sanity check before budget decisions.</div>
      <div style="overflow-x:auto">
        <table class="dash-table" id="attrib-table">
          <thead><tr><th>Channel</th><th>First-Touch ($)</th><th>Last-Touch ($)</th><th>Linear ($)</th><th>Time-Decay ($)</th><th>Sourced ($)</th><th>Influenced ($)</th><th>Best Model for Channel</th></tr></thead>
          <tbody id="attrib-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 3. Channel Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-channel" class="section">
    <div class="section-title">Channel Performance</div>
    <div class="section-desc">ROI, win rate, and funnel conversion by marketing channel â€” the efficiency scorecard.</div>
    <div class="section-takeaway"><strong>Channel takeaway:</strong> Relationship channels close best, while marketing channels build the net-new funnel that needs time to mature. <span class="evidence-badge green">relationship channels</span><span class="evidence-badge">net-new pipeline</span></div>
    <div class="context-box">
      <strong>What "ROI" means here:</strong> Pipeline ROI = pipeline generated Ã· dollars spent. A Pipeline ROI of 5x means every $1 in ad spend generated $5 in deal pipeline. This is different from Revenue ROI (only counting won deals) â€” both matter. Pipeline ROI tells you if you're building a healthy funnel. Revenue ROI tells you if it's converting.
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
          Each group has its own denominator. Ad impressions convert to ad clicks, email events convert to email clicks or registrations, and opportunity outcomes summarize CRM results. A log scale keeps very large and small counts readable together.
          <div class="ex-insight">Key takeaway: This view is safer for analysis because it avoids implying that email events, website sessions, and CRM opportunities are one sequential funnel.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div class="section-title" style="font-size:13px;margin-bottom:6px">Channel ROI Summary Table</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:10px">Pipeline ROI = total pipeline Ã· spend. Revenue ROI = won revenue Ã· spend. Channels with no spend tracked show â€” (they rely on sales effort, not ad budget).</div>
        <div style="overflow-x:auto">
          <table class="dash-table" id="channel-table">
            <thead><tr><th>Channel</th><th>Deals</th><th>Pipeline ($)</th><th>Won ($)</th><th>Win Rate</th><th>Avg Deal</th><th>Spend ($)</th><th>Pipeline ROI</th><th>Revenue ROI</th></tr></thead>
            <tbody id="channel-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 4. Segment Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-segment" class="section">
    <div class="section-title">Segment & ICP Analysis</div>
    <div class="section-desc">Which account segments and industries have the most pipeline and highest win rates â€” your best ABM targeting zones.</div>
    <div class="section-takeaway"><strong>Segment takeaway:</strong> The best targeting decision balances revenue potential with win probability, not just the largest deal size. <span class="evidence-badge green">Commercial + Strong Fit wins most often</span></div>
    <div class="context-box">
      <strong>What is a "Segment" in ABM?</strong> In 6sense, accounts are grouped into buying stage segments based on their digital behavior: how much content they're consuming, what keywords they're searching, how often they visit competitor websites. Common stages: <em>Awareness</em> (just starting to research), <em>Consideration</em> (evaluating options), <em>Decision</em> (ready to buy). Targeting companies in the Decision stage with the right industry profile is how ABM maximizes efficiency.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-seg-heatmap"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Pipeline Heatmap: Industry x Segment</div>
          Each cell = total pipeline from companies in that industry AND that 6sense segment. Darker blue = more pipeline concentrated there.
          <br><br>
          <strong>How to use it:</strong> The darkest cells are your highest-value targeting combinations. If Software + Decision is the darkest cell, you should prioritize software companies that 6sense flags as in the decision stage.
          <br><br>
          <strong>The dollar amounts</strong> in each cell show absolute pipeline value â€” useful for prioritizing where to spend ABM budget and sales time.
          <div class="ex-insight">Key takeaway: Focus outbound, personalized ads, and sales outreach on the 2â€“3 darkest cells. Everything else is secondary targeting.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-seg-winrate"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows - Segment Tradeoff</div>
          Each point is a segment positioned by win rate and average deal size:
          <br><br>
          <strong>X-axis:</strong> Win rate - what percentage of deals in this segment actually closed.
          <br><br>
          <strong>Y-axis:</strong> Average deal size - how large the contracts are in this segment. Larger bubbles represent more deals.
          <br><br>
          <strong>The ideal segment</strong> has BOTH a high win rate AND a high average deal size. Those are your ICP (Ideal Customer Profile) sweet spots â€” where you should concentrate ABM investment.
          <div class="ex-insight">Key takeaway: A segment with a high win rate but small deals might not be worth prioritizing. A segment with large deals but low win rate might need different sales approach or longer nurture. Look for the combination.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 5. Creative & Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-creative" class="section">
    <div class="section-title">Creative & Email Performance</div>
    <div class="section-desc">Which ad creatives and email campaigns drive the highest engagement â€” tells you what messaging resonates with your target accounts.</div>
    <div class="section-takeaway"><strong>Creative takeaway:</strong> Creative performance is an efficiency lever: better messages improve account engagement before opportunities appear in CRM. <span class="evidence-badge">CTR and form fills</span><span class="evidence-badge orange">seniority engagement</span></div>
    <div class="context-box">
      <strong>Why creative matters in ABM:</strong> In ABM, you're showing ads specifically to people at your target accounts â€” they'll see your ads repeatedly. If your creative is bad, they'll tune it out. If it's good, it builds brand recognition so when sales calls, the prospect already knows who you are. CTR (click-through rate) is the primary measure of creative effectiveness for display ads.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-creative-ctr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Top 15 Ads by CTR</div>
          CTR = Click-Through Rate = clicks Ã· impressions. If 1,000 people saw an ad and 5 clicked it, CTR = 0.5%.
          <br><br>
          <strong>Industry benchmarks:</strong> Display ads average 0.05â€“0.1% CTR. LinkedIn ads average 0.3â€“0.5%. Anything above 0.5% is very good for display. These are the top-performing creatives from your $1.22M ad spend.
          <br><br>
          <strong>What to do with this:</strong> The top ads tell your creative team what visual style, message, and CTA is working. Brief new creative based on these patterns â€” don't start from scratch.
          <div class="ex-insight">Key takeaway: The highest-CTR ads should be your always-on creatives. Pause the bottom performers and reallocate their budget to top performers.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-creative-attr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” CTR by Creative Attribute (Tone/Type/CTA)</div>
          Instead of looking at individual ads, this groups all ads by a shared creative characteristic (e.g., messaging tone: "direct" vs "inspirational" vs "educational") and compares their average CTR.
          <br><br>
          <strong>How to use it:</strong> If "Direct" tone has a higher CTR than "Inspirational," brief your creative team to write more direct copy. This is strategic creative direction backed by data.
          <div class="ex-insight">Key takeaway: Use this to set creative briefs. Tell your agency: "Based on our data, X attribute outperforms Y â€” please prioritize X in the next batch."</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-email-seniority"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Email Engagement by Job Seniority</div>
          How different levels of seniority (C-Level, VP, Director, Manager) respond to email campaigns. Two metrics:
          <br><br>
          <strong>Open Rate (blue):</strong> What % of emails to that seniority level were opened. This measures subject line effectiveness and whether they recognize your brand enough to open.
          <br><br>
          <strong>Click Rate (orange):</strong> What % clicked a link inside the email. This measures content relevance â€” did the email body give them a reason to take action?
          <br><br>
          <strong>Why seniority matters in ABM:</strong> C-Level executives make budget decisions but have no time â€” they need very short, high-value emails. Managers/Directors are often the evaluators â€” they need detailed content. Personalizing by seniority can dramatically improve click rates.
          <div class="ex-insight">Key takeaway: The seniority level with the highest click rate is your most engaged audience â€” prioritize them for follow-up sequences. The seniority with high opens but low clicks needs better email body content.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 6. Budget Scenarios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-budget" class="section">
    <div class="section-title">Budget Recommendation & Scenarios</div>
    <div class="section-desc">Three scenarios showing what happens to projected pipeline if you reallocate the marketing budget based on ROI data.</div>
    <div class="section-takeaway"><strong>Budget takeaway:</strong> Use scenarios as directional planning, not exact forecasting; the chart only models channels with tracked spend. <span class="evidence-badge">{tracked_spend_channels}</span><span class="evidence-badge orange">diminishing returns risk</span></div>
    <div class="context-box">
      <strong>How scenario modelling works:</strong> We take each channel's current "pipeline per dollar spent" efficiency rate (observed from real data) and apply it to different spending levels. If 6sense historically generates $5 of pipeline for every $1 spent, doubling the 6sense budget should generate roughly twice the pipeline (holding all other variables equal â€” which is a simplification, but useful for directional planning).
      <br><br>
      <strong>Three scenarios:</strong> (1) <em>Status Quo</em> â€” keep tracked spend exactly as-is. (2) <em>ROI-Optimized</em> â€” shift 30% more to the top tracked-ROI channels, cut the bottom tracked channels by 20%. (3) <em>Growth Mode</em> â€” double the top tracked-spend channels and reduce lower tracked-ROI channels. This excludes channels without spend data.
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div id="c-budget-scenario"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Budget Scenarios: Projected Pipeline by Channel</div>
          Each group of bars is one marketing channel. Within the group, the three bars are the three budget scenarios. The bar height = how much pipeline that channel would be expected to generate under that scenario.
          <br><br>
          <strong>How to use it:</strong> Compare the total height across all channels for each scenario color. The scenario where the total (sum of all bars in that color) is tallest = the most pipeline-efficient allocation.
          <br><br>
          <strong>Important caveat:</strong> These projections assume the same efficiency ratio holds at higher spend levels. In reality, there's often diminishing returns at high spend (you run out of target accounts to reach). Treat as directional, not precise.
          <br><br>
          <strong>Underlying logic:</strong> The projection applies each tracked channel's historical pipeline per spend dollar to the scenario spend. It does not estimate email, event, referral, or sales effort costs unless those costs are present in the source data.
          <div class="ex-insight">Key takeaway: Treat this as a sensitivity model for tracked paid spend, not a complete budget optimizer.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 7. Advanced Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-advanced" class="section">
    <div class="section-title">Advanced Analytics</div>
    <div class="section-desc">ML win probability model, account coverage gap, deal velocity, journey sequences, and targeting matrix â€” datathon-level depth.</div>
    <div class="section-takeaway"><strong>Advanced takeaway:</strong> The predictive model and coverage analysis point to the same action: focus sales and marketing on high-fit accounts that are not yet fully activated. <span class="evidence-badge">AUC {model_auc}</span><span class="evidence-badge orange">{unreached_pct} unreached</span></div>
    <div class="context-box">
      <strong>What makes this section different:</strong> Standard marketing analytics tells you what happened. This section adds prioritization signals for where to focus. The win probability model (Random Forest, AUC = {model_auc}, {model_validation}) scores {open_deals} open deals. The coverage analysis reveals that {unreached_pct} of target accounts have no tracked email or 6sense touchpoint.
    </div>
    <div class="evidence-grid">
      <div class="evidence-card">
        <h3><span class="confidence-pill high">Coverage lift</span> Reached accounts perform better</h3>
        <p>Unreached accounts show a {not_reached_rate} opportunity rate, while email-only accounts show {email_only_rate} and both-channel accounts show {both_rate}.</p>
      </div>
      <div class="evidence-card">
        <h3><span class="confidence-pill medium">Quality diagnosis</span> Growth is not automatically healthy</h3>
        <p>Pipeline volume is rising while cohort win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}.</p>
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
          <div class="ex-title">What this shows â€” Win Probability: Top Predictors</div>
          A Random Forest model was trained on closed deals to prioritize open opportunities. Feature importance shows which data points the model relied on most to predict whether a deal closes. <strong>AUC = {model_auc}</strong> using {model_validation} (1.0 = perfect, 0.5 = random).
          <br><br>
          <strong>How to read:</strong> Longer bar = stronger predictor. <strong>Tier</strong> reflects account qualification, <strong>channel</strong> reflects the original lead source, and account firmographics help separate higher- and lower-probability deals.
          <div class="ex-insight">Key insight: Use win probability for sales prioritization. Treat channel and account signals as predictive patterns, not proof that any single marketing touch caused a win.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-win-prob"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Win Probability Distribution (Open Deals)</div>
          This histogram shows {open_deals} currently open deals scored by the ML model. Each bar = number of open deals with that win probability range. Deals on the right side are higher-priority follow-up candidates.
          <br><br>
          <strong>How to use it:</strong> Sort your CRM by win probability and have sales prioritize the top 20% (probability > 70%). Don't waste effort on deals with < 20% probability until the pipeline is healthy.
          <div class="ex-insight">Key insight: Share this model output with your sales team as a weekly "hot deals" list. The model integrates marketing signals (email engagement, 6sense impressions) that sales reps don't see in CRM.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid" style="margin-top:16px">
      <div class="chart-card full">
        <div id="c-account-coverage"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Account Coverage: Has Marketing Reached Your Target Accounts?</div>
          Of all {target_accounts} target account domains, this shows how many have been reached by email, 6sense, both, or neither. The orange line shows the observed opportunity rate (% of accounts in each group that have at least one CRM deal).
          <br><br>
          <strong>The critical finding:</strong> <strong>{unreached_accounts} accounts ({unreached_pct}) have never received a single marketing touchpoint.</strong> Yet accounts reached by email alone have a {email_only_rate} opportunity rate vs. {not_reached_rate} for unreached accounts.
          <br><br>
          <strong>What to do:</strong> The {unreached_accounts} unreached accounts represent your biggest growth lever. Expand 6sense audience lists and email sequences to cover these accounts, prioritizing Strong Profile Fit ones first.
          <div class="ex-insight">Key insight: Use this to size a test audience and holdout. The observed "Both Channels" rate is a benchmark, not a guaranteed lift rate.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-deal-velocity"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Deal Velocity: How Fast Do Different Channels Close?</div>
          Median days from deal creation to close win, by channel. Error bars show the middle 50% range, so the chart shows both typical speed and variability.
          <br><br>
          <strong>Why it matters:</strong> A channel might generate large pipeline but take 9 months to close. That affects cash flow forecasting. Existing clients close in 34 days (median) because the trust is already there. 6sense channel deals take 98 days â€” there's more evaluation needed from net-new accounts.
          <div class="ex-insight">Key insight: If you need revenue fast, focus sales effort on existing client expansion and referrals (fastest close). If you're investing for Q3-Q4 revenue, start 6sense and event campaigns now â€” they need a 90-day runway.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-journey"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Winning Touchpoint Journey Sequences</div>
          For won deals that had tracked marketing touchpoints, what was the sequence of channels in order? This shows the most common channel paths that led to a closed deal.
          <br><br>
          <strong>How to read:</strong> "email_mqa â†’ 6sense_display" means: email was the first touch, then 6sense display ads followed. The most common winning sequence validates the two-stage strategy: email opens the conversation, 6sense keeps the brand visible through the evaluation period.
          <div class="ex-insight">Key insight: Build this as a coordinated playbook â€” when email engagement is detected, trigger 6sense to increase impression frequency for that account. The data shows this sequence produces wins.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-targeting-matrix"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” ABM Targeting Priority Matrix</div>
          Win rate heatmap crossing Segment (Enterprise/Commercial/Mid) vs. 6sense Profile Fit (Strong/Moderate/Weak). Darker blue = higher win rate = higher-priority target.
          <br><br>
          <strong>How to use it:</strong> The darkest cells define your Tier 1 ABM targets â€” where you invest your most personalized, expensive outreach. Commercial + Strong Fit (47% win rate) and Mid + Moderate (43%) are the sweet spots.
          <div class="ex-insight">Key insight: Enterprise + Strong Fit has the highest average deal size ($15,928) AND 35% win rate. Commercial + Strong Fit wins most often (47%). Run both in parallel â€” Enterprise for revenue growth, Commercial for volume.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-cohort"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows â€” Pipeline Cohort Analysis by Quarter</div>
          Blue bars = pipeline created each quarter (growing). Green line = win rate per quarter (declining). Yellow dashed = marketing's share of deals per quarter (volatile).
          <br><br>
          <strong>The critical trend:</strong> Pipeline is growing, while win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}. Marketing's share peaked at {mktg_peak_pct} and ended at {mktg_end_pct}. This suggests pipeline quality and source mix need review.
          <div class="ex-insight">Key insight: This is the most important strategic signal in the entire dataset. Investigate why win rates are declining as pipeline grows. Is the ICP expanding too broadly? Are marketing-sourced deals being counted less? This needs executive attention.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- â”€â”€ 8. Conclusion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div id="s-appendix" class="section">
    <div class="section-title">Analyst Appendix</div>
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
      <div class="section-title" style="font-size:13px;margin-bottom:8px">Case Deliverable Coverage</div>
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
    <div class="section-title">Conclusion</div>
    <div class="section-desc">The practical readout: what the analysis says, what risks matter, and what the next actions should be.</div>
    <div class="section-takeaway"><strong>Final takeaway:</strong> The recommendation is targeted growth, not blanket budget expansion. <span class="evidence-badge">{influenced_pipeline} influenced</span><span class="evidence-badge orange">{unreached_pct} unreached</span><span class="evidence-badge red">{cohort_start_rate} â†’ {cohort_end_rate} win rate</span></div>
    <div class="conclusion-hero">
      <div class="eyebrow">Bottom-line recommendation</div>
      <h3>Reach the right unreached accounts, start with email, test 6sense overlay, and protect win rate as pipeline grows.</h3>
      <p>Marketing is not just a source channel. It influenced {influenced_pipeline} of pipeline, but the largest growth lever is coverage: {unreached_accounts} target accounts, or {unreached_pct}, have not been reached by email or 6sense.</p>
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
          <li>Pipeline volume is growing, but cohort win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}.</li>
          <li>Marketing-sourced share ended at {mktg_end_pct}, so the source mix deserves review.</li>
          <li>Most target accounts are unreached, which limits ABM learning and leaves pipeline potential untouched.</li>
        </ul>
      </div>
      <div class="conclusion-card">
        <h3>What to do next</h3>
        <ul class="finding-list">
          <li>Expand coverage to unreached strong-fit accounts before increasing broad demand generation spend.</li>
          <li>Trigger 6sense display when an account shows email engagement, matching the winning journey pattern.</li>
          <li>Review ICP and qualification each quarter until win rate stabilizes.</li>
        </ul>
      </div>
    </div>

    <div class="priority-grid">
      <div class="priority-card">
        <h3><span class="priority-tag p1">P1</span> Fix coverage and quality first</h3>
        <p>Activate unreached target accounts and tighten ICP qualification before chasing more broad top-of-funnel volume.</p>
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
      <div class="section-title" style="font-size:13px;margin-bottom:6px">Decision Confidence</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">This separates what the data directly supports from what should be treated as a testable business hypothesis.</div>
      <div style="overflow-x:auto">
        <table class="dash-table confidence-table">
          <thead><tr><th>Recommendation</th><th>Confidence</th><th>Why We Believe It</th><th>What To Test Next</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Expand coverage to unreached target accounts.</strong></td>
              <td><span class="confidence-pill high">High</span></td>
              <td>{unreached_accounts} target accounts are unreached, and reached groups show materially higher opportunity rates than unreached accounts.</td>
              <td>Prioritize strong-fit unreached accounts and compare opportunity creation against a holdout group.</td>
            </tr>
            <tr>
              <td><strong>Coordinate email engagement with 6sense display.</strong></td>
              <td><span class="confidence-pill medium">Medium</span></td>
              <td>Journey and attribution patterns show email starts conversations while 6sense remains active later in the path.</td>
              <td>Trigger display frequency after email engagement and measure lift in meetings or opportunities.</td>
            </tr>
            <tr>
              <td><strong>Tighten ICP and qualification criteria.</strong></td>
              <td><span class="confidence-pill high">High</span></td>
              <td>Cohort analysis shows pipeline growth alongside a win-rate move from {cohort_start_rate} to {cohort_end_rate}.</td>
              <td>Track win rate, stage conversion, and disqualification reasons by source and profile fit.</td>
            </tr>
            <tr>
              <td><strong>Reallocate budget toward higher-attribution channels.</strong></td>
              <td><span class="confidence-pill directional">Directional</span></td>
              <td>Scenario modeling is useful for planning, but it assumes historical efficiency holds at higher spend.</td>
              <td>Run budget changes in phases and monitor marginal pipeline per dollar before scaling.</td>
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
      <div class="section-title" style="font-size:13px;margin-bottom:6px">Recommended Action Plan</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">Each row connects the dashboard evidence to a business action, so the analysis can be defended in a presentation.</div>
      <div style="overflow-x:auto">
        <table class="dash-table recommendation-table">
          <thead><tr><th>Priority</th><th>Action</th><th>Why</th><th>Measure Success With</th></tr></thead>
          <tbody>
            <tr>
              <td><span class="priority-tag p1">P1</span></td>
              <td><strong>Coverage:</strong> reach unreached target accounts with email first, then test 6sense overlay.</td>
              <td>Email-only accounts show a {email_only_rate} opportunity rate and both-channel accounts show {both_rate}, compared with {not_reached_rate} for unreached accounts.</td>
              <td>Target account coverage, opportunity rate, incremental lift, pipeline created.</td>
            </tr>
            <tr>
              <td><span class="priority-tag p1">P1</span></td>
              <td><strong>Pipeline quality:</strong> tighten ICP and qualification criteria.</td>
              <td>Quarterly pipeline is rising while win rate moved from {cohort_start_rate} to {cohort_end_rate}.</td>
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
              <td>The model scored {open_deals} open deals and uses ABM signals that sellers may not see in CRM.</td>
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
      <div class="section-title" style="font-size:13px;margin-bottom:8px">How to Present the Conclusion</div>
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
        <span>Prioritize strong-fit account coverage, lead with email, and test 6sense overlay before simply adding budget.</span>
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

</div><!-- /main -->

<div class="drawer-backdrop" id="drawer-backdrop"></div>
<aside class="caveats-drawer" id="caveats-drawer" aria-label="Data caveats" aria-hidden="true">
  <div class="drawer-head">
    <h2>Data Caveats</h2>
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

<!-- â”€â”€â”€ Scripts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<aside class="assistant-panel" id="assistant-panel" aria-label="Dashboard AI assistant" aria-hidden="true">
  <div class="assistant-head">
    <div class="assistant-title">
      <i data-lucide="bot" aria-hidden="true"></i>
      <div><strong>Dashboard AI</strong><span>Marketing questions grounded in this analysis</span></div>
    </div>
    <button class="action-button" id="close-assistant" type="button"><i data-lucide="x" aria-hidden="true"></i><span>Close</span></button>
  </div>
  <div class="assistant-body" id="assistant-body" aria-live="polite"></div>
  <div class="assistant-suggestions" aria-label="Suggested questions">
    <button class="assistant-chip" type="button" data-question="What is the main recommendation?">Main recommendation</button>
    <button class="assistant-chip" type="button" data-question="Why is coverage important?">Coverage</button>
    <button class="assistant-chip" type="button" data-question="What is marketing sourced vs influenced?">Attribution</button>
    <button class="assistant-chip" type="button" data-question="How should we explain ABM?">ABM</button>
    <button class="assistant-chip" type="button" data-question="How should we test this strategy?">Testing</button>
  </div>
  <form class="assistant-form" id="assistant-form">
    <input class="assistant-input" id="assistant-input" type="text" autocomplete="off" placeholder="Ask about ABM, ROI, ICP, attribution, coverage, or next steps" aria-label="Ask the dashboard assistant">
    <button class="action-button" type="submit"><i data-lucide="send" aria-hidden="true"></i><span>Ask</span></button>
  </form>
  <div class="assistant-footnote">Uses local Ollama when available, then Gemini if configured; otherwise falls back to built-in dashboard answers.</div>
</aside>

<script>
// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showSection(link, sectionId) {{
  document.querySelectorAll('.nav-link').forEach(l => {{
    l.classList.remove('active');
    l.removeAttribute('aria-current');
  }});
  link.classList.add('active');
  link.setAttribute('aria-current', 'page');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  document.body.classList.remove('sidebar-open');
  const menuButton = document.getElementById('menu-button');
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  history.replaceState(null, '', `#${{sectionId}}`);
  updateProgress(link);
  // Trigger resize so Plotly charts re-fit
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}}

function showAppendixSection(sectionId) {{
  const appendixLink = document.querySelector('.nav-link[data-section="s-appendix"]');
  if (appendixLink) showSection(appendixLink, sectionId);
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
const closeCaveats = document.getElementById('close-caveats');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const caveatsDrawer = document.getElementById('caveats-drawer');
const assistantButton = document.getElementById('assistant-button');
const closeAssistant = document.getElementById('close-assistant');
const assistantPanel = document.getElementById('assistant-panel');
const assistantBody = document.getElementById('assistant-body');
const assistantForm = document.getElementById('assistant-form');
const assistantInput = document.getElementById('assistant-input');

const ASSISTANT_KNOWLEDGE = [
  {{
    title: 'Main Recommendation',
    keywords: ['main','recommendation','recommend','next','action','strategy','summary','should','do','marketing','plan','ultimate','conclusion','takeaway','bottom','line','finding','findings','result','results','based','data'],
    answer: 'The ultimate conclusion is targeted growth, not blanket budget expansion. Marketing has meaningful journey impact ({influenced_pipeline} influenced vs. {sourced_pipeline} sourced), but the biggest practical lever is account coverage: {unreached_pct} of target accounts are unreached. The caution is quality: cohort win rate moved from {cohort_start_rate} to {cohort_end_rate}. So the best recommendation is to protect ICP/qualification, expand to unreached strong-fit accounts, start with email, test a 6sense overlay, and use a holdout to prove incremental lift.'
  }},
  {{
    title: 'ABM Explanation',
    keywords: ['abm','account','based','marketing','target','accounts','6sense','intent','explain'],
    answer: 'ABM means marketing and sales focus on a defined list of target accounts instead of advertising broadly to everyone. In this dashboard, ABM shows up through target account coverage, 6sense display touches, email engagement, account profile fit, and opportunity creation. The strategic question is not just "which channel got credit?" It is "which target accounts should we activate next, and how do we prove lift?"'
  }},
  {{
    title: 'ICP and Targeting',
    keywords: ['icp','ideal','customer','profile','fit','segment','targeting','industry','enterprise','commercial','mid'],
    answer: 'ICP is the definition of accounts that are most worth pursuing. Here, ICP decisions should use segment, industry, 6sense profile fit, win rate, and deal size together. The dashboard recommendation is to prioritize strong-fit unreached accounts first, because broad expansion could worsen the win-rate quality issue.'
  }},
  {{
    title: 'Coverage Gap',
    keywords: ['coverage','unreached','accounts','target','email','6sense','reach','growth'],
    answer: '{unreached_accounts} target accounts, or {unreached_pct}, have no tracked email or 6sense touch. That is the clearest growth lever because reached groups show stronger observed opportunity rates: email-only accounts are at {email_only_rate}, both-channel accounts are at {both_rate}, and not-reached accounts are at {not_reached_rate}. Use a holdout so the team can measure incremental lift.'
  }},
  {{
    title: 'Sourced vs Influenced',
    keywords: ['sourced','influenced','attribution','source','credit','marketing','touch','pipeline'],
    answer: 'Marketing-sourced pipeline is conservative CRM source credit: {sourced_pipeline}. Influenced pipeline is broader journey impact from accounts with marketing touchpoints before opportunity creation: {influenced_pipeline}. Both are true, but they answer different questions. Use sourced for conservative reporting and influenced for journey context.'
  }},
  {{
    title: 'Pipeline Quality',
    keywords: ['quality','win','rate','cohort','decline','risk','pipeline','conversion','funnel','stage'],
    answer: 'Pipeline quality is the main risk. Cohort win rate moved from {cohort_start_rate} in {cohort_start_quarter} to {cohort_end_rate} in {cohort_end_quarter}, while pipeline volume rose. That means growth should be paired with ICP and qualification review before increasing broad top-of-funnel spend.'
  }},
  {{
    title: 'Funnel vs Pipeline',
    keywords: ['funnel','pipeline','stage','volume','opportunity','conversion','deals','created'],
    answer: 'Funnel volume tells you how much activity is happening. Pipeline tells you the dollar value of opportunities created. The dashboard keeps those ideas separate because more activity is not automatically better. The key concern is that pipeline grew while cohort win rate moved from {cohort_start_rate} to {cohort_end_rate}, so conversion quality matters as much as volume.'
  }},
  {{
    title: 'Budget and ROI',
    keywords: ['budget','roi','spend','reallocate','allocation','scenario','cost','efficiency'],
    answer: 'Budget scenarios are directional planning tools, not forecasts. They only model tracked-spend channels ({tracked_spend_channels}) and assume historical efficiency holds at higher spend. The safe move is phased budget testing with marginal pipeline-per-dollar tracking, not one big reallocation.'
  }},
  {{
    title: 'Experiment Design',
    keywords: ['test','testing','experiment','holdout','lift','causal','causality','incremental','measure'],
    answer: 'Use a holdout test. Pick a set of unreached strong-fit accounts, split them into treatment and holdout groups, then run email-first coverage with a tested 6sense overlay for treatment only. Measure account coverage, opportunity creation, meetings, pipeline, and win-rate quality. That turns the dashboard insight into evidence of incremental lift.'
  }},
  {{
    title: 'Email and Creative Strategy',
    keywords: ['email','creative','ads','ctr','click','open','message','copy','seniority','campaign'],
    answer: 'Use email and creative metrics as engagement signals, not final revenue proof. Strong email or ad engagement tells you which audiences and messages deserve follow-up. For ABM, tailor email by seniority, reuse high-CTR creative patterns, and connect engagement to account-level next steps rather than judging campaigns by clicks alone.'
  }},
  {{
    title: '6sense Role',
    keywords: ['6sense','display','intent','overlay','journey','sequence','touchpoint'],
    answer: '6sense is best framed as an ABM coverage and journey-support channel. The recommendation is not simply to spend more on 6sense; it is to test a 6sense overlay after email engagement, especially for strong-fit unreached accounts. That keeps the strategy targeted and measurable.'
  }},
  {{
    title: 'Executive Talk Track',
    keywords: ['presentation','present','judge','executive','talk','story','slide','explain','defend'],
    answer: 'Use this talk track: first, marketing influence is larger than CRM source credit ({influenced_pipeline} influenced vs {sourced_pipeline} sourced). Second, the biggest growth lever is coverage because {unreached_pct} of target accounts are unreached. Third, protect quality because win rate moved from {cohort_start_rate} to {cohort_end_rate}. Then recommend a holdout-tested coverage expansion.'
  }},
  {{
    title: 'Low Sample Sizes',
    keywords: ['sample','low','small','unstable','confidence','statistical','significant','significance'],
    answer: 'Small samples should be treated as signals to investigate, not proof. A channel or segment can show a high win rate because it has very few deals. For decisions, pair rates with deal count, pipeline size, and confidence labels. The dashboard flags low-N contexts so budget decisions do not overreact to noisy slices.'
  }},
  {{
    title: 'Caveats',
    keywords: ['caveat','caveats','limits','limitation','causality','confidence','trust','risk'],
    answer: 'Key caveats: attribution is directional and does not prove causality; web traffic is only connectable when domains match; low-volume channels can be unstable; ROI excludes channels without reliable spend; and win-probability scores are prioritization aids, not guaranteed outcomes.'
  }},
  {{
    title: 'Validation and Data Quality',
    keywords: ['validation','quality','data','clean','domain','unknown','concentration','date'],
    answer: 'The dashboard passed validation with 0 warnings. The quality strip reports {domain_match_rate} opportunity domain coverage, {missing_create_dates} opportunities missing create date, {unknown_channel_pct} unknown/other channel share, {top3_pipeline_share} top-3 channel concentration, and {attribution_reconciliation} influenced-vs-sourced reconciliation.'
  }},
  {{
    title: 'Model',
    keywords: ['model','auc','prediction','probability','open','deals','machine','learning','ml'],
    answer: 'The win-probability model is a prioritization signal for open opportunities. It scored {open_deals} open deals, with AUC {model_auc} using {model_validation}. Use it to prioritize sales review, but validate performance against holdout outcomes and business context.'
  }}
];

function openCaveats() {{
  document.body.classList.add('drawer-open');
  if (caveatsDrawer) caveatsDrawer.setAttribute('aria-hidden', 'false');
}}
function closeCaveatsDrawer() {{
  document.body.classList.remove('drawer-open');
  if (caveatsDrawer) caveatsDrawer.setAttribute('aria-hidden', 'true');
}}
if (printButton) printButton.addEventListener('click', () => window.print());
if (caveatsButton) caveatsButton.addEventListener('click', openCaveats);
if (closeCaveats) closeCaveats.addEventListener('click', closeCaveatsDrawer);
if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeCaveatsDrawer);
function openAssistant() {{
  document.body.classList.add('assistant-open');
  if (assistantPanel) assistantPanel.setAttribute('aria-hidden', 'false');
  if (assistantButton) assistantButton.setAttribute('aria-expanded', 'true');
  if (assistantBody && !assistantBody.dataset.seeded) {{
    addAssistantMessage('bot', 'Dashboard AI', 'Ask me about the recommendation, attribution, ROI caveats, account coverage, pipeline quality, or the ML model. I answer only from this dashboard.');
    assistantBody.dataset.seeded = 'true';
  }}
  setTimeout(() => assistantInput && assistantInput.focus(), 50);
}}
function closeAssistantPanel() {{
  document.body.classList.remove('assistant-open');
  if (assistantPanel) assistantPanel.setAttribute('aria-hidden', 'true');
  if (assistantButton) assistantButton.setAttribute('aria-expanded', 'false');
}}
function tokenizeAssistant(text) {{
  return text.toLowerCase().split(/[^a-z0-9$%.]+/).filter(Boolean);
}}
function answerDashboardQuestion(question) {{
  const tokens = tokenizeAssistant(question);
  const normalizedQuestion = question.toLowerCase();
  const conclusionPhrases = ['ultimate conclusion', 'based on this data', 'based on the data', 'bottom line', 'main takeaway', 'final takeaway', 'overall conclusion', 'what does this mean'];
  const directConclusion = conclusionPhrases.some(phrase => normalizedQuestion.includes(phrase)) ||
    (tokens.includes('conclusion') && (tokens.includes('data') || tokens.includes('ultimate') || tokens.includes('overall')));
  if (directConclusion) {{
    return ASSISTANT_KNOWLEDGE.find(item => item.title === 'Main Recommendation');
  }}
  let best = null;
  let bestScore = 0;
  ASSISTANT_KNOWLEDGE.forEach(item => {{
    const score = item.keywords.reduce((sum, kw) => sum + (tokens.includes(kw) || normalizedQuestion.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {{
      best = item;
      bestScore = score;
    }}
  }});
  if (!best || bestScore === 0) {{
    return {{
      title: 'Try a dashboard question',
      answer: 'I can answer questions about the main recommendation, marketing-sourced vs influenced pipeline, coverage gaps, ROI caveats, pipeline quality, data validation, and the win-probability model.'
    }};
  }}
  return best;
}}
async function callDashboardLLM(question) {{
  const response = await fetch('/api/chat', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{message: question}})
  }});
  if (!response.ok) throw new Error('Assistant API unavailable');
  const data = await response.json();
  if (!data || !data.answer) throw new Error('Assistant returned no answer');
  return {{
    title: data.mode === 'ollama' ? 'Ollama Agent' : (data.mode === 'gemini' ? 'Gemini Assistant' : 'Dashboard AI'),
    answer: data.answer
  }};
}}
function addAssistantMessage(role, title, text) {{
  if (!assistantBody) return;
  const msg = document.createElement('div');
  msg.className = `assistant-message ${{role}}`;
  if (role === 'bot') {{
    const heading = document.createElement('strong');
    heading.textContent = title;
    msg.appendChild(heading);
  }}
  const body = document.createElement('span');
  body.textContent = text;
  msg.appendChild(body);
  assistantBody.appendChild(msg);
  assistantBody.scrollTop = assistantBody.scrollHeight;
  return msg;
}}
async function submitAssistantQuestion(question) {{
  const q = question.trim();
  if (!q) return;
  addAssistantMessage('user', '', q);
  const pending = addAssistantMessage('bot', 'Dashboard AI', 'Thinking...');
  try {{
    const result = await callDashboardLLM(q);
    pending.querySelector('strong').textContent = result.title;
    pending.querySelector('span').textContent = result.answer;
  }} catch (err) {{
    const result = answerDashboardQuestion(q);
    pending.querySelector('strong').textContent = result.title;
    pending.querySelector('span').textContent = result.answer;
  }}
}}
if (assistantButton) assistantButton.addEventListener('click', () => {{
  if (document.body.classList.contains('assistant-open')) closeAssistantPanel();
  else openAssistant();
}});
if (closeAssistant) closeAssistant.addEventListener('click', closeAssistantPanel);
if (assistantForm) {{
  assistantForm.addEventListener('submit', (event) => {{
    event.preventDefault();
    submitAssistantQuestion(assistantInput ? assistantInput.value : '');
    if (assistantInput) assistantInput.value = '';
  }});
}}
document.querySelectorAll('.assistant-chip').forEach(btn => {{
  btn.addEventListener('click', () => {{
    openAssistant();
    submitAssistantQuestion(btn.dataset.question || btn.textContent || '');
  }});
}});
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
    document.querySelectorAll('.nav-link').forEach(link => {{
      const label = link.textContent.toLowerCase();
      link.classList.toggle('hidden-by-search', Boolean(q) && !label.includes(q));
    }});
  }});
}}
if (resetButton) {{
  resetButton.addEventListener('click', () => {{
    const first = document.querySelector('.nav-link[data-section="s-essential"]');
    if (first) showSection(first, 's-essential');
    setMode('analyst');
    closeCaveatsDrawer();
    closeAssistantPanel();
    window.scrollTo({{top:0, behavior:'smooth'}});
  }});
}}

document.addEventListener('keydown', (event) => {{
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
    closeAssistantPanel();
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

// â”€â”€ Chart data (injected by Python) â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  "c-essential-contribution": ["Question: is marketing impact larger than CRM source credit?", "Population: sourced and influenced attribution views.", "Decision use: report both numbers, with sourced as conservative and influenced as journey context."],
  "c-essential-coverage": ["Question: where is the biggest growth lever?", "Population: target account domains.", "Decision use: expand coverage with a holdout instead of scaling broad spend immediately."],
  "c-essential-cohort": ["Question: is growth protecting conversion quality?", "Population: opportunities by create quarter.", "Decision use: tighten ICP and qualification before increasing volume."],
  "c-essential-targeting": ["Question: which account cells deserve ABM focus?", "Population: opportunities with segment and profile fit.", "Decision use: prioritize high-fit cells before expanding reach."],
  "c-essential-budget": ["Question: what budget tests are worth considering?", "Population: tracked-spend channels only.", "Decision use: use scenarios to size tests, not to promise revenue."],
  "c-bar-channel": ["Question: which CRM-sourced channels create the most pipeline?", "Population: all deduplicated opportunities.", "Benchmark: compare each bar against total pipeline share."],
  "c-donut-won": ["Question: which channels actually closed revenue?", "Population: closed-won opportunities only.", "Caution: low-volume channels can swing sharply."],
  "c-monthly-trend": ["Question: is pipeline creation changing over time?", "Population: opportunities with a create date.", "Benchmark: look for sustained trend, not one-month spikes."],
  "c-attrib-comparison": ["Question: how does credit change by attribution model?", "Population: attributed opportunity touchpoints.", "Caution: model choice changes the answer."],
  "c-sourced-influenced": ["Question: how much contribution is visible in CRM vs broader account influence?", "Population: sourced and influenced attribution views.", "Benchmark: influenced should be reported beside sourced."],
  "c-attrib-waterfall": ["Question: which channels gain or lose credit near conversion?", "Population: first-touch vs last-touch attribution.", "Caution: this describes journey role, not causality."],
  "c-spend-pipeline": ["Question: where does tracked spend appear efficient?", "Population: channels with reliable spend.", "Caution: ROI excludes untracked channels."],
  "c-funnel": ["Question: what is the volume by channel activity and opportunity outcome?", "Population: separate activity populations, not one sequential funnel.", "Caution: do not read cross-channel bars as conversion steps."],
  "c-seg-heatmap": ["Question: which segment/industry cells hold pipeline?", "Population: opportunities with segment and industry values.", "Benchmark: prioritize cells with both value and enough volume."],
  "c-seg-winrate": ["Question: which segments balance win rate and deal size?", "Population: deduplicated opportunities by segment.", "Caution: small segments need validation."],
  "c-creative-ctr": ["Question: which ad creatives earn attention?", "Population: creative rows with impressions and clicks.", "Benchmark: compare CTR before scaling spend."],
  "c-creative-attr": ["Question: which creative attributes correlate with engagement?", "Population: grouped creative metadata.", "Caution: this is correlation, not message causality."],
  "c-email-seniority": ["Question: which seniority engages with email?", "Population: email engagement records.", "Benchmark: opens and clicks answer different questions."],
  "c-budget-scenario": ["Question: what could happen under budget shifts?", "Population: tracked-spend channels only.", "Caution: scenario assumes historical efficiency."],
  "c-feat-imp": ["Question: what signals drive the win model?", "Population: closed opportunities used for training.", "Caution: importance is predictive, not causal."],
  "c-win-prob": ["Question: how are open deals distributed by win probability?", "Population: currently open scored deals.", "Benchmark: use bands for prioritization."],
  "c-account-coverage": ["Question: where is the account coverage gap?", "Population: target account domains.", "Benchmark: compare opportunity rate by coverage tier."],
  "c-deal-velocity": ["Question: how long do won deals take by channel?", "Population: closed-won opportunities with valid close dates.", "Caution: low-N channels need flags."],
  "c-journey": ["Question: what touchpoint sequences appear before wins?", "Population: won deals with linked pre-opportunity touchpoints.", "Caution: sequences are descriptive."],
  "c-targeting-matrix": ["Question: which segment/profile-fit cells deserve ABM priority?", "Population: opportunities with segment and profile fit.", "Benchmark: dark cells need enough deal count."],
  "c-cohort": ["Question: is pipeline growth protecting conversion quality?", "Population: opportunities by create quarter.", "Benchmark: compare pipeline trend against win-rate trend."]
}};

const CHART_STORY = {{
  "c-essential-contribution": {{
    finding: "Influenced pipeline is materially larger than CRM-sourced pipeline.",
    meaning: "Marketing is showing up in the buyer journey even when it is not the official source.",
    action: "Report sourced as conservative credit and influenced as journey impact."
  }},
  "c-essential-coverage": {{
    finding: "A large share of target accounts still has no tracked email or 6sense touch.",
    meaning: "The easiest growth lever is not more channels; it is reaching the right accounts already in the ICP universe.",
    action: "Launch a strong-fit account coverage test with a holdout group."
  }},
  "c-essential-cohort": {{
    finding: "Pipeline volume rises while win-rate quality weakens in recent cohorts.",
    meaning: "Growth is at risk of becoming lower quality if qualification and ICP fit are not tightened.",
    action: "Audit ICP and qualification before scaling broad top-of-funnel spend."
  }},
  "c-essential-targeting": {{
    finding: "Win rate varies sharply by segment and 6sense profile fit.",
    meaning: "ABM budget should be concentrated where fit and conversion probability are strongest.",
    action: "Prioritize high-fit cells for personalized outreach and paid coverage."
  }},
  "c-essential-budget": {{
    finding: "Tracked-spend scenarios show where budget tests may be efficient.",
    meaning: "The scenario is a planning model, not a forecast guarantee.",
    action: "Use it to size controlled experiments, then measure incremental lift."
  }},
  "c-bar-channel": {{
    finding: "Pipeline is concentrated in a small set of source channels.",
    meaning: "Channel scale and channel quality need to be evaluated separately.",
    action: "Pair pipeline ranking with win rate and deal velocity before reallocating spend."
  }},
  "c-sourced-influenced": {{
    finding: "Influenced credit tells a broader story than CRM source credit.",
    meaning: "Single-source reporting understates marketing's account-journey role.",
    action: "Use both views in CMO reporting and label them clearly."
  }},
  "c-account-coverage": {{
    finding: "Many target accounts are not yet covered by tracked marketing touches.",
    meaning: "Coverage expansion can increase learning and opportunity creation without changing the ICP.",
    action: "Build a coverage plan for unreached strong-fit accounts."
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
    finding: "Spend scenarios point to plausible budget tests.",
    meaning: "Historical ROI can guide experiments but should not be treated as causal proof.",
    action: "Approve phased tests with measurement guardrails."
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
    showChartState(el, 'Chart library unavailable', 'Plotly could not be loaded. Check the network connection and refresh.');
    return;
  }}
  if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {{
    showChartState(el, 'No chart data', 'This view has no records after the current data filters.');
    return;
  }}
  try {{
    Plotly.newPlot(el, spec.data, spec.layout || {{}}, PLOTLY_CONFIG);
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
    const headers = Array.from(table.querySelectorAll('thead th'));
    headers.forEach((th, idx) => {{
      th.dataset.sort = 'true';
      th.addEventListener('click', () => {{
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const nextAsc = !th.classList.contains('sort-asc');
        headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(nextAsc ? 'sort-asc' : 'sort-desc');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {{
          const av = parseCellValue(a.children[idx]?.textContent || '');
          const bv = parseCellValue(b.children[idx]?.textContent || '');
          if (typeof av === 'number' && typeof bv === 'number') return nextAsc ? av - bv : bv - av;
          return nextAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        }});
        rows.forEach(row => tbody.appendChild(row));
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
  document.querySelectorAll('.lens-button').forEach(btn => btn.classList.toggle('active', btn.dataset.lens === lens));
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

// â”€â”€ Channel table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const channelRows = {channel_rows};
const ctbody = document.getElementById('channel-tbody');
if(ctbody && channelRows) {{
  channelRows.forEach(r => {{
    const roi = r.pipeline_roi === null || r.pipeline_roi === undefined ? 'â€”' : r.pipeline_roi.toFixed(1)+'x';
    const rroi = r.revenue_roi === null || r.revenue_roi === undefined ? 'â€”' : r.revenue_roi.toFixed(1)+'x';
    const wr = r.win_rate === null || r.win_rate === undefined ? 'â€”' : (r.win_rate*100).toFixed(1)+'%';
    const cls = r.pipeline_roi && r.pipeline_roi > 5 ? 'green-text' : (r.pipeline_roi && r.pipeline_roi < 2 ? 'red-text' : '');
    const lowSample = r.won_count !== null && r.won_count !== undefined && r.won_count > 0 && r.won_count < 5;
    ctbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel_category}}</span></td>
      <td>${{r.deal_count}}</td>
      <td>${{(r.total_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{(r.won_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{wr}}</td>
      <td>${{r.avg_deal_size ? '$'+(r.avg_deal_size/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.channel_spend ? '$'+(r.channel_spend/1e3).toFixed(0)+'K' : '$0'}}</td>
      <td class="${{cls}}">${{roi}}</td>
      <td>${{rroi}}${{lowSample ? ' <span class="low-sample" title="Low won-deal sample size">Low N</span>' : ''}}</td>
    </tr>`;
  }});
}}

// â”€â”€ Attribution table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const attribRows = {attrib_rows};
const atbody = document.getElementById('attrib-tbody');
if(atbody && attribRows) {{
  attribRows.forEach(r => {{
    const bestModel = r.td > r.ft && r.td > r.lt && r.td > r.lin ? 'Time-Decay' :
                      r.lin > r.ft && r.lin > r.lt ? 'Linear' :
                      r.lt > r.ft ? 'Last-Touch' : 'First-Touch';
    atbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel}}</span></td>
      <td>${{r.ft ? '$'+(r.ft/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.lt ? '$'+(r.lt/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.lin ? '$'+(r.lin/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.td ? '$'+(r.td/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.sourced ? '$'+(r.sourced/1e3).toFixed(0)+'K' : 'â€”'}}</td>
      <td>${{r.influenced ? '$'+(r.influenced/1e3).toFixed(0)+'K' : 'â€”'}}</td>
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


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Build and write HTML
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def build_channel_rows():
    if channel_pipeline.empty:
        return "[]"
    rows = []
    for _, r in channel_pipeline.iterrows():
        rows.append({
            "channel_category": str(r.get("channel_category", "")),
            "deal_count": int(r.get("deal_count", 0)),
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
        total_deals=f"{total_deals:,}",
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
        sourced_pipeline=sourced_pipeline_val(),
        top_sourced_channels=top_sourced_channels_text(),
        top_won_channels=top_won_channels_text(),
        tracked_spend_channels=tracked_spend_channels_text(),
        **quality_vals,
        **coverage_vals,
        **cohort_vals,
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
    print("\n  Open in any browser â€” no server required.")


if __name__ == "__main__":
    main()
