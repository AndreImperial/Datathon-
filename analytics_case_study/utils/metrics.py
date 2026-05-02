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
    grp = opps_df.groupby(channel_col)
    result = pd.DataFrame({
        "deal_count": grp["_opportunity_id"].count(),
        "total_pipeline": grp["_amount"].sum(),
        "won_pipeline": grp.apply(lambda g: g.loc[g["_iswon"] == True, "_amount"].sum()),
        "won_count": grp.apply(lambda g: (g["_iswon"] == True).sum()),
        "avg_deal_size": grp["_amount"].mean(),
    })
    result["win_rate"] = (result["won_count"] / result["deal_count"]).round(4)
    result["pipeline_pct"] = (result["total_pipeline"] / result["total_pipeline"].sum()).round(4)
    return result.reset_index()
