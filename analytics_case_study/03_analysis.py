"""
Phase 3: Analysis
Reads integrated Parquet files, computes final metrics, writes Excel reports.
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, ANALYSIS_DIR


def _load_int(name: str) -> pd.DataFrame:
    return pd.read_parquet(os.path.join(INTEGRATED_DATA_DIR, f"{name}.parquet"))


def _load_clean(name: str) -> pd.DataFrame:
    return pd.read_parquet(os.path.join(CLEANED_DATA_DIR, f"{name}.parquet"))


def _write_excel(dfs: dict, filename: str):
    path = os.path.join(ANALYSIS_DIR, filename)
    with pd.ExcelWriter(path, engine="xlsxwriter") as writer:
        for sheet, df in dfs.items():
            df.to_excel(writer, sheet_name=sheet[:31], index=False)
    print(f"  Saved -> {path}")


# ---------------------------------------------------------------------------
# 1. Channel ROI
# ---------------------------------------------------------------------------
def analyze_channel_roi():
    print("\n[1/5] Channel ROI")
    cp = _load_int("channel_pipeline")
    cp = cp.sort_values("total_pipeline", ascending=False)

    summary = cp[[
        "channel_category", "deal_count", "total_pipeline", "won_pipeline",
        "won_count", "win_rate", "avg_deal_size", "pipeline_pct",
        "channel_spend", "pipeline_roi", "revenue_roi", "cost_per_opp",
    ]].copy()
    summary.columns = [
        "Channel", "Deals", "Total Pipeline ($)", "Won Revenue ($)",
        "Won Deals", "Win Rate", "Avg Deal Size ($)", "Pipeline Share",
        "Channel Spend ($)", "Pipeline ROI (x)", "Revenue ROI (x)", "Cost per Opp ($)",
    ]
    summary["Win Rate"] = summary["Win Rate"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")
    summary["Pipeline Share"] = summary["Pipeline Share"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")

    _write_excel({"Channel ROI Summary": summary}, "channel_roi.xlsx")
    return cp


# ---------------------------------------------------------------------------
# 2. Segment Conversion
# ---------------------------------------------------------------------------
def analyze_segment_conversion():
    print("\n[2/5] Segment Conversion")
    master = _load_int("master_account")
    opps = _load_clean("opportunities")

    # Win rate by segment
    if "segment__c" in opps.columns and "_iswon" in opps.columns and "_amount" in opps.columns:
        seg = (opps.groupby("segment__c")
               .agg(
                   deal_count=("_opportunity_id", "count"),
                   won_count=("_iswon", lambda x: (x == True).sum()),
                   total_pipeline=("_amount", "sum"),
                   avg_deal_size=("_amount", "mean"),
               ).reset_index())
        seg["win_rate"] = (seg["won_count"] / seg["deal_count"]).round(4)
        seg.columns = ["Segment", "Deals", "Won Deals", "Pipeline ($)", "Avg Deal ($)", "Win Rate"]
    else:
        seg = pd.DataFrame()

    # Win rate by industry
    if "industry" in master.columns and "total_pipeline" in master.columns:
        ind = (master.dropna(subset=["industry"])
               .groupby("industry")
               .agg(
                   account_count=("accountid", "count") if "accountid" in master.columns else ("industry", "count"),
                   pipeline=("total_pipeline", "sum"),
               ).reset_index()
               .sort_values("pipeline", ascending=False)
               .head(20))
        ind.columns = ["Industry", "Accounts", "Pipeline ($)"]
    else:
        ind = pd.DataFrame()

    # Seniority conversion from ICP
    icp = _load_clean("icp_database")
    if "_seniority" in icp.columns and "_lifecycleStage" in icp.columns:
        sen = (icp.groupby(["_seniority", "_lifecycleStage"])
               .size().reset_index(name="count"))
        sen.columns = ["Seniority", "Lifecycle Stage", "Count"]
    else:
        sen = pd.DataFrame()

    sheets = {}
    if not seg.empty:
        sheets["By Segment"] = seg
    if not ind.empty:
        sheets["By Industry"] = ind
    if not sen.empty:
        sheets["By Seniority"] = sen
    if sheets:
        _write_excel(sheets, "segment_conversion.xlsx")


# ---------------------------------------------------------------------------
# 3. Creative Performance
# ---------------------------------------------------------------------------
def analyze_creative_performance():
    print("\n[3/5] Creative Performance")
    cp = _load_int("creative_performance")
    if cp.empty:
        print("  No creative data — skipping")
        return

    sheets = {}

    # Top ads by CTR
    if "ctr" in cp.columns and "_adname" in cp.columns:
        top_ctr = cp.nlargest(20, "ctr")[["_adname", "_platform", "_impressions", "_clicks", "ctr", "cpc", "_spend"]].copy()
        top_ctr.columns = ["Ad Name", "Platform", "Impressions", "Clicks", "CTR", "CPC ($)", "Spend ($)"]
        sheets["Top 20 by CTR"] = top_ctr

    # Performance by creative attribute
    creative_attrs = ["_copymessaging", "_copyassettype", "_copytone", "_ctacopysofthard", "_designcolor", "_size"]
    for attr in creative_attrs:
        if attr in cp.columns:
            grp = (cp.dropna(subset=[attr])
                   .groupby(attr)
                   .agg(impressions=("_impressions", "sum"),
                        clicks=("_clicks", "sum"),
                        spend=("_spend", "sum"))
                   .reset_index())
            grp["ctr"] = (grp["clicks"] / grp["impressions"].replace(0, np.nan)).round(6)
            grp["cpc"] = (grp["spend"] / grp["clicks"].replace(0, np.nan)).round(2)
            grp = grp.sort_values("ctr", ascending=False)
            grp.columns = [attr.lstrip("_").replace("copy", "").replace("design", "").replace("cta", "CTA ").strip().title(),
                           "Impressions", "Clicks", "Spend ($)", "CTR", "CPC ($)"]
            sheets[f"By {attr.lstrip('_')[:25]}"] = grp

    # Platform comparison
    if "_platform" in cp.columns:
        plat = (cp.groupby("_platform")
                .agg(spend=("_spend", "sum"),
                     impressions=("_impressions", "sum"),
                     clicks=("_clicks", "sum"))
                .reset_index())
        plat["ctr"] = (plat["clicks"] / plat["impressions"].replace(0, np.nan)).round(6)
        plat["cpm"] = ((plat["spend"] / plat["impressions"].replace(0, np.nan)) * 1000).round(2)
        plat.columns = ["Platform", "Spend ($)", "Impressions", "Clicks", "CTR", "CPM ($)"]
        sheets["By Platform"] = plat

    if sheets:
        _write_excel(sheets, "creative_performance.xlsx")


# ---------------------------------------------------------------------------
# 4. Email Campaign Performance
# ---------------------------------------------------------------------------
def analyze_email_performance():
    print("\n[4/5] Email Campaign Performance")
    email = _load_clean("email_engagements")

    if email.empty:
        print("  No email data — skipping")
        return

    sheets = {}

    # By campaign
    if "_campaignID" in email.columns:
        camp_grp = email.groupby("_campaignID").agg(
            total_events=("_campaignID", "count"),
            opens=("is_open", "sum") if "is_open" in email.columns else ("_campaignID", "count"),
            clicks=("is_click", "sum") if "is_click" in email.columns else ("_campaignID", "count"),
            registers=("is_register", "sum") if "is_register" in email.columns else ("_campaignID", "count"),
            subject=("_campaign_subject", "first") if "_campaign_subject" in email.columns else ("_campaignID", "first"),
        ).reset_index()
        camp_grp["open_rate"] = (camp_grp["opens"] / camp_grp["total_events"]).round(4)
        camp_grp["click_rate"] = (camp_grp["clicks"] / camp_grp["total_events"]).round(4)
        camp_grp["register_rate"] = (camp_grp["registers"] / camp_grp["total_events"]).round(4)
        camp_grp["ctor"] = (camp_grp["clicks"] / camp_grp["opens"].replace(0, np.nan)).round(4)
        camp_grp = camp_grp.sort_values("click_rate", ascending=False)
        sheets["By Campaign"] = camp_grp

    # By seniority
    if "_seniority" in email.columns:
        sen_grp = email.groupby("_seniority").agg(
            total=("_seniority", "count"),
            opens=("is_open", "sum") if "is_open" in email.columns else ("_seniority", "count"),
            clicks=("is_click", "sum") if "is_click" in email.columns else ("_seniority", "count"),
        ).reset_index()
        sen_grp["open_rate"] = (sen_grp["opens"] / sen_grp["total"]).round(4)
        sen_grp["click_rate"] = (sen_grp["clicks"] / sen_grp["total"]).round(4)
        sen_grp = sen_grp.sort_values("click_rate", ascending=False)
        sheets["By Seniority"] = sen_grp

    # By industry
    if "_industry" in email.columns:
        ind_grp = email.groupby("_industry").agg(
            total=("_industry", "count"),
            opens=("is_open", "sum") if "is_open" in email.columns else ("_industry", "count"),
            clicks=("is_click", "sum") if "is_click" in email.columns else ("_industry", "count"),
        ).reset_index()
        ind_grp["open_rate"] = (ind_grp["opens"] / ind_grp["total"]).round(4)
        ind_grp["click_rate"] = (ind_grp["clicks"] / ind_grp["total"]).round(4)
        ind_grp = ind_grp.sort_values("click_rate", ascending=False).head(20)
        sheets["By Industry"] = ind_grp

    # By quarter
    if "_quater_segment" in email.columns:
        qtr = email.groupby("_quater_segment").agg(
            total=("_quater_segment", "count"),
            opens=("is_open", "sum") if "is_open" in email.columns else ("_quater_segment", "count"),
            clicks=("is_click", "sum") if "is_click" in email.columns else ("_quater_segment", "count"),
        ).reset_index()
        qtr["open_rate"] = (qtr["opens"] / qtr["total"]).round(4)
        qtr["click_rate"] = (qtr["clicks"] / qtr["total"]).round(4)
        sheets["By Quarter"] = qtr

    if sheets:
        _write_excel(sheets, "email_campaign_performance.xlsx")


# ---------------------------------------------------------------------------
# 5. Budget Recommendation
# ---------------------------------------------------------------------------
def analyze_budget_recommendation():
    print("\n[5/5] Budget Recommendation")
    cp = _load_int("channel_pipeline")

    channels_with_spend = cp[cp["channel_spend"] > 0].copy()
    total_spend = channels_with_spend["channel_spend"].sum()

    if total_spend == 0:
        print("  No spend data found — skipping")
        return

    channels_with_spend["current_spend_pct"] = channels_with_spend["channel_spend"] / total_spend
    channels_with_spend["pipeline_per_dollar"] = (
        channels_with_spend["total_pipeline"] / channels_with_spend["channel_spend"].replace(0, np.nan)
    )

    # Scenario 1: Status Quo
    s1 = channels_with_spend[["channel_category", "channel_spend", "total_pipeline", "pipeline_roi"]].copy()
    s1.columns = ["Channel", "Current Spend ($)", "Pipeline ($)", "Pipeline ROI (x)"]

    # Scenario 2: ROI-optimized (+30% to top 2, -20% from bottom)
    ranked = channels_with_spend.sort_values("pipeline_roi", ascending=False)
    s2_spend = channels_with_spend.set_index("channel_category")["channel_spend"].to_dict()
    top_channels = ranked.head(2)["channel_category"].tolist()
    bot_channels = ranked.tail(2)["channel_category"].tolist()
    for ch in top_channels:
        s2_spend[ch] = s2_spend.get(ch, 0) * 1.30
    for ch in bot_channels:
        s2_spend[ch] = s2_spend.get(ch, 0) * 0.80

    ppl_per_dollar = channels_with_spend.set_index("channel_category")["pipeline_per_dollar"].to_dict()
    s2_rows = []
    for ch, spend in s2_spend.items():
        proj = spend * ppl_per_dollar.get(ch, 0)
        s2_rows.append({"Channel": ch, "Recommended Spend ($)": spend, "Projected Pipeline ($)": proj})
    s2 = pd.DataFrame(s2_rows)

    # Scenario 3: Growth (double email + 6sense, cut low-ROI in half)
    s3_spend = channels_with_spend.set_index("channel_category")["channel_spend"].to_dict()
    for ch in ["email_mqa", "6sense_display"]:
        if ch in s3_spend:
            s3_spend[ch] *= 2.0
    for ch in bot_channels:
        s3_spend[ch] = s3_spend.get(ch, 0) * 0.50
    s3_rows = []
    for ch, spend in s3_spend.items():
        proj = spend * ppl_per_dollar.get(ch, 0)
        s3_rows.append({"Channel": ch, "Aggressive Spend ($)": spend, "Projected Pipeline ($)": proj})
    s3 = pd.DataFrame(s3_rows)

    sheets = {
        "Scenario 1 - Status Quo": s1,
        "Scenario 2 - ROI Optimized": s2,
        "Scenario 3 - Growth Mode": s3,
    }
    _write_excel(sheets, "budget_recommendation.xlsx")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    print("=" * 60)
    print("Phase 3: Analysis")
    print("=" * 60)

    analyze_channel_roi()
    analyze_segment_conversion()
    analyze_creative_performance()
    analyze_email_performance()
    analyze_budget_recommendation()

    print("\nOK Analysis complete ->", ANALYSIS_DIR)


if __name__ == "__main__":
    main()
