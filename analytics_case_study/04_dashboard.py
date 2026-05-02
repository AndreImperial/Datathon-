"""
Phase 4: Interactive Dashboard
Run: python analytics_case_study/04_dashboard.py
Open: http://localhost:8050
"""
import os
import sys
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

import dash
from dash import dcc, html, dash_table
import dash_bootstrap_components as dbc

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, ANALYSIS_DIR, BRAND_COLORS, CHANNEL_COLOR_MAP
)


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------
def _load_int(name):
    p = os.path.join(INTEGRATED_DATA_DIR, f"{name}.parquet")
    return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()


def _load_clean(name):
    p = os.path.join(CLEANED_DATA_DIR, f"{name}.parquet")
    return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()


channel_pipeline = _load_int("channel_pipeline")
funnel_metrics = _load_int("funnel_metrics")
creative_perf = _load_int("creative_performance")
master_account = _load_int("master_account")
email = _load_clean("email_engagements")
opps = _load_clean("opportunities")
ad_metrics = _load_clean("ad_metrics")


# ---------------------------------------------------------------------------
# Chart helpers
# ---------------------------------------------------------------------------
LAYOUT = dict(
    font=dict(family="Arial, sans-serif", size=12),
    plot_bgcolor="white", paper_bgcolor="white",
    margin=dict(l=40, r=20, t=40, b=40),
)


def fmt_usd(v):
    if pd.isna(v) or v == 0:
        return "$0"
    if v >= 1_000_000:
        return f"${v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v/1_000:.0f}K"
    return f"${v:.0f}"


def kpi_card(title, value, color="#1F77B4"):
    return dbc.Card(
        dbc.CardBody([
            html.P(title, className="card-title text-muted", style={"fontSize": "12px", "marginBottom": "4px"}),
            html.H4(value, style={"color": color, "fontWeight": "bold"}),
        ]),
        style={"borderLeft": f"4px solid {color}", "borderRadius": "6px"},
        className="mb-2 shadow-sm",
    )


# ---------------------------------------------------------------------------
# Tab 1: Executive Summary
# ---------------------------------------------------------------------------
total_pipeline = opps["_amount"].sum() if "_amount" in opps.columns else 0
won_pipeline = opps.loc[opps["_iswon"] == True, "_amount"].sum() if "_iswon" in opps.columns and "_amount" in opps.columns else 0
mktg_pipeline = opps.loc[opps["is_marketing_sourced"] == True, "_amount"].sum() if "is_marketing_sourced" in opps.columns and "_amount" in opps.columns else 0
mktg_pct = mktg_pipeline / total_pipeline if total_pipeline > 0 else 0

# Pipeline by channel bar
if not channel_pipeline.empty:
    cp_sorted = channel_pipeline.sort_values("total_pipeline", ascending=True).tail(10)
    bar_channel = go.Figure(go.Bar(
        y=cp_sorted["channel_category"],
        x=cp_sorted["total_pipeline"],
        orientation="h",
        marker_color=[CHANNEL_COLOR_MAP.get(c, BRAND_COLORS[0]) for c in cp_sorted["channel_category"]],
        text=[fmt_usd(v) for v in cp_sorted["total_pipeline"]],
        textposition="outside",
    ))
    bar_channel.update_layout(title="Pipeline by Channel", xaxis_title="Pipeline ($)", **LAYOUT)

    donut_won = go.Figure(go.Pie(
        labels=channel_pipeline["channel_category"],
        values=channel_pipeline["won_pipeline"],
        hole=0.45,
        marker_colors=BRAND_COLORS,
    ))
    donut_won.update_layout(title="Won Revenue by Channel", **LAYOUT)
else:
    bar_channel = go.Figure()
    donut_won = go.Figure()

# Monthly pipeline trend
if "_amount" in opps.columns and "channel_category" in opps.columns:
    opp_date_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    if opp_date_col:
        opps_t = opps.dropna(subset=[opp_date_col]).copy()
        opps_t["month"] = pd.to_datetime(opps_t[opp_date_col], errors="coerce").dt.to_period("M").astype(str)
        monthly = opps_t.groupby(["month", "channel_category"])["_amount"].sum().reset_index()
        line_monthly = px.line(monthly, x="month", y="_amount", color="channel_category",
                               title="Pipeline Created by Month",
                               color_discrete_sequence=BRAND_COLORS)
        line_monthly.update_layout(**LAYOUT)
    else:
        line_monthly = go.Figure()
else:
    line_monthly = go.Figure()

tab1_content = dbc.Container([
    dbc.Row([
        dbc.Col(kpi_card("Total Pipeline", fmt_usd(total_pipeline), "#1F77B4"), width=3),
        dbc.Col(kpi_card("Won Revenue", fmt_usd(won_pipeline), "#2CA02C"), width=3),
        dbc.Col(kpi_card("Marketing-Attributed Pipeline", fmt_usd(mktg_pipeline), "#FF7F0E"), width=3),
        dbc.Col(kpi_card("Marketing Pipeline %", f"{mktg_pct:.1%}", "#9467BD"), width=3),
    ], className="mb-3"),
    dbc.Row([
        dbc.Col(dcc.Graph(figure=bar_channel), width=7),
        dbc.Col(dcc.Graph(figure=donut_won), width=5),
    ]),
    dbc.Row([
        dbc.Col(dcc.Graph(figure=line_monthly), width=12),
    ]),
], fluid=True)


# ---------------------------------------------------------------------------
# Tab 2: Channel Performance
# ---------------------------------------------------------------------------
if not channel_pipeline.empty and not funnel_metrics.empty:
    scatter_spend_pipeline = px.scatter(
        channel_pipeline[channel_pipeline["channel_spend"] > 0],
        x="channel_spend", y="total_pipeline",
        size="win_rate", color="channel_category",
        text="channel_category",
        title="Spend vs Pipeline by Channel",
        color_discrete_sequence=BRAND_COLORS,
    )
    scatter_spend_pipeline.update_traces(textposition="top center")
    scatter_spend_pipeline.update_layout(xaxis_title="Spend ($)", yaxis_title="Pipeline ($)", **LAYOUT)

    funnel_all = funnel_metrics[funnel_metrics["channel"] == "All Channels"]
    funnel_fig = go.Figure(go.Funnel(
        y=funnel_all["stage"].tolist(),
        x=funnel_all["count"].tolist(),
        textinfo="value+percent initial",
        marker_color=BRAND_COLORS[:len(funnel_all)],
    ))
    funnel_fig.update_layout(title="Marketing Funnel", **LAYOUT)

    tbl_cp = channel_pipeline[["channel_category", "deal_count", "total_pipeline",
                                "won_pipeline", "win_rate", "avg_deal_size",
                                "channel_spend", "pipeline_roi", "revenue_roi"]].copy()
    tbl_cp.columns = ["Channel", "Deals", "Pipeline ($)", "Won ($)",
                      "Win Rate", "Avg Deal ($)", "Spend ($)", "Pipeline ROI", "Revenue ROI"]
    for c in ["Pipeline ($)", "Won ($)", "Avg Deal ($)", "Spend ($)"]:
        tbl_cp[c] = tbl_cp[c].apply(lambda v: f"${v:,.0f}" if pd.notna(v) else "")
    tbl_cp["Win Rate"] = tbl_cp["Win Rate"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")
    tbl_cp["Pipeline ROI"] = tbl_cp["Pipeline ROI"].apply(lambda v: f"{v:.1f}x" if pd.notna(v) else "")
    tbl_cp["Revenue ROI"] = tbl_cp["Revenue ROI"].apply(lambda v: f"{v:.1f}x" if pd.notna(v) else "")
else:
    scatter_spend_pipeline = go.Figure()
    funnel_fig = go.Figure()
    tbl_cp = pd.DataFrame()

tab2_content = dbc.Container([
    dbc.Row([
        dbc.Col(dcc.Graph(figure=scatter_spend_pipeline), width=7),
        dbc.Col(dcc.Graph(figure=funnel_fig), width=5),
    ]),
    dbc.Row([
        dbc.Col(
            dash_table.DataTable(
                data=tbl_cp.to_dict("records") if not tbl_cp.empty else [],
                columns=[{"name": c, "id": c} for c in tbl_cp.columns] if not tbl_cp.empty else [],
                style_table={"overflowX": "auto"},
                style_cell={"textAlign": "left", "fontSize": "12px", "padding": "6px"},
                style_header={"backgroundColor": "#1F77B4", "color": "white", "fontWeight": "bold"},
                style_data_conditional=[{"if": {"row_index": "odd"}, "backgroundColor": "#f9f9f9"}],
            ), width=12
        ),
    ], className="mt-3"),
], fluid=True)


# ---------------------------------------------------------------------------
# Tab 3: Segment Analysis
# ---------------------------------------------------------------------------
if "segment__c" in opps.columns and "_amount" in opps.columns and "_iswon" in opps.columns:
    seg_agg = (opps.dropna(subset=["segment__c"])
               .groupby("segment__c")
               .agg(
                   deals=("_opportunity_id", "count"),
                   pipeline=("_amount", "sum"),
                   won=("_iswon", lambda x: (x == True).sum()),
                   avg_deal=("_amount", "mean"),
               ).reset_index())
    seg_agg["win_rate"] = seg_agg["won"] / seg_agg["deals"]

    bar_seg = px.bar(seg_agg, x="segment__c", y="avg_deal",
                     title="Avg Deal Size by Segment",
                     color="segment__c", color_discrete_sequence=BRAND_COLORS)
    bar_seg.update_layout(**LAYOUT)

    bar_seg_wr = px.bar(seg_agg, x="segment__c", y="win_rate",
                        title="Win Rate by Segment",
                        color="segment__c", color_discrete_sequence=BRAND_COLORS)
    bar_seg_wr.update_layout(yaxis_tickformat=".0%", **LAYOUT)
else:
    bar_seg = go.Figure()
    bar_seg_wr = go.Figure()

# Seniority from ICP
icp = _load_clean("icp_database")
if "_seniority" in icp.columns and "_lifecycleStage" in icp.columns:
    sen_counts = icp.groupby("_seniority").size().reset_index(name="count")
    bar_sen = px.bar(sen_counts, x="_seniority", y="count",
                     title="ICP Contacts by Seniority",
                     color="_seniority", color_discrete_sequence=BRAND_COLORS)
    bar_sen.update_layout(**LAYOUT)
else:
    bar_sen = go.Figure()

# Industry treemap from master account
if "industry" in master_account.columns and "total_pipeline" in master_account.columns:
    ind_data = (master_account.dropna(subset=["industry", "total_pipeline"])
                .groupby("industry")["total_pipeline"].sum().reset_index()
                .sort_values("total_pipeline", ascending=False).head(15))
    treemap = px.treemap(ind_data, path=["industry"], values="total_pipeline",
                         title="Pipeline by Industry",
                         color_discrete_sequence=BRAND_COLORS)
    treemap.update_layout(**LAYOUT)
else:
    treemap = go.Figure()

tab3_content = dbc.Container([
    dbc.Row([
        dbc.Col(dcc.Graph(figure=bar_seg), width=6),
        dbc.Col(dcc.Graph(figure=bar_seg_wr), width=6),
    ]),
    dbc.Row([
        dbc.Col(dcc.Graph(figure=treemap), width=7),
        dbc.Col(dcc.Graph(figure=bar_sen), width=5),
    ]),
], fluid=True)


# ---------------------------------------------------------------------------
# Tab 4: Creative & Email
# ---------------------------------------------------------------------------
# Top ads by CTR
if not creative_perf.empty and "ctr" in creative_perf.columns and "_adname" in creative_perf.columns:
    top_ads = creative_perf.nlargest(15, "ctr")
    bar_ads_ctr = px.bar(top_ads, x="ctr", y="_adname", orientation="h",
                         title="Top 15 Ads by CTR",
                         color_discrete_sequence=BRAND_COLORS)
    bar_ads_ctr.update_layout(**LAYOUT)
else:
    bar_ads_ctr = go.Figure()

# Creative attribute performance
if not creative_perf.empty and "_copytone" in creative_perf.columns:
    tone_grp = (creative_perf.dropna(subset=["_copytone"])
                .groupby("_copytone")
                .agg(clicks=("_clicks", "sum"), impressions=("_impressions", "sum"))
                .reset_index())
    tone_grp["ctr"] = tone_grp["clicks"] / tone_grp["impressions"].replace(0, np.nan)
    bar_tone = px.bar(tone_grp, x="_copytone", y="ctr",
                      title="CTR by Ad Tone",
                      color_discrete_sequence=BRAND_COLORS)
    bar_tone.update_layout(yaxis_tickformat=".2%", **LAYOUT)
else:
    bar_tone = go.Figure()

# Email by seniority
if not email.empty and "_seniority" in email.columns:
    sen_email = email.groupby("_seniority").agg(
        total=("_seniority", "count"),
        clicks=("is_click", "sum") if "is_click" in email.columns else ("_seniority", "count"),
    ).reset_index()
    sen_email["click_rate"] = sen_email["clicks"] / sen_email["total"]
    bar_email_sen = px.bar(sen_email, x="_seniority", y="click_rate",
                           title="Email Click Rate by Seniority",
                           color="_seniority", color_discrete_sequence=BRAND_COLORS)
    bar_email_sen.update_layout(yaxis_tickformat=".1%", **LAYOUT)
else:
    bar_email_sen = go.Figure()

# Email quarterly trend
if not email.empty and "_quater_segment" in email.columns:
    qtr = email.groupby("_quater_segment").agg(
        total=("_quater_segment", "count"),
        clicks=("is_click", "sum") if "is_click" in email.columns else ("_quater_segment", "count"),
    ).reset_index()
    qtr["click_rate"] = qtr["clicks"] / qtr["total"]
    line_qtr = px.line(qtr, x="_quater_segment", y="click_rate",
                       title="Email Click Rate by Quarter",
                       color_discrete_sequence=BRAND_COLORS)
    line_qtr.update_layout(yaxis_tickformat=".1%", **LAYOUT)
else:
    line_qtr = go.Figure()

tab4_content = dbc.Container([
    dbc.Row([
        dbc.Col(dcc.Graph(figure=bar_ads_ctr), width=7),
        dbc.Col(dcc.Graph(figure=bar_tone), width=5),
    ]),
    dbc.Row([
        dbc.Col(dcc.Graph(figure=bar_email_sen), width=6),
        dbc.Col(dcc.Graph(figure=line_qtr), width=6),
    ]),
], fluid=True)


# ---------------------------------------------------------------------------
# Tab 5: Budget Recommendation
# ---------------------------------------------------------------------------
if not channel_pipeline.empty:
    spend_data = channel_pipeline[channel_pipeline["channel_spend"] > 0]
    pie_current = go.Figure(go.Pie(
        labels=spend_data["channel_category"],
        values=spend_data["channel_spend"],
        hole=0.4,
        title="Current Spend Allocation",
        marker_colors=BRAND_COLORS,
    ))
    pie_current.update_layout(**LAYOUT)

    # Recommended: shift to highest ROI channels
    ranked_roi = spend_data.sort_values("pipeline_roi", ascending=False).copy()
    total_spend = ranked_roi["channel_spend"].sum()
    top2 = ranked_roi.head(2)["channel_category"].tolist()
    rec_spend = ranked_roi.set_index("channel_category")["channel_spend"].to_dict()
    for ch in top2:
        rec_spend[ch] = rec_spend[ch] * 1.30
    for ch in ranked_roi.tail(2)["channel_category"].tolist():
        rec_spend[ch] = rec_spend.get(ch, 0) * 0.80

    rec_df = pd.DataFrame(list(rec_spend.items()), columns=["channel", "spend"])
    pie_rec = go.Figure(go.Pie(
        labels=rec_df["channel"],
        values=rec_df["spend"],
        hole=0.4,
        title="Recommended Spend Allocation",
        marker_colors=BRAND_COLORS,
    ))
    pie_rec.update_layout(**LAYOUT)

    # Table with scenario comparison
    scenario_rows = []
    ppl_per_dollar = spend_data.set_index("channel_category").apply(
        lambda r: r["total_pipeline"] / r["channel_spend"] if r["channel_spend"] > 0 else 0, axis=1
    ).to_dict()
    for ch, curr in spend_data.set_index("channel_category")["channel_spend"].items():
        rec = rec_spend.get(ch, curr)
        proj = rec * ppl_per_dollar.get(ch, 0)
        curr_proj = curr * ppl_per_dollar.get(ch, 0)
        scenario_rows.append({
            "Channel": ch,
            "Current Spend": fmt_usd(curr),
            "Recommended Spend": fmt_usd(rec),
            "Change": f"{(rec-curr)/curr:+.0%}" if curr > 0 else "—",
            "Projected Pipeline": fmt_usd(proj),
            "Current Pipeline": fmt_usd(curr_proj),
        })
    scenario_df = pd.DataFrame(scenario_rows)
else:
    pie_current = go.Figure()
    pie_rec = go.Figure()
    scenario_df = pd.DataFrame()

tab5_content = dbc.Container([
    dbc.Row([
        dbc.Col(dcc.Graph(figure=pie_current), width=5),
        dbc.Col(dcc.Graph(figure=pie_rec), width=5),
    ]),
    dbc.Row([
        dbc.Col(
            dash_table.DataTable(
                data=scenario_df.to_dict("records") if not scenario_df.empty else [],
                columns=[{"name": c, "id": c} for c in scenario_df.columns] if not scenario_df.empty else [],
                style_table={"overflowX": "auto"},
                style_cell={"textAlign": "left", "fontSize": "12px", "padding": "6px"},
                style_header={"backgroundColor": "#1F77B4", "color": "white", "fontWeight": "bold"},
                style_data_conditional=[
                    {"if": {"row_index": "odd"}, "backgroundColor": "#f9f9f9"},
                    {"if": {"filter_query": '{Change} contains "+"', "column_id": "Change"},
                     "color": "green", "fontWeight": "bold"},
                ],
            ), width=12
        ),
    ], className="mt-3"),
], fluid=True)


# ---------------------------------------------------------------------------
# App Layout
# ---------------------------------------------------------------------------
app = dash.Dash(__name__, external_stylesheets=[dbc.themes.FLATLY])
app.title = "Marketing Analytics Dashboard"

app.layout = dbc.Container([
    dbc.Row(
        dbc.Col(html.H2("Marketing Analytics Dashboard",
                        style={"color": "#1F77B4", "fontWeight": "bold", "padding": "20px 0 10px"}))
    ),
    dbc.Tabs([
        dbc.Tab(tab1_content, label="Executive Summary", tab_id="tab-1"),
        dbc.Tab(tab2_content, label="Channel Performance", tab_id="tab-2"),
        dbc.Tab(tab3_content, label="Segment Analysis", tab_id="tab-3"),
        dbc.Tab(tab4_content, label="Creative & Email", tab_id="tab-4"),
        dbc.Tab(tab5_content, label="Budget Recommendation", tab_id="tab-5"),
    ], id="tabs", active_tab="tab-1"),
], fluid=True)


if __name__ == "__main__":
    print("Dashboard running at http://localhost:8050")
    app.run(debug=False, port=8050)
