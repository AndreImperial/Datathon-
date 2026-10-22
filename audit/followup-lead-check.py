import json
from pathlib import Path
import pandas as pd

root = Path(__file__).resolve().parents[1]
frame = pd.read_parquet(root / 'data/cleaned/opportunities.parquet')
deleted = pd.Series(False, index=frame.index)
for col in ['isdeleted', '_isdeleted']:
    if col in frame:
        deleted |= frame[col].astype('string').str.strip().str.lower().isin(['true', '1', '1.0', 'yes'])
frame = frame.loc[~deleted].copy()
created_col = next(c for c in frame if 'createdate' in c.lower())
created = pd.to_datetime(frame[created_col], utc=True, errors='coerce')
motion = frame['_type'].fillna('').str.strip().str.lower().map({'new business - mrr':'Acquisition','new business - one time':'Acquisition','renewal - mrr':'Renewal'}).fillna('Unknown')
v2 = json.loads((root/'public/dashboard-data.json').read_text(encoding='utf-8'))
v3 = json.loads((root/'public/dashboard-data-v3.json').read_text(encoding='utf-8'))
result = {'canonical_rows': len(frame), 'latest_creation': str(created.max()), 'motion_by_year': pd.crosstab(created.dt.year, motion).loc[[2023,2024]].to_dict(), 'public_deal_rows': len(v2['datasets']['win_probability']), 'public_deal_fields': list(v2['datasets']['win_probability'][0]), 'sections': len(v2['manifest']['section_ids']), 'chart_placements': len(v2['chart_metadata']), 'sortable_tables': len(v2['tables']), 'slides': len(v3['presentation']['slides'])}
print(json.dumps(result, indent=2))
