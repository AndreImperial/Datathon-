# Marketing Analytics Plain-English Guide

## What This Project Is About

This is a B2B account-based marketing (ABM) analytics project. Instead of judging marketing by one last-click or lead-source field, the analysis combines CRM opportunities, account coverage, 6sense activity, email engagement, web activity, creative performance, and attribution models.

The main decision is: which target accounts should marketing and sales activate next, and how should the team prove that the activation creates better pipeline?

## Data Sources

| Dataset | What it contains | Size |
|---|---:|---:|
| Opportunities | Sales deals, amount, stage, win/loss, lead source, dates | 3,288 deals |
| Accounts | Company attributes, industry, segment, profile fit | 5,264 companies |
| 6sense Campaign Accounts | Account-level display reach and engagement | 63,096 rows |
| Ad Metrics | Creative-level impressions, clicks, CTR, spend | 4,626 rows |
| Email Engagements | Opens, clicks, registrations, campaign details | 17,130 rows |
| Web Engagements | Website sessions, sources, pages, goal completions | 36,931 rows |
| ICP Database | Contacts, job titles, seniority, account domains | 36,860 contacts |
| 6sense Segments | Account buying-stage and intent segmentation | 7,934 rows |

Most datasets are connected through company domain. Opportunity and account data also connect through Salesforce account IDs.

## Key Numbers

| Metric | Value | Meaning |
|---|---:|---|
| Total pipeline | $25.0M | Total opportunity value in the dataset |
| Won revenue | $5.4M | Opportunity value from closed-won deals |
| Total opportunities | 3,288 | Deduplicated CRM opportunities |
| Overall win rate | 32.6% | Share of opportunities that closed won |
| Marketing-sourced pipeline | $4.2M | Pipeline where CRM lead source is a marketing channel |
| Marketing-influenced pipeline | $6.5M | Pipeline where a tracked marketing touch appeared before opportunity creation |
| Target accounts | 4,797 | Account domains used in the coverage analysis |
| Unreached target accounts | 3,256, or 67.9% | Target accounts with no tracked email or 6sense touch |
| Email-only opportunity rate | 45.9% | Share of email-reached accounts with at least one opportunity |
| Both-channel opportunity rate | 42.6% | Share of accounts reached by both email and 6sense with at least one opportunity |
| Not-reached opportunity rate | 17.5% | Share of unreached accounts with at least one opportunity |
| Cohort win-rate movement | 37% in 2022Q1 to 15% in 2024Q4 | Pipeline volume is rising while recent win rate is lower |
| Win model AUC | 0.796 | Time-based holdout model for prioritizing open deals |

## Ultimate Marketing Conclusion

The strongest conclusion is not "spend more everywhere." The best conclusion is targeted ABM growth with quality control:

1. Expand coverage to unreached strong-fit target accounts.
2. Start with email because it has the strongest observed reach signal in this dataset.
3. Test 6sense display as an overlay after email engagement, using a holdout group before scaling.
4. Report marketing-sourced and marketing-influenced pipeline side by side.
5. Protect pipeline quality because pipeline is growing while recent cohort win rate is weaker.

## Why ABM Is The Right Frame

ABM focuses marketing and sales effort on a defined list of target accounts. In this dashboard, ABM shows up through:

- target account coverage,
- email engagement,
- 6sense display reach,
- account profile fit,
- opportunity creation,
- win probability scoring,
- and pipeline quality over time.

The ABM question is not just "which channel got credit?" It is "which accounts should we activate next, and can we prove incremental lift?"

## Attribution Interpretation

Attribution should be treated as a planning signal, not proof of causality.

| Model | What it answers | How to use it |
|---|---|---|
| Marketing sourced | What did CRM explicitly label as marketing-originated? | Conservative executive reporting |
| Marketing influenced | Where did marketing touch accounts before opportunity creation? | Broader journey contribution |
| First-touch | Which channel appeared first in the tracked journey? | Awareness and account-opening signal |
| Last-touch | Which channel appeared closest to opportunity creation? | Late-stage engagement signal |
| Linear | How would credit look if touchpoints shared credit equally? | Balanced contribution view |
| Time-decay | Which recent touchpoints get more weight? | Late-journey planning signal |

Marketing-sourced pipeline is $4.2M. Marketing-influenced pipeline is $6.5M. Both are valid, but they answer different questions.

## What To Do Next

| Priority | Action | Why | Measurement |
|---|---|---|---|
| P1 | Build a coverage plan for unreached strong-fit accounts | 67.9% of target accounts are unreached | Coverage rate, opportunity rate, pipeline created |
| P1 | Tighten ICP and qualification review | Recent win rate is weaker while pipeline grows | Win rate, stage conversion, disqualification reasons |
| P2 | Test 6sense overlay after email engagement | Email often opens the journey and 6sense appears later | Holdout lift in meetings, opportunities, pipeline, win rate |
| P2 | Report sourced and influenced pipeline together | Source credit understates broader journey contribution | Sourced pipeline, influenced pipeline, influenced won revenue |
| P3 | Use top creative patterns as test briefs | CTR indicates message engagement, not guaranteed revenue | CTR, CPC, form fills, account engagement, downstream lift |

## Important Caveats

- Attribution does not prove a channel caused a deal.
- Spend ROI only covers channels with reliable tracked spend.
- Email-only opportunity rate is slightly higher than both-channel opportunity rate, so 6sense overlay should be tested rather than assumed.
- Relationship-led channels and existing-client motion are major contributors, so paid media should not be judged as the whole growth engine.
- Web sessions are only useful for account-level journey analysis when a company domain can be matched.
- Low-volume segments and channels should be treated as investigation signals, not final budget mandates.

## How To Present This In A Datathon

Start with the business tension:

"Marketing directly sourced $4.2M of pipeline and influenced $6.5M, but 67.9% of target accounts are still unreached. The best move is not blanket budget expansion. It is to activate strong-fit unreached accounts, lead with email, test 6sense overlay with a holdout, and protect win rate as pipeline grows."

Then explain why the recommendation is credible:

- Coverage analysis sizes the growth opportunity.
- Attribution shows marketing contribution is broader than CRM source credit.
- Cohort analysis warns that more pipeline is not automatically better pipeline.
- The win model adds a prioritization layer for sales follow-up.
- Caveats are explicit, especially around causality and tracked-spend ROI.
