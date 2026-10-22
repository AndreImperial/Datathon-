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
from analytics_case_study.utils.population import canonical_opportunities
from analytics_case_study.utils.cleaning_helpers import normalize_domain, email_person_identity
from analytics_case_study.utils.diagnostics import score_bins

ROOT = Path(__file__).resolve().parents[1]
CLEAN = Path(CLEANED_DATA_DIR)
INTEGRATED = Path(INTEGRATED_DATA_DIR)
FRONTEND_PUBLIC = ROOT / "frontend" / "public"
OUTPUT = ROOT / "outputs" / "dashboard"
METHOD_VERSION = "case-analysis-v3.2"
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
    active = canonical_opportunities(opps)
    deleted = ~opps.index.isin(active.index)
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
    direct = normalize_domain(direct)
    active["domain"] = direct.fillna(normalize_domain(fallback))
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
        domain = normalize_domain(frame.get(domain_col, pd.Series("", index=frame.index)))
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
    return normalize_touchpoints(all_touch), pd.DataFrame(coverage)


def normalize_touchpoints(touches: pd.DataFrame) -> pd.DataFrame:
    """Retain event times until each opportunity's eligible window is known."""
    return touches.dropna(subset=["domain", "timestamp"]).sort_values("timestamp").copy()


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
                spend_value = pd.to_numeric(tracked.get("_spend"), errors="coerce").sum(min_count=1) if platform and len(tracked) else np.nan
                spend_start = tracked["date"].min() if len(tracked) else pd.NaT
                spend_end = tracked["date"].max() if len(tracked) else pd.NaT
                matched = group[group.created_at.between(spend_start, spend_end + pd.Timedelta(days=1), inclusive="left")] if len(tracked) else group.iloc[:0]
                pipeline_same_period = matched["amount"].sum() if len(tracked) and motion == "All" else np.nan
                rows.append({"scope": scope, "business_motion": motion, "channel": str(channel or "Unknown"), "opportunities": len(group), "resolved": len(resolved), "won": won, "resolved_share": pct(len(resolved), len(group)), "win_rate": pct(won, len(resolved)), "win_rate_ci_low": low, "win_rate_ci_high": high, "recorded_pipeline": group["amount"].sum(), "recorded_won_amount": group.loc[group["won"], "amount"].sum(), "positive_amount_coverage": pct(int(group["amount"].gt(0).sum()), len(group)), "won_positive_amount_coverage": pct(int(group.loc[group["won"], "amount"].gt(0).sum()), won), "median_positive_amount": group.loc[group["amount"].gt(0), "amount"].median(), "linked_opportunities": len(linked_ids), "linked_share": pct(len(linked_ids), len(group)), "tracked_spend": spend_value if platform else None, "pipeline_period_start": spend_start, "pipeline_period_end": spend_end, "period_matched_pipeline": pipeline_same_period, "period_matched_opportunities": len(matched) if len(tracked) else None, "spend_measurement_status": "Tracked platform spend" if len(tracked) else "Unmeasured", "spend_period_start": tracked["date"].min() if len(tracked) else None, "spend_period_end": tracked["date"].max() if len(tracked) else None, "recorded_sourced_pipeline_per_tracked_spend": pct(pipeline_same_period, spend_value) if platform and spend_value else None, "evidence_status": "Limited" if len(resolved) < 30 else "Observed", "recommendation_id": ""})
    result = pd.DataFrame(rows)
    for scope, (start, end) in scopes.items():
        cohort = opps if start is None else opps[opps.created_at.between(start, end, inclusive="left")]
        classified = int(cohort.business_motion.ne("Unknown").sum())
        mask = result.scope.eq(scope)
        result.loc[mask, "cohort_opportunities"] = len(cohort)
        result.loc[mask, "classified_opportunities"] = classified
        result.loc[mask, "motion_classification_coverage"] = pct(classified, len(cohort))
        for motion in ["Acquisition", "Renewal"]:
            if len(cohort) and classified == 0:
                result = pd.concat([result, pd.DataFrame([{"scope":scope,"business_motion":motion,"channel":"Unavailable","opportunities":None,"resolved":None,"won":None,"evidence_status":"Unavailable","unavailable_reason":"No classified motion in this observed creation-year cohort","cohort_opportunities":len(cohort),"classified_opportunities":0,"motion_classification_coverage":0.0}])], ignore_index=True)
    result["population_definition"] = "All history known-motion subsets when motion filtered; otherwise canonical opportunities in observed creation-date cohort"
    return result


def motion_coverage(opps):
    rows = []
    for year, group in opps.groupby("created_year", dropna=False):
        classified = int(group.business_motion.ne("Unknown").sum())
        rows.append({"created_year": int(year) if pd.notna(year) else None, "opportunities":len(group),"classified_opportunities":classified,"unknown_motion_opportunities":int(group.business_motion.eq("Unknown").sum()),"classification_coverage":pct(classified,len(group)),"acquisition_opportunities":int(group.business_motion.eq("Acquisition").sum()) if classified else None,"acquisition_status":"Observed known-motion subset" if classified else "Unavailable: no classified motion", "period_start":group.created_at.min(),"period_end":group.created_at.max(),"period_definition":"Observed creation-date records; calendar completeness unverified"})
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
    email["person_id"] = email_person_identity(email)
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
        web_rows.append({"page_group": page_group or "Unknown", "recorded_rows": len(group), "unique_recordings": group.get("_recordingid", pd.Series(dtype="object")).nunique(), "unique_visitors": group.get("_visitorid", pd.Series(dtype="object")).nunique(), "recordings_with_observed_contact_activity": group.loc[group.get("is_goal_completed", pd.Series(False, index=group.index)).eq(True), "_recordingid"].nunique(), "recording_definition": "Distinct recording IDs; equivalence to sessions unverified", "unknown_contact_flag_rows": int(group.get("is_goal_completed", pd.Series(pd.NA, index=group.index)).isna().sum()), "goal_status": "Observed contact flags only; missing does not mean no conversion."})
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
            modeled["lookback_days"] = lookback; modeled["model"] = model; modeled["window_linked_population"] = len(ids)
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
        ra, rb = pct(int(ga["won"].sum()), len(ga)), pct(int(gb["won"].sum()), len(gb))
        common = ra is not None and rb is not None
        mix = (wb - wa) * (ra + rb) / 2 * 100 if common else None
        within = (rb - ra) * (wa + wb) / 2 * 100 if common else None
        total = (wb * (rb or 0) - wa * (ra or 0)) * 100
        rows.append({"dimension": dimension, "group": value, "period_a_resolved": len(ga), "period_b_resolved": len(gb), "period_a_win_rate": ra, "period_b_win_rate": rb, "mix_effect_pp": mix, "within_effect_pp": within, "entry_exit_effect_pp": 0.0 if common else total, "total_effect_pp": total, "support": "Common support" if common else "Group entry or exit"})
    return pd.DataFrame(rows).sort_values("total_effect_pp")


def audience(opps: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    accounts = pd.read_parquet(CLEAN / "accounts.parquet").copy()
    icp = pd.read_parquet(CLEAN / "icp_database.parquet").copy()
    accounts["domain"] = normalize_domain(accounts.get("domain__c", pd.Series("", index=accounts.index)))
    icp["domain"] = normalize_domain(icp.get("_domain", pd.Series("", index=icp.index)))
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
            rows.append({"scenario": f"{baseline:.0%} hypothetical baseline / +{lift*100:.0f}pp lift", "baseline_90d_rate": baseline, "baseline_rate": baseline, "absolute_lift": lift, "required_per_arm": per_arm, "required_total": per_arm * 2, "eligible_audience": audience_count, "feasible": feasible, "feasibility": "Feasible" if feasible else "Insufficient audience for this scenario", "assumption": "Two-sided alpha .05, power .80, equal allocation"})
    return pd.DataFrame(rows)


def build_appendix(summary: dict) -> list[dict]:
    topics = [
        ("Population and source coverage", f"The canonical non-deleted population contains {summary['opportunities']:,} opportunities, {summary['resolved']:,} resolved outcomes and {summary['won']:,} wins. CRM history spans 2018–2024; marketing logs cover 2024. Domain and timestamp eligibility must precede weekly touch normalization.", ["population_reconciliation", "source_coverage"], "opportunities.parquet; accounts.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet", "Deleted latest snapshots are excluded; short marketing windows do not measure full-history tracking completeness.", "How do populations and source windows reconcile?"),
        ("Metric definitions and unavailable denominators", "Win rate is won opportunities divided by resolved opportunities, excluding active outcomes. Recorded pipeline is the sum of source-recorded amount. Email events lack sent and delivered denominators; conditional engagement shares cannot establish delivery, open or click-through rates.", ["summary", "content_metadata_coverage", "email_content"], "opportunities.parquet; email_engagements.parquet; ad_metrics.parquet", "Zero amounts limit recorded revenue comparisons. CTR uses clicks divided by impressions; event composition is not a send-based email rate.", "Which denominators are unavailable?"),
        ("Attribution models, windows, and shared-domain sensitivity", "First touch and last touch use the earliest or latest retained weekly presence, after keeping the last eligible event per channel/week; ties share credit. This intentionally differs from first raw event; linear credit uses channel presence and time decay weights weekly presence with a 30-day half-life. Compare 30/90/180/365-day windows. Shared-domain linkage uses a normalized domain and may link multiple account opportunities.", ["attribution_model_sensitivity", "attribution_year_coverage", "attribution_overlap"], "opportunities.parquet; accounts.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet", "Filter the opportunity window before weekly compression. Shared domain does not prove a particular contact or opportunity was influenced; all allocations remain descriptive.", "How do attribution models and shared-domain linkage change interpretation?"),
        ("Conversion decomposition and loss reasons", "Compare resolved opportunity cohorts in 2022 H1 and 2024 H1. Common-support groups separate mix from within-group changes; groups absent from one period use an explicit entry or exit component. Loss reason mapping is unavailable pending a versioned rule for free text.", ["conversion_decomposition", "loss_reason_summary"], "opportunities.parquet", "Missing-period rates remain unavailable. The decomposition reconciles an observed change and does not identify a causal driver.", "How are absent-period groups and loss reasons handled?"),
        ("Targeting eligibility and sample uncertainty", f"Exclude customer, partner, competitor and private-equity accounts, active opportunity domains, non-ICP targets and conflicting or missing profiles. {summary['eligible_domains']:,} eligible domains remain. Equal allocation means 50/50 randomization. At 80% power, 5% baseline and +2pp lift require 4,426 domains, so feasibility fails for that scenario.", ["audience_exclusions", "audience_priority", "experiment_scenarios"], "accounts.parquet; icp_database.parquet; opportunities.parquet", "Baseline and lift are assumptions. Current-fit historical associations have sample uncertainty and cannot establish incremental prospect conversion. Plan one comparison before adding channel overlays.", "Is the audience large enough for the proposed test?"),
        ("Model diagnostics and limitations", "Read AUC, Brier score, calibration and false positive / false negative counts together for the time-based holdout. Training labels must resolve before the cutoff. Creation-calendar features avoid unverified latest-snapshot attributes; the baseline is exploratory and conditional on resolved outcomes within its stated horizon.", ["model_diagnostics", "model_score_bands"], "opportunities.parquet; model_stats.parquet; model_calibration.parquet; win_probability.parquet", "The supplied historical timestamps and a restricted feature set limit operating usefulness. Scores are exploratory; mature resolved-sample validation is not unconditional forecasting of active opportunities.", "What does the model actually validate?"),
    ]
    return [{"id": f"appendix-{i:02d}", "sequence": "appendix", "order": i, "title": title, "layout": "methods", "finding_ids": [], "chart_refs": refs, "metric_refs": [], "scope": "Methods and evidence boundaries", "body": body, "source_footer": sources, "visible_caveat": caveat, "speaker_notes": {"say": body, "why": f"Make {title.lower()} inspectable before using the main decision.", "do_not_claim": caveat, "transition": "Return to the main decision with this evidence boundary.", "judge_question": question, "answer": body + " " + caveat, "sources": sources.split('; ')}, "target_duration_seconds": 0} for i, (title, body, refs, sources, caveat, question) in enumerate(topics, 1)]


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
        model["band"] = score_bins(model["win_probability"])
        model_bands = model.groupby("band", observed=False).agg(active_opportunities=("_opportunity_id", "count"), mean_score=("win_probability", "mean")).reset_index()
    primary_score = scorecard[(scorecard["scope"].eq("All history")) & scorecard["business_motion"].eq("Acquisition")].sort_values("recorded_won_amount", ascending=False)
    top_channel = primary_score.iloc[0] if len(primary_score) else None
    top_bundle = bundles.sort_values("ctr", ascending=False).iloc[0] if len(bundles) else None
    summary = {"opportunities": len(opps), "resolved": int(opps["resolved"].sum()), "won": int(opps["won"].sum()), "recorded_pipeline": float(opps["amount"].sum()), "recorded_won_amount": float(opps.loc[opps["won"], "amount"].sum()), "linked_365": int(linked["_opportunity_id"].nunique()), "linked_share": pct(int(linked["_opportunity_id"].nunique()), len(opps)), "eligible_domains": eligible_total, "top_channel": str(top_channel["channel"]) if top_channel is not None else "Unavailable", "top_channel_win_rate": float(top_channel["win_rate"]) if top_channel is not None and pd.notna(top_channel["win_rate"]) else None, "bundle_label": f"{top_bundle['_copyassettype']} / {top_bundle['_copymessaging']} / {top_bundle['_copytone']}" if top_bundle is not None else "Unavailable", "bundle_ctr": float(top_bundle["ctr"]) if top_bundle is not None else None}
    findings = [
        {"id": "f-channel", "question_id": "channels", "headline": f"{summary['top_channel']} leads recorded acquisition won amount in the available CRM history", "summary": "Channel rankings describe recorded CRM outcomes. They do not estimate incremental channel value.", "evidence_status": "Observed", "metric_refs": ["summary.top_channel"], "chart_refs": ["channel_scorecard"], "source_ids": ["opportunities.parquet"], "population": "Canonical non-deleted opportunities", "period": "All available history", "caveats": ["Recorded amounts have material zero-value coverage."], "recommended_action_ids": ["r-channel"]},
        {"id": "f-content", "question_id": "content", "headline": "Creative metadata supports bundle-level hypotheses only", "summary": f"The strongest labeled bundle is {summary['bundle_label']} at {percent(summary['bundle_ctr'], 3)}, but only five ads contain complete format/message/tone labels.", "evidence_status": "Limited", "metric_refs": ["summary.bundle_ctr"], "chart_refs": ["creative_bundles"], "source_ids": ["ad_metrics.parquet"], "population": "Labeled ads only", "period": "2023–2024 ad records", "caveats": ["Format, message, tone, and CTA are confounded."], "recommended_action_ids": ["r-content"]},
        {"id": "f-attribution", "question_id": "attribution", "headline": "Touchpoint evidence is bounded by 2024 marketing-log coverage", "summary": f"{summary['linked_365']:,} opportunities link to eligible 365-day touches. The percentage is not a measure of full-history tracking completeness.", "evidence_status": "Observed", "metric_refs": ["summary.linked_share"], "chart_refs": ["attribution_overlap", "attribution_year_coverage"], "source_ids": ["email_engagements.parquet", "web_engagements.parquet", "6sense_campaign.parquet"], "population": "Canonical opportunities with usable domain/date/amount", "period": "Lookback-specific", "caveats": ["Marketing sources begin in 2024."], "recommended_action_ids": ["r-measurement"]},
        {"id": "f-audience", "question_id": "strategy", "headline": f"{eligible_total:,} explicit ICP target domains remain eligible for a controlled coverage test", "summary": "The audience excludes current customers, active opportunities, non-target accounts, and conflicting profiles.", "evidence_status": "Observed", "metric_refs": ["summary.eligible_domains"], "chart_refs": ["audience_exclusions", "audience_priority"], "source_ids": ["accounts.parquet", "icp_database.parquet", "opportunities.parquet"], "population": "Normalized account-domain universe", "period": "Current account snapshot", "caveats": ["Current fit is an association, not historical causal evidence."], "recommended_action_ids": ["r-test"]},
    ]
    recommendations = [
        {"id": "r-channel", "decision": "Maintain and measure the strongest observed acquisition channels", "audience": "Acquisition opportunities by CRM source", "channel": summary["top_channel"], "content_or_creative_bundle": "Use channel-specific creative tests", "supporting_finding_ids": ["f-channel"], "evidence_limitations": ["Observed outcomes are not causal channel effects."], "owner_role": "Demand generation lead", "immediate_next_step": "Review all-motion observed-year cohorts and classification coverage; 2024 acquisition comparison is unavailable. Use controlled tests before expansion.", "primary_success_measure": "Resolved win rate and recorded pipeline in a comparable scope", "scale_stop_rule": "Do not reallocate budget from historical ratios alone.", "confidence_status": "Observed"},
        {"id": "r-content", "decision": "Run a balanced creative-bundle test", "audience": "Eligible account campaign audience", "channel": "Paid media", "content_or_creative_bundle": "Create matched variants that isolate format, message, and tone", "supporting_finding_ids": ["f-content"], "evidence_limitations": ["Existing labeled ads confound multiple creative dimensions."], "owner_role": "Creative strategy lead", "immediate_next_step": "Run controlled variants with the same audience and delivery window.", "primary_success_measure": "Incremental qualified opportunities with account-engagement and cost guardrails; CTR is a secondary diagnostic", "scale_stop_rule": "Scale or retire only after a matched randomized test meets pre-registered qualified-outcome, quality and cost guardrails; CTR alone cannot decide.", "confidence_status": "Hypothesis"},
        {"id": "r-test", "decision": "Run a 90-day account coverage experiment", "audience": "Eligible ICP target domains", "channel": "One pre-registered email-first comparison; test overlays separately", "content_or_creative_bundle": "Pre-registered outreach package", "supporting_finding_ids": ["f-audience", "f-attribution"], "evidence_limitations": ["Reached-account figures are historical opportunity prevalence; many outcomes predate reach. They cannot serve as prospective conversion baselines."], "owner_role": "ABM lead", "immediate_next_step": "Exclude customers and active pipeline at enrollment; randomize eligible domains 50/50 within segment/fit cells, record exposure time-zero, then observe new qualified outcomes over 90 days.", "primary_success_measure": "New CRM opportunity creation within 90 days", "scale_stop_rule": "Scale only after a feasible scenario shows incremental qualified opportunities.", "confidence_status": "Hypothesis"},
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
        "Compare observed creation-date cohorts with motion-classification coverage: 2024 acquisition is unavailable because no motion is classified; neither year is asserted complete.",
        "The 2022 H1 to 2024 H1 rate change separates mix and within-group changes on common support, with group entry and exit reported separately. Neither component alone establishes cause.",
        f"Only a small labeled creative subset exists. {summary['bundle_label']} is a bundle hypothesis, not proof that one creative attribute wins.",
        "Email reports conditional engagement from supplied event logs. Web contact-page activity has an observed flag but does not prove completed acquisition.",
        "Sourced and touch-linked populations overlap. The four exclusive groups prevent adding different attribution definitions together.",
        "Attribution ranks change by model and window. Journey patterns describe linked paths before opportunity creation.",
        f"{eligible_total:,} eligible ICP target domains remain after customer, pipeline, target, and profile exclusions.",
        "Actions distinguish what to maintain, what to test, and what remains insufficiently supported.",
        "Randomize eligible domains 50/50. Measure new CRM opportunity creation after 90 days before evaluating broader commercial outcomes.",
        "A planning budget is unavailable until cost per enrolled treatment account is supplied. Choose a feasible single-comparison sample first; historical tracked spend is context.",
        "The CMO decision is to approve measurement-ready channel and creative tests, then review the resulting incrementality evidence.",
    ]
    chart_refs = [[], [], ["source_coverage"], ["motion_classification_coverage", "channel_scorecard"], ["channel_scorecard"], ["motion_classification_coverage", "channel_scorecard"], ["conversion_decomposition"], ["creative_bundles"], ["email_content", "web_content"], ["attribution_overlap"], ["attribution_model_sensitivity", "journey_outcomes"], ["audience_exclusions", "audience_priority"], ["recommendations"], ["experiment_scenarios"], ["experiment_scenarios"], ["recommendations"]]
    for index, (subject, duration, body, refs) in enumerate(zip(main_subjects, durations, bodies, chart_refs), start=1):
        slides.append({"id": f"main-{index:02d}", "sequence": "main", "order": index, "title": subject, "layout": "evidence" if refs else "statement", "finding_ids": [], "chart_refs": refs, "metric_refs": [], "scope": "Fixed analysis scope", "body": body, "source_footer": "Validated cleaned and integrated source extracts", "visible_caveat": "Read the evidence status and denominator beside each view.", "speaker_notes": {"say": body, "why": "Connect the evidence to a CMO decision.", "do_not_claim": "Do not describe observational evidence as causal lift.", "transition": "Move to the next evidence layer.", "judge_question": "What is the denominator and source window?", "answer": "The visible caption and appendix define both.", "sources": refs}, "target_duration_seconds": duration})
    slide_sources = {
        3: "opportunities.parquet; accounts.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet",
        4: "opportunities.parquet", 5: "opportunities.parquet", 6: "opportunities.parquet", 7: "opportunities.parquet",
        8: "ad_metrics.parquet", 9: "email_engagements.parquet; web_engagements.parquet",
        10: "opportunities.parquet; accounts.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet",
        11: "opportunities.parquet; accounts.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet",
        12: "accounts.parquet; icp_database.parquet; opportunities.parquet",
        14: "accounts.parquet; icp_database.parquet; opportunities.parquet", 15: "accounts.parquet; icp_database.parquet; opportunities.parquet; ad_metrics.parquet",
    }
    caveats = {
        3: "CRM history is longer than 2024 activity windows; unlinked does not mean untouched.",
        4: "CRM motion is supplied opportunity type; unknown motion remains separate.",
        5: "All-history known-motion acquisition subset, mainly older classified opportunities; unknown motion and amount completeness constrain comparison.",
        6: "Observed creation-year cohorts; classification coverage differs and 2024 acquisition is unavailable, not zero.",
        7: "Resolved 2022 H1 versus 2024 H1; absent groups use entry/exit rather than invented rates.",
        8: "Five labeled ads; creative attributes are confounded and CTR does not measure downstream causal revenue.",
        9: "Email lacks sent/delivered denominators; website session flags are not completed acquisitions.",
        10: "Four exclusive groups partition the canonical population; source and touch credit are not additive causal effects.",
        11: "Eligible pre-creation account-domain touches; models and 30/90/180/365-day windows allocate observed recorded amounts.",
        12: "Current ICP profile and explicit exclusions; historical-fit associations are exploratory.",
        14: "One two-arm comparison at alpha .05 and 80% power. Baseline/lift assumptions are hypothetical; 2,032 is below the default 4,426 requirement.",
        15: "No cost per enrolled account was supplied. No planning dollars or incremental return forecast can be established.",
    }
    for slide in slides:
        i = slide["order"]
        slide["source_footer"] = slide_sources.get(i, "opportunities.parquet; accounts.parquet; icp_database.parquet; ad_metrics.parquet; email_engagements.parquet; web_engagements.parquet; 6sense_campaign.parquet")
        slide["visible_caveat"] = caveats.get(i, "Actions follow descriptive evidence; authorize scaling only after a feasible controlled measurement plan.")
        related = {4:["f-channel"],5:["f-channel"],6:["f-channel"],7:["f-channel"],8:["f-content"],9:["f-content"],10:["f-attribution"],11:["f-attribution"],12:["f-audience"],13:["f-channel","f-content"],14:["f-audience"],15:["f-audience"],16:["f-channel","f-content","f-audience"]}
        slide["finding_ids"] = related.get(i, [])
        slide["scope"] = {8:"Supplied platform/ad observations",9:"Supplied email event and web recording activity",10:"Canonical source/touch overlap",11:"Eligible linked opportunity/channel/week presence",12:"Current account-domain eligibility",14:"Hypothetical prospective experiment",15:"Hypothetical sample and unavailable unit cost"}.get(i,"Canonical observed CRM creation cohorts; see classification coverage")
        slide["speaker_notes"]["answer"] = slide["body"] + " " + slide["visible_caveat"]
        slide["speaker_notes"]["do_not_claim"] = slide["visible_caveat"]
        slide["speaker_notes"]["sources"] = slide["source_footer"].split("; ")
    slides.extend(build_appendix(summary))
    hashes = source_hashes()
    derived_hashes = {name: hashlib.sha256((INTEGRATED / name).read_bytes()).hexdigest()[:16] for name in ["model_stats.parquet", "model_calibration.parquet", "win_probability.parquet"] if (INTEGRATED / name).exists()}
    snapshot_id = hashlib.sha256((METHOD_VERSION + json.dumps(hashes, sort_keys=True) + json.dumps(derived_hashes, sort_keys=True)).encode()).hexdigest()[:16]
    datasets = {"population_reconciliation": records(reconciliation), "source_coverage": records(coverage), "channel_scorecard": records(scorecard), "motion_classification_coverage": records(motion_coverage(opps)), "channel_trends": records(channel_trends), "content_metadata_coverage": records(metadata), "ad_rankings": records(rankings), "creative_bundles": records(bundles), "email_content": records(email_content), "web_content": records(web_content), "attribution_overlap": records(overlap), "attribution_model_sensitivity": records(sensitivity), "attribution_year_coverage": records(yearly), "journey_outcomes": records(journeys), "conversion_decomposition": records(pd.concat([channel_decomp, segment_decomp], ignore_index=True)), "loss_reason_summary": [], "audience_exclusions": records(exclusions), "audience_priority": records(priority), "experiment_scenarios": records(scenarios), "model_score_bands": records(model_bands), "model_diagnostics": records(model_stats), "summary": [summary]}
    statuses = {key: {"status": "available", "reason": "Generated from the canonical analytical population.", "source_ids": [], "population": "See dataset definition", "period": "Static snapshot"} for key in datasets}
    statuses.update({"creative_bundles": {"status": "limited", "reason": "Only five ads have complete creative metadata; dimensions are confounded.", "source_ids": ["ad_metrics.parquet"], "population": "Labeled ads", "period": "2023–2024"}, "email_content": {"status": "limited", "reason": "No sent or delivered denominators.", "source_ids": ["email_engagements.parquet"], "population": "Recorded engagement events", "period": "2024"}, "attribution_model_sensitivity": {"status": "limited", "reason": "Touchpoint sources have 2024 observation windows.", "source_ids": ["email_engagements.parquet", "web_engagements.parquet", "6sense_campaign.parquet"], "population": "Eligible linked opportunities", "period": "Lookback-specific"}, "loss_reason_summary": {"status": "unavailable", "reason": "A versioned loss-reason mapping has not been established for the supplied free text.", "source_ids": ["opportunities.parquet"], "population": "Resolved losses", "period": "All available history"}})
    for name in ["model_diagnostics", "model_score_bands"]:
        statuses[name] = {"status": "limited" if datasets[name] else "unavailable", "reason": "Exploratory calendar-only baseline, conditional on resolved outcomes and explicit temporal eligibility; not validated operating probabilities.", "source_ids": ["opportunities.parquet", "model_stats.parquet", "win_probability.parquet"], "population": "Canonical active scores or eligible mature resolved validation sample", "period": "See model diagnostics cutoff and horizon"}
    provenance = {
        "content_metadata_coverage": (["ad_metrics.parquet"], "platform/creative field", "Observed ad dates", "nonempty supplied creative labels"),
        "ad_rankings": (["ad_metrics.parquet"], "platform/ad", "Observed ad dates", "all ads; eligibility >=10000 impressions"),
        "creative_bundles": (["ad_metrics.parquet"], "platform/complete creative bundle", "Observed ad dates", "all four creative labels present"),
        "email_content": (["email_engagements.parquet"], "content title / engagement events and distinct people", "Supplied email timestamp bounds", "all recorded engagements; ID with valid email fallback"),
        "web_content": (["web_engagements.parquet"], "page group / event rows, recording IDs and visitors", "Supplied web timestamp bounds", "observed contact flag; missing status unknown"),
        "source_coverage": (["email_engagements.parquet","web_engagements.parquet","6sense_campaign.parquet"], "source/channel", "actual min_timestamp / max_timestamp", "usable explicit normalized domain and timestamp"),
        "audience_exclusions": (["accounts.parquet","icp_database.parquet","opportunities.parquet"], "normalized account domain / exclusion reason", "Current supplied snapshot", "customer/active pipeline/target/profile exclusions"),
        "audience_priority": (["accounts.parquet","icp_database.parquet","opportunities.parquet"], "segment/current fit", "Current supplied snapshot plus historical outcomes", "eligible domain counts; exploratory historical association"),
        "experiment_scenarios": (["accounts.parquet","icp_database.parquet","opportunities.parquet"], "hypothetical baseline/lift scenario", "Prospective 90-day outcome horizon", "hypothetical rates; actual eligible audience"),
    }
    for name in datasets:
        sources, grain, period, predicate = provenance.get(name, (["opportunities.parquet"], "canonical opportunity aggregates", "Observed CRM history or explicit creation cohort", "canonical latest nondeleted opportunities; see row scope"))
        if name.startswith("attribution") or name == "journey_outcomes":
            sources = ["opportunities.parquet","accounts.parquet","email_engagements.parquet","web_engagements.parquet","6sense_campaign.parquet"]
            grain, period, predicate = "model/window/channel or opportunity outcome aggregates", "30/90/180/365-day precreation windows", "eligible domain/time window before latest weekly-presence compression"
        if name.startswith("model"):
            sources = ["opportunities.parquet","model_stats.parquet","win_probability.parquet"]
            grain, period, predicate = "aggregate exploratory model diagnostics/score bins", "declared as-of cutoff and 180-day horizon", "calendar-only model; eligible mature resolved evaluation; active scores operationally unvalidated"
        statuses[name].update(source_ids=sources, grain=grain, period=period, predicate=predicate, population=grain)
    run_meta_path = ROOT / "outputs" / "run_metadata.json"
    run_metadata = json.loads(run_meta_path.read_text(encoding="utf-8")) if run_meta_path.exists() else {"status":"unavailable", "reason":"No coordinated run metadata yet"}
    run_metadata = {key: value for key, value in run_metadata.items() if key not in {"release_status", "completed_at"}}
    return {"schema_version": 3, "meta": {"title": "CMO Marketing Decision Brief", "run_metadata": run_metadata, "period": "CRM history 2018–2024; marketing logs observed in 2024", "generated_at": pd.Timestamp.now(tz="UTC"), "snapshot_id": snapshot_id, "method_version": METHOD_VERSION, "source_hashes": hashes, "derived_hashes": derived_hashes, "source_freshness": "Static analytical snapshot generated from supplied files."}, "metric_definitions": {"positional_attribution": "First/last retained latest eligible channel-week presence, not first raw event; ties share credit. Linear uses distinct channel presence; time decay sums retained weekly presence with 30-day half-life.","historical_opportunity_prevalence": "All-history opportunity-domain presence associated with supplied-window reach; not post-exposure conversion","resolved_win_rate": "won opportunities / resolved opportunities", "recorded_pipeline": "sum of source-recorded opportunity amount", "touch_linkage": "eligible pre-opportunity touches within a stated lookback; not causal lift", "email_metrics": "conditional on supplied engagement events, not sent or delivered messages"}, "datasets": datasets, "dataset_status": statuses, "findings": findings, "recommendations": recommendations, "presentation": {"target_duration_seconds": 1080, "slides": slides}, "manifest": {"case_questions": ["Customer acquisition", "Recorded revenue", "Engagement", "Channels", "Content formats", "Attribution", "Marketing strategy"], "logical_categories": ["summary", "channels", "content", "attribution", "trends", "audience", "strategy", "evidence"], "legacy_archive": "./full-analysis/"}}


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
