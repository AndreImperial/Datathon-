# Analytics Explained

## The story in one minute

The company has $25.0M of recorded pipeline and $5.4M of recorded won revenue across 3,288 deduplicated opportunities. The responsible growth recommendation is targeted and experimental:

- Quality weakened across mature cohorts: closed-deal win rate moved from 38% in 2022 Q1 to 22% in 2024 Q2.
- Coverage is incomplete: 3,256 of 4,797 target account domains are unreached by tracked email or 6sense activity.
- Marketing source credit is conservative, while influence attribution covers only a linked subset.
- Paid-outcome evidence is too sparse for a credible budget optimizer.

## What each analysis answers

| Analysis | Question | Safe interpretation |
|---|---|---|
| Channel pipeline | Where is recorded pipeline and won revenue concentrated? | Descriptive CRM contribution; amount completeness affects dollar metrics. |
| Closed-deal win rate | Which channels or segments convert resolved outcomes? | Use the resolved sample and interval, not the raw deal count alone. |
| Sourced attribution | Where did CRM assign origin credit? | Conservative contribution view. |
| Influenced attribution | Which linked opportunities had eligible prior touches? | Journey context for 695 linked opportunities, not every opportunity. |
| Cohort analysis | Is pipeline growth protecting outcome quality? | Compare mature cohorts only; recent cohorts remain provisional. |
| Account coverage | Where is the largest testable target audience? | 67.9% unreached is an experiment opportunity, not proof of lift. |
| Email event mix | What engagement events were recorded? | Event composition only; delivered-message counts are absent. |
| Creative analysis | Which ads earn attention within a platform? | CTR is comparable within platform and volume threshold, not automatically across platforms. |
| Win model | Which active opportunities rank higher using opportunity-time features? | A 0.712-AUC baseline for prioritization, not an automated decision. |
| Budget plans | How much spend could be reserved for causal learning? | Budget-neutral test design; no projected pipeline. |

## Findings that can be defended

### 1. Pipeline quantity and quality are diverging

The 2024 Q2 cohort recorded $3.5M of pipeline, but its closed-deal win rate was 22% once 88% of the cohort had resolved. In 2022 Q1 the comparable closed-deal rate was 38%. The right response is not to stop growth; it is to audit ICP fit, qualification, and source mix before expanding broad acquisition.

### 2. Coverage is the clearest test opportunity

Target account coverage is uneven:

| Tier | Accounts | Observed opportunity rate |
|---|---:|---:|
| Not Reached | 3,256 | 17.5% |
| Email Only | 732 | 45.9% |
| Both Channels | 526 | 42.6% |
| 6sense Only | 283 | 28.6% |

The higher reached-account rates are associations. Stronger accounts may have been selected for marketing, or sales may already have been active. Randomize strong-fit unreached accounts to estimate incremental lift.

### 3. Attribution must be reported with coverage

Marketing sourced pipeline is $4.2M. Touch-linked influenced pipeline is $6.3M, but only 21.1% of all opportunities and 11.7% of won opportunities link to eligible pre-opportunity touches. The influenced number is useful for understanding linked journeys, while sourced credit is the more conservative executive contribution measure.

### 4. Email cannot be judged with standard campaign rates

The file contains 17,130 engagement-event rows for 5,557 unique engaged email addresses. Opens, clicks, and registrations describe the mix of those rows. Without sent and delivered denominators, campaign reach and standard rate claims are not available.

### 5. The predictive model is now honest enough to pilot

The model excludes present-day stage, intent, account snapshots, and contact counts. A time-based holdout produces ROC AUC 0.712, precision 61.0%, recall 44.4%, and Brier score 0.182. It scores all 447 active opportunities. Use score bands in a sales pilot and measure actual conversion before setting a threshold.

### 6. Spend should buy evidence

The current data cannot identify an optimal channel mix. A measurement-first plan preserves the same tracked budget while activating 80%, reserving 10% as a holdout, and assigning 10% to a pre-registered experiment pool. Scale only after incremental qualified pipeline is demonstrated and closed-deal quality holds.

## Recommended operating sequence

1. Repair CRM amount completeness, spend reconciliation, email denominators, and attribution ownership.
2. Randomize strong-fit unreached accounts into treatment and holdout groups.
3. Test email-first outreach and a 6sense overlay with pre-registered outcomes.
4. Report sourced credit, linked influence, and attribution coverage together.
5. Scale only when incremental pipeline and closed-deal quality meet the decision gate.
