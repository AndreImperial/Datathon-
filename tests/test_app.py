import tempfile
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module
from contract_fixtures import context, v2, v3


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.public_dir = Path(self.temp_dir.name) / "public"
        self.assets_dir = self.public_dir / "assets"
        self.assets_dir.mkdir(parents=True)

        self.context_path = self.public_dir / "dashboard_context.json"
        self.dashboard_data_path = self.public_dir / "dashboard-data.json"
        self.case_study_data_path = self.public_dir / "dashboard-data-v3.json"
        self.index_path = self.public_dir / "index.html"
        self.favicon_path = self.public_dir / "favicon.svg"
        self.javascript_path = self.assets_dir / "index-test.js"
        self.stylesheet_path = self.assets_dir / "index-test.css"
        (self.public_dir / "full-analysis").mkdir()
        self.legacy_dashboard_path = self.public_dir / "full-analysis" / "index.html"

        self.context_path.write_text(json.dumps(context()), encoding="utf-8")
        self.dashboard_data_path.write_text(json.dumps(v2()), encoding="utf-8")
        self.case_study_data_path.write_text(json.dumps(v3()), encoding="utf-8")
        (self.public_dir / ".vite").mkdir()
        (self.public_dir / ".vite/manifest.json").write_text(json.dumps({"entry":{"file":"assets/index-test.js","isEntry":True,"dynamicImports":["lazy"]},"lazy":{"file":"assets/lazy-test.js"}}),encoding="utf-8")
        (self.assets_dir / "lazy-test.js").write_text("",encoding="utf-8")
        self.index_path.write_text(
            """<!doctype html>
<link rel="icon" href="./favicon.svg">
<script type="module" src="./assets/index-test.js"></script>
<link rel="stylesheet" href="./assets/index-test.css">
""",
            encoding="utf-8",
        )
        self.favicon_path.write_text("<svg></svg>", encoding="utf-8")
        self.javascript_path.write_text("", encoding="utf-8")
        self.stylesheet_path.write_text("", encoding="utf-8")
        self.legacy_dashboard_path.write_text("<!doctype html>", encoding="utf-8")

        self.path_patch = patch.multiple(
            app_module,
            PUBLIC_DIR=self.public_dir,
            CONTEXT_PATH=self.context_path,
            DASHBOARD_DATA_PATH=self.dashboard_data_path,
            CASE_STUDY_DATA_PATH=self.case_study_data_path,
            INDEX_PATH=self.index_path,
            LEGACY_DASHBOARD_PATH=self.legacy_dashboard_path,
        )
        self.path_patch.start()
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.path_patch.stop()
        self.temp_dir.cleanup()

    def get_health(self):
        response = self.client.get("/health")
        try:
            return response.status_code, response.get_json()
        finally:
            response.close()

    def test_health_is_ready_when_required_artifacts_exist(self):
        status_code, payload = self.get_health()

        self.assertEqual(status_code, 200)
        self.assertEqual(
            payload,
            {
                "ok": True,
                "index": True,
                "assets": True,
                "favicon": True,
                "context": True,
                "dashboard_data": True,
                "case_study_data": True,
                "legacy_archive": True,
            },
        )

    def test_empty_structural_contract_is_unavailable(self):
        self.case_study_data_path.write_text(json.dumps({"schema_version":3,"meta":{"snapshot_id":"fixture"},"datasets":{},"dataset_status":{},"presentation":{"slides":[]}}))
        self.assertFalse(self.get_health()[1]["case_study_data"])

    def test_malformed_contract_is_unavailable(self):
        self.case_study_data_path.write_text("{broken", encoding="utf-8")
        self.assertEqual(self.get_health()[0], 503)

    def test_missing_lazy_chunk_is_unavailable(self):
        (self.assets_dir / "lazy-test.js").unlink()
        self.assertFalse(self.get_health()[1]["assets"])

    def test_private_field_is_unavailable(self):
        data = json.loads(self.dashboard_data_path.read_text())
        data["datasets"]["private"] = [{"_account_name": "fixture"}]
        self.dashboard_data_path.write_text(json.dumps(data))
        self.assertFalse(self.get_health()[1]["dashboard_data"])

    def test_incompatible_contract_is_unavailable(self):
        self.dashboard_data_path.write_text('{"schema_version":99}')
        self.assertEqual(self.get_health()[0], 503)

    def test_health_is_unavailable_when_index_is_missing(self):
        self.index_path.unlink()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 503)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["index"])
        self.assertFalse(payload["assets"])

    def test_health_is_unavailable_when_v3_dashboard_data_is_missing(self):
        self.case_study_data_path.unlink()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 503)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["case_study_data"])

    def test_health_is_unavailable_when_referenced_asset_is_missing(self):
        self.javascript_path.unlink()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 503)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["assets"])

    def test_health_is_unavailable_when_favicon_is_missing(self):
        self.favicon_path.unlink()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 503)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["favicon"])

    def test_health_is_unavailable_when_legacy_archive_is_missing(self):
        self.legacy_dashboard_path.unlink()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 503)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["legacy_archive"])

    def test_empty_backend_data_directories_do_not_affect_readiness(self):
        (Path(self.temp_dir.name) / "cleaned").mkdir()
        (Path(self.temp_dir.name) / "integrated").mkdir()

        status_code, payload = self.get_health()

        self.assertEqual(status_code, 200)
        self.assertNotIn("backend_data", payload)

    def test_compiled_homepage_serves_its_favicon(self):
        homepage = self.client.get("/")
        try:
            self.assertEqual(homepage.status_code, 200)
            self.assertIn('href="./favicon.svg"', homepage.get_data(as_text=True))
        finally:
            homepage.close()

        favicon = self.client.get("/favicon.svg")
        try:
            self.assertEqual(favicon.status_code, 200)
        finally:
            favicon.close()


if __name__ == "__main__":
    unittest.main()
