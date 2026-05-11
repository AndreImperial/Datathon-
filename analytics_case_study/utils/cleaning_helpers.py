import re
import numpy as np
import pandas as pd

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "protonmail.com", "live.com",
}


def normalize_domain(series: pd.Series) -> pd.Series:
    """Lowercase, strip www., strip protocol, strip trailing slashes."""
    s = series.astype(str).str.strip().str.lower()
    s = s.str.replace(r"^https?://", "", regex=True)
    s = s.str.replace(r"^www\.", "", regex=True)
    s = s.str.rstrip("/")
    s = s.replace({"nan": np.nan, "none": np.nan, "": np.nan})
    return s


def replace_null_strings(df: pd.DataFrame) -> pd.DataFrame:
    """Replace literal 'null', 'NULL', 'None', '-' strings with np.nan."""
    return df.replace({"null": np.nan, "NULL": np.nan, "None": np.nan, "-": np.nan, "": np.nan})


def safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def safe_datetime(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", format="mixed", dayfirst=False)


def month_period(series: pd.Series) -> pd.Series:
    s = series
    if getattr(s.dt, "tz", None) is not None:
        s = s.dt.tz_convert(None)
    return s.dt.to_period("M").astype(str)


def normalize_country(series: pd.Series) -> pd.Series:
    mapping = {
        "usa": "United States", "us": "United States",
        "united states": "United States", "united states of america": "United States",
        "uk": "United Kingdom", "gb": "United Kingdom",
        "great britain": "United Kingdom",
    }
    return series.str.strip().str.lower().map(lambda x: mapping.get(x, x.title()) if isinstance(x, str) else x)


def normalize_industry(series: pd.Series, normalization_map: dict) -> pd.Series:
    return series.map(lambda x: normalization_map.get(str(x).strip(), str(x).strip()) if pd.notna(x) else np.nan)


def filter_free_email_domains(df: pd.DataFrame, domain_col: str) -> pd.DataFrame:
    mask = df[domain_col].isin(FREE_EMAIL_DOMAINS)
    removed = mask.sum()
    if removed > 0:
        print(f"  Filtered {removed} free-email-domain records from {domain_col}")
    return df[~mask].copy()


def derive_ctr(clicks: pd.Series, impressions: pd.Series) -> pd.Series:
    return (clicks / impressions.replace(0, np.nan)).round(6)


def derive_cpc(spend: pd.Series, clicks: pd.Series) -> pd.Series:
    return (spend / clicks.replace(0, np.nan)).round(4)


def derive_cpm(spend: pd.Series, impressions: pd.Series) -> pd.Series:
    return ((spend / impressions.replace(0, np.nan)) * 1000).round(4)
