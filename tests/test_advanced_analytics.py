import importlib.util
import unittest
from pathlib import Path

import pandas as pd


MODULE_PATH = Path(__file__).parents[1] / "analytics_case_study" / "03c_advanced_analytics.py"
SPEC = importlib.util.spec_from_file_location("advanced_analytics", MODULE_PATH)
advanced_analytics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(advanced_analytics)


class CanonicalPopulationTests(unittest.TestCase):
    def test_canonical_filter_preserves_unknown_and_removes_explicit_deletions(self):
        df = pd.DataFrame({"isdeleted": [True, "true", "YES", "1", False, None], "_opportunity_id": list("abcdef")})
        self.assertEqual(list(advanced_analytics._canonical_opportunities(df)["_opportunity_id"]), ["e", "f"])

    def test_withdrawn_model_is_not_built(self):
        self.assertFalse(hasattr(advanced_analytics, "build_win_probability"))


if __name__ == "__main__":
    unittest.main()
