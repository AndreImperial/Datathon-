import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd


MODULE_PATH = Path(__file__).parents[1] / "analytics_case_study" / "03c_advanced_analytics.py"
SPEC = importlib.util.spec_from_file_location("advanced_analytics", MODULE_PATH)
advanced_analytics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(advanced_analytics)


class WinProbabilityDeletionTests(unittest.TestCase):
    def test_deleted_opportunities_are_excluded_before_resolved_and_active_split(self):
        rows = []
        for index in range(200):
            won = index % 2 == 0
            rows.append(
                {
                    "_opportunity_id": f"resolved-{index}",
                    "_account_name": f"Account {index}",
                    "current_stage": "Closed Won" if won else "Closed Lost",
                    "_createdate (Date)": pd.Timestamp("2020-01-01", tz="UTC")
                    + pd.Timedelta(days=index * 10),
                    "iswon": won,
                    "isdeleted": False,
                    "_amount": 1000 + index,
                    "channel_category": "sales" if won else "referral",
                    "segment__c": "Enterprise" if won else "SMB",
                }
            )

        rows.extend(
            [
                {
                    "_opportunity_id": "resolved-unknown-deletion",
                    "_account_name": "Unknown deletion flag",
                    "current_stage": "Closed Won",
                    "_createdate (Date)": pd.Timestamp("2020-07-19", tz="UTC"),
                    "iswon": True,
                    "isdeleted": np.nan,
                    "_amount": 5000,
                    "channel_category": "sales",
                    "segment__c": "Enterprise",
                },
                {
                    "_opportunity_id": "deleted-resolved",
                    "_account_name": "Deleted resolved",
                    "current_stage": "Closed Lost",
                    "_createdate (Date)": pd.Timestamp("2020-07-20", tz="UTC"),
                    "iswon": False,
                    "isdeleted": True,
                    "_amount": 6000,
                    "channel_category": "referral",
                    "segment__c": "SMB",
                },
                {
                    "_opportunity_id": "active-retained-1",
                    "_account_name": "Active retained 1",
                    "current_stage": "Discovery",
                    "_createdate (Date)": pd.Timestamp("2021-01-01", tz="UTC"),
                    "iswon": False,
                    "isdeleted": False,
                    "_amount": 7000,
                    "channel_category": "sales",
                    "segment__c": "Enterprise",
                },
                {
                    "_opportunity_id": "active-retained-2",
                    "_account_name": "Active retained 2",
                    "current_stage": "Qualification",
                    "_createdate (Date)": pd.Timestamp("2021-01-02", tz="UTC"),
                    "iswon": False,
                    "isdeleted": False,
                    "_amount": 8000,
                    "channel_category": "referral",
                    "segment__c": "SMB",
                },
                {
                    "_opportunity_id": "active-unknown-deletion",
                    "_account_name": "Active unknown deletion",
                    "current_stage": "Proposal",
                    "_createdate (Date)": pd.Timestamp("2021-01-03", tz="UTC"),
                    "iswon": False,
                    "isdeleted": np.nan,
                    "_amount": 9000,
                    "channel_category": "sales",
                    "segment__c": "Enterprise",
                },
                {
                    "_opportunity_id": "deleted-active",
                    "_account_name": "Deleted active",
                    "current_stage": "Discovery",
                    "_createdate (Date)": pd.Timestamp("2021-01-04", tz="UTC"),
                    "iswon": False,
                    "isdeleted": True,
                    "_amount": 10000,
                    "channel_category": "referral",
                    "segment__c": "SMB",
                },
            ]
        )

        source = pd.DataFrame(rows)
        history = pd.DataFrame({
            "_opportunity_id": source["_opportunity_id"],
            "current_stage": source["current_stage"],
            "_current_stage_change_date": pd.to_datetime(source["_createdate (Date)"], utc=True) + pd.Timedelta(days=10),
        })
        # A dated active-stage event supplies the observation boundary; planned
        # close dates never establish maturity.
        history.loc[len(history)] = ["active-retained-1", "Discovery", pd.Timestamp("2027-01-01", tz="UTC")]
        with tempfile.TemporaryDirectory() as output_dir, patch.object(
            advanced_analytics, "opps", pd.DataFrame(rows)
        ), patch.object(advanced_analytics, "INTEGRATED_DATA_DIR", output_dir), patch.object(
            advanced_analytics, "_load_model_history", return_value=history
        ):
            importance, active_scored, diagnostics, _ = advanced_analytics.build_win_probability()

        self.assertEqual(diagnostics["canonical_resolved_rows"], 201)
        self.assertEqual(diagnostics["canonical_active_rows"], 3)
        self.assertGreater(diagnostics["train_rows"], 100)
        self.assertGreater(diagnostics["test_rows"], 20)
        self.assertEqual(set(importance["feature"]), {"create_year", "create_quarter"})
        self.assertEqual(diagnostics["active_scored_rows"], 3)
        self.assertEqual(
            set(active_scored["_opportunity_id"]),
            {"active-retained-1", "active-retained-2", "active-unknown-deletion"},
        )


if __name__ == "__main__":
    unittest.main()
