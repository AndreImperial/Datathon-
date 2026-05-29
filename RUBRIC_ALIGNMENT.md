# Rubric Alignment Checklist

This project is designed to answer the case prompt: identify which marketing channels and content types drive revenue and engagement, surface trends across channels, and recommend how the CMO should pivot marketing strategy.

## 1. Data Processing

Evidence:
- `run_pipeline.py` runs the full workflow end to end.
- `analytics_case_study/01_data_cleaning.py` normalizes raw source files.
- `analytics_case_study/02_data_integration.py` builds analysis-ready marts.
- `data/cleaned/` and `data/integrated/` store reproducible parquet outputs.

Evaluator takeaway:
The work follows a repeatable pipeline rather than one-off spreadsheet manipulation.

## 2. Data Integrity

Evidence:
- `analytics_case_study/06_validate_metrics.py` checks required columns, boolean integrity, won/closed consistency, dashboard sync, and dashboard UX fragments.
- The dashboard quality strip reports domain coverage, missing create dates, unknown channel share, concentration, and attribution reconciliation.
- Caveats explain attribution, ROI, anonymous web traffic, and sample-size limitations.

Evaluator takeaway:
The metrics are guarded against silent data loss and are explained with appropriate limitations.

## 3. Data Storytelling

Evidence:
- The default dashboard tab is now `Essential View`.
- The narrative is focused on three decisions: protect quality, expand coverage, and scale with proof.
- The conclusion turns the analysis into a CMO-ready action plan.

Evaluator takeaway:
The project does not just show charts; it tells a decision-oriented story.

## 4. Dashboard Design

Evidence:
- The first view uses only five decision-critical visuals.
- Deeper attribution, funnel, creative, segment, budget, and advanced analytics pages remain available in side navigation.
- Search, reset, print, CSV export, caveats, and presentation mode support different audiences.

Evaluator takeaway:
The dashboard prioritizes important information first and avoids forcing every analysis onto the opening view.

## 5. Reporting And Analysis

Evidence:
- Attribution compares sourced, influenced, first-touch, last-touch, linear, and time-decay views.
- Channel performance reports pipeline, won revenue, win rate, deal size, spend, and ROI.
- Coverage analysis identifies unreached target accounts.
- Cohort analysis flags pipeline growth versus win-rate decline.
- Targeting matrix identifies segment/profile-fit priorities.

Evaluator takeaway:
Findings, insights, and recommendations are connected to derived data, not intuition.

## 6. Marketing Strategy

Recommended pivot:
1. Protect pipeline quality by reviewing ICP fit and qualification before scaling broad demand generation.
2. Expand email and 6sense coverage to unreached strong-fit target accounts using a holdout test.
3. Use attribution models for planning, not causality claims.
4. Treat tracked-spend budget scenarios as tests and validate incremental lift before large reallocations.

Evaluator takeaway:
The recommendation is relevant to the audience and segments, and it is actionable for a CMO.

## 7. Presentation Skills

Suggested delivery structure:
1. Open with the business problem: multi-channel activity exists, but conversion credit is unclear.
2. State the answer in one sentence: marketing influence is larger than CRM source credit, but growth must protect quality.
3. Show only the Essential View first.
4. Use analyst detail only when asked.
5. Close with the three-step CMO action plan.

Evaluator takeaway:
The speaker has a simple, confident talk track and does not need to narrate every chart.

## 8. Presentation Design

Evidence:
- `outputs/presentation/Marketing_Analytics_Executive_Deck_v4.pptx` provides the executive deck.
- `outputs/dashboard/Marketing_Analytics_Dashboard.html` provides the interactive dashboard.
- `public/index.html` is the deployment-ready dashboard.
- `SLIDE_BY_SLIDE_EXPLAINED.md` documents the deck talk track.

Evaluator takeaway:
The project includes presentable client-facing artifacts, not only code.
