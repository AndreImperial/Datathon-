"""Inspectable duration diagnostics without invented missing values."""
import numpy as np
import pandas as pd

def duration_diagnostics(wins):
    out = wins.copy()
    days = out['days_to_close']
    out['duration_status'] = np.select([days.isna(), days.lt(0), days.gt(730), days.eq(0)], ['missing dates','negative interval','over 730 days','eligible same-day'], default='eligible positive')
    raw = out.get('_type', pd.Series('', index=out.index)).fillna('').str.lower().str.strip()
    out['business_motion'] = raw.map({'new business - mrr':'Acquisition','new business - one time':'Acquisition','renewal - mrr':'Renewal'}).fillna('Unknown')
    summary = out.groupby(['channel_category','business_motion','duration_status'], dropna=False).size().reset_index(name='wins')
    summary['interval_definition'] = 'Source close_date minus createdate in whole days; 0..730 included; negative source chronology unresolved'
    return out.loc[days.between(0,730)].copy(), summary
