# Detailed nitpick audit

2026-10-03 · Read-only follow-up to PROJECT_WIDE_AUDIT.md

This adds small, specific defects and refinement opportunities rather than repeating the broad repair backlog. **Confirmed** can mean browser reproduction or concrete local source/data evidence; it does not mean every edge case happened in a live session. **Risk** identifies an implementation path needing a regression reproduction. **Polish** is a design/editorial proposal. No application changes were made.

## Evidence defects worth fixing before cosmetic work

1. **Confirmed: currency sorting is wrong.** Ascending Sourced ($) sorts $1.1M, $1.5M, $15K, $30K … rather than numerical amounts. Reproduced in the browser; `App.tsx:459-462` sorts formatted strings. Preserve typed values for sorting and format after selection. [I01](./nitpicks-interactions.md)
2. **Confirmed: valid zero ROI becomes unavailable.** Both paid channels have measured zero won return, yet Revenue ROI shows a dash while chart/export preserve zero. `App.tsx:312-314`. Render 0.0×; reserve a dash for unmeasured. [I02](./nitpicks-interactions.md)
3. **Confirmed: missing heatmap cells lie in tooltips.** Two absent industry/segment combinations show a dash but their native title says $0. `Charts.tsx:261`. Use an unavailable tooltip, not a zero fallback. [I03](./nitpicks-interactions.md)
4. **Confirmed: denominator/secondary labels silently disappear.** SimpleRankedChart expects a second formatter argument, but installed Recharts calls the formatter with one argument. This drops creative impression counts, email engaged-person counts and journey pipeline context. Build a display field or use a supported content renderer. [I21](./nitpicks-interactions.md)
5. **Confirmed: expanded explanations contain stale results.** Two insights say $6.3M/695 opportunities while current generated evidence is $6.4M/684. `App.tsx:140,175`. Interpolate contract metrics. [C04](./nitpicks-copy.md)
6. **Confirmed: model units are inconsistent.** Accuracy is 0.767, training win rate is 57.3%, and a probability gap is 0.196 without a unit. Keep AUC/Brier unitless; show rate percentages and percentage-point gaps explicitly. [C02](./nitpicks-copy.md)
7. **Confirmed: attribution counts look channel-specific but are not.** Each channel row repeats 684, the entire linked population. Move the population above the table or name it window-linked population; do not invite summation. [C03](./nitpicks-copy.md)
8. **Confirmed: guide snapshot is stale.** SLIDE_BY_SLIDE_EXPLAINED.md cites 0996033d77dd2d46; current v3 is 33039705cd29047a. It also associates the local artifact with a live URL without a verified deployment receipt. Distinguish local and last verified remote state. [C13](./nitpicks-copy.md)

## Chart details

9. **Confirmed: heatmap has no unit-specific scale legend.** Users cannot infer the color domain or targeting saturation at 55%. Provide endpoints, units and saturation policy. [I04](./nitpicks-interactions.md)
10. **Confirmed: heatmap row/column/value relationships lack semantic association.** Generic divs and hover titles are insufficient for matrix traversal. Provide table/grid semantics or an equivalent associated representation. [I05](./nitpicks-interactions.md)
11. **Confirmed: compact money has a rounding boundary.** Values just below $1M can read $1000K. Use exact amounts in inspection tooltips/tables and compact ticks only. [I14](./nitpicks-interactions.md)
12. **Confirmed: score-band labels overlap at boundaries.** 0–25% and 25–50% share a visible endpoint but the code uses a defined right-closed membership rule. Label the actual inequalities. [C06](./nitpicks-copy.md)
13. **Confirmed: experimental lift labels should use pp.** “2% baseline / 1% absolute lift” should read “2% baseline / +1 pp, to 3%.” This prevents relative-versus-absolute confusion. [C05](./nitpicks-copy.md)
14. **Latent: return-multiple field would be formatted as dollars.** The generic formatter matches pipeline/spend and would turn .394835 into $0. The field is not rendered by current adapters, so this is not a current visible value error. Use per-field unit metadata. [C01](./nitpicks-copy.md)
15. **Latent after the suffix fix: secondary values lack their own units.** Counts need grouping and nouns; journey pipeline needs currency. Repair the formatter callback first, then format “42,000 impressions,” “n=234 engaged people,” and “$123K pipeline.” [C12](./nitpicks-copy.md)
16. **Polish: amount, sample and uncertainty should be visually distinct.** Keep the main measure prominent; give n/coverage and intervals consistent subordinate positions. Avoid repeating tiny unlabeled numerals.
17. **Polish: display precision should follow purpose.** Exact inspected amounts, readable axis abbreviations, enough CTR decimals to distinguish ticks, consistent decimal places across the same comparison, and no false precision in hypothetical costs.

## Navigation, presenter and edge cases

18. **Risk: same-index sequence switching leaves stale broadcast navigation.** Switching main-01 to appendix-01 does not change currentIndex; the listener dependency omits sequence. Presenter Next can use the previous sequence. Depend on current state/sequence. [I06](./nitpicks-interactions.md)
19. **Risk: revisions are written but not enforced.** Malformed/out-of-order messages are accepted after only snapshot matching; rapid commands can share a captured index. Validate message schema and update navigation atomically. [I07](./nitpicks-interactions.md)
20. **Confirmed implementation: pause uses the last timer poll.** It can lose up to roughly 250ms per pause instead of computing time at the pause event. Calculate from start time. [I08](./nitpicks-interactions.md)
21. **Risk: presenter looks connected after the audience leaves.** There is no stale/disconnected state. Show connection status and disable ineffective commands. [I09](./nitpicks-interactions.md)
22. **Confirmed implementation: invalid deep links retain a mismatched URL.** main-999 shows the fallback slide while the URL keeps the invalid ID; matching is not anchored. Validate exact IDs and canonicalize the fallback. [I10](./nitpicks-interactions.md)
23. **Confirmed implementation: refresh discards timer state despite saving it.** Restore validated session/snapshot state or explicitly reset the session. [I11](./nitpicks-interactions.md)
24. **Risk: blocked browser storage crashes initialization.** Optional persistence and session APIs need guards and in-memory fallback. [I12](./nitpicks-interactions.md)
25. **Confirmed: whitespace changes search behavior.** Search checks trimmed existence but matches untrimmed text. Browser “ channel ” returns a narrower result set than “channel.” Normalize once. The search is section navigation, not full evidence search; make that distinction clear. [I13](./nitpicks-interactions.md)
26. **Confirmed: sort direction lacks visible feedback.** One table keeps a downward arrow regardless of direction; another keeps a generic up/down symbol. aria-sort exists, but sighted state should agree. [I16](./nitpicks-interactions.md)
27. **Confirmed: visible sort order and CSV order differ.** CSV uses original rows. Export the selected order or explicitly label original-order export. [I17](./nitpicks-interactions.md)
28. **Confirmed: audience timer has no audience controls.** It relies on the console; unavailable BroadcastChannel makes controls silently ineffective. Offer controls or an explicit availability state. [I19](./nitpicks-interactions.md)
29. **Risk: dashboard presentation body class survives unmount.** Its effect has no cleanup, so styling can leak when switching surfaces. Keep owned classes scoped/cleaned up. [I20](./nitpicks-interactions.md)

## Accessibility and small-screen details

30. **Browser-confirmed: 320px deck has document overflow.** Viewport width is 320, but scrollbar leaves document clientWidth 305; html min-width 320 forces scrollWidth 320. The counter/right edge clips. Earlier innerWidth-only checks were insufficient. Compare scrollWidth against clientWidth, and test scrollbar-present layouts. `styles.css:44`.
31. **Browser-confirmed: deck header targets are 42×42px.** Overview and Fullscreen are below the project's 44px touch target goal. This alone is not a claim of WCAG failure; increase the hit area without bloating icons. `styles.css:478`.
32. **Browser-confirmed: five quality progressbars have no accessible name.** Nearby visual text does not label them programmatically. Associate each measure label and include a meaningful value text. `App.tsx:431-438`.
33. **Confirmed source: missing-create-date progress is hardcoded zero.** The text is dynamic, but Progress always gets value={0}; future missingness can contradict the bar. Define a real percentage or omit a progressbar for a count. `App.tsx:435`.
34. **Confirmed visible layout: table scrolling competes with page scrolling.** At 320px the experiment table has about 237px visible width versus 493px content; long rows wrap heavily inside a separately capped region. Provide a concise result first, an explicitly labelled detail region and a clear scroll affordance. This refines the already-reported keyboard table defect.
35. **Polish: make horizontal-scroll availability visible.** Native hover titles are not a mobile solution. Preserve exact labels via expansion or accessible detail controls.
36. **Polish: numerical cells need consistent alignment.** Deck tables currently inherit left alignment; use right-aligned tabular numerals for numeric columns while keeping text left-aligned. `styles.css:475`.

## Content, metadata and export details

37. **Confirmed: every main slide claims all four finding relationships.** The validator checks existence but not relevance. Map actual finding IDs per slide. [C07](./nitpicks-copy.md)
38. **Confirmed: dataset metadata uses generic, sometimes wrong populations.** Raw marketing source coverage is called generated from the canonical analytical population; source IDs are empty and “see definition” has no specific pointer. Provide source/grain/window/predicate metadata per dataset. [C08](./nitpicks-copy.md)
39. **Confirmed: a universal CRM scope kicker appears on non-CRM slides.** Creative impressions, engaged people, web recordings and eligible domains need their own populations. [C09](./nitpicks-copy.md)
40. **Confirmed: v3 manifest section identifiers do not match delivered navigation.** Either generate actual route IDs or call them logical evidence categories. [C10](./nitpicks-copy.md)
41. **Confirmed: humanizing underscores changes opaque identifiers.** It alters source filenames and content identifiers as well as schema keys. Humanize keys; preserve literal values. [C11/I15](./nitpicks-copy.md)
42. **Confirmed: offline CSV lacks snapshot, units and method scope.** Include metadata/sidecar so extracted evidence can be traced after regeneration. [I18](./nitpicks-interactions.md)
43. **Polish: “Data” currently expands a table rather than replacing the chart.** “Show data/Hide data” describes the actual behavior better than a Chart/Data switch. Preserve state semantics and avoid implying a mutually exclusive view.
44. **Polish: the default power scenario is not visually identified.** The caveat cites a default 4,426 requirement while nine equally styled scenarios appear above. Mark the selected assumption or present it separately, without implying the baseline is measured.
45. **Polish: repeated assumptions consume comparison space.** Alpha/power/allocation are the same across every scenario row. State them once, retaining them in exported metadata.
46. **Polish: feasible/insufficient labels should be easier to scan.** Use concise text plus a consistent status marker; keep hypothetical and measured states distinct.
47. **Polish: method codes should have nearby expansions.** FT/LT/LIN/TD, ICP, MQA and IQR need a consistent glossary or visible expansion where introduced.
48. **Polish: recorded won amount is clearer than realized revenue.** Keep the source's financial meaning explicit; use a consistent term across cards, charts and exports.
49. **Polish: distinguish resolved win rate from all-opportunity rate everywhere.** Use a consistent short label plus denominator; avoid alternating unqualified “win rate” and “conversion.”
50. **Polish: use one editorial convention.** Standardize 6sense capitalization, sentence/title case, en dashes versus arrows, n= spacing, thousand separators, percent/pp/multiple symbols, unavailable wording and source naming. Preserve official source identifiers.

## Recommended repair order

First repair sort/zero/missing/label/copy/metadata defects. Then presenter state and accessibility. Then responsive/print/export details. Finish with layout, typography, semantic color consistency and restrained motion. Subjective choices should be resolved against the chosen surface brief, not by applying arbitrary style rules.

Full evidence references: [interaction/chart details](./nitpicks-interactions.md), [copy/units/metadata details](./nitpicks-copy.md), [project-wide audit](./PROJECT_WIDE_AUDIT.md).

This is a 50-item detail checklist, not 50 independent root causes or proof that nothing else remains. Some items refine known issues, some are latent risks, and some are subjective polish. No exhaustive print/PDF, assistive-technology, 200% zoom, device performance or live deployment test is claimed. No application edits, commits or publication occurred.
