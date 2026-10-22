# Consolidated repair verification

2026-10-03. User-approved implementation in the existing local checkout. Snapshot **386ea2031409f547**, analytical method **v3.2**. No commit, push, deployment, access change or repository-history cleanup performed.

## Outcome and closure

All 59 master items were addressed: **49 closed locally**, **5 implemented with remaining acceptance/policy dependencies**, **5 blocked on external input/source authority**. Every item now has an explicit closure note in [MASTER_FIX_BACKLOG.md](MASTER_FIX_BACKLOG.md). This is not a claim that all 59 acceptance conditions are satisfied.

Implemented analytical coverage, null costs and matched observation windows, distinct web grains/contact activity, same-day duration eligibility/disclosures, tie-preserving calibration/intervals, explicit weekly-presence attribution, conservative identity normalization, public aggregate diagnostics, strict readiness and schema checks, release gates, typed sorting, units, chart labels/data alternatives, presenter synchronization/routes/timer, keyboard/modal fixes, responsive controls, print rules, traceable exports, provenance/copy/docs, intentional shared branding/fonts and restrained reduced-motion behavior.

## Fresh verification

- Complete source cleaning→integration→core analysis→attribution→advanced analysis→v3 contract→legacy archive→React production build→semantic validation passed: [FIX_PIPELINE_FINAL.log](FIX_PIPELINE_FINAL.log). Earlier attempts exposed timezone-aware Excel export incompatibility and a transient Windows write-handle error; ISO timestamp export corrected, full rerun passed.
- Final Python suite: **41 tests passed**, including canonical/as-of/tie-credit prior repairs, new motion/cost/web/identity/calibration/duration fixtures, unavailable-model behavior, schema drift, malformed/empty/private contracts and missing lazy assets. [FIX_TESTS_FINAL.log](FIX_TESTS_FINAL.log).
- Final frontend suite: **16 tests passed**. Typed units/sorting/missing states/formula escaping/CSV provenance; atomic sequence navigation/event-time timers/route and storage validation; DOM native Space/PageDown, modal Escape/inertness, hash synchronization and attribution lookback. [FIX_FRONTEND_TESTS.log](FIX_FRONTEND_TESTS.log).
- Final production build and TypeScript compilation passed after integration edits: [FIX_BUILD_FINAL.log](FIX_BUILD_FINAL.log). Vite warns about a large chart-library chunk; chunk size alone is not a runtime failure.
- Final semantic contract validation passed:16 main+6 appendix slides,22 v3 datasets and snapshot386ea2031409f547. [FIX_VALIDATION_FINAL.log](FIX_VALIDATION_FINAL.log).
- Fresh Flask test-client readiness:HTTP200, all required contracts/archive/favicon/index/imported assets ready. Public JSON recursively rejects identifying opportunity/account/contact fields; scores are10 histogram rows, not411 identifiable active records.
- `git diff --check` passed; line-ending conversion notices only. [FIX_DIFF_CHECK.log](FIX_DIFF_CHECK.log).
- Offline CSV produced by the same serializer used by the UI:12 channel rows, exact snapshot/units/source, numeric visible order, explicit period inputs. Parsed and reconciled independently: [FIX_EXPORT_SAMPLE.csv](FIX_EXPORT_SAMPLE.csv). The in-app browser's native download-event inspection timed out, so native save/readback is not claimed verified.

## Browser evidence

Codex in-app browser, localhost8050, default desktop and320×760. Rebuilt dashboard and findings deck inspected. Ascending pipeline values confirmed15,409→30,000→39,232…→14,753,748.66; measured0.0× remains visible and unmeasured channels remain unavailable. Dates/status/numerator visible in efficiency evidence.

Space on Previous moved main4→3; PageDown in a focused evidence region retained the current slide; overview Escape from its focused Close button dismissed it. Late-open console matched audience main3; double-click Next advanced main3→5 on both. Appendix switch and console keyboard ArrowRight synchronized appendix1→2. Paused timer22seconds survived audience refresh. Overview background inertness and invalid route canonicalization are also DOM regressions.

At320px, both dashboard and deck:document clientWidth305=scrollWidth305. Deck header controls at least44×44. Closed mobile navigation absent from accessibility traversal. Quality indicators have names and measured values; missing dates are a count instead of a fake0% bar. Rendered5 chart wrappers confirmed after lazy load. Desktop source/population footer visible. Sampled colors/fonts inspected; no blanket WCAG or screen-reader certification claim.

## Explicit open dependencies

- **F16:** constraints captured and actual local environment/version metadata verified; clean Python install/reproduction not executed.
- **F18:** source inventory/sheets/columns gated; production expected dates/cadence require source-owner policy.
- **F40:** print code retains source/snapshot/caveats, readable SVG ink and paginated tables; actual browser PDF cannot be produced/inspected with the exposed browser capabilities.
- **F41:** real screen reader, text zoom, comprehensive contrast and device/visual-regression coverage remain unverified.
- **F54:** tracked-HEAD public JSON567,224bytes→274,685bytes (aggregate score rows447→10); this is a transfer/content measurement, not device runtime profiling. No speculative library rewrite.
- **F55–F59:** currency/rubric authority, publication/privacy rights/live revision, amount corrections, email delivery denominators and private analyst access policy remain missing. Recorded facts are preserved; source quantities/rights were not invented.

CI/Pages and multi-stage Render/Docker gates are implemented but have not run remotely or in Docker. Public-artifact checks do not sanitize private Git history or establish publication rights. Historical PPTX remains explicitly archived and its old generators are disabled.

`npm audit` additionally reports a high-severity development-tooling advisory in the Tailwind3→glob/braces chain, with npm suggesting a breaking Tailwind4 migration. No compatible patched braces version was reported by the audit. This is recorded in [FIX_NPM_AUDIT.json](FIX_NPM_AUDIT.json); no forced incompatible migration or security-clean claim. The static public runtime does not expose the development glob toolchain.

## Supporting receipts

[Analytical fixes](FIX_ANALYTICS_RECEIPT.md), [frontend fixes](FIX_FRONTEND_RECEIPT.md), [release fixes](FIX_RELEASE_RECEIPT.md), [execution rulings](FIX_EXECUTION.md). Independent reviewer findings were addressed:period fields lost in export, field-unit errors, empty readiness contracts and focused-modal Escape. Prior audit documents remain historical evidence snapshots.
