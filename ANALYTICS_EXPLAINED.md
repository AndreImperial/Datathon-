# Marketing Analytics — Plain English Guide

## What is this company doing?

This is a **B2B ABM (Account-Based Marketing) company**. Instead of advertising to random people, they pick specific companies ("target accounts") and run coordinated marketing campaigns at those companies across multiple channels — display ads, email, LinkedIn, events. The goal is to get those companies to eventually buy.

Think of it like fishing with a spear (ABM) instead of a net (traditional marketing). You aim at specific fish.

---

## What data do we have?

| Dataset | What it contains | Size |
|---|---|---|
| **Opportunities** | Every sales deal — amount, stage, whether it was won or lost, where the lead came from | 3,288 unique deals |
| **Accounts** | The companies being targeted — industry, size, country, how well they fit the ideal customer profile | 5,264 companies |
| **6sense Campaign** | How many times each target company saw a display ad and whether they clicked | 63,096 rows |
| **Ad Metrics** | Performance details for each individual ad creative (CTR, spend, clicks) | 4,626 rows |
| **Email Engagements** | Every email interaction — who opened, who clicked, who registered | 17,130 rows |
| **Web Engagements** | Website visits — where traffic came from, which pages, whether they completed a goal | 36,931 rows |
| **ICP Database** | The specific people (contacts) at target companies, their job title and seniority | 36,860 contacts |
| **6sense Segments** | How 6sense groups companies by buying intent (e.g., "in-market", "awareness") | 7,934 rows |

**How they connect:** Every dataset is linked by **company domain** (e.g., `microsoft.com`). The deal data links to the account data via a Salesforce account ID.

---

## Key Numbers (after cleaning)

| Metric | Value | What it means |
|---|---|---|
| Total pipeline | $25.0M | All deals in the funnel combined |
| Won revenue | $5.4M | Deals that were actually closed and won |
| Overall win rate | 33% | 1 in 3 deals closes |
| Marketing-sourced deals | 511 / 3,288 | 16% of deals came from marketing channels |
| Marketing-sourced win rate | 10% | Lower because marketing finds earlier-stage, exploratory prospects |
| Total ad impressions | 135M | How many times ads were shown |
| Total ad spend | $1.22M | What was actually spent on ads |
| Email engagements | 17,130 | Opens + clicks + registrations |
| Email click rate | 4.5% | 766 clicks out of 17,130 engagements |
| Form fills / goal completions | 1,286 | People who took a meaningful action on the website |

---

## What is each marketing channel?

**6sense Display** — Banner ads shown to people at target companies across the internet. 6sense uses AI to figure out which companies are "in-market" (actively researching solutions like yours) and shows them ads. You don't know exactly who at the company saw the ad, just that someone at that company did.

**Email MQA (Marketing Qualified Account)** — Emails sent to contacts at companies that have shown intent signals. "MQA" means the whole company (account) has been qualified by marketing, not just an individual.

**6sense Channel** — Deals that came in through 6sense's partner/channel program (resellers, partners).

**6sense Event** — Deals sourced at events organized or sponsored through 6sense programs.

**Web Inbound** — Companies that came to the website on their own and started a conversation.

**Referral** — Someone at an existing client or partner recommended the company.

**Existing Client** — Upsells and expansions to companies already buying from you.

**Event** — Deals sourced from trade shows and conferences.

---

## What is Attribution?

**The problem:** A company might see 20 of your ads, get 3 emails, visit your website 5 times, then attend a webinar — and THEN become a customer. Which of those marketing touches gets "credit" for the deal?

Attribution models answer this question differently:

### Marketing Sourced
**Simple answer:** The CRM says the lead originally came from marketing. Only counts deals where the `LeadSource` field is a marketing channel.
- **Our number:** $4.20M pipeline, $636K won revenue, 511 deals

### Marketing Influenced
**Simple answer:** Marketing touched this account BEFORE the deal was created, even if sales ultimately sourced it. Includes any deal where marketing had contact with that company within 365 days of the deal being created.
- **Our number:** $6.49M pipeline, $830K won revenue, 708 deals influenced
- This is always bigger than Sourced because it captures deals where marketing "warmed up" an account that sales then closed

### First-Touch
**The idea:** Give 100% of credit to whichever channel made FIRST contact with the account.
- **Why useful:** Shows which channels are best at finding new accounts
- **Our number:** Email gets the most credit ($4.0M) — email is often how prospects are first identified

### Last-Touch
**The idea:** Give 100% of credit to the LAST marketing touchpoint before the deal was created.
- **Why useful:** Shows which channels close/convert accounts
- **Our number:** 6sense Display gets more credit ($3.3M) — ads are often the last thing an account sees before they reach out

### Linear
**The idea:** Split credit equally among ALL channels that touched the account before the deal.
- If email + 6sense display + web all touched an account, each gets 1/3 of the deal value
- **Why useful:** Fairest model for understanding contribution of each channel
- **Our number:** Email $3.6M, 6sense $2.7M, Web $250K

### Time-Decay
**The idea:** More recent touches get more credit, older touches get less (credit decays over time like radioactive material — half-life of 30 days).
- **Why useful:** Rewards channels that are active at the end of the buying cycle
- **Our number:** 6sense Display $3.5M (lots of late-stage ad activity), Email $2.8M

---

## What the data tells us

**1. Email is the top first-touch channel** — Email is where most accounts first make contact with marketing. This means email campaigns are effective at finding new opportunities.

**2. 6sense Display is strong at the end of the funnel** — 6sense gets more credit in Last-Touch and Time-Decay models than First-Touch. This means display ads are keeping the brand visible when accounts are actively evaluating options.

**3. Existing clients and referrals are the strongest relationship-driven motions** — 1,366 deals from existing clients (42% of all deals) and 291 from referrals (9%). Together they account for $6.0M in pipeline and $2.3M in won revenue. This is normal for B2B companies: expand and refer is often the most efficient growth engine.

**4. Marketing-sourced deals have a lower win rate (10%) but that's expected** — Marketing finds prospects earlier in their journey. They're not ready to buy yet. Sales-sourced deals (especially referrals) close at 29% because those people are already warm. Don't judge marketing by the same win rate standard as referrals.

**5. Ad spend ROI** — $1.22M in ad spend generated $89K in 6sense display pipeline (sourced) — but $3.5M+ when you include influenced pipeline (time-decay). Raw ROI looks low when you only count sourced deals; it looks much better when you count how many deals ads touched along the way.

---

## What does the dashboard show?

The dashboard at **http://localhost:8080/Marketing_Analytics_Dashboard.html** has 6 sections:

1. **Executive Summary** — Top-line KPIs and pipeline by channel
2. **Attribution Models** — How pipeline credit changes depending on which model you use
3. **Channel Performance** — Spend vs pipeline scatter, win rates by channel
4. **Funnel** — Step-by-step conversion from impression to closed deal
5. **Segment & Email** — Win rates by company segment, email engagement by job level
6. **Creative & Budget** — Which ad creatives perform best, budget scenarios

All charts are interactive — hover for exact numbers, click legend items to hide/show channels.

---

## What does the presentation cover?

The 17-slide PowerPoint deck tells this story:
1. What we did and how (methodology)
2. How attribution models work (with examples)
3. What marketing is contributing to pipeline (sourced + influenced)
4. Which channels perform (6sense, email, web, events)
5. Which ad creatives work best
6. Who in target accounts responds most (seniority analysis)
7. Budget recommendation — where to shift money based on ROI
8. 30/90-day action plan

---

## What should the company do next?

Based on the data:

**Invest more in:**
- Email campaigns (highest first-touch, strong linear credit)
- 6sense Display (strong last-touch and time-decay, keeps brand top-of-mind)

**Reduce or investigate:**
- LinkedIn (only 1 deal, minimal data)
- Some "other" catch-all lead sources (need better CRM hygiene to tag properly)

**Fix the data:**
- Web sessions are almost entirely anonymous (only 330 of 36,931 sessions have a matched company domain). Add better domain resolution or identity resolution tools.
- Many deals have no dollar amount ($0 in the `_amount` field). Better pipeline hygiene = better ROI calculations.
- Standardize lead source naming in CRM (currently 40+ raw values map to 12 channel categories — too much variation).
