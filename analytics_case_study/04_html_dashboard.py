"""
Phase 4 (revised): Self-Contained Interactive HTML Dashboard
Generates a single .html file — no server required, open in any browser.
Output: outputs/dashboard/Marketing_Analytics_Dashboard.html
"""
import os
import sys
import json
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import plotly.io as pio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, BRAND_COLORS, CHANNEL_COLOR_MAP
)

OUTPUT_HTML = os.path.join(
    os.path.dirname(__file__), "..", "outputs", "dashboard", "Marketing_Analytics_Dashboard.html"
)

# ─────────────────────────────────────────────
# Data loaders
# ─────────────────────────────────────────────
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
opps              = _load_clean("opportunities")
email             = _load_clean("email_engagements")
ad_metrics        = _load_clean("ad_metrics")

# ─────────────────────────────────────────────
# Global KPIs
# ─────────────────────────────────────────────
total_pipeline  = opps["_amount"].sum() if "_amount" in opps.columns else 0
won_pipeline    = opps.loc[opps["iswon"] == True, "_amount"].sum() if "iswon" in opps.columns else 0
mktg_pipeline   = opps.loc[opps["is_marketing_sourced"] == True, "_amount"].sum() \
                  if "is_marketing_sourced" in opps.columns else 0
total_deals     = len(opps)
won_deals       = (opps["iswon"] == True).sum() if "iswon" in opps.columns else 0
win_rate        = won_deals / total_deals if total_deals else 0
mktg_pct        = mktg_pipeline / total_pipeline if total_pipeline else 0

def fmt(v, m="$"):
    if pd.isna(v) or v == 0: return f"{m}0"
    if v >= 1e6:  return f"{m}{v/1e6:.1f}M"
    if v >= 1e3:  return f"{m}{v/1e3:.0f}K"
    return f"{m}{v:.0f}"

LAYOUT = dict(
    font=dict(family="Inter, Arial, sans-serif", size=13, color="#0E1B2F"),
    plot_bgcolor="#FFFFFF", paper_bgcolor="#FFFFFF",
    margin=dict(l=46, r=24, t=56, b=44),
    legend=dict(bgcolor="rgba(0,0,0,0)", font_size=12),
)

COLORS = ["#1E5AA8","#078766","#C98A22","#5B6EE1","#C24141",
          "#0E7490","#56657A","#0F766E","#7C3AED","#5F8D2E"]

# ─────────────────────────────────────────────
# Chart builders
# ─────────────────────────────────────────────

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
    df_d = channel_pipeline[channel_pipeline["won_pipeline"] > 0]
    fig = go.Figure(go.Pie(
        labels=df_d["channel_category"],
        values=df_d["won_pipeline"],
        hole=0.5, marker_colors=COLORS,
        hovertemplate="<b>%{label}</b><br>Won: $%{value:,.0f}<br>%{percent}<extra></extra>",
        textinfo="none",
    ))
    fig.update_layout(title="Won Revenue by Channel", **LAYOUT)
    return fig


def funnel_fig():
    if funnel_metrics.empty: return go.Figure()
    f = funnel_metrics[funnel_metrics["channel"] == "All Channels"].copy()
    fig = go.Figure(go.Funnel(
        y=f["stage"].tolist(), x=f["count"].tolist(),
        textinfo="value+percent initial",
        marker=dict(color=COLORS[:len(f)]),
        connector=dict(line=dict(color="#CBD5E1", width=1)),
    ))
    fig.update_layout(title="Marketing Funnel (All Channels)", **LAYOUT)
    return fig


def attribution_comparison():
    """Grouped bar: attribution model (x-axis grouping) vs channel (bars)."""
    if attribution.empty: return go.Figure()
    models = attribution["attribution_model"].unique().tolist()
    channels = attribution["channel"].unique().tolist()

    traces = []
    for i, ch in enumerate(channels):
        ch_data = attribution[attribution["channel"] == ch]
        vals = [ch_data[ch_data["attribution_model"] == m]["attributed_pipeline"].sum() for m in models]
        traces.append(go.Bar(
            name=ch, x=models, y=vals,
            marker_color=COLORS[i % len(COLORS)],
            text=[fmt(v) if v > 0 else "" for v in vals],
            textposition="outside",
            hovertemplate=f"<b>{ch}</b><br>Model: %{{x}}<br>Pipeline: $%{{y:,.0f}}<extra></extra>",
        ))

    fig = go.Figure(traces)
    fig.update_layout(
        title="Attribution Model Comparison — Pipeline Credit by Channel",
        barmode="group",
        xaxis_title="Attribution Model", yaxis_title="Attributed Pipeline ($)",
        **LAYOUT,
    )
    # Add buttons to switch between grouped / stacked views
    fig.update_layout(
        updatemenus=[dict(
            type="buttons", direction="left", x=1.0, y=1.12, showactive=True,
            buttons=[
                dict(label="Grouped", method="relayout", args=[{"barmode": "group"}]),
                dict(label="Stacked", method="relayout", args=[{"barmode": "stack"}]),
                dict(label="100% Stacked", method="relayout", args=[{"barmode": "relative"}]),
            ]
        )]
    )
    return fig


def sourced_vs_influenced():
    """Donut pair: Sourced pipeline vs Influenced pipeline."""
    if attribution.empty: return go.Figure()
    sourced_total = attribution[attribution["attribution_model"] == "Marketing Sourced"]["attributed_pipeline"].sum()
    influenced_total = attribution[attribution["attribution_model"] == "Marketing Influenced"]["attributed_pipeline"].sum()
    non_mktg = total_pipeline - sourced_total

    fig = go.Figure()
    fig.add_trace(go.Pie(
        labels=["Mktg Sourced", "Other"], values=[sourced_total, max(0, non_mktg)],
        hole=0.55, domain={"x": [0.0, 0.45]},
        marker_colors=["#2563EB", "#E2E8F0"],
        name="Sourced", title=dict(text="Sourced", font_size=13),
        textinfo="percent",
    ))
    fig.add_trace(go.Pie(
        labels=["Mktg Influenced", "No Touch"], values=[influenced_total, max(0, total_pipeline - influenced_total)],
        hole=0.55, domain={"x": [0.55, 1.0]},
        marker_colors=["#10B981", "#E2E8F0"],
        name="Influenced", title=dict(text="Influenced", font_size=13),
        textinfo="percent",
    ))
    fig.update_layout(title="Marketing Sourced vs Influenced Pipeline", **LAYOUT)
    return fig


def attribution_waterfall():
    """Waterfall showing credit shift from first-touch to last-touch for top channels."""
    if attribution.empty: return go.Figure()
    ft = attribution[attribution["attribution_model"] == "First-Touch"].set_index("channel")["attributed_pipeline"]
    lt = attribution[attribution["attribution_model"] == "Last-Touch"].set_index("channel")["attributed_pipeline"]
    channels = list(set(ft.index.tolist() + lt.index.tolist()))
    delta = [(lt.get(c, 0) - ft.get(c, 0)) for c in channels]
    colors = ["#10B981" if d >= 0 else "#EF4444" for d in delta]
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
    df["win_rate_pct"] = df["win_rate"].fillna(0) * 100
    fig = px.scatter(
        df, x="channel_spend", y="total_pipeline",
        size="win_rate_pct", color="channel_category",
        text="channel_category",
        size_max=50,
        color_discrete_sequence=COLORS,
        labels={"channel_spend": "Spend ($)", "total_pipeline": "Pipeline ($)"},
        title="Spend vs Pipeline — Bubble Size = Win Rate",
    )
    fig.update_traces(textposition="top center")
    fig.update_layout(**LAYOUT)
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
    if opps.empty or "segment__c" not in opps.columns or "iswon" not in opps.columns: return go.Figure()
    df = opps.dropna(subset=["segment__c"]).groupby("segment__c").agg(
        deals=("_opportunity_id","count"),
        won=("iswon", lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        avg_deal=("_amount","mean"),
    ).reset_index()
    df["win_rate"] = df["won"] / df["deals"]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Win Rate", x=df["segment__c"], y=df["win_rate"],
                         marker_color="#2563EB", yaxis="y",
                         text=[f"{v:.0%}" for v in df["win_rate"]], textposition="outside",
                         hovertemplate="%{x}<br>Win Rate: %{y:.1%}<extra></extra>"))
    fig.add_trace(go.Bar(name="Avg Deal ($)", x=df["segment__c"], y=df["avg_deal"],
                         marker_color="#F59E0B", yaxis="y2",
                         hovertemplate="%{x}<br>Avg Deal: $%{y:,.0f}<extra></extra>"))
    fig.update_layout(
        title="Win Rate & Avg Deal Size by Segment",
        yaxis=dict(title="Win Rate", tickformat=".0%", side="left"),
        yaxis2=dict(title="Avg Deal ($)", overlaying="y", side="right"),
        barmode="group", **LAYOUT,
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
                         marker_color="#F59E0B", text=[f"{v:.1%}" for v in df["click_rate"]], textposition="outside"))
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
    for ch in ["email_mqa","6sense_display"]:
        mask = df["channel_category"] == ch
        growth[mask] = growth[mask] * 2.0
    for ch in bot2:
        mask = df["channel_category"] == ch
        growth[mask] = growth[mask] * 0.50
    scenarios["Growth Mode"] = growth

    fig = go.Figure()
    colors_s = ["#94A3B8","#2563EB","#10B981"]
    for (label, spends), color in zip(scenarios.items(), colors_s):
        proj = spends * df["ppd"]
        fig.add_trace(go.Bar(
            name=label, x=df["channel_category"].tolist(), y=proj.tolist(),
            marker_color=color,
            hovertemplate=f"<b>%{{x}}</b> — {label}<br>Projected Pipeline: $%{{y:,.0f}}<extra></extra>",
        ))
    fig.update_layout(title="Budget Scenarios — Projected Pipeline", barmode="group", **LAYOUT)
    return fig


# ─────────────────────────────────────────────
# Advanced Analytics Charts
# ─────────────────────────────────────────────

def feature_importance_chart():
    if feat_imp.empty: return go.Figure()
    df = feat_imp.head(12).sort_values("importance")
    fig = go.Figure(go.Bar(
        y=df["feature"], x=df["importance"], orientation="h",
        marker_color=COLORS[0],
        text=[f"{v:.3f}" for v in df["importance"]], textposition="outside",
        hovertemplate="<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>",
    ))
    fig.update_layout(title="Win Probability — Top Predictors (Random Forest Feature Importance)",
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

    colors_cov = ["#E2E8F0","#60A5FA","#F59E0B","#10B981"]
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
            mode="markers+lines", marker=dict(size=10, color="#EF4444"),
            yaxis="y2",
            hovertemplate="<b>%{x}</b><br>Opp Rate: %{y:.0%}<extra></extra>",
        ))
    fig.update_layout(
        title="Account Coverage — How Many Target Accounts Has Marketing Reached?",
        yaxis=dict(title="# Accounts"),
        yaxis2=dict(title="Opportunity Rate", overlaying="y", side="right",
                    tickformat=".0%", range=[0, 0.6]),
        barmode="group", **LAYOUT,
    )
    return fig


def deal_velocity_chart():
    if deal_velocity.empty: return go.Figure()
    df = deal_velocity.sort_values("median_days")
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Median Days", y=df["channel_category"], x=df["median_days"],
        orientation="h", marker_color=COLORS[0],
        text=[f"{int(v)}d (n={int(n)})" for v,n in zip(df["median_days"], df["deal_count"])],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Median days: %{x}<extra></extra>",
    ))
    fig.add_trace(go.Bar(
        name="Mean Days", y=df["channel_category"], x=df["mean_days"],
        orientation="h", marker_color=COLORS[2], opacity=0.5,
        hovertemplate="<b>%{y}</b><br>Mean days: %{x:.0f}<extra></extra>",
    ))
    fig.update_layout(title="Deal Velocity — Median Days from Deal Creation to Close (Won Deals)",
                      xaxis_title="Days to Close", barmode="overlay", **LAYOUT)
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
        text=[f"{int(d)} deals — {fmt(p)}" for d,p in zip(top["deals"], top["pipeline"])],
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
    fig.update_layout(title="Win Rate Heatmap: Segment × 6sense Profile Fit<br><sup>Darker = Higher Win Rate = Better ABM Target</sup>",
                      **LAYOUT)
    return fig


def cohort_chart():
    if cohort.empty: return go.Figure()
    df = cohort.copy()
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Pipeline ($)", x=df["quarter"], y=df["pipeline"],
        marker_color=COLORS[0], opacity=0.8,
        text=[fmt(v) for v in df["pipeline"]], textposition="outside",
        hovertemplate="<b>%{x}</b><br>Pipeline: $%{y:,.0f}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        name="Win Rate", x=df["quarter"], y=df["win_rate"],
        mode="lines+markers", marker=dict(size=8, color=COLORS[2]),
        yaxis="y2",
        hovertemplate="<b>%{x}</b><br>Win Rate: %{y:.0%}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        name="Mktg % of Deals", x=df["quarter"], y=df["mktg_pct"],
        mode="lines+markers", marker=dict(size=8, color=COLORS[1]),
        line=dict(dash="dash"), yaxis="y2",
        hovertemplate="<b>%{x}</b><br>Marketing %: %{y:.0%}<extra></extra>",
    ))
    fig.update_layout(
        title="Pipeline Cohort Analysis — Growth Trend, Win Rate & Marketing Share by Quarter",
        yaxis=dict(title="Pipeline ($)"),
        yaxis2=dict(title="Rate (%)", overlaying="y", side="right",
                    tickformat=".0%", range=[0, 0.55]),
        **LAYOUT,
    )
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
        title="Win Probability Distribution — Open Deals Scored by ML Model",
        xaxis=dict(title="Win Probability", tickformat=".0%"),
        yaxis_title="Number of Deals",
        **LAYOUT,
    )
    return fig


# ─────────────────────────────────────────────
# Serialise figures to JSON (for embedding)
# ─────────────────────────────────────────────
def fig_json(fig: go.Figure) -> str:
    return json.dumps(fig.to_dict(), cls=PlotlyJSONEncoder)


# ─────────────────────────────────────────────
# HTML Template
# ─────────────────────────────────────────────
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
    --midnight:#06162E; --midnight-2:#0B1F3A; --midnight-3:#102A4C;
    --primary:#2563EB; --primary-dark:#173C7A; --accent:#C98A22;
    --success:#078766; --danger:#C24141; --bg:#F4F7FB; --card:#FFFFFF;
    --border:#DCE4EF; --text:#0E1B2F; --muted:#5D6B7D; --muted-2:#8A97A8;
    --nav:#06162E; --nav-hover:#102A4C; --nav-active:#1E4F8F;
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  html {{ scroll-behavior:smooth; }}
  body {{ font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; min-height:100vh; font-size:14px; line-height:1.5; letter-spacing:0; }}

  /* Sidebar */
  #sidebar {{
    width:248px; min-height:100vh; background:var(--nav);
    display:flex; flex-direction:column; flex-shrink:0; position:fixed; z-index:100;
    border-right:1px solid rgba(255,255,255,.08);
  }}
  .sidebar-brand {{
    padding:22px 22px 18px; color:#F8FAFC; font-size:15px; font-weight:700;
    border-bottom:1px solid rgba(255,255,255,.1);
    line-height:1.4;
  }}
  .sidebar-brand small {{ display:block; font-size:11px; font-weight:500; color:#9FB2CA; margin-top:3px; }}
  .nav-item {{ list-style:none; }}
  .nav-link {{
    display:flex; align-items:center; gap:11px; margin:3px 12px; padding:10px 12px;
    color:#B8C5D8; text-decoration:none; font-size:13px; font-weight:600;
    border-radius:7px; border-left:0; transition:all .16s ease;
    cursor:pointer;
  }}
  .nav-link:hover {{ color:#FFFFFF; background:var(--nav-hover); }}
  .nav-link.active {{ color:#FFFFFF; background:var(--nav-active); box-shadow:inset 3px 0 0 #7DB3FF; }}
  .nav-icon {{ width:18px; height:18px; flex:0 0 18px; stroke-width:2; }}

  /* Main */
  #main {{ margin-left:248px; flex:1; padding:0; min-width:0; }}
  .top-bar {{
    background:linear-gradient(90deg,var(--midnight),var(--midnight-2)); color:#FFFFFF;
    padding:16px 32px; border-bottom:1px solid rgba(255,255,255,.08);
    display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:50;
  }}
  .top-bar h1 {{ font-size:19px; font-weight:700; color:#FFFFFF; margin:0; }}
  .top-meta {{ display:flex; gap:10px; align-items:center; color:#C8D4E6; font-size:12px; }}
  .badge-pill {{
    background:#ECFDF5; color:#047857; padding:4px 10px;
    border-radius:999px; font-size:11px; font-weight:700; border:1px solid #A7F3D0;
  }}

  /* KPI cards */
  .kpi-row {{ display:grid; grid-template-columns:repeat(4,minmax(170px,1fr)); gap:14px; padding:22px 32px 0; }}
  .kpi-card {{
    background:var(--card); border-radius:8px; padding:15px 16px 14px;
    min-width:0; border:1px solid var(--border); box-shadow:none;
  }}
  .kpi-card::before {{ content:""; display:block; width:28px; height:3px; border-radius:999px; background:var(--primary); margin-bottom:11px; }}
  .kpi-card.green::before  {{ background:var(--success); }}
  .kpi-card.orange::before {{ background:var(--accent); }}
  .kpi-card.purple::before {{ background:#7C3AED; }}
  .kpi-label {{ font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.04em; }}
  .kpi-value {{ font-size:26px; font-weight:700; color:var(--midnight); margin-top:5px; line-height:1.08; }}
  .kpi-sub   {{ font-size:12px; color:var(--muted); margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}

  /* Sections */
  .section {{ display:none; padding:22px 32px 42px; }}
  .section.active {{ display:block; }}
  .section-title {{
    font-size:19px; font-weight:700; color:var(--midnight);
    margin-bottom:4px; border-left:0; padding-left:0;
  }}
  .section-desc {{
    font-size:14px; color:var(--muted); margin-bottom:15px; padding-left:0; max-width:900px;
  }}

  /* Chart cards */
  .chart-grid {{ display:grid; gap:14px; align-items:start; }}
  .chart-grid.cols-2 {{ grid-template-columns:1fr 1fr; }}
  .chart-grid.cols-3 {{ grid-template-columns:1fr 1fr 1fr; }}
  .chart-card {{
    background:var(--card); border-radius:8px; padding:14px;
    border:1px solid var(--border); box-shadow:none; min-width:0;
  }}
  .chart-card.full {{ grid-column:1/-1; }}

  /* Context box */
  .context-box {{
    background:#FFFFFF; border:1px solid var(--border); border-left:3px solid var(--primary);
    border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#243449; line-height:1.6;
  }}
  .context-box strong {{ font-weight:600; }}

  /* Per-chart explanation box */
  .chart-explain {{
    background:#F9FAFB; border:1px solid #EEF0F3;
    padding:10px 12px; margin-top:10px; border-radius:7px;
    font-size:12px; color:#4B5C70; line-height:1.5;
  }}
  .chart-explain .ex-title {{
    font-weight:700; color:var(--midnight); font-size:12px; margin-bottom:4px;
    display:flex; align-items:center; gap:6px;
  }}
  .chart-explain .ex-title::before {{
    content:""; display:inline-block; width:6px; height:6px;
    background:var(--primary); border-radius:999px; flex-shrink:0;
  }}
  .chart-explain .ex-insight {{
    margin-top:7px; padding:7px 9px;
    background:#F0FDF4; border-left:2px solid var(--success);
    border-radius:5px; font-size:12px; color:#155E43; font-weight:600;
  }}
  .ex-body {{ margin-top:8px; color:#4B5C70; }}
  .learn-toggle {{
    margin-top:8px; display:inline-flex; align-items:center; gap:6px;
    border:1px solid #C9D7EA; background:#FFFFFF; color:var(--primary-dark);
    border-radius:6px; padding:5px 9px; font-size:12px; font-weight:700;
    cursor:pointer;
  }}
  .learn-toggle:hover {{ background:#F2F7FE; }}
  .learn-toggle i {{ width:14px; height:14px; transition:transform .16s ease; }}
  .chart-explain.open .learn-toggle i {{ transform:rotate(180deg); }}
  .chart-explain.collapsed .ex-body {{ display:none; }}

  /* Attribution model pills */
  .model-legend {{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }}
  .model-pill {{
    padding:4px 12px; border-radius:999px; font-size:11px; font-weight:600;
    color:#fff; background:var(--primary);
  }}
  .model-pill.lt {{ background:var(--accent); }}
  .model-pill.lin {{ background:var(--success); }}
  .model-pill.td  {{ background:#8B5CF6; }}

  /* Table */
  .dash-table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  .dash-table th {{
    background:#F9FAFB; color:#374151; padding:9px 12px;
    text-align:left; font-weight:700; white-space:nowrap; border-bottom:1px solid var(--border);
  }}
  .dash-table td {{ padding:8px 12px; border-bottom:1px solid #F3F4F6; }}
  .dash-table tr:nth-child(even) {{ background:#FCFCFD; }}
  .dash-table tr:hover {{ background:#F9FAFB; }}
  .green-text  {{ color:var(--success); font-weight:600; }}
  .red-text    {{ color:var(--danger);  font-weight:600; }}
  .badge-ch    {{ background:#F3F4F6; color:#374151; padding:3px 7px; border-radius:5px; font-size:11px; font-weight:600; }}
  .js-plotly-plot, .plot-container {{ min-height:360px; }}
  @media(max-width:900px){{
    .chart-grid.cols-2,.chart-grid.cols-3,.kpi-row {{ grid-template-columns:1fr; }}
    #sidebar {{ width:64px; }}
    #main   {{ margin-left:64px; }}
    .sidebar-brand,.nav-link span {{ display:none; }}
    .top-bar {{ align-items:flex-start; gap:8px; flex-direction:column; padding:14px 18px; }}
    .section,.kpi-row {{ padding-left:18px; padding-right:18px; }}
  }}
</style>
</head>
<body>

<!-- ─── Sidebar ─────────────────────────────── -->
<nav id="sidebar">
  <div class="sidebar-brand">
    Marketing Analytics
    <small>B2B SaaS &nbsp;|&nbsp; 2023-2024</small>
  </div>
  <ul class="nav flex-column mt-2" id="navMenu">
    <li class="nav-item"><a class="nav-link active" data-section="s-exec" onclick="showSection(this,'s-exec')"><i class="nav-icon" data-lucide="layout-dashboard"></i><span>Executive Summary</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-attrib" onclick="showSection(this,'s-attrib')"><i class="nav-icon" data-lucide="git-branch"></i><span>Attribution Models</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-channel" onclick="showSection(this,'s-channel')"><i class="nav-icon" data-lucide="trending-up"></i><span>Channel Performance</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-segment" onclick="showSection(this,'s-segment')"><i class="nav-icon" data-lucide="building-2"></i><span>Segment Analysis</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-creative" onclick="showSection(this,'s-creative')"><i class="nav-icon" data-lucide="mail"></i><span>Creative & Email</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-budget" onclick="showSection(this,'s-budget')"><i class="nav-icon" data-lucide="circle-dollar-sign"></i><span>Budget Scenarios</span></a></li>
    <li class="nav-item"><a class="nav-link" data-section="s-advanced" onclick="showSection(this,'s-advanced')"><i class="nav-icon" data-lucide="brain-circuit"></i><span>Advanced Analytics</span></a></li>
  </ul>
</nav>

<!-- ─── Main ────────────────────────────────── -->
<div id="main">
  <div class="top-bar">
    <h1>Marketing Analytics Dashboard</h1>
    <div class="top-meta">
      <span>Data: 2021–2024 &nbsp;|&nbsp; {total_deals} Opportunities &nbsp;|&nbsp; 8 Datasets</span>
      <span class="badge-pill">Validated</span>
    </div>
  </div>

  <!-- KPI Row (always visible) -->
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Total Pipeline</div><div class="kpi-value">{total_pipeline}</div><div class="kpi-sub">{total_deals} opportunities</div></div>
    <div class="kpi-card green"><div class="kpi-label">Won Revenue</div><div class="kpi-value">{won_pipeline}</div><div class="kpi-sub">Win rate: {win_rate}</div></div>
    <div class="kpi-card orange"><div class="kpi-label">Mktg-Sourced Pipeline</div><div class="kpi-value">{mktg_pipeline}</div><div class="kpi-sub">{mktg_pct} of total pipeline</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Influenced Pipeline</div><div class="kpi-value">{influenced_pipeline}</div><div class="kpi-sub">Accounts with any mktg touch</div></div>
  </div>

  <!-- ── 1. Executive Summary ─────────────── -->
  <div id="s-exec" class="section active">
    <div class="section-title">Executive Summary</div>
    <div class="section-desc">High-level pipeline, revenue, and channel overview for a B2B ABM company targeting specific accounts with 6sense display ads, email, and events.</div>
    <div class="context-box">
      <strong>How to read this dashboard:</strong> This company uses Account-Based Marketing (ABM) — instead of advertising to everyone, they pick specific companies ("target accounts") and run coordinated campaigns at those companies. A deal is born when a target account agrees to a sales conversation and eventually signs a contract. The job of this dashboard is to answer: <em>which marketing activities led to those deals?</em>
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-bar-channel"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Pipeline by Channel</div>
          Each bar is the total dollar value of all deals (won + open) where the CRM lead source was tagged as that marketing channel. This is <strong>Marketing Sourced</strong> pipeline — only deals where marketing is listed as the origin.
          <br><br><strong>Why "Other" and "Existing Client" are biggest:</strong> Most B2B deals come from existing customer expansions or sales-led outreach — that's normal. Marketing's role is to generate the <em>net-new</em> pipeline (6sense, email, web inbound, events).
          <div class="ex-insight">Key takeaway: 6sense Channel ($1.54M) + Web Inbound ($1.1M) + Events ($678K) are the top net-new marketing channels by sourced pipeline.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-donut-won"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Won Revenue by Channel</div>
          Of all deals that were actually <strong>closed and won</strong> (signed contracts, real money), this shows which channel sourced them. Only channels with won revenue appear.
          <br><br><strong>Why Existing Client dominates:</strong> Upselling to existing customers is the highest-win-rate motion in B2B (54% win rate). They already trust you. New business from marketing channels closes at 10–20%.
          <div class="ex-insight">Key takeaway: Referral ($1.16M won) and Existing Client ($1.17M won) close at the highest rates. Marketing channels are building the <em>future</em> pipeline — wins will lag campaigns by 3–12 months.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-monthly-trend"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Pipeline Created by Month</div>
          Each colored band represents pipeline (deal value) created in that month, stacked by channel. A taller bar = more deals created that month. The color split shows which channels are active at different times of year.
          <br><br><strong>How to use it:</strong> Look for spikes — did they follow a campaign launch? Look for drops — did a channel go quiet? This helps connect campaign activity to deal creation with a time lag.
          <div class="ex-insight">Key takeaway: Compare this chart to your campaign calendar. Pipeline spikes 30–90 days after major campaign pushes — that's your sales cycle length showing up in the data.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 2. Attribution Models ────────────── -->
  <div id="s-attrib" class="section">
    <div class="section-title">Attribution Analysis</div>
    <div class="section-desc">How different models split deal credit across marketing touchpoints — the core of understanding marketing ROI.</div>
    <div class="context-box">
      <strong>The core concept:</strong> Every won deal has a trail of marketing touchpoints — ads seen, emails opened, website visits — that happened before the deal was created. Attribution models answer the question: <em>how much of this deal's dollar value should each marketing channel get credit for?</em>
      <br><br>
      We traced 80,500 touchpoints across 3,570 companies and linked them to 3,166 opportunities within a 365-day window before deal creation. Here are the 6 models:
      <br><br>
      <span class="model-pill">Sourced</span>&nbsp; CRM says marketing was the origin. Hard credit, no sharing. ($4.2M)
      &nbsp;<span class="model-pill lt">Influenced</span>&nbsp; Marketing touched the account at any point before the deal. Measures reach. ($6.5M)
      &nbsp;<span class="model-pill">First-Touch</span>&nbsp; 100% credit to the <em>first</em> marketing touch — finds who starts conversations.
      &nbsp;<span class="model-pill lt">Last-Touch</span>&nbsp; 100% credit to the <em>last</em> touch before the deal — finds who closes conversations.
      &nbsp;<span class="model-pill lin">Linear</span>&nbsp; Equal split across ALL channels that touched the account — fairest view.
      &nbsp;<span class="model-pill td">Time-Decay</span>&nbsp; More credit to <em>recent</em> touches, less to old ones (half-life = 30 days). Best for budget decisions.
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div id="c-attrib-comparison"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Attribution Model Comparison</div>
          <strong>This is the most important chart.</strong> Each group of bars is one attribution model. Within each group, each colored bar is one marketing channel. The bar height = how many dollars of pipeline that channel gets credited with under that model.
          <br><br>
          <strong>How to read it:</strong> Compare the same channel across different models. If Email's bar is tall in First-Touch but shorter in Last-Touch, Email is good at starting conversations but someone else closes them.
          <br><br>
          <strong>Example walkthrough:</strong> Company "Acme Corp" sees 6sense ads for 3 months (6sense gets credit), gets 2 emails (Email gets credit), visits the website once (Web gets credit), then a deal worth $50K is created. Under <em>First-Touch</em>: Email gets $50K. Under <em>Last-Touch</em>: Web gets $50K. Under <em>Linear</em>: each channel gets $16.7K. Under <em>Time-Decay</em>: Web gets the most because it happened closest to the deal.
          <div class="ex-insight">Key takeaway: Email starts conversations (high First-Touch). 6sense Display keeps the brand visible and is there at the end (high Last-Touch + Time-Decay). Use the toggle buttons above to switch between grouped, stacked, and 100% stacked views.</div>
        </div>
      </div>
    </div>
    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-sourced-influenced"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Sourced vs. Influenced Pipeline</div>
          Two donuts, two definitions of marketing contribution:
          <br><br>
          <strong>LEFT — Sourced (16%):</strong> The CRM field "Lead Source" explicitly says this deal came from marketing. Hard attribution. Conservative.
          <br><br>
          <strong>RIGHT — Influenced (28%):</strong> Marketing touched this account (any ad, email, or web visit) within 365 days before the deal was created — even if sales "sourced" the deal officially.
          <br><br>
          The gap between Sourced and Influenced is the "shadow credit" — marketing's work that doesn't show up in traditional CRM reporting.
          <div class="ex-insight">Key takeaway: If you only report on Sourced, you're attributing $4.2M to marketing. If you use Influenced, it's $6.5M. Both are true — they just answer different questions.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-attrib-waterfall"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — First-Touch vs. Last-Touch Credit Shift</div>
          This shows how much each channel's credit <em>changes</em> when you switch from First-Touch to Last-Touch. Green bars = the channel gets MORE credit in Last-Touch. Red bars = the channel gets LESS credit.
          <br><br>
          <strong>Why it matters:</strong> A channel that loses credit (red) is an <em>awareness channel</em> — it gets the conversation started but isn't involved at the decision point. A channel that gains credit (green) is a <em>conversion channel</em> — it's there when deals close.
          <div class="ex-insight">Key takeaway: 6sense Display gains credit going from First-Touch to Last-Touch — their ads are still running when accounts are in late-stage evaluation. Email loses credit — email starts things but isn't always the last touch.</div>
        </div>
      </div>
    </div>

    <!-- Attribution Table -->
    <div class="chart-card" style="margin-top:16px">
      <div class="section-title" style="font-size:13px;margin-bottom:6px">Full Attribution Table — All Models Side by Side</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:10px">Every channel across every model in one place. The "Recommended Model" column shows which model gives that channel the most credit — use as a sanity check before budget decisions.</div>
      <div style="overflow-x:auto">
        <table class="dash-table" id="attrib-table">
          <thead><tr><th>Channel</th><th>First-Touch ($)</th><th>Last-Touch ($)</th><th>Linear ($)</th><th>Time-Decay ($)</th><th>Sourced ($)</th><th>Influenced ($)</th><th>Best Model for Channel</th></tr></thead>
          <tbody id="attrib-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── 3. Channel Performance ───────────── -->
  <div id="s-channel" class="section">
    <div class="section-title">Channel Performance</div>
    <div class="section-desc">ROI, win rate, and funnel conversion by marketing channel — the efficiency scorecard.</div>
    <div class="context-box">
      <strong>What "ROI" means here:</strong> Pipeline ROI = pipeline generated ÷ dollars spent. A Pipeline ROI of 5x means every $1 in ad spend generated $5 in deal pipeline. This is different from Revenue ROI (only counting won deals) — both matter. Pipeline ROI tells you if you're building a healthy funnel. Revenue ROI tells you if it's converting.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-spend-pipeline"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Spend vs. Pipeline Scatter Plot</div>
          Each bubble is a marketing channel. <strong>X-axis:</strong> how much money was spent on that channel. <strong>Y-axis:</strong> how much pipeline (total deal value) it generated. <strong>Bubble size:</strong> the channel's win rate — bigger bubble = more deals closed.
          <br><br>
          <strong>Where you want to be:</strong> Top-left = low spend, high pipeline = excellent ROI. Bottom-right = high spend, low pipeline = poor ROI.
          <br><br>
          <strong>Why only some channels have bubbles:</strong> Only channels with tracked ad spend show up. Referral and existing client have $0 spend because they come in organically.
          <div class="ex-insight">Key takeaway: Channels in the top-left corner deserve more budget. Channels in the bottom-right are candidates for reduction or strategy change.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-funnel"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Marketing Funnel</div>
          This is the full conversion funnel from the first time someone sees an ad to a closed deal. Each step shows how many people/companies made it that far.
          <br><br>
          <strong>Step by step:</strong><br>
          135M Impressions → 71K Clicks (0.05% CTR — normal for display ads)<br>
          71K Clicks → 1,286 Form Fills (1.8% — who engaged deeper)<br>
          → 17,130 Email Engagements (separate channel, not a conversion of clicks)<br>
          → 3,288 Opportunities (all deals in the pipeline)<br>
          → 511 Marketing-Sourced (deals marketing can officially claim)<br>
          → 1,073 Closed Won (all deals closed across all channels)
          <div class="ex-insight">Key takeaway: The biggest drop-off is impressions → clicks (99.95% don't click). This is normal for ABM display — the goal isn't clicks, it's brand awareness with target accounts so they recognize you when sales calls.</div>
        </div>
      </div>
      <div class="chart-card full">
        <div class="section-title" style="font-size:13px;margin-bottom:6px">Channel ROI Summary Table</div>
        <div style="font-size:11px;color:#64748B;margin-bottom:10px">Pipeline ROI = total pipeline ÷ spend. Revenue ROI = won revenue ÷ spend. Channels with no spend tracked show — (they rely on sales effort, not ad budget).</div>
        <div style="overflow-x:auto">
          <table class="dash-table" id="channel-table">
            <thead><tr><th>Channel</th><th>Deals</th><th>Pipeline ($)</th><th>Won ($)</th><th>Win Rate</th><th>Avg Deal</th><th>Spend ($)</th><th>Pipeline ROI</th><th>Revenue ROI</th></tr></thead>
            <tbody id="channel-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 4. Segment Analysis ──────────────── -->
  <div id="s-segment" class="section">
    <div class="section-title">Segment & ICP Analysis</div>
    <div class="section-desc">Which account segments and industries have the most pipeline and highest win rates — your best ABM targeting zones.</div>
    <div class="context-box">
      <strong>What is a "Segment" in ABM?</strong> In 6sense, accounts are grouped into buying stage segments based on their digital behavior: how much content they're consuming, what keywords they're searching, how often they visit competitor websites. Common stages: <em>Awareness</em> (just starting to research), <em>Consideration</em> (evaluating options), <em>Decision</em> (ready to buy). Targeting companies in the Decision stage with the right industry profile is how ABM maximizes efficiency.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-seg-heatmap"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Pipeline Heatmap: Industry x Segment</div>
          Each cell = total pipeline from companies in that industry AND that 6sense segment. Darker blue = more pipeline concentrated there.
          <br><br>
          <strong>How to use it:</strong> The darkest cells are your highest-value targeting combinations. If Software + Decision is the darkest cell, you should prioritize software companies that 6sense flags as in the decision stage.
          <br><br>
          <strong>The dollar amounts</strong> in each cell show absolute pipeline value — useful for prioritizing where to spend ABM budget and sales time.
          <div class="ex-insight">Key takeaway: Focus outbound, personalized ads, and sales outreach on the 2–3 darkest cells. Everything else is secondary targeting.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-seg-winrate"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Win Rate & Avg Deal Size by Segment</div>
          Two metrics per segment shown as dual bars:
          <br><br>
          <strong>Blue bars (left axis):</strong> Win rate — what percentage of deals in this segment actually closed. Higher = easier to close.
          <br><br>
          <strong>Orange bars (right axis):</strong> Average deal size — how big the contracts are in this segment.
          <br><br>
          <strong>The ideal segment</strong> has BOTH a high win rate AND a high average deal size. Those are your ICP (Ideal Customer Profile) sweet spots — where you should concentrate ABM investment.
          <div class="ex-insight">Key takeaway: A segment with a high win rate but small deals might not be worth prioritizing. A segment with large deals but low win rate might need different sales approach or longer nurture. Look for the combination.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 5. Creative & Email ──────────────── -->
  <div id="s-creative" class="section">
    <div class="section-title">Creative & Email Performance</div>
    <div class="section-desc">Which ad creatives and email campaigns drive the highest engagement — tells you what messaging resonates with your target accounts.</div>
    <div class="context-box">
      <strong>Why creative matters in ABM:</strong> In ABM, you're showing ads specifically to people at your target accounts — they'll see your ads repeatedly. If your creative is bad, they'll tune it out. If it's good, it builds brand recognition so when sales calls, the prospect already knows who you are. CTR (click-through rate) is the primary measure of creative effectiveness for display ads.
    </div>
    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-creative-ctr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Top 15 Ads by CTR</div>
          CTR = Click-Through Rate = clicks ÷ impressions. If 1,000 people saw an ad and 5 clicked it, CTR = 0.5%.
          <br><br>
          <strong>Industry benchmarks:</strong> Display ads average 0.05–0.1% CTR. LinkedIn ads average 0.3–0.5%. Anything above 0.5% is very good for display. These are the top-performing creatives from your $1.22M ad spend.
          <br><br>
          <strong>What to do with this:</strong> The top ads tell your creative team what visual style, message, and CTA is working. Brief new creative based on these patterns — don't start from scratch.
          <div class="ex-insight">Key takeaway: The highest-CTR ads should be your always-on creatives. Pause the bottom performers and reallocate their budget to top performers.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-creative-attr"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — CTR by Creative Attribute (Tone/Type/CTA)</div>
          Instead of looking at individual ads, this groups all ads by a shared creative characteristic (e.g., messaging tone: "direct" vs "inspirational" vs "educational") and compares their average CTR.
          <br><br>
          <strong>How to use it:</strong> If "Direct" tone has a higher CTR than "Inspirational," brief your creative team to write more direct copy. This is strategic creative direction backed by data.
          <div class="ex-insight">Key takeaway: Use this to set creative briefs. Tell your agency: "Based on our data, X attribute outperforms Y — please prioritize X in the next batch."</div>
        </div>
      </div>
      <div class="chart-card full">
        <div id="c-email-seniority"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Email Engagement by Job Seniority</div>
          How different levels of seniority (C-Level, VP, Director, Manager) respond to email campaigns. Two metrics:
          <br><br>
          <strong>Open Rate (blue):</strong> What % of emails to that seniority level were opened. This measures subject line effectiveness and whether they recognize your brand enough to open.
          <br><br>
          <strong>Click Rate (orange):</strong> What % clicked a link inside the email. This measures content relevance — did the email body give them a reason to take action?
          <br><br>
          <strong>Why seniority matters in ABM:</strong> C-Level executives make budget decisions but have no time — they need very short, high-value emails. Managers/Directors are often the evaluators — they need detailed content. Personalizing by seniority can dramatically improve click rates.
          <div class="ex-insight">Key takeaway: The seniority level with the highest click rate is your most engaged audience — prioritize them for follow-up sequences. The seniority with high opens but low clicks needs better email body content.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 6. Budget Scenarios ──────────────── -->
  <div id="s-budget" class="section">
    <div class="section-title">Budget Recommendation & Scenarios</div>
    <div class="section-desc">Three scenarios showing what happens to projected pipeline if you reallocate the marketing budget based on ROI data.</div>
    <div class="context-box">
      <strong>How scenario modelling works:</strong> We take each channel's current "pipeline per dollar spent" efficiency rate (observed from real data) and apply it to different spending levels. If 6sense historically generates $5 of pipeline for every $1 spent, doubling the 6sense budget should generate roughly twice the pipeline (holding all other variables equal — which is a simplification, but useful for directional planning).
      <br><br>
      <strong>Three scenarios:</strong> (1) <em>Status Quo</em> — keep spending exactly as-is. (2) <em>ROI-Optimized</em> — shift 30% more to the top-ROI channels, cut the bottom channels by 20%. Same total budget, better mix. (3) <em>Growth Mode</em> — double investment in the two highest-ROI channels (email + 6sense display), cut the rest by 50%. Higher risk, higher reward.
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div id="c-budget-scenario"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Budget Scenarios: Projected Pipeline by Channel</div>
          Each group of bars is one marketing channel. Within the group, the three bars are the three budget scenarios. The bar height = how much pipeline that channel would be expected to generate under that scenario.
          <br><br>
          <strong>How to use it:</strong> Compare the total height across all channels for each scenario color. The scenario where the total (sum of all bars in that color) is tallest = the most pipeline-efficient allocation.
          <br><br>
          <strong>Important caveat:</strong> These projections assume the same efficiency ratio holds at higher spend levels. In reality, there's often diminishing returns at high spend (you run out of target accounts to reach). Treat as directional, not precise.
          <br><br>
          <strong>Underlying logic:</strong> Time-Decay attribution shows 6sense Display ($3.5M credited) and Email MQA ($2.8M credited) are the two most efficient channels. Growth Mode doubles their budgets and reduces spend on lower-ROI channels.
          <div class="ex-insight">Key takeaway: If your goal is pipeline growth and you have budget flexibility, Growth Mode projects the largest total pipeline. If budget is fixed and you need to maximize efficiency, ROI-Optimized reallocates within the same total spend. Both beat Status Quo in projected pipeline.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 7. Advanced Analytics ──────────────── -->
  <div id="s-advanced" class="section">
    <div class="section-title">Advanced Analytics</div>
    <div class="section-desc">ML win probability model, account coverage gap, deal velocity, journey sequences, and targeting matrix — datathon-level depth.</div>
    <div class="context-box">
      <strong>What makes this section different:</strong> Standard marketing analytics tells you what happened. This section predicts what will happen and tells you where to focus. The win probability model (Random Forest, AUC = 0.807) scores every open deal. The coverage analysis reveals that 68% of your target accounts have never seen a single marketing touchpoint — that is your biggest growth opportunity.
    </div>

    <div class="chart-grid cols-2">
      <div class="chart-card">
        <div id="c-feat-imp"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Win Probability: Top Predictors</div>
          A Random Forest model was trained on 2,743 closed deals to predict win probability. Feature importance shows which data points the model relied on most to predict whether a deal closes. <strong>AUC = 0.807</strong> (1.0 = perfect, 0.5 = random).
          <br><br>
          <strong>How to read:</strong> Longer bar = stronger predictor. <strong>Tier</strong> (account tier in CRM) is the #1 predictor — this reflects how well-qualified the account is. <strong>Channel</strong> (#2) means the lead source predicts win likelihood. <strong>Campaign Impressions</strong> being in the top 5 means accounts that saw more 6sense ads are more likely to close.
          <div class="ex-insight">Key insight: Intent score and campaign impressions in the top predictors validates the ABM strategy — accounts that marketing has reached DO convert better. Prioritize 6sense budget toward accounts with high intent scores.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-win-prob"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Win Probability Distribution (Open Deals)</div>
          This histogram shows 545 currently open deals scored by the ML model. Each bar = number of open deals with that win probability range. Deals on the right side (high probability) are your hottest leads.
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
          <div class="ex-title">What this shows — Account Coverage: Has Marketing Reached Your Target Accounts?</div>
          Of all 4,797 target account domains, this shows how many have been reached by email, 6sense, both, or neither. The orange line shows the opportunity rate (% of accounts in each group that have at least one CRM deal).
          <br><br>
          <strong>The critical finding:</strong> <strong>3,256 accounts (67.9%) have never received a single marketing touchpoint.</strong> Yet accounts reached by email alone have a 45.9% opportunity rate vs. 17.5% for unreached accounts — a 2.6x difference.
          <br><br>
          <strong>What to do:</strong> The 3,256 unreached accounts represent your biggest growth lever. Expand 6sense audience lists and email sequences to cover these accounts, prioritizing Strong Profile Fit ones first.
          <div class="ex-insight">Key insight: If you could reach just 10% more accounts (480 accounts) with email AND 6sense, and they convert at the "Both Channels" rate (42.6%), that's ~205 new opportunities added to the pipeline.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-deal-velocity"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Deal Velocity: How Fast Do Different Channels Close?</div>
          Median and mean days from deal creation to close win, by channel. Faster = better for revenue forecasting and sales efficiency.
          <br><br>
          <strong>Why it matters:</strong> A channel might generate large pipeline but take 9 months to close. That affects cash flow forecasting. Existing clients close in 34 days (median) because the trust is already there. 6sense channel deals take 98 days — there's more evaluation needed from net-new accounts.
          <div class="ex-insight">Key insight: If you need revenue fast, focus sales effort on existing client expansion and referrals (fastest close). If you're investing for Q3-Q4 revenue, start 6sense and event campaigns now — they need a 90-day runway.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-journey"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Winning Touchpoint Journey Sequences</div>
          For won deals that had tracked marketing touchpoints, what was the sequence of channels in order? This shows the most common channel paths that led to a closed deal.
          <br><br>
          <strong>How to read:</strong> "email_mqa → 6sense_display" means: email was the first touch, then 6sense display ads followed. The most common winning sequence validates the two-stage strategy: email opens the conversation, 6sense keeps the brand visible through the evaluation period.
          <div class="ex-insight">Key insight: Build this as a coordinated playbook — when email engagement is detected, trigger 6sense to increase impression frequency for that account. The data shows this sequence produces wins.</div>
        </div>
      </div>
    </div>

    <div class="chart-grid cols-2" style="margin-top:16px">
      <div class="chart-card">
        <div id="c-targeting-matrix"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — ABM Targeting Priority Matrix</div>
          Win rate heatmap crossing Segment (Enterprise/Commercial/Mid) vs. 6sense Profile Fit (Strong/Moderate/Weak). Darker blue = higher win rate = higher-priority target.
          <br><br>
          <strong>How to use it:</strong> The darkest cells define your Tier 1 ABM targets — where you invest your most personalized, expensive outreach. Commercial + Strong Fit (47% win rate) and Mid + Moderate (43%) are the sweet spots.
          <div class="ex-insight">Key insight: Enterprise + Strong Fit has the highest average deal size ($15,928) AND 35% win rate. Commercial + Strong Fit wins most often (47%). Run both in parallel — Enterprise for revenue growth, Commercial for volume.</div>
        </div>
      </div>
      <div class="chart-card">
        <div id="c-cohort"></div>
        <div class="chart-explain">
          <div class="ex-title">What this shows — Pipeline Cohort Analysis by Quarter</div>
          Blue bars = pipeline created each quarter (growing). Green line = win rate per quarter (declining). Yellow dashed = marketing's share of deals per quarter (volatile).
          <br><br>
          <strong>The critical trend:</strong> Pipeline is growing every quarter (good). But win rate has dropped from 37% in 2022Q1 to 15% in 2024Q4 (bad). Marketing's share peaked at 38% in 2023Q1 but dropped to 7% in 2024Q4. This means the pipeline is growing but quality is declining — either ICP targeting is drifting or deals are being rushed into the funnel without proper qualification.
          <div class="ex-insight">Key insight: This is the most important strategic signal in the entire dataset. Investigate why win rates are declining as pipeline grows. Is the ICP expanding too broadly? Are marketing-sourced deals being counted less? This needs executive attention.</div>
        </div>
      </div>
    </div>
  </div>

</div><!-- /main -->

<!-- ─── Scripts ─────────────────────────────── -->
<script>
// ── Navigation ──────────────────────────────
function showSection(link, sectionId) {{
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  link.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  // Trigger resize so Plotly charts re-fit
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}}

if (window.lucide) {{
  lucide.createIcons();
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

// ── Chart data (injected by Python) ─────────
if (window.lucide) {{
  lucide.createIcons();
}}

// Chart data (injected by Python)
const CHARTS = {{
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

const PLOTLY_CONFIG = {{responsive:true, displayModeBar:true, displaylogo:false,
  modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d']}};

Object.entries(CHARTS).forEach(([id, spec]) => {{
  const el = document.getElementById(id);
  if (el && spec && spec.data) {{
    Plotly.newPlot(el, spec.data, spec.layout || {{}}, PLOTLY_CONFIG);
  }}
}});

// ── Channel table ────────────────────────────
const channelRows = {channel_rows};
const ctbody = document.getElementById('channel-tbody');
if(ctbody && channelRows) {{
  channelRows.forEach(r => {{
    const roi = r.pipeline_roi ? r.pipeline_roi.toFixed(1)+'x' : '—';
    const rroi = r.revenue_roi ? r.revenue_roi.toFixed(1)+'x' : '—';
    const wr = r.win_rate ? (r.win_rate*100).toFixed(1)+'%' : '—';
    const cls = r.pipeline_roi && r.pipeline_roi > 5 ? 'green-text' : (r.pipeline_roi && r.pipeline_roi < 2 ? 'red-text' : '');
    ctbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel_category}}</span></td>
      <td>${{r.deal_count}}</td>
      <td>${{(r.total_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{(r.won_pipeline/1e6).toFixed(1)}}M</td>
      <td>${{wr}}</td>
      <td>${{r.avg_deal_size ? '$'+(r.avg_deal_size/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.channel_spend ? '$'+(r.channel_spend/1e3).toFixed(0)+'K' : '$0'}}</td>
      <td class="${{cls}}">${{roi}}</td>
      <td>${{rroi}}</td>
    </tr>`;
  }});
}}

// ── Attribution table ────────────────────────
const attribRows = {attrib_rows};
const atbody = document.getElementById('attrib-tbody');
if(atbody && attribRows) {{
  attribRows.forEach(r => {{
    const bestModel = r.td > r.ft && r.td > r.lt && r.td > r.lin ? 'Time-Decay' :
                      r.lin > r.ft && r.lin > r.lt ? 'Linear' :
                      r.lt > r.ft ? 'Last-Touch' : 'First-Touch';
    atbody.innerHTML += `<tr>
      <td><span class="badge-ch">${{r.channel}}</span></td>
      <td>${{r.ft ? '$'+(r.ft/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.lt ? '$'+(r.lt/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.lin ? '$'+(r.lin/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.td ? '$'+(r.td/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.sourced ? '$'+(r.sourced/1e3).toFixed(0)+'K' : '—'}}</td>
      <td>${{r.influenced ? '$'+(r.influenced/1e3).toFixed(0)+'K' : '—'}}</td>
      <td class="green-text">${{bestModel}}</td>
    </tr>`;
  }});
}}
</script>
</body>
</html>
"""


# ─────────────────────────────────────────────
# Build and write HTML
# ─────────────────────────────────────────────
def build_channel_rows():
    if channel_pipeline.empty:
        return "[]"
    rows = []
    for _, r in channel_pipeline.iterrows():
        rows.append({
            "channel_category": str(r.get("channel_category", "")),
            "deal_count": int(r.get("deal_count", 0)),
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
        channel_rows=build_channel_rows(),
        attrib_rows=build_attrib_rows(),
        **charts,
    )

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = os.path.getsize(OUTPUT_HTML) / 1024
    print(f"  OK Saved -> {OUTPUT_HTML}")
    print(f"  File size: {size_kb:.0f} KB")
    print("\n  Open in any browser — no server required.")


if __name__ == "__main__":
    main()
