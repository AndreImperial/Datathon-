import numpy as np
import pandas as pd


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
    grp = df.groupby(channel_col)
    result = grp.agg(
        deal_count=("_opportunity_id", "count"),
        total_pipeline=("_amount", "sum"),
        won_pipeline=("_won_amount", "sum"),
        won_count=("_won_flag", "sum"),
        avg_deal_size=("_amount", "mean"),
    )
    result["win_rate"] = (result["won_count"] / result["deal_count"]).round(4)
    result["pipeline_pct"] = (result["total_pipeline"] / result["total_pipeline"].sum()).round(4)
    return result.reset_index()
