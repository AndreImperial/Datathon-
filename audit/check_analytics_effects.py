"""Read-only comparison of explicit identity normalization and positional policy."""
import importlib.util
import json
from pathlib import Path
import sys
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from analytics_case_study.utils.cleaning_helpers import normalize_domain, email_person_identity
spec=importlib.util.spec_from_file_location('case', 'analytics_case_study/03d_case_analysis.py')
case=importlib.util.module_from_spec(spec);spec.loader.exec_module(case)
effects={}
for name,cols in {'accounts':['domain__c'],'opportunities':['_domain'],'email_engagements':['_domain'],'6sense_campaign':['_6sensedomain'],'web_engagements':['_domain']}.items():
    frame=pd.read_parquet(case.CLEAN/f'{name}.parquet')
    for col in cols:
        old=frame[col].fillna('').astype(str).str.strip().str.lower()
        new=normalize_domain(frame[col]).fillna('')
        effects[f'{name}.{col}']={'changed_rows':int(old.ne(new).sum()),'explicit_host_recoveries':int((old.ne(new)&new.ne('')).sum()),'rejected_invalid_rows':int((old.ne('')&new.eq('')).sum())}
email=pd.read_parquet(case.CLEAN/'email_engagements.parquet')
primary=email['_prospectID'].fillna('').astype(str).str.strip()
identity=email_person_identity(email)
effects['email_identity']={'recoverable_rows':int((primary.eq('')&identity.notna()).sum()),'primary_people':int(primary.replace('',pd.NA).nunique()),'fallback_people':int(identity.nunique())}
opps,_=case.canonical_population();touches,_=case.touchpoints()
raw=opps.dropna(subset=['domain','created_at','amount'])[['domain','created_at','_opportunity_id','amount','won']].merge(touches,on='domain')
raw['days_before']=(raw.created_at-raw.timestamp).dt.total_seconds()/86400
raw=raw[raw.days_before.between(0,365)]
weekly=case.linked_touches(opps,touches,365)
def first(frame):
    out={}
    for oid,group in frame.groupby('_opportunity_id'):
        rows=group[group.timestamp.eq(group.timestamp.min())]
        out[oid]=tuple(sorted(rows.channel.unique()))
    return out
r,w=first(raw),first(weekly);different=[oid for oid in r if r[oid]!=w[oid]]
delta={}
for oid in different:
    amount=float(raw[raw._opportunity_id.eq(oid)].amount.iloc[0])
    for ch in r[oid]:delta[ch]=delta.get(ch,0)-amount/len(r[oid])
    for ch in w[oid]:delta[ch]=delta.get(ch,0)+amount/len(w[oid])
effects['positional_policy']={'policy':'first/last retained latest eligible weekly presence; intentionally retained','changed_first_channel_opportunities_vs_raw':len(different),'weekly_minus_raw_pipeline_by_channel':delta,'total_pipeline_delta':sum(delta.values())}
effects['canonical']={'opportunities':len(opps),'wins':int(opps.won.sum()),'linked365':int(weekly._opportunity_id.nunique())}
normalizer=case.normalize_domain
case.normalize_domain=lambda series: series.fillna('').astype(str).str.strip().str.lower().replace({'':pd.NA,'nan':pd.NA})
old_opps,_=case.canonical_population();old_touches,_=case.touchpoints();old_linked=case.linked_touches(old_opps,old_touches,365)
case.normalize_domain=normalizer
old_ids=set(old_linked._opportunity_id);new_ids=set(weekly._opportunity_id)
effects['domain_linkage_effect']={'old_linked365':len(old_ids),'new_linked365':len(new_ids),'newly_linked':len(new_ids-old_ids),'no_longer_linked':len(old_ids-new_ids),'canonical_domain_coverage_old':int(old_opps.domain.notna().sum()),'canonical_domain_coverage_new':int(opps.domain.notna().sum())}
print(json.dumps(effects,indent=2))
Path('audit/analytics_identity_effects.json').write_text(json.dumps(effects,indent=2),encoding='utf-8')
