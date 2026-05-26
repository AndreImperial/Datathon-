# Dashboard Audit Backlog

This backlog converts the 100-item UI/UX, charting, analysis, and engineering scan into tracked work. Items marked `Done` are implemented in code; `Next` items are the strongest remaining candidates for a follow-up product pass.

## Correctness And Trust

1. Done - Remove duplicate chart builder definitions in `04_html_dashboard.py`.
2. Done - Validate duplicate Python function definitions in the dashboard generator.
3. Done - Validate the one-command pipeline runner includes every pipeline phase.
4. Done - Validate generated dashboard and `public/index.html` stay in sync.
5. Done - Validate dashboard UX fragments exist after generation.
6. Done - Validate won opportunities are also marked closed.
7. Done - Validate won opportunities have close dates when available.
8. Done - Preserve a caveats drawer for attribution and ROI limitations.
9. Done - Show a data quality scorecard in the dashboard header.
10. Done - Flag low won-deal samples in the channel ROI table.

## High-Priority Analysis Improvements

11. Next - Replace remaining hardcoded narrative values with generated placeholders.
12. Next - Add confidence intervals to win-rate charts.
13. Next - Add statistical significance checks for segment/channel win-rate differences.
14. Next - Add minimum sample-size gating before declaring top performers.
15. Next - Add cohort analysis that excludes still-open recent deals.
16. Next - Add pipeline age and stale-opportunity analysis.
17. Next - Add amount outlier diagnostics.
18. Next - Add opportunity stage leakage diagnostics beyond won/closed checks.
19. Next - Add source-row count reconciliation after every pipeline step.
20. Next - Add raw Excel schema drift checks.

## Chart Fit Improvements

21. Done - Use a horizontal ranking for won revenue instead of a donut.
22. Done - Show deal velocity with IQR error bars.
23. Done - Separate cohort volume from conversion quality with subplots.
24. Done - Label chart captions with question, population, and caution.
25. Next - Replace attribution heatmap with grouped bars or small multiples for executive mode.
26. Next - Add a Pareto chart for channel concentration.
27. Next - Add optional log/linear scale toggle for skewed pipeline charts.
28. Next - Add box/violin plot when raw deal velocity rows are available.
29. Next - Add sample-size subtitles directly in Plotly chart titles.
30. Next - Add small multiples for sourced vs non-sourced cohorts.

## Attribution Improvements

31. Done - Show sourced vs influenced as bars against total pipeline.
32. Done - Add attribution caveats to the drawer.
33. Done - Add attribution reconciliation ratio to the quality strip.
34. Next - Add lookback-window comparison for 30/90/180/365 days.
35. Next - Add unattributed won revenue metric.
36. Next - Add account-level attribution detail table.
37. Next - Add channel path Sankey for winning journeys.
38. Next - Add touchpoint recency distribution.
39. Next - Add paid/owned/sales-assisted channel grouping.
40. Next - Add first-touch vs last-touch role labels by channel.

## Budget And ROI Improvements

41. Done - Separate pipeline ROI from revenue ROI in the channel table.
42. Done - Warn that ROI is tracked-spend only.
43. Done - Add directional budget scenario caveats.
44. Next - Add cost per opportunity by channel.
45. Next - Add cost per won deal by channel.
46. Next - Add fixed-budget reallocation scenario.
47. Next - Add diminishing-return scenario.
48. Next - Add budget sensitivity sliders.
49. Next - Add risk-adjusted ROI using win rate.
50. Next - Add scenario assumptions table.

## Model Improvements

51. Done - Show model AUC and validation text.
52. Done - Show open scored deal count.
53. Next - Add train/test row counts.
54. Next - Add class balance display.
55. Next - Add confusion matrix.
56. Next - Add calibration curve.
57. Next - Add precision/recall by threshold.
58. Next - Add top open-deal recommendation table.
59. Next - Add feature leakage audit.
60. Next - Add model version metadata.

## UI/UX Improvements

61. Done - Add print action.
62. Done - Add reset action.
63. Done - Add keyboard left/right section navigation.
64. Done - Add presentation/analyst mode.
65. Done - Remove the theme toggle per request.
66. Done - Add metric lens controls for dense tables.
67. Done - Add empty table states.
68. Done - Add KPI tooltips.
69. Done - Add a mobile nav drawer.
70. Done - Add dashboard-wide search.
71. Next - Add section-aware caveats.
72. Next - Add sticky section title while scrolling.
73. Done - Add export buttons for tables.
74. Done - Add visible focus outlines across all controls.
75. Done - Add reduced-motion mode.

## Color And Visual Design

76. Done - Use stable channel colors where available.
77. Done - Use neutral styling for table and quality states.
78. Next - Run a color-blind-safe palette review.
79. Next - Reserve red only for negative/risk states.
80. Next - Further reduce decorative glow in dense analysis sections.
81. Next - Increase muted text contrast for accessibility.
82. Next - Standardize chart/card spacing tokens.
83. Next - Add responsive chart height rules per viewport.
84. Next - Add print-specific chart sizing.
85. Next - Add visual regression screenshots.

## Data Quality Improvements

86. Done - Show unknown/other channel share.
87. Done - Show opportunity domain coverage.
88. Done - Show missing opportunity create dates.
89. Next - Add UTM completeness score.
90. Next - Add unknown-channel root cause table.
91. Next - Add domain match quality by data source.
92. Next - Add country/industry null dashboards.
93. Next - Add free-email-domain removal count.
94. Next - Add duplicate snapshot diagnostics in validation output.
95. Next - Add dashboard source freshness by source file.

## Engineering And Delivery

96. Done - Add `run_pipeline.py`.
97. Done - Add `run_pipeline.py --dry-run`.
98. Done - Keep dashboard generator copying into `public/index.html`.
99. Done - Add GitHub Pages deployment workflow.
100. Done - Add a validation CI workflow that compiles, dry-runs, and validates artifacts.
