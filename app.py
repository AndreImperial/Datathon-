import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
CONTEXT_PATH = PUBLIC_DIR / "dashboard_context.json"
DASHBOARD_DATA_PATH = PUBLIC_DIR / "dashboard-data.json"
LEGACY_DASHBOARD_PATH = ROOT / "outputs" / "dashboard" / "Marketing_Analytics_Dashboard.html"
CLEANED_DATA_DIR = ROOT / "data" / "cleaned"
INTEGRATED_DATA_DIR = ROOT / "data" / "integrated"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "context": CONTEXT_PATH.exists(),
        "dashboard_data": DASHBOARD_DATA_PATH.exists(),
        "backend_data": CLEANED_DATA_DIR.exists() and INTEGRATED_DATA_DIR.exists(),
    })


@app.get("/full-analysis")
def full_analysis():
    """Serve the original complete Plotly dashboard without changing its content."""
    return send_from_directory(LEGACY_DASHBOARD_PATH.parent, LEGACY_DASHBOARD_PATH.name)


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(PUBLIC_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8050")))
