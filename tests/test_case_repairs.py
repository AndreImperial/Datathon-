import importlib.util
import unittest
from pathlib import Path

import pandas as pd

SPEC = importlib.util.spec_from_file_location('case_repairs', Path(__file__).parents[1] / 'analytics_case_study/03d_case_analysis.py')
case = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(case)


class CaseRepairTests(unittest.TestCase):
    def test_week_compression_preserves_touch_before_creation(self):
        touches = pd.DataFrame({'domain': ['example.com'] * 2,
            'timestamp': pd.to_datetime(['2024-06-03', '2024-06-07'], utc=True),
            'channel': ['Email'] * 2, 'source': ['Email'] * 2})
        compressed = case.normalize_touchpoints(touches)
        opps = pd.DataFrame({'_opportunity_id': ['o1'], 'domain': ['example.com'],
            'created_at': pd.to_datetime(['2024-06-05'], utc=True), 'amount': [100],
            'won': [True], 'resolved': [True], 'segment': ['Commercial'],
            'business_motion': ['Acquisition'], 'channel_category': ['referral']})
        linked = case.linked_touches(opps, compressed, 365)
        self.assertEqual(len(linked), 1)
        self.assertEqual(linked.iloc[0]['timestamp'], pd.Timestamp('2024-06-03', tz='UTC'))

    def test_group_entry_is_not_within_group_improvement(self):
        opps = pd.DataFrame({'created_at': pd.to_datetime(['2022-02-01', '2024-02-01', '2024-02-02'], utc=True),
            'resolved': [True] * 3, 'won': [False, False, True], 'channel_category': ['base', 'base', 'new']})
        result = case.decomposition(opps, 'channel_category').set_index('group')
        self.assertTrue(pd.isna(result.loc['new', 'within_effect_pp']))
        self.assertTrue(pd.isna(result.loc['new', 'period_a_win_rate']))
        self.assertAlmostEqual(result.loc['new', 'entry_exit_effect_pp'], 50)
        self.assertAlmostEqual(result['total_effect_pp'].sum(), 50)

    def test_appendix_has_evidence_and_topic_specific_methods(self):
        summary = {'opportunities': 3245, 'resolved': 2834, 'won': 1070, 'eligible_domains': 2032, 'linked_365': 684}
        slides = case.build_appendix(summary)
        self.assertEqual(len(slides), 6)
        self.assertTrue(all(len(s['body'].split()) >= 18 and s['chart_refs'] for s in slides))
        self.assertIn('sent', slides[1]['body'])
        self.assertIn('MRR', slides[-1]['body'])
        self.assertIn('withdrawn', slides[-1]['body'])

    def test_source_groups_follow_marketing_flag_then_lead_source(self):
        opps = pd.DataFrame({'_leadsource': ['Referral: Client', 'Channel Referral: 6sense', 'Existing Client', 'Sales Proactive - A', 'Inbound: Dom', 'CCO'],
            'is_marketing_sourced': [False, True, False, False, False, False]})
        self.assertEqual(case.source_group(opps).tolist(), ['Referral', 'Marketing-sourced', 'Existing client', 'Sales proactive', 'Inbound', 'Other'])

    def test_existing_client_is_reported_but_not_ranked_as_acquisition_channel(self):
        rows = []
        for group, wins in [('Referral', 3), ('Marketing-sourced', 1), ('Existing client', 9)]:
            for i in range(10):
                rows.append({'source_group': group, 'business_motion': 'Acquisition', 'created_year': 2024, 'resolved': True, 'won': i < wins, 'amount': 100.0 if i < wins else 0.0, 'mrr': 0.0})
        result = case.source_group_scorecard(pd.DataFrame(rows))
        recent = result[result['scope'].eq('2023–2024')].set_index('source_group')
        self.assertTrue(pd.isna(recent.loc['Existing client', 'win_rate_rank']))
        self.assertEqual(recent.loc['Referral', 'win_rate_rank'], 1)
        self.assertEqual(recent.loc['Marketing-sourced', 'win_rate_rank'], 2)
        self.assertEqual(recent['opportunities'].sum(), 30)


if __name__ == '__main__':
    unittest.main()
