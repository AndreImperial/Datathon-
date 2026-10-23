import json
import tempfile
import unittest
from pathlib import Path
import pandas as pd
from artifact_safety import assert_public_fields, load_contract
from source_control import check_source_schema
from contract_fixtures import v3

class PublicContractTests(unittest.TestCase):
    def test_nested_private_fields_rejected(self):
        for field in ('_opportunity_id', '_account_name', '_current_stage', '_amount', 'email', 'contact_name', 'domain'):
            with self.subTest(field=field), self.assertRaises(ValueError):
                assert_public_fields({'datasets': {'rows': [{field: 'private'}]}})

    def test_aggregate_commercial_totals_allowed(self):
        assert_public_fields({'datasets': {'aggregate': [{'channel': 'Paid', 'amount': -20, 'pipeline': 400, 'active_opportunities': 10}]}})

    def test_declared_empty_v3_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'v3.json'
            payload=v3(); payload["datasets"]["model"]=[]; payload["dataset_status"]["model"]={"status":"unavailable","reason":"insufficient history"}
            path.write_text(json.dumps(payload))
            self.assertEqual(load_contract(path,3)['datasets']['model'], [])

class SourceSchemaTests(unittest.TestCase):
    def test_columns_and_missing_inventory_are_actionable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            sources=root/'data'/'raw'; sources.mkdir(parents=True)
            workbook=sources/'source.xlsx'
            pd.DataFrame({'date': [], 'value': []}).to_excel(workbook,index=False)
            (root/'source_schema.json').write_text(json.dumps({'sources':{'source.xlsx':{'Sheet1':['date','value']}}}))
            self.assertIn('matches',check_source_schema(root)['schema_status'])
            pd.DataFrame({'date': [], 'renamed': []}).to_excel(workbook,index=False)
            with self.assertRaisesRegex(ValueError,'column drift'):
                check_source_schema(root)
            workbook.unlink()
            with self.assertRaisesRegex(ValueError,'inventory drift'):
                check_source_schema(root)

if __name__ == '__main__': unittest.main()
