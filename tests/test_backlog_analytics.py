import importlib.util
from pathlib import Path
import unittest
import pandas as pd
from analytics_case_study.utils.cleaning_helpers import normalize_domain, email_person_identity
from analytics_case_study.utils.diagnostics import duration_diagnostics

def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1]/'analytics_case_study'/f'{name}.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

class BacklogAnalyticsTests(unittest.TestCase):
    def test_domain_is_explicit_hostname_not_guessed_identity(self):
        values = normalize_domain(pd.Series([' HTTPS://WWW.Example.COM/path?q=a ', 'user@example.com','example.com/path','bad domain','no-company',None]))
        self.assertEqual(values.iloc[:3].tolist(), ['example.com']*3)
        self.assertTrue(values.iloc[3:].isna().all())

    def test_email_fallback_is_valid_and_preserves_primary(self):
        result = email_person_identity(pd.DataFrame({'_prospectID':['p1',None,None], '_email':['A@EXAMPLE.COM',' B@example.com ','not-an-email']}))
        self.assertEqual(result.iloc[:2].tolist(), ['p1','b@example.com'])
        self.assertTrue(pd.isna(result.iloc[2]))

    def test_velocity_reconciles_same_day_negative_upper_bound_missing(self):
        eligible, summary = duration_diagnostics(pd.DataFrame({'days_to_close':[0,1,-1,731,None], 'channel_category':['email']*5,'_type':['new business - mrr']*5}))
        self.assertEqual(eligible.days_to_close.tolist(),[0,1])
        self.assertEqual(summary.wins.sum(),5)
        self.assertEqual(set(summary.duration_status), {'eligible same-day','eligible positive','negative interval','over 730 days','missing dates'})

    def test_unmeasured_spend_stays_null_and_paid_period_excludes_old_deal(self):
        integration=module('02_data_integration')
        opps=pd.DataFrame({'_opportunity_id':['old','new','email'], 'channel_category':['linkedin','linkedin','email'], '_amount':[1000,0,20], 'iswon':[True,False,True], 'current_stage':['Closed Won','Closed Lost','Closed Won'], '_createdate (Date)':pd.to_datetime(['2020-01-01','2024-02-01','2024-02-01'],utc=True)})
        ads=pd.DataFrame({'_platform':['LinkedIn','LinkedIn'], '_spend':[50,50],'day':['2024-01-01','2024-03-01']})
        result=integration.build_channel_pipeline(opps,pd.DataFrame(),ads).set_index('channel_category')
        self.assertTrue(pd.isna(result.loc['email','channel_spend']))
        self.assertTrue(pd.isna(result.loc['email','cost_per_opp']))
        self.assertEqual(result.loc['linkedin','total_pipeline'],1000)
        self.assertEqual(result.loc['linkedin','period_matched_opportunities'],1)
        self.assertEqual(result.loc['linkedin','pipeline_roi'],0)

    def test_unknown_motion_comparison_unavailable_not_zero(self):
        case=module('03d_case_analysis')
        opps=pd.DataFrame({'created_year':[2024], 'created_at':pd.to_datetime(['2024-02-01'],utc=True),'business_motion':['Unknown']})
        result=case.motion_coverage(opps).iloc[0]
        self.assertTrue(pd.isna(result.acquisition_opportunities))
        self.assertEqual(result.unknown_motion_opportunities,1)

    def test_web_counts_distinct_grains_without_conversion(self):
        integration=module('02_data_integration')
        opps=pd.DataFrame({'_opportunity_id':['a'],'iswon':[False],'is_marketing_sourced':[False]})
        web=pd.DataFrame({'_recordingid':['r','r','s'],'_visitorid':['v','v','v'],'is_goal_completed':[True,None,None]})
        result=integration.build_funnel_metrics(pd.DataFrame(),pd.DataFrame(),pd.DataFrame(),opps,web)
        rows=result[result.channel.eq('Web')].set_index('stage')
        self.assertEqual(rows.loc['Recorded web events','count'],3)
        self.assertEqual(rows.loc['Unique recordings (session definition unverified)','count'],2)
        self.assertEqual(rows.loc['Unknown contact-flag rows','count'],2)
        self.assertTrue(rows.conversion_from_prev.isna().all())

    def test_weekly_presence_policy_differs_from_raw_first_and_is_documented(self):
        case=module('03d_case_analysis')
        touches=pd.DataFrame({'domain':['example.com']*3, 'timestamp':pd.to_datetime(['2024-06-03','2024-06-04','2024-06-05'],utc=True),'channel':['6sense display','Email','6sense display'],'source':['test']*3})
        opps=pd.DataFrame({'_opportunity_id':['o'],'domain':['example.com'],'created_at':pd.to_datetime(['2024-06-08'],utc=True),'amount':[10000],'won':[False],'resolved':[False],'segment':['Mid'],'business_motion':['Acquisition'],'channel_category':['other']})
        linked=case.linked_touches(opps,touches,365)
        self.assertEqual(touches.sort_values('timestamp').iloc[0].channel,'6sense display')
        self.assertEqual(linked.sort_values('timestamp').iloc[0].channel,'Email')
        appendix=case.build_appendix({'opportunities':1,'resolved':0,'won':0,'eligible_domains':0})
        self.assertIn('retained weekly presence',appendix[2]['body'])

if __name__ == '__main__':
    unittest.main()
