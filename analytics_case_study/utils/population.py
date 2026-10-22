"""Canonical latest-snapshot CRM population, preserving the reconciliation archive."""
import pandas as pd

def canonical_opportunities(frame: pd.DataFrame) -> pd.DataFrame:
    """Exclude explicitly deleted rows; missing flags remain eligible.

    Selection of whole latest rows occurs upstream, before this filter, so a
    deleted latest state can never resurrect an older nondeleted snapshot.
    """
    deleted = pd.Series(False, index=frame.index)
    for column in ("isdeleted", "_isdeleted"):
        if column in frame:
            deleted |= frame[column].astype("string").str.strip().str.lower().isin(["true", "1", "1.0", "yes"])
    return frame.loc[~deleted].copy()
