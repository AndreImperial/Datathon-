# Datathon audit — 3 October 2026

> **Historical snapshot.** This report records the state of the project when it was written. The working logs, scratch scripts and notes it referenced were removed in the repository cleanup and remain available in git history (commit `4f14d8d`). Current status is in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

**Needs revision. Review coverage: Partial.** The descriptive CRM foundation is credible, but the delivered dashboard and browser presentation are not ready for submission. Their populations disagree, presentation evidence is broken or incomplete, and current model validation is overstated.

Application code, source workbooks, and existing analytical deliverables were preserved. Only audit notes, scratch calculations, and evidence files were added under `audit/`. Existing working-tree changes predated this review. The full pipeline was not rerun because that would replace the artifacts being audited.

## Scope and evidence

Reviewed the eight supplied Excel workbooks, raw opportunity snapshot selection, cleaned and selected integrated Parquet data, both JSON contracts, pipeline methods, documentation, local compiled dashboard, and browser presentation. Inspected representative dashboard paths and presentation states at desktop and narrow widths. Read all 22 slide specifications and traced their shared renderer. Historical PPTX/playbook PDFs and live deployments were not visually audited. No original competition brief or official scoring rubric was located; `RUBRIC_ALIGNMENT.md` is the project's own checklist, so official competition compliance remains unverified.

Nine application/model regression tests passed; TypeScript typechecking passed. The release metric validator **failed** with `AssertionError: Appendix appendix-01 body is generic`. No production rebuild was performed. Passing tests do not establish analytical validity.

The scorecard counts below refer to explicitly mapped evidence components, not percentages of correctness. Category inventories remain incomplete across the entire datathon, so denominators are shown as **unknown**; shared symptoms are not counted as independent evidence of complete coverage.

## Dashboard and presentation quality

| Category | Observed defects | Assessment |
|---|---|---|
| Usefulness and completeness | 6 / unknown | All six appendix slides contain identical placeholder bodies and no evidence chart references. Several main slides omit required comparisons. Official brief unavailable. |
| Analytical clarity | 4 / unknown | Business motion, channel effectiveness, channel trends, and conversion drivers do not show the comparison promised by their headline. Other main-slide bindings also need repair. |
| Visual and interaction consistency | 6 / unknown | Sampled presentation slides 1, 5, 7, 8, 13 and appendix 1 share an unstyled presentation layout. Dashboard navigation and a chart-data toggle worked. Full control, export, print, keyboard and screen-reader coverage is incomplete. |

## Analytical correctness and robustness

| Category | Observed defects | Assessment |
|---|---|---|
| Source authority and confidence | 1 / unknown | Model diagnostics claim canonical evidence while retaining deleted records. Supplied files support descriptive totals; original field definitions and official brief unavailable. |
| SQL/value accuracy | 5 / unknown | Conversion-driver slide, recommendation slides 13/16, touch-linked count and master campaign-spend aggregation have demonstrated invalid or misleading values. Local Python/JSON calculations; no SQL source. |
| Within-chart agreement | 5 / unknown | Channel effectiveness, conversion drivers, advertising content, source/touch overlap and target audience have headline/label/value discrepancies. |
| Complete source details | 6 / unknown | Appendix 1–6 provide generic source footers and no substantive methods. Main-slide caveats and footers are also largely generic. Full source-detail inventory incomplete. |
| Cross-artifact consistency | 3 / unknown | Opportunity count, pipeline total and active-model population disagree between current documentation/brief and other delivered evidence. |
| Data-quality controls | 3 / unknown | Deleted-record filtering varies by path, weekly compression drops eligible touches, and shared-domain activity repeats across CRM account rows. |
| Conclusion support | 2 / unknown | Predictive validation uses future training outcomes; absent-period groups receive unsupported within-group decomposition effects. Causal and creative caveats are otherwise appropriately cautious. |

## Prioritized problems and proposed fixes

### 1. P1 — Dashboard and current brief use different populations

The dashboard reads schema v2 and presents 3,288 opportunities and $25,010,892.81 pipeline. The documented canonical v3 population excludes 43 deleted opportunities and correctly yields 3,245 opportunities and $24,876,699.31 pipeline. Deleted records contribute $134,193.50 pipeline, three wins, and $10,000 won amount. Legacy won amount is $5,429,871.93 versus canonical $5,419,871.93. Legacy linkage reports 695 opportunities versus v3's 682; linkage differences also involve touch-classification/normalization choices, so deletion alone should not be assumed to explain them.

**Fix (Proposed):** Apply one explicit canonical population before integration and analysis, regenerate dependent artifacts, and reconcile dashboard, presentation, exports and documentation. Clearly label any retained historical archive. Changing only the displayed headline would leave the underlying tables inconsistent.

Evidence: `analytics_case_study/02_data_integration.py`, `03d_case_analysis.py:72–104`, `frontend/src/App.tsx:584`, and `metrics-check.txt`.

### 2. P1 — Presentation charts do not render their intended evidence

`PresentationApp.tsx` chooses only `chart_refs[0]`, takes the first six rows without scope filtering or ranking, and converts invalid/missing values to zero. Examples:

| Slide | Demonstrated problem | Supported repair |
|---|---|---|
| 4 Business motion | Displays channel amounts for `All` motions, not acquisition/renewal comparison | Aggregate and label explicit business motions |
| 5 Channel effectiveness | Claims referral leads acquisition, but shows six all-history/all-motion rows without referral | Filter acquisition and chosen period; rank by stated metric; show samples and amount coverage |
| 6 Channel trends | Shows first six quarters from 2018–2019, aggregated across channels | Select stated comparison periods and provide channel-level comparison |
| 7 Conversion drivers | Requests absent `stratum`/`contribution_pp`; displays six `Unknown 0` rows | Use `group`, separate mix/within/entry-exit components, retain signed percentage points |
| 8 Advertising content | Absent `bundle` labels become `Unknown`; 0.0555% rounds to 0.1%, 0.0269% to 0.0% | Compose labels from creative attributes and use suitable CTR precision |
| 9 Email and website | Website reference is ignored | Provide a separate website view with its denominator |
| 10 Source/touch overlap | Requests `group`, but data supplies `overlap_group` | Bind the actual exclusive-group field |
| 11 Attribution/journeys | Mixes model/window rows without those labels; journey reference ignored | Separate selected model/window and journey evidence |
| 12 Target audience | Requests `stage`, but exclusions use `exclusion`; priority reference ignored | Show explicit exclusions and eligible-priority comparison |
| 13 and 16 Actions | Text confidence statuses are coerced into zero-valued bars | Use qualitative decision cards/table |
| 15 Budget implications | Repeats sample-size scenarios without cost per treatment account or a planning budget | Show a transparent cost assumption/scenario, or explicitly state budget unavailable |

Repeated label keys also produced residual `Unknown` content during observed slide transitions. Use stable unique row keys after shaping each slide's data.

**Fix (Proposed):** Replace the generic field mapping with tested, slide-specific adapters. Invalid bindings should produce a visible unavailable state, never a fabricated zero. Keep narrative scope aligned with visual scope.

Evidence: `frontend/src/presentation/PresentationApp.tsx:13–43`, `presentation-bindings.json`, local browser observations.

### 3. P1 — The claimed finished deck lacks presentation styling and substantive appendix evidence

The stylesheet contains no rules for the browser deck's `presentation-shell`, `slide-canvas`, `slide-bars` or presenter-console classes. Desktop and narrow screenshots showed collapsed controls, unformatted slide content and absent bar graphics. All six appendix bodies repeat “Supporting methodology, definitions, and limitations for judge questions.” Their existence/count does not constitute a methods appendix; the current validator correctly rejects them.

**Fix (Proposed):** Implement the dedicated presentation layout and six evidence-backed appendix slides, with topic-specific definitions, populations, formulas, source references and useful presenter answers. Verify final rendered slides after regenerating the contract and build. Update documentation claims only after those checks pass.

Evidence: `frontend/src/styles.css`, shared presentation renderer, saved v3 slide payload, failing `06_validate_metrics.py`.

### 4. P1 — Saved model evidence is stale and its temporal validation is not an as-of backtest

Saved diagnostics contain 2,272 training + 569 test + 447 active records, totaling 3,288. Canonical population has 2,834 resolved + 411 active = 3,245. The current source excludes deleted records, but saved model outputs have not caught up.

Independently reconstructing the current split gives 2,267 training and 567 test records, with holdout creation beginning **10 April 2024**. **242 training records have current-stage-change timestamps after that cutoff.** The model uses final resolved outcomes that were unavailable at the beginning of the holdout. Latest-snapshot amount/channel/segment are also not demonstrated to be features captured at opportunity creation. This does not establish what a corrected AUC would be.

**Fix (Proposed):** Define scoring time and outcome horizon; train only on outcomes known before the cutoff using as-of features; evaluate mature future cohorts. Regenerate diagnostics and active scores against the canonical population. Until then, mark the saved 0.712 AUC and scores as exploratory retrospective evidence.

Evidence: `03c_advanced_analytics.py:103–132,163`, `model-check.txt`, `methods-evidence.md`.

### 5. P2 — Attribution compression removes eligible touches

Global domain/channel/week compression keeps the last weekly touch before checking whether it occurred before opportunity creation. A post-creation touch can displace a valid earlier touch in the same week. Applying the eligibility window first, then per-opportunity weekly compression, yields **684 linked opportunities and 127 linked wins**, rather than 682 and 126. Two omitted opportunities account for **$54,082 pipeline and $39,082 won amount**. Attribution weights and rankings require recalculation too.

**Fix (Proposed):** Retain raw valid touches until per-opportunity temporal filtering; then normalize the eligible grain. Establish the representative timestamp policy for first-touch and journey interpretation. Apply consistently to both attribution implementations.

Evidence: `03d_case_analysis.py:136–148`, `03b_attribution.py`, `raw-linkage-check.txt`.

### 6. P2 — Decomposition treats missing-period rates as zero

The webinar group has no resolved sample in 2022 H1 and two wins from two resolved opportunities in 2024 H1. Substituting zero for the absent rate assigns +0.1984 percentage points each to mix and within-group effects. That within-group change is not observed. The overall arithmetic can reconcile while this interpretation remains unsupported.

**Fix (Proposed):** Compute common-support components and show explicit group entry/exit effects; preserve unavailable rates as unavailable.

Evidence: `03d_case_analysis.py:287–288`, saved `conversion_decomposition` dataset.

### 7. P2 — Account mart repeats domain activity

Domain-level totals are merged onto account-ID rows. Shared domains repeat activity: summed campaign spend becomes $235,322.73 versus $208,854.31 in matching source domains, an excess of **$26,468.42**. Email clicks repeat 468 → 485; web pageviews repeat 341 → 352. This is a demonstrated mart aggregation risk; no claim is made that every displayed chart uses those summed fields. V3's domain-level audience avoids this duplication.

**Fix (Proposed):** Keep activity at domain grain, or adopt an explicit allocation/identity rule before summing across account IDs. Add conservation checks across joins.

Evidence: `02_data_integration.py:61,74,94`, `audience-check.txt`.

## What holds up

- Independent selection of the 16,421 raw opportunity history rows yields 3,288 whole-row snapshots with **zero selected-row or amount differences** against the cleaned file.
- Canonical figures reconcile: **3,245 opportunities; 2,834 resolved; 1,070 won; 37.7558% resolved win rate; $24,876,699.31 pipeline; $5,419,871.93 won amount**.
- All eight cleaned-source hashes match the v3 contract. This does not validate downstream model marts or rendering.
- The **2,032-domain** eligible audience reconciles with the exclusion output.
- The default 5% baseline/+2pp lift scenario reproduces **2,213 per arm, 4,426 total**; the current audience is insufficient. The assumptions are hypothetical, not observed 90-day rates.
- Attribution causal caveats, limited email denominators and creative confounding are appropriate. The small five-ad labeled subset supports controlled creative tests.
- Amount incompleteness materially limits revenue conclusions: **1,741/3,245 opportunities and 699/1,070 wins have zero amounts**. Retain recorded-value wording and coverage beside channel comparisons.

## Repair order and acceptance gates

First unify populations and regenerate marts; establish a valid model evaluation or remove operating confidence claims. Correct attribution/decomposition and join conservation. Then repair slide adapters, appendix content and presentation styling; rebuild only after the evidence is coherent.

Acceptance requires raw-to-canonical reconciliation, shared headline/count checks across outputs, training as-of eligibility, regression cases for same-week touches and absent-period groups, valid slide bindings/scopes, a passing release validator, and final desktop/narrow rendered inspection. Official brief/rubric comparison remains a separate required input for competition compliance.
