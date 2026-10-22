import re
from urllib.parse import urlsplit
import numpy as np
import pandas as pd

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "protonmail.com", "live.com",
}


def normalize_domain(series: pd.Series) -> pd.Series:
    """Extract only an explicit hostname; reject ambiguous or invalid identities.

    URL paths, ports and email local parts are discarded; subdomains are retained.
    No public-suffix inference, spelling corrections or guessed company matches.
    """
    def parse(value):
        if pd.isna(value):
            return np.nan
        value = str(value).strip().lower()
        if not value or value in {'nan', 'none', 'null'} or re.search(r'\s', value):
            return np.nan
        if value.startswith('mailto:'):
            value = value[7:]
        if '@' in value and '://' not in value:
            if value.count('@') != 1 or not value.split('@')[0]:
                return np.nan
            value = value.split('@')[1]
        try:
            host = urlsplit(value if '://' in value else '//' + value).hostname
            host = host.rstrip('.').encode('idna').decode('ascii') if host else ''
        except (ValueError, UnicodeError):
            return np.nan
        host = re.sub(r'^www\.', '', host)
        return host if re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}', host) else np.nan
    return series.map(parse)


def email_person_identity(frame: pd.DataFrame) -> pd.Series:
    """Prefer supplied prospect ID; use a valid normalized email only if absent."""
    primary = frame.get('_prospectID', pd.Series('', index=frame.index)).fillna('').astype(str).str.strip()
    fallback = frame.get('_email', pd.Series('', index=frame.index)).fillna('').astype(str).str.strip().str.lower()
    valid = fallback.str.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+').fillna(False)
    return primary.where(primary.ne(''), fallback.where(valid)).replace('', np.nan)


def replace_null_strings(df: pd.DataFrame) -> pd.DataFrame:
    """Replace literal 'null', 'NULL', 'None', '-', 'nan' strings with np.nan."""
    return df.replace({"null": np.nan, "NULL": np.nan, "None": np.nan, "-": np.nan, "": np.nan, "nan": np.nan, "NaN": np.nan})


def safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def safe_datetime(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", format="mixed", dayfirst=False)


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
