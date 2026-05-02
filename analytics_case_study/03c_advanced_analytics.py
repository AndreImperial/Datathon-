"""
Phase 3c: Advanced Analytics — Datathon differentiators
  1. Win Probability Model (Random Forest) — score every open deal
  2. Account Coverage Analysis — which target accounts has marketing reached?
  3. Deal Velocity by Channel — which channels close fastest?
  4. Journey Sequence Analysis — what touchpoint order leads to wins?
  5. 6QA Account Performance — do 6sense-qualified accounts convert better?
  6. Targeting Priority Matrix — segment x profile fit x win rate
  7. Cohort Analysis — pipeline health over time

Outputs:
  data/integrated/win_probability.parquet
  data/integrated/account_coverage.parquet
  data/integrated/journey_sequences.parquet
  data/integrated/deal_velocity.parquet
  outputs/analysis/advanced_analytics.xlsx
"""
import os, sys
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, ANALYSIS_DIR

# ── loaders ────────────────────────────────────────────────────────────────
def _lc(n): p=os.path.join(CLEANED_DATA_DIR,f"{n}.parquet"); return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()
def _li(n): p=os.path.join(INTEGRATED_DATA_DIR,f"{n}.parquet"); return pd.read_parquet(p) if os.path.exists(p) else pd.DataFrame()

opps  = _lc("opportunities")
accts = _lc("accounts")
email = _lc("email_engagements")
c6    = _lc("6sense_campaign")
web   = _lc("web_engagements")
icp   = _lc("icp_database")
ma    = _li("master_account")


# ============================================================
# 1. WIN PROBABILITY MODEL
# ============================================================
def build_win_probability():
    print("\n[1/7] Win Probability Model ...")
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import roc_auc_score

    # Merge opps with master account features
    ma2 = ma[["accountid","segment__c","industry","tier","accountprofilefit6sense__c",
              "account6qa6sense__c","accountintentscore6sense__c","annualrevenue",
              "numberofemployees","email_opens","email_clicks","campaign_impressions",
              "campaign_form_fills","web_goal_completions","c_level_contacts",
              "vp_contacts","director_contacts"]].copy()
    ma2 = ma2.rename(columns={"accountid":"_account_id"})

    # Only bring in columns from ma that don't already exist in opps
    new_cols = [c for c in ma2.columns if c not in opps.columns or c == "_account_id"]
    df = opps.merge(ma2[new_cols], on="_account_id", how="left")

    # Build feature list from what's actually available after merge
    CANDIDATE_FEATURES = [
        "channel_category","segment__c","industry","tier",
        "accountprofilefit6sense__c","account6qa6sense__c",
        "accountintentscore6sense__c","annualrevenue","numberofemployees",
        "email_opens","email_clicks","campaign_impressions",
        "campaign_form_fills","web_goal_completions",
        "c_level_contacts","vp_contacts","director_contacts",
        "_amount",
    ]
    FEATURES = [f for f in CANDIDATE_FEATURES if f in df.columns]
    print(f"  Features used: {FEATURES}")

    # Determine stage — closed (won or lost) vs open
    stage_col = next((c for c in df.columns if "current_stage" in c.lower()), None)
    if stage_col:
        df["is_closed"] = df[stage_col].isin(
            [s for s in df[stage_col].dropna().unique()
             if any(x in str(s).lower() for x in ["closed","won","lost"])]
        )
    else:
        df["is_closed"] = True  # treat all as closed if no stage

    closed = df[df["is_closed"]].copy()
    open_  = df[~df["is_closed"]].copy()
    print(f"  Closed deals (train): {len(closed):,}  |  Open deals (score): {len(open_):,}")

    X_raw = closed[FEATURES].copy()
    y     = (closed["iswon"] == True).astype(int)

    # Encode & impute
    le_map = {}
    cat_cols = ["channel_category","segment__c","industry","tier",
                "accountprofilefit6sense__c"]
    for c in cat_cols:
        if c in X_raw.columns:
            X_raw[c] = X_raw[c].fillna("Unknown").astype(str)
            le = LabelEncoder()
            X_raw[c] = le.fit_transform(X_raw[c])
            le_map[c] = le

    bool_cols = ["account6qa6sense__c"]
    for c in bool_cols:
        if c in X_raw.columns:
            X_raw[c] = X_raw[c].map({True:1,False:0}).fillna(0)

    num_cols = [c for c in FEATURES if c not in cat_cols + bool_cols]
    for c in num_cols:
        if c in X_raw.columns:
            X_raw[c] = pd.to_numeric(X_raw[c], errors="coerce").fillna(0)

    X = X_raw.values

    rf = RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=5,
                                random_state=42, n_jobs=-1)
    auc_scores = cross_val_score(rf, X, y, cv=5, scoring="roc_auc")
    print(f"  Model AUC (5-fold CV): {auc_scores.mean():.3f} +/- {auc_scores.std():.3f}")

    rf.fit(X, y)

    # Feature importance
    feat_imp = pd.DataFrame({
        "feature": FEATURES,
        "importance": rf.feature_importances_,
    }).sort_values("importance", ascending=False)
    print("  Top 10 win predictors:")
    for _, r in feat_imp.head(10).iterrows():
        print(f"    {r['feature']:40s}: {r['importance']:.4f}")

    # Score closed deals (show calibration)
    closed["win_probability"] = rf.predict_proba(X)[:,1]
    closed["predicted_win"] = (closed["win_probability"] >= 0.5).astype(int)
    acc = (closed["predicted_win"] == y.values).mean()
    print(f"  Accuracy on training set: {acc:.1%}")

    # Score open deals
    open_scored = pd.DataFrame()
    if len(open_) > 0:
        X_open_raw = open_[FEATURES].copy()
        for c in cat_cols:
            if c in X_open_raw.columns:
                X_open_raw[c] = X_open_raw[c].fillna("Unknown").astype(str)
                le = le_map.get(c)
                if le:
                    known = set(le.classes_)
                    X_open_raw[c] = X_open_raw[c].apply(lambda v: v if v in known else "Unknown")
                    if "Unknown" not in known:
                        X_open_raw[c] = X_open_raw[c].apply(lambda v: le.classes_[0] if v not in known else v)
                    X_open_raw[c] = le.transform(X_open_raw[c])
        for c in bool_cols:
            if c in X_open_raw.columns:
                X_open_raw[c] = X_open_raw[c].map({True:1,False:0}).fillna(0)
        for c in num_cols:
            if c in X_open_raw.columns:
                X_open_raw[c] = pd.to_numeric(X_open_raw[c], errors="coerce").fillna(0)
        open_["win_probability"] = rf.predict_proba(X_open_raw.values)[:,1]
        open_scored = open_[["_opportunity_id","_account_name","_amount","channel_category",
                              "segment__c","win_probability"]].copy()
        open_scored = open_scored.sort_values("win_probability", ascending=False)
        print(f"  Top 5 open deals by win probability:")
        for _, r in open_scored.head(5).iterrows():
            print(f"    {str(r['_account_name'])[:35]:35s}  prob={r['win_probability']:.0%}  amt=${r['_amount']:,.0f}")
    else:
        # All deals closed — show distribution on full dataset
        closed_show = closed[["_opportunity_id","_account_name","_amount","channel_category",
                               "segment__c","win_probability","iswon"]].copy()
        open_scored = closed_show

    feat_imp.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "feature_importance.parquet"), index=False)
    out = open_scored if len(open_) > 0 else closed[["_opportunity_id","_account_name","_amount",
          "channel_category","segment__c","win_probability","iswon"]].copy()
    out.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "win_probability.parquet"), index=False)
    return feat_imp, out, {"auc": float(auc_scores.mean()), "accuracy": float(acc)}


# ============================================================
# 2. ACCOUNT COVERAGE ANALYSIS
# ============================================================
def build_account_coverage():
    print("\n[2/7] Account Coverage Analysis ...")
    acct_domains = set(accts["domain__c"].dropna().str.lower().str.strip())
    email_domains = set(email["_domain"].dropna().str.lower().str.strip())
    c6_domains    = set(c6["_6sensedomain"].dropna().str.lower().str.strip())
    opp_domains   = set(opps["_domain"].dropna().str.lower().str.strip())

    rows = []
    for domain in acct_domains:
        row = {
            "domain": domain,
            "in_email": domain in email_domains,
            "in_6sense": domain in c6_domains,
            "has_opportunity": domain in opp_domains,
        }
        row["reached_count"] = int(row["in_email"]) + int(row["in_6sense"])
        row["coverage_tier"] = (
            "Both Channels" if row["in_email"] and row["in_6sense"] else
            "Email Only"    if row["in_email"] else
            "6sense Only"   if row["in_6sense"] else
            "Not Reached"
        )
        rows.append(row)

    cov = pd.DataFrame(rows)

    total = len(cov)
    summary = cov.groupby("coverage_tier").agg(
        accounts=("domain","count"),
        with_opp=("has_opportunity","sum"),
    ).reset_index()
    summary["pct_of_total"] = summary["accounts"] / total
    summary["opp_rate"] = summary["with_opp"] / summary["accounts"]

    print(f"  Total account domains: {total:,}")
    for _, r in summary.sort_values("accounts", ascending=False).iterrows():
        print(f"    {r['coverage_tier']:20s}: {int(r['accounts']):5,} ({r['pct_of_total']:.1%})  opp_rate={r['opp_rate']:.1%}")

    cov.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "account_coverage.parquet"), index=False)
    return cov, summary


# ============================================================
# 3. DEAL VELOCITY BY CHANNEL
# ============================================================
def build_deal_velocity():
    print("\n[3/7] Deal Velocity Analysis ...")
    df = opps.copy()
    create_col = next((c for c in df.columns if "createdate" in c.lower()), None)
    close_col  = "_close_date" if "_close_date" in df.columns else None

    if not create_col or not close_col:
        print("  Missing date columns — skipping")
        return pd.DataFrame()

    df["_create"] = pd.to_datetime(df[create_col], errors="coerce", utc=True)
    df["_close"]  = pd.to_datetime(df[close_col],  errors="coerce", utc=True)
    df["days_to_close"] = (df["_close"] - df["_create"]).dt.days

    # Won deals only for velocity (lost deals have arbitrary close dates)
    won = df[(df["iswon"]==True) & df["days_to_close"].between(1, 730)].copy()

    vel = won.groupby("channel_category")["days_to_close"].agg(
        mean_days="mean", median_days="median", deal_count="count",
        p25=lambda x: x.quantile(0.25), p75=lambda x: x.quantile(0.75)
    ).reset_index().sort_values("median_days")

    print("  Won deal velocity by channel (median days to close):")
    for _, r in vel.iterrows():
        bar = "=" * int(r["median_days"] / 3)
        print(f"    {r['channel_category']:20s}: {r['median_days']:5.0f} days median  (n={int(r['deal_count'])})")

    # Also compute by segment
    seg_vel = won.dropna(subset=["segment__c"]).groupby("segment__c")["days_to_close"].agg(
        mean_days="mean", median_days="median", deal_count="count"
    ).reset_index().sort_values("median_days")
    print("  Won deal velocity by segment (median days):")
    for _, r in seg_vel.iterrows():
        print(f"    {r['segment__c']:15s}: {r['median_days']:5.0f} days  (n={int(r['deal_count'])})")

    vel.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "deal_velocity.parquet"), index=False)
    return vel


# ============================================================
# 4. JOURNEY SEQUENCE ANALYSIS
# ============================================================
def build_journey_sequences():
    print("\n[4/7] Journey Sequence Analysis ...")

    # Build minimal touchpoint table (reuse logic from 03b)
    rows = []

    if "_6sensedomain" in c6.columns and "_date" in c6.columns:
        c6_tmp = c6.copy()
        c6_tmp["tp_date"] = pd.to_datetime(
            c6_tmp.get("_latestimpression", c6_tmp["_date"]), utc=True, errors="coerce"
        ).fillna(pd.to_datetime(c6_tmp["_date"], utc=True, errors="coerce"))
        for _, row in c6_tmp.dropna(subset=["_6sensedomain","tp_date"]).iterrows():
            rows.append({"domain": row["_6sensedomain"], "tp_date": row["tp_date"], "channel": "6sense_display"})

    if "_domain" in email.columns and "_timestamp" in email.columns:
        em = email.dropna(subset=["_domain","_timestamp"]).copy()
        em["tp_date"] = pd.to_datetime(em["_timestamp"], utc=True, errors="coerce")
        for _, row in em.dropna(subset=["tp_date"]).iterrows():
            rows.append({"domain": row["_domain"], "tp_date": row["tp_date"], "channel": "email_mqa"})

    tp = pd.DataFrame(rows)
    if tp.empty:
        print("  No touchpoints built.")
        return pd.DataFrame()

    tp["tp_date"] = pd.to_datetime(tp["tp_date"], utc=True, errors="coerce")

    # Link to won opportunities
    opp_date_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    won_opps = opps[(opps["iswon"]==True) & opps["_domain"].notna()].copy()
    if opp_date_col:
        won_opps["_opp_date"] = pd.to_datetime(won_opps[opp_date_col], utc=True, errors="coerce")

    # For each won opp, find ordered channel sequence
    sequences = []
    for _, opp in won_opps.iterrows():
        d = str(opp["_domain"]).lower().strip()
        opp_date = opp.get("_opp_date")
        touches = tp[
            (tp["domain"].str.lower().str.strip() == d) &
            (tp["tp_date"] <= opp_date if pd.notna(opp_date) else True)
        ].sort_values("tp_date")
        if len(touches) == 0:
            continue
        # Get unique ordered channel sequence (deduplicate consecutive same channel)
        chans = touches["channel"].tolist()
        deduped = [chans[0]] + [chans[i] for i in range(1,len(chans)) if chans[i] != chans[i-1]]
        sequences.append({
            "opp_id": opp["_opportunity_id"],
            "amount": opp["_amount"],
            "n_touches": len(touches),
            "n_channels": len(set(chans)),
            "first_channel": deduped[0],
            "last_channel": deduped[-1],
            "sequence": " -> ".join(deduped[:5]),  # first 5 steps
            "sequence_2ch": " -> ".join(deduped[:2]) if len(deduped) >= 2 else deduped[0],
        })

    seq_df = pd.DataFrame(sequences)
    if seq_df.empty:
        print("  No sequences built.")
        return pd.DataFrame()

    print(f"  Won deals with touchpoint sequences: {len(seq_df):,}")
    top_seqs = seq_df.groupby("sequence_2ch").agg(
        deals=("opp_id","count"),
        pipeline=("amount","sum"),
    ).sort_values("deals", ascending=False).head(10).reset_index()
    print("  Top winning 2-channel sequences:")
    for _, r in top_seqs.iterrows():
        print(f"    {r['sequence_2ch']:35s}: {int(r['deals'])} deals  ${r['pipeline']:,.0f}")

    first_ch = seq_df["first_channel"].value_counts().reset_index()
    first_ch.columns = ["channel","count"]
    print("  First touch for won deals:")
    for _, r in first_ch.iterrows():
        print(f"    {r['channel']:20s}: {int(r['count'])} deals")

    seq_df.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "journey_sequences.parquet"), index=False)
    return seq_df, top_seqs


# ============================================================
# 5. 6QA ACCOUNT PERFORMANCE
# ============================================================
def build_6qa_analysis():
    print("\n[5/7] 6QA Account Performance ...")

    qa_col = "account6qa6sense__c"
    pf_col = "accountprofilefit6sense__c"

    if qa_col not in opps.columns:
        # Join from accounts
        if qa_col in accts.columns and "_account_id" in opps.columns and "accountid" in accts.columns:
            opps_qa = opps.merge(
                accts[["accountid", qa_col, pf_col, "accountintentscore6sense__c"]].rename(
                    columns={"accountid":"_account_id"}),
                on="_account_id", how="left"
            )
        else:
            print("  Cannot join 6QA data — skipping")
            return pd.DataFrame()
    else:
        opps_qa = opps.copy()

    if qa_col not in opps_qa.columns:
        print("  6QA column not found")
        return pd.DataFrame()

    opps_qa[qa_col] = opps_qa[qa_col].map({True:True, False:False, "True":True, "False":False})

    qa_perf = opps_qa.groupby(qa_col).agg(
        deals=("_opportunity_id","count"),
        won=("iswon", lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        won_pipeline=("_amount", lambda x: x[(opps_qa.loc[x.index,"iswon"]==True)].sum()),
        avg_deal=("_amount","mean"),
    ).reset_index()
    qa_perf["win_rate"] = qa_perf["won"] / qa_perf["deals"]
    qa_perf.columns = ["is_6qa","deals","won","pipeline","won_pipeline","avg_deal","win_rate"]

    print("  6QA vs Non-6QA performance:")
    for _, r in qa_perf.iterrows():
        label = "6QA Accounts" if r["is_6qa"] else "Non-6QA"
        print(f"    {label:15s}: deals={int(r['deals']):4d}  win_rate={r['win_rate']:.1%}  pipeline=${r['pipeline']:>12,.0f}")

    # Profile Fit analysis
    if pf_col in opps_qa.columns:
        pf_perf = opps_qa.dropna(subset=[pf_col]).groupby(pf_col).agg(
            deals=("_opportunity_id","count"),
            won=("iswon", lambda x: (x==True).sum()),
            pipeline=("_amount","sum"),
            avg_deal=("_amount","mean"),
        ).reset_index()
        pf_perf["win_rate"] = pf_perf["won"] / pf_perf["deals"]
        print("  Profile Fit performance:")
        for _, r in pf_perf.sort_values("win_rate", ascending=False).iterrows():
            print(f"    {str(r[pf_col]):10s}: deals={int(r['deals']):4d}  win_rate={r['win_rate']:.1%}  pipeline=${r['pipeline']:>12,.0f}")

    qa_perf.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "qa_performance.parquet"), index=False)
    return qa_perf


# ============================================================
# 6. TARGETING PRIORITY MATRIX
# ============================================================
def build_targeting_matrix():
    print("\n[6/7] Targeting Priority Matrix ...")

    pf_col = "accountprofilefit6sense__c"
    # Join profile fit if not on opps
    if pf_col not in opps.columns:
        opps_m = opps.merge(
            accts[["accountid", pf_col]].rename(columns={"accountid":"_account_id"}),
            on="_account_id", how="left"
        )
    else:
        opps_m = opps.copy()

    needed = ["segment__c", pf_col, "_amount", "iswon"]
    if not all(c in opps_m.columns for c in needed):
        print("  Missing columns — skipping")
        return pd.DataFrame()

    df = opps_m.dropna(subset=["segment__c", pf_col]).copy()
    matrix = df.groupby(["segment__c", pf_col]).agg(
        deals=("_opportunity_id","count"),
        won=("iswon", lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        avg_deal=("_amount","mean"),
    ).reset_index()
    matrix["win_rate"] = matrix["won"] / matrix["deals"]
    matrix["priority_score"] = matrix["win_rate"] * matrix["avg_deal"] / 1000

    print("  Targeting Priority Matrix (Segment x Profile Fit):")
    print(f"  {'Segment':15s} {'Profile':10s} {'Deals':6s} {'Win%':6s} {'Avg Deal':10s} {'Priority':8s}")
    for _, r in matrix.sort_values("priority_score", ascending=False).head(12).iterrows():
        print(f"  {str(r['segment__c']):15s} {str(r[pf_col]):10s} {int(r['deals']):6d} {r['win_rate']:5.0%} ${r['avg_deal']:>9,.0f} {r['priority_score']:8.1f}")

    matrix.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "targeting_matrix.parquet"), index=False)
    return matrix


# ============================================================
# 7. COHORT ANALYSIS
# ============================================================
def build_cohort_analysis():
    print("\n[7/7] Cohort Analysis ...")
    create_col = next((c for c in opps.columns if "createdate" in c.lower()), None)
    if not create_col:
        print("  No create date — skipping")
        return pd.DataFrame()

    df = opps.copy()
    df["create_date"] = pd.to_datetime(df[create_col], errors="coerce", utc=True)
    df["quarter"] = df["create_date"].dt.to_period("Q").astype(str)

    cohort = df.dropna(subset=["quarter","_amount"]).groupby("quarter").agg(
        deals=("_opportunity_id","count"),
        won=("iswon", lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        won_pipeline=("_amount", lambda x: x[(df.loc[x.index,"iswon"]==True)].sum()),
        avg_deal=("_amount","mean"),
        marketing_sourced=("is_marketing_sourced", "sum"),
    ).reset_index()
    cohort["win_rate"] = cohort["won"] / cohort["deals"]
    cohort["mktg_pct"] = cohort["marketing_sourced"] / cohort["deals"]

    print("  Pipeline created by quarter:")
    for _, r in cohort.tail(12).iterrows():
        print(f"    {r['quarter']}: deals={int(r['deals']):4d}  pipeline=${r['pipeline']:>10,.0f}  win_rate={r['win_rate']:.0%}  mktg%={r['mktg_pct']:.0%}")

    cohort.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "cohort_analysis.parquet"), index=False)
    return cohort


# ============================================================
# MAIN
# ============================================================
def main():
    os.makedirs(INTEGRATED_DATA_DIR, exist_ok=True)
    os.makedirs(ANALYSIS_DIR, exist_ok=True)

    print("=" * 60)
    print("Phase 3c: Advanced Analytics")
    print("=" * 60)

    results = {}

    feat_imp, win_prob, model_stats = build_win_probability()
    results["feature_importance"] = feat_imp
    results["win_probability_top"] = win_prob.head(20) if "win_probability" in win_prob.columns else win_prob.head(20)

    cov_df, cov_summary = build_account_coverage()
    results["account_coverage"] = cov_summary

    vel = build_deal_velocity()
    if not vel.empty:
        results["deal_velocity"] = vel

    seq_result = build_journey_sequences()
    if isinstance(seq_result, tuple):
        seq_df, top_seqs = seq_result
        results["journey_sequences"] = top_seqs
    else:
        seq_df = seq_result

    qa = build_6qa_analysis()
    if not qa.empty:
        results["6qa_performance"] = qa

    matrix = build_targeting_matrix()
    if not matrix.empty:
        results["targeting_matrix"] = matrix.sort_values("priority_score", ascending=False)

    cohort = build_cohort_analysis()
    if not cohort.empty:
        results["cohort_analysis"] = cohort

    # Write Excel
    out_path = os.path.join(ANALYSIS_DIR, "advanced_analytics.xlsx")
    with pd.ExcelWriter(out_path, engine="xlsxwriter") as writer:
        for sheet_name, df in results.items():
            df.to_excel(writer, sheet_name=sheet_name[:31], index=False)
    print(f"\nOK Saved -> {out_path}")
    print(f"   Model AUC: {model_stats['auc']:.3f} | Accuracy: {model_stats['accuracy']:.1%}")
    print("\nOK Advanced analytics complete")


if __name__ == "__main__":
    main()
