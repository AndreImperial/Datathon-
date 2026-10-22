import sys,importlib.util
sys.path.insert(0,'.')
import pandas as pd
spec=importlib.util.spec_from_file_location('case','analytics_case_study/03d_case_analysis.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
o,r=m.canonical_population();ex,pr=m.audience(o);print('EX',ex.to_string(index=False),'SUM',ex.domains.sum());print('PR ELIGIBLE SUM',pr.eligible_domains.sum());print(pr.to_string(index=False))
a=pd.read_parquet('data/cleaned/accounts.parquet');mas=pd.read_parquet('data/integrated/master_account.parquet');c=pd.read_parquet('data/cleaned/6sense_campaign.parquet');e=pd.read_parquet('data/cleaned/email_engagements.parquet');w=pd.read_parquet('data/cleaned/web_engagements.parquet')
for d,dc,col,mastercol in [(c,'_6sensedomain','_spend','campaign_spend'),(e,'_domain','is_click','email_clicks'),(w,'_domain','_totalsessionviews','web_pageviews')]:
 intended=d[d[dc].isin(set(a.domain__c.dropna()))][col].sum();actual=mas[mastercol].sum();print('MASTER DUP',mastercol,'matching raw',intended,'master',actual,'overcount',actual-intended)
print('AD',pd.read_parquet('data/cleaned/ad_metrics.parquet').groupby('_platform')._spend.sum().to_dict(),'C6',c._spend.sum())
print('ZERO',o.amount.isna().sum(),o.amount.eq(0).sum(),'wonzero',o.loc[o.won,'amount'].eq(0).sum(),'wonmissing',o.loc[o.won,'amount'].isna().sum())
