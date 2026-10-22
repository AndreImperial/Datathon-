# Datathon follow-up numerical and methodological audit

Read-only review, 2026-10-03. No analytical or application files changed. Findings below were checked against local Parquet inputs and implementation, not just agreement between dashboard exports.

## Prioritized findings

### P1 — Acquisition year comparison has no classified 2024 acquisition population
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/03d_case_analysis.py:106` (motion mapping), `:165` (motion selection), `:405` (complete-year claim).
- Evidence: canonical opportunity crosstab by creation year/motion is 2023: Acquisition 29, Renewal 3, Unknown 622; 2024: Acquisition 0, Renewal 0, Unknown 1,191. All 1,191 2024 latest snapshots have null `_type`. In 2022, 429/446 were classified; in 2023 only 32/654; in 2024 none. The latest creation date is 2024-12-20, so 2024 is not demonstrably complete either.
- Impact: a 2023/2024 acquisition comparison is undefined, and an all-history acquisition ranking mainly represents older classified deals. Missing motion must not read as no acquisition. Existing rate/maturity caveats do not explain this loss of population.
- Remedy: export and display classification coverage by year; label known-motion subsets; mark 2024 acquisition comparison unavailable. Compare all motions within comparable periods until source-backed motion history can be recovered. Do not infer missing motion from existing-client source.
- Reproduction: load canonical_population; pd.crosstab(opps.created_year, opps.business_motion); inspect `_type` null share by year and `created_at.max()`.

### P1 — Legacy cost/ROI contract still converts untracked cost to zero and compares unmatched periods
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/02_data_integration.py:210`–`:224`; `C:/Users/andre/Downloads/Datathon/frontend/src/App.tsx:184`; dashboard export `C:/Users/andre/Downloads/Datathon/analytics_case_study/04_dashboard_data.py:251`.
- Evidence: unknown channel spend is `.fillna(0)`, then `cost_per_opp=channel_spend/deal_count`. Ten channels therefore have literal zero cost per opportunity, including referral, email, event and web. Only two paid platforms have supplied spend. Paid numerator is all-history CRM pipeline (2018–2024), while ad spend spans 2023-01-31 through 2024-10-07 for 6sense and 2023-09-11 through 2024-10-07 for LinkedIn. The resulting exported multiples are 0.08 and 0.87; data provenance does not make these same-period efficiency metrics.
- Impact: public v2/raw tables and explanatory copy retain a zero-cost implication; mixed time horizons make efficiency comparisons unusable even as a sparse descriptive leaderboard.
- Remedy: unknown spend and cost remain null, with measured/unknown indicator. Restrict numerator to the exact denominator observation scope, separately retain all-history amounts. Rename ratios recorded-pipeline/tracked-spend, and disclose partial observation windows. If compared under a narrower window, show those dates.

### P2 — Web event rows are still labeled sessions and goal completions
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/02_data_integration.py:93`, `:288`–`:292`; `C:/Users/andre/Downloads/Datathon/analytics_case_study/03_analysis.py:365`.
- Evidence: 36,931 web rows but 26,114 unique `_recordingid` values and 23,051 visitors. Funnel exports Sessions=36,931 and Goal Completions=1,169, ratio 3.165%. Flagged contact activity has only 1,067 unique recordings. Goal flag is True on 1,169 rows and missing on 35,762, with no observed False values; flagged rows exactly match Contact rows.
- Impact: table/chart labels overstate session volume and imply measured completion semantics. Separating activity populations does not fix an incorrect grain within a population.
- Remedy: label raw counts as recorded web events/rows; derive sessions from unique recordings if verified as a session key; report recordings with observed contact flag, with explicit unknown status and no inferred conversion rate.

### P2 — Velocity silently excludes legitimate same-day wins and does not disclose exclusions
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/03c_advanced_analytics.py:383`; dashboard export metadata `C:/Users/andre/Downloads/Datathon/analytics_case_study/04_dashboard_data.py:291`.
- Evidence: 1,070 canonical wins; 924 included in velocity. Excluded: 90 zero-day wins, 54 negative intervals, 2 over 730 days. Zero-day wins are excluded solely by `between(1, 730)` despite valid creation/close dates. Only n>=5 caveat is shown.
- Impact: median/mean describes a selected positive-duration subset; excluding zero-day transactions biases duration upward, especially for renewal and fast-close channels. Negative dates remain an unresolved source issue.
- Remedy: retain valid zero-day wins or justify a source-backed rule; export exclusions by channel/motion and interval reason; disclose source `_close_date` semantics and sample coverage.

### P2 — Calibration bands split identical predictions by source order
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/03c_advanced_analytics.py:235`–`:245`.
- Evidence: calibration uses qcut(predicted.rank(method='first')). Quintiles 1 and 2 have identical mean score .4284564458 but observed rates 19.77% vs 27.91%; quintiles 4 and 5 likewise share .4295981881 yet show 22.09% vs 26.74%. The holdout calendar model has heavily tied scores, so displayed five bands are arbitrary row slices, not five meaningful score levels.
- Impact: row-order changes can change band gaps and make identical risk groups appear distinct. AUC/Brier remain valid; the issue concerns the calibration display and max-band gap.
- Remedy: group equal scores together, use fixed meaningful probability bins with empty-bin handling, or tie-preserving quantiles with a reduced number of bands. Report actual score range and uncertainty/sample counts per band.

### P2 — Coverage association conflates historical opportunity existence with later 2024 reach
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/03c_advanced_analytics.py:310`–`:342`; `C:/Users/andre/Downloads/Datathon/frontend/src/App.tsx:520`.
- Evidence: `has_opportunity` uses any canonical opportunity in all CRM history, while reach is presence in 2024 email/6sense logs. Of 638 reached domains with an opportunity, 260 have no canonical 2024-created opportunity (40.8%). Exposure is therefore later than many counted outcomes. Existing observational/selection caveats omit this time ordering.
- Impact: reached/unreached opportunity rates are historical prevalence, not conversion following reach. Email-first growth rationale cannot treat these rates as acquisition opportunity rates or use them as test baselines.
- Remedy: label historical opportunity prevalence explicitly; define a comparable forward cohort or time-zero exposure and future outcome window; use customer/active-pipeline exclusions in the experimental audience. Keep existing proportions only as coverage descriptions.

### P3 — First touch means earliest retained latest-weekly presence, not first raw event
- Location: `C:/Users/andre/Downloads/Datathon/analytics_case_study/03d_case_analysis.py:152`, `:242`; appendix text `:347`.
- Evidence: weekly dedup keeps last event; first-touch then uses minimum retained timestamp. One 365-day opportunity changes earliest channel from 6sense display in raw eligible events to Email after compression, transferring $10,000 recorded pipeline between first-touch channels; not a won opportunity.
- Remedy: explicitly label first/last normalized weekly presence, or preserve first and last eligible event timestamps per channel-week when determining positional models. Do not change linear/time-decay normalization silently.

## Other checks and limits
- Canonical nondeleted population, resolved/won totals, positive-amount missingness, ad-day/platform uniqueness, negative ad spend/impressions, attribution precreation window, tied-channel credit, experiment sample formula, current-fit targeting adjustment, actual budget totals, and source date bounds inspected.
- No negative/missing canonical amounts; 115 canonical opportunity domains missing. Seven account and five opportunity domain strings contain URL/email/path characters; domain canonicalization should be hardened before linkage (small unquantified impact).
- Ad metrics have no duplicate complete or platform/ad/day rows and no negative spend. Campaign has no zero, negative or missing impressions.
- Budget scenarios each sum $1,221,356.49: 6sense ad metrics $1,186,809.50 + LinkedIn $34,546.99. Campaign-account $208,854.31 is a separate scope, not the planning envelope. The $1.4M chart axis may be a padded tick; this is not evidence of extra spend.
- Targeting adjusted rates genuinely use prior smoothing. Example 153/331 raw .4622356, adjusted .4585427. No defect established there.
- Email main v3 identity fallback is present; legacy email reports omit 45 prospect-ID-missing people with available email identities. Low-impact consistency issue worth repairing.
- No API/live source verified. Currency field absent from opportunity extract; monetary currency provenance needs supplied case/source confirmation before asserting USD universally.
- This was code/Parquet review with targeted reproductions; no independent reconstruction of every raw workbook cell or comprehensive interactive chart inspection.

