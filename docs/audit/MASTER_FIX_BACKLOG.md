# Master fix backlog

> **Historical snapshot.** This report records the state of the project when it was written. The working logs, scratch scripts and notes it referenced were removed in the repository cleanup and remain available in git history (commit `4f14d8d`). Current status is in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

Updated 2026-10-03. **Single consolidated repair ledger.** Duplicates from the project-wide audit, nitpick audit and existing backlog are merged into root-cause work items. No application changes are made by this document.

Status after authorized repairs: **49 items closed locally;5 implemented with acceptance/policy dependencies open;5 external-input/source items open.** Unchecked does not mean untouched; read each closure note. **Confirmed** means demonstrated source/data/browser evidence; **risk** needs an edge-case regression reproduction; **polish** is a proposal; **Needs input/source data** must not be resolved by inventing facts. Prior repaired items are retained as regression requirements, not reopened automatically.

Priorities: P1 = analytical trust, privacy, availability or essential usability; P2 = correctness/interpretation or significant improvement; P3 = polish, robustness or optional enhancement. External deployment, messaging, access changes and destructive repository cleanup are outside this consolidation.

## 1. Data correctness and analytical meaning

### F01 — Repair acquisition/motion comparisons

- [x] **P1 · Confirmed**

**Work:** Expose classification coverage by year; distinguish unknown from no acquisition; mark 2024 acquisition comparison unavailable; remove complete-calendar-year wording; label all-history known-motion subsets.

**Done when:** 2024's 1,191 unknown-motion records never become zero acquisition. Every comparison names its actual period and classified denominator.

**Evidence:** Project-wide audit; numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F02 — Repair measured costs and period-matched ratios

- [x] **P1 · Confirmed**

**Work:** Keep untracked spend/cost null with measurement status; align recorded pipeline and spend observation windows; retain all-history measures separately.

**Done when:** Unmeasured channels do not imply free acquisition; numerator and denominator dates appear beside every efficiency ratio.

**Evidence:** Project-wide audit; numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F03 — Preserve missing, zero and malformed states

- [x] **P1 · Confirmed**

**Work:** Replace numeric zero fallbacks; preserve actual zero ROI as 0.0×; give missing heatmap cells unavailable tooltips.

**Done when:** Null/empty/malformed values never become measured zero; valid zero agrees across charts, tables and exports.

**Evidence:** Project-wide audit; N2–3; I02–03.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F04 — Correct coverage time ordering

- [x] **P2 · Confirmed**

**Work:** Call current rates historical opportunity prevalence; qualify supplied-window reach; define exposure before prospective outcomes for test baselines and enforce customer/active-pipeline exclusions.

**Done when:** The 2024 reach/all-history outcome association is explicit and never presented as post-exposure conversion.

**Evidence:** Numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F05 — Correct web grain and goal semantics

- [x] **P2 · Confirmed**

**Work:** Separate event rows, recordings and visitors; verify recording-session definition; call contact flags observed activity and preserve unknown goal status.

**Done when:** 36,931 rows are not labelled 36,931 sessions; 1,169 flags are not presented as 1,169 independent completed acquisitions.

**Evidence:** Numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F06 — Repair duration eligibility and disclosures

- [x] **P2 · Confirmed**

**Work:** Retain valid same-day wins; investigate negative intervals; disclose upper-bound exclusions and sample coverage by channel/motion.

**Done when:** Zero-day, negative and >730-day groups reconcile to canonical wins; exclusions are visible.

**Evidence:** Numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F07 — Repair calibration and score-band definitions

- [x] **P2 · Confirmed**

**Work:** Use tie-preserving/fixed probability bins; show score range, sample and uncertainty; label exact interval boundaries; keep active scores exploratory.

**Done when:** Identical predictions are not arbitrarily split into different risk bands; 25/50/75% membership is unambiguous.

**Evidence:** Numerical notes; N12.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F08 — Define positional attribution semantics

- [x] **P3 · Decision needed**

**Work:** Choose first raw eligible event versus first retained weekly presence; preserve within-week endpoints if changing semantics; document linear/time-decay separately.

**Done when:** The $10,000 positional difference is reconciled and no policy changes silently.

**Evidence:** Numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F09 — Harden identity normalization

- [x] **P3 · Confirmed / impact pending**

**Work:** Parse malformed URL/email/path domain values; align legacy email identity fallback; quantify changed linkage before adoption.

**Done when:** No guessed identities; 45 recoverable email rows have an explicit policy and reconciled effect.

**Evidence:** Numerical notes.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

## 2. Privacy, release safety and reliability

### F10 — Remove identifiable deals from public contracts

- [x] **P1 · Confirmed**

**Work:** Replace 411 deal-level active records with aggregate diagnostics; separate private source data from deployable artifacts; add a public-field denylist.

**Done when:** Public JSON/export contains no unnecessary account names, deal IDs, stages or individual commercial amounts.

**Evidence:** Engineering E1.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F11 — Gate deployment on the exact validated artifact

- [x] **P1 · Confirmed**

**Work:** Make Pages/Render deploy depend on successful build and semantic validation; regenerate analytics when relevant sources/methods change.

**Done when:** A failed validation cannot publish; deployed bytes come from the successful required job.

**Evidence:** Engineering E2.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F12 — Support legitimately unavailable model panels

- [x] **P1 · Confirmed**

**Work:** Allow declared empty analytical datasets with reasons and render per-panel unavailable states.

**Done when:** Insufficient-history fixture leaves unrelated dashboard sections usable.

**Evidence:** Engineering E3.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F13 — Strengthen readiness checks

- [x] **P2 · Confirmed**

**Work:** Parse/schema-check JSON and validate imported/lazy assets using a build manifest.

**Done when:** Missing chart chunk, malformed JSON or incompatible contract yields not-ready rather than HTTP 200.

**Evidence:** Engineering E5.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F14 — Fix repository-prefix hosting

- [x] **P2 · Confirmed**

**Work:** Use base-aware archive links throughout contracts and UI.

**Done when:** Archive opens under both localhost root and a Pages repository subpath.

**Evidence:** Engineering E4.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F15 — Add frontend semantic and interaction tests

- [x] **P2 · Gap**

**Work:** Cover typed sorting, units, missing/empty results, route/filter updates, keyboard/dialog behavior, presenter synchronization, exports and subpath hosting.

**Done when:** Tests assert meaningful values/behavior and run in the deployment gate.

**Evidence:** Engineering E8; nitpick evidence.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F16 — Lock the tested Python environment

- [ ] **P2 · Gap**

**Work:** Record Python/dependency versions, maintain a lock/constraints upgrade process and include versions in analytical run metadata.

**Done when:** A clean environment reproduces the validated run within documented tolerances.

**Evidence:** Engineering E9.


**2026-10-03 closure:** **Implemented; acceptance dependency open:** Lock and run metadata implemented; clean Python-environment reproduction remains unverified.

### F17 — Neutralize textual CSV formulas

- [x] **P3 · Latent risk**

**Work:** Escape formula-prefixed text at export while preserving real numeric negatives.

**Done when:** Formula-label and negative-number fixtures pass; current absence of formula strings is not mistaken for protection.

**Evidence:** Engineering E10.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F18 — Add freshness/schema-drift controls

- [ ] **P2 · Production enhancement**

**Work:** Define expected source dates, schema and refresh policy before scheduled production use.

**Done when:** Stale or changed sources are identified with actionable status; generated-at is not treated as source freshness.

**Evidence:** Existing backlog #4.


**2026-10-03 closure:** **Implemented; acceptance dependency open:** Workbook schema drift and historical freshness controls implemented; production source-owner expected dates/cadence remain pending.

## 3. Evidence contracts, units, charts and tables

### F19 — Sort typed values before formatting

- [x] **P2 · Confirmed**

**Work:** Replace formatted-string collation for numeric columns; set missing-last policy; show active sort direction.

**Done when:** Ascending amounts/decimals/negatives are numerically correct; $1.5M does not precede $30K.

**Evidence:** N1,26; I01,I16.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F20 — Use explicit field units and precision

- [x] **P2 · Confirmed**

**Work:** Define rates, pp gaps, multiples, dollars, counts, AUC/Brier and dates; fix segment tooltip, CTR ticks, $1000K boundary and latent ratio-as-dollars formatting.

**Done when:** Exact tooltips/tables and compact axes agree; fractions and multiples never gain the wrong unit.

**Evidence:** N6,11,14,17; project chart findings.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F21 — Restore sample and secondary labels

- [x] **P2 · Confirmed**

**Work:** Repair the unsupported Recharts formatter callback; format impressions, engaged people and journey amounts with labels/units.

**Done when:** Supporting counts and amounts are actually visible and agree with exported rows.

**Evidence:** N4,15–16; I21.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F22 — Complete data alternatives

- [x] **P2 · Confirmed**

**Work:** Remove first-nine-column truncation; choose explicit fields including scope, denominator and CI; align numeric cells; preserve opaque identifiers.

**Done when:** No important denominator/interval disappears due to key order; sources and asset identifiers remain exact.

**Evidence:** Project-wide audit; N36,41.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F23 — Show attribution population once

- [x] **P2 · Confirmed**

**Work:** Separate window-wide linked population from channel-specific counts and guard against summation.

**Done when:** 684 is clearly the whole-window population, not a per-channel count.

**Evidence:** N7.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F24 — Make heatmaps interpretable and accessible

- [x] **P2 · Confirmed**

**Work:** Add unit-specific legends, endpoints/saturation policy, semantic row/column associations and nonhover access to missingness/low-n.

**Done when:** Dollar and rate matrices have understandable scales and accessible cell relationships.

**Evidence:** N9–10,35.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F25 — Repair generated chart colors

- [x] **P2 · Confirmed**

**Work:** Fix missing Tremor shade utilities; use stable semantic/channel/model mappings with labels/patterns/shapes.

**Done when:** Actual marks and legends match in the compiled build, including the second monthly series.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F26 — Improve comparison charts after fixing populations

- [x] **P2 · Defect + design proposal**

**Work:** Use paired estimates/intervals with sample labels where supported; keep detailed tables accessible rather than making sparse rates a leaderboard.

**Done when:** The corrected comparison is readable, uncertainty remains visible and unavailable groups remain unavailable.

**Evidence:** Project-wide audit; N16.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F27 — Clarify chart/data expansion

- [x] **P3 · Polish**

**Work:** Use Show data/Hide data for expansion, retain clear controls/state and appropriate accessible descriptions.

**Done when:** Control wording matches whether a table expands or replaces a chart.

**Evidence:** N43.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

## 4. Presenter, routing, timer and browser state

### F28 — Repair slide keyboard behavior

- [x] **P1 · Confirmed**

**Work:** Exclude buttons/links and focused scroll regions from global shortcuts; retain native activation and scrolling.

**Done when:** Space on Previous moves backward; PageDown inside evidence reads evidence rather than changing slides.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F29 — Unify presenter/audience state

- [x] **P1 · Confirmed + risks**

**Work:** Add session/snapshot handshake, validated message schema, revision ordering and atomic commands; include sequence in navigation state; route console keyboard through shared commands.

**Done when:** Late-open console, equal-index sequence switch and rapid commands keep slides/notes synchronized.

**Evidence:** Project-wide audit; N18–19.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F30 — Expose connection lifecycle and fallback

- [x] **P2 · Risk**

**Work:** Show connected/stale/disconnected status; disable ineffective controls; handle audience exit and unavailable BroadcastChannel.

**Done when:** No permanent connected signal or silently nonfunctional actions.

**Evidence:** N21,28.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F31 — Validate and synchronize deck routes

- [x] **P2 · Confirmed + edge cases**

**Work:** Accept exact known IDs; canonicalize malformed links; synchronize hash changes and specify browser-history behavior.

**Done when:** URL, visible slide and sequence agree for direct navigation and invalid-ID fixtures.

**Evidence:** Project-wide audit; N22.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F32 — Make timer timing and restoration exact

- [x] **P3 · Confirmed**

**Work:** Compute pause time at the event; stabilize interval lifecycle; restore validated session state or explicitly reset it; provide audience controls/status.

**Done when:** Pause/resume and refresh have a documented, tested clock policy.

**Evidence:** N20,23,28.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F33 — Guard optional storage/session APIs

- [x] **P3 · Risk**

**Work:** Use guarded persistence and in-memory fallback when storage or UUID support is unavailable.

**Done when:** The UI still opens in blocked-storage contexts and displays an actionable limitation.

**Evidence:** N24.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F34 — Normalize navigation search

- [x] **P3 · Confirmed**

**Work:** Trim/case-normalize once; clarify section-only scope and add a clear-query affordance.

**Done when:** Whitespace does not unexpectedly alter results; no false promise of full evidence search.

**Evidence:** N25.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F35 — Clean up surface-owned body state

- [x] **P3 · Risk**

**Work:** Remove mode classes/styles on unmount and avoid dashboard/deck style leakage.

**Done when:** Switching surfaces does not retain unintended dashboard mode styling.

**Evidence:** N29.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

## 5. Accessibility, responsive layout and print

### F36 — Make bounded evidence tables keyboard-readable

- [x] **P1 · Confirmed**

**Work:** Add named focusable scroll regions, captions/header associations and clear scrolling cues.

**Done when:** Every row can be inspected using keyboard without triggering slide navigation.

**Evidence:** Project-wide audit; N34–35.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F37 — Complete modal and hidden-navigation semantics

- [x] **P2 · Confirmed**

**Work:** Make overview background inert; remove closed mobile sidebar from traversal; implement menu keyboard pattern or use ordinary disclosure semantics.

**Done when:** Focus and assistive traversal match the visible modal/navigation state.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F38 — Repair quality-bar semantics and dynamic values

- [x] **P2 · Confirmed**

**Work:** Name all five progressbars; give meaningful value text; replace hardcoded missing-date value with a real percentage or count presentation.

**Done when:** Accessible name/value agrees with visible data, including nonzero missing-date fixtures.

**Evidence:** N32–33.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F39 — Fix narrow clipping and hit areas

- [x] **P2 · Browser confirmed**

**Work:** Remove minimum-width/scrollbar conflict; compare scrollWidth with clientWidth; meet the project's 44px target goal for deck controls.

**Done when:** 320px with scrollbar has no document overflow or clipped counter; header hit areas meet project policy.

**Evidence:** N30–31.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F40 — Repair print provenance and contrast

- [ ] **P1 · Confirmed source / render pending**

**Work:** Retain sources/snapshot/caveats; scope footer/chrome hiding; use print-safe chart marks; paginate tables appropriately.

**Done when:** Actual final PDF preserves evidence, readable labels and complete rows across page breaks.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** **Implemented; acceptance dependency open:** Print provenance/ink/pagination repaired; actual browser-produced final PDF remains unverified because the exposed browser has no print/PDF export capability.

### F41 — Broaden accessibility/responsive verification

- [ ] **P2 · Gap**

**Work:** Test text zoom, keyboard, long strings, contrast, screen-reader traversal and relevant viewport classes; add focused visual regression checks.

**Done when:** Named devices/states are verified; no unsupported blanket WCAG claim.

**Evidence:** Coverage gaps; existing backlog #5.


**2026-10-03 closure:** **Implemented; acceptance dependency open:** Desktop,320px,keyboard and accessible-tree samples verified; text zoom,real screen-reader/device coverage and comprehensive contrast/visual regression remain pending.

## 6. Copy, lineage, documentation and deliverables

### F42 — Replace stale hardcoded figures and methods

- [x] **P2 · Confirmed**

**Work:** Bind insights/coverage to current metrics; remove $6.3M/695 text, stale feature claims and lifetime touch wording in React/legacy HTML.

**Done when:** All authored views and archive agree with the current snapshot and actual source windows.

**Evidence:** Project-wide audit; N5.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F43 — Fix snapshot and deployment receipts

- [x] **P2 · Confirmed**

**Work:** Update local guide snapshot dynamically and separate local from last verified published version.

**Done when:** No live-version assertion is made without verified deployment revision/time.

**Evidence:** N8.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F44 — Map real provenance and evidence relationships

- [x] **P2 · Confirmed**

**Work:** Give each dataset actual sources/grain/windows/predicates; set slide-specific scope/finding IDs; align manifest routes or name them logical categories.

**Done when:** Metadata no longer assigns CRM grain to ad/email data or all findings to every slide.

**Evidence:** N37–40.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F45 — Repair/deprecate historical PPTX generation

- [x] **P2 · Confirmed**

**Work:** Either rebuild from current v3 definitions or explicitly archive/watermark generator and deck; document its special runtime.

**Done when:** Regeneration cannot silently restore deleted populations, old model evaluation or prescriptive budget splits.

**Evidence:** Engineering E7.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F46 — Align recommendations with evidence limits

- [x] **P2 · Confirmed**

**Work:** Replace CTR-based scaling/retirement advice with matched tests and qualified-outcome guardrails; keep current model operationally unvalidated.

**Done when:** Recommendations never imply creative causality, prospective model validity or ROI optimization not supported by data.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F47 — Make exports independently traceable

- [x] **P2 · Confirmed + polish**

**Work:** Include snapshot/time, units, source scope/method metadata; export visible sort order or label original order; retain exact identifiers.

**Done when:** An offline extract can be traced and interpreted without reopening the dashboard.

**Evidence:** N27,41–42.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F48 — Standardize terms and experiment explanation

- [x] **P3 · Polish**

**Work:** Use consistent resolved-win-rate/recorded-won-amount terms; expand acronyms; standardize symbols/case/precision; use +pp labels; identify default hypothetical power assumption once and make feasibility scannable.

**Done when:** Copy uses one convention, keeps real source names and does not present hypothetical baselines as observed.

**Evidence:** N13,44–50.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

## 7. Design, color, typography, motion and performance

### F49 — Document dashboard/deck visual relationship

- [x] **P2 · Design decision**

**Work:** Choose a shared brand and intentional surface exceptions; establish semantic tokens, channel/model mappings and design authority.

**Done when:** Revenue Command/NORTHSTAR and black/crimson versus ivory/green have an explicit coherent relationship.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F50 — Fix intended fonts, encoding and design sidecar

- [x] **P3 · Confirmed + housekeeping**

**Work:** Load/document the actual fonts; remove presenter mojibake; reconcile generated design sidecar after design decisions.

**Done when:** Rendered typography matches the declared design; no extra encoding characters or contradictory sidecar tokens.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F51 — Lead deeper routes with specific evidence

- [x] **P2 · Polish**

**Work:** Reduce repeated hero/KPI/story/chip blocks; clarify headline → evidence → caveat → action hierarchy.

**Done when:** Users reach section-specific evidence sooner, particularly on mobile, without losing context.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F52 — Improve dense layouts and numeric typography

- [x] **P3 · Polish**

**Work:** Make sample/uncertainty subordinate but legible; align numbers consistently; improve long labels, nested scrolling and experiment summaries.

**Done when:** Reading order and comparisons remain clear across desktop/mobile and accessible detail views.

**Evidence:** N16,34–36,44–46.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F53 — Add purposeful motion only after interaction repairs

- [x] **P3 · Optional enhancement**

**Work:** Use restrained slide transitions/reveals; preserve reduced-motion alternatives; avoid replay on every filter change or animation that delays reading.

**Done when:** Motion improves state orientation without blocking tasks or removing final evidence.

**Evidence:** Earlier design recommendations; project-wide audit.


**2026-10-03 closure:** Implemented and locally verified against snapshot `386ea2031409f547`; see [final repair verification](FIX_VERIFICATION.md) and scoped receipts.

### F54 — Measure performance before optimizing

- [ ] **P3 · Investigation first**

**Work:** Profile data loading, JS, rendering and device frame rates; remove unnecessary public detail; optimize justified bottlenecks.

**Done when:** Measured before/after results support any bundle/library/animation change; size alone is not called a runtime failure.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** **Implemented; acceptance dependency open:** Public contract measured567224→274685 bytes against tracked HEAD; no device frame-rate/render/loading profiler available, so runtime performance acceptance remains pending.

## 8. External evidence and future data enhancements

### F55 — Confirm currency and governing rubric

- [ ] **Needs input**

**Work:** Obtain supplied-case currency authority and official competition rubric; distinguish proposed mapping from verified compliance.

**Done when:** USD and rubric claims have inspectable authority; recorded amounts are preserved meanwhile.

**Evidence:** Project-wide audit.


**2026-10-03 closure:** **Blocked on external input/source authority:** Currency authority and official rubric not supplied.

### F56 — Establish publication/privacy rights

- [ ] **Needs input**

**Work:** Verify repository visibility, source-data publication rights and last live deployment before access changes or history cleanup.

**Done when:** No unsupported claim of lawful publication or live disclosure; consequential actions have concrete authorized scope.

**Evidence:** Engineering E1.


**2026-10-03 closure:** **Blocked on external input/source authority:** Publication rights,repository visibility and last live revision not independently verified; no access/history/deployment changes.

### F57 — Backfill opportunity amounts

- [ ] **Needs source data**

**Work:** Obtain authoritative amounts and preserve an auditable correction history before rerunning revenue analyses.

**Done when:** No amounts are invented; changed totals reconcile to supplied records.

**Evidence:** Existing backlog #1.


**2026-10-03 closure:** **Blocked on external input/source authority:** Authoritative opportunity amount corrections not supplied.

### F58 — Add sent/delivered email records

- [ ] **Needs source data**

**Work:** Obtain campaign delivery denominators and agreed metric definitions before publishing standard email response rates.

**Done when:** Send/delivery-based rates reconcile to actual records; engagement-log shares remain distinct.

**Evidence:** Existing backlog #2.


**2026-10-03 closure:** **Blocked on external input/source authority:** Sent/delivered email denominator records not supplied.

### F59 — Add governed account-opportunity-touch drill-through

- [ ] **Future product work**

**Work:** Persist reconciled detail privately with access controls, identifiers and window semantics; public views remain aggregate.

**Done when:** Authorized analysts can trace a figure without exposing private records through public artifacts.

**Evidence:** Existing backlog #3.


**2026-10-03 closure:** **Blocked on external input/source authority:** Private analyst authorization/access policy and hosting context not supplied; detail remains private and is excluded from public contracts.

## Execution and verification

There are **59 consolidated work items**. This is a planning count, not 59 independently reproduced bugs. A work item can contain several related symptoms, and optional polish is explicitly identified.

Recommended order: resolve analytical definitions and public-contract safety → unavailable/missing states and release gate → evidence tables/charts and presenter accessibility → responsive/print/export → copy/lineage and archive consistency → design polish/motion. Confirm external authorities independently. Run applicable regression checks after each coherent batch; finish with full regeneration, cross-artifact validation, keyboard/desktop/narrow checks and actual final print/export inspection. Deployment must consume the same verified build.

Closure rule: do not check an item merely because code changed. Record the verifying evidence, snapshot/build and date. A risk can close as “not reproduced/not applicable” only with a documented reason. Retain intentional method policy and preserve raw evidence.

## Preserve prior repairs

Canonical nondeleted selection, opportunity-window-before-weekly-compression ordering, domain activity conservation, tied-channel attribution, common-support decomposition, as-of model eligibility/calendar-only feature policy, explicit slide adapters and substantive appendix content remain regression constraints. The first repair's passing tests are baseline evidence, not proof that all remaining work is complete.

## Sources and reference key

- [Project-wide audit](PROJECT_WIDE_AUDIT.md)
- `50-item nitpick audit` — N1–N50 refer to its numbered items.
- `Numerical notes`
- `Engineering notes` — E1–E10.
- `Frontend notes`
- `Interaction nitpicks` — I01–I21.
- `Copy nitpicks`
- `Prior repair verification`

The older reports remain evidence snapshots. This file is the working backlog. The 320px overflow and 42px deck-target findings qualify the earlier sampled mobile acceptance; they must not be lost during consolidation.

