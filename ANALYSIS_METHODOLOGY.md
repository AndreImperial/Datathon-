# Analysis Methodology

## Scope and decision question

This project integrates eight supplied CRM, account, ICP, campaign, advertising, email, web, and segment exports. It asks where marketing can support growth and which conclusions are strong enough to guide action. The evidence is separated into direct observation, directional association, and causal evidence that still requires controlled measurement.

The current browser brief is built from the schema-v3 snapshot recorded in `public/dashboard-data-v3.json` → `meta.snapshot_id`, generated from the supplied files. CRM opportunity history spans 2018–2024; marketing logs are shorter observation windows in 2024. Results should be read as a static analysis of those inputs, not as live or complete tracking.

## Population and current evidence

One complete latest history row is selected per opportunity. The latest-snapshot set contains 3,288 rows; 43 deleted snapshots are excluded, leaving 3,245 canonical non-deleted opportunities. Of these, 2,834 are resolved and 1,070 are won. The resolved-sample win rate is therefore 37.8%. Recorded pipeline is $24,876,699.31 and recorded won amount is $5,419,871.93. Recorded amounts are not necessarily complete revenue: missing and zero values remain visible and constrain dollar-based comparisons.

The acquisition scorecard shows referral leads with the largest recorded won amount ($922,608) in available CRM history. This is descriptive CRM source attribution, not proof that referral activity caused those wins or that another channel would produce less value.

The supplied marketing logs support a 365-day lookback for eligible prior touches. In this snapshot, 684 canonical opportunities link to eligible touches, including 127 wins. Since CRM history is longer than the 2024 marketing observation window, the linked share must not be described as full-history tracking completeness or as the share influenced by marketing causally.

The current controlled-test audience contains 2,032 eligible ICP target domains after customer, active-opportunity, target, and conflicting-profile exclusions. The default sample-size scenario assumes a 5% baseline rate, a 2 percentage-point absolute lift, two-sided alpha .05, 80% power, and equal allocation. It requires 4,426 accounts in total, so the current audience is insufficient for that scenario. Other assumptions can change the requirement; the current count should not be presented as sufficient evidence for a small-lift test.

Only five ads have complete format, message, and tone labels. Creative format, message, tone, and CTA are confounded bundles, so the data supports hypotheses to test rather than isolated creative effects.

## Current browser evidence contract

The preserved dashboard shell continues to use the legacy schema-v2 dashboard payload. The browser findings presentation reads the additive schema-v3 contract at `frontend/public/dashboard-data-v3.json`; both are bundled into the generated `public/` deployment output. The v3 contract includes population reconciliation, source coverage, channel results, attribution overlap and sensitivity, audience exclusions, experiment scenarios, and model diagnostics. This separation keeps the incumbent dashboard data contract stable while making the current decision brief explicit about population and evidence limits.

The browser presentation has 16 main slides totaling 1,080 seconds (18 minutes) and six appendix slides. The first main slide is addressable at `#present/main-01`. The former 12-slide PPTX is a historical archive with retired analytical definitions and is not part of the default pipeline.

## Pipeline

`run_pipeline.py` runs these scripts in order:

1. `01_data_cleaning.py` — normalize schemas, dates, domains, amounts, booleans, industries, and channel categories; keep the latest opportunity snapshot.
2. `02_data_integration.py` — build account, channel, funnel, creative, and campaign marts.
3. `03_analysis.py` — produce core channel, segment, creative, email, budget, and data-quality analyses.
4. `03b_attribution.py` — build sourced, influenced, first-touch, last-touch, linear, and time-decay views with coverage.
5. `03c_advanced_analytics.py` — build model, coverage, velocity, journey, targeting, and cohort analyses.
6. `03d_case_analysis.py` — create the schema-v3 CMO evidence contract used by the browser presentation.
7. `04_html_dashboard.py` — generate the legacy Plotly dashboard archive.
8. `04_react_dashboard.py` — export dashboard data, build the content-preserving React dashboard, and copy the legacy archive into the static deployment output.
9. `06_validate_metrics.py` — validate the current schema-v3 contract and presentation references.

The separate `05_presentation.py` generator is disabled. The existing PPTX is a historical archive with retired definitions and must not be presented as the current analysis.

## Cleaning and identity

- Opportunities are deduplicated to one complete latest-state row per `_opportunity_id`; deleted latest snapshots are excluded from the canonical analytical population.
- Account identity uses normalized company domains where available.
- Free-email and missing-domain records are not treated as reliable company identity.
- Channel categories are mapped from CRM lead source using `config.py`; unmapped sources remain visible rather than being silently reassigned.
- Missing and zero amounts remain part of quality analysis and are not imputed into recorded pipeline or won amount.

## Canonical metric definitions

### Outcomes

Resolved opportunities have a closed-won, closed-lost, or discontinued stage. Active opportunities are the complement.

```text
closed-deal win rate = won opportunities / resolved opportunities
resolved share       = resolved opportunities / canonical opportunities
```

Active opportunities are not counted as losses. Cohort comparisons use the resolved sample and mark cohorts mature only when at least 80% are resolved. Wilson 95% intervals show uncertainty; they do not remove selection bias or establish causality.

### Pipeline and revenue

```text
recorded pipeline    = sum of CRM opportunity amount
recorded won amount  = sum of CRM amount for won opportunities
```

“Recorded” is material because CRM amount completeness is limited. Dollar metrics describe values present in the source and may understate actual contract value. No missing amount is treated as zero revenue in an economic interpretation, even though zero values are retained in the data and included as recorded values in the sums.

### Marketing source

Marketing sourced is conservative CRM origin credit using the normalized channel mapping and the marketing categories defined in `config.py`. Channel rankings describe recorded CRM outcomes and do not estimate incremental channel value.

### Marketing influence and multi-touch attribution

Eligible touchpoints are linked by normalized account domain within 365 days before opportunity creation, where a usable domain, timestamp, and relevant source record are available. Eligibility is applied first; activity is then normalized to one opportunity-channel presence per ISO week using its latest eligible timestamp so dense logs do not create artificial weight. Blank-UTM web sessions are classified as `web_unclassified` and excluded from marketing touch credit.

The current v3 snapshot links 684 opportunities, including 127 wins, to eligible touches. Attribution describes that linked subset. Shorter 2024 marketing logs do not cover all CRM history, so an unlinked opportunity cannot be interpreted as proof that no marketing touch occurred. First-touch, last-touch, linear, and time-decay views allocate linked opportunity amount across eligible channels; they are alternative descriptive allocations, not causal credit.

### Email

The email file is an engagement-event log. It does not provide sent or delivered denominators, so standard reach, delivery, open, and click-through rates cannot be calculated. Event rows, unique engaged people, event composition, and click events per open event are descriptive measures only and should not be benchmarked against send-based campaign rates.

### Creative

```text
CTR = clicks / impressions
CPM = spend / impressions × 1,000
CPC = spend / clicks
```

Creative comparisons are made within platform because delivery and audience conditions differ. Only five ads have complete format/message/tone labels, and those attributes are confounded; do not interpret a bundle ranking as the isolated effect of one creative element.

### Account coverage and test sizing

Eligible ICP target domains are classified from the current account and profile inputs after explicit exclusions. Reached-versus-unreached comparisons are observational because coverage was not randomized and can reflect account quality, seller activity, and selection.

The current pool contains 2,032 eligible target domains. For the default two-sided alpha .05, 80%-power scenario with a 5% baseline conversion rate and 2 percentage-point absolute lift, equal allocation requires 2,213 accounts per arm (4,426 total). The available pool is insufficient. Larger expected effects or a different baseline produce different sample-size requirements; choose assumptions before running a test.

### Spend and ROI

Tracked spend and CRM outcomes have different coverage and timing. Pipeline-per-spend and revenue-per-spend are historical ratios where reported, not marginal returns or forecasts. The current evidence does not establish an optimal channel mix. Budget-neutral holdout and experiment plans are designs for learning; no projected pipeline is attributed to them.

## Predictive model

The supplied history does not establish that latest-snapshot amount, channel or segment was available at opportunity creation. The repaired model uses creation year and quarter only. Outcomes use the first recorded terminal `current_stage` event within 180 days, rather than hindsight `_current_stage` or latest `iswon`. This is a conditional recorded-resolution baseline; unresolved outcomes are excluded, and incomplete event coverage limits interpretation.

The temporal cutoff is 2024-01-22 00:00:00+00:00. Training cases have both a complete 180-day horizon and recorded resolution before that cutoff. Test cases are created after the cutoff and have complete horizons by 2024-12-24 19:33:40+00:00. Preprocessing is fit on training data only. The current evaluation has 1,144 training and 430 test rows: ROC AUC 0.516, Brier 0.217, precision 0.0%, recall 0.0%. Discrimination is near chance; the result does not support sales prioritization or operating win probabilities.

The artifact contains exploratory scores for 411 canonical active opportunities. Those scores are retained as a reproducible diagnostic, not an actionable forecast. Historical event completeness, resolved-only selection and weak calendar features remain material limitations.

## Quality controls

The validator checks that the schema-v3 contract has required datasets and dataset statuses, finite values, unique IDs and resolvable finding/chart references, complete slide speaker-note safeguards, a valid attribution-overlap partition, cross-contract population/value reconciliation, model cutoff/horizon checks, absent-period decomposition rules, deployed-contract equality, and exactly 16 main plus six appendix slides with 1,080 seconds of main-slide timing. CI also compiles pipeline and application code, runs application tests, checks the pipeline dry-run, and typechecks/builds the dashboard. It does not rerun the full analytics pipeline from raw source files.

## Outputs and source-of-truth paths

- Canonical dashboard and browser-presentation code: `frontend/src/`.
- Canonical browser data inputs: `frontend/public/`, including `dashboard-data-v3.json`.
- Generated React application and static deployment copies: `public/`.
- Generated legacy Plotly archive: `outputs/dashboard/Marketing_Analytics_Dashboard.html`; the deployment copy is `public/full-analysis/index.html`.
- Generated workbooks: `outputs/analysis/`.
- Cleaned and integrated data: `data/cleaned/` and `data/integrated/`.
- Historical archived PPTX: `outputs/presentation/Marketing_Analytics_Executive_Deck.pptx`.

## Shared domains and conversion support

Account-mart domain activity is allocated equally across matching CRM IDs solely to conserve totals. Fractional shares do not identify account ownership; domain-level counts must not be read as observed account events. Conversion decomposition reports mix and within-group components only for groups present in both periods; entry and exit contributions remain separate and absent rates stay unavailable. Equal-timestamp first/last touch credit is split across distinct tied channels.
