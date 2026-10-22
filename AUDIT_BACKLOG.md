# Audit Backlog

The current consolidated work list is [Master fix backlog](C:/Users/andre/Downloads/Datathon/audit/MASTER_FIX_BACKLOG.md), with 59 prioritized work items, acceptance criteria and evidence references. Use that file to track remaining repairs, risks, polish and missing external inputs.

The material below is a historical record of the earlier decision-readiness pass. It is not a current readiness declaration: subsequent audits found additional defects, and local artifact generation does not verify the live deployment. Its five enhancement ideas are included in the master list.

## Completed in the decision-readiness pass

### Correctness and trust

- Canonical win rate uses won / resolved outcomes; active opportunities are excluded.
- Cohorts show resolved share, maturity status, and Wilson 95% intervals; channel and segment win-rate views expose resolved samples.
- Zero-amount opportunities and wins are quantified and surfaced.
- Attribution reports linked-opportunity and linked-win coverage, with model and lookback-window sensitivity; blank-UTM web sessions are excluded from marketing touch credit.
- Raw activity is normalized to one account-channel presence per ISO week before attribution.
- Email reporting uses engagement-event composition and documents the missing delivered denominator.
- Paid-channel budget output is budget-neutral measurement design, without a revenue forecast. Experiment power scenarios show feasibility across detectable effects; the default 5% baseline / +2pp target requires 4,426 domains and is infeasible with 2,032 eligible domains.
- Targeting cells include empirical-Bayes adjustment, confidence intervals, and evidence tiers.
- The model uses an as-of cutoff, complete 180-day horizons, train-only preprocessing and creation-calendar features. Near-chance results and resolved-only selection limit the active scores to exploratory diagnostics.

### Presentation and UX

- The canonical browser findings deck is available from `public/index.html#present/main-01` and the live Render deployment: 16 timed main slides and six appendix slides generated from the validated v3 contract.
- The ten-section dashboard remains the interactive analysis surface, with a separate analyst presentation-mode layout and a direct Findings deck entry point.
- Dashboard copy, charts, captions, and conclusion use corrected definitions; dashboard bundles Plotly locally and has no CDN runtime dependency.
- Desktop and mobile chart behavior use responsive margins and label handling. Creative comparisons are separated by platform and minimum impression volume.
- The production React dashboard consumes generated evidence contracts; the Plotly dashboard and PowerPoint export are retained only as historical optional artifacts.

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
