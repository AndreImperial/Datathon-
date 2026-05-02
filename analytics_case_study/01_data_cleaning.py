"""
Phase 1: Data Cleaning
Reads each raw .xlsx file, applies transformations, writes clean Parquet to data/cleaned/.
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    RAW_FILES, CLEANED_DATA_DIR, INDUSTRY_NORMALIZATION,
    CHANNEL_LEADSOURCE_MAP, MARKETING_CHANNELS,
)
from analytics_case_study.utils.cleaning_helpers import (
    normalize_domain, replace_null_strings, safe_numeric,
    safe_datetime, normalize_country, normalize_industry,
    filter_free_email_domains, derive_ctr, derive_cpc, derive_cpm,
)


def _read_xlsx(key: str) -> pd.DataFrame:
    print(f"  Reading {os.path.basename(RAW_FILES[key])} ...", end=" ", flush=True)
    df = pd.read_excel(RAW_FILES[key], dtype=str, engine="openpyxl")
    df.columns = [c.strip() for c in df.columns]
    print(f"{len(df):,} rows")
    return df


# ---------------------------------------------------------------------------
# 1. Opportunity Log
# ---------------------------------------------------------------------------
def clean_opportunity_log() -> pd.DataFrame:
    print("\n[1/8] Opportunity Log")
    df = _read_xlsx("opportunities")
    df = replace_null_strings(df)

    date_cols = [c for c in df.columns if "date" in c.lower() or "Date" in c]
    for c in date_cols:
        df[c] = safe_datetime(df[c])

    numeric_cols = [
        "_amount", "_acv", "_mrr", "_maxamount", "_probability",
        "_days", "_days_current_stage", "_days_instage3_closewon",
        "_order", "mrr_amount__c", "total_one_time__c",
    ]
    for c in numeric_cols:
        if c in df.columns:
            df[c] = safe_numeric(df[c])

    # Deduplicate: keep the latest state per opportunity (highest _order)
    if "_opportunity_id" in df.columns and "_order" in df.columns:
        df = (df.sort_values("_order")
                .groupby("_opportunity_id", as_index=False)
                .last())
        print(f"  Deduplicated to {len(df):,} unique opportunities")

    # Normalise boolean columns — covers both prefixed and unprefixed column names
    bool_map = {"True": True, "False": False, "true": True, "false": False,
                "1": True, "0": False, "yes": True, "no": False}
    for c in ["_iswon", "_isclosed", "iswon", "isdeleted"]:
        if c in df.columns:
            df[c] = df[c].map(bool_map)

    # Channel category from lead source
    if "_leadsource" in df.columns:
        df["channel_category"] = df["_leadsource"].map(CHANNEL_LEADSOURCE_MAP).fillna("other")
        df["is_marketing_sourced"] = df["channel_category"].isin(MARKETING_CHANNELS)

    # Normalise segment
    if "segment__c" in df.columns:
        df["segment__c"] = df["segment__c"].str.strip()

    out = os.path.join(CLEANED_DATA_DIR, "opportunities.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 2. Account Log
# ---------------------------------------------------------------------------
def clean_account_log() -> pd.DataFrame:
    print("\n[2/8] Account Log")
    df = _read_xlsx("accounts")
    df = replace_null_strings(df)

    if "domain__c" in df.columns:
        df["domain__c"] = normalize_domain(df["domain__c"])
    if "website" in df.columns:
        df["website"] = normalize_domain(df["website"])
    if "billingcountry" in df.columns:
        df["billingcountry"] = normalize_country(df["billingcountry"])
    if "industry" in df.columns:
        df["industry"] = normalize_industry(df["industry"], INDUSTRY_NORMALIZATION)

    numeric_cols = ["annualrevenue", "numberofemployees", "accountintentscore6sense__c",
                    "numberofopportunities__c", "number_of_partners__c"]
    for c in numeric_cols:
        if c in df.columns:
            df[c] = safe_numeric(df[c])

    for c in ["account6qa6sense__c", "top_5_account__c"]:
        if c in df.columns:
            df[c] = df[c].map({"True": True, "False": False, "true": True, "false": False})

    if "createddate" in df.columns:
        df["createddate"] = safe_datetime(df["createddate"])

    # Normalise tier
    if "tier" in df.columns:
        df["tier"] = df["tier"].replace({"TBD": "Unassigned"}).fillna("Unassigned")

    # Derive segment from revenue if missing
    if "segment__c" in df.columns and "annualrevenue" in df.columns:
        mask = df["segment__c"].isna()
        df.loc[mask & (df["annualrevenue"] >= 500_000_000), "segment__c"] = "Enterprise"
        df.loc[mask & (df["annualrevenue"] >= 50_000_000) & (df["annualrevenue"] < 500_000_000), "segment__c"] = "Mid-Market"
        df.loc[mask & (df["annualrevenue"] < 50_000_000), "segment__c"] = "Commercial"

    out = os.path.join(CLEANED_DATA_DIR, "accounts.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 3. 6sense Campaign Accounts
# ---------------------------------------------------------------------------
def clean_6sense_campaign() -> pd.DataFrame:
    print("\n[3/8] 6sense Campaign Accounts")
    df = _read_xlsx("6sense_campaign")
    df = replace_null_strings(df)

    if "_6sensedomain" in df.columns:
        df["_6sensedomain"] = normalize_domain(df["_6sensedomain"])

    for c in ["_spend", "_clicks", "_impressions"]:
        if c in df.columns:
            df[c] = safe_numeric(df[c])
    if "_influencedformfills" in df.columns:
        df["_influencedformfills"] = safe_numeric(df["_influencedformfills"]).fillna(0).astype(int)

    for c in ["_date", "_latestimpression"]:
        if c in df.columns:
            df[c] = safe_datetime(df[c])

    if "_date" in df.columns:
        df["month_year"] = df["_date"].dt.to_period("M").astype(str)

    if "_clicks" in df.columns and "_impressions" in df.columns:
        df["ctr"] = derive_ctr(df["_clicks"], df["_impressions"])
        df["cost_per_click"] = derive_cpc(df["_spend"], df["_clicks"])
    if "_spend" in df.columns and "_influencedformfills" in df.columns:
        df["cost_per_form_fill"] = derive_cpc(df["_spend"], df["_influencedformfills"].replace(0, np.nan))

    # Drop ETL watermark
    df.drop(columns=[c for c in ["_sdc_table_version", "_sdc_sequence"] if c in df.columns], inplace=True)

    out = os.path.join(CLEANED_DATA_DIR, "6sense_campaign.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 4. Ad Metrics
# ---------------------------------------------------------------------------
def clean_ad_metrics() -> pd.DataFrame:
    print("\n[4/8] Ad Metrics")
    df = _read_xlsx("ad_metrics")
    df = replace_null_strings(df)

    if "day" in df.columns:
        df["day"] = safe_datetime(df["day"])

    numeric_cols = ["_spend", "_clicks", "_impressions", "pageviews",
                    "visitors", "reduced_pageviews", "reduced_visitors"]
    for c in numeric_cols:
        if c in df.columns:
            df[c] = safe_numeric(df[c])

    if "_platform" in df.columns:
        df["_platform"] = df["_platform"].str.strip()

    df.drop(columns=[c for c in ["_screenshot"] if c in df.columns], inplace=True)

    if "_clicks" in df.columns and "_impressions" in df.columns:
        df["ctr"] = derive_ctr(df["_clicks"], df["_impressions"])
        df["cpm"] = derive_cpm(df["_spend"], df["_impressions"])
        df["cpc"] = derive_cpc(df["_spend"], df["_clicks"])
    if "pageviews" in df.columns and "_clicks" in df.columns:
        df["landing_cvr"] = derive_ctr(df["pageviews"], df["_clicks"])

    if "day" in df.columns:
        df["month_year"] = df["day"].dt.to_period("M").astype(str)

    out = os.path.join(CLEANED_DATA_DIR, "ad_metrics.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 5. Email Engagements
# ---------------------------------------------------------------------------
def clean_email_engagements() -> pd.DataFrame:
    print("\n[5/8] Email Engagements")
    df = _read_xlsx("email")
    df = replace_null_strings(df)

    if "_campaign_subject" in df.columns:
        df["_campaign_subject"] = (df["_campaign_subject"]
                                   .str.replace(r"\n|\r", " ", regex=True)
                                   .str.strip())

    for c in ["_timestamp", "_campaignSentDate"]:
        if c in df.columns:
            df[c] = safe_datetime(df[c])

    if "_domain" in df.columns:
        df["_domain"] = normalize_domain(df["_domain"])

    if "_industry" in df.columns:
        df["_industry"] = normalize_industry(df["_industry"], INDUSTRY_NORMALIZATION)

    if "_seniority" in df.columns:
        df["_seniority"] = df["_seniority"].fillna("Unknown").str.strip()

    if "_engagement" in df.columns:
        df["is_click"] = df["_engagement"].str.lower() == "clicked"
        df["is_open"] = df["_engagement"].str.lower() == "opened"
        df["is_register"] = df["_engagement"].str.lower() == "register"

    if "_timestamp" in df.columns and "_campaignSentDate" in df.columns:
        df["days_to_engage"] = (df["_timestamp"] - df["_campaignSentDate"]).dt.days

    if "_timestamp" in df.columns:
        df["month_year"] = df["_timestamp"].dt.to_period("M").astype(str)

    drop_cols = [c for c in ["_sdc_sequence", "_sdc_table_version"] if c in df.columns]
    df.drop(columns=drop_cols, inplace=True)

    out = os.path.join(CLEANED_DATA_DIR, "email_engagements.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 6. Web Engagements
# ---------------------------------------------------------------------------
def clean_web_engagements() -> pd.DataFrame:
    print("\n[6/8] Web Engagements")
    df = _read_xlsx("web")
    df = replace_null_strings(df)

    # Fix leading-space header
    df.columns = [c.strip() for c in df.columns]

    if "_timestamp" in df.columns:
        df["_timestamp"] = safe_datetime(df["_timestamp"])
        df["month_year"] = df["_timestamp"].dt.to_period("M").astype(str)

    if "_domain" in df.columns:
        df["_domain"] = normalize_domain(df["_domain"])

    for c in ["_totalsessionviews", "_timespent", "_target_accounts"]:
        if c in df.columns:
            df[c] = safe_numeric(df[c])

    if "_utmsource" in df.columns:
        src = df["_utmsource"].str.lower().str.strip()
        df["is_6sense_traffic"] = src.isin(["6sense", "6si_filtered", "6si"])
        df["is_email_traffic"] = src.isin(["hs_email", "email", "pardot"])
        df["is_linkedin_traffic"] = src.str.contains("linkedin", na=False)
        df["is_organic"] = src.isin(["organic", "(none)", "google"])

    if "_goalcompletion" in df.columns:
        df["is_goal_completed"] = df["_goalcompletion"].map(
            {"True": True, "False": False, "true": True, "false": False}
        )

    df["has_domain"] = df["_domain"].notna()

    out = os.path.join(CLEANED_DATA_DIR, "web_engagements.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 7. ICP Database
# ---------------------------------------------------------------------------
def clean_icp_database() -> pd.DataFrame:
    print("\n[7/8] ICP Database")
    df = _read_xlsx("icp")
    df = replace_null_strings(df)

    if "_domain" in df.columns:
        df["_domain"] = normalize_domain(df["_domain"])
        df = filter_free_email_domains(df, "_domain")

    if "_industry" in df.columns:
        df["_industry"] = normalize_industry(df["_industry"], INDUSTRY_NORMALIZATION)

    if "_seniority" in df.columns:
        df["_seniority"] = df["_seniority"].fillna("Unknown").str.strip()

    lifecycle_map = {
        "salesqualifiedlead": "SQL",
        "marketingqualifiedlead": "MQL",
        "lead": "Lead",
        "customer": "Customer",
        "opportunity": "Opportunity",
        "subscriber": "Subscriber",
        "evangelist": "Evangelist",
        "other": "Other",
    }
    if "_lifecycleStage" in df.columns:
        df["_lifecycleStage"] = (df["_lifecycleStage"]
                                 .str.strip().str.lower()
                                 .map(lifecycle_map)
                                 .fillna(df["_lifecycleStage"]))

    for c in ["_employee", "_revenue", "_target_accounts", "_target_contacts"]:
        if c in df.columns:
            df[c] = safe_numeric(df[c])

    date_cols = [c for c in df.columns if "date" in c.lower()]
    for c in date_cols:
        df[c] = safe_datetime(df[c])

    drop_cols = [c for c in ["_emails", "_sdc_sequence", "_sdc_table_version"] if c in df.columns]
    df.drop(columns=drop_cols, inplace=True)

    out = os.path.join(CLEANED_DATA_DIR, "icp_database.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# 8. 6sense Segments
# ---------------------------------------------------------------------------
def clean_6sense_segments() -> pd.DataFrame:
    print("\n[8/8] 6sense Segments")
    df = _read_xlsx("segments")
    df = replace_null_strings(df)

    if "_6sensedomain" in df.columns:
        df["_6sensedomain"] = normalize_domain(df["_6sensedomain"])

    if "_date" in df.columns:
        df["_date"] = safe_datetime(df["_date"])

    if "_industry" in df.columns:
        df["_industry"] = normalize_industry(df["_industry"], INDUSTRY_NORMALIZATION)

    # Parse segment_category from segment name
    segment_kw = {
        "Why MAAS": ["why maas", "why_maas"],
        "Intent": ["intent"],
        "Awareness": ["awareness"],
        "Decision": ["decision"],
        "Named Accounts": ["named account"],
        "Priority": ["priority"],
    }
    if "_segment" in df.columns:
        def categorize(val):
            if pd.isna(val):
                return "Unknown"
            v = str(val).lower()
            for cat, kws in segment_kw.items():
                if any(kw in v for kw in kws):
                    return cat
            return "Other"
        df["segment_category"] = df["_segment"].apply(categorize)

    df.drop(columns=[c for c in ["_sdc_table_version"] if c in df.columns], inplace=True)

    out = os.path.join(CLEANED_DATA_DIR, "6sense_segments.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved -> {out}")
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(CLEANED_DATA_DIR, exist_ok=True)
    print("=" * 60)
    print("Phase 1: Data Cleaning")
    print("=" * 60)

    clean_opportunity_log()
    clean_account_log()
    clean_6sense_campaign()
    clean_ad_metrics()
    clean_email_engagements()
    clean_web_engagements()
    clean_icp_database()
    clean_6sense_segments()

    print("\nOK All datasets cleaned and saved to", CLEANED_DATA_DIR)


if __name__ == "__main__":
    main()
