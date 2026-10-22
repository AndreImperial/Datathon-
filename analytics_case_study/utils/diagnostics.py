"""Inspectable score and duration diagnostics without invented missing values."""
import numpy as np
import pandas as pd
from .metrics import wilson_interval

SCORE_LABELS = ['[0%,25%]', '(25%,50%]', '(50%,75%]', '(75%,100%]']

def score_bins(values):
    return pd.cut(pd.to_numeric(values, errors='coerce'), [0, .25, .5, .75, 1], labels=SCORE_LABELS, include_lowest=True, right=True)

def calibration_table(predicted, observed):
    frame = pd.DataFrame({'predicted': predicted, 'observed': observed})
    frame['score_band'] = score_bins(frame['predicted'])
    out = frame.groupby('score_band', observed=True).agg(n=('observed','size'), wins=('observed','sum'), predicted_win_rate=('predicted','mean'), observed_win_rate=('observed','mean'), score_min=('predicted','min'), score_max=('predicted','max')).reset_index()
    intervals = [wilson_interval(int(row.wins), int(row.n)) for row in out.itertuples()]
    out['observed_ci_low'] = [x[0] for x in intervals]
    out['observed_ci_high'] = [x[1] for x in intervals]
    out['abs_gap'] = (out.predicted_win_rate-out.observed_win_rate).abs()
    return out

def duration_diagnostics(wins):
    out = wins.copy()
    days = out['days_to_close']
    out['duration_status'] = np.select([days.isna(), days.lt(0), days.gt(730), days.eq(0)], ['missing dates','negative interval','over 730 days','eligible same-day'], default='eligible positive')
    raw = out.get('_type', pd.Series('', index=out.index)).fillna('').str.lower().str.strip()
    out['business_motion'] = raw.map({'new business - mrr':'Acquisition','new business - one time':'Acquisition','renewal - mrr':'Renewal'}).fillna('Unknown')
    summary = out.groupby(['channel_category','business_motion','duration_status'], dropna=False).size().reset_index(name='wins')
    summary['interval_definition'] = 'Source close_date minus createdate in whole days; 0..730 included; negative source chronology unresolved'
    return out.loc[days.between(0,730)].copy(), summary
