# Analytics Explained

## The story in one minute

The current snapshot includes 3,245 canonical, non-deleted opportunities. Of those, 2,834 are resolved and 1,070 are won. CRM-recorded pipeline is $24.88M and recorded won amount is $5.42M; incomplete recorded amounts limit revenue comparisons.

The evidence points to careful measurement. Referral leads the acquisition scorecard by recorded won amount, but CRM source rankings do not tell us which channel caused more wins. Eligible marketing touches within a 365-day lookback link to 684 opportunities, including 127 wins; because marketing logs cover a shorter 2024 window than CRM history, this is not full-history coverage. A controlled test can draw on 2,032 eligible ICP target domains, although the default 5% baseline / 2 percentage-point lift scenario needs 4,426 accounts. Creative labels are sparse: only five ads have complete format, message, and tone labels.

## What each analysis answers

| Analysis | Question | Safe interpretation |
|---|---|---|
| Channel scorecard | Where are recorded CRM opportunities, pipeline, and wins concentrated? | Descriptive source attribution; not incremental channel value. |
| Closed-deal win rate | What share of resolved opportunities were won? | Active deals are excluded from the denominator; intervals show sampling uncertainty. |
| Sourced attribution | Which source did CRM record at opportunity creation? | Origin credit, not proof that marketing caused the outcome. |
| Influenced attribution | Which opportunities had eligible prior touches? | Journey context for 684 linked opportunities, not all history or causal credit. |
| Cohort analysis | How do outcomes vary across opportunity cohorts? | Compare resolved and mature cohorts; recent or low-resolution cohorts remain uncertain. |
| Account audience | Which eligible ICP domains can be considered for a controlled test? | The 2,032-domain pool is testable in principle; feasibility depends on the effect size and baseline. |
| Email event mix | What engagement events were recorded? | Event composition only; sent and delivered denominators are absent. |
| Creative analysis | How did ads perform within their platform? | Platform-specific observations; five ads have complete creative labels. |
| Model diagnostic | What can the supplied historical timing actually support? | An exploratory calendar-only baseline with near-chance discrimination; no sales prioritization claim. |
| Experiment scenarios | What audience size is needed to detect different lifts? | Planning assumptions; the default 5% / 2pp scenario exceeds the available audience. |

## Findings that can be defended

### 1. Read CRM dollars as recorded amounts

The canonical population contains $24.88M in recorded pipeline and $5.42M in recorded won amount. These totals reflect what is entered in CRM. Missing and zero values make dollar metrics incomplete, so use them as recorded amounts rather than complete revenue totals.

### 2. Referral is the leading observed acquisition source

Referral has $922,608 in recorded won amount in the available CRM history, the largest amount on the current acquisition scorecard. This result is descriptive: source assignment, account mix, seller activity, and measurement coverage can all affect the ranking. Review comparable time periods before changing spend.

### 3. Attribution needs its population and time window beside it

There are 684 opportunities with eligible prior touches inside the 365-day lookback, including 127 wins. The supplied marketing logs mostly observe 2024, while CRM history begins earlier. Report linked journeys with that scope; do not treat the linked amount as full-population influence or causal lift.

### 4. The default small-lift audience test is underpowered at current scale

The eligible ICP audience has 2,032 domains. A two-arm test designed around a 5% baseline and a 2 percentage-point absolute lift needs 4,426 accounts total under the stated 80% power, two-sided 5% significance, and equal-allocation assumptions. The current audience is not large enough for that scenario. The team can consider a larger detectable effect, a broader eligible audience, or an exploratory pilot with its limits stated up front.

### 5. Creative and email results are hypotheses, not benchmarks

Only five ads have complete format, message, and tone labels, and those dimensions are bundled together. Test matched variants that hold audience and timing steady. Email records describe engagement events but do not contain sent or delivered denominators, so standard campaign open and click rates are unavailable.

### 6. The restricted model is a diagnostic

The repaired model uses creation calendar only because latest amount, channel and segment cannot be verified as creation-time inputs. Training outcomes must be recorded before the evaluation cutoff, and test cases need complete 180-day horizons. Its AUC is 0.516 and Brier score 0.217 on 430 eligible test cases. This near-chance result does not support sales prioritization. The 411 active scores are exploratory diagnostics conditional on recorded resolution, not individual close probabilities.

## Recommended operating sequence

1. Improve CRM amount completeness and align source, spend, and outcome reporting windows.
2. Keep recorded sourced outcomes and touch-linked journey measures separate, with the coverage and time window visible.
3. Choose a feasible experiment design based on the audience actually available and a pre-registered outcome such as new opportunity creation within 90 days.
4. Randomize eligible domains within segment and fit groups; analyze the result as an incremental comparison.
5. Run matched creative variants that isolate one dimension at a time, and scale only after an experiment supports the decision.
