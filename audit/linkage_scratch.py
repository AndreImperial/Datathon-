import sys,importlib.util
sys.path.insert(0,'.')
import pandas as pd
from pathlib import Path
spec=importlib.util.spec_from_file_location('case','analytics_case_study/03d_case_analysis.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
o,recon=m.canonical_population();norm,cov=m.touchpoints();print('CANONICAL',len(o),o.resolved.sum(),o.won.sum())
rows=[]
def add(d,dc,tc,ch):
 t=pd.DataFrame({'domain':d[dc],'timestamp':pd.to_datetime(d[tc],utc=True,errors='coerce')});t['channel']=ch;t=t.dropna();rows.append(t)
six=pd.read_parquet('data/cleaned/6sense_campaign.parquet');add(six,'_6sensedomain','_latestimpression','6sense display')
e=pd.read_parquet('data/cleaned/email_engagements.parquet');add(e,'_domain','_timestamp','Email')
w=pd.read_parquet('data/cleaned/web_engagements.parquet')
for c,ch in [('is_6sense_traffic','6sense display'),('is_email_traffic','Email'),('is_linkedin_traffic','LinkedIn')]:add(w[w[c].eq(True)],'_domain','_timestamp',ch)
t=pd.concat(rows,ignore_index=True);t['source']='scratch'
nl=m.linked_touches(o,norm,365);rl=m.linked_touches(o,t,365)
old=set(nl._opportunity_id);new=set(rl._opportunity_id)
miss=o[o._opportunity_id.isin(new-old)]
print('WEEK EFFECT',len(old),len(new),'lost opportunities',len(new-old),'lost pipeline',miss.amount.sum(),'lost won',miss.won.sum(),'lost won amount',miss.loc[miss.won,'amount'].sum(),'linked opp-channel counts',len(nl.drop_duplicates(['_opportunity_id','channel'])),len(rl.drop_duplicates(['_opportunity_id','channel'])))
miss.to_csv('audit/weekly-linkage-loss.csv',index=False)
print(miss[['_opportunity_id','domain','created_at','amount','won']].head(8).to_string(index=False))
print('master accounts pipeline',pd.read_parquet('data/integrated/master_account.parquet').total_pipeline.sum(),'clean opp amount',pd.read_parquet('data/cleaned/opportunities.parquet')._amount.sum())
a=pd.read_parquet('data/cleaned/accounts.parquet');print('shared domains',a[a.domain__c.notna()].groupby('domain__c').size().loc[lambda x:x>1].to_string())
raw=pd.read_excel('Analytics Case Study/Datathon_db_opportunity_log.xlsx',dtype=str);print('RAW',len(raw),raw._opportunity_id.nunique(),raw._order.value_counts().head().to_dict());print('raw account',len(pd.read_excel('Analytics Case Study/Datathon_db_account_log.xlsx')))
