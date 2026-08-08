# Audit Backlog

## Completed in the decision-readiness pass

### Correctness and trust

- Canonical win rate now uses won / resolved outcomes; active opportunities are excluded.
- Cohorts show resolved share, maturity status, and Wilson 95% intervals.
- Channel and segment win-rate views expose the resolved sample.
- Zero-amount opportunities and zero-amount wins are quantified and surfaced.
- Attribution reports linked opportunity and linked-win coverage.
- Blank-UTM web sessions are excluded from marketing touch credit.
- Raw activity is normalized to one account-channel presence per ISO week before attribution.
- Email reporting uses engagement-event composition and documents the missing delivered denominator.
- Paid-channel budget output is budget-neutral measurement design, without a revenue forecast.
- Targeting cells include empirical-Bayes adjustment, confidence intervals, and evidence tiers.
- The model uses a time-based holdout, train-only preprocessing, opportunity-time features, and active-only scoring.

### Presentation and UX

- Dashboard copy, charts, captions, and conclusion use the corrected definitions.
- Dashboard bundles Plotly locally and has no CDN runtime dependency.
- Desktop and mobile chart behavior use responsive margins and label handling.
- Creative comparisons are separated by platform and minimum impression volume.
- A single canonical dashboard implementation prevents metric drift.
- The executive deck was rebuilt as a 12-slide answer-first narrative with editable charts.
- Every slide contains source and methodology notes.
- The deck passed slide-overflow QA.

### Engineering and delivery

- The dashboard and `public/index.html` are generated together and hash-validated.
- The pipeline produces a data-quality workbook and integrated diagnostic marts.
- Validation checks metric semantics, model population, attribution scope, email semantics, budget neutrality, self-contained delivery, deck slide count, and source notes.
- Documentation now uses the canonical definitions and artifact paths.

## Remaining enhancements

These are product improvements, not blockers to the current analytical conclusion:

1. Backfill CRM opportunity amounts and rerun revenue analyses.
2. Add sent/delivered email data and standard campaign-rate QA.
3. Persist account-opportunity-touch detail for governed drill-through.
4. Add attribution sensitivity at 30/90/180/365-day windows.
5. Add a calibration curve and threshold table for the model pilot.
6. Add explicit experiment power calculations once baseline outcome windows are agreed.
7. Add data-source freshness and schema-drift checks for scheduled production refreshes.
8. Automate visual-regression screenshots in CI.
