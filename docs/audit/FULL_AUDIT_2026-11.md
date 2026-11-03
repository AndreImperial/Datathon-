# Full audit — v1.3.2

2026-11-03 · commit `f170729` · live on Render and GitHub Pages · **Report only: nothing in the app, data or docs was changed by this audit.**

> **Update, v1.4.0:** findings 1–6 are fixed (linked wins read against 2024; marketing split by lead source on the dashboard, deck slide 6 and the answer band; "lowest" claimed only where intervals separate and "strongest" scoped to 2018–24; deck arrow keys after a click; the win-rate fall framed as mix; Back to the first section). Findings 7–16 and the lower-priority list remain open.

Scope: analytics correctness (headline figures recomputed from the Parquet marts), the story against the case question, the live site (speed, layout, accessibility), the browser deck, frontend and server code, and documentation and repository hygiene. Every finding below was checked against code or data; unverified points are marked.

## Verdict

The build is solid: every headline number recomputes exactly, tests and validator pass (65 frontend, 44 Python), axe-core reports 0 violations, there is no layout shift, and print opens every fold. The weak spots are **how three figures are framed**, **one answer the data gives but the story never says**, and **a few deck and routing bugs that would show during a live presentation**.

## What to fix first

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 1 | High | Analytics | **"11.9% of wins link to a tracked touch" mixes populations.** All 684 linked opportunities were created in 2024 (touch logs cover 2024 only). 127 of 223 wins in 2024 are linked: **57%**. 11.9% divides by 1,070 wins from 2018–2024. The figure is in the new answer band (v1.3.2), the Essential KPI "Linked wins", the attribution section title and `context.metrics.attribution_linked_won_share` (`03b_attribution.py:421`, `04_html_dashboard.py:113`). README and the v3 finding already say 57% correctly. | Use 127 / 223 (2024) everywhere, or label 11.9% "of all-history wins; logs cover 2024 only". |
| 2 | High | Story | **The data says which marketing channels work, but the story pools them.** 2023–24 marketing-sourced new logos by lead source: Website Inbound 14 / 67 (**20.9%**, near Referral's 26.8%); 6sense 0 / 82; MQA 0 / 35; Channel Referral: 6sense 9 / 74 (12.2%). The pooled 10.2% hides a channel that works and two that have never won. All-history 6sense display: 0 wins from 85 resolved deals on $1.19M tracked spend. | Split marketing-sourced by lead source on slide 6, the Channel section and the answer band. This is the most direct answer to "which channels". Check first whether the 0-win sources are a CRM relabelling artifact (not verified). |
| 3 | High | Analytics | **"Lowest" and "strongest" are stated without uncertainty, and "strongest" depends on the period.** Marketing 10.2% (95% CI 7.3–14.2%) vs Sales proactive 12.4% (9.2–16.5%) is not a significant difference (z ≈ 0.84); vs Referral it is (z = 4.47). Referral leads won amount across 2018–24, but in 2023–24 Sales proactive leads ($602K vs $464K). | Say "significantly below Referral, similar to Sales proactive"; scope "strongest new-logo source" to 2018–24. |
| 4 | Medium | Deck | **Arrow keys stop working after clicking Next or Previous.** The key handler ignores events whose target is inside any `button` or `a`, and clicking a button focuses it (`PresentationApp.tsx:230`). A presenter who clicks once then uses the clicker or arrows is stuck. | Skip only text inputs, `[contenteditable]` and `[data-evidence-scroll]`; on buttons and links skip only Space and Enter. |
| 5 | Medium | Story | **The win-rate fall is presented as falling quality, but the deck says it is mostly mix.** Slide 7: overall win rate fell 15.3 pp since 2022 H1, 13.0 pp of it from Existing client, "mostly mix shift". The dashboard's story step 2 still carries "Mature-cohort win rate 30.1% → 20.5%" as its detail (for screen readers and print) under the line "Marketing-sourced deals convert worst", and the Essential takeaway says "tighten qualification first". | Make step 2's detail the marketing-vs-Referral figure, and word the takeaway around the handoff, as the deck does. |
| 6 | Medium | Code | **Back button does not return to the first section.** `syncRoute` ignores an empty or unknown hash (`App.tsx:1207`). Load `/`, open Attribution, press Back: the URL changes but Attribution stays. | Map empty or unknown hash to `s-essential`. Add a routing test. |
| 7 | Medium | Analytics | **"Top 3 sources hold 83.3% of pipeline" counts a catch-all.** The largest "source" is `other` (59.3%), which mixes sales-proactive, inbound, PE referrals and renewals. Used in the answer band, the Executive title and story step 1. | Split `other` before ranking, or drop the concentration claim and lead with Referral's won amount. |
| 8 | Medium | Analytics | **"Referral" means two things.** v3 `source_group` includes PE-channel, employee and partner referrals (73 of 181 in 2023–24 are "Referral: From PE Channel"); v1 `channel_category = referral` is client referrals only. "Channel Referral: 6sense" counts as marketing-sourced. | One mapping in `config.py`, documented in the methodology. |
| 9 | Medium | Analytics | **Influenced vs sourced compares different years.** Influenced pipeline ($6.36M) is 2024 only; sourced ($4.16M) is 2018–24 (`04_html_dashboard.py:316`). | Restrict both to 2024 or drop the ratio. |
| 10 | Medium | Analytics | **The pilot's detectable lift is large, and that is not said.** The power math is correct (α .05 two-sided, 80% power: 2,212 per arm; 1,017 per arm detects +3.07 pp at 5%). But +3.1 pp on 5% is a 62% relative lift. The eligible domains' observed quarterly opportunity rate in 2024 was 4.4%, 4.8% and 2.5% (Q1–Q3). | Show the relative lift beside the absolute, and use the observed baseline. |
| 11 | Medium | Analytics | **The older contract keeps a "High confidence" recommendation on reverse-causal evidence.** "Expand coverage to unreached CRM account domains" rests on reached domains having more opportunities, but those opportunities predate the reach. `target_accounts: 4,776` is all CRM domains, not the 2,034 eligible ICP domains. | Downgrade to hypothesis, or retire these v1 metrics in favour of v3. |
| 12 | Medium | Code | **A malformed v3 file blanks the deck.** The validator only checks `schema_version === 3` (`dataContract.ts:61`); a missing `presentation` throws during render and React unmounts to a white page. A missing `target_duration_seconds` shows `NaN:NaN`. | Validate the fields the deck reads; add a top-level error boundary. |
| 13 | Medium | Hosting | **Render cold start.** The free plan sleeps (`render.yaml: plan: free`). In this audit the first request returned **503**, and the app took **11.7 s** to become usable. Warm loads take about 0.7 s to first paint, about 300 KB transferred. | Give judges the GitHub Pages link first, or move Render off the free plan. |
| 14 | Medium | Docs | **README's first screen does not state the question.** The answer starts at line 19, after population counts. | Add Question / Answer lines above the links. |
| 15 | Medium | Docs | **Stale statements.** `SLIDE_BY_SLIDE_EXPLAINED.md:74` main-15 says one missing input; the deck says two (cost per account and fixed cost). `AUDIT_BACKLOG.md:19` treats the withdrawn model as active. `RUBRIC_ALIGNMENT.md:30, 59` use an old storyline; `:87` calls $24.9M "pipeline" (it is recorded amount; open pipeline is $7.0M); `:69` says the live address is unverified. `PRODUCT.md:38` and four other places describe a PPTX that is not in the repository. | Edit each line to match the current deck and data. |
| 16 | Medium | Docs | **`docs/reference/*.pdf` describe the retired process** (Random Forest, a 21-slide PPTX, `05_presentation.py`) and one holds a personal path (`C:\Users\andre\…\python.exe`). | Move to an archive folder marked superseded, or remove. |

## Lower priority

- **Answer gaps in the case question.** Content formats rest on 5 fully labelled ads (0.9% of impressions); `_ctacopy` (85 ads, 36% of impressions: "READ THE BLOG", "VIEW INFOGRAPHIC") and `_size` could stand in for format and are unused. Engagement (email, web) is never connected to acquisition or revenue. LinkedIn's $34.5K spend has no linkable touches.
- **Data quality.** Tracked 6sense spend differs between `ad_metrics` ($1,186,810) and `6sense_campaign` ($290,679), unexplained. 61 opportunities close before they were created. CRM history starts July 2018, so older customers can be classed as acquisition. Mojibake (`â€”`) in some `ad_name` values. "Amount is monthly" rests on 112 wins (30% of positive-amount wins).
- **Deck sync.** The presenter can ignore the audience after the audience's revision resets to 0 (`PresentationApp.tsx:178`).
- **CSV export.** No UTF-8 BOM, so ×, – and € garble in Excel on Windows (`evidence.ts`).
- **Bundle.** The deck (`PresentationApp`, `slides.tsx`) ships in the dashboard's entry chunk; lazy-load it on `#present`. GSAP `Flip` and `ScrollTrigger` load eagerly for two small uses.
- **Server and CI.** Docker runs as root and installs the full analytics stack to serve static files; Node 20 is end of life (Dockerfile and CI). Actions are pinned by tag, not SHA, in a job with Pages deploy rights. `app.py`'s `static_files` route is unreachable; no CSP or `frame-ancestors`; `/health` re-parses ~670 KB per probe; `/.vite/manifest.json` is public.
- **Dead code.** Unused imports `chartPlacementIds`, `tableIds` (`App.tsx:16`), `useLayoutEffect` (`stage/kit/phone.tsx:1`); a validator message says "24-placement" for 22 ids.
- **Repository.** Generated output is committed in duplicate (the 5.2 MB Plotly HTML twice, each JSON contract three times). Remote branches `codex/finalize-analytics-dashboard` and `codex/revenue-command-center` are fully merged. `RELEASE_CHECKLIST.md` has no v1.3.1 section header (folded into O5).
- **Layout.** The Tracked-Spend ROI chart card is 710 px tall for two rows, leaving a large empty band. The hero mockup bleeding off the right edge on phones is the intended corner-bleed crop, not a bug.

## Test gaps that matter

No test covers hash routing (finding 6), deck keyboard use after a button click (finding 4), presenter/audience sync over a real channel, a structurally broken schema-3 payload (finding 12), or the print path's restore after `afterprint`.

## Checked and correct

- **Population and amounts:** 3,245 opportunities, 2,834 resolved, 1,070 won (37.8%); recorded amount $24,876,699.31, open $7,026,136.93, won $5,419,871.93; 699 zero-amount wins carrying $3,447,433.79 MRR (94% existing customers).
- **Conversion:** 2023–24 new-logo marketing 31 / 303 (10.2%) vs Referral 37 / 138 (26.8%); 382 of 1,192 new-logo opportunities from marketing.
- **Linkage:** 684 linked opportunities, 127 linked wins, 57.4% of the 1,191 created in 2024, 78.7% of touches from 6sense.
- **Test design:** 2,034 eligible domains, 4,426 required at 5% / +2 pp, 1,017 per arm.
- **Cohort decline:** 38% → 22% (2022 Q1 → 2024 Q2), non-overlapping CIs.
- **Deck:** 16 main + 6 appendix slides; the 16 headlines read as a coherent story on their own.
- **Live site:** no horizontal scroll at 360–1440 px in any of the 10 sections; 0 console errors on a warm load; charts lazy-load about 0.4 s after a section opens.
- **Code:** GSAP and ScrollTrigger cleanup, BroadcastChannel teardown, CSV formula-injection guard, NaN-safe formatters and Flask path-traversal handling are all correct.
- **Repository:** no secrets, `.env` files, `node_modules` or personal paths in tracked text files; every relative markdown link resolves.
