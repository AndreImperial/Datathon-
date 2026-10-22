import sys,json,hashlib
import pandas as pd
from pathlib import Path
p=Path('.')
o=pd.read_parquet(p/'data/cleaned/opportunities.parquet')
a=pd.read_parquet(p/'data/cleaned/accounts.parquet')
delmask=o.isdeleted.eq(True)
print('OPPS',len(o),'deleted',int(delmask.sum()),'pipeline',o._amount.sum(),'won count',int(o.iswon.eq(True).sum()),'won amount',o.loc[o.iswon.eq(True),'_amount'].sum())
print('DELETED',o.loc[delmask,['_amount','iswon']].agg({'_amount':['sum','count'],'iswon':['sum','count']}).to_string())
print('canonical',len(o[~delmask]),o.loc[~delmask,'_amount'].sum(),o.loc[~delmask&o.iswon.eq(True),'_amount'].sum())
print('CP',pd.read_parquet(p/'data/integrated/channel_pipeline.parquet').to_string(index=False))
print('ATTR',pd.read_parquet(p/'data/integrated/attribution_coverage.parquet').to_string(index=False))
for n in ['opportunities','accounts','ad_metrics','6sense_campaign','web_engagements','email_engagements']:
 d=pd.read_parquet(p/'data/cleaned'/f'{n}.parquet');print(n,len(d),'dup rows',int(d.duplicated().sum()))
 for c in d.columns:
  if c.lower() in ['day','_date','_timestamp','_latestimpression','_createdate']:
   print('dates',c,d[c].min(),d[c].max(),int(d[c].isna().sum()))
print('account duplicates',a.accountid.duplicated().sum(),'domain repeated rows',a['domain__c'].duplicated(False).sum())
for f in ['public/dashboard-data-v3.json','frontend/public/dashboard-data-v3.json']:
 j=json.load(open(f,encoding='utf8'));print(f,j['datasets']['summary']);print('HASH',[(n,h==hashlib.sha256((p/'data/cleaned'/n).read_bytes()).hexdigest()[:16]) for n,h in j['meta']['source_hashes'].items()])
