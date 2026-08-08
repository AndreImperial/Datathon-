import numpy as np
import pandas as pd


RESOLVED_STAGE_TERMS = ("closed", "won", "lost", "discontinued")


def resolved_stage_mask(stage: pd.Series) -> pd.Series:
    """Return a consistent resolved-opportunity mask across every analysis.

    ``Discontinued`` opportunities are terminal outcomes and must not be scored
    or counted as open pipeline.  Keeping this rule in one place prevents the
    dashboard, model, cohort, and validation layers from drifting apart.
    """
    normalized = stage.fillna("").astype(str).str.lower()
    return normalized.apply(lambda value: any(term in value for term in RESOLVED_STAGE_TERMS))


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion by default."""
    if not total or total <= 0:
        return np.nan, np.nan
    p = successes / total
    denominator = 1 + (z**2 / total)
    center = (p + z**2 / (2 * total)) / denominator
    margin = (z / denominator) * np.sqrt((p * (1 - p) / total) + (z**2 / (4 * total**2)))
    return max(0.0, center - margin), min(1.0, center + margin)


def pipeline_roi(pipeline: float, spend: float) -> float:
    if spend and spend > 0:
        return round(pipeline / spend, 2)
    return np.nan


def revenue_roi(won_revenue: float, spend: float) -> float:
    if spend and spend > 0:
        return round(won_revenue / spend, 2)
    return np.nan


def win_rate(won: int, total: int) -> float:
    if total and total > 0:
        return round(won / total, 4)
    return np.nan


def cost_per_unit(spend: float, units: int) -> float:
    if units and units > 0:
        return round(spend / units, 2)
    return np.nan


def channel_funnel_summary(opps_df: pd.DataFrame, channel_col: str = "channel_category") -> pd.DataFrame:
    """Compute per-channel pipeline metrics from deduplicated opportunities."""
    won_col = "iswon" if "iswon" in opps_df.columns else "_iswon"
    df = opps_df.copy()
    df["_won_flag"] = df[won_col].eq(True)
    df["_won_amount"] = np.where(df["_won_flag"], df["_amount"], 0)
    stage_col = next((c for c in df.columns if "current_stage" in c.lower()), None)
    df["_resolved_flag"] = resolved_stage_mask(df[stage_col]) if stage_col else True
    grp = df.groupby(channel_col)
    result = grp.agg(
        deal_count=("_opportunity_id", "count"),
        resolved_count=("_resolved_flag", "sum"),
        total_pipeline=("_amount", "sum"),
        won_pipeline=("_won_amount", "sum"),
        won_count=("_won_flag", "sum"),
        avg_deal_size=("_amount", "mean"),
    )
    result["win_rate"] = (result["won_count"] / result["resolved_count"].replace(0, np.nan)).round(4)
    result["resolved_share"] = (result["resolved_count"] / result["deal_count"].replace(0, np.nan)).round(4)
    result["pipeline_pct"] = (result["total_pipeline"] / result["total_pipeline"].sum()).round(4)
    return result.reset_index()
