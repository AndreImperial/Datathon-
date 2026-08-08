"""
Phase 3b: Multi-Touch Attribution Models

Builds a unified touchpoint timeline across 6sense, email, and web channels,
then links touchpoints to opportunities to compute:
  - Marketing Sourced pipeline (leadsource = marketing)
  - Marketing Influenced pipeline (any touchpoint before opp creation)
  - First-Touch attribution
  - Last-Touch attribution
  - Linear attribution (equal split across all channels)
  - Time-Decay attribution (exponential weighting, recent = more credit)

Output: outputs/analysis/attribution_models.xlsx
"""
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import (
    ANALYSIS_DIR,
    CHANNEL_LEADSOURCE_MAP,
    CLEANED_DATA_DIR,
    INTEGRATED_DATA_DIR,
)

ATTRIBUTION_WINDOW_DAYS = 365  # look-back window before opportunity creation
SOURCE_CHANNEL_MAP = {str(k).strip().lower(): v for k, v in CHANNEL_LEADSOURCE_MAP.items()}


def classify_web_touchpoint(source, campaign):
    """Map web UTM metadata to the same canonical channels used by CRM lead source."""
    src = str(source or "").strip().lower()
    camp = str(campaign or "").strip().lower()

    if not src and not camp:
        return "web_unclassified"

    for value in (camp, src):
        if value in SOURCE_CHANNEL_MAP:
            return SOURCE_CHANNEL_MAP[value]

    if ("6sense" in camp or "6si" in camp) and "event" in camp:
        return "6sense_event"
    if "webinar" in src or "webinar" in camp:
        return "webinar"
    if "event" in src or "event" in camp:
        return "event"
    if "other" in src or "other" in camp:
        return "other_marketing"
    if "marketo" in src or "marketo" in camp or "email" in src or "hs_email" in src or "pardot" in src:
        return "email_mqa"
    if "6sense" in src or "6si" in src:
        return "6sense_display"
    if "linkedin" in src or "linkedin" in camp:
        return "linkedin"
    return "web_unclassified"


# ---------------------------------------------------------------------------
# 1. Build unified touchpoint table
# ---------------------------------------------------------------------------
def build_touchpoints() -> pd.DataFrame:
    """
    Returns a DataFrame with one row per marketing touchpoint per account:
      domain | touchpoint_date | channel | touchpoint_type | weight (raw=1)
    """
    rows = []

    # --- 6sense display: every account-campaign interaction ---
    c6 = pd.read_parquet(os.path.join(CLEANED_DATA_DIR, "6sense_campaign.parquet"))
    if "_6sensedomain" in c6.columns and "_date" in c6.columns:
        c6["_date_utc"] = pd.to_datetime(c6["_date"], utc=True, errors="coerce")
        # Use _latestimpression as the more precise touchpoint date
        if "_latestimpression" in c6.columns:
            c6["tp_date"] = pd.to_datetime(c6["_latestimpression"], utc=True, errors="coerce")
            c6["tp_date"] = c6["tp_date"].fillna(c6["_date_utc"])
        else:
            c6["tp_date"] = c6["_date_utc"]
        valid = c6.dropna(subset=["_6sensedomain", "tp_date"])
        for _, row in valid.iterrows():
            rows.append({
                "domain": row["_6sensedomain"],
                "touchpoint_date": row["tp_date"],
                "channel": "6sense_display",
                "touchpoint_type": "ad_impression",
                "campaign_id": row.get("_campaignid", ""),
                "is_marketing_touch": True,
            })

    # --- Email engagements: clicks are highest-intent touchpoints ---
    em = pd.read_parquet(os.path.join(CLEANED_DATA_DIR, "email_engagements.parquet"))
    if "_domain" in em.columns and "_timestamp" in em.columns:
        em["tp_date"] = pd.to_datetime(em["_timestamp"], utc=True, errors="coerce")
        # Include opens AND clicks — weight clicks higher in time-decay
        valid_em = em.dropna(subset=["_domain", "tp_date"])
        for _, row in valid_em.iterrows():
            tp_type = "email_click" if row.get("is_click") else ("email_register" if row.get("is_register") else "email_open")
            rows.append({
                "domain": row["_domain"],
                "touchpoint_date": row["tp_date"],
                "channel": "email_mqa",
                "touchpoint_type": tp_type,
                "campaign_id": row.get("_campaignID", ""),
                "is_marketing_touch": True,
            })

    # --- Web engagements: marketing-attributed sessions only ---
    web = pd.read_parquet(os.path.join(CLEANED_DATA_DIR, "web_engagements.parquet"))
    if "_domain" in web.columns and "_timestamp" in web.columns:
        web["tp_date"] = pd.to_datetime(web["_timestamp"], utc=True, errors="coerce")
        web_with_domain = web.dropna(subset=["_domain", "tp_date"])
        for _, row in web_with_domain.iterrows():
            campaign = str(row.get("_utmcampaign", ""))
            ch = classify_web_touchpoint(row.get("_utmsource", ""), campaign)
            tp_type = f"web_visit_{ch}"
            rows.append({
                "domain": row["_domain"],
                "touchpoint_date": row["tp_date"],
                "channel": ch,
                "touchpoint_type": tp_type,
                "campaign_id": str(row.get("_utmcampaign", "")),
                "is_marketing_touch": ch != "web_unclassified",
            })

    tp_df = pd.DataFrame(rows)
    tp_df["touchpoint_date"] = pd.to_datetime(tp_df["touchpoint_date"], utc=True, errors="coerce")
    tp_df = tp_df.dropna(subset=["domain", "touchpoint_date"])
    tp_df["domain"] = tp_df["domain"].astype(str).str.lower().str.strip()

    quality = (
        tp_df.groupby(["channel", "is_marketing_touch"], dropna=False)
        .agg(raw_rows=("domain", "size"), domains=("domain", "nunique"))
        .reset_index()
    )
    quality.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "attribution_touchpoint_quality.parquet"), index=False)

    marketing = tp_df[tp_df["is_marketing_touch"]].copy()
    raw_marketing_rows = len(marketing)
    # Normalize the source grain before cross-channel weighting: at most one
    # presence per account, channel, and calendar week.  This prevents 6sense
    # impression-row density from overwhelming email actions purely because the
    # source systems log at different grains.
    marketing["touchpoint_week"] = marketing["touchpoint_date"].dt.strftime("%G-W%V")
    marketing = (
        marketing.sort_values("touchpoint_date")
        .drop_duplicates(["domain", "channel", "touchpoint_week"], keep="last")
        .drop(columns=["touchpoint_week"])
    )
    print(
        f"  Built normalized marketing touchpoints: {len(marketing):,} account-channel-weeks "
        f"from {raw_marketing_rows:,} raw marketing rows across {marketing['domain'].nunique():,} domains"
    )
    excluded = len(tp_df) - raw_marketing_rows
    if excluded:
        print(f"  Excluded {excluded:,} unclassified web rows from marketing attribution")
    return marketing


# ---------------------------------------------------------------------------
# 2. Link touchpoints to opportunities
# ---------------------------------------------------------------------------
def link_touchpoints_to_opps(tp_df: pd.DataFrame) -> pd.DataFrame:
    """
    For each opportunity, find all touchpoints from the same account domain
    within the ATTRIBUTION_WINDOW_DAYS before the opportunity create date.
    Returns: one row per (opportunity_id, touchpoint), with opportunity_amount.
    """
    opps = pd.read_parquet(os.path.join(CLEANED_DATA_DIR, "opportunities.parquet"))
    accts = pd.read_parquet(os.path.join(CLEANED_DATA_DIR, "accounts.parquet"))

    # Resolve opportunity domain: use _domain from opp if available, else join via account
    opp_date_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    if opp_date_col is None:
        print("  WARNING: No create date found in opportunities — skipping link")
        return pd.DataFrame()

    opps["_opp_create_date"] = pd.to_datetime(opps[opp_date_col], utc=True, errors="coerce")

    # Build domain lookup from accounts
    if "accountid" in accts.columns and "domain__c" in accts.columns:
        acct_domain = accts.set_index("accountid")["domain__c"].to_dict()
    else:
        acct_domain = {}

    # Resolve opportunity domain
    def resolve_opp_domain(row):
        d = str(row.get("_domain", "")).strip() if "_domain" in opps.columns else ""
        if d and d != "nan":
            return d
        acct_id = row.get("_account_id", "")
        return acct_domain.get(str(acct_id), "")

    opps["opp_domain"] = opps.apply(resolve_opp_domain, axis=1)
    opps_with_domain = opps[
        opps["opp_domain"].notna() & (opps["opp_domain"] != "") &
        opps["_opp_create_date"].notna() & opps["_amount"].notna()
    ].copy()

    print(f"  Opportunities with domain + create date: {len(opps_with_domain):,}")

    # Merge touchpoints into opportunities via domain
    iswon_col = "iswon" if "iswon" in opps_with_domain.columns else (
        "_iswon" if "_iswon" in opps_with_domain.columns else None
    )
    select_cols = ["_opportunity_id", "opp_domain", "_opp_create_date", "_amount", "channel_category", "is_marketing_sourced"]
    if iswon_col:
        select_cols.append(iswon_col)
    merged = opps_with_domain[select_cols].merge(
        tp_df[["domain", "touchpoint_date", "channel", "touchpoint_type", "campaign_id"]],
        left_on="opp_domain", right_on="domain",
        how="left",
    )

    # Filter: only touchpoints BEFORE the opportunity was created
    merged["days_before_opp"] = (
        merged["_opp_create_date"] - merged["touchpoint_date"]
    ).dt.total_seconds() / 86400

    in_window = merged[
        merged["days_before_opp"].between(0, ATTRIBUTION_WINDOW_DAYS)
    ].copy()

    print(f"  Touchpoints linked within {ATTRIBUTION_WINDOW_DAYS}-day window: {len(in_window):,}")
    return in_window, opps


# ---------------------------------------------------------------------------
# 3. Apply attribution models
# ---------------------------------------------------------------------------
def apply_attribution_models(linked: pd.DataFrame, opps_full: pd.DataFrame) -> dict:
    """
    Applies 4 attribution models and returns a dict of DataFrames.
    Each DataFrame has: channel | attributed_pipeline | attributed_won | deal_count
    """
    results = {}
    iswon_col = "iswon" if "iswon" in opps_full.columns else (
        "_iswon" if "_iswon" in opps_full.columns else None
    )
    iswon_linked = "iswon" if "iswon" in linked.columns else (
        "_iswon" if "_iswon" in linked.columns else None
    )

    def _won_sum(df, amount_col="_amount"):
        if iswon_col and iswon_col in df.columns:
            return df.loc[df[iswon_col] == True, amount_col].sum()
        return 0.0

    def _linked_won_sum(df, amount_col="_amount"):
        if iswon_linked and iswon_linked in df.columns:
            return df.loc[df[iswon_linked] == True, amount_col].sum()
        return 0.0

    # --- Marketing Sourced ---
    if "channel_category" in opps_full.columns and "_amount" in opps_full.columns:
        if "is_marketing_sourced" in opps_full.columns:
            sourced = opps_full[opps_full["is_marketing_sourced"] == True].copy()
        else:
            sourced = opps_full[opps_full["channel_category"] != "other"].copy()
        sg = sourced.groupby("channel_category").agg(
            attributed_pipeline=("_amount", "sum"),
            deal_count=("_opportunity_id", "count"),
        ).reset_index().rename(columns={"channel_category": "channel"})
        sg["attributed_won"] = sourced.groupby("channel_category").apply(
            lambda g: _won_sum(g)
        ).reindex(sg["channel"]).fillna(0).values
        sg["attribution_model"] = "Marketing Sourced"
        results["Marketing Sourced"] = sg

    # --- Marketing Influenced ---
    # Credit influenced pipeline to the marketing touchpoint channel that
    # actually touched the account, not to the opportunity's CRM source.
    if not linked.empty:
        influenced_touchpoints = linked.drop_duplicates(["_opportunity_id", "channel"]).copy()
        if "_amount" in influenced_touchpoints.columns and "channel" in influenced_touchpoints.columns:
            n_channels = influenced_touchpoints.groupby("_opportunity_id")["channel"].transform("nunique")
            influenced_touchpoints["influenced_pipeline_credit"] = influenced_touchpoints["_amount"] / n_channels.replace(0, np.nan)
            if iswon_linked and iswon_linked in influenced_touchpoints.columns:
                influenced_touchpoints["influenced_won_credit"] = np.where(
                    influenced_touchpoints[iswon_linked] == True,
                    influenced_touchpoints["influenced_pipeline_credit"],
                    0,
                )
            else:
                influenced_touchpoints["influenced_won_credit"] = 0.0
            ig = influenced_touchpoints.groupby("channel").agg(
                attributed_pipeline=("influenced_pipeline_credit", "sum"),
                attributed_won=("influenced_won_credit", "sum"),
                deal_count=("_opportunity_id", "nunique"),
            ).reset_index()
            ig["attribution_model"] = "Marketing Influenced"
            results["Marketing Influenced"] = ig

    if linked.empty or "channel" not in linked.columns:
        print("  No linked touchpoints — skipping first/last/linear/time-decay models")
        return results

    # --- First-Touch ---
    ft_df = linked.sort_values("touchpoint_date").groupby("_opportunity_id").first().reset_index()
    ft = ft_df.groupby("channel").agg(
        attributed_pipeline=("_amount", "sum"),
        deal_count=("_opportunity_id", "count"),
    ).reset_index()
    ft["attributed_won"] = ft_df.groupby("channel").apply(lambda g: _won_sum(g)).reindex(ft["channel"]).fillna(0).values
    ft["attribution_model"] = "First-Touch"
    results["First-Touch"] = ft

    # --- Last-Touch ---
    lt_df = linked.sort_values("touchpoint_date").groupby("_opportunity_id").last().reset_index()
    lt = lt_df.groupby("channel").agg(
        attributed_pipeline=("_amount", "sum"),
        deal_count=("_opportunity_id", "count"),
    ).reset_index()
    lt["attributed_won"] = lt_df.groupby("channel").apply(lambda g: _won_sum(g)).reindex(lt["channel"]).fillna(0).values
    lt["attribution_model"] = "Last-Touch"
    results["Last-Touch"] = lt

    # --- Linear (equal credit per unique channel per opportunity) ---
    linear_rows = []
    for opp_id, group in linked.groupby("_opportunity_id"):
        unique_channels = group["channel"].unique()
        n = len(unique_channels)
        if n == 0:
            continue
        opp_amount = group["_amount"].iloc[0]
        is_won = bool(group[iswon_linked].iloc[0]) if iswon_linked else False
        credit = opp_amount / n
        for ch in unique_channels:
            linear_rows.append({
                "channel": ch,
                "_opportunity_id": opp_id,
                "attributed_pipeline": credit,
                "attributed_won": credit if is_won else 0,
            })
    if linear_rows:
        lin_df = pd.DataFrame(linear_rows)
        lin = lin_df.groupby("channel").agg(
            attributed_pipeline=("attributed_pipeline", "sum"),
            attributed_won=("attributed_won", "sum"),
            deal_count=("_opportunity_id", "nunique"),
        ).reset_index()
        lin["attribution_model"] = "Linear"
        results["Linear"] = lin

    # --- Time-Decay (half-life = 30 days, exponential weighting) ---
    # ``linked`` is already normalized to account-channel-week grain, so the
    # weights measure repeated weekly presence rather than raw source-row volume.
    HALF_LIFE = 30
    ld = linked.copy()
    ld["decay_weight"] = np.exp(-np.log(2) / HALF_LIFE * ld["days_before_opp"].clip(lower=0))
    decay_rows = []
    for opp_id, group in ld.groupby("_opportunity_id"):
        ch_weights = group.groupby("channel")["decay_weight"].sum()
        grand_total = ch_weights.sum()
        if grand_total == 0:
            continue
        opp_amount = group["_amount"].iloc[0]
        is_won = bool(group[iswon_linked].iloc[0]) if iswon_linked else False
        for ch, w in ch_weights.items():
            credit = (w / grand_total) * opp_amount
            decay_rows.append({
                "channel": ch,
                "_opportunity_id": opp_id,
                "attributed_pipeline": credit,
                "attributed_won": credit if is_won else 0,
            })
    if decay_rows:
        dec_df = pd.DataFrame(decay_rows)
        dec = dec_df.groupby("channel").agg(
            attributed_pipeline=("attributed_pipeline", "sum"),
            attributed_won=("attributed_won", "sum"),
            deal_count=("_opportunity_id", "nunique"),
        ).reset_index()
        dec["attribution_model"] = "Time-Decay"
        results["Time-Decay"] = dec

    return results


# ---------------------------------------------------------------------------
# 4. Build comparison summary
# ---------------------------------------------------------------------------
def build_comparison(model_results: dict) -> pd.DataFrame:
    """Pivot: channels as rows, attribution models as columns."""
    all_rows = pd.concat(model_results.values(), ignore_index=True)
    pivot = all_rows.pivot_table(
        index="channel",
        columns="attribution_model",
        values="attributed_pipeline",
        aggfunc="sum",
    ).fillna(0)
    return pivot.reset_index()


def build_attribution_coverage(linked: pd.DataFrame, opps: pd.DataFrame) -> pd.DataFrame:
    """Document the exact eligible and linked attribution populations."""
    iswon_col = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)
    eligible = opps[
        opps.get("opp_domain", pd.Series(index=opps.index, dtype="object")).fillna("").astype(str).str.strip().ne("")
        & opps.get("_opp_create_date", pd.Series(pd.NaT, index=opps.index)).notna()
        & opps["_amount"].notna()
    ].copy()
    linked_ids = set(linked["_opportunity_id"].dropna().unique()) if not linked.empty else set()
    linked_opps = eligible[eligible["_opportunity_id"].isin(linked_ids)].copy()
    total_won = int(opps[iswon_col].eq(True).sum()) if iswon_col else 0
    eligible_won = int(eligible[iswon_col].eq(True).sum()) if iswon_col else 0
    linked_won = int(linked_opps[iswon_col].eq(True).sum()) if iswon_col else 0
    coverage = pd.DataFrame([{
        "lookback_days": ATTRIBUTION_WINDOW_DAYS,
        "all_opportunities": len(opps),
        "eligible_domain_date_amount": len(eligible),
        "linked_opportunities": len(linked_opps),
        "linked_share_of_all_opportunities": len(linked_opps) / len(opps) if len(opps) else np.nan,
        "all_won_opportunities": total_won,
        "eligible_won_opportunities": eligible_won,
        "linked_won_opportunities": linked_won,
        "linked_share_of_won_opportunities": linked_won / total_won if total_won else np.nan,
        "linked_pipeline": float(linked_opps["_amount"].sum()),
        "linked_won_revenue": float(linked_opps.loc[linked_opps[iswon_col].eq(True), "_amount"].sum()) if iswon_col else 0.0,
        "touchpoint_grain": "one account-channel presence per ISO week",
        "web_rule": "blank-UTM web sessions excluded from marketing attribution",
    }])
    coverage.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "attribution_coverage.parquet"), index=False)
    return coverage


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    print("=" * 60)
    print("Phase 3b: Multi-Touch Attribution")
    print("=" * 60)

    print("\n[1/4] Building touchpoint table ...")
    tp_df = build_touchpoints()

    print("\n[2/4] Linking touchpoints to opportunities ...")
    result = link_touchpoints_to_opps(tp_df)
    if isinstance(result, tuple):
        linked, opps_full = result
    else:
        print("  No link data — exiting")
        return

    print("\n[3/4] Applying attribution models ...")
    model_results = apply_attribution_models(linked, opps_full)
    coverage = build_attribution_coverage(linked, opps_full)

    print("\n[4/4] Writing outputs ...")
    out_path = os.path.join(ANALYSIS_DIR, "attribution_models.xlsx")
    with pd.ExcelWriter(out_path, engine="xlsxwriter") as writer:
        for model_name, df in model_results.items():
            df_out = df.sort_values("attributed_pipeline", ascending=False).copy()
            for c in ["attributed_pipeline", "attributed_won"]:
                if c in df_out.columns:
                    df_out[c] = df_out[c].apply(lambda v: f"${v:,.0f}" if pd.notna(v) else "$0")
            df_out.to_excel(writer, sheet_name=model_name[:31], index=False)

        comparison = build_comparison(model_results)
        comparison.to_excel(writer, sheet_name="Model Comparison", index=False)
        coverage.to_excel(writer, sheet_name="Coverage and Scope", index=False)
        pd.DataFrame([
            {"Assumption": "Lookback window", "Definition": f"Marketing touchpoint occurred 0-{ATTRIBUTION_WINDOW_DAYS} days before opportunity creation."},
            {"Assumption": "Touchpoint normalization", "Definition": "One account-channel presence per ISO week; source-row frequency is not treated as cross-channel importance."},
            {"Assumption": "Web classification", "Definition": "Sessions without a non-blank UTM source or campaign are excluded from marketing attribution."},
            {"Assumption": "Interpretation", "Definition": "Attribution describes observed journey association and credit allocation; it does not estimate incremental causal lift."},
        ]).to_excel(writer, sheet_name="Method Definitions", index=False)

    print(f"  Saved -> {out_path}")

    # Also save raw numeric version as parquet for dashboard use
    all_rows = pd.concat(model_results.values(), ignore_index=True)
    all_rows.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "attribution_results.parquet"), index=False)
    print(f"  Attribution parquet saved -> {INTEGRATED_DATA_DIR}")

    # Print summary
    print("\n--- Attribution Summary ---")
    comparison_num = build_comparison(model_results)
    print(comparison_num.to_string(index=False))
    print("\nOK Attribution complete")


if __name__ == "__main__":
    main()
