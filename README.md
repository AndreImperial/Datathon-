# Marketing Analytics Datathon

An end-to-end B2B marketing analytics case study that turns eight CRM and marketing exports into validated analysis marts, executive workbooks, a production React decision dashboard, and a 12-slide decision deck.

## Executive answer

The data supports targeted, measured growth—not blanket budget expansion.

- Protect quality: closed-deal win rate moved from 38% in 2022 Q1 to 22% in 2024 Q2 among cohorts at least 80% resolved.
- Expand coverage: 67.9% of target account domains have no tracked email or 6sense touch.
- Measure before scaling: only two paid channels have tracked spend; one has a single opportunity and neither has recorded won revenue.
- Repair measurement: 65.3% of won opportunities have zero amount, and only 11.7% of won opportunities link to eligible pre-opportunity touches.

These limitations are surfaced in the dashboard, deck, workbooks, and automated validation—not hidden in footnotes.

## Deliverables

- Dashboard: [`public/index.html`](public/index.html), the complete content-preserving interactive dashboard with improved navigation, responsive behavior, typography, hierarchy, and accessibility.
- Executive deck: [`outputs/presentation/Marketing_Analytics_Executive_Deck.pptx`](outputs/presentation/Marketing_Analytics_Executive_Deck.pptx), 12 slides with source and methodology notes on every slide.
- Analysis workbooks: `outputs/analysis/`, including attribution coverage, data quality, email event semantics, and budget-neutral measurement plans.
- Reproducible marts: `data/cleaned/` and `data/integrated/`.
- Automated audit: `analytics_case_study/06_validate_metrics.py`.

## Repository structure

```text
Analytics Case Study/          Raw Excel source files
analytics_case_study/          Cleaning, integration, analysis, dashboard, deck, validation
data/cleaned/                  Latest-state cleaned Parquet datasets
data/integrated/               Analysis-ready marts and diagnostics
outputs/analysis/              Generated Excel workbooks
outputs/dashboard/             Canonical generated dashboard
outputs/presentation/          Canonical executive deck
frontend/                      Optional React/Tremor exploration surface and browser data contract
public/                        Deployment-ready content-preserving dashboard for Flask, Render, and Pages
run_pipeline.py                One-command orchestration
```

## Reproduce the analysis

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
python run_pipeline.py
```

macOS or Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
npm install
python run_pipeline.py
```

The runner executes cleaning, integration, core analysis, attribution, advanced analytics, dashboard data export and build, presentation generation, and validation in order. `python run_pipeline.py --dry-run` prints the plan without changing artifacts.

The presentation generator uses Node.js and `@oai/artifact-tool`. In the Codex desktop workspace the bundled runtime is discovered automatically; `NODE_EXE` and `CODEX_PRESENTATIONS_SKILL_DIR` can be set for another compatible runtime.

## Metric definitions that matter

| Metric | Definition |
|---|---|
| Closed-deal win rate | Won opportunities / resolved opportunities; resolved means closed won, closed lost, or discontinued. |
| Recorded pipeline | Sum of CRM opportunity amount. Zero amounts remain visible as a quality issue. |
| Marketing sourced | CRM origin credit mapped to marketing source categories. |
| Marketing influenced | Pipeline for the subset linked to eligible pre-opportunity touches within 365 days. Touches are normalized to one account-channel presence per ISO week. |
| Email event share | Event-type rows / all supplied engagement-event rows. It is not a send-based open or click rate. |
| Account opportunity rate | Accounts with an opportunity / accounts in the coverage tier. Observational; Wilson intervals are shown. |

Full definitions and limitations are in [`ANALYSIS_METHODOLOGY.md`](ANALYSIS_METHODOLOGY.md).

## View and deploy

Build and serve the application locally:

```bash
npm run build
python app.py
```

Then visit `http://localhost:8050`. For live frontend development, use `npm run dev`.

The content-preserving dashboard is the default route. The complete dashboard is also available at `/full-analysis`; no original chart, table, or caveat is lost.

Deployment options:

- Render: use `render.yaml` with `gunicorn app:app`.
- GitHub Pages: enable Pages with GitHub Actions; `.github/workflows/deploy-pages.yml` publishes `public/`.

## Validate before sharing

```bash
python analytics_case_study/06_validate_metrics.py
```

Validation checks resolved-denominator semantics, active-only model scoring, attribution scope, email event semantics, budget neutrality, dashboard data synchronization, compiled asset delivery, workbook presence, deck slide count, and slide source notes. CI runs the same audit on push and pull request.
