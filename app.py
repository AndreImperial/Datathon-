import os
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from flask import Flask, jsonify, send_from_directory
from artifact_safety import load_contract, manifest_assets_exist


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
INDEX_PATH = PUBLIC_DIR / "index.html"
CONTEXT_PATH = PUBLIC_DIR / "dashboard_context.json"
DASHBOARD_DATA_PATH = PUBLIC_DIR / "dashboard-data.json"
CASE_STUDY_DATA_PATH = PUBLIC_DIR / "dashboard-data-v3.json"
LEGACY_DASHBOARD_PATH = ROOT / "outputs" / "dashboard" / "Marketing_Analytics_Dashboard.html"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


class _AssetReferenceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        reference = attributes.get("src") if tag == "script" else attributes.get("href")
        if reference:
            self.references.append(reference)


def _compiled_assets_exist():
    if not INDEX_PATH.is_file():
        return False

    try:
        parser = _AssetReferenceParser()
        parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
        public_dir = PUBLIC_DIR.resolve()

        for reference in parser.references:
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc:
                continue

            asset_path = Path(unquote(parsed.path))
            if asset_path.suffix.lower() not in {".js", ".css"}:
                continue

            if parsed.path.startswith("/"):
                candidate = PUBLIC_DIR / parsed.path.lstrip("/")
            else:
                candidate = INDEX_PATH.parent / asset_path
            candidate = candidate.resolve()
            if not candidate.is_relative_to(public_dir) or not candidate.is_file():
                return False
    except (OSError, UnicodeError, ValueError):
        return False

    return manifest_assets_exist(PUBLIC_DIR)


def _contract_ready(path, version=None):
    try:
        load_contract(path, version)
        return True
    except (OSError, ValueError, TypeError, KeyError):
        return False


@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/health")
def health():
    checks = {
        "index": INDEX_PATH.is_file(),
        "assets": _compiled_assets_exist(),
        "favicon": (PUBLIC_DIR / "favicon.svg").is_file(),
        "context": _contract_ready(CONTEXT_PATH),
        "dashboard_data": _contract_ready(DASHBOARD_DATA_PATH, 2),
        "case_study_data": _contract_ready(CASE_STUDY_DATA_PATH, 3),
        "legacy_archive": (PUBLIC_DIR / "full-analysis" / "index.html").is_file(),
    }
    ready = all(checks.values())
    return jsonify({"ok": ready, **checks}), 200 if ready else 503


@app.get("/full-analysis")
@app.get("/full-analysis/")
def full_analysis():
    """Serve the original complete Plotly dashboard without changing its content."""
    return send_from_directory(PUBLIC_DIR / "full-analysis", "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(PUBLIC_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8050")))
