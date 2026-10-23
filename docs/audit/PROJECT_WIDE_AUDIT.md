# Project-wide follow-up audit

> **Historical snapshot.** This report records the state of the project when it was written. The working logs, scratch scripts and notes it referenced were removed in the repository cleanup and remain available in git history (commit `4f14d8d`). Current status is in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

2026-10-03 · **Needs revision** · **Partial verification across the full project inventory**

This review maps every major project area and identifies additional fixes after the prior repair. Application, analysis and generated deliverables were left unchanged. Only audit notes and evidence were added. Passing tests are retained evidence of the checks they cover, not a certification of every view.

## Inventory and coverage

| Area | Reviewed evidence | Coverage limit |
|---|---|---|
| Source data and cleaning | Eight source families, cleaned Parquets, latest-row selection, domain normalization, opportunity eligibility, ad uniqueness and missingness | Targeted independent source/Parquet checks; not a reconstruction of every workbook cell |
| Integration and metrics | Spend attribution, web grain, coverage, dates, resolved rates, canonical counts, budget envelope | Currency provenance and business definitions require supplied authority |
| Advanced methods | Model timing/features, calibration, velocity, targeting smoothing, sample-size logic | Prospective predictive validity remains unavailable |
| Attribution | Eligible windows, tied-channel credit, positional/weekly semantics, model totals | No causal validation or complete cross-source identity recovery |
| React dashboard | All ten section purposes; 24 placements from 21 reusable chart definitions; six sortable tables | Every section mapped; repetitive marks and combinations sampled |
| Presentation | All 16 main and six appendix slide adapters, overview, keyboard, presenter source, table regions | Presenter synchronization and print findings are source verified; popup console was not successfully exposed for a live two-window test |
| Design and charts | CSS/tokens, chart scales and formats, interval availability, brand/font consistency, mobile layout | No exhaustive color-vision, screen-reader or zoom certification |
| Motion | GSAP, Motion, Recharts/Tremor controls, reduced-motion implementation | No device frame-rate benchmark |
| Accessibility | Names, captions, drawer focus/inert behavior, keyboard controls, closed mobile navigation | No full assistive-technology run |
| Export and archives | CSV path, print CSS, legacy HTML, historical PPTX and optional generator | No actual final PDF/PowerPoint visual render in this pass |
| Hosting/security | Flask routes, local JSON exposure, isolated health fixtures, Pages/Render setup | Live hosting, publication rights, repository visibility and secrets not verified |
| Testing/reproducibility | Python tests, TypeScript, CI, dependency files, build outputs | No dependency vulnerability database scan or clean-machine full rebuild |
| Documentation | README, methodology, design authority, rubric mapping and historical deliverable status | Official competition rubric is absent |

The known inventory is 10 dashboard sections, 24 chart placements, six primary tables and 22 deck slides, plus legacy/export/hosting components. It is not a complete denominator for every claim, state and comparison. Category totals below therefore remain unknown; they must not be converted to an accuracy percentage.

## Dashboard best practices and quality

| Category | Observed defects | Assessment |
|---|---|---|
| Usefulness and completeness | Multiple / unknown | The acquisition year comparison lacks a classified 2024 population. Repeated executive framing pushes each section's evidence below the opening viewport. |
| Analytical clarity | Multiple / unknown | Costs, historical coverage prevalence, web grain, unavailable model states and raw table units need clearer definitions. |
| Visual and interaction consistency | Multiple / unknown | Keyboard/presenter, printable contrast, source footers, color utility, mobile navigation and surface branding defects remain. |

## Analytical correctness and robustness

| Category | Observed defects | Assessment |
|---|---|---|
| Source authority and confidence | Multiple / unknown | Motion classification is missing for all 2024 deals; currency and official rubric authority remain unverified. |
| SQL/value accuracy | Multiple / unknown | Unmeasured costs are zero, web rows are called sessions, and duration/calibration bins use misleading selection rules. |
| Within-chart agreement | Multiple / unknown | Some percent tooltips/ticks and raw tables omit units; unavailable comparisons and missing measurements need distinct states. |
| Complete source details | Multiple / unknown | Deck provenance exists, but print removes it; generic dashboard notes do not expose all contributors, date predicates and calculation steps. |
| Cross-artifact consistency | Multiple / unknown | Legacy HTML and historical PPTX/generator still contain retired definitions. Dashboard and deck have undocumented visual identities. |
| Data-quality controls | Multiple / unknown | Missing numeric values can become zero, model unavailability blocks unrelated views, and health/deployment gates miss broken artifacts. |
| Conclusion support | Multiple / unknown | Coverage differences have temporal ordering limitations; click-based creative scaling advice exceeds the safer matched-test interpretation. |

## Prioritized problems and proposed fixes

### First repair batch: analytical trust and release safety

| Priority | Problem and evidence | Proposed fix |
|---|---|---|
| P1 | **Acquisition comparison unavailable.** 2023 has 29 acquisition, three renewal and 622 unknown deals; 2024 has 1,191 unknown and no classified deals. Main slide 6 implies comparable years. The latest creation is December 20, so a complete-2024 claim is unsupported. | Show classification coverage by year, label known-motion subsets, make 2024 acquisition comparison unavailable, and use a supported all-motion comparison where appropriate. Do not infer motion from source channel. |
| P1 | **Unmeasured cost is zero and ROI periods differ.** Ten channels have zero exported cost per opportunity despite no measured spend. All-history pipeline is divided by partial 2023–2024 ad spend. | Preserve unknown cost as null; export measurement status and exact dates; align numerator and denominator windows before interpreting efficiency. |
| P1 | **Public JSON contains 411 identifiable active deals.** It includes opportunity IDs, account names, stages, amounts and scores. Local Flask serves it without authentication; static hosting would publish the same file. | Publish an aggregate score histogram, remove deal identifiers and unnecessary details from the deployable contract, and separate private inputs from public artifacts. Establish publication rights before repository-access/history actions. No live disclosure claim is made here. |
| P1 | **Deployment is independent of validation.** Pages uploads checked-in public files with only an index/nojekyll check. Render does not rebuild/validate them. | Deploy the exact artifact produced by a required successful build/semantic-validation job. Regenerate analytics when source or methodology changes. |
| P1 | **Unavailable model can crash the whole dashboard.** Safe model output can be empty, but payload validation rejects every empty chart. | Allow declared unavailable datasets with reasons and local empty panels; retain unrelated evidence. Add a frontend fixture for this path. |
| P1 | **Missing measurements become zero.** The dashboard number helper accepts null/empty as zero and defaults malformed values to zero. | Preserve nullable measurements and explicitly render unavailable values rather than invented 0% or score bins. |

### Second repair batch: methods, evidence and deliverables

| Priority | Problem and evidence | Proposed fix |
|---|---|---|
| P2 | **Coverage rates are historical prevalence.** Reach comes from 2024 logs, while outcomes can be from any CRM year. Of 638 reached domains with opportunities, 260 have no canonical 2024 creation. | Name the measure historical opportunity prevalence. Define exposure before a prospective outcome window for experiment baselines; enforce audience eligibility. |
| P2 | **Web grain is mislabeled.** 36,931 event rows are called sessions, versus 26,114 unique recordings. 1,169 flagged rows correspond to 1,067 recordings, and missing flags are not observed false results. | Label event rows faithfully; use unique recordings only with verified session semantics; call the flag observed contact activity rather than completed acquisition. |
| P2 | **Velocity selection hides fast wins.** 90 zero-day wins, 54 negative intervals and two over 730 days are excluded; only the minimum-channel-sample caveat is shown. | Retain valid zero-day wins, investigate negative intervals, and show duration coverage/exclusion reasons by group. |
| P2 | **Calibration breaks ties into arbitrary bands.** Two pairs of quintiles have identical mean predictions but different observed rates because rank(method='first') splits ties. | Use tie-preserving or meaningful fixed score bands with range, sample count and uncertainty. AUC/Brier are not invalidated by this display defect. |
| P2 | **Legacy copy still describes channel/segment/amount model features** and says accounts never received marketing touches. | Bind the actual calendar feature policy and qualify coverage by supplied sources/window; regenerate and inspect the archive. |
| P2 | **Historical PPTX generator recreates obsolete results.** It uses unfiltered opportunities, obsolete 80/20 wording and a prescribed 80/10/10 allocation; existing deck has 3,288/447/AUC .712. README calls it historical, but the generator remains unsafe as a current export. | Deprecate/watermark it or rebuild it from v3 definitions and document its special runtime. |
| P2 | **Recommendations still say scale high-CTR creative and retire weak ads.** CTR does not establish qualified pipeline or isolate confounded creative attributes. | Recommend matched creative tests within platform and scale only against a stated qualified-outcome guardrail. |
| P3 | **First touch is first retained weekly presence.** Latest-event weekly compression changes one earliest channel and reallocates $10,000 pipeline relative to first raw touch. | State this exact definition, or preserve earliest/latest within-week timestamps for positional models. Keep linear/time-decay policy explicit. |
| Needs input | **Currency authority is absent from the opportunity extract.** The UI renders USD. Official rubric authority is also absent. | Confirm case/source definitions and preserve recorded amounts; treat rubric mapping as proposed coverage rather than verified compliance. |

### Third repair batch: accessible UI, charts and exports

| Priority | Problem and evidence | Proposed fix |
|---|---|---|
| P1 | **Space overrides button activation.** Live check: Space on Previous at slide 4 advances to slide 5. | Ignore interactive targets in global slide shortcuts and test keyboard activation. |
| P1 | **Presenter state lacks connection handshake.** Late console starts at main-01; presenter keyboard updates itself rather than the audience. | Restore/request session- and snapshot-qualified state, route keyboard/buttons through shared commands, and show actual synchronization status. |
| P1 | **Long deck tables cannot be read reliably by keyboard.** They are capped at 42vh without a focusable named region; PageDown changes slides. | Make detail regions focusable/named, retain native scrolling keys there, and add captions/header scope. |
| P1 | **Print loses provenance and chart contrast.** Global footer suppression removes deck sources/snapshot; white print backgrounds retain near-white SVG labels. | Scope chrome hiding, retain evidence footers/caveats, use print-aware chart colors and verify an actual PDF. |
| P2 | **Data tables show raw fractions and omit fields.** Live share .167173... is not formatted as a percent; amount 4158722 has no currency. First-nine-key truncation can hide intervals/denominators. | Use explicit contract columns and unit metadata; include scope, sample and CI fields; retain full downloadable evidence. |
| P2 | **Comparison slides remain dense tables.** Main 6 contains small samples and available intervals are omitted. | After repairing its population, use paired year estimates with intervals and sample labels; move detail rows into accessible expansion/appendix. |
| P2 | **Chart formatting/color errors.** Segment tooltip loses percent unit; 6sense creative axis repeats rounded 0.0/0.1% labels; monthly trend lacks intended teal shade utilities. | Fix formatter bindings, use suitable CTR precision, and verify generated color classes/actual marks. |
| P2 | **Modal/hidden navigation accessibility gaps.** Overview background lacks inert handling. Closed mobile sidebar remains in the accessibility tree offscreen. Overflow menu lacks menu keyboard behavior. | Use inert/visibility semantics for closed/background content; implement a proper menu pattern or ordinary disclosure controls. |
| P2 | **URL and deck state can diverge.** Slide hash is parsed only at initialization. | Validate and synchronize hash changes; decide browser-history behavior deliberately. |
| P2 | **Section evidence is below repeated framing.** Every dashboard section repeats the same KPI hero, story strip and three chips. At 390px, this consumes most of the first screen before section evidence. | Keep compact persistent context and let section-specific evidence lead on deeper routes. |
| P2 | **Two undocumented visual identities.** Dashboard is black/crimson Revenue Command; deck is ivory/green NORTHSTAR. DESIGN.md specifies Manrope-only while deck uses serif fallback. | Decide and document shared brand plus surface-specific tokens; use semantic/channel mappings with labels, not arbitrary extra colors. |
| P3 | **Newsreader is not loaded and presenter text has mojibake.** | Load the intended self-hosted face or document Georgia; fix NOW's extra character. |

### Supporting engineering work

| Priority | Problem | Proposed fix |
|---|---|---|
| P2 | `/full-analysis` bypasses a GitHub Pages repository prefix. | Use a base-aware relative archive URL and test under a non-root path. |
| P2 | Health returned 200 in isolated fixtures with a missing lazy chart chunk and malformed v3 JSON. | Parse/validate contracts and verify a generated build manifest including imported chunks. |
| P2 | No frontend interaction test gate; Python versions have minimum constraints but no tested lock. | Add high-value semantics/keyboard/unavailable/subpath fixtures and preserve a tested Python environment. |
| P2 | Hardcoded coverage values/lifetime text can drift independently of data. | Derive figures and source-window language from the contract. |
| P3 | Domain normalization leaves several URL/email/path-shaped strings; legacy email identity drops 45 recoverable rows. | Harden domain parsing without guessing identities; align documented email fallback. Quantify changed matches before adopting. |
| P3 | CSV quoting does not neutralize text formulas. No formula-prefixed current public values were found. | Escape textual formula prefixes at export, preserving real negative numbers. |

## Design and motion direction

Charts and interaction should precede more animation. Existing dashboard motion already respects reduced-motion checks and charts disable animation. Add restrained slide transitions only after keyboard/scroll behavior is sound; do not replay data reveals on every filter change. Preserve semantic colors, distinguish channels/models with stable mappings and noncolor cues, increase small label readability, and avoid decorative motion in evidence-heavy sections.

Performance is an optimization opportunity, not a measured failure: public v2/v3 JSON total about 885KB; major JS files include roughly 589KB Recharts, 409KB Tremor and 168KB motion before compression. Profile actual loading and remove unnecessary public deal detail before replacing libraries. No frame-rate/network benchmark was performed.

## Verified positives and evidence

Canonical totals remain 3,245 opportunities. Budget plans correctly use a $1,221,356.49 ad-metrics envelope, distinct from campaign-account spend. Targeting adjusted rates really use smoothing. Prior precreation/tied-channel attribution repairs remain represented. Existing 24 Python tests and TypeScript check pass. Mobile sampled layouts had no document horizontal overflow and exposed top-bar targets met the 44px check. Dashboard drawer/caveat focus containment and reduced-motion controls already exist.

Detailed reproducible evidence and line references:

- `Numerical/methodological review`
- `Frontend/accessibility/design review`
- `Engineering/deployment/privacy review`
- `Independent lead recomputation` and `aggregate results`
- `Current regression tests` and `TypeScript check`

No commit, push, deployment, external source write or application repair was performed in this follow-up audit. The prior repair receipt remains historical; this report supersedes any impression that passing its checks means the entire project is ready.

Impeccable context also reported that the generated design sidecar is stale relative to DESIGN.md. A document refresh can reconcile it after the surface identity is decided. This is housekeeping, not an analytical blocker.
