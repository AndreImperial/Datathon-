"""Read-only raw/model artifact audit. Run from any cwd with .venv Python."""
from pathlib import Path
import json
import math
import sys
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analytics_case_study.utils.cleaning_helpers import replace_null_strings, safe_datetime, safe_numeric
from analytics_case_study.utils.metrics import resolved_stage_mask

raw = pd.read_excel(ROOT / 'Analytics Case Study/Datathon_db_opportunity_log.xlsx', dtype=str)
raw.columns = [c.strip() for c in raw.columns]
raw['_source_row_index'] = np.arange(len(raw))
raw = replace_null_strings(raw)
for c in [c for c in raw if 'date' in c.lower()]:
    raw[c] = safe_datetime(raw[c])
raw['_order'] = safe_numeric(raw['_order'])
raw['_order_valid'] = raw['_order'].notna()
raw['_latest_status_date'] = safe_datetime(raw['previous_change_status_change_date'])
latest = raw.sort_values(['_opportunity_id', '_order_valid', '_order', '_latest_status_date', '_source_row_index'], na_position='first', kind='stable').drop_duplicates('_opportunity_id', keep='last').copy()
deleted = latest['isdeleted'].astype(str).str.lower().isin(['true','1','yes'])
canonical = latest.loc[~deleted].copy()
stage = next(c for c in canonical if 'current_stage' in c.lower())
created = next(c for c in canonical if 'createdate' in c.lower())
closed = canonical.loc[resolved_stage_mask(canonical[stage]) & canonical[created].notna()].sort_values(created)
cutoff = int(len(closed)*.8)
train, test = closed.iloc[:cutoff], closed.iloc[cutoff:]
start = test[created].min()
result = {'raw_rows':len(raw), 'latest_rows':len(latest), 'deleted_rows':int(deleted.sum()), 'canonical_rows':len(canonical), 'stage_column':stage, 'creation_column':created, 'resolved_rows':len(closed), 'active_rows':int((~resolved_stage_mask(canonical[stage])).sum()), 'train_rows':len(train), 'test_rows':len(test), 'holdout_creation_start':str(start), 'training_current_stage_change_after_holdout_start':int(train['_current_stage_change_date'].gt(start).sum()), 'training_close_date_after_holdout_start':int(train['_close_date'].gt(start).sum())}
saved = json.loads((ROOT/'frontend/public/dashboard-data-v3.json').read_text(encoding='utf-8'))['datasets']
result['saved_model_diagnostics'] = saved['model_diagnostics']
result['saved_model_band_active_total'] = sum(r['active_opportunities'] for r in saved['model_score_bands'])
result['unsupported_decomposition_groups'] = [r for r in saved['conversion_decomposition'] if r['period_a_resolved']==0 or r['period_b_resolved']==0]
p1,p2=.05,.07
pbar=(p1+p2)/2
n=math.ceil((1.96*math.sqrt(2*pbar*(1-pbar))+.8416*math.sqrt(p1*(1-p1)+p2*(1-p2)))**2/(p2-p1)**2)
result['default_power_check'] = {'per_arm':n,'total':2*n,'saved_eligible_domains':saved['summary'][0]['eligible_domains'],'feasible':saved['summary'][0]['eligible_domains']>=2*n}
touch = pd.DataFrame({'domain':['example.com']*2,'channel':['Email']*2,'timestamp':pd.to_datetime(['2024-06-03','2024-06-07'],utc=True)})
touch['week']=touch['timestamp'].dt.strftime('%G-W%V')
opp_date=pd.Timestamp('2024-06-05',tz='UTC')
compressed=touch.sort_values('timestamp').drop_duplicates(['domain','channel','week'],keep='last')
result['weekly_dedup_counterexample']={'eligible_raw_touches':int(touch['timestamp'].le(opp_date).sum()),'eligible_globally_compressed_touches':int(compressed['timestamp'].le(opp_date).sum())}
print(json.dumps(result, indent=2, ensure_ascii=False))
