# Marketing Analytics Datathon

End-to-end account-based marketing analytics project for a datathon case study. The project cleans raw marketing and CRM exports, builds integrated account-level datasets, analyzes channel performance and attribution, generates an interactive dashboard, and produces an executive presentation.

## What This Includes

- Data cleaning pipeline for opportunity, account, campaign, ad, email, web, ICP, and segment files.
- Integrated account and funnel datasets saved as Parquet files.
- Attribution, channel ROI, creative performance, segment conversion, cohort, coverage, velocity, and win probability analyses.
- Static interactive HTML dashboard published from `public/index.html`.
- Executive slide deck and supporting methodology notes.

## Repo Structure

```text
Analytics Case Study/          Raw Excel source files
analytics_case_study/          Python analysis pipeline
data/cleaned/                  Cleaned intermediate Parquet outputs
data/integrated/               Integrated analysis-ready Parquet outputs
outputs/analysis/              Generated Excel analysis workbooks
outputs/dashboard/             Generated dashboard HTML
outputs/presentation/          Generated PowerPoint deck
public/index.html              Static dashboard entry point for Render
render.yaml                    Render static site configuration
```

## Setup

Create a virtual environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS or Linux, activate with:

```bash
source .venv/bin/activate
```

## Run The Pipeline

Run the full pipeline from the repository root:

```bash
python run_pipeline.py
```

Preview the steps without executing them:

```bash
python run_pipeline.py --dry-run
```

The runner executes the scripts below in order:

```bash
python analytics_case_study/01_data_cleaning.py
python analytics_case_study/02_data_integration.py
python analytics_case_study/03_analysis.py
python analytics_case_study/03b_attribution.py
python analytics_case_study/03c_advanced_analytics.py
python analytics_case_study/04_html_dashboard.py
python analytics_case_study/05_presentation.py
python analytics_case_study/06_validate_metrics.py
```

The project uses relative paths from the repo root, so it can be cloned and run without editing local machine-specific paths.

## View The Dashboard

Open the static dashboard directly:

```text
public/index.html
```

The dashboard also includes an optional AI assistant. For free local LLM answers with no API key, install Ollama, pull a model, and run the Python web app:

```bash
ollama pull llama3.1:8b
python app.py
```

Then open:

```text
http://localhost:8050
```

Optional Ollama settings:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
LLM_PROVIDER=ollama
```

For a lighter local model, pull `llama3.2:3b` and set:

```text
OLLAMA_MODEL=llama3.2:3b
```

The assistant sends Ollama a scoped agent prompt with both the dashboard context and compact summaries of the backend Parquet datasets: channel pipeline, attribution, cohort analysis, account coverage, targeting matrix, creative performance, journey sequences, win probability, and raw source table summaries.

Gemini is still supported as an optional fallback. To use it, set:

```text
GEMINI_API_KEY=<your Google AI Studio key>
GEMINI_MODEL=gemini-2.5-flash-lite
```

If Ollama and Gemini are both unavailable, the dashboard falls back to built-in static marketing answers.

## Deploy

This repo is ready for static deployment. The dashboard entrypoint is:

```text
public/index.html
```

### Render

`render.yaml` is included. To deploy on Render:

1. Connect this GitHub repository to Render.
2. Create a Blueprint or web service from the repo.
3. Add `GEMINI_API_KEY` as an environment variable if you want hosted live LLM answers.

Expected settings:

```text
Runtime: Python
Build command: pip install -r requirements.txt
Start command: gunicorn app:app
```

Local Ollama runs on your own computer by default. On Render, use Gemini or point `OLLAMA_BASE_URL` to a reachable Ollama server you control.

### GitHub Pages

A GitHub Pages workflow is included at `.github/workflows/deploy-pages.yml`.

To enable it:

1. Go to the repository on GitHub.
2. Open Settings > Pages.
3. Set Source to `GitHub Actions`.
4. Push to `main` or run the workflow manually.

## Validate Before Deployment

Before deploying a regenerated dashboard, run:

```bash
python analytics_case_study/04_html_dashboard.py
python analytics_case_study/06_validate_metrics.py
```

GitHub Actions also validates the committed artifacts on push and pull request:

```text
.github/workflows/validate.yml
```

The dashboard generator also copies the generated HTML into the static publish folder:

```bash
python analytics_case_study/04_html_dashboard.py
```

If you ever need to copy it manually, use:

```powershell
Copy-Item outputs\dashboard\Marketing_Analytics_Dashboard.html public\index.html -Force
```

There is also a local Dash app:

```bash
python analytics_case_study/04_dashboard.py
```

Then open:

```text
http://localhost:8050
```

## Key Analysis Areas

- Channel contribution and pipeline performance.
- Marketing-sourced and marketing-influenced opportunity analysis.
- Multi-touch attribution comparisons.
- Segment and account coverage analysis.
- Deal velocity by source/channel.
- Win probability modeling for open opportunities.
- Executive-ready recommendations for targeting, budget allocation, and funnel quality.

## Notes

This repository includes generated outputs so the dashboard and presentation can be reviewed without rerunning the full pipeline. For a lighter production-style repo, the generated `data/` and `outputs/` folders could be excluded and rebuilt from the raw source files.

The dashboard audit backlog is tracked in:

```text
AUDIT_BACKLOG.md
```

The case prompt and grading rubric alignment are tracked in:

```text
RUBRIC_ALIGNMENT.md
```
