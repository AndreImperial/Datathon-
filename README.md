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

Run the scripts from the repository root in order:

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

The Render deployment is configured as a static web service that publishes the `public` folder.

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
