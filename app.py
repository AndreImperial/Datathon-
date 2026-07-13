import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
CONTEXT_PATH = PUBLIC_DIR / "dashboard_context.json"
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
        "backend_data": CLEANED_DATA_DIR.exists() and INTEGRATED_DATA_DIR.exists(),
    })


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(PUBLIC_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8050")))
