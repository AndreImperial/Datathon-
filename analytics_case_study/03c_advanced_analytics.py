"""
Phase 3c: Advanced Analytics — decision-grade extensions
  1. Leakage-controlled win model — evaluate resolved outcomes, score active deals
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
  data/integrated/model_stats.parquet
  data/integrated/targeting_matrix.parquet
  data/integrated/cohort_analysis.parquet
  outputs/analysis/advanced_analytics.xlsx
"""
import os, sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from analytics_case_study.config import CLEANED_DATA_DIR, INTEGRATED_DATA_DIR, ANALYSIS_DIR
from analytics_case_study.utils.metrics import resolved_stage_mask, wilson_interval

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


def _won_col(df):
    if "iswon" in df.columns:
        return "iswon"
    if "_iswon" in df.columns:
        return "_iswon"
    return None


def _account_domain_lookup():
    if accts.empty or "accountid" not in accts.columns or "domain__c" not in accts.columns:
        return {}
    return accts.dropna(subset=["accountid"]).set_index("accountid")["domain__c"].to_dict()


def _opportunities_with_domain(df):
    if df.empty:
        return df.copy()
    out = df.copy()
    acct_domain = _account_domain_lookup()

    def resolve(row):
        if "_domain" in out.columns and pd.notna(row.get("_domain")):
            d = str(row.get("_domain")).strip().lower()
            if d and d != "nan":
                return d
        acct_id = row.get("_account_id")
        d = acct_domain.get(str(acct_id), acct_domain.get(acct_id, ""))
        return str(d).strip().lower() if pd.notna(d) and str(d).strip() else np.nan

    out["opp_domain"] = out.apply(resolve, axis=1)
    return out


# ============================================================
# 1. WIN PROBABILITY MODEL
# ============================================================
def build_win_probability():
    """Train a leakage-reduced, time-validated model and score active deals.

    The model intentionally excludes current account intent, contact-count, and
    current-stage fields because the supplied account table is a present-day
    snapshot.  Those fields may have been populated after an historical deal
    closed and would create look-ahead bias.
    """
    print("\n[1/7] Win Probability Model (leakage-reduced) ...")
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.metrics import (
        accuracy_score,
        brier_score_loss,
        confusion_matrix,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    df = opps.copy()
    stage_col = next((c for c in df.columns if "current_stage" in c.lower()), None)
    create_col = next((c for c in df.columns if "createdate" in c.lower()), None)
    won_col = _won_col(df)
    if not stage_col or not create_col or not won_col:
        print("  Required stage, create-date, or won fields are unavailable - skipping")
        return pd.DataFrame(), pd.DataFrame(), {"auc": np.nan, "accuracy": np.nan, "validation": "not run"}

    df["_model_create_date"] = pd.to_datetime(df[create_col], utc=True, errors="coerce")
    df["create_year"] = df["_model_create_date"].dt.year
    df["create_quarter"] = df["_model_create_date"].dt.quarter
    df["is_resolved"] = resolved_stage_mask(df[stage_col])
    closed = df[df["is_resolved"] & df["_model_create_date"].notna()].sort_values("_model_create_date").copy()
    active = df[~df["is_resolved"]].copy()
    print(f"  Resolved deals (train/evaluate): {len(closed):,}  |  Active deals (score): {len(active):,}")

    categorical = [c for c in ["channel_category", "segment__c"] if c in closed.columns]
    numeric = [c for c in ["_amount", "create_year", "create_quarter"] if c in closed.columns]
    features = categorical + numeric
    y = closed[won_col].eq(True).astype(int)
    if not features or y.nunique() != 2 or len(closed) < 200:
        print("  Insufficient resolved outcomes for a stable time holdout - skipping")
        return pd.DataFrame(), pd.DataFrame(), {"auc": np.nan, "accuracy": np.nan, "validation": "not run"}

    cutoff = int(len(closed) * 0.80)
    train = closed.iloc[:cutoff].copy()
    test = closed.iloc[cutoff:].copy()
    y_train = train[won_col].eq(True).astype(int)
    y_test = test[won_col].eq(True).astype(int)
    if y_train.nunique() != 2 or y_test.nunique() != 2:
        print("  Time holdout does not contain both outcomes - skipping")
        return pd.DataFrame(), pd.DataFrame(), {"auc": np.nan, "accuracy": np.nan, "validation": "not run"}

    transformers = []
    if categorical:
        transformers.append((
            "categorical",
            Pipeline([
                ("impute", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]),
            categorical,
        ))
    if numeric:
        transformers.append((
            "numeric",
            Pipeline([("impute", SimpleImputer(strategy="median"))]),
            numeric,
        ))
    preprocess = ColumnTransformer(transformers=transformers)
    classifier = RandomForestClassifier(
        n_estimators=400,
        max_depth=8,
        min_samples_leaf=10,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1,
    )
    model = Pipeline([("preprocess", preprocess), ("classifier", classifier)])
    model.fit(train[features], y_train)
    test_prob = model.predict_proba(test[features])[:, 1]
    test_pred = test_prob >= 0.50
    auc = float(roc_auc_score(y_test, test_prob))
    accuracy = float(accuracy_score(y_test, test_pred))
    precision = float(precision_score(y_test, test_pred, zero_division=0))
    recall = float(recall_score(y_test, test_pred, zero_division=0))
    brier = float(brier_score_loss(y_test, test_prob))
    tn, fp, fn, tp = confusion_matrix(y_test, test_pred, labels=[0, 1]).ravel()
    print(f"  Time-based holdout AUC: {auc:.3f} | Brier: {brier:.3f} | precision: {precision:.1%} | recall: {recall:.1%}")

    # Fit the deployable scoring model on all resolved outcomes only after the
    # out-of-time evaluation has been recorded.
    model.fit(closed[features], y)
    transformed_names = model.named_steps["preprocess"].get_feature_names_out()
    raw_importance = model.named_steps["classifier"].feature_importances_
    importance_rows = []
    for name, importance in zip(transformed_names, raw_importance):
        stripped = name.split("__", 1)[-1]
        original = next((c for c in categorical if stripped.startswith(f"{c}_")), stripped)
        importance_rows.append({"feature": original, "importance": float(importance)})
    feat_imp = (
        pd.DataFrame(importance_rows)
        .groupby("feature", as_index=False)["importance"].sum()
        .sort_values("importance", ascending=False)
    )

    active_scored = active[[
        c for c in ["_opportunity_id", "_account_name", stage_col, "_amount", "channel_category", "segment__c"]
        if c in active.columns
    ]].copy()
    if len(active):
        active_scored["win_probability"] = model.predict_proba(active[features])[:, 1]
        active_scored["amount_quality"] = np.where(active["_amount"].fillna(0).gt(0), "positive amount", "zero/missing amount")
        active_scored = active_scored.sort_values(["win_probability", "_amount"], ascending=[False, False])

    feat_imp.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "feature_importance.parquet"), index=False)
    active_scored.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "win_probability.parquet"), index=False)
    diagnostics = {
        "auc": auc,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "brier_score": brier,
        "true_negative": int(tn),
        "false_positive": int(fp),
        "false_negative": int(fn),
        "true_positive": int(tp),
        "train_rows": len(train),
        "test_rows": len(test),
        "train_win_rate": float(y_train.mean()),
        "test_win_rate": float(y_test.mean()),
        "active_scored_rows": len(active_scored),
        "validation": "time-based 80/20 holdout; preprocessing fit on train only",
        "feature_policy": "opportunity-time fields only; present-day account snapshot fields excluded",
    }
    return feat_imp, active_scored, diagnostics


# ============================================================
# 2. ACCOUNT COVERAGE ANALYSIS
# ============================================================
def build_account_coverage():
    print("\n[2/7] Account Coverage Analysis ...")
    acct_domains = set(accts["domain__c"].dropna().str.lower().str.strip()) if "domain__c" in accts.columns else set()
    email_domains = set(email["_domain"].dropna().str.lower().str.strip()) if "_domain" in email.columns else set()
    c6_domains    = set(c6["_6sensedomain"].dropna().str.lower().str.strip()) if "_6sensedomain" in c6.columns else set()
    opps_d = _opportunities_with_domain(opps)
    opp_domains = set(opps_d["opp_domain"].dropna().str.lower().str.strip()) if "opp_domain" in opps_d.columns else set()

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
    intervals = summary.apply(
        lambda row: wilson_interval(int(row["with_opp"]), int(row["accounts"])),
        axis=1,
    )
    summary["opp_rate_ci_low"] = [interval[0] for interval in intervals]
    summary["opp_rate_ci_high"] = [interval[1] for interval in intervals]
    summary["interpretation"] = "Observed association; coverage groups were not randomized."

    print(f"  Total account domains: {total:,}")
    for _, r in summary.sort_values("accounts", ascending=False).iterrows():
        print(f"    {r['coverage_tier']:20s}: {int(r['accounts']):5,} ({r['pct_of_total']:.1%})  opp_rate={r['opp_rate']:.1%}")

    cov.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "account_coverage.parquet"), index=False)
    summary.to_parquet(os.path.join(INTEGRATED_DATA_DIR, "account_coverage_summary.parquet"), index=False)
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
    won_col = _won_col(df)
    if not won_col:
        print("  Missing won flag — skipping")
        return pd.DataFrame()
    won = df[(df[won_col]==True) & df["days_to_close"].between(1, 730)].copy()

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
    opps_d = _opportunities_with_domain(opps)
    won_col = _won_col(opps_d)
    if not won_col or "opp_domain" not in opps_d.columns:
        print("  Missing won flag or opportunity domain — skipping")
        return pd.DataFrame()
    won_opps = opps_d[(opps_d[won_col]==True) & opps_d["opp_domain"].notna()].copy()
    if opp_date_col:
        won_opps["_opp_date"] = pd.to_datetime(won_opps[opp_date_col], utc=True, errors="coerce")

    # For each won opp, find ordered channel sequence
    sequences = []
    for _, opp in won_opps.iterrows():
        d = str(opp["opp_domain"]).lower().strip()
        opp_date = opp.get("_opp_date")
        if pd.notna(opp_date):
            touches = tp[
                (tp["domain"].str.lower().str.strip() == d) &
                (tp["tp_date"] <= opp_date)
            ].sort_values("tp_date")
        else:
            touches = tp[
                tp["domain"].str.lower().str.strip() == d
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
            account_cols = [c for c in ["accountid", qa_col, pf_col, "accountintentscore6sense__c"] if c in accts.columns]
            opps_qa = opps.merge(
                accts[account_cols].rename(
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
    won_col = _won_col(opps_qa)
    if not won_col:
        print("  Missing won flag — skipping")
        return pd.DataFrame()

    bool_map = {
        True: True, False: False,
        "True": True, "False": False, "true": True, "false": False,
        "1": True, "0": False, "yes": True, "no": False,
        1: True, 0: False,
    }
    opps_qa[qa_col] = opps_qa[qa_col].map(bool_map)
    stage_col = next((c for c in opps_qa.columns if "current_stage" in c.lower()), None)
    resolved_qa = opps_qa[resolved_stage_mask(opps_qa[stage_col])].copy() if stage_col else opps_qa.copy()
    resolved_qa["_won_amount"] = np.where(resolved_qa[won_col] == True, resolved_qa["_amount"], 0)

    qa_perf = resolved_qa.groupby(qa_col).agg(
        deals=("_opportunity_id","count"),
        won=(won_col, lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        won_pipeline=("_won_amount","sum"),
        avg_deal=("_amount","mean"),
    ).reset_index()
    qa_perf["win_rate"] = qa_perf["won"] / qa_perf["deals"]
    qa_perf.columns = ["is_6qa","deals","won","pipeline","won_pipeline","avg_deal","win_rate"]

    print("  6QA vs Non-6QA performance:")
    for _, r in qa_perf.iterrows():
        label = "6QA Accounts" if r["is_6qa"] else "Non-6QA"
        print(f"    {label:15s}: deals={int(r['deals']):4d}  win_rate={r['win_rate']:.1%}  pipeline=${r['pipeline']:>12,.0f}")

    # Profile Fit analysis
    if pf_col in resolved_qa.columns:
        pf_perf = resolved_qa.dropna(subset=[pf_col]).groupby(pf_col).agg(
            deals=("_opportunity_id","count"),
            won=(won_col, lambda x: (x==True).sum()),
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
        if pf_col in accts.columns and "_account_id" in opps.columns and "accountid" in accts.columns:
            opps_m = opps.merge(
                accts[["accountid", pf_col]].rename(columns={"accountid":"_account_id"}),
                on="_account_id", how="left"
            )
        else:
            print("  Missing profile fit column — skipping")
            return pd.DataFrame()
    else:
        opps_m = opps.copy()

    won_col = _won_col(opps_m)
    needed = ["segment__c", pf_col, "_amount"]
    if not all(c in opps_m.columns for c in needed):
        print("  Missing columns — skipping")
        return pd.DataFrame()
    if not won_col:
        print("  Missing won flag — skipping")
        return pd.DataFrame()

    df = opps_m.dropna(subset=["segment__c", pf_col]).copy()
    stage_col = next((c for c in df.columns if "current_stage" in c.lower()), None)
    df["is_resolved"] = resolved_stage_mask(df[stage_col]) if stage_col else True
    totals = df.groupby(["segment__c", pf_col]).agg(
        total_deals=("_opportunity_id", "count"),
        active_deals=("is_resolved", lambda x: (~x).sum()),
    ).reset_index()
    resolved = df[df["is_resolved"]].copy()
    resolved["positive_amount"] = resolved["_amount"].where(resolved["_amount"] > 0)
    matrix = resolved.groupby(["segment__c", pf_col]).agg(
        resolved_deals=("_opportunity_id","count"),
        won=(won_col, lambda x: (x==True).sum()),
        pipeline=("_amount","sum"),
        avg_deal=("_amount","mean"),
        positive_median_deal=("positive_amount", "median"),
    ).reset_index().merge(totals, on=["segment__c", pf_col], how="left")
    matrix["deals"] = matrix["resolved_deals"]  # backwards-compatible display field
    matrix["win_rate"] = matrix["won"] / matrix["resolved_deals"].replace(0, np.nan)
    global_rate = resolved[won_col].eq(True).mean()
    prior_strength = 30
    matrix["adjusted_win_rate"] = (
        matrix["won"] + global_rate * prior_strength
    ) / (matrix["resolved_deals"] + prior_strength)
    intervals = matrix.apply(
        lambda row: wilson_interval(int(row["won"]), int(row["resolved_deals"])),
        axis=1,
    )
    matrix["win_rate_ci_low"] = [interval[0] for interval in intervals]
    matrix["win_rate_ci_high"] = [interval[1] for interval in intervals]
    matrix["evidence_tier"] = np.where(matrix["resolved_deals"] >= 30, "decision-grade", "exploratory")
    matrix["priority_score"] = matrix["adjusted_win_rate"] * matrix["positive_median_deal"].fillna(0) / 1000

    print("  Targeting Priority Matrix (Segment x Profile Fit):")
    print(f"  {'Segment':15s} {'Profile':10s} {'Resolved':8s} {'Win%':6s} {'Pos Med':10s} {'Priority':8s}")
    for _, r in matrix.sort_values("priority_score", ascending=False).head(12).iterrows():
        print(f"  {str(r['segment__c']):15s} {str(r[pf_col]):10s} {int(r['resolved_deals']):6d} {r['win_rate']:5.0%} ${r['positive_median_deal']:>9,.0f} {r['priority_score']:8.1f}")

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
    won_col = _won_col(df)
    if not won_col:
        print("  Missing won flag — skipping")
        return pd.DataFrame()
    df["create_date"] = pd.to_datetime(df[create_col], errors="coerce", utc=True)
    df["quarter"] = df["create_date"].dt.tz_convert(None).dt.to_period("Q").astype(str)
    stage_col = next((c for c in df.columns if "current_stage" in c.lower()), None)
    df["is_resolved"] = resolved_stage_mask(df[stage_col]) if stage_col else True
    df["is_won"] = df[won_col].eq(True)
    df["won_amount"] = np.where(df["is_won"], df["_amount"].fillna(0), 0)

    cohort = df.dropna(subset=["create_date"]).groupby("quarter").agg(
        deals=("_opportunity_id","count"),
        resolved=("is_resolved", "sum"),
        won=("is_won", "sum"),
        pipeline=("_amount","sum"),
        won_pipeline=("won_amount", "sum"),
        avg_deal=("_amount","mean"),
        marketing_sourced=("is_marketing_sourced", "sum"),
    ).reset_index()
    cohort["naive_win_rate"] = cohort["won"] / cohort["deals"].replace(0, np.nan)
    cohort["closed_win_rate"] = cohort["won"] / cohort["resolved"].replace(0, np.nan)
    cohort["win_rate"] = cohort["closed_win_rate"]  # canonical quality metric
    cohort["resolved_share"] = cohort["resolved"] / cohort["deals"].replace(0, np.nan)
    cohort["is_mature"] = cohort["resolved_share"] >= 0.80
    cohort["mktg_pct"] = cohort["marketing_sourced"] / cohort["deals"]
    intervals = cohort.apply(lambda row: wilson_interval(int(row["won"]), int(row["resolved"])), axis=1)
    cohort["win_rate_ci_low"] = [interval[0] for interval in intervals]
    cohort["win_rate_ci_high"] = [interval[1] for interval in intervals]

    print("  Pipeline created by quarter:")
    for _, r in cohort.tail(12).iterrows():
        print(f"    {r['quarter']}: deals={int(r['deals']):4d}  resolved={r['resolved_share']:.0%}  pipeline=${r['pipeline']:>10,.0f}  closed_win_rate={r['closed_win_rate']:.0%}  mktg%={r['mktg_pct']:.0%}")

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
    pd.DataFrame([model_stats]).to_parquet(os.path.join(INTEGRATED_DATA_DIR, "model_stats.parquet"), index=False)
    results["model_diagnostics"] = pd.DataFrame([model_stats])
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
