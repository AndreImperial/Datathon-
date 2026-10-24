import importlib.util
import math
import unittest
from pathlib import Path

import pandas as pd

SPEC = importlib.util.spec_from_file_location('case_evidence', Path(__file__).parents[1] / 'analytics_case_study/03d_case_analysis.py')
case = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(case)


class PilotLiftSolverTests(unittest.TestCase):
    def test_solved_lift_round_trips_through_experiment_formula(self):
        for baseline in case.PILOT_BASELINES:
            for arm in (250, 1017, 4000):
                lift = case.detectable_lift(baseline, arm)
                self.assertGreater(lift, 0)
                self.assertAlmostEqual(case.per_arm_requirement(baseline, lift), arm, delta=1e-6)

    def test_solver_agrees_with_experiment_scenarios(self):
        # experiments() rounds the same requirement up; solving at that n recovers its lift.
        scenarios = case.experiments(2034)
        for row in scenarios.itertuples():
            lift = case.detectable_lift(row.baseline_rate, row.required_per_arm)
            self.assertLessEqual(lift, row.absolute_lift + 1e-9)
            self.assertLessEqual(math.ceil(case.per_arm_requirement(row.baseline_rate, lift)), row.required_per_arm)

    def test_pilot_design_uses_full_audience_split(self):
        pilot = case.pilot_design(2035).set_index('baseline_rate')
        self.assertEqual(list(pilot.index), [0.02, 0.05, 0.10])
        self.assertTrue((pilot['arm_size'] == 1017).all())
        self.assertTrue((pilot['total_accounts'] == 2035).all())
        row = pilot.loc[0.05]
        self.assertAlmostEqual(row['treatment_rate'], 0.05 + row['detectable_lift'])
        self.assertEqual(row['detectable_lift_pp'], round(row['detectable_lift'] * 100, 1))
        # Larger baselines need a larger absolute lift at the same sample.
        self.assertTrue(pilot['detectable_lift'].is_monotonic_increasing)


class MrrRelationshipTests(unittest.TestCase):
    def test_bucketing_uses_five_percent_bands(self):
        label = case.mrr_relationship_label
        self.assertEqual(label(500.0, 500.0), 'Amount equals MRR')
        self.assertEqual(label(1030.0, 1000.0), 'Amount equals MRR')
        self.assertEqual(label(3100.0, 1000.0), 'Amount ≈ 3× MRR')
        self.assertEqual(label(5750.0, 1000.0), 'Amount ≈ 6× MRR')
        self.assertEqual(label(12500.0, 1000.0), 'Amount ≈ 12× MRR')
        self.assertEqual(label(3200.0, 1000.0), 'Other ratio')
        self.assertEqual(label(13000.0, 1000.0), 'Other ratio')

    def test_dataset_counts_only_both_positive_wins(self):
        won = pd.DataFrame({'amount': [100, 100, 300, 1200, 0, 50, None, 700],
                            'mrr':    [100, 100, 100, 100, 90, 0, 10, 100]})
        frame = case.mrr_amount_relationship(won).set_index('relationship')
        self.assertEqual(int(frame['wins'].sum()), 5)
        self.assertEqual(frame.loc['Amount equals MRR', 'wins'], 2)
        self.assertEqual(frame.loc['Amount ≈ 3× MRR', 'wins'], 1)
        self.assertEqual(frame.loc['Amount ≈ 12× MRR', 'wins'], 1)
        self.assertEqual(frame.loc['Other ratio', 'wins'], 1)
        self.assertAlmostEqual(frame['share'].sum(), 1.0, places=12)
        self.assertTrue(frame['wins'].is_monotonic_decreasing)


if __name__ == '__main__':
    unittest.main()
