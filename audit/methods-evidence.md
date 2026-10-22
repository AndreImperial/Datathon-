# Analytical methods audit — 2026-10-03

Read-only checks; application and analytical source files were not edited. Reproduce with `.venv/Scripts/python.exe audit/model-cutoff-check.py` from the repository root. The script reads raw Excel and saved JSON; it does not regenerate pipeline artifacts.

## Verified reconstruction output

```text
Raw opportunity rows: 16,421
Latest complete snapshots: 3,288
Deleted latest snapshots: 43
Canonical nondeleted opportunities: 3,245
Exact model stage column selected: _current_stage
Exact creation column selected: _createdate (Date)
Resolved: 2,834; active: 411
Current source split: train 2,267; test 567
Holdout creation start: 2024-04-10
Training current-stage-change dates after holdout start: 242
Training close dates after holdout start: 309
Saved diagnostics: train 2,272; test 569; active scored 447
Saved score-band active count: 447
Default power: 2,213 per arm; 4,426 total; audience 2,032; infeasible
Weekly dedup counterexample: 1 eligible raw touch becomes 0 eligible compressed touches
```

## Findings

1. **High — saved model artifacts contradict the canonical population.** `frontend/public/dashboard-data-v3.json:7686-7690` reports 2,841 resolved model records and 447 active scores (3,288 total), versus canonical 2,834 resolved and 411 active (`:7699-7700`). Current source excludes deletions (`analytics_case_study/03c_advanced_analytics.py:103-104`). Saved artifacts appear to predate that correction. Regenerate and assert model population reconciliation before publishing model metrics. `ANALYSIS_METHODOLOGY.md:111` repeats the stale metrics/counts.

2. **High — creation-order holdout allows future training outcomes.** `03c_advanced_analytics.py:128-132` splits resolved snapshots by creation date, but does not restrict training resolution dates to information available at validation start. Raw reconstruction using the same whole-row selection and exact stage column finds 242 training stage-change dates after 2024-04-10. Close dates are supporting evidence, but may be scheduled dates, so the 242 stage-change records are the stronger evidence. Use an as-of cutoff, training outcomes known before cutoff, as-of features, and a common outcome horizon. Latest snapshot amount/channel/segment are not proven creation-time values; source's feature-policy wording (`:233`) overstates that assurance. This check does not establish a corrected AUC.

3. **Medium — global weekly deduplication can erase eligible prior touches.** `03d_case_analysis.py:136` keeps last domain/channel/week touch before per-opportunity temporal filtering at `:144`. June 3/June 7 email touches with June 5 opportunity creation demonstrably lose the eligible June 3 event. Filter each opportunity's eligible window before weekly deduplication (already available at `:148`). Actual affected opportunity count was not computed; the existing 682 linked count requires reevaluation.

4. **Medium — missing-period conversion rates produce artificial decomposition components.** `03d_case_analysis.py:287-288` substitutes zero when a group is absent. Saved webinar group has 0 resolved in 2022 H1 and 2/2 wins in 2024 H1 but assigns +0.1984pp both to mix and within-group change. Unknown segment disappears in 2024 and gets -0.2747pp in both components. Overall decomposition can reconcile algebraically while those within-group interpretations remain unsupported. Use common support and an explicit entry/exit component.

## Strengths and remaining limits

- Default two-proportion sample-size arithmetic reproduces 2,213 per arm / 4,426 total. The current brief correctly states 2,032 eligible domains are insufficient. Baseline/lift assumptions remain hypothetical, not measured 90-day rates. Separate email/6sense tests require explicit allocation and comparisons before a scenario can be operationally feasible.
- V3 explicitly distinguishes CRM source credit from touch linkage and causal incrementality. Source observation windows and event-log email denominator limitations are clear.
- Creative conclusions correctly limit five labeled ads to confounded bundle hypotheses.
- Targeting intervals and sample counts are useful safeguards, but use current account fit against historical opportunity outcomes (`03d_case_analysis.py:308-319`). Historical resolved opportunity win rate is conditional on already having an opportunity; it is not prospect-level incremental opportunity creation probability. Current-fit associations and pooled business motions should remain exploratory for prospect targeting.
- Earlier 80/20 preprocessing and holdout metrics are a reasonable baseline framework; future outcomes, saved-population drift, and unverified feature timestamps prevent treating current model scores as validated operating probabilities.

These findings concern methodological correctness and artifact consistency. They do not invalidate every descriptive CRM total or imply causal claims where the brief already clearly disclaims them.
