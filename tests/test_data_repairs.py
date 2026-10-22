import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/'analytics_case_study'/f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
integration = load('02_data_integration')
attribution = load('03b_attribution')
cleaning = load('01_data_cleaning')
class DataRepairTests(unittest.TestCase):
    def test_deleted_load_filters_boolean_and_string_flags_without_mutating_snapshot(self):
        snapshot = pd.DataFrame({'isdeleted': [False, True, 'true', '0', None], '_amount': [1,2,3,4,5]})
        with patch.object(pd, 'read_parquet', return_value=snapshot):
            actual = integration._load('opportunities')
        self.assertEqual(actual['_amount'].tolist(), [1,4,5])
        self.assertEqual(len(snapshot), 5)
    def test_real_snapshot_reconciles_canonical_population(self):
        snapshot = pd.read_parquet(ROOT/'data/cleaned/opportunities.parquet')
        from analytics_case_study.utils.population import canonical_opportunities
        actual = canonical_opportunities(snapshot)
        self.assertEqual(len(snapshot),3288)
        self.assertEqual(len(actual),3245)
        self.assertAlmostEqual(actual['_amount'].sum(),24876699.31,places=2)
        self.assertAlmostEqual(actual.loc[actual['iswon'].eq(True),'_amount'].sum(),5419871.93,places=2)
    def test_raw_same_week_touches_survive_build_until_linking(self):
        campaign = pd.DataFrame({'_6sensedomain':['x.test']*2, '_date':pd.to_datetime(['2024-01-01','2024-01-05'],utc=True)})
        with patch.object(pd,'read_parquet',side_effect=[campaign,pd.DataFrame(),pd.DataFrame()]), patch.object(pd.DataFrame,'to_parquet'):
            actual = attribution.build_touchpoints()
        self.assertEqual(len(actual),2)
    def test_account_latest_row_does_not_backfill_old_domain(self):
        raw = pd.DataFrame({'accountid':['a','a'], 'createddate':['2020-01-01','2021-01-01'], 'domain__c':['old.test',None]})
        with patch.object(cleaning, '_read_xlsx', return_value=raw), patch.object(pd.DataFrame,'to_parquet'):
            actual = cleaning.clean_account_log()
        self.assertTrue(pd.isna(actual.iloc[0]['domain__c']))
    def test_domain_activity_is_conserved_across_shared_accounts(self):
        accounts = pd.DataFrame({'accountid':['a','b'], 'domain__c':['shared.test']*2})
        segments = pd.DataFrame(columns=['_6sensedomain','_segment','segment_category','_6senseemployeerange','_6senserevenuerange'])
        campaign = pd.DataFrame({'_6sensedomain':['shared.test'], '_spend':[100.], '_clicks':[3], '_impressions':[1000], '_influencedformfills':[1]})
        email = pd.DataFrame({'_domain':['shared.test'], 'is_open':[True], 'is_click':[True], 'is_register':[False], '_campaignID':['c']})
        web = pd.DataFrame({'_domain':['shared.test'], '_totalsessionviews':[7], 'is_goal_completed':[True]})
        actual = integration.build_master_account(accounts, segments, campaign, email, web, pd.DataFrame(), pd.DataFrame())
        self.assertEqual(actual.campaign_spend.sum(),100)
        self.assertEqual(actual.email_clicks.sum(),1)
        self.assertEqual(actual.web_pageviews.sum(),7)
    def test_tied_first_last_dates_split_credit_by_distinct_channel(self):
        linked = pd.DataFrame({'_opportunity_id':['o']*3, 'channel':['email_mqa','email_mqa','6sense_display'], 'touchpoint_date':pd.to_datetime(['2024-01-01']*3,utc=True), '_amount':[120]*3, 'iswon':[True]*3, 'days_before_opp':[1]*3})
        opps = pd.DataFrame({'_opportunity_id':['o'],'_amount':[120],'iswon':[True],'channel_category':['email_mqa'],'is_marketing_sourced':[True]})
        results = attribution.apply_attribution_models(linked,opps)
        for model in ['First-Touch','Last-Touch']:
            result = results[model].set_index('channel')
            self.assertEqual(set(result.index),{'email_mqa','6sense_display'})
            self.assertEqual(result['attributed_pipeline'].to_dict(),{'email_mqa':60.,'6sense_display':60.})
            self.assertEqual(result['attributed_won'].sum(),120)
    def test_weekly_normalization_follows_opportunity_eligibility(self):
        opps = pd.DataFrame({'_opportunity_id':['early','later'], '_account_id':['a']*2, '_createdate':pd.to_datetime(['2024-01-03','2024-01-06'],utc=True), '_amount':[100,200], 'channel_category':['email_mqa']*2, 'is_marketing_sourced':[True]*2, 'iswon':[True,False]})
        accounts = pd.DataFrame({'accountid':['a'], 'domain__c':['x.test']})
        touches = pd.DataFrame({'domain':['x.test']*3, 'touchpoint_date':pd.to_datetime(['2024-01-01','2024-01-02','2024-01-05'],utc=True), 'channel':['email_mqa']*3, 'touchpoint_type':['email_click']*3, 'campaign_id':['c']*3})
        with patch.object(pd,'read_parquet',side_effect=[opps,accounts]):
            linked, _ = attribution.link_touchpoints_to_opps(touches)
        self.assertEqual(len(linked),2)
        dates = linked.set_index('_opportunity_id').touchpoint_date
        self.assertEqual(dates['early'],pd.Timestamp('2024-01-02',tz='UTC'))
        self.assertEqual(dates['later'],pd.Timestamp('2024-01-05',tz='UTC'))
if __name__ == '__main__': unittest.main()
