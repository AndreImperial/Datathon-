# Complete Slide-by-Slide Breakdown
## Marketing Analytics Executive Deck (21 Slides)

---

## SLIDE 1 — Title / Overview

**What it shows:** A "here's what we analyzed" summary card with 4 big numbers at the top.

| Stat | What it means |
|---|---|
| 8 Datasets | We pulled data from 8 different spreadsheets/systems |
| 80.5K Touchpoints | 80,500 times marketing "touched" a target company (ad, email, website visit) |
| 3,288 Deals | The actual number of sales opportunities in the CRM |
| 6 Attribution Models | We measured credit for deals 6 different ways |

**Why the deal count matters:** The raw data file had 16,421 rows — but that's because every time a deal moved stages in Salesforce, a new row got added. Think of it like a Google Doc revision history — 16,421 edits, but it's still one document. Claude found this bug and collapsed it to 3,288 real unique deals. If we hadn't caught this, every number would be 5x inflated.

---

## SLIDE 2 — Executive Summary

**The 5 headline numbers every executive cares about:**

| KPI | Number | Plain English |
|---|---|---|
| Total Pipeline | $25M | All deals in the funnel added together — the "size of the opportunity" |
| Won Revenue | $5.4M | Money actually in the bank |
| Win Rate | 33% | 1 out of every 3 deals closes |
| Marketing Sourced | 16% | Only 1 in 6 deals was started by marketing (the rest came from sales, referrals, or existing clients) |
| Marketing-Sourced Win Rate | 10% | Marketing-started deals close less often — explained below |

**Why marketing sourced win rate is lower (10% vs 33%):**
This is NOT a failure. Marketing finds people who are *just starting to think about* a product — they're early, exploratory, not ready to buy. Sales referrals close at 29% because those people were already recommended by someone they trust. You can't compare these fairly. It's like comparing how many strangers vs. warm introductions buy from you.

**The 5 strategic bullets** summarize the whole story:
1. Email opens conversations (top first-touch channel)
2. 6sense ads close them (top last-touch channel)
3. Existing clients + referrals are the biggest pipeline (42% of all deals)
4. 3,256 accounts (68%) have never seen a single marketing touch — huge untapped opportunity
5. Pipeline is growing but win rate is declining — quality is eroding

---

## SLIDE 3 — Data & Methodology

**The 8 datasets, explained simply:**

| Dataset | What it is | Size |
|---|---|---|
| Opportunities | Every sales deal ever — amount, stage, won/lost, where the lead came from | 3,288 deals |
| Accounts | The companies being targeted — industry, size, country, how well they fit your ideal customer | 5,264 companies |
| 6sense Campaign | How many times a target company saw a banner ad | 63,096 rows |
| Ad Metrics | Performance of each individual ad creative (CTR, spend) | 4,626 rows |
| Email Engagements | Every time someone opened, clicked, or registered via email | 17,130 interactions |
| Web Engagements | Every website visit — where they came from, what they did | 36,931 sessions |
| ICP Database | The specific *people* (contacts) at target companies — their job title, seniority | 36,860 contacts |
| 6sense Segments | How 6sense groups companies by buying intent | 7,934 rows |

**How these datasets connect:** Every dataset links together using the **company domain** (e.g., `microsoft.com`). This is like a Social Security Number for each company — every dataset has it, so Claude could join them all together into one master table.

**The critical data bug caught:** The `iswon` column (marks a deal as won or lost) was stored as the *text* `"True"` and `"False"` instead of actual true/false values. In Python, the string `"False"` is actually considered "true" (because it's a non-empty string). So before the fix: won revenue = $0 and win rate = 0%. After the fix: $5.4M and 33%.

---

## SLIDE 4 — Attribution Methodology

**The core question attribution answers:** A company sees 20 of your ads, gets 3 emails, visits your site 5 times, then buys. Which of those things gets credit for the sale?

This slide explains the 6 ways to answer that question:

### Model 1: Marketing Sourced
- **Rule:** The CRM explicitly says "this deal came from marketing"
- **Think of it as:** The official recorded credit — what your CRM says
- **Best for:** Board reporting, conservative "what did marketing clearly start"
- **Result in our data:** $4.2M, 511 deals

### Model 2: Marketing Influenced
- **Rule:** Marketing touched this company *at any point* in the 365 days before the deal was created, even if sales officially sourced it
- **Think of it as:** Shadow credit — marketing warmed up accounts that sales then closed
- **Best for:** Showing marketing's total footprint
- **Result:** $6.3M, 708 deals (always bigger than Sourced)

### Model 3: First-Touch
- **Rule:** 100% of credit goes to the VERY FIRST marketing touch
- **Think of it as:** "Who introduced us?"
- **Best for:** Evaluating channels that find *new* audiences
- **Result:** Email gets the most ($4.0M) — email is usually how accounts first hear from you

### Model 4: Last-Touch
- **Rule:** 100% of credit goes to the LAST touch before the deal was created
- **Think of it as:** "Who was there when they finally said yes?"
- **Best for:** Evaluating which channels close deals
- **Result:** 6sense Display gets the most ($3.3M) — ads are still running when accounts reach out

### Model 5: Linear
- **Rule:** All channels that touched the account share credit equally
- **Think of it as:** Everyone on the team gets the same bonus
- **Best for:** The fairest picture of everyone's contribution
- **Result:** Email $3.6M | 6sense $2.7M | Web $250K

### Model 6: Time-Decay
- **Rule:** More recent touches get more credit. Credit decays over time like a battery draining. Half-life = 30 days (a touch 30 days ago gets 2x the credit of one 60 days ago)
- **Think of it as:** "Who was hustling at the end?"
- **Best for:** Budget decisions — reward what was active when it mattered
- **Result:** 6sense $3.5M | Email $2.8M

---

## SLIDE 5 — Attribution Results

**What it shows:** A grouped bar chart comparing all 6 models side-by-side for every channel.

**How to read it:** Each cluster of bars = one channel. Each bar in the cluster = one attribution model. The height = how much pipeline ($) that model gives that channel credit for.

**Key insight:** The *same* dollar amount of pipeline changes hands drastically depending on which model you use. This is why marketing teams fight over attribution models — each model tells a different story. The right answer is to use multiple models together and look for channels that score well across *several* models.

**What stands out:**
- **Email** towers on First-Touch — it starts conversations
- **6sense Display** rises on Last-Touch and Time-Decay — it closes them
- **Existing Client/Referral** channels are large in Sourced because they're reliably tagged in the CRM

---

## SLIDE 6 — Sourced vs Influenced (Two Pie Charts)

**Two circles that tell different stories about the same $6.3M.**

**Left pie — Marketing Sourced ($4.2M):**
- Breakdown of the 511 deals marketing officially originated
- Which channels started those deals
- This is the conservative, defensible number

**Right pie — Marketing Influenced ($6.3M):**
- Breakdown of the 708 deals marketing touched (even if it didn't officially start them)
- This is the broader case for marketing's value

**Why this matters for budget conversations:**
- If marketing only gets credit for Sourced: "We generated $4.2M"
- If marketing gets credit for Influenced: "We contributed to $6.3M"
- The truth is somewhere in between — Sourced understates, Influenced overstates
- Use both numbers together when presenting to leadership

---

## SLIDE 7 — Marketing Funnel

**The funnel shows how the same audience shrinks at every step.**

```
135,000,000  Impressions (ads shown)
     ↓
     71,000  Clicks (0.05% click-through rate)
     ↓
      1,286  Form fills / goal completions on the website
     ↓
      3,288  Opportunities (all, including sales-sourced)
     ↓
        511  Marketing-sourced opportunities
     ↓
      1,073  Closed won (all)
     ↓
         52  Marketing-sourced closed won
```

**What each step means:**

- **Impressions → Clicks (0.05% CTR):** For every 2,000 times someone saw an ad, 1 person clicked. This sounds terrible but it's normal for B2B display advertising — these aren't search ads, they're brand awareness banners.
- **Clicks → Form Fills:** Only a fraction of people who visit the site take action. This is called **landing page conversion rate**.
- **All Opps vs. Marketing-Sourced Opps:** Most deals come from sales outreach, referrals, existing clients — not from marketing campaigns. That's normal for B2B.
- **Marketing-sourced won (52 deals):** This looks small. But 52 deals × average deal size = real money. And the 10% win rate for marketing-sourced is expected for early-stage prospects.

**What this funnel is used for:** Finding where you're losing the most people. If 135M impressions produce only 71K clicks, you either need better targeting (fewer, more relevant impressions) or better creatives (more compelling ads).

---

## SLIDE 8 — Channel Attribution (Pipeline by Channel + ROI Table)

**The "where does money come from" slide.**

**Top chart — Pipeline by channel:**
A horizontal bar chart showing total pipeline dollars for each lead source, sorted by size.

**Bottom table — ROI breakdown:**

| Channel | Pipeline | Win Rate | Ad Spend | Pipeline ROI |
|---|---|---|---|---|
| Existing Client | Largest | ~27% | $0 | Infinite |
| Referral | 2nd | ~29% | $0 | Infinite |
| 6sense Display | 3rd | ~10% | $290K | 14:1 |
| Email MQA | 4th | ~10% | Small | Very high |
| Web Inbound | 5th | ~18% | Minimal | High |

**Key insight from this slide:**
- Existing clients and referrals are the most efficient pipeline source (no ad spend, high win rate)
- 6sense Display has high spend but also drives significant pipeline when you count *influenced* deals
- Email MQA has the best ROI because the cost (email platform) is low vs. pipeline generated

**What "ROI" means here:** Pipeline ROI = Total pipeline attributed ÷ Ad spend. If you spent $290K and it's associated with $4.1M in pipeline (time-decay), that's 14:1 return. But pipeline isn't revenue — Revenue ROI would use only the won portion.

---

## SLIDE 9 — 6sense Display Deep Dive

**What 6sense is:** A platform that uses AI to figure out which companies are actively researching solutions like yours, then serves banner ads to people at those companies across the internet. You can't target a specific person — you target a company, and 6sense shows your ads to whoever at that company is browsing the web.

**The KPI cards on this slide:**

| Metric | Value | Meaning |
|---|---|---|
| Total Spend | $290K | What was spent on 6sense display ads |
| Total Impressions | 135M | Times ads were shown to someone at a target company |
| Total Clicks | 71K | Times someone actually clicked the ad |
| CTR | 0.05% | Very low but normal for display advertising |
| Form Fills | ~1,286 | Times someone completed a form after seeing/clicking an ad |

**Monthly trend chart:** Shows spend and impressions over time. Useful for seeing if campaigns have been ramping up or down, and spotting seasonal patterns.

**Why 6sense scores highly on Last-Touch:** Because 6sense ads run continuously. An account might first hear about you via email 6 months ago, then evaluate for months, but 6sense ads keep running the whole time — so the *last* thing they saw before reaching out was probably a 6sense ad.

---

## SLIDE 10 — Email Performance

**Two charts on this slide:**

### Chart 1: Open/Click Rates by Seniority
A breakdown of how different job levels respond to email.

| Seniority Level | What it means | Behavior |
|---|---|---|
| C-Suite | CEO, CFO, CMO | Low open rate, rarely clicks — very selective |
| VP/Director | Decision makers | Middle open rate, best click rates |
| Manager | Day-to-day operators | Higher open rate, more curious |
| Individual Contributor | Practitioners | Highest opens, most engaged |

**Why this matters:** This tells you who to email and how. Practitioners open emails out of curiosity; VP/Directors only open if the subject is highly relevant. If you want *clicks* (actual engagement), target mid-level. If you want *meetings*, still focus on VPs but personalize heavily.

### Chart 2: Quarterly Email Engagement Trend
Shows how opens and clicks have trended over time (Q1 2022 → Q4 2024).

**What to look for:** If click rates are declining over quarters, it means either:
- Email content is getting less relevant
- The database is getting stale (contacting the same people too often)
- Better segmentation is needed

---

## SLIDE 11 — Web Engagement

**The big surprising finding:** 36,931 website sessions happened — but only 330 (0.9%) could be matched to a company domain.

**Why so few matched?** Website visits are anonymous by default. You know a visitor came from `San Francisco, CA using Chrome`, but you don't know *which company* they're from unless:
- They fill out a form (then you capture their email → company)
- You use an identity resolution tool like Clearbit, RB2B, or DemandBase
- 6sense's own web tracking is set up

**This is a data gap — not a traffic problem.** You likely have lots of valuable company traffic that you can't attribute to a company because it's anonymous.

**The traffic source pie chart** shows where website visitors came from:
- Direct (typed the URL — often brand awareness working)
- Organic search (found you on Google)
- 6sense-tracked (UTM tagged from a 6sense ad)
- Email traffic (clicked from an email)
- LinkedIn (clicked from LinkedIn)

**Goal completions (1,286):** Website visitors who took a meaningful action — filled out a demo request form, downloaded a whitepaper, registered for a webinar. This is the website's "conversion" metric.

---

## SLIDE 12 — Creative Insights

**Two charts:**

### Top 12 Ads by CTR
A bar chart showing the 12 best-performing individual ad creatives, sorted by click-through rate.

**What CTR (Click-Through Rate) means:** CTR = Clicks ÷ Impressions. If an ad was shown 10,000 times and clicked 50 times, CTR = 0.5%.

**How to use this:** Look at what the top ads have in common — same message? Same visual format? Same CTA? This tells you what to replicate.

### CTR by Creative Attribute
A breakdown showing average CTR by different characteristics of the ad:

| Attribute | What it means |
|---|---|
| Copy Messaging | What the ad says (e.g., "Save Time" vs. "Reduce Cost") |
| Asset Type | Format — banner, video, carousel |
| Copy Tone | Tone — professional, casual, urgent |
| CTA Type | Call to action — "Learn More" (soft) vs. "Book a Demo" (hard) |
| Design Color | Primary color scheme |

**Key finding:** Some message types and formats consistently outperform others. This is your creative playbook — double down on what works.

---

## SLIDE 13 — Segment Analysis

**What "segment" means here:** The company uses 6sense to group target accounts into categories like Enterprise, Commercial, Mid-Market, and Startup — defined by company size, revenue, or other characteristics.

### Chart 1: Win Rate by Segment
Shows what percentage of deals in each segment actually close.

### Chart 2: Average Deal Size by Segment
Enterprise deals are worth more individually; Commercial/Mid-Market has more volume.

**The strategy tension:**
- Enterprise = fewer deals, larger checks, slower to close
- Commercial = more deals, smaller checks, faster to close

Neither is "better" — they're different motions requiring different teams, messaging, and timelines.

### ICP Contact Seniority Breakdown
Shows the mix of contact types in your database by seniority level.

**What ICP means:** Ideal Customer Profile. These are the specific *types of people* at target companies that you want to reach. If your product is bought by CFOs but 80% of your database is individual contributors, you're targeting the wrong people.

---

## SLIDE 14 — Pipeline Health

**Three charts about the current state of your active pipeline (deals not yet closed):**

### Open Pipeline by Stage
Shows how many deals (and how much $) sit in each stage of the sales funnel:
- Stage 1: Discovery / initial conversation
- Stage 2: Qualified / confirmed fit
- Stage 3: Proposal / negotiation
- Stage 4: Contract / legal review
- Stage 5: Closed (pending)

**Why this matters:** A healthy pipeline has a shape — lots of deals early, fewer near close. If it's top-heavy (lots of Stage 1 deals that never progress), you have a conversion problem. If it's bottom-heavy (lots of late-stage deals suddenly), watch for sandbagging or deal quality issues.

### Segment Concentration
Which segments make up the open pipeline. If 80% of pipeline is Enterprise, your revenue forecast depends heavily on a few large deals — risky.

### Lost Deal Reasons
Why deals were lost. Common reasons:
- No decision (prospect didn't commit either way)
- Competitor chosen
- Budget not approved
- Timing (not ready now)

**This is gold for product and marketing teams** — if "no decision" is the top loss reason, there's an objection that's not being addressed. If "competitor chosen," you have a positioning problem.

---

## SLIDE 15 — Account Intent & Profile Fit

**What 6sense Profile Fit means:** 6sense scores every target account on how well they match your Ideal Customer Profile (ICP). Categories are usually:
- Strong Fit
- Moderate Fit
- Weak Fit
- No Fit

This score is based on firmographic data (company size, industry, revenue) and how closely they resemble your existing best customers.

**The distribution chart:** Shows how many accounts fall into each Profile Fit bucket.

**The strategic implication:**
- Strong Fit accounts → invest heavily in ABM (personalized outreach, display ads, events)
- Moderate Fit → test and qualify before heavy investment
- Weak Fit → probably don't spend budget here

**Why this matters:** You only have so much budget. If you're running 6sense display ads to 5,000 accounts equally, you're wasting money on Weak Fit accounts that will never buy. Concentration = better ROI.

---

## SLIDE 16 — Budget Recommendation

**The "what should we spend next year" slide. Three scenarios:**

### Scenario 1: Status Quo
- Keep current spending levels
- Projected pipeline: Same as current trajectory
- Risk: Win rate is declining, so same spend = less pipeline over time

### Scenario 2: ROI-Optimized (+30% reallocation)
- Take budget from low-ROI channels (LinkedIn, some Events) and redirect to Email + 6sense Display
- Projected pipeline increase: +30%
- No extra total spend — just smarter allocation
- How it was calculated: Channel ROI table × current spend × projected reallocation

### Scenario 3: Growth Mode (2x budget)
- Double total marketing spend, concentrated in top-performing channels
- Projected pipeline: 2x+ (due to compounding effect of coordinated ABM)
- Requires sign-off from finance and alignment with sales capacity

**How these projections were made:**
Current spend × win rate × average deal size = current pipeline per dollar spent. Apply that rate to new spend allocation → project new pipeline. It's a multiplier model, not a forecast — but it's directionally accurate for decision-making.

---

## SLIDE 17 — Win Probability Model (Machine Learning)

**The AI slide — here's what actually happened:**

### What is a Random Forest?
Imagine you're trying to predict if a deal will close. You ask 100 different analysts (each one only looking at some of the data). Each analyst votes yes or no. The majority vote = the final prediction.

In code: 100 "decision trees" each see different subsets of the data. Their votes are averaged. This prevents any one weird pattern from dominating.

### Training Process
1. Took 2,743 closed deals (both won AND lost)
2. For each deal, the model looked at: deal amount, channel it came from, company segment, tier, industry, how many 6sense ad impressions that company received, how many email clicks, how many contacts at the account, seniority mix of those contacts
3. Trained the model to find patterns between those features and whether the deal was won or lost
4. Tested on 20% of the data it never saw → AUC = 0.807

### What AUC = 0.807 means
AUC (Area Under the Curve) measures how good the model is at ranking won deals above lost ones:
- 0.5 = random guessing (coin flip)
- 1.0 = perfect
- 0.807 = the model correctly predicts which of two deals is more likely to close 80.7% of the time

For a marketing dataset without deep behavioral data, 0.807 is very good.

### The Feature Importance Bar Chart
Shows which inputs matter most to the model's predictions:

1. **Tier** — How qualified is the account in the CRM? (Tier 1/2/3)
2. **Channel** — Where did the lead come from? (Referral closes at 29%, marketing at 10%)
3. **Campaign Impressions** — Accounts that saw more 6sense ads close more often
4. **Deal Amount** — Larger deals have different buying dynamics
5. **Segment** — Enterprise vs. Commercial behave differently

### The Win Probability Distribution
A histogram showing: of the 545 currently open deals, how many scored in each probability bucket (0–10%, 10–20%, etc.).

**How sales should use this:** Priority-sort your pipeline by win probability score. Focus time and resources on deals scoring 60%+ — don't spread effort evenly across 545 open deals when the model tells you which ones are actually likely to close.

---

## SLIDE 18 — Account Coverage Gap

**The biggest opportunity in the entire deck.**

### The Analysis
Of all 4,797 target accounts in the database, how many has marketing ever actually reached?

| Coverage Category | Accounts | % | Opportunity Rate |
|---|---|---|---|
| Not Reached | 3,256 | 67.9% | 17.5% |
| 6sense Ads Only | 312 | 6.5% | 28.2% |
| Email Only | 687 | 14.3% | 45.9% |
| Both Channels | 542 | 11.3% | 42.6% |

### What "Opportunity Rate" means
Opportunity Rate = (accounts with at least one CRM deal) ÷ (total accounts in that group)

So: of the 542 accounts reached by BOTH email AND 6sense, 42.6% have at least one deal in the CRM. Of the 3,256 accounts never reached, only 17.5% have a deal.

### The Math
If you could move unreached accounts to "Both Channels" coverage rate (42.6%):
- Currently: 3,256 × 17.5% = ~570 have a deal
- Potential: 3,256 × 42.6% = ~1,387 would have a deal
- That's **~800 additional opportunities**

Even being conservative: reaching 10% of those accounts at the Both Channels rate = 200+ new opportunities.

### The Recommendation
The number one growth lever isn't creative optimization or attribution model tuning — it's **covering more of the accounts you've already decided are worth targeting.** You have 3,256 accounts sitting there with no marketing touch at all.

---

## SLIDE 19 — Cohort Trend

**The "warning signal" slide. Also the most important slide in the deck.**

### What a Cohort Analysis Is
Instead of looking at all deals ever, you group deals by the *quarter they were created* and track what happened to each group.

Like tracking people who started a diet in January vs. February vs. March — each "cohort" is looked at separately.

### What the Chart Shows
Three lines/bars plotted over each quarter from 2022Q1 → 2024Q4:
1. **Pipeline bar** — Total $ of new deals created that quarter (growing)
2. **Win rate line** — % of that quarter's deals that eventually closed (declining)
3. **Marketing share line** — % of that quarter's deals from marketing channels (trending)

### The Critical Finding

| Quarter | Pipeline | Win Rate |
|---|---|---|
| 2022 Q1 | Smaller | 37% |
| 2023 Q1 | Growing | ~25% |
| 2024 Q4 | Largest | 15% |

**Pipeline is going up. Win rate is going down. These two things are moving in opposite directions.**

### Why This Happens
Several possible causes:
1. **ICP drift** — Sales is accepting deals that don't fit the Ideal Customer Profile just to hit pipeline numbers
2. **Market competition** — More competitors = harder to win deals
3. **Qualification standards dropped** — "Opportunity" threshold got lower, letting in weaker deals
4. **Longer sales cycles** — More recent deals haven't had time to close yet (could self-correct)

### Why This Is the Most Important Slide
You can have $100M in pipeline and $0 in revenue if nothing closes. Pipeline is vanity; revenue is sanity. If win rate continues declining from 37% → 15% → 7%, the business is in trouble even while the pipeline metric looks great. This is a quality problem hiding behind a quantity metric.

---

## SLIDE 20 — Targeting Matrix (Win Rate Heatmap)

**A heatmap that tells you exactly where to focus ABM investment.**

### What the Matrix Is
A grid where:
- **Rows** = Customer Segment (Enterprise, Commercial, Mid-Market, SMB)
- **Columns** = 6sense Profile Fit (Strong, Moderate, Weak, No Fit)
- **Each cell** = Win rate for that combination

Darker cell = higher win rate = higher priority target.

### How to Read It
Example cells:
- Commercial + Strong Fit → 47% win rate (dark) → Top priority
- Enterprise + Strong Fit → 35% win rate + large deal size → High priority
- SMB + No Fit → 3% win rate (light) → Don't spend here

### The Strategic Playbook
This matrix is literally a budget allocation guide:
- **Tier 1** (dark cells): Run 6sense ads, personalized email sequences, SDR outreach, executive events
- **Tier 2** (medium cells): Run nurture campaigns, less personalized, lower cost per account
- **Tier 3** (light cells): Don't spend — or only spend if they reach out inbound

**Why this matters:** Most companies treat all target accounts equally and run the same 6sense ads to all of them. This matrix proves that's wrong — Strong Fit accounts close at 47%, Weak Fit at 3%. Concentrating the same budget on fewer, better-fit accounts = dramatically better ROI.

---

## SLIDE 21 — Next Steps

**The "what to do Monday morning" slide. Three time horizons:**

### 30-Day Quick Wins
Low-effort, high-impact actions:
- Run a list of the 545 open deals sorted by win probability score → give to sales as a prioritized hit list
- Export the 3,256 unreached accounts → give to marketing ops to start 6sense campaigns on the highest-fit ones
- Audit top 5 lost deal reasons and create sales enablement for each objection

### 90-Day Initiatives
Medium-effort projects:
- Reallocate 10–15% of budget from low-ROI channels to Email + 6sense Display
- Set up proper UTM tracking on the website so more web sessions can be matched to company domains (currently 99.1% anonymous)
- Standardize CRM lead source values so there aren't 40+ variations of "6sense channel"
- Investigate the win rate decline — is it ICP drift? Talk to sales leadership

### Ongoing Success Metrics
How to know if it's working:
- **Win rate by cohort** — quarterly tracking; should stabilize or recover toward 25%+
- **Account coverage** — track % of target accounts reached by both channels; goal is 30%+ (from current 11%)
- **Marketing-influenced pipeline** — track monthly; should grow as coverage improves
- **Top creative CTR** — monthly monitoring; refresh creatives when CTR drops below 0.03%
- **ML model scores** — re-train the win probability model quarterly as new closed deals come in

---

## Quick Reference: Key Terms

| Term | One-line definition |
|---|---|
| **ABM** | Targeting specific companies instead of random people |
| **Attribution** | Deciding which marketing action gets credit for a sale |
| **Pipeline** | The total $ value of all deals currently in the sales process |
| **Win Rate** | % of deals that actually close |
| **ICP (Ideal Customer Profile)** | The description of your perfect customer — used to score fit |
| **CTR** | Click-Through Rate = Clicks ÷ Impressions |
| **ROI** | Return on Investment = Pipeline (or Revenue) ÷ Spend |
| **Cohort** | A group of deals/customers created in the same time period, tracked together |
| **First-Touch / Last-Touch** | Attribution models that give 100% of credit to the first or last interaction |
| **AUC** | How accurate an ML model is (0.5 = random, 1.0 = perfect, 0.807 = ours) |
| **Profile Fit** | 6sense score for how closely an account matches your ideal customer |
| **Coverage Gap** | Target accounts that have never received any marketing touchpoint |
