import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd


SPEC = importlib.util.spec_from_file_location(
    "temporal_advanced", Path(__file__).parents[1] / "analytics_case_study/03c_advanced_analytics.py"
)
advanced = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(advanced)


class TemporalModelTests(unittest.TestCase):
    def test_training_cannot_use_future_resolution_and_test_requires_mature_horizon(self):
        created = pd.date_range("2020-01-01", periods=30, freq="60D", tz="UTC")
        df = pd.DataFrame({"_opportunity_id": [str(i) for i in range(30)], "_model_create_date": created})
        events = pd.DataFrame({
            "_opportunity_id": df["_opportunity_id"],
            "current_stage": ["Closed Won" if i % 2 else "Closed Lost" for i in range(30)],
            "_current_stage_change_date": created + pd.Timedelta(days=10),
        })
        # Creation is early but its outcome was learned years after the cutoff.
        events.loc[0, "_current_stage_change_date"] = created[-1]
        train, test, eligible, stats = advanced._temporal_model_population(df, events)
        cutoff = pd.Timestamp(stats["validation_cutoff"])
        observed = pd.Timestamp(stats["observation_end"])
        self.assertNotIn("0", set(train["_opportunity_id"]))
        self.assertTrue(train["_event_date"].le(cutoff).all())
        self.assertTrue(train["_horizon_end"].le(cutoff).all())
        self.assertTrue(test["_model_create_date"].gt(cutoff).all())
        self.assertTrue(test["_horizon_end"].le(observed).all())
        self.assertNotIn("29", set(eligible["_opportunity_id"]))
        self.assertGreater(len(test), 0)

    def test_historical_stage_defines_label_instead_of_latest_won_flag(self):
        created = pd.date_range("2020-01-01", periods=30, freq="60D", tz="UTC")
        df = pd.DataFrame({"_opportunity_id": [str(i) for i in range(30)], "_model_create_date": created, "iswon": False})
        events = pd.DataFrame({"_opportunity_id": df["_opportunity_id"], "current_stage": "Closed Won", "_current_stage_change_date": created + pd.Timedelta(days=10)})
        # A later loss must not replace the first recorded terminal win label.
        events.loc[len(events)] = ["0", "Closed Lost", created[0] + pd.Timedelta(days=50)]
        _, _, eligible, _ = advanced._temporal_model_population(df, events)
        self.assertEqual(eligible.set_index("_opportunity_id").loc["0", "_model_won"], 1)

    def test_conflicting_terminal_events_are_excluded(self):
        created = pd.date_range("2020-01-01", periods=30, freq="60D", tz="UTC")
        df = pd.DataFrame({"_opportunity_id": [str(i) for i in range(30)], "_model_create_date": created})
        events = pd.DataFrame({"_opportunity_id": df["_opportunity_id"], "current_stage": "Closed Won", "_current_stage_change_date": created + pd.Timedelta(days=10)})
        events.loc[len(events)] = ["0", "Closed Lost", created[0] + pd.Timedelta(days=10)]
        _, _, eligible, stats = advanced._temporal_model_population(df, events)
        self.assertNotIn("0", set(eligible["_opportunity_id"]))
        self.assertEqual(stats["ambiguous_outcome_rows"], 1)

    def test_unavailable_history_clears_stale_scores_and_has_safe_diagnostics(self):
        df = pd.DataFrame({"_opportunity_id": ["a"], "current_stage": ["Discovery"], "_createdate (Date)": ["2020-01-01"], "iswon": [False], "isdeleted": [False]})
        with tempfile.TemporaryDirectory() as directory, patch.object(advanced, "opps", df), patch.object(advanced, "_load_model_history", return_value=pd.DataFrame()), patch.object(advanced, "INTEGRATED_DATA_DIR", directory):
            pd.DataFrame({"win_probability": [0.99]}).to_parquet(Path(directory) / "win_probability.parquet")
            _, scores, stats, calibration = advanced.build_win_probability()
            self.assertTrue(pd.read_parquet(Path(directory) / "win_probability.parquet").empty)
        self.assertTrue(scores.empty)
        self.assertTrue(calibration.empty)
        self.assertEqual(stats["canonical_active_rows"], 1)
        self.assertEqual(stats["active_scored_rows"], 0)
        self.assertIn("not run", stats["validation"])

    def test_canonical_filter_preserves_unknown_and_removes_explicit_deletions(self):
        df = pd.DataFrame({"isdeleted": [True, "true", "YES", "1", False, None], "_opportunity_id": list("abcdef")})
        self.assertEqual(list(advanced._canonical_opportunities(df)["_opportunity_id"]), ["e", "f"])


if __name__ == "__main__":
    unittest.main()
