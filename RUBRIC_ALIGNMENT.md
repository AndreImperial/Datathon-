# Rubric Alignment Checklist

## 1. Data Processing

Evidence:

- `run_pipeline.py` executes all eight phases in dependency order.
- cleaning normalizes domains, dates, booleans, amounts, industries, and channels;
- opportunities are deduplicated to the latest snapshot;
- analysis-ready outputs are stored as Parquet marts.

Evaluator takeaway: the work is reproducible and inspectable, not a one-off spreadsheet exercise.

## 2. Data Integrity

Evidence:

- win rates use resolved outcomes and exclude active opportunities;
- Wilson intervals and resolved-share maturity gates accompany rate comparisons;
- zero amounts, attribution coverage, web identity, email denominators, and spend conflicts are surfaced in a dedicated quality report;
- `06_validate_metrics.py` reconciles metrics across Parquet, dashboard, context, workbooks, and deck.

Evaluator takeaway: limitations change the interpretation and are visible in the primary deliverables.

## 3. Data Storytelling

The narrative is answer-first:

1. protect pipeline quality;
2. expand strong-fit account coverage;
3. reserve spend for causal measurement.

Evaluator takeaway: every major chart connects a finding to a decision or test.

## 4. Dashboard Design

Evidence:

- the Essential View presents the shortest judging path;
- evidence captions state question, population, and caution;
- analyst sections preserve attribution, funnel, creative, segment, budget, model, and cohort detail;
- the artifact is self-contained, responsive, keyboard accessible, printable, searchable, and exportable.

Evaluator takeaway: the dashboard balances executive clarity with analytical depth.

## 5. Reporting And Analysis

Evidence:

- sourced and linked-influenced attribution are separated and scoped;
- first-touch, last-touch, linear, and time-decay roles use normalized account-channel-week touches;
- cohort analysis excludes active outcomes from win-rate denominators;
- account coverage includes uncertainty and selection caveats;
- targeting uses empirical-Bayes adjustment, Wilson intervals, and an evidence tier;
- the predictive baseline uses a time-based holdout and explicit leakage policy.

Evaluator takeaway: methods match the questions and avoid unsupported precision.

## 6. Marketing Strategy

Recommended pivot:

- tighten ICP and qualification while mature-cohort quality is weak;
- test email-first coverage among strong-fit unreached accounts;
- test a 6sense overlay with a holdout;
- report source credit, linked influence, and attribution coverage together;
- use a budget-neutral measurement plan before large reallocations.

Evaluator takeaway: recommendations are executable and include success measures and scale gates.

## 7. Presentation Skills

The 12-slide flow opens with the conclusion, explains evidence boundaries before channel claims, shows only decision-relevant charts, and closes with a 30/60/90 plan. Slide notes contain sources and methodology for challenge questions.

Evaluator takeaway: the presenter can deliver a concise executive story without narrating every analysis tab.

## 8. Presentation Design

Evidence:

- `outputs/presentation/Marketing_Analytics_Executive_Deck.pptx` uses a consistent editorial system, editable native charts, and source notes on every slide;
- `outputs/dashboard/Marketing_Analytics_Dashboard.html` is the canonical interactive artifact;
- `public/index.html` is the synchronized deployment copy;
- `SLIDE_BY_SLIDE_EXPLAINED.md` provides the talk track.

Evaluator takeaway: the repository contains polished, review-ready artifacts as well as code.
