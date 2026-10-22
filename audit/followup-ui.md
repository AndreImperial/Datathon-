# Frontend follow-up audit — 2026-10-03

Read-only source review of `frontend/src/App.tsx`, `types.ts`, `main.tsx`, `styles.css`, `presentation/PresentationApp.tsx`, all three component files, frontend HTML/favicon, package/Tailwind configuration, generated v2/v3 contracts, generated CSS, DESIGN.md and archived design-system references. Lead owns browser checks; this review did not navigate or manipulate browsers. No implementation changes.

## Priorities

### P1 — Presenter starts with stale/default slide and lacks handshake

`frontend/src/presentation/PresentationApp.tsx:145,165-167`: presenter initializes from the `#presenter/session` hash, which cannot identify the audience slide, and therefore selects main-01. Audience broadcasts only when state changes; the console never reads the stored `deck-audience-state` or requests current state. Opening presenter after advancing the deck leaves the wrong speaker notes until the audience changes again. Add snapshot/session-qualified state handshake on connection, restore validated shared state, and expose disconnected/synchronized status. Also handle missing BroadcastChannel explicitly instead of leaving functional-looking controls.

### P1 — Presenter keyboard does not control audience; Space breaks buttons

`PresentationApp.tsx:171`: global keydown applies to both windows and calls local `navigate`; presenter button clicks broadcast commands but presenter keyboard changes only console state. The handler excludes inputs/selects but not buttons/anchors, so pressing Space on Overview/Start/Previous prevents normal activation and advances a slide. Exclude interactive targets; send presenter navigation through the same command path as buttons. Add integration checks for late-opening console, Space activation, and audience/console parity.

### P1 — Print drops provenance and loses chart contrast

`frontend/src/styles.css:445-461,480` and `components/Charts.tsx:29-49`: print turns dashboard surfaces white but chart label/mark colors remain literal near-white `#F7F4F4`/`#F2EEEE` SVG props. Several labels and comparison marks have insufficient contrast on paper. Global `footer {display:none!important}` also hides the deck's source footer and snapshot even though its later print rules preserve the slide. Scope footer suppression to dashboard chrome; use print-aware chart tokens and retain source/snapshot/caveats. Verify an actual print/PDF render, not just CSS existence.

### P1 — Scrollable deck tables are inaccessible to keyboard inspection

`PresentationApp.tsx:55-57,171`; `styles.css:475`: evidence wrapper is scrollable with a 42vh cap but no keyboard focus target or region label. Plain table cells cannot receive focus, while global PageDown/arrow handlers navigate slides. Make the evidence region focusable and named, preserve native scrolling keys there, add caption and scoped column headers, and expose a concise table summary before the detail rows.

### P1 — Missing values become invented zero measurements

`frontend/src/types.ts:121-124`: `Number(null)` and `Number("")` return zero, and nonnumeric/missing values use default zero. Chart functions use this shared helper for rates, amounts, histogram scores and confidence intervals. A missing probability becomes a 0–10% score; a missing rate becomes 0%. Current generated contracts mostly supply values, but this violates the project missingness policy when optional data are absent. Preserve null, explicitly filter unavailable measurements, and distinguish a valid numeric zero in tables/charts.

### P1 — Legitimately unavailable chart blocks entire dashboard

`frontend/src/App.tsx:342-343`: payload validation rejects any empty chart placement. An exploratory model with insufficient training data can correctly emit no scores/features, yet that state crashes all unrelated dashboard sections. Keep schema checks, accept intentional limited/unavailable datasets with a reason, and render per-panel unavailable states.

### P2 — Monthly trend second series has missing color utilities

`components/Charts.tsx:96-102`; `tailwind.config.js` teal token: Tremor receives `teal`, whose generated class convention is `fill-teal-500`/`stroke-teal-500`. Tailwind teal is a scalar string and the compiled `public/assets/index-BhBuCZQ5.css` lacks both classes; equivalent blue classes exist. Use a shade scale or the configured emerald family consistently. Confirm actual second-series stroke/fill and legend in browser.

### P2 — Data alternatives truncate columns and omit units

`frontend/src/App.tsx:353-362`: chart DataTable slices all source keys to the first nine and renders raw `String(value)`, without field metadata or rate/currency formatting. Important denominator, interval or scope columns can disappear depending on field order; percentages render as decimal fractions and dollar amounts as unlabeled raw numbers. Build table columns from chart contract fields plus relevant scope/denominator/CI fields, use explicit unit-aware formatting, and retain all rows/fields in downloadable evidence. Lead browser check confirms raw fractional share and unformatted amount presentation.

### P2 — Year comparison omits available confidence intervals

`PresentationApp.tsx:109`: main-06 displays rates, won/resolved counts and recorded amount but omits available `win_rate_ci_low`/`win_rate_ci_high`. This encourages reading sparse channels as ranked winners. Use a paired year chart with Wilson intervals and sample labels, and an expandable full table. main-05 also has a useful amount-coverage caveat but no rate-quality comparison beside the amount ranking.

### P2 — Segment rate tooltip loses percentage unit

`components/Charts.tsx:268`: formatter compares `name === "rate"`, while the line's explicit name is `"Win rate"`. Recharts passes that name, so tooltip falls through to an unlabeled raw percentage-point number. Match the explicit display name or format the single rate series consistently.

### P2 — Overview is modal only by keyboard convention

`PresentationApp.tsx:177`: focus trapping exists, but the underlying slide/header/controls remain in the accessibility tree and can still be traversed by assistive technology despite `aria-modal`. Apply inert/aria-hidden to background content while overview is open, with restoration, using the already-implemented dashboard drawer pattern.

### P2 — URL and slide state can diverge

`PresentationApp.tsx:145,167`; `App.tsx:787-792`: slide ID is parsed only during state initialization and then written using replaceState; changing `#present/main-XX` while the same presentation component remains mounted does not sync local slide state. Add validated hash synchronization and decide intentionally whether slide changes belong in browser history. This is separate from normal slide button navigation, which currently updates the URL.

### P2 — Design authority and implementation disagree

`DESIGN.md` requires black majority, crimson/graphite semantics and Manrope-only typography; `styles.css:464-482` hard-codes an ivory/green deck with Newsreader/Georgia headings and a NORTHSTAR wordmark rather than Revenue Command. This can be an intentional presentation surface, but no surface brief documents that exception. Record surface-specific tokens, purpose, palette roles and brand relationship before any redesign. Detector confirms many undocumented deck colors/type steps; these are consistency advisories, not proof that either palette is inherently poor.

### P3 — Declared serif font is not loaded; true mojibake in console

`main.tsx:3`; `styles.css:472,477`; `PresentationApp.tsx:175`: Newsreader is installed but no Newsreader font stylesheet is imported, so the advertised deck face falls back to Georgia. Use `Newsreader Variable` with its actual self-hosted import if intended, or document Georgia. `NOW Â·` is real UTF-8 source text (U+00C2 U+00B7), not a PowerShell decoding artifact; remove the extra U+00C2.

### P3 — Secondary navigation/empty states need refinement

`App.tsx:763`: mobile overflow uses menu/menuitem roles but implements only Escape and outside click, without menu arrow-key/first-item focus behavior. Either use ordinary disclosure buttons without menu roles or implement the menu pattern. Presenter uses a permanent green signal without actual connection status; empty deck bar/table states give no unavailable reason from dataset_status. These should be addressed with the interaction pass.

## Positive evidence and limits

- Dashboard mobile drawer/caveats implement labels, inert background, focus trap/return, Escape and scroll lock.
- Dashboard chart summaries, visible caveats, captions, downloads, sortable header states, and loading/error screens exist.
- Recharts animations are explicitly disabled; Tremor active charts disable animation; dashboard GSAP and Motion navigation respect reduced-motion checks. Global CSS also collapses durations. More animation is lower priority than correctness and accessible inspection.
- Responsive breakpoints stack charts/cards and move mobile utilities into an overflow menu; deck bars stack at narrow width. Actual 320px, text zoom, long-string and print behavior belong to lead browser/render verification; source review alone cannot certify them.
- Scope/population labels, N/A decomposition values, creative bundle labels, excluded-domain counts and hypothetical-budget warnings are materially better than the original audited artifacts.
- No recommendation to add random colors: preserve the chosen surface identity, establish semantic/channel mappings, and pair color with labels/markers/patterns.

## Audit method / detector

Used Impeccable technical audit instructions; ran context once and bundled detector once over App, PresentationApp, Charts and styles. Detector exit 1 reported advisory design colors/type/radius drift plus accent-border warnings. Verified the deck/document token mismatch; did not count each literal or stylistic border as a separate defect. No screenshot-based aesthetic rating or WCAG compliance claim is made.

Suggested repair order: presenter/keyboard synchronization → missingness and unavailable states → evidence tables and interval chart → print/export → semantic tokens and surface brief → typography/mobile polish → only then purposeful motion.
