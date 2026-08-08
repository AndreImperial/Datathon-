"""
Phase 2: Data Integration
Joins cleaned Parquet files into master analytical tables.
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, CHANNEL_LEADSOURCE_MAP
from analytics_case_study.utils.metrics import resolved_stage_mask


def _load(name: str) -> pd.DataFrame:
    path = os.path.join(CLEANED_DATA_DIR, f"{name}.parquet")
    df = pd.read_parquet(path)
    print(f"  Loaded {name}: {len(df):,} rows")
    return df


# ---------------------------------------------------------------------------
# Helper: aggregate a dataset by domain, return single row per domain
# ---------------------------------------------------------------------------
def _agg_by_domain(df: pd.DataFrame, domain_col: str, aggs: dict) -> pd.DataFrame:
    df2 = df.dropna(subset=[domain_col]).copy()
    return df2.groupby(domain_col).agg(aggs).reset_index()


# ---------------------------------------------------------------------------
# 1. master_account.parquet
# ---------------------------------------------------------------------------
def build_master_account(accounts, segments, campaign6s, email, web, opps, icp) -> pd.DataFrame:
    print("\n  Building master_account ...")
    base = accounts.copy()
    domain_col = "domain__c"

    # --- 6sense segments ---
    seg_agg = (segments.dropna(subset=["_6sensedomain"])
               .groupby("_6sensedomain")
               .agg(
                   segment_list=("_segment", lambda x: list(x.dropna().unique())),
                   segment_category=("segment_category", "first"),
                   emp_range=("_6senseemployeerange", "first"),
                   rev_range=("_6senserevenuerange", "first"),
               ).reset_index()
               .rename(columns={"_6sensedomain": domain_col}))
    base = base.merge(seg_agg, on=domain_col, how="left")

    # --- 6sense campaign aggregated by domain ---
    if "_6sensedomain" in campaign6s.columns:
        c_agg = (campaign6s.dropna(subset=["_6sensedomain"])
                 .groupby("_6sensedomain")
                 .agg(
                     campaign_spend=("_spend", "sum"),
                     campaign_clicks=("_clicks", "sum"),
                     campaign_impressions=("_impressions", "sum"),
                     campaign_form_fills=("_influencedformfills", "sum"),
                 ).reset_index()
                 .rename(columns={"_6sensedomain": domain_col}))
        base = base.merge(c_agg, on=domain_col, how="left")

    # --- Email aggregated by domain ---
    if "_domain" in email.columns:
        e_agg = (email.dropna(subset=["_domain"])
                 .groupby("_domain")
                 .agg(
                     email_opens=("is_open", "sum"),
                     email_clicks=("is_click", "sum"),
                     email_registers=("is_register", "sum"),
                     unique_email_campaigns=("_campaignID", pd.Series.nunique),
                 ).reset_index()
                 .rename(columns={"_domain": domain_col}))
        base = base.merge(e_agg, on=domain_col, how="left")

    # --- Web aggregated by domain (low coverage -- noted) ---
    if "_domain" in web.columns:
        web2 = web.dropna(subset=["_domain"]).copy()
        if "is_goal_completed" in web2.columns:
            web2["_goal_int"] = web2["is_goal_completed"].map(
                {True: 1, False: 0, 1: 1, 0: 0}
            ).fillna(0).astype(int)
        else:
            web2["_goal_int"] = 0
        if "_totalsessionviews" not in web2.columns:
            web2["_totalsessionviews"] = 0
        web2["_totalsessionviews"] = pd.to_numeric(web2["_totalsessionviews"], errors="coerce").fillna(0)
        w_agg = (web2.groupby("_domain")
                 .agg(web_sessions=("_domain", "count"),
                      web_pageviews=("_totalsessionviews", "sum"),
                      web_goal_completions=("_goal_int", "sum"))
                 .reset_index()
                 .rename(columns={"_domain": domain_col}))
        base = base.merge(w_agg, on=domain_col, how="left")

    # --- Opportunities by account ---
    opp_by_acct = None
    if "accountid" in accounts.columns and "_account_id" in opps.columns:
        iswon_col = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)
        if iswon_col:
            opps["won_amount"] = np.where(opps[iswon_col] == True, opps["_amount"], 0)
        else:
            opps["won_amount"] = 0

        opp_agg = (opps.groupby("_account_id")
                   .agg(
                       total_pipeline=("_amount", "sum"),
                       total_won=("won_amount", "sum"),
                       deal_count=("_opportunity_id", "count"),
                       primary_leadsource=("_leadsource", "first"),
                       channel_category=("channel_category", "first"),
                       is_marketing_sourced=("is_marketing_sourced", "any"),
                   ).reset_index()
                   .rename(columns={"_account_id": "accountid"}))
        base = base.merge(opp_agg, on="accountid", how="left")

    # --- ICP contacts by account ---
    icp_col = None
    for c in ["_sfdcaccountid", "_accountid", "accountid"]:
        if c in icp.columns:
            icp_col = c
            break
    if icp_col:
        def seniority_count(g, level):
            return (g["_seniority"].str.lower() == level.lower()).sum()

        icp_agg = icp.dropna(subset=[icp_col]).groupby(icp_col).agg(
            contact_count=(icp_col, "count"),
            c_level_contacts=("_seniority", lambda x: (x.str.lower() == "c-level").sum()),
            vp_contacts=("_seniority", lambda x: (x.str.lower() == "vp").sum()),
            director_contacts=("_seniority", lambda x: (x.str.lower() == "director").sum()),
            manager_contacts=("_seniority", lambda x: (x.str.lower() == "manager").sum()),
        ).reset_index().rename(columns={icp_col: "accountid"})
        base = base.merge(icp_agg, on="accountid", how="left")

    print(f"  master_account: {len(base):,} rows, {len(base.columns)} columns")
    return base


# ---------------------------------------------------------------------------
# 2. channel_pipeline.parquet
# ---------------------------------------------------------------------------
def build_channel_pipeline(opps: pd.DataFrame, campaign6s: pd.DataFrame, ad_metrics: pd.DataFrame) -> pd.DataFrame:
    print("\n  Building channel_pipeline ...")

    iswon_col = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)
    if iswon_col is None:
        opps = opps.copy()
        opps["iswon"] = False
        iswon_col = "iswon"

    opps = opps.copy()
    stage_col = next((c for c in opps.columns if "current_stage" in c.lower()), None)
    opps["_is_resolved"] = resolved_stage_mask(opps[stage_col]) if stage_col else True
    opps["_is_zero_amount"] = opps["_amount"].fillna(0).eq(0)

    result = (opps.groupby("channel_category")
              .agg(
                  deal_count=("_opportunity_id", "count"),
                  resolved_count=("_is_resolved", "sum"),
                  total_pipeline=("_amount", "sum"),
                  avg_deal_size=("_amount", "mean"),
                  zero_amount_deals=("_is_zero_amount", "sum"),
              ).reset_index())

    won = (opps[opps[iswon_col] == True]
           .groupby("channel_category")
           .agg(
               won_count=("_opportunity_id", "count"),
               won_pipeline=("_amount", "sum"),
           ).reset_index())
    result = result.merge(won, on="channel_category", how="left")
    result["won_count"] = result["won_count"].fillna(0).astype(int)
    result["won_pipeline"] = result["won_pipeline"].fillna(0)
    result["win_rate"] = (result["won_count"] / result["resolved_count"].replace(0, np.nan)).round(4)
    result["resolved_share"] = (result["resolved_count"] / result["deal_count"].replace(0, np.nan)).round(4)
    result["pipeline_pct"] = (result["total_pipeline"] / result["total_pipeline"].sum()).round(4)

    # Ad spend per channel
    ad_spend_6sense = 0.0
    ad_spend_linkedin = 0.0
    if "_spend" in ad_metrics.columns and "_platform" in ad_metrics.columns:
        spend_by_platform = ad_metrics.groupby("_platform")["_spend"].sum()
        ad_spend_6sense = spend_by_platform.get("6sense", 0)
        ad_spend_linkedin = spend_by_platform.get("LinkedIn", 0)

    spend_map = {
        "6sense_display": ad_spend_6sense,
        "linkedin": ad_spend_linkedin,
    }
    result["channel_spend"] = result["channel_category"].map(spend_map).fillna(0)
    result["pipeline_roi"] = np.where(
        result["channel_spend"] > 0,
        result["total_pipeline"] / result["channel_spend"],
        np.nan,
    ).round(2)
    result["revenue_roi"] = np.where(
        result["channel_spend"] > 0,
        result["won_pipeline"] / result["channel_spend"],
        np.nan,
    ).round(2)
    result["cost_per_opp"] = np.where(
        result["deal_count"] > 0,
        result["channel_spend"] / result["deal_count"],
        np.nan,
    ).round(2)

    return result


# ---------------------------------------------------------------------------
# 3. funnel_metrics.parquet
# ---------------------------------------------------------------------------
def build_funnel_metrics(campaign6s: pd.DataFrame, ad_metrics: pd.DataFrame,
                         email: pd.DataFrame, opps: pd.DataFrame, web: pd.DataFrame = None) -> pd.DataFrame:
    print("\n  Building funnel_metrics ...")
    rows = []
    iswon_col = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)

    def add_funnel(channel, stages):
        prev = np.nan
        for stage, count in stages:
            count = int(count) if pd.notna(count) else 0
            rows.append({
                "channel": channel,
                "stage": stage,
                "count": count,
                "conversion_from_prev": count / prev if pd.notna(prev) and prev else np.nan,
            })
            prev = count

    campaign_impressions = campaign6s["_impressions"].sum() if "_impressions" in campaign6s.columns else 0
    campaign_clicks = campaign6s["_clicks"].sum() if "_clicks" in campaign6s.columns else 0
    campaign_form_fills = campaign6s["_influencedformfills"].sum() if "_influencedformfills" in campaign6s.columns else 0
    add_funnel("6sense Display", [
        ("Impressions", campaign_impressions),
        ("Clicks", campaign_clicks),
        ("Influenced Form Fills", campaign_form_fills),
    ])

    ad_impressions = ad_metrics["_impressions"].sum() if "_impressions" in ad_metrics.columns else 0
    ad_clicks = ad_metrics["_clicks"].sum() if "_clicks" in ad_metrics.columns else 0
    add_funnel("Paid Ads", [
        ("Impressions", ad_impressions),
        ("Clicks", ad_clicks),
    ])

    email_engagements = len(email)
    email_opens = email["is_open"].sum() if "is_open" in email.columns else 0
    email_clicks = email["is_click"].sum() if "is_click" in email.columns else 0
    email_registers = email["is_register"].sum() if "is_register" in email.columns else 0
    add_funnel("Email Event Mix", [
        ("Opens", email_opens),
        ("Clicks", email_clicks),
        ("Registrations", email_registers),
    ])

    # The email extract is an engagement-event log, not a send/delivery table.
    # Store the event denominator explicitly and never describe these shares as
    # standard email open or click rates.
    for row in rows:
        if row["channel"] == "Email Event Mix":
            row["event_share"] = row["count"] / email_engagements if email_engagements else np.nan
            row["metric_type"] = "event_composition"
            row["conversion_from_prev"] = np.nan

    if web is not None and not web.empty:
        web_sessions = len(web)
        web_goals = web["is_goal_completed"].sum() if "is_goal_completed" in web.columns else 0
        add_funnel("Web", [
            ("Sessions", web_sessions),
            ("Goal Completions", web_goals),
        ])

    total_opps = len(opps)
    marketing_opps = opps["is_marketing_sourced"].sum() if "is_marketing_sourced" in opps.columns else 0
    won_opps = (opps[iswon_col] == True).sum() if iswon_col else 0
    marketing_won = opps[(opps["is_marketing_sourced"] == True) & (opps[iswon_col] == True)].shape[0] if iswon_col and "is_marketing_sourced" in opps.columns else 0
    add_funnel("All Opportunity Outcomes", [
        ("All Opportunities", total_opps),
        ("Closed Won (All)", won_opps),
    ])
    add_funnel("Marketing-Sourced Outcomes", [
        ("Marketing-Sourced Opps", marketing_opps),
        ("Marketing-Sourced Won", marketing_won),
    ])

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 4. creative_performance.parquet
# ---------------------------------------------------------------------------
def build_creative_performance(ad_metrics: pd.DataFrame) -> pd.DataFrame:
    print("\n  Building creative_performance ...")
    # Only include columns that actually have data (not entirely null)
    candidate_cols = [
        "_adname", "_platform", "_size", "_stage",
        "_copymessaging", "_copyassettype", "_copytone",
        "_ctacopysofthard", "_designcolor", "_campaignid",
    ]
    group_cols = [c for c in candidate_cols
                  if c in ad_metrics.columns and ad_metrics[c].notna().any()]

    if not group_cols:
        return pd.DataFrame()

    agg = {
        "_spend": "sum",
        "_clicks": "sum",
        "_impressions": "sum",
    }
    if "pageviews" in ad_metrics.columns:
        agg["pageviews"] = "sum"

    # Fill NaN in group cols with 'Unknown' so rows aren't dropped
    df = ad_metrics.copy()
    for c in group_cols:
        df[c] = df[c].fillna("Unknown")

    result = df.groupby(group_cols).agg(agg).reset_index()
    result["ctr"] = (result["_clicks"] / result["_impressions"].replace(0, np.nan)).round(6)
    result["cpm"] = ((result["_spend"] / result["_impressions"].replace(0, np.nan)) * 1000).round(4)
    result["cpc"] = (result["_spend"] / result["_clicks"].replace(0, np.nan)).round(4)
    if "pageviews" in result.columns:
        result["landing_cvr"] = (result["pageviews"] / result["_clicks"].replace(0, np.nan)).round(4)
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(INTEGRATED_DATA_DIR, exist_ok=True)
    print("=" * 60)
    print("Phase 2: Data Integration")
    print("=" * 60)

    accounts = _load("accounts")
    segments = _load("6sense_segments")
    campaign6s = _load("6sense_campaign")
    email = _load("email_engagements")
    web = _load("web_engagements")
    opps = _load("opportunities")
    icp = _load("icp_database")
    ad_metrics = _load("ad_metrics")

    master = build_master_account(accounts, segments, campaign6s, email, web, opps, icp)
    master.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "master_account.parquet"), index=False)
    print(f"  Saved master_account -> {INTEGRATED_DATA_DIR}")

    channel_pipeline = build_channel_pipeline(opps, campaign6s, ad_metrics)
    channel_pipeline.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "channel_pipeline.parquet"), index=False)
    print(f"  Saved channel_pipeline -> {INTEGRATED_DATA_DIR}")

    funnel = build_funnel_metrics(campaign6s, ad_metrics, email, opps, web)
    funnel.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "funnel_metrics.parquet"), index=False)
    print(f"  Saved funnel_metrics -> {INTEGRATED_DATA_DIR}")

    creative = build_creative_performance(ad_metrics)
    creative.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "creative_performance.parquet"), index=False)
    print(f"  Saved creative_performance -> {INTEGRATED_DATA_DIR}")

    print("\nOK Integration complete ->", INTEGRATED_DATA_DIR)


if __name__ == "__main__":
    main()
