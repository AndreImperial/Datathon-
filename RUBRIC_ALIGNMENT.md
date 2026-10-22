# Proposed evaluator mapping — official rubric pending

No official competition rubric was supplied or verified. This document is a proposed mapping, not a compliance receipt.

# Rubric Alignment Checklist

## 1. Data Processing

Evidence:

- `run_pipeline.py` executes all nine current steps in dependency order.
- Cleaning normalizes domains, dates, booleans, amounts, industries, and channels; opportunities are deduplicated to the latest snapshot.
- Analysis-ready outputs are stored as Parquet marts, with the browser dashboard and findings deck built from the versioned v3 contract.

Evaluator takeaway: the work is reproducible and inspectable, not a one-off spreadsheet exercise.

## 2. Data Integrity

Evidence:

- The current v3 snapshot is `0996033d77dd2d46`: 3,245 canonical opportunities, $24.9M recorded pipeline, and $5.4M recorded won amount.
- Win rates use resolved outcomes; Wilson intervals and resolved-share maturity gates accompany rate comparisons.
- Linkage, source populations, zero amounts, email denominators, spend, and creative metadata limits remain visible in the dashboard and appendix.
- Delivered attribution-window sensitivity, experiment power scenarios, and model calibration diagnostics are included in the current evidence package.

Evaluator takeaway: limitations shape interpretation and appear alongside the decision evidence.

## 3. Data Storytelling

The answer-first narrative is to maintain observed channel performance, test creative bundles, and run randomized account coverage before expanding spend. Each main-deck claim connects to a decision or test and carries an evidence boundary.

Evaluator takeaway: findings lead to bounded, executable recommendations.

## 4. Dashboard Design

Evidence:

- The ten-section dashboard keeps an executive path and preserves analyst detail across attribution, channel, segment/ICP, creative/email, budget, advanced analytics, recommendation, and appendix views.
- Evidence captions state question, population, and caution; charts keep source data, accessible summaries, and caveats together.
- The dashboard is self-contained, responsive, keyboard accessible, printable, searchable, and exportable.

Evaluator takeaway: the dashboard balances executive clarity with analytical depth.

## 5. Reporting And Analysis

Evidence:

- Sourced and linked-influenced attribution are separated and scoped; sensitivity by attribution window and the attribution methods appendix make model choices inspectable.
- Cohort analysis excludes active outcomes from win-rate denominators; conversion decomposition separates mix shifts from within-group changes.
- Account coverage and targeting expose observational limits, uncertainty, and sample feasibility.
- The predictive baseline uses a time-based holdout, as-of cutoff and creation-calendar-only feature policy, and calibration diagnostics.

Evaluator takeaway: methods match the questions and avoid unsupported precision.

## 6. Marketing Strategy

Recommended pivot:

- Maintain observed channel performance while conversion quality and recorded-value completeness remain decision constraints.
- Test account coverage among 2,032 eligible ICP domains and compare matched creative bundles.
- Report source credit, linked influence, and linkage coverage together; use attribution to form hypotheses rather than claim causality.
- The 5% baseline / +2 percentage-point experiment requires 4,426 domains, exceeding the available 2,032; use the power scenarios to set a feasible detectable effect or accumulation plan.

Evaluator takeaway: recommendations are executable, budget-aware, and include measurement gates.

## 7. Presentation Skills

The current browser deck has a configured, unverified published address at [marketing-analytics-dashboard-saoj.onrender.com/#present/main-01](https://marketing-analytics-dashboard-saoj.onrender.com/#present/main-01) and delivers 16 timed main slides in 18 minutes, followed by six on-demand appendix slides. The talk track is documented in `SLIDE_BY_SLIDE_EXPLAINED.md`. The PowerPoint file is a historical archive with retired analytical definitions, not the current presentation contract.

Evaluator takeaway: the presenter can deliver a concise executive story while keeping methods and diagnostics available for questions.

## 8. Presentation Design

Evidence:

- The dedicated browser findings deck is linked from the dashboard and deep-links by slide ID.
- The ten-section interactive dashboard remains the canonical analysis surface; its analyst presentation-mode toggle is an additional focused layout.
- The historical PowerPoint export may be retained as an optional artifact; it does not define the current slide sequence.

Evaluator takeaway: the work provides both a guided presentation and an inspectable analytical dashboard.

## Claim-to-case evidence map

| Case claim | Current evidence / boundary | Dashboard section | Browser deck slide |
|---|---|---|---|
| Recorded value is meaningful but incomplete | 3,245 canonical opportunities; $24.9M pipeline; $5.4M won amount. Amount coverage and outcome definitions constrain revenue interpretation. | Executive Summary; Channel Performance; Appendix | `main-05` Channel effectiveness; `main-04` Business motion; `appendix-01` Population and source coverage; `appendix-02` Metric definitions |
| Channel and content observations guide tests, not causal claims | 684 opportunities are linked to eligible touches; attribution ranks vary by model/window. Only five ads have complete creative metadata. | Attribution Analysis; Channel Performance; Creative & Email; Appendix | `main-08` Advertising content; `main-10` Source and touch overlap; `main-11` Attribution and journeys; `appendix-03` Attribution methods |
| Eligible accounts support a coverage experiment | 2,032 eligible ICP domains remain; reached-group comparisons are observational. | Segment & ICP; Advanced Analytics; Budget Measurement | `main-12` Target audience; `main-14` Controlled experiment; `appendix-05` Targeting and sample uncertainty |
| The default experiment target is infeasible at the current audience size | A 5% baseline and +2pp lift require 4,426 domains versus 2,032 eligible. Delivered power scenarios support alternate planning. | Budget Measurement; Segment & ICP; Appendix | `main-14` Controlled experiment; `main-15` Budget implications; `appendix-05` Targeting and sample uncertainty |
| Conversion and predictive results need method context | Mix and within-group conversion shifts are descriptive; calibration and other model diagnostics are available for inspection. | Advanced Analytics; Channel Performance; Appendix | `main-07` Conversion drivers; `appendix-04` Conversion decomposition; `appendix-06` Model diagnostics |
| CMO action is to fund learning before expansion | Maintain measurable activity, test channel/content and account coverage, and scale against incremental qualified pipeline evidence. | Conclusion & Action Plan; Budget Measurement | `main-02` Marketing strategy; `main-13` Channel and content actions; `main-16` CMO decisions |
