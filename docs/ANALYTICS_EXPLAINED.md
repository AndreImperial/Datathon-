# Analytics Explained

## The story in one minute

The current snapshot includes 3,245 canonical, non-deleted opportunities. Of those, 2,834 are resolved and 1,070 are won. Recorded amount across all deals is $24.88M, including closed-lost deals; open pipeline is $7.03M. Recorded won amount is $5.42M, but 699 wins have a zero amount and carry $3.45M of monthly recurring revenue (MRR) in a separate field.

Referral leads recorded new-logo won amount across 2018–2024. In 2023–24, marketing-sourced new-logo deals convert lowest (10.2% of resolved deals won, against 26.8% for referral) while supplying 382 of 1,192 new-logo opportunities. CRM source rankings do not tell us which channel caused more wins. Eligible marketing touches within a 365-day lookback link to 684 opportunities, including 127 wins; because email, web and 6sense logs cover only 2024, this is not full-history coverage. A controlled test can draw on 2,034 eligible ICP target domains, although the default 5% baseline / 2 percentage-point lift scenario needs 4,426 accounts. Creative labels are sparse: only five ads have complete format, message, and tone labels.

## What each analysis answers

| Analysis | Question | Safe interpretation |
|---|---|---|
| Channel scorecard | Where are recorded CRM opportunities, pipeline, and wins concentrated? | Descriptive source attribution; not incremental channel value. |
| Acquisition by source | Which lead-source groups win new logos, overall and in 2023–24? | Acquisition means no earlier won deal on the account; rates use resolved deals and are descriptive. |
| Closed-deal win rate | What share of resolved opportunities were won? | Active deals are excluded from the denominator; intervals show sampling uncertainty. |
| Sourced attribution | Which source did CRM record at opportunity creation? | Origin credit, not proof that marketing caused the outcome. |
| Influenced attribution | Which opportunities had eligible prior touches? | Journey context for 684 linked opportunities, not all history or causal credit. |
| Cohort analysis | How do outcomes vary across opportunity cohorts? | Compare resolved and mature cohorts; recent or low-resolution cohorts remain uncertain. |
| Account audience | Which eligible ICP domains can be considered for a controlled test? | The 2,034-domain pool is testable in principle; feasibility depends on the effect size and baseline. |
| Email event mix | What engagement events were recorded? | Event composition only; sent and delivered denominators are absent. |
| Creative analysis | How did ads perform within their platform? | Platform-specific observations; five ads have complete creative labels. |
| Experiment scenarios | What audience size is needed to detect different lifts? | Planning assumptions; the default 5% / 2pp scenario exceeds the available audience. |

## Findings that can be defended

### 1. Marketing-sourced deals convert lowest

A deal counts as acquisition when its account had no earlier won deal, which classifies every year, including 2023–24, where the CRM type field is blank. In 2023–24 new-logo deals, marketing-sourced opportunities win 10.2% of resolved deals (31 of 303), the lowest of the five ranked source groups, against 26.8% for referral (37 of 138). Marketing supplied 382 of 1,192 new-logo opportunities, so its volume is large but converts poorly. Fix qualification and handoff before adding volume.

### 2. Referral is the leading observed acquisition source

Referral has $1,472,853 in recorded new-logo won amount across 2018–2024, the largest of any source group. This result is descriptive: source assignment, account mix, seller activity, and measurement coverage can all affect the ranking. Review comparable time periods before changing spend.

### 3. Recorded won amount misses recurring value

The canonical population contains $24.88M in recorded amount across all deals, including closed-lost, and $5.42M in recorded won amount. 699 of the 1,070 wins have a zero amount; those wins carry $3.45M of monthly recurring revenue in a separate field, 94% of it on existing-customer deals. MRR is shown beside amount, never added. The reason: 112 wins have both a positive amount and a positive MRR, and in 104 of them (93%) the amount equals the MRR. None is about 3, 6 or 12 times the MRR, so amount is not a multi-month contract total and adding MRR to it would double count.

### 4. Attribution needs its population and time window beside it

There are 684 opportunities with eligible prior touches inside the 365-day lookback, including 127 wins: 57% of the 1,191 opportunities created in 2024, the only year the touch logs can link. About 79% of usable touches are 6sense ad impressions, which target accounts already showing buying intent, so linked credit overstates marketing influence. Email, web and 6sense logs observe 2024 only, while CRM history begins in 2018. Report linked journeys with that scope; do not treat the linked amount as full-population influence or causal lift.

### 5. The default small-lift audience test is underpowered at current scale

The eligible ICP audience has 2,034 domains. A two-arm test designed around a 5% baseline and a 2 percentage-point absolute lift needs 4,426 accounts total under the stated 80% power, two-sided 5% significance, and equal-allocation assumptions. The current audience is not large enough for that scenario. The workable alternative is to use the whole audience: 1,017 domains per arm, split 50/50. Over 90 days that test can reliably detect a lift of about 3.1 percentage points from a 5% baseline (2.1 points from a 2% baseline, 4.0 points from a 10% baseline). Its budget is 1,017 treatment accounts times the cost per account, plus fixed cost; no cost per account was supplied.

### 6. Creative and email results are hypotheses, not benchmarks

Only five ads have complete format, message, and tone labels, and those dimensions are bundled together. Test matched variants that hold audience and timing steady. Email records describe engagement events but do not contain sent or delivered denominators, so standard campaign open and click rates are unavailable.

### 7. The win-probability model was withdrawn

A calendar-only win-probability baseline reached AUC 0.516 on 430 held-out cases and predicted no wins. Because it ranked deals no better than chance, it is no longer built or shown, and no deal scores are published.

## Recommended operating sequence

1. Fix marketing-sourced qualification and handoff before buying more volume, and protect referral.
2. Require contract value at Closed Won and align source, spend, and outcome reporting windows.
3. Keep recorded sourced outcomes and touch-linked journey measures separate, with the coverage and time window visible.
4. Choose a feasible experiment design based on the audience actually available and a pre-registered outcome such as new opportunity creation within 90 days.
5. Randomize eligible domains within segment and fit groups; analyze the result as an incremental comparison.
5. Run matched creative variants that isolate one dimension at a time, and scale only after an experiment supports the decision.
