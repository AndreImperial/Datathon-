# Analysis Methodology

## Scope and decision question

This project integrates eight raw CRM, account, ICP, campaign, advertising, email, web, and segment exports. The decision question is: where can marketing support growth, and what evidence is strong enough to justify action?

The answer separates three evidence levels:

1. Direct observation: recorded opportunity counts, amounts, outcomes, source categories, touches, spend, and account coverage.
2. Directional association: touch-linked attribution, reached-account opportunity rates, creative engagement, and model scores.
3. Causal evidence required: incremental lift and budget reallocation claims.

## Pipeline

`run_pipeline.py` executes:

1. `01_data_cleaning.py` — normalize schemas, dates, domains, amounts, booleans, industries, and channel categories; retain the latest opportunity snapshot.
2. `02_data_integration.py` — build account, channel, funnel, creative, and campaign marts.
3. `03_analysis.py` — produce channel, segment, creative, email, budget, and data-quality workbooks.
4. `03b_attribution.py` — build sourced, influenced, first-touch, last-touch, linear, and time-decay views with explicit coverage.
5. `03c_advanced_analytics.py` — build the leakage-reduced model, coverage summary, velocity, journey, targeting, and cohort analyses.
6. `04_html_dashboard.py` — generate and synchronize the self-contained dashboard.
7. `05_presentation.py` — prepare validated data and author the 12-slide editable executive deck.
8. `06_validate_metrics.py` — reconcile semantics and artifacts before sharing.

## Cleaning and identity

- Opportunities are deduplicated to one latest-state row per `_opportunity_id`.
- Account identity uses normalized company domains where available.
- Free-email and missing-domain records are not treated as reliable company identity.
- Channel categories are mapped from CRM lead source using the mapping in `config.py`; unmapped sources remain visible rather than silently reassigned.
- Amounts are numeric, with missing or zero values retained for quality analysis.

## Canonical metric definitions

### Outcomes

Resolved opportunities have a stage containing closed, won, lost, or discontinued. Active opportunities are the complement.

```text
closed-deal win rate = won opportunities / resolved opportunities
resolved share       = resolved opportunities / all opportunities
```

Active opportunities are not counted as losses. Cohort comparisons use closed-deal win rate and explicitly mark cohorts mature only when at least 80% resolved. Wilson 95% intervals show uncertainty.

### Pipeline and revenue

```text
recorded pipeline    = sum(opportunity amount)
recorded won revenue = sum(amount for won opportunities)
```

The word “recorded” is material: 1,773 of 3,288 opportunities have zero amount, including 701 of 1,073 wins. Therefore won revenue, average deal size, and revenue ROI are understated until CRM amounts are backfilled.

### Marketing source

Marketing sourced is conservative CRM origin credit. It uses the normalized channel mapping and includes the defined marketing categories in `config.py`.

### Marketing influence and multi-touch attribution

Eligible touchpoints are linked by normalized account domain within the 365 days before opportunity creation. Raw activity is normalized to one account-channel presence per ISO week so dense source logs do not create artificial weight. Blank-UTM web sessions are classified as `web_unclassified` and excluded from marketing touch credit.

Attribution scope:

- 695 of 3,288 opportunities link to eligible touches.
- 126 of 1,073 won opportunities link to eligible touches.
- Influenced pipeline describes that linked subset; it is not full-population or causal credit.

First-touch, last-touch, linear, and time-decay allocate linked opportunity amount across eligible channels. Time decay uses greater weight for more recent touches. All models reconcile within their linked population.

### Email

The email file is an engagement-event log. It does not contain sent or delivered counts, so standard reach, delivery, open, and click-through rates cannot be calculated.

The valid metrics are:

- event rows by type;
- unique engaged email addresses;
- each event type’s share of all recorded engagement rows;
- click events per open event, labeled as a descriptive event ratio.

These metrics must not be benchmarked against send-based campaign rates.

### Creative

```text
CTR = clicks / impressions
CPM = spend / impressions × 1,000
CPC = spend / clicks
```

Creative rankings are made within platform, not across platforms. The dashboard limits the detailed view to high-volume ads with at least 10,000 impressions. Unknown copy-tone and asset metadata remain an explicit limitation.

### Account coverage

Target domains are classified as Not Reached, Email Only, 6sense Only, or Both Channels. Opportunity rate is accounts with at least one CRM opportunity divided by accounts in the coverage tier. Wilson intervals quantify uncertainty.

Coverage groups were not randomized. Their rate differences may reflect profile selection, seller behavior, or other confounders. They define an experiment audience; they do not prove channel lift.

### Spend and ROI

Paid spend is available for only two channels, and outcome evidence is insufficient for a stable marginal-return estimate. Pipeline and revenue ROI are shown only as historical tracked-spend ratios.

The budget workbook contains three budget-neutral operating plans:

- Status Quo: 100% activated media.
- 10% Holdout: 90% activated, 10% held out.
- Measurement First: 80% activated, 10% holdout, 10% experiment pool.

No projected pipeline is calculated. The scale gate is incremental qualified opportunities or pipeline with acceptable closed-deal quality.

## Predictive model

Population:

- training and evaluation: resolved opportunities;
- scoring: active opportunities only.

Features are limited to opportunity-time channel category, CRM market segment, recorded amount, create year, and create quarter. Current stage, present-day intent, present-day account snapshots, and contact counts are excluded to reduce lookahead leakage.

Preprocessing is fit on the earlier 80% time window and evaluated on the later 20% holdout. Evaluation results:

| Metric | Value |
|---|---:|
| ROC AUC | 0.712 |
| Accuracy | 76.1% |
| Precision | 61.0% |
| Recall | 44.4% |
| Brier score | 0.182 |
| Active opportunities scored | 447 |

The model is a ranking baseline. Probability bands must be piloted and calibrated before setting an operating cutoff.

## Targeting matrix

Targeting cells combine CRM market segment and 6sense profile fit. Win rate uses resolved opportunities. Wilson intervals and an empirical-Bayes adjusted rate reduce low-sample overinterpretation. Cells with fewer than 30 resolved deals are marked exploratory regardless of color.

## Quality controls

`data_quality_report.xlsx` and `data_quality_summary.parquet` document opportunity deduplication, domain coverage, zero amounts, email semantics, web identity, spend reconciliation, and date scope.

`06_validate_metrics.py` fails when:

- a win-rate denominator includes active opportunities;
- model scores include resolved opportunities or omit active ones;
- email rows are presented as send-based rates;
- blank-UTM web activity receives marketing credit;
- attribution coverage percentages do not reconcile;
- budget scenarios do not preserve total budget;
- the dashboard is not self-contained or synchronized;
- the presentation lacks 12 slides or slide-level source notes;
- documentation contains retired claims.

## Outputs

- Dashboard: `outputs/dashboard/Marketing_Analytics_Dashboard.html` and synchronized `public/index.html`.
- Deck: `outputs/presentation/Marketing_Analytics_Executive_Deck.pptx`.
- Workbooks: `outputs/analysis/`.
- Integrated diagnostics: `data/integrated/`.
