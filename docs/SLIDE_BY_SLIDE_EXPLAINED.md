# Browser deck talk track

The presentation lives at `/#present/main-01` on the dashboard (16 main slides in 18 minutes, then six appendix slides). Open the presenter console from the **Presenter** button: it shows the current and next headline, speaker notes, a transition line into the next slide, and a pace timer, and it stays in sync with the audience tab.

**The big idea** (slide 1 opens on it, slide 16 closes on it): *Fix conversion before buying volume. Prove reach before scaling spend.*

Headlines are computed from the data contract (`frontend/public/dashboard-data-v3.json`), so the numbers below are the current snapshot's. If the data changes, the slides change with it.

## Context

### main-01 — The case question (45 s)
**Fix conversion before buying volume. Prove reach before scaling spend.**
Three gap tiles: marketing-sourced conversion (10.2% vs 26.8% for Referral), recorded value (699 of 1,070 wins carry no amount) and measurement (68% of opportunities have neither a marketing source nor a linked touch).

### main-02 — Marketing strategy (60 s)
**Three moves: fix marketing conversion, prove reach with a 90-day test, record contract value.**
A roadmap of the three moves, whether each is act-now or test-first, and its owner.

### main-03 — Evidence scope (60 s)
**CRM covers 2018–2024 but marketing activity only 2024: we see outcomes, not causal lift.**
Coverage timeline of every source; ad metrics run January 2023 to October 2024, email, web and 6sense logs cover 2024 only.

## Tension

### main-04 — Business motion (60 s)
**Existing customers produce 71.6% of wins and 94% of the MRR missing from recorded amounts.**
A deal is acquisition when its account had no earlier win. Two 100% bars: share of wins, and share of MRR on zero-amount wins.

### main-05 — Channel effectiveness (90 s)
**On new logos, Referral is the benchmark: $1.5M won, 1.8× the next source.**
New-logo won amount by lead-source group, 2018–2024.

### main-06 — Recent conversion by source (60 s)
**Marketing-sourced deals convert at 10.2%, under half Referral's 26.8% and lowest of 5 sources.**
2023–24 resolved win rate by source with 95% intervals; marketing-sourced is the accent.

### main-07 — Conversion drivers (90 s)
**Overall win rate fell 15.3 pp since 2022 H1; Existing client accounts for 13.0 pp, mostly mix shift.**
Diverging bars of each group's contribution; mix and within-group effects are descriptive, not causal.

### main-08 — Advertising content (90 s)
**The best creative bundle drew 2.1× the CTR, but 5 labeled ads can only seed a test.**
Only five ads carry complete format, message and tone labels, and those attributes are confounded.

### main-09 — Email and website engagement (75 s)
**Web and email show interest, not acquisition: only 4.0% of site recordings reach Contact.**
Email has no sent or delivered counts, so send-based rates cannot be calculated.

### main-10 — Source and touch overlap (60 s)
**68% of opportunities have neither a marketing source nor a linked touch.**
A 2×2 of marketing-sourced versus linked to a touch; the four groups cover every opportunity.

### main-11 — Attribution and journeys (75 s)
**Attribution can't settle credit: 6sense display or Email leads, depending on model and window.**
A grid of the leading channel for every model and lookback window. About 79% of usable touches are 6sense ad impressions aimed at in-market accounts.

## Resolution

### main-12 — Target audience (60 s)
**2,034 ICP domains are eligible for a controlled test, after excluding 2,742.**
A step-down from all assessed domains to the eligible audience, and the strongest segment/fit cells.

### main-13 — Channel and content actions (75 s)
**Every gap maps to one action: 4 to act on now, 2 to test first.**
Each gap with its evidence and the action that answers it.

### main-14 — Controlled experiment (75 s)
**Only 1 of 9 test designs fits 2,034 domains: it must detect +3 pp from a 2% baseline.**
Required accounts for each baseline and lift (two-sided α .05, 80% power); the default 5% / +2 pp design needs 4,426.

### main-15 — Budget implications (45 s)
**The test budget needs one missing input: cost per account for 588 treatment accounts.**
Planning formula: treatment accounts × cost per account + fixed cost. No dollar figure is shown until the unit cost is supplied.

## Ask

### main-16 — CMO decisions (60 s)
**Decide today: fix marketing conversion, run the 90-day coverage test, record contract value.**
Each decision with its owner, first measure and review point, then the big idea.

## On-demand appendix

- `appendix-01` — Population and source coverage.
- `appendix-02` — Metric definitions and unavailable denominators.
- `appendix-03` — Attribution models, windows and shared-domain sensitivity.
- `appendix-04` — Conversion decomposition and loss reasons.
- `appendix-05` — Targeting eligibility and sample uncertainty.
- `appendix-06` — Recorded value: amount and MRR, open pipeline versus the all-deal total, and why the win-probability model was withdrawn.
