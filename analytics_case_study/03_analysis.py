"""
Phase 3: Analysis
Reads integrated Parquet files, computes final metrics, writes Excel reports.
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import INTEGRATED_DATA_DIR, CLEANED_DATA_DIR, ANALYSIS_DIR, RAW_FILES
from analytics_case_study.utils.metrics import resolved_stage_mask


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


def _won_col(df: pd.DataFrame):
    if "iswon" in df.columns:
        return "iswon"
    if "_iswon" in df.columns:
        return "_iswon"
    return None


# ---------------------------------------------------------------------------
# 1. Channel ROI
# ---------------------------------------------------------------------------
def analyze_channel_roi():
    print("\n[1/6] Channel ROI")
    cp = _load_int("channel_pipeline")
    cp = cp.sort_values("total_pipeline", ascending=False)

    summary = cp[[
        "channel_category", "deal_count", "resolved_count", "total_pipeline", "won_pipeline",
        "won_count", "win_rate", "resolved_share", "avg_deal_size", "pipeline_pct",
        "channel_spend", "pipeline_roi", "revenue_roi", "cost_per_opp",
    ]].copy()
    summary.columns = [
        "Channel", "Deals", "Resolved Deals", "Total Pipeline ($)", "Won Revenue ($)",
        "Won Deals", "Closed-Deal Win Rate", "Resolved Share", "Avg Deal Size ($)", "Pipeline Share",
        "Channel Spend ($)", "Pipeline ROI (x)", "Revenue ROI (x)", "Cost per Opp ($)",
    ]
    summary["Closed-Deal Win Rate"] = summary["Closed-Deal Win Rate"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")
    summary["Resolved Share"] = summary["Resolved Share"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")
    summary["Pipeline Share"] = summary["Pipeline Share"].apply(lambda v: f"{v:.1%}" if pd.notna(v) else "")

    _write_excel({"Channel ROI Summary": summary}, "channel_roi.xlsx")
    return cp


# ---------------------------------------------------------------------------
# 2. Segment Conversion
# ---------------------------------------------------------------------------
def analyze_segment_conversion():
    print("\n[2/6] Segment Conversion")
    master = _load_int("master_account")
    opps = _load_clean("opportunities")

    # Win rate by segment
    won_col = _won_col(opps)
    if "segment__c" in opps.columns and won_col and "_amount" in opps.columns:
        stage_col = next((c for c in opps.columns if "current_stage" in c.lower()), None)
        resolved = opps[resolved_stage_mask(opps[stage_col])].copy() if stage_col else opps.copy()
        seg = (resolved.groupby("segment__c")
               .agg(
                   deal_count=("_opportunity_id", "count"),
                   won_count=(won_col, lambda x: (x == True).sum()),
                   total_pipeline=("_amount", "sum"),
                   avg_deal_size=("_amount", "mean"),
               ).reset_index())
        seg["win_rate"] = (seg["won_count"] / seg["deal_count"]).round(4)
        seg.columns = ["Segment", "Resolved Deals", "Won Deals", "Resolved Pipeline ($)", "Avg Deal ($)", "Closed-Deal Win Rate"]
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
    print("\n[3/6] Creative Performance")
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
    print("\n[4/6] Email Campaign Performance")
    email = _load_clean("email_engagements")

    if email.empty:
        print("  No email data — skipping")
        return

    sheets = {}
    person_col = "_prospectID" if "_prospectID" in email.columns else "_email"

    def summarize(group_col, include_subject=False):
        source = email.copy()
        source[group_col] = source[group_col].fillna("Unknown").astype(str)
        agg = {
            "engagement_events": (group_col, "count"),
            "engaged_people": (person_col, "nunique"),
            "open_events": ("is_open", "sum"),
            "click_events": ("is_click", "sum"),
            "registration_events": ("is_register", "sum"),
        }
        if "days_to_engage" in source.columns:
            agg["median_days_to_engage"] = ("days_to_engage", "median")
        if include_subject and "_campaign_subject" in source.columns:
            agg["subject"] = ("_campaign_subject", "first")
        result = source.groupby(group_col).agg(**agg).reset_index()
        denominator = result["engagement_events"].replace(0, np.nan)
        result["open_event_share"] = (result["open_events"] / denominator).round(4)
        result["click_event_share"] = (result["click_events"] / denominator).round(4)
        result["registration_event_share"] = (result["registration_events"] / denominator).round(4)
        result["click_events_per_open_event"] = (
            result["click_events"] / result["open_events"].replace(0, np.nan)
        ).round(4)
        return result.sort_values(["click_events", "engaged_people"], ascending=False)

    if "_campaignID" in email.columns:
        sheets["By Campaign"] = summarize("_campaignID", include_subject=True)
    if "_seniority" in email.columns:
        sheets["By Seniority"] = summarize("_seniority")
    if "_industry" in email.columns:
        sheets["By Industry"] = summarize("_industry").head(20)
    if "_quater_segment" in email.columns:
        sheets["By Quarter"] = summarize("_quater_segment")

    definition = pd.DataFrame([
        {
            "Metric": "Engagement events",
            "Definition": "Rows in the supplied email engagement log (Opened, Clicked, or Register).",
            "Safe interpretation": "Observed activity mix among recorded engagements.",
        },
        {
            "Metric": "Open/click/registration event share",
            "Definition": "Event-type rows divided by all engagement-event rows in the same group.",
            "Safe interpretation": "Composition of the event log; not a send-based open or click rate.",
        },
        {
            "Metric": "Engaged people",
            "Definition": "Distinct prospect IDs with at least one recorded engagement.",
            "Safe interpretation": "Reach among people who engaged; the delivered audience is unavailable.",
        },
    ])
    sheets["Metric Definitions"] = definition

    if sheets:
        _write_excel(sheets, "email_campaign_performance.xlsx")


# ---------------------------------------------------------------------------
# 5. Budget Recommendation
# ---------------------------------------------------------------------------
def analyze_budget_recommendation():
    print("\n[5/6] Budget Recommendation")
    cp = _load_int("channel_pipeline")

    channels_with_spend = cp[cp["channel_spend"] > 0].copy()
    total_spend = channels_with_spend["channel_spend"].sum()

    if total_spend == 0:
        print("  No spend data found — skipping")
        return

    channels_with_spend["current_spend_pct"] = channels_with_spend["channel_spend"] / total_spend
    channels_with_spend["evidence_status"] = np.where(
        (channels_with_spend["won_count"] >= 10) & (channels_with_spend["deal_count"] >= 30),
        "Decision-grade",
        "Insufficient outcome evidence",
    )
    evidence = channels_with_spend[[
        "channel_category", "channel_spend", "deal_count", "resolved_count",
        "won_count", "total_pipeline", "won_pipeline", "pipeline_roi",
        "revenue_roi", "evidence_status",
    ]].copy()

    # Spend coverage is too narrow for a defensible optimizer.  Provide three
    # budget-neutral measurement plans instead of projecting pipeline from one
    # highly unstable historical observation.
    scenario_specs = {
        "Status Quo": (1.00, 0.00, 0.00),
        "10% Holdout": (0.90, 0.10, 0.00),
        "Measurement First": (0.80, 0.10, 0.10),
    }
    rows = []
    for scenario, (active_share, holdout_share, experiment_share) in scenario_specs.items():
        for _, row in channels_with_spend.iterrows():
            spend = float(row["channel_spend"])
            rows.append({
                "Scenario": scenario,
                "Channel": row["channel_category"],
                "Active Spend ($)": spend * active_share,
                "Holdout Reserve ($)": spend * holdout_share,
                "Experiment Pool ($)": spend * experiment_share,
                "Total Budget ($)": spend,
                "Evidence Status": row["evidence_status"],
            })
    scenarios = pd.DataFrame(rows)
    scenarios.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "budget_scenarios.parquet"), index=False)

    assumptions = pd.DataFrame([
        {"Rule": "Budget neutrality", "Definition": "Every scenario preserves the current tracked-spend total."},
        {"Rule": "No pipeline forecast", "Definition": "Historical ROI is not extrapolated because only two channels have spend and one has a single opportunity."},
        {"Rule": "Decision gate", "Definition": "Scale only after a pre-registered holdout shows incremental opportunity or pipeline lift with acceptable win-rate quality."},
    ])

    sheets = {
        "Tracked Spend Evidence": evidence,
        "Measurement Scenarios": scenarios,
        "Assumptions": assumptions,
    }
    _write_excel(sheets, "budget_recommendation.xlsx")


# ---------------------------------------------------------------------------
# 6. Data quality and source reconciliation
# ---------------------------------------------------------------------------
def analyze_data_quality():
    print("\n[6/6] Data Quality and Source Reconciliation")
    opps = _load_clean("opportunities")
    accounts = _load_clean("accounts")
    email = _load_clean("email_engagements")
    web = _load_clean("web_engagements")
    ad = _load_clean("ad_metrics")
    campaign6s = _load_clean("6sense_campaign")

    won_col = _won_col(opps)
    stage_col = next((c for c in opps.columns if "current_stage" in c.lower()), None)
    resolved = resolved_stage_mask(opps[stage_col]) if stage_col else pd.Series(True, index=opps.index)
    active = ~resolved
    zero_amount = opps["_amount"].fillna(0).eq(0)
    won = opps[won_col].eq(True) if won_col else pd.Series(False, index=opps.index)

    domain_series = pd.Series(index=opps.index, dtype="object")
    if "_domain" in opps.columns:
        domain_series = opps["_domain"]
    elif {"_account_id"}.issubset(opps.columns) and {"accountid", "domain__c"}.issubset(accounts.columns):
        domain_map = accounts.drop_duplicates("accountid").set_index("accountid")["domain__c"]
        domain_series = opps["_account_id"].map(domain_map)

    create_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    created = pd.to_datetime(opps[create_col], errors="coerce", utc=True) if create_col else pd.Series(dtype="datetime64[ns, UTC]")

    metrics = [
        {"metric": "deduplicated_opportunities", "value": len(opps), "denominator": len(opps), "rate": 1.0, "severity": "info", "interpretation": "One latest-state row per opportunity."},
        {"metric": "resolved_opportunities", "value": int(resolved.sum()), "denominator": len(opps), "rate": float(resolved.mean()), "severity": "info", "interpretation": "Closed won, closed lost, and discontinued outcomes."},
        {"metric": "active_opportunities", "value": int(active.sum()), "denominator": len(opps), "rate": float(active.mean()), "severity": "info", "interpretation": "Eligible population for win-probability scoring."},
        {"metric": "zero_amount_opportunities", "value": int(zero_amount.sum()), "denominator": len(opps), "rate": float(zero_amount.mean()), "severity": "high", "interpretation": "Pipeline and average-deal metrics are incomplete for these records."},
        {"metric": "zero_amount_won_opportunities", "value": int((zero_amount & won).sum()), "denominator": int(won.sum()), "rate": float((zero_amount & won).sum() / won.sum()) if won.sum() else np.nan, "severity": "critical", "interpretation": "Won revenue and revenue ROI are understated until CRM amounts are backfilled."},
        {"metric": "opportunity_domain_coverage", "value": int(domain_series.notna().sum()), "denominator": len(opps), "rate": float(domain_series.notna().mean()), "severity": "medium", "interpretation": "Domain coverage limits account-level attribution matching."},
    ]
    quality = pd.DataFrame(metrics)
    quality.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "data_quality_summary.parquet"), index=False)

    email_semantics = pd.DataFrame({
        "event_type": ["Open events", "Click events", "Registration events"],
        "events": [int(email.get("is_open", pd.Series(dtype=int)).sum()), int(email.get("is_click", pd.Series(dtype=int)).sum()), int(email.get("is_register", pd.Series(dtype=int)).sum())],
    })
    email_semantics["share_of_engagement_log"] = email_semantics["events"] / len(email) if len(email) else np.nan
    email_semantics["denominator_note"] = "Share of supplied engagement-event rows; delivered-email counts are unavailable."

    matched_web = web[web["_domain"].notna()].copy() if "_domain" in web.columns else web.iloc[0:0].copy()
    utm_complete = pd.Series(False, index=matched_web.index)
    if {"_utmsource", "_utmcampaign"}.issubset(matched_web.columns):
        source_ok = matched_web["_utmsource"].fillna("").astype(str).str.strip().ne("")
        campaign_ok = matched_web["_utmcampaign"].fillna("").astype(str).str.strip().ne("")
        utm_complete = source_ok | campaign_ok
    web_identity = pd.DataFrame([
        {"metric": "web_sessions", "value": len(web)},
        {"metric": "domain_matched_sessions", "value": len(matched_web)},
        {"metric": "unique_matched_domains", "value": matched_web["_domain"].nunique() if "_domain" in matched_web.columns else 0},
        {"metric": "matched_sessions_with_utm", "value": int(utm_complete.sum())},
    ])

    ad_6sense_spend = float(ad.loc[ad.get("_platform", pd.Series(index=ad.index)).eq("6sense"), "_spend"].sum()) if "_spend" in ad.columns else 0.0
    campaign_6sense_spend = float(campaign6s.get("_spend", pd.Series(dtype=float)).sum())
    spend_reconciliation = pd.DataFrame([
        {"source": "ad_metrics", "scope": "6sense platform creative/ad rows", "spend": ad_6sense_spend, "controlling_use": "Paid-channel ROI"},
        {"source": "6sense_campaign", "scope": "6sense campaign-account rows", "spend": campaign_6sense_spend, "controlling_use": "Campaign reporting only"},
    ])
    spend_reconciliation["difference_vs_ad_metrics"] = spend_reconciliation["spend"] - ad_6sense_spend

    date_scope = pd.DataFrame([{
        "opportunity_create_date_min": created.min().tz_convert(None) if len(created) and pd.notna(created.min()) else pd.NaT,
        "opportunity_create_date_max": created.max().tz_convert(None) if len(created) and pd.notna(created.max()) else pd.NaT,
        "timezone": "UTC",
    }])
    raw_snapshot_rows = pd.DataFrame()
    try:
        raw_opps = pd.read_excel(RAW_FILES["opportunities"])
        raw_snapshot_rows = pd.DataFrame([{
            "raw_snapshot_rows": len(raw_opps),
            "deduplicated_opportunities": len(opps),
            "rows_removed_as_historical_snapshots": len(raw_opps) - len(opps),
        }])
    except Exception:
        pass

    sheets = {
        "Quality Summary": quality,
        "Email Event Semantics": email_semantics,
        "Web Identity": web_identity,
        "Spend Reconciliation": spend_reconciliation,
        "Date Scope": date_scope,
    }
    if not raw_snapshot_rows.empty:
        sheets["Opportunity Dedup"] = raw_snapshot_rows
    _write_excel(sheets, "data_quality_report.xlsx")


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
    analyze_data_quality()

    print("\nOK Analysis complete ->", ANALYSIS_DIR)


if __name__ == "__main__":
    main()
