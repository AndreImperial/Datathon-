"""Build the evidence contract for the CMO case-study dashboard and browser deck.

This module deliberately keeps the analytical population, caveats, findings,
recommendations, and presentation in one reproducible export. It does not send
campaigns or produce account-level prospect lists.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR
from analytics_case_study.utils.metrics import resolved_stage_mask, wilson_interval

ROOT = Path(__file__).resolve().parents[1]
CLEAN = Path(CLEANED_DATA_DIR)
INTEGRATED = Path(INTEGRATED_DATA_DIR)
FRONTEND_PUBLIC = ROOT / "frontend" / "public"
OUTPUT = ROOT / "outputs" / "dashboard"
METHOD_VERSION = "case-analysis-v3.0"
LOOKBACKS = (30, 90, 180, 365)


def _clean(value):
    if value is None or value is pd.NA:
        return None
    if value is pd.NaT:
        return None
    if isinstance(value, pd.Period):
        return str(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if not math.isfinite(float(value)) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return value


def records(frame: pd.DataFrame) -> list[dict]:
    return [{key: _clean(value) for key, value in row.items()} for row in frame.to_dict("records")]


def pct(numerator: float, denominator: float) -> float | None:
    return None if not denominator else float(numerator) / float(denominator)


def money(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "Unavailable"
    return f"${value / 1_000_000:.1f}M" if abs(value) >= 1_000_000 else f"${value:,.0f}"


def percent(value: float | None, digits: int = 1) -> str:
    return "Unavailable" if value is None or not math.isfinite(value) else f"{value * 100:.{digits}f}%"


def source_hashes() -> dict[str, str]:
    hashes = {}
    for path in sorted(CLEAN.glob("*.parquet")):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        hashes[path.name] = digest
    return hashes


def date_col(frame: pd.DataFrame, needle: str) -> str | None:
    return next((column for column in frame.columns if needle.lower() in column.lower()), None)


def canonical_population() -> tuple[pd.DataFrame, pd.DataFrame]:
    opps = pd.read_parquet(CLEAN / "opportunities.parquet").copy()
    accounts = pd.read_parquet(CLEAN / "accounts.parquet").copy()
    deleted = opps["isdeleted"].eq(True) if "isdeleted" in opps else pd.Series(False, index=opps.index)
    active = opps.loc[~deleted].copy()
    stage = next((column for column in active.columns if "current_stage" in column.lower()), None)
    active["resolved"] = resolved_stage_mask(active[stage]) if stage else active["iswon"].eq(True)
    active["won"] = active["iswon"].eq(True)
    active.loc[active["won"], "resolved"] = True
    active["lost"] = active["resolved"] & ~active["won"]
    active["active"] = ~active["resolved"]
    active["amount"] = pd.to_numeric(active.get("_amount"), errors="coerce")
    created = date_col(active, "createdate")
    active["created_at"] = pd.to_datetime(active[created], utc=True, errors="coerce") if created else pd.NaT
    active["created_year"] = active["created_at"].dt.year.astype("Int64")
    active["quarter"] = active["created_at"].dt.to_period("Q").astype(str)
    active["segment"] = active.get("segment__c", pd.Series("Unknown", index=active.index)).fillna("Unknown").astype(str).str.strip().replace({"Mid-Market": "Mid", "": "Unknown"})
    raw_motion = active.get("_type", pd.Series("", index=active.index)).fillna("").astype(str).str.strip().str.lower()
    motion_map = {"new business - mrr": "Acquisition", "new business - one time": "Acquisition", "renewal - mrr": "Renewal"}
    active["business_motion"] = raw_motion.map(motion_map).fillna("Unknown")
    account_domains = accounts.set_index("accountid").get("domain__c", pd.Series(dtype="object")).to_dict()
    direct = active.get("_domain", pd.Series("", index=active.index)).fillna("").astype(str).str.strip().str.lower()
    fallback = active.get("_account_id", pd.Series("", index=active.index)).map(account_domains).fillna("").astype(str).str.strip().str.lower()
    active["domain"] = direct.where(direct.ne("") & direct.ne("nan"), fallback).replace({"": np.nan, "nan": np.nan})
    reconciliation = pd.DataFrame([
        {"stage": "Raw latest snapshots", "opportunities": len(opps), "recorded_amount": pd.to_numeric(opps.get("_amount"), errors="coerce").sum(), "won_opportunities": int(opps.get("iswon", pd.Series(False, index=opps.index)).eq(True).sum())},
        {"stage": "Deleted snapshots excluded", "opportunities": int(deleted.sum()), "recorded_amount": pd.to_numeric(opps.loc[deleted].get("_amount"), errors="coerce").sum(), "won_opportunities": int(opps.loc[deleted].get("iswon", pd.Series(False, index=opps.loc[deleted].index)).eq(True).sum())},
        {"stage": "Canonical analytical population", "opportunities": len(active), "recorded_amount": active["amount"].sum(), "won_opportunities": int(active["won"].sum())},
    ])
    return active, reconciliation


def touchpoints() -> tuple[pd.DataFrame, pd.DataFrame]:
    rows = []
    coverage = []
    def add_source(filename: str, name: str, domain_col: str, timestamp_col: str, channel: str, frame: pd.DataFrame):
        stamp = pd.to_datetime(frame.get(timestamp_col), utc=True, errors="coerce")
        domain = frame.get(domain_col, pd.Series("", index=frame.index)).fillna("").astype(str).str.strip().str.lower()
        valid = pd.DataFrame({"domain": domain, "timestamp": stamp}).dropna()
        valid = valid[valid["domain"].ne("") & valid["domain"].ne("nan")]
        coverage.append({"source": name, "min_timestamp": valid["timestamp"].min(), "max_timestamp": valid["timestamp"].max(), "rows": len(frame), "usable_touchpoints": len(valid), "rule": f"{channel} touchpoints with usable domain and timestamp"})
        valid["channel"] = channel
        valid["source"] = name
        rows.append(valid)
    six = pd.read_parquet(CLEAN / "6sense_campaign.parquet")
    stamp_col = "_latestimpression" if "_latestimpression" in six else "_date"
    add_source("6sense_campaign.parquet", "6sense campaign", "_6sensedomain", stamp_col, "6sense display", six)
    email = pd.read_parquet(CLEAN / "email_engagements.parquet")
    add_source("email_engagements.parquet", "Email engagement", "_domain", "_timestamp", "Email", email)
    web = pd.read_parquet(CLEAN / "web_engagements.parquet")
    for label, column, channel in [("6sense web traffic", "is_6sense_traffic", "6sense display"), ("email web traffic", "is_email_traffic", "Email"), ("LinkedIn web traffic", "is_linkedin_traffic", "LinkedIn")]:
        subset = web.loc[web.get(column, pd.Series(False, index=web.index)).eq(True)].copy()
        add_source("web_engagements.parquet", label, "_domain", "_timestamp", channel, subset)
    all_touch = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=["domain", "timestamp", "channel", "source"])
    all_touch["week"] = all_touch["timestamp"].dt.strftime("%G-W%V")
    all_touch = all_touch.sort_values("timestamp").drop_duplicates(["domain", "channel", "week"], keep="last")
    return all_touch, pd.DataFrame(coverage)


def linked_touches(opps: pd.DataFrame, touches: pd.DataFrame, lookback: int) -> pd.DataFrame:
    eligible = opps.dropna(subset=["domain", "created_at", "amount"]).copy()
    merged = eligible[["_opportunity_id", "domain", "created_at", "amount", "won", "resolved", "segment", "business_motion", "channel_category"]].merge(touches, on="domain", how="inner")
    merged["days_before"] = (merged["created_at"] - merged["timestamp"]).dt.total_seconds() / 86400
    merged = merged[merged["days_before"].between(0, lookback)].copy()
    if merged.empty:
        return merged
    merged["week"] = merged["timestamp"].dt.strftime("%G-W%V")
    return merged.sort_values("timestamp").drop_duplicates(["_opportunity_id", "channel", "week"], keep="last")


def channel_scorecard(opps: pd.DataFrame, linked: pd.DataFrame, ad: pd.DataFrame) -> pd.DataFrame:
    scopes = {"All history": (None, None), "2023": (pd.Timestamp("2023-01-01", tz="UTC"), pd.Timestamp("2024-01-01", tz="UTC")), "2024": (pd.Timestamp("2024-01-01", tz="UTC"), pd.Timestamp("2025-01-01", tz="UTC"))}
    spend = ad.copy()
    spend["date"] = pd.to_datetime(spend.get("day"), utc=True, errors="coerce")
    platform_map = {"6sense": "6sense display", "LinkedIn": "LinkedIn"}
    rows = []
    for scope, (start, end) in scopes.items():
        subset = opps.copy()
        if start is not None:
            subset = subset[subset["created_at"].between(start, end, inclusive="left")]
        for motion in ["All", "Acquisition", "Renewal", "Unknown"]:
            motion_df = subset if motion == "All" else subset[subset["business_motion"].eq(motion)]
            for channel, group in motion_df.groupby("channel_category", dropna=False):
                resolved = group[group["resolved"]]
                won = int(group["won"].sum())
                low, high = wilson_interval(won, len(resolved))
                linked_ids = set(linked.loc[linked["_opportunity_id"].isin(group["_opportunity_id"]), "_opportunity_id"])
                platform = {"6sense_display": "6sense", "linkedin": "LinkedIn"}.get(str(channel))
                tracked = spend[spend.get("_platform").eq(platform)] if platform else spend.iloc[0:0]
                if start is not None:
                    tracked = tracked[tracked["date"].between(start, end, inclusive="left")]
                spend_value = pd.to_numeric(tracked.get("_spend"), errors="coerce").sum() if platform else np.nan
                pipeline_same_period = group["amount"].sum() if start is not None and platform else np.nan
                rows.append({"scope": scope, "business_motion": motion, "channel": str(channel or "Unknown"), "opportunities": len(group), "resolved": len(resolved), "won": won, "resolved_share": pct(len(resolved), len(group)), "win_rate": pct(won, len(resolved)), "win_rate_ci_low": low, "win_rate_ci_high": high, "recorded_pipeline": group["amount"].sum(), "recorded_won_amount": group.loc[group["won"], "amount"].sum(), "positive_amount_coverage": pct(int(group["amount"].gt(0).sum()), len(group)), "won_positive_amount_coverage": pct(int(group.loc[group["won"], "amount"].gt(0).sum()), won), "median_positive_amount": group.loc[group["amount"].gt(0), "amount"].median(), "linked_opportunities": len(linked_ids), "linked_share": pct(len(linked_ids), len(group)), "tracked_spend": spend_value if platform else None, "spend_period_start": tracked["date"].min() if len(tracked) else None, "spend_period_end": tracked["date"].max() if len(tracked) else None, "recorded_sourced_pipeline_per_tracked_spend": pct(pipeline_same_period, spend_value) if platform and spend_value else None, "evidence_status": "Limited" if len(resolved) < 30 else "Observed", "recommendation_id": ""})
    return pd.DataFrame(rows)


def content_analysis() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ads = pd.read_parquet(CLEAN / "ad_metrics.parquet").copy()
    ads["date"] = pd.to_datetime(ads.get("day"), utc=True, errors="coerce")
    ad_rows = []
    for (platform, ad_id), group in ads.groupby(["_platform", "_adid"], dropna=False):
        impressions = pd.to_numeric(group["_impressions"], errors="coerce").sum()
        clicks = pd.to_numeric(group["_clicks"], errors="coerce").sum()
        spend = pd.to_numeric(group["_spend"], errors="coerce").sum()
        ad_rows.append({"platform": platform, "ad_id": str(ad_id), "ad_name": group["_adname"].dropna().iloc[0] if group["_adname"].notna().any() else str(ad_id), "impressions": impressions, "clicks": clicks, "spend": spend, "ctr": pct(clicks, impressions), "cpc": pct(spend, clicks), "cpm": pct(spend * 1000, impressions), "date_start": group["date"].min(), "date_end": group["date"].max(), "eligible": impressions >= 10_000})
    rankings = pd.DataFrame(ad_rows)
    rankings["rank"] = rankings[rankings["eligible"]].sort_values(["platform", "ctr", "impressions", "ad_id"], ascending=[True, False, False, True]).groupby("platform").cumcount() + 1
    meta_rows = []
    for platform, group in ads.groupby("_platform"):
        total_impressions = pd.to_numeric(group["_impressions"], errors="coerce").sum()
        total_spend = pd.to_numeric(group["_spend"], errors="coerce").sum()
        for field in ["_copyassettype", "_copymessaging", "_copytone", "_ctacopysofthard"]:
            known = group[field].notna() & group[field].astype(str).str.strip().ne("") if field in group else pd.Series(False, index=group.index)
            meta_rows.append({"platform": platform, "field": field.replace("_copy", "").replace("_", " ").title(), "known_rows": int(known.sum()), "distinct_ads_known": int(group.loc[known, "_adid"].nunique()), "known_impression_share": pct(pd.to_numeric(group.loc[known, "_impressions"], errors="coerce").sum(), total_impressions), "known_spend_share": pct(pd.to_numeric(group.loc[known, "_spend"], errors="coerce").sum(), total_spend)})
    known = ads.dropna(subset=["_copyassettype", "_copymessaging", "_copytone", "_ctacopysofthard"]).copy()
    bundles = known.groupby(["_platform", "_copyassettype", "_copymessaging", "_copytone", "_ctacopysofthard"], dropna=False).agg(ads=("_adid", "nunique"), impressions=("_impressions", "sum"), clicks=("_clicks", "sum"), spend=("_spend", "sum")).reset_index()
    bundles["ctr"] = bundles["clicks"] / bundles["impressions"].replace(0, np.nan)
    bundles["evidence_status"] = np.where(bundles["ads"] >= 3, "Limited", "Exploratory")
    email = pd.read_parquet(CLEAN / "email_engagements.parquet").copy()
    identity = email.get("_prospectID", pd.Series("", index=email.index)).fillna("").astype(str).str.strip()
    fallback = email.get("_email", pd.Series("", index=email.index)).fillna("").astype(str).str.strip().str.lower()
    email["person_id"] = identity.where(identity.ne(""), fallback).replace("", np.nan)
    email["content_title"] = email.get("_contentTitle", pd.Series("Unknown", index=email.index)).fillna("Unknown").astype(str)
    email_rows = []
    for title, group in email.groupby("content_title", dropna=False):
        people = group["person_id"].dropna().nunique()
        clickers = group.loc[group.get("is_click", pd.Series(False, index=group.index)).eq(True), "person_id"].dropna().nunique()
        registrations = group.loc[group.get("is_register", pd.Series(False, index=group.index)).eq(True), "person_id"].dropna().nunique()
        email_rows.append({"content_title": title, "recorded_events": len(group), "unique_engaged_people": people, "unique_clickers": clickers, "unique_registrants": registrations, "click_events": int(group.get("is_click", pd.Series(False, index=group.index)).eq(True).sum()), "registration_events": int(group.get("is_register", pd.Series(False, index=group.index)).eq(True).sum()), "click_event_share": pct(int(group.get("is_click", pd.Series(False, index=group.index)).eq(True).sum()), len(group)), "unique_clicker_share_of_engaged": pct(clickers, people), "category": group.get("_category", pd.Series("Unknown", index=group.index)).dropna().iloc[0] if group.get("_category", pd.Series(dtype="object")).notna().any() else "Unknown"})
    web = pd.read_parquet(CLEAN / "web_engagements.parquet").copy()
    web_rows = []
    for page_group, group in web.groupby("_pagegroup", dropna=False):
        web_rows.append({"page_group": page_group or "Unknown", "recorded_rows": len(group), "unique_recordings": group.get("_recordingid", pd.Series(dtype="object")).nunique(), "unique_visitors": group.get("_visitorid", pd.Series(dtype="object")).nunique(), "recordings_with_observed_goal": group.loc[group.get("is_goal_completed", pd.Series(False, index=group.index)).eq(True), "_recordingid"].nunique(), "goal_status": "Observed flags only; missing does not mean no conversion."})
    return rankings, pd.DataFrame(meta_rows), bundles, pd.DataFrame(email_rows), pd.DataFrame(web_rows)


def attribution(opps: pd.DataFrame, touches: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    linked365 = linked_touches(opps, touches, 365)
    linked_ids = set(linked365.get("_opportunity_id", pd.Series(dtype="object")))
    overlap = opps.copy()
    overlap["sourced"] = overlap.get("is_marketing_sourced", pd.Series(False, index=overlap.index)).eq(True)
    overlap["linked"] = overlap["_opportunity_id"].isin(linked_ids)
    overlap["overlap_group"] = np.select([overlap["sourced"] & ~overlap["linked"], ~overlap["sourced"] & overlap["linked"], overlap["sourced"] & overlap["linked"]], ["Sourced only", "Linked only", "Both"], default="Neither observed")
    overlap_table = overlap.groupby("overlap_group", as_index=False).agg(opportunities=("_opportunity_id", "count"), won_opportunities=("won", "sum"), recorded_pipeline=("amount", "sum"), recorded_won_amount=("amount", lambda x: x[overlap.loc[x.index, "won"]].sum()))
    sens_rows = []
    year_rows = []
    for lookback in LOOKBACKS:
        linked = linked_touches(opps, touches, lookback)
        ids = linked["_opportunity_id"].unique() if len(linked) else []
        for year, group in opps.groupby("created_year", dropna=False):
            year_ids = set(group["_opportunity_id"])
            year_rows.append({"lookback_days": lookback, "created_year": int(year) if pd.notna(year) else None, "opportunities": len(group), "linked_opportunities": len(year_ids.intersection(ids)), "linked_share": pct(len(year_ids.intersection(ids)), len(group))})
        if linked.empty:
            continue
        for model in ["First touch", "Last touch", "Linear", "Time decay"]:
            credits = []
            for opp_id, group in linked.groupby("_opportunity_id"):
                amount = group["amount"].iloc[0]
                won = bool(group["won"].iloc[0])
                if model == "First touch":
                    first = group[group["timestamp"].eq(group["timestamp"].min())]
                    channels = first["channel"].unique(); weights = {channel: 1 / len(channels) for channel in channels}
                elif model == "Last touch":
                    last = group[group["timestamp"].eq(group["timestamp"].max())]
                    channels = last["channel"].unique(); weights = {channel: 1 / len(channels) for channel in channels}
                elif model == "Linear":
                    channels = group["channel"].unique(); weights = {channel: 1 / len(channels) for channel in channels}
                else:
                    weights_raw = group.assign(weight=np.exp(-np.log(2) / 30 * group["days_before"].clip(lower=0))).groupby("channel")["weight"].sum()
                    weights = (weights_raw / weights_raw.sum()).to_dict()
                for channel, weight in weights.items():
                    credits.append({"channel": channel, "amount": amount * weight, "won_amount": amount * weight if won else 0})
            modeled = pd.DataFrame(credits).groupby("channel", as_index=False).agg(attributed_amount=("amount", "sum"), attributed_won_amount=("won_amount", "sum"))
            modeled["share_of_linked_amount"] = modeled["attributed_amount"] / modeled["attributed_amount"].sum()
            modeled["rank"] = modeled["attributed_amount"].rank(method="min", ascending=False).astype(int)
            modeled["lookback_days"] = lookback; modeled["model"] = model; modeled["linked_opportunities"] = len(ids)
            sens_rows.extend(records(modeled))
    journey = []
    if not linked365.empty:
        for opp_id, group in linked365[linked365["resolved"]].groupby("_opportunity_id"):
            ordered = group.sort_values("timestamp").groupby("channel", as_index=False).first().sort_values("timestamp")
            sequence = " → ".join(ordered["channel"].tolist())
            journey.append({"sequence": sequence, "_opportunity_id": opp_id, "won": bool(group["won"].iloc[0])})
    journey_frame = pd.DataFrame(journey)
    if len(journey_frame):
        journey_table = journey_frame.groupby("sequence", as_index=False).agg(resolved_opportunities=("_opportunity_id", "count"), wins=("won", "sum"))
        journey_table["losses"] = journey_table["resolved_opportunities"] - journey_table["wins"]
        journey_table["win_rate"] = journey_table["wins"] / journey_table["resolved_opportunities"]
        intervals = journey_table.apply(lambda row: wilson_interval(int(row["wins"]), int(row["resolved_opportunities"])), axis=1)
        journey_table["win_rate_ci_low"] = [x[0] for x in intervals]; journey_table["win_rate_ci_high"] = [x[1] for x in intervals]
        journey_table["linked_population_share"] = journey_table["resolved_opportunities"] / journey_table["resolved_opportunities"].sum()
        journey_table["evidence_status"] = np.where(journey_table["resolved_opportunities"] >= 30, "Observed", "Exploratory")
        journey_table = journey_table.sort_values("resolved_opportunities", ascending=False).head(12)
    else:
        journey_table = pd.DataFrame()
    return overlap_table, pd.DataFrame(sens_rows), pd.DataFrame(year_rows), journey_table


def decomposition(opps: pd.DataFrame, dimension: str) -> pd.DataFrame:
    a = opps[opps["created_at"].between(pd.Timestamp("2022-01-01", tz="UTC"), pd.Timestamp("2022-07-01", tz="UTC"), inclusive="left") & opps["resolved"]]
    b = opps[opps["created_at"].between(pd.Timestamp("2024-01-01", tz="UTC"), pd.Timestamp("2024-07-01", tz="UTC"), inclusive="left") & opps["resolved"]]
    rows = []
    for value in sorted(set(a[dimension].fillna("Unknown")) | set(b[dimension].fillna("Unknown"))):
        ga, gb = a[a[dimension].fillna("Unknown").eq(value)], b[b[dimension].fillna("Unknown").eq(value)]
        wa, wb = pct(len(ga), len(a)) or 0, pct(len(gb), len(b)) or 0
        ra, rb = pct(int(ga["won"].sum()), len(ga)) or 0, pct(int(gb["won"].sum()), len(gb)) or 0
        rows.append({"dimension": dimension, "group": value, "period_a_resolved": len(ga), "period_b_resolved": len(gb), "period_a_win_rate": ra if len(ga) else None, "period_b_win_rate": rb if len(gb) else None, "mix_effect_pp": (wb - wa) * (ra + rb) / 2 * 100, "within_effect_pp": (rb - ra) * (wa + wb) / 2 * 100, "total_effect_pp": ((wb - wa) * (ra + rb) / 2 + (rb - ra) * (wa + wb) / 2) * 100})
    return pd.DataFrame(rows).sort_values("total_effect_pp")


def audience(opps: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    accounts = pd.read_parquet(CLEAN / "accounts.parquet").copy()
    icp = pd.read_parquet(CLEAN / "icp_database.parquet").copy()
    accounts["domain"] = accounts.get("domain__c", pd.Series("", index=accounts.index)).fillna("").astype(str).str.strip().str.lower().replace("", np.nan)
    icp["domain"] = icp.get("_domain", pd.Series("", index=icp.index)).fillna("").astype(str).str.strip().str.lower().replace("", np.nan)
    icp_target = icp.groupby("domain")["_target_accounts"].max().rename("icp_target")
    base = accounts.dropna(subset=["domain"]).copy().groupby("domain", as_index=False).agg(account_type=("type", lambda x: "|".join(sorted(set(x.dropna().astype(str))))), segment=("segment__c", lambda x: "|".join(sorted(set(x.dropna().astype(str))))), fit=("accountprofilefit6sense__c", lambda x: "|".join(sorted(set(x.dropna().astype(str))))))
    base = base.merge(icp_target, on="domain", how="left")
    base["icp_target"] = pd.to_numeric(base["icp_target"], errors="coerce")
    active_domains = set(opps.loc[opps["active"], "domain"].dropna())
    customer_terms = "customer|existing|partner|competitor|pe firm|private"
    base["exclusion"] = np.select([base["account_type"].str.contains(customer_terms, case=False, regex=True, na=False), base["domain"].isin(active_domains), ~base["icp_target"].eq(1), base["segment"].str.contains("\\|", regex=True, na=False) | base["fit"].str.contains("\\|", regex=True, na=False), base["segment"].eq("") | base["fit"].eq("")], ["Customer, partner, competitor, or private-equity account", "Active opportunity", "Not an explicit ICP target", "Conflicting segment or fit", "Missing segment or fit"], default="Eligible before reach check")
    exclusions = base.groupby("exclusion", as_index=False).agg(domains=("domain", "count"))
    eligible = base[base["exclusion"].eq("Eligible before reach check")].copy()
    eligible["segment"] = eligible["segment"].replace({"Mid-Market": "Mid"})
    eligible["fit"] = eligible["fit"].replace({"Mid-Market": "Mid"})
    hist = opps[opps["resolved"]].merge(accounts[["accountid", "accountprofilefit6sense__c"]], left_on="_account_id", right_on="accountid", how="left")
    hist["fit"] = hist["accountprofilefit6sense__c"].fillna("Unknown")
    priority = hist.groupby(["segment", "fit"], as_index=False).agg(resolved=("_opportunity_id", "count"), wins=("won", "sum"), positive_amount_coverage=("amount", lambda x: pct(int(x.gt(0).sum()), len(x))))
    priority["win_rate"] = priority["wins"] / priority["resolved"]
    intervals = priority.apply(lambda row: wilson_interval(int(row["wins"]), int(row["resolved"])), axis=1)
    priority["win_rate_ci_low"] = [pair[0] for pair in intervals]; priority["win_rate_ci_high"] = [pair[1] for pair in intervals]
    counts = eligible.groupby(["segment", "fit"], as_index=False).agg(eligible_domains=("domain", "count"))
    priority = priority.merge(counts, on=["segment", "fit"], how="left").fillna({"eligible_domains": 0})
    priority["shortlist_eligible"] = (priority["resolved"] >= 30) & (priority["eligible_domains"] > 0)
    priority["segment_fit"] = priority["segment"].astype(str) + " / " + priority["fit"].astype(str)
    priority["wilson_low"] = priority["win_rate_ci_low"]
    priority["status"] = np.where(priority["shortlist_eligible"], "Shortlist eligible", "Exploratory or no current audience")
    return exclusions, priority.sort_values(["shortlist_eligible", "win_rate_ci_low", "eligible_domains"], ascending=[False, False, False])


def experiments(audience_count: int) -> pd.DataFrame:
    rows = []
    for baseline in [0.02, 0.05, 0.10]:
        for lift in [0.01, 0.02, 0.03]:
            p2 = baseline + lift; pbar = (baseline + p2) / 2
            numerator = (1.96 * math.sqrt(2 * pbar * (1 - pbar)) + 0.8416 * math.sqrt(baseline * (1 - baseline) + p2 * (1 - p2))) ** 2
            per_arm = math.ceil(numerator / lift**2)
            feasible = audience_count >= per_arm * 2
            rows.append({"scenario": f"{baseline:.0%} baseline / {lift:.0%} absolute lift", "baseline_90d_rate": baseline, "baseline_rate": baseline, "absolute_lift": lift, "required_per_arm": per_arm, "required_total": per_arm * 2, "eligible_audience": audience_count, "feasible": feasible, "feasibility": "Feasible" if feasible else "Insufficient audience for this scenario", "assumption": "Two-sided alpha .05, power .80, equal allocation"})
    return pd.DataFrame(rows)


def build_contract() -> dict:
    opps, reconciliation = canonical_population()
    touches, coverage = touchpoints()
    linked = linked_touches(opps, touches, 365)
    ads = pd.read_parquet(CLEAN / "ad_metrics.parquet")
    scorecard = channel_scorecard(opps, linked, ads)
    rankings, metadata, bundles, email_content, web_content = content_analysis()
    overlap, sensitivity, yearly, journeys = attribution(opps, touches)
    channel_decomp = decomposition(opps, "channel_category")
    segment_decomp = decomposition(opps, "segment")
    channel_trends = opps.dropna(subset=["quarter"]).groupby("quarter", as_index=False).agg(
        opportunities=("_opportunity_id", "count"), resolved=("resolved", "sum"), won=("won", "sum"),
        recorded_pipeline=("amount", "sum"), positive_amount_coverage=("amount", lambda x: pct(int(x.gt(0).sum()), len(x)))
    )
    channel_trends["win_rate"] = channel_trends["won"] / channel_trends["resolved"].replace(0, np.nan)
    channel_trends["resolved_share"] = channel_trends["resolved"] / channel_trends["opportunities"].replace(0, np.nan)
    exclusions, priority = audience(opps)
    eligible_total = int(priority["eligible_domains"].sum())
    scenarios = experiments(eligible_total)
    model_stats = pd.read_parquet(INTEGRATED / "model_stats.parquet") if (INTEGRATED / "model_stats.parquet").exists() else pd.DataFrame()
    model_bands = pd.DataFrame()
    if (INTEGRATED / "win_probability.parquet").exists():
        model = pd.read_parquet(INTEGRATED / "win_probability.parquet")
        model["band"] = pd.cut(model["win_probability"], bins=[-0.01, .25, .5, .75, 1], labels=["0–25%", "25–50%", "50–75%", "75–100%"])
        model_bands = model.groupby("band", observed=False).agg(active_opportunities=("_opportunity_id", "count"), mean_score=("win_probability", "mean")).reset_index()
    primary_score = scorecard[(scorecard["scope"].eq("All history")) & scorecard["business_motion"].eq("Acquisition")].sort_values("recorded_won_amount", ascending=False)
    top_channel = primary_score.iloc[0] if len(primary_score) else None
    top_bundle = bundles.sort_values("ctr", ascending=False).iloc[0] if len(bundles) else None
    summary = {"opportunities": len(opps), "resolved": int(opps["resolved"].sum()), "won": int(opps["won"].sum()), "recorded_pipeline": float(opps["amount"].sum()), "recorded_won_amount": float(opps.loc[opps["won"], "amount"].sum()), "linked_365": int(linked["_opportunity_id"].nunique()), "linked_share": pct(int(linked["_opportunity_id"].nunique()), len(opps)), "eligible_domains": eligible_total, "top_channel": str(top_channel["channel"]) if top_channel is not None else "Unavailable", "top_channel_win_rate": float(top_channel["win_rate"]) if top_channel is not None and pd.notna(top_channel["win_rate"]) else None, "bundle_label": f"{top_bundle['_copyassettype']} / {top_bundle['_copymessaging']} / {top_bundle['_copytone']}" if top_bundle is not None else "Unavailable", "bundle_ctr": float(top_bundle["ctr"]) if top_bundle is not None else None}
    findings = [
        {"id": "f-channel", "question_id": "channels", "headline": f"{summary['top_channel']} leads recorded acquisition won amount in the available CRM history", "summary": "Channel rankings describe recorded CRM outcomes. They do not estimate incremental channel value.", "evidence_status": "Observed", "metric_refs": ["summary.top_channel"], "chart_refs": ["channel_scorecard"], "source_ids": ["opportunities.parquet"], "population": "Canonical non-deleted opportunities", "period": "All available history", "caveats": ["Recorded amounts have material zero-value coverage."], "recommended_action_ids": ["r-channel"]},
        {"id": "f-content", "question_id": "content", "headline": "Creative metadata supports bundle-level hypotheses only", "summary": f"The strongest labeled bundle is {summary['bundle_label']} at {percent(summary['bundle_ctr'])}, but only five ads contain complete format/message/tone labels.", "evidence_status": "Limited", "metric_refs": ["summary.bundle_ctr"], "chart_refs": ["creative_bundles"], "source_ids": ["ad_metrics.parquet"], "population": "Labeled ads only", "period": "2023–2024 ad records", "caveats": ["Format, message, tone, and CTA are confounded."], "recommended_action_ids": ["r-content"]},
        {"id": "f-attribution", "question_id": "attribution", "headline": "Touchpoint evidence is bounded by 2024 marketing-log coverage", "summary": f"{summary['linked_365']:,} opportunities link to eligible 365-day touches. The percentage is not a measure of full-history tracking completeness.", "evidence_status": "Observed", "metric_refs": ["summary.linked_share"], "chart_refs": ["attribution_overlap", "attribution_year_coverage"], "source_ids": ["email_engagements.parquet", "web_engagements.parquet", "6sense_campaign.parquet"], "population": "Canonical opportunities with usable domain/date/amount", "period": "Lookback-specific", "caveats": ["Marketing sources begin in 2024."], "recommended_action_ids": ["r-measurement"]},
        {"id": "f-audience", "question_id": "strategy", "headline": f"{eligible_total:,} explicit ICP target domains remain eligible for a controlled coverage test", "summary": "The audience excludes current customers, active opportunities, non-target accounts, and conflicting profiles.", "evidence_status": "Observed", "metric_refs": ["summary.eligible_domains"], "chart_refs": ["audience_exclusions", "audience_priority"], "source_ids": ["accounts.parquet", "icp_database.parquet", "opportunities.parquet"], "population": "Normalized account-domain universe", "period": "Current account snapshot", "caveats": ["Current fit is an association, not historical causal evidence."], "recommended_action_ids": ["r-test"]},
    ]
    recommendations = [
        {"id": "r-channel", "decision": "Maintain and measure the strongest observed acquisition channels", "audience": "Acquisition opportunities by CRM source", "channel": summary["top_channel"], "content_or_creative_bundle": "Use channel-specific creative tests", "supporting_finding_ids": ["f-channel"], "evidence_limitations": ["Observed outcomes are not causal channel effects."], "owner_role": "Demand generation lead", "immediate_next_step": "Review the scorecard by 2023 and 2024 before expanding spend.", "primary_success_measure": "Resolved win rate and recorded pipeline in a comparable scope", "scale_stop_rule": "Do not reallocate budget from historical ratios alone.", "confidence_status": "Observed"},
        {"id": "r-content", "decision": "Run a balanced creative-bundle test", "audience": "Eligible account campaign audience", "channel": "Paid media", "content_or_creative_bundle": "Create matched variants that isolate format, message, and tone", "supporting_finding_ids": ["f-content"], "evidence_limitations": ["Existing labeled ads confound multiple creative dimensions."], "owner_role": "Creative strategy lead", "immediate_next_step": "Run controlled variants with the same audience and delivery window.", "primary_success_measure": "Platform-specific CTR and downstream account engagement", "scale_stop_rule": "Keep claims exploratory until variants isolate one dimension.", "confidence_status": "Hypothesis"},
        {"id": "r-test", "decision": "Run a 90-day account coverage experiment", "audience": "Eligible ICP target domains", "channel": "Separate email-first and 6sense-overlay tests", "content_or_creative_bundle": "Pre-registered outreach package", "supporting_finding_ids": ["f-audience", "f-attribution"], "evidence_limitations": ["Observed reached-account rates may reflect selection and seller activity."], "owner_role": "ABM lead", "immediate_next_step": "Randomize domains 50/50 within segment/fit cells.", "primary_success_measure": "New CRM opportunity creation within 90 days", "scale_stop_rule": "Scale only after a feasible scenario shows incremental qualified opportunities.", "confidence_status": "Hypothesis"},
        {"id": "r-measurement", "decision": "Report source and journey evidence separately", "audience": "CMO operating review", "channel": "All tracked marketing channels", "content_or_creative_bundle": "N/A", "supporting_finding_ids": ["f-attribution"], "evidence_limitations": ["Attribution does not estimate incremental lift."], "owner_role": "Marketing operations lead", "immediate_next_step": "Publish overlap, coverage, and model/window sensitivity together.", "primary_success_measure": "Complete attribution report with explicit population coverage", "scale_stop_rule": "Do not use linked influence as a universal revenue total.", "confidence_status": "Observed"},
    ]
    slides = []
    main_subjects = ["The case question", "Marketing strategy", "Evidence scope", "Business motion", "Channel effectiveness", "Channel trends", "Conversion drivers", "Advertising content", "Email and website engagement", "Source and touch overlap", "Attribution and journeys", "Target audience", "Channel and content actions", "Controlled experiment", "Budget implications", "CMO decisions"]
    durations = [45, 60, 60, 60, 90, 60, 90, 90, 75, 60, 75, 60, 75, 75, 45, 60]
    bodies = [
        f"Which channels and content formats support acquisition, recorded revenue, and engagement? The evidence supports measured channel decisions and controlled tests.",
        "Maintain observed channel performance, test creative bundles, and use a randomized account-coverage experiment before expanding spend.",
        "CRM history begins in 2018. Marketing activity logs begin in 2024, so historic attribution coverage has a bounded observation window.",
        "Acquisition, renewal, and unknown opportunity motions stay separate. Existing-client source labels do not substitute for a motion definition.",
        f"{summary['top_channel']} leads the current acquisition scorecard by recorded won amount. Read the scorecard with zero-amount coverage and rate intervals.",
        "Compare complete calendar years rather than treating short marketing logs as a multi-year channel performance record.",
        "The 2022 H1 to 2024 H1 rate change is decomposed into changing mix and within-group conversion changes. Neither component alone establishes cause.",
        f"Only a small labeled creative subset exists. {summary['bundle_label']} is a bundle hypothesis, not proof that one creative attribute wins.",
        "Email reports conditional engagement from supplied event logs. Web contact-page activity has an observed flag but does not prove completed acquisition.",
        "Sourced and touch-linked populations overlap. The four exclusive groups prevent adding different attribution definitions together.",
        "Attribution ranks change by model and window. Journey patterns describe linked paths before opportunity creation.",
        f"{eligible_total:,} eligible ICP target domains remain after customer, pipeline, target, and profile exclusions.",
        "Actions distinguish what to maintain, what to test, and what remains insufficiently supported.",
        "Randomize eligible domains 50/50. Measure new CRM opportunity creation after 90 days before evaluating broader commercial outcomes.",
        "Historical tracked spend is context. Sample feasibility and cost per enrolled treatment account determine the planning budget.",
        "The CMO decision is to approve measurement-ready channel and creative tests, then review the resulting incrementality evidence.",
    ]
    chart_refs = [[], [], ["source_coverage"], ["channel_scorecard"], ["channel_scorecard"], ["channel_trends"], ["conversion_decomposition"], ["creative_bundles"], ["email_content", "web_content"], ["attribution_overlap"], ["attribution_model_sensitivity", "journey_outcomes"], ["audience_exclusions", "audience_priority"], ["recommendations"], ["experiment_scenarios"], ["experiment_scenarios"], ["recommendations"]]
    for index, (subject, duration, body, refs) in enumerate(zip(main_subjects, durations, bodies, chart_refs), start=1):
        slides.append({"id": f"main-{index:02d}", "sequence": "main", "order": index, "title": subject, "layout": "evidence" if refs else "statement", "finding_ids": ["f-channel", "f-content", "f-attribution", "f-audience"], "chart_refs": refs, "metric_refs": [], "scope": "Fixed analysis scope", "body": body, "source_footer": "Validated cleaned and integrated source extracts", "visible_caveat": "Read the evidence status and denominator beside each view.", "speaker_notes": {"say": body, "why": "Connect the evidence to a CMO decision.", "do_not_claim": "Do not describe observational evidence as causal lift.", "transition": "Move to the next evidence layer.", "judge_question": "What is the denominator and source window?", "answer": "The visible caption and appendix define both.", "sources": refs}, "target_duration_seconds": duration})
    appendix_subjects = ["Population and source coverage", "Metric definitions", "Attribution methods", "Conversion decomposition", "Targeting and sample uncertainty", "Model diagnostics"]
    for index, subject in enumerate(appendix_subjects, start=1):
        slides.append({"id": f"appendix-{index:02d}", "sequence": "appendix", "order": index, "title": subject, "layout": "methods", "finding_ids": [], "chart_refs": [], "metric_refs": [], "scope": "Appendix", "body": "Supporting methodology, definitions, and limitations for judge questions.", "source_footer": "Validated source extracts", "visible_caveat": "This slide supports interpretation; it does not change the main decision.", "speaker_notes": {"say": "Use this only when a judge asks for methodological detail.", "why": "Make the evidence auditable.", "do_not_claim": "Do not generalize beyond the supplied source windows.", "transition": "Return to the main decision.", "judge_question": "How was this calculated?", "answer": "The visible definitions and source references document the method.", "sources": []}, "target_duration_seconds": 0})
    hashes = source_hashes()
    snapshot_id = hashlib.sha256((METHOD_VERSION + json.dumps(hashes, sort_keys=True)).encode()).hexdigest()[:16]
    datasets = {"population_reconciliation": records(reconciliation), "source_coverage": records(coverage), "channel_scorecard": records(scorecard), "channel_trends": records(channel_trends), "content_metadata_coverage": records(metadata), "ad_rankings": records(rankings), "creative_bundles": records(bundles), "email_content": records(email_content), "web_content": records(web_content), "attribution_overlap": records(overlap), "attribution_model_sensitivity": records(sensitivity), "attribution_year_coverage": records(yearly), "journey_outcomes": records(journeys), "conversion_decomposition": records(pd.concat([channel_decomp, segment_decomp], ignore_index=True)), "loss_reason_summary": [], "audience_exclusions": records(exclusions), "audience_priority": records(priority), "experiment_scenarios": records(scenarios), "model_score_bands": records(model_bands), "model_diagnostics": records(model_stats), "summary": [summary]}
    statuses = {key: {"status": "available", "reason": "Generated from the canonical analytical population.", "source_ids": [], "population": "See dataset definition", "period": "Static snapshot"} for key in datasets}
    statuses.update({"creative_bundles": {"status": "limited", "reason": "Only five ads have complete creative metadata; dimensions are confounded.", "source_ids": ["ad_metrics.parquet"], "population": "Labeled ads", "period": "2023–2024"}, "email_content": {"status": "limited", "reason": "No sent or delivered denominators.", "source_ids": ["email_engagements.parquet"], "population": "Recorded engagement events", "period": "2024"}, "attribution_model_sensitivity": {"status": "limited", "reason": "Touchpoint sources have 2024 observation windows.", "source_ids": ["email_engagements.parquet", "web_engagements.parquet", "6sense_campaign.parquet"], "population": "Eligible linked opportunities", "period": "Lookback-specific"}, "loss_reason_summary": {"status": "unavailable", "reason": "A versioned loss-reason mapping has not been established for the supplied free text.", "source_ids": ["opportunities.parquet"], "population": "Resolved losses", "period": "All available history"}})
    return {"schema_version": 3, "meta": {"title": "CMO Marketing Decision Brief", "period": "CRM history 2018–2024; marketing logs observed in 2024", "generated_at": pd.Timestamp.now(tz="UTC"), "snapshot_id": snapshot_id, "method_version": METHOD_VERSION, "source_hashes": hashes, "source_freshness": "Static analytical snapshot generated from supplied files."}, "metric_definitions": {"resolved_win_rate": "won opportunities / resolved opportunities", "recorded_pipeline": "sum of source-recorded opportunity amount", "touch_linkage": "eligible pre-opportunity touches within a stated lookback; not causal lift", "email_metrics": "conditional on supplied engagement events, not sent or delivered messages"}, "datasets": datasets, "dataset_status": statuses, "findings": findings, "recommendations": recommendations, "presentation": {"target_duration_seconds": 1080, "slides": slides}, "manifest": {"case_questions": ["Customer acquisition", "Recorded revenue", "Engagement", "Channels", "Content formats", "Attribution", "Marketing strategy"], "sections": ["s-summary", "s-channels", "s-content", "s-attribution", "s-trends", "s-audience", "s-strategy", "s-evidence"], "legacy_archive": "/full-analysis"}}


def main() -> None:
    FRONTEND_PUBLIC.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    payload = build_contract()
    text = json.dumps(payload, ensure_ascii=False, indent=2, default=_clean)
    (FRONTEND_PUBLIC / "dashboard-data-v3.json").write_text(text, encoding="utf-8")
    (OUTPUT / "dashboard_data_v3.json").write_text(text, encoding="utf-8")
    print(f"CMO evidence contract written with snapshot {payload['meta']['snapshot_id']}")


if __name__ == "__main__":
    main()
