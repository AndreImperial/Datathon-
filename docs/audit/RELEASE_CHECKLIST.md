# Release checklist — Revenue Command Center

Every item is a concrete check with a stated method. Status is **PASS**, **PASS (fixed)** (failed on first run, fixed and re-checked), **FAIL**, or **NOT VERIFIED** (with why).

- Verified: 2026-10-23, first against commit `4f14d8d`, then the failures were fixed and re-checked on the cleanup commit that follows it.
- Snapshot: `9c524ee116f41b8a`.
- Surfaces: Python pipeline and data contracts, React dashboard (`/`), browser deck (`/#present/...`), legacy Plotly archive (`/full-analysis/`), live Render site, GitHub CI and Pages, the Claude Dashboard artifact, and the documentation.
- Method: data checks were recomputed independently from `data/raw/` with separate pandas code. UI checks were run in headless Chromium at 1440, 960 and 375 px, plus the in-app browser.

**Result: 86 checks — 86 pass (20 of them after fixes), 0 fail.**

## A. Data correctness (recomputed independently from the raw Excel files)

| ID | Check | Status | Evidence |
|---|---|---|---|
| A1 | Canonical population is 3,245 non-deleted opportunities | PASS | 16,421 rows, 3,288 IDs, latest row by `_order`, 43 deleted → 3,245 |
| A2 | 2,834 resolved and 1,070 won | PASS | Closed Won + Closed Lost + Discontinued = 2,834; won 1,070; `iswon` agrees on every row |
| A3 | Recorded total $24,876,699.31; won $5,419,871.93; open $7,026,136.93 | PASS | Exact to the cent |
| A4 | 699 zero-amount wins carry $3,447,433.79 MRR | PASS | Exact; 94.20% of it on existing-customer deals |
| A5 | Existing-customer share of wins 71.6% | PASS | 766 / 1,070 = 71.59% |
| A6 | 2023–24 new-logo win rate: marketing 10.2%, referral 26.8%, marketing lowest of 5 | PASS | 31/303 and 37/138; Sales proactive 12.4%, Other 17.5%, Inbound 21.2% |
| A7 | Referral leads all-history new-logo won amount | PASS | $1,472,853.16, next Sales proactive $820,538 |
| A8 | 684 linked opportunities (127 won); 1,191 created in 2024; ~79% of touches are 6sense | PASS | Independent join gives 681–685 linked and 126 won, depending on the create-date boundary and domain cleaning; 1,191 and 78.69% exact |
| A9 | 2,034 eligible domains; the default 5%→7% test needs 4,426 | PASS | Power calculation gives 2,213 per arm, 4,426 total; 2,034 is consistent across the audience, summary and scenario tables |
| A10 | Only 5 ads have complete creative labels (~1% of spend) | PASS | 5 of 189 ads; 0.95% of all ad spend (0.98% within 6sense) |
| A11 | Win rate 2022 H1 37.9% → 2024 H1 22.6% | PASS | 69/182 → 114/504, by creation date |
| A12 | Ad metrics Jan 2023–Oct 2024; email, web and 6sense 2024 only | PASS | Ads 2023-01-31 to 2024-10-07; all logs inside 2024 |

## B. Pipeline, contracts and tests

| ID | Check | Status | Evidence |
|---|---|---|---|
| B1 | `python run_pipeline.py` completes from raw files | PASS | Exit 0 in a fresh clone (after `npm ci`, as the README orders) and again after the reorganisation to `data/raw/` |
| B2 | Contract validator passes | PASS | `PASS v3 contract · snapshot 9c524ee116f41b8a · 16 main + 6 appendix · 21 datasets` |
| B3 | Python tests pass | PASS | 38 tests OK |
| B4 | Frontend tests pass | PASS | 29 / 29 |
| B5 | Typecheck clean | PASS | `tsc -b` exit 0 |
| B6 | Production build succeeds | PASS | Only Vite's large-chunk notice |
| B7 | `npm audit` 0 vulnerabilities | PASS | 0 vulnerabilities |
| B8 | Two pipeline runs give identical results | PASS | Contract identical apart from timestamps; all 18 integrated parquets byte-identical including row order; workbook cells identical |
| B9 | Withdrawn model absent from every published artifact | PASS (fixed) | No model datasets anywhere. The archive's withdrawal note quoted "AUC about 0.52"; reworded to "near-chance holdout that predicted no wins" |
| B10 | No private fields in public JSON | PASS | `assert_public_fields` passes on all 7 public JSON files; no emails, Salesforce IDs or domains |
| B11 | Text figures match the contract | PASS (fixed) | All docs and UI figures match. Fixed: a test fixture still used 2,032; slide 14's caveat hard-coded 4,426 (now read from the scenario table); chart captions in `App.tsx` quoted totals as text and are now computed from the data, which also corrected the Won Revenue caption (Referral, not Existing Client, is second). A test now fails if a caption contains a literal amount, count or quarter |
| B12 | Committed outputs are current | PASS | After a rerun the only differences are generated timestamps, workbook metadata and line endings; data and parquets are unchanged. Timestamps make every run differ by design |

## C. React dashboard (`/`)

| ID | Check | Status | Evidence |
|---|---|---|---|
| C1 | No console errors | PASS | 0 errors across all 10 sections at 1440, 960 and 375 |
| C2 | All 10 sections reachable | PASS | Every nav link renders its section and marks itself active |
| C3 | No page-level horizontal scroll | PASS | `scrollWidth == clientWidth` at all three widths |
| C4 | First screen states the big idea and four findings correctly | PASS (fixed) | 10.2%, 26.8%, $3.4M/mo and "model withdrawn" all match the data. The Referral card's all-history 27.4% sat next to the 2023–24 26.8% unlabelled; it now reads "27.4% win rate, 2018–2024" |
| C5 | Section titles read Big idea → Context → Tension → Resolution → Evidence → Ask | PASS (fixed) | Titles and stages are correct. The sidebar listed Conclusion above the Appendix, against the numbering and the `[`/`]` keys; the sidebar now follows the section order |
| C6 | Big idea identical in hero and conclusion | PASS | Same constant in both places |
| C7 | Every chart renders | PASS | 22 of 22 cards (19 SVG, 3 HTML) |
| C8 | Tooltips appear and stay inside their card | PASS | Hover sweep of 19 charts; 0 tooltips outside their card |
| C9 | "Show data" toggles a table | PASS | All 22 charts toggle; `aria-pressed` and `aria-controls` are correct |
| C10 | CSV export keeps precision and provenance | PASS (fixed) | Real downloads keep full precision and snapshot provenance. Each row's `source` overwrote the file-level source in the full export; the file-level key is now `generated_from` |
| C11 | Keyboard focus ring and `[`/`]` navigation | PASS | Visible 2px outline plus ring on every control; brackets step through all 10 sections and are ignored while typing |
| C12 | Reduced motion disables animation; nothing stays invisible | PASS | 0 elements below full opacity; transitions 0ms; chart animation off |
| C13 | Text contrast meets WCAG AA | PASS (fixed) | 687 text styles measured; one heatmap count at 85% opacity measured 4.40:1. The opacity was removed, so the text now renders at full contrast |
| C14 | Collapsible tables open and close; print opens them | PASS | All `<details>` toggle; the Print button opens 12 of 12 |
| C15 | Loading skeleton and error screen | PASS | Skeleton while loading; a forced 500 shows a plain-language error with Try again and an archive link |
| C16 | Links work | PASS | Findings deck, deck deep links, archive, back-to-top and pager all work |
| C17 | Mobile: drawer, 44px tap targets, contained tables | PASS (fixed) | Drawer, focus trap and table scrolling worked. The menu button shrank to 40px and small buttons and sort headers were 16–34px; now 44×44 and at least 44px on screens up to 900px, re-measured at 375 |

## D. Browser deck (`/#present/...`)

| ID | Check | Status | Evidence |
|---|---|---|---|
| D1 | All 22 slides load with no console errors | PASS | 0 errors on every route |
| D2 | Main slides fit 1440×900 and 1280×720 | PASS | Page height equals the viewport on all 16 at both sizes |
| D3 | Slide 1 opens and slide 16 closes on the exact big idea | PASS (fixed) | Exact on both. Slide 1 also repeated it in its body text; removed, so it now appears once |
| D4 | Headlines distinct, data-derived and in story order | PASS | 16 distinct headlines; Context 1–3 → Tension 4–11 → Resolution 12–15 → Ask 16 |
| D5 | Headline numbers match the contract | PASS | Every number recomputed from the contract; 0 mismatches |
| D6 | Keyboard behaviour | PASS | Arrows, Space, PageUp/PageDown, Home, End and Escape behave as designed; PageDown inside evidence scrolls, not the slide |
| D7 | Overview traps focus and returns it | PASS | Dialog is modal, the background is inert, and Escape returns focus to the Overview button |
| D8 | Evidence drawer | PASS | Full tables (12–107 rows); Escape closes it and returns focus |
| D9 | Presenter console syncs with the audience view | PASS | Two tabs: navigation, timer start/pause and end-of-deck state stay in sync both ways |
| D10 | Unknown routes fall back | PASS | `#present/nope` → main-01 in a fresh tab |
| D11 | Reduced motion disables transitions | PASS | 0 running animations |
| D12 | Mobile 375 fallback | PASS | 6 slides with no horizontal overflow |
| D13 | Exit returns to the dashboard | PASS | Exit and the wordmark go to `#s-essential` |

## E. Legacy archive and secondary pages

| ID | Check | Status | Evidence |
|---|---|---|---|
| E1 | `/full-analysis/` loads cleanly | PASS (fixed) | 22 of 22 Plotly charts render. The only console error was a missing favicon; the archive now links `../favicon.svg` |
| E2 | Archive shows no withdrawn model | PASS (fixed) | No model output; the stale "Win probability…" appendix card and the "win probability" takeaway wording were replaced |
| E3 | Favicon, meta description, dark first paint | PASS | Favicon served as SVG; description states the big idea; dark paint with all CSS/JS blocked |

## F. Release, deployment and repository

| ID | Check | Status | Evidence |
|---|---|---|---|
| F1 | GitHub `main` == branch == local HEAD | PASS | All three at the same commit (re-checked after the cleanup push) |
| F2 | Latest CI run on `main` succeeded | PASS | Validate and deploy jobs green (re-checked after the cleanup push) |
| F3 | Render serves the current build | PASS | Live asset hash equals local `public/index.html` |
| F4 | Render `/health` all true | PASS | `{"ok": true}` with every check true |
| F5 | GitHub Pages serves the current build | PASS | https://andreimperial.github.io/Datathon-/ returns 200 with the same asset hash |
| F6 | Live deck deep link loads | PASS | `/#present/main-01` shows the big idea, no console errors |
| F7 | Clean Python 3.11 install | PASS | Fresh venv: install succeeds, `pip check` clean, imports work |
| F8 | No secrets or stray files committed | PASS | No keys, `.env` or credentials; the 89 MB `audit/python-deps` and `.claude/` are ignored and not tracked |
| F9 | Agent worktrees do not affect the repo | PASS | 11 merged agent worktrees and branches removed; `.claude/` ignored |

## G. Documentation

| ID | Check | Status | Evidence |
|---|---|---|---|
| G1 | README matches the contract and the big idea | PASS (fixed) | Numbers matched; the README now opens with the exact big idea and the new repository layout |
| G2 | README instructions work as written | PASS | Clean install (F7) and the pipeline from a fresh clone (B1) follow the README order |
| G3 | No stale claims | PASS (fixed) | Removed "no workflow has been run remotely", Tremor and Tailwind 3 mentions, the stripe/dot pattern rule, and PowerPoint references; dated audit reports are marked as historical snapshots |
| G4 | Slide talk track matches the deck | PASS (fixed) | Rewritten from the current 16 headlines |
| G5 | Methodology, explainer and rubric numbers match | PASS | 2,034, 684, 10.2%, 26.8%, $3.4M and 71.6% match |
| G6 | All doc links resolve | PASS (fixed) | One absolute Windows path and the audit reports' links to deleted logs were fixed; every relative link now resolves; external URLs return 200 (localhost links are local-run instructions) |

## H. Claude Dashboard artifact

| ID | Check | Status | Evidence |
|---|---|---|---|
| H1 | Six datasets attached and matching the contract | PASS | Headline, source groups, overlap and scenarios compared field by field: 0 mismatches |
| H2 | Page headline uses the shared big idea | PASS | Exact sentence in the published page |
| H3 | No hard-coded figures in markup or script | PASS | Only years, section numbers and fixed method constants (95% interval, 80% power, 80% resolved) appear as literals |
| H4 | The dashboard's own check reports no failures | PASS | Opened in the owner's browser on 2026-10-24: the page reported 0 failed sources and no failures |

## I. Accessibility, print and performance follow-up

| ID | Check | Status | Evidence |
|---|---|---|---|
| I1 | Automated WCAG 2.1 AA audit of the dashboard (axe-core 4.11.4) | PASS (fixed) | 46 violation nodes before (progress rail roles, heatmap table roles, hover contrast, sidebar role, scrollable heatmap). 0 after, on all 10 sections at 1440 and 375, with the drawer, a data table and collapsible sections open (25 views) |
| I2 | Automated WCAG 2.1 AA audit of the deck | PASS (fixed) | Skip-link target, snapshot-label contrast (3.39:1) and accessible names fixed. 0 violations on all 22 slides, the overview, the evidence drawer, the presenter console and 375 width (30 views); a separate contrast script also finds 0 |
| I3 | All-sections print to PDF | PASS (fixed) | Was 6 pages of one section on a black background. Now 33 pages covering all 10 sections, on white, with dark chart text, tables within the page and exact heatmap colours. Page 18 holds only a reading note after a full-page heatmap (cosmetic) |
| I4 | Chart tooltips anywhere over a chart | PASS (fixed) | 30/30 hover points on the three charts that showed 16–18/30 |
| I5 | No oversized chunk on the first-paint path | PASS (fixed) | Build has no chunk over 500 kB. First-paint JavaScript fell from 305 kB to 191 kB (gzip); charts load lazily. The typecheck no longer writes a stale `vite.config.js` that Vite could load instead of the source |

## J. Actionability and delivery

| ID | Check | Status | Evidence |
|---|---|---|---|
| J1 | A runnable test exists for the eligible audience | PASS | `pilot_design`: all 2,034 domains 50/50 (1,017 per arm), 90 days, detects +2.1 / +3.1 / +4.0 pp at 2 / 5 / 10% baselines. Solved with the same formula as the scenario grid; the validator checks the arm size reproduces at that lift, and the dashboard computed identical values independently |
| J2 | The meaning of recorded amount is evidenced | PASS | `mrr_amount_relationship`: on 112 wins with both values, amount equals MRR on 104 (92.9%, all exact). Amount is a monthly value; nothing is annualised or added |
| J3 | A 10-minute executive cut of the deck | PASS | 8 slides, 600 s, toggle in header, overview and presenter console, synced both ways; every slide in both cuts fits 1440×900 and 1280×720; headlines computed from the real contract |
| J4 | The pilot budget can be sized without inventing costs | PASS | Budget calculator (empty by default): 1,017 × cost per account + fixed cost, accessible inputs with validation, aria-live result; unit-tested |
| J5 | Browser-menu printing (Ctrl+P) prints everything | PASS (fixed) | `beforeprint` renders all 10 sections and opens 12 of 12 tables; all 19 charts are drawn synchronously (was 0) thanks to a print-safe initial chart size; 34-page PDF with the pilot and calculator |

Accessibility re-run on the final build: dashboard 25 views + pilot/calculator states, deck 120 views (both cuts, overview, drawers, presenter): 0 axe-core violations.

## Not verified anywhere

- A real screen-reader session (automated axe-core audits pass, but no assistive-technology user test was possible here).
