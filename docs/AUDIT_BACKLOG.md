# Audit Backlog

Current status is in the [release checklist](audit/RELEASE_CHECKLIST.md) and the latest [full audit](audit/FULL_AUDIT_2026-11.md). The [master fix backlog](audit/MASTER_FIX_BACKLOG.md) is a historical snapshot.

The material below is a historical record of the earlier decision-readiness pass. It is not a current readiness declaration: subsequent audits found additional defects, and local artifact generation does not verify the live deployment. Its five enhancement ideas are included in the master list.

## Completed in the decision-readiness pass

### Correctness and trust

- Canonical win rate uses won / resolved outcomes; active opportunities are excluded.
- Cohorts show resolved share, maturity status, and Wilson 95% intervals; channel and segment win-rate views expose resolved samples.
- Zero-amount opportunities and wins are quantified and surfaced.
- Attribution reports linked-opportunity and linked-win coverage, with model and lookback-window sensitivity; blank-UTM web sessions are excluded from marketing touch credit.
- Raw activity is normalized to one account-channel presence per ISO week before attribution.
- Email reporting uses engagement-event composition and documents the missing delivered denominator.
- Paid-channel budget output is budget-neutral measurement design, without a revenue forecast. Experiment power scenarios show feasibility across detectable effects; the default 5% baseline / +2pp target requires 4,426 domains and is infeasible with 2,034 eligible domains.
- Targeting cells include empirical-Bayes adjustment, confidence intervals, and evidence tiers.
- The calendar-only win-probability model was withdrawn: its time-based holdout reached AUC 0.52 and predicted no wins, so no scores are shown.

### Presentation and UX

- The canonical browser findings deck is available from `public/index.html#present/main-01` and the live Render deployment: 16 timed main slides and six appendix slides generated from the validated v3 contract.
- The ten-section dashboard remains the interactive analysis surface, with a separate analyst presentation-mode layout and a direct Findings deck entry point.
- Dashboard copy, charts, captions, and conclusion use corrected definitions; the production dashboard uses Recharts with no CDN runtime dependency; Plotly is used only in the legacy full-analysis archive.
- Desktop and mobile chart behavior use responsive margins and label handling. Creative comparisons are separated by platform and minimum impression volume.
- The production React dashboard consumes generated evidence contracts; the Plotly dashboard is kept as a legacy archive and the PowerPoint export was retired.

### Engineering and delivery

- The React build writes the deployment-ready `public/` directory and preserves the Plotly archive under `public/full-analysis/`.
- The pipeline produces a data-quality workbook and integrated diagnostic marts.
- Validation checks schema version, required datasets and statuses, finite values, unique references, the attribution-overlap partition, and the browser deck count and timing contract. Application tests cover deployment readiness.
- Documentation now uses the canonical definitions, current v3 snapshot, and artifact paths.

## Remaining enhancements

These are product improvements, not blockers to the current analytical conclusion:

1. Backfill CRM opportunity amounts and rerun revenue analyses.
2. Add sent/delivered email data and standard campaign-rate QA.
3. Persist account-opportunity-touch detail for governed drill-through.
4. Add data-source freshness and schema-drift checks for scheduled production refreshes.
5. Automate visual-regression screenshots in CI.
