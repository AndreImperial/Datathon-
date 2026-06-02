import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request, send_from_directory


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
CONTEXT_PATH = PUBLIC_DIR / "dashboard_context.json"
CLEANED_DATA_DIR = ROOT / "data" / "cleaned"
INTEGRATED_DATA_DIR = ROOT / "data" / "integrated"

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
DEFAULT_OLLAMA_MODEL = "llama3.1:8b"
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


def _load_context():
    if not CONTEXT_PATH.exists():
        return {}
    return json.loads(CONTEXT_PATH.read_text(encoding="utf-8"))


def _read_parquet(base_dir, name):
    path = base_dir / f"{name}.parquet"
    if not path.exists():
        return pd.DataFrame()
    return pd.read_parquet(path)


def _clean_value(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float):
        return round(value, 4)
    return value


def _records(df, columns=None, limit=20):
    if df.empty:
        return []
    if columns:
        columns = [c for c in columns if c in df.columns]
        df = df[columns]
    rows = []
    for row in df.head(limit).to_dict("records"):
        rows.append({k: _clean_value(v) for k, v in row.items()})
    return rows


def _top_counts(df, column, limit=10):
    if df.empty or column not in df.columns:
        return []
    counts = df[column].fillna("Unknown").astype(str).value_counts().head(limit)
    return [{"value": idx, "count": int(val)} for idx, val in counts.items()]


def _numeric_sum(df, column):
    if df.empty or column not in df.columns:
        return None
    values = pd.to_numeric(df[column], errors="coerce")
    if values.notna().sum() == 0:
        return None
    return round(float(values.sum()), 2)


def _dataset_catalog():
    catalog = {}
    for label, base in [("cleaned", CLEANED_DATA_DIR), ("integrated", INTEGRATED_DATA_DIR)]:
        catalog[label] = {}
        if not base.exists():
            continue
        for path in sorted(base.glob("*.parquet")):
            df = pd.read_parquet(path)
            catalog[label][path.stem] = {
                "rows": int(df.shape[0]),
                "columns": int(df.shape[1]),
                "column_names": df.columns.tolist(),
            }
    return catalog


def _backend_data_context():
    opps = _read_parquet(CLEANED_DATA_DIR, "opportunities")
    email = _read_parquet(CLEANED_DATA_DIR, "email_engagements")
    ads = _read_parquet(CLEANED_DATA_DIR, "ad_metrics")
    web = _read_parquet(CLEANED_DATA_DIR, "web_engagements")
    campaign = _read_parquet(CLEANED_DATA_DIR, "6sense_campaign")
    accounts = _read_parquet(CLEANED_DATA_DIR, "accounts")

    channel = _read_parquet(INTEGRATED_DATA_DIR, "channel_pipeline")
    attribution = _read_parquet(INTEGRATED_DATA_DIR, "attribution_results")
    cohort = _read_parquet(INTEGRATED_DATA_DIR, "cohort_analysis")
    coverage = _read_parquet(INTEGRATED_DATA_DIR, "account_coverage")
    targeting = _read_parquet(INTEGRATED_DATA_DIR, "targeting_matrix")
    creative = _read_parquet(INTEGRATED_DATA_DIR, "creative_performance")
    velocity = _read_parquet(INTEGRATED_DATA_DIR, "deal_velocity")
    journeys = _read_parquet(INTEGRATED_DATA_DIR, "journey_sequences")
    win_prob = _read_parquet(INTEGRATED_DATA_DIR, "win_probability")
    features = _read_parquet(INTEGRATED_DATA_DIR, "feature_importance")
    model = _read_parquet(INTEGRATED_DATA_DIR, "model_stats")
    qa = _read_parquet(INTEGRATED_DATA_DIR, "qa_performance")

    context = {
        "dataset_catalog": _dataset_catalog(),
        "tables": {},
        "raw_data_summaries": {},
    }

    context["tables"]["channel_pipeline"] = _records(
        channel.sort_values("total_pipeline", ascending=False) if "total_pipeline" in channel.columns else channel,
        limit=20,
    )
    context["tables"]["attribution_results"] = _records(attribution, limit=40)
    context["tables"]["cohort_analysis"] = _records(cohort, limit=40)
    context["tables"]["targeting_matrix"] = _records(
        targeting.sort_values("priority_score", ascending=False) if "priority_score" in targeting.columns else targeting,
        limit=20,
    )
    context["tables"]["deal_velocity"] = _records(velocity, limit=20)
    context["tables"]["qa_performance"] = _records(qa, limit=10)
    context["tables"]["model_stats"] = _records(model, limit=5)
    context["tables"]["feature_importance"] = _records(
        features.sort_values("importance", ascending=False) if "importance" in features.columns else features,
        limit=15,
    )
    context["tables"]["creative_performance_top_ctr"] = _records(
        creative.sort_values("ctr", ascending=False) if "ctr" in creative.columns else creative,
        columns=["_adname", "_platform", "_copytone", "_spend", "_clicks", "_impressions", "ctr", "cpc"],
        limit=15,
    )
    context["tables"]["journey_sequences_top"] = _records(
        journeys.sort_values("amount", ascending=False) if "amount" in journeys.columns else journeys,
        columns=["amount", "n_touches", "n_channels", "first_channel", "last_channel", "sequence_2ch"],
        limit=20,
    )
    context["tables"]["win_probability_top_open_deals"] = _records(
        win_prob.sort_values("win_probability", ascending=False) if "win_probability" in win_prob.columns else win_prob,
        columns=["_account_name", "_amount", "channel_category", "segment__c", "win_probability"],
        limit=20,
    )

    if not coverage.empty and "coverage_tier" in coverage.columns:
        grouped = coverage.groupby("coverage_tier").agg(
            accounts=("domain", "count"),
            opportunity_rate=("has_opportunity", "mean"),
        ).reset_index()
        context["tables"]["account_coverage_by_tier"] = _records(grouped, limit=10)

    if not opps.empty:
        won_col = "iswon" if "iswon" in opps.columns else ("_iswon" if "_iswon" in opps.columns else None)
        amount_col = "_amount" if "_amount" in opps.columns else None
        opp_summary = {
            "rows": int(len(opps)),
            "top_channels_by_count": _top_counts(opps, "channel_category"),
            "top_segments_by_count": _top_counts(opps, "segment__c"),
            "top_stages_by_count": _top_counts(opps, "_current_stage"),
        }
        if amount_col:
            opp_summary["total_amount"] = round(float(opps[amount_col].sum()), 2)
            if "channel_category" in opps.columns:
                by_channel = opps.groupby("channel_category")[amount_col].sum().sort_values(ascending=False).head(12)
                opp_summary["top_channels_by_pipeline"] = [
                    {"channel": idx, "pipeline": round(float(val), 2)} for idx, val in by_channel.items()
                ]
        if won_col:
            opp_summary["won_deals"] = int((opps[won_col] == True).sum())
        context["raw_data_summaries"]["opportunities"] = opp_summary

    if not email.empty:
        email_summary = {"rows": int(len(email)), "seniority_counts": _top_counts(email, "_seniority")}
        if {"_seniority", "is_open", "is_click"}.issubset(email.columns):
            seniority = email.groupby("_seniority").agg(
                records=("_seniority", "count"),
                open_rate=("is_open", "mean"),
                click_rate=("is_click", "mean"),
            ).reset_index().sort_values("click_rate", ascending=False)
            email_summary["seniority_engagement"] = _records(seniority, limit=12)
        context["raw_data_summaries"]["email_engagements"] = email_summary

    if not ads.empty:
        ad_summary = {"rows": int(len(ads)), "platform_counts": _top_counts(ads, "_platform")}
        for col in ["_spend", "_clicks", "_impressions"]:
            total = _numeric_sum(ads, col)
            if total is not None:
                ad_summary[f"total{col}"] = total
        context["raw_data_summaries"]["ad_metrics"] = ad_summary

    if not web.empty:
        context["raw_data_summaries"]["web_engagements"] = {
            "rows": int(len(web)),
            "top_page_groups": _top_counts(web, "_pagegroup"),
            "top_stages": _top_counts(web, "_stage"),
        }

    if not campaign.empty:
        campaign_summary = {"rows": int(len(campaign))}
        for col in ["_spend", "_clicks", "_impressions", "_websiteengagement", "_influencedformfills"]:
            total = _numeric_sum(campaign, col)
            if total is not None:
                campaign_summary[f"total{col}"] = total
        context["raw_data_summaries"]["6sense_campaign"] = campaign_summary

    if not accounts.empty:
        context["raw_data_summaries"]["accounts"] = {
            "rows": int(len(accounts)),
            "top_industries": _top_counts(accounts, "industry"),
            "profile_fit_counts": _top_counts(accounts, "accountprofilefit6sense__c"),
        }

    return context


def _scope_prompt(context, data_context, message):
    return f"""
You are the AI assistant for an educational marketing analytics dashboard.

Stay within these topics:
- B2B marketing analytics
- Account-Based Marketing (ABM)
- marketing attribution, sourced vs influenced credit, ROI, pipeline, win rate
- ICP, account coverage, 6sense, email, creative, budget tests, funnel quality
- explaining or presenting this dashboard

If the user asks about unrelated topics, politely redirect to the marketing dashboard.
Do not invent numbers. Use the dashboard context and backend data summaries below. Keep answers concise, practical, and presentation-ready.
If the exact row-level answer is not present in the summaries, say what table contains the answer and what additional query would be needed.
When causality, attribution, or ROI comes up, mention that the dashboard is directional unless a holdout/experiment proves lift.

Dashboard context:
{json.dumps(context, indent=2)}

Backend data context:
{json.dumps(data_context, indent=2)}

User question:
{message}
""".strip()


def _call_gemini(prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None, "GEMINI_API_KEY is not configured."

    model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    url = GEMINI_API_URL.format(model=model)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 550,
        },
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return None, f"Gemini API error {exc.code}: {detail[:300]}"
    except Exception as exc:
        return None, f"Gemini request failed: {exc}"

    try:
        parts = data["candidates"][0]["content"]["parts"]
        answer = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError):
        answer = ""

    if not answer:
        return None, "Gemini returned an empty response."
    return answer, None


def _ollama_available():
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=1.5):
            return True
    except Exception:
        return False


def _call_ollama(prompt):
    model = os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 700,
        },
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/generate",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=80) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return None, f"Ollama API error {exc.code}: {detail[:300]}"
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", None) or str(exc)
        return None, f"Ollama is not reachable at {OLLAMA_BASE_URL}. Start Ollama or set OLLAMA_BASE_URL. Detail: {reason}"
    except Exception as exc:
        return None, f"Ollama request failed: {exc}"

    answer = str(data.get("response", "")).strip()
    if not answer:
        return None, "Ollama returned an empty response."
    return answer, None


def _provider_order():
    provider = os.environ.get("LLM_PROVIDER", "ollama").strip().lower()
    if provider == "gemini":
        return ["gemini", "ollama"]
    return ["ollama", "gemini"]


def _call_llm(prompt):
    errors = []
    for provider in _provider_order():
        if provider == "ollama":
            answer, error = _call_ollama(prompt)
            if answer:
                return answer, "ollama", None
            errors.append(error)
        elif provider == "gemini":
            answer, error = _call_gemini(prompt)
            if answer:
                return answer, "gemini", None
            errors.append(error)
    return None, "unavailable", " | ".join(err for err in errors if err)


@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip()
    if not message:
        return jsonify({"error": "Message is required."}), 400
    if len(message) > 1200:
        return jsonify({"error": "Message is too long. Please ask a shorter dashboard question."}), 400

    context = _load_context()
    data_context = _backend_data_context()
    prompt = _scope_prompt(context, data_context, message)
    answer, mode, error = _call_llm(prompt)
    if error:
        return jsonify({"error": error, "mode": mode}), 503
    return jsonify({"answer": answer, "mode": mode})


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "context": CONTEXT_PATH.exists(),
        "backend_data": CLEANED_DATA_DIR.exists() and INTEGRATED_DATA_DIR.exists(),
        "llm_provider": os.environ.get("LLM_PROVIDER", "ollama"),
        "ollama_available": _ollama_available(),
        "ollama_base_url": OLLAMA_BASE_URL,
        "ollama_model": os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "gemini_model": os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
    })


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(PUBLIC_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8050")))
