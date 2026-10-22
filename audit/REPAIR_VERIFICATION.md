# Datathon repair verification

Local repair completed on 2026-10-03. The original AUDIT_REPORT.md and scorecard remain historical audit evidence.

## Corrected behavior

- All analytical consumers use the shared nondeleted opportunity population: 3,245 total, 2,834 resolved, 1,070 won and 411 active. Recorded pipeline is USD 24,876,699.31; won amount is USD 5,419,871.93.
- Shared-domain campaign activity is allocated across CRM account IDs with explicit equal-share metadata, conserving source spend instead of duplicating it. These shares do not establish observed account ownership.
- Opportunity eligibility filtering precedes weekly touch compression. Attribution and case outputs now agree on 684 linked opportunities, 127 linked wins and 5,802 normalized eligible touch rows. First/last ties share credit across distinct tied channels.
- Conversion decomposition uses common support; missing-period rates remain unavailable, with entry/exit contributions shown separately.
- Historical model labels must be recorded before training cutoff. Mutable latest-snapshot features were removed. The calendar-only, conditional 180-day diagnostic has 1,144 training rows and 430 holdout rows; AUC 0.516 and Brier 0.217. Its 411 active scores are exploratory and do not support operational prioritization.
- Presentation views now use explicit scopes, real field names, appropriate units, signed contributions, model/window selectors and substantive appendix evidence. Source coverage includes observed timestamp windows. Desktop and narrow layouts use bounded table scrolling.
- Documentation and regenerated dashboard artifacts reflect the corrected evidence. Packaging now writes the legacy dashboard to public/full-analysis/index.html.

## Verification

- Full run_pipeline.py completed successfully: audit/pipeline-final.log.
- All 24 regression tests passed: audit/tests-final.log.
- TypeScript and Vite production build passed after the final UI edit: audit/build-final.log. Vite reports a nonblocking bundle-size advisory.
- Final cross-artifact validator passed: snapshot 33039705cd29047a, 16 main slides, 6 appendix slides, 21 datasets: audit/validation-final.log.
- git diff --check has no whitespace errors; Git reports line-ending normalization warnings only.
- Independent code review was completed and identified repairs were integrated. Browser checks covered acquisition comparisons, decomposition grouping, creative CTR, email/web evidence, overlap groups, attribution model/lookback changes, overview navigation, model appendix and source windows. A 390px viewport showed no document horizontal overflow; broad exhaustive interaction coverage is not claimed.

## Remaining boundaries

The supplied activity logs have narrower observation windows than CRM history. Missing amounts and unavailable delivery denominators cannot be recovered from these files. Attribution is observational, not causal. The model requires better historical feature/event coverage before operational use. An official competition rubric was not supplied, so rubric compliance is unverified.

Changes and artifacts are local. No commit, push, publication or external source write was performed. The local preview is available at http://localhost:8050/ while app.py remains running.
