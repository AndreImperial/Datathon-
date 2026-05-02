# Marketing Analytics Case Study — Step-by-Step Methodology

**Project:** B2B ABM Marketing Attribution & Budget Optimization  
**Datasets:** 8 raw Excel files | **Deliverables:** Interactive Dashboard + 21-Slide Deck  
**Pipeline:** $25M won revenue analyzed across 3,288 unique deals

---

## Table of Contents

1. [Raw Data Audit](#step-1--raw-data-audit)
2. [Data Cleaning](#step-2--data-cleaning)
3. [Data Integration](#step-3--data-integration)
4. [Attribution Analysis](#step-4--attribution-analysis)
5. [Advanced Analytics](#step-5--advanced-analytics)
6. [Dashboard](#step-6--dashboard)
7. [Presentation](#step-7--presentation)
8. [Full Pipeline Summary](#full-pipeline-summary)

---

## Step 1 — Raw Data Audit

Before writing any code, every Excel file was opened and inspected manually.

### What Was Found

**Critical Bug — Opportunity Log (16,421 rows → 3,288 unique deals)**

The opportunity log is a *changelog*, not a snapshot. Every time a deal moved stages in Salesforce, a new row was added. The actual number of unique deals is 3,288. If this wasn't caught, every pipeline metric would be inflated 5x.

```
Raw file:    16,421 rows
After fix:    3,288 unique deals (kept only the latest stage snapshot per deal)
```

**Critical Bug — iswon stored as text strings**

The column marking a deal as won or lost was stored as the text `"True"` and `"False"` instead of real boolean values. In Python, the string `"False"` evaluates as truthy (non-empty string), so every "won deal" calculation was returning 0. This broke all won revenue, win rate, and won pipeline metrics across the entire analysis.

```
Before fix:  Won revenue = $0, Win rate = 0%
After fix:   Won revenue = $5.4M, Win rate = 33%
```

**Data Quality Issues Documented**

| Issue | Impact |
|---|---|
| Web sessions 99.1% anonymous | Only 330 of 36,931 sessions had a matched company domain |
| 40+ raw lead source values in CRM | "6sense Channel", "6Sense - Channel", "6SENSE CHANNEL" all mean the same thing |
| 701 won deals with $0 amount | Real CRM hygiene issue — deals marked Closed Won with no dollar value entered |
| 7 orphaned opportunities | Deals in the pipeline with no matching account in the accounts table |

---

## Step 2 — Data Cleaning

**File:** `analytics_case_study/01_data_cleaning.py`  
**Output:** 8 Parquet files saved to `data/cleaned/`

One function per dataset. Each function reads the raw Excel file and outputs a clean Parquet file.

### Opportunities (Most Complex)

```
1. Load all 16,421 rows with dtype=str to avoid Excel type inference errors
2. Replace string "null" → NaN across all columns
3. Parse all date columns with mixed format detection
4. Cast dollar amounts, percentages, and day counts to numeric types
5. Convert "True"/"False" strings → real booleans for iswon and isclosed
6. DEDUPLICATE: group by _opportunity_id, keep row with max _order value
   → reduces 16,421 rows to 3,288 unique deals
7. Map 40+ raw lead source values → 12 clean channel categories
   using a lookup table (CHANNEL_LEADSOURCE_MAP in config.py)
8. Derive is_marketing_sourced boolean flag
```

**Channel mapping example:**

| Raw CRM Value | Clean Channel |
|---|---|
| `6sense - Channel` | `6sense_channel` |
| `6Sense Channel` | `6sense_channel` |
| `6SENSE CHANNEL` | `6sense_channel` |
| `Email MQA` | `email_mqa` |
| `Web Inbound` | `web_inbound` |

### Accounts

```
1. Normalize domains: "https://www.Microsoft.com" → "microsoft.com"
   (strip https://, strip www., lowercase)
   This is the universal join key between ALL 8 datasets
2. Standardize country: "USA", "usa", "US" → "United States"
3. Normalize industry: 15 raw variants → 8 canonical categories
4. Fill tier nulls and "TBD" values → "Unassigned"
```

### Email Engagements

```
1. Strip hidden newline characters from campaign subject lines
2. Parse sent date and opened date
3. Derive: days_to_open, is_open, is_click, is_register (boolean flags)
```

### Web Engagements

```
1. Fix leading-space column header: " _account_type" → "_account_type"
2. Derive traffic source flags:
   - is_6sense_traffic (UTM source contains "6sense")
   - is_email_traffic (UTM source contains "email")
   - is_linkedin_traffic (UTM source contains "linkedin")
3. Derive: is_goal_completed, has_domain flags
```

### 6sense Campaign Accounts

```
1. Replace "-" placeholder values → NaN
2. Parse dates and derive month_year column
3. Derive: ctr (clicks/impressions), cost_per_click, cost_per_form_fill
```

### ICP Database

```
1. Filter out free email domains (gmail.com, yahoo.com, etc.)
   — these are not B2B contacts
2. Normalize lifecycle stage to standard labels (MQL, SQL, Lead, etc.)
3. Normalize industry using same map as accounts
```

---

## Step 3 — Data Integration

**File:** `analytics_case_study/02_data_integration.py`  
**Output:** 4 master Parquet files saved to `data/integrated/`

All 8 cleaned datasets are joined together using **company domain** as the universal key.

### master_account.parquet (5,264 rows — one row per company)

```
Start with: accounts table (5,264 companies)

LEFT JOIN 6sense_segments   on domain  → what buying stage is each company in?
LEFT JOIN 6sense_campaign   on domain  → total ad spend, impressions, form fills
LEFT JOIN email_engagements on domain  → total opens, clicks, unique campaigns
LEFT JOIN web_engagements   on domain  → sessions, pageviews, goal completions
LEFT JOIN opportunities     on accountid → pipeline, won amount, lead source
LEFT JOIN icp_database      on accountid → contact count by seniority level

Result: One row per company with every metric from every dataset attached
```

### channel_pipeline.parquet (one row per channel)

Grouped from opportunities by channel_category. Columns computed:
- Deal count, total pipeline, won pipeline
- Win rate (won deals ÷ total deals)
- Average deal size, average days to close
- Ad spend pulled from ad_metrics by platform
- Pipeline ROI (pipeline ÷ spend), Revenue ROI (won ÷ spend)

### funnel_metrics.parquet (stage-by-stage counts)

```
Impressions            → 135,000,000
Clicks                 →      71,000  (0.05% CTR)
Form Fills             →       1,286
Email Engagements      →      17,130  (parallel channel, not a conversion of clicks)
All Opportunities      →       3,288
Marketing-Sourced Opps →         511
Closed Won (All)       →       1,073
Marketing-Sourced Won  →          52
```

### creative_performance.parquet

Grouped from ad_metrics by creative attributes:
`_adname`, `_copymessaging`, `_copyassettype`, `_copytone`, `_ctacopysofthard`, `_designcolor`

Computed: CTR, CPM, CPC, landing page conversion rate per creative group.

---

## Step 4 — Attribution Analysis

**File:** `analytics_case_study/03b_attribution.py`  
**Output:** `data/integrated/attribution_results.parquet`

This is the core analysis. The question: *which marketing channel gets credit for each deal?*

### Building the Touchpoint Map

For every deal, the code looks back **365 days** before the deal was created and collects every marketing touchpoint in that window:

```
For deal at "Acme Corp" created on 2024-01-15:
  Look back to 2023-01-15

  Check 6sense_campaign:    Did Acme Corp receive 6sense ads? → YES (Day -90 to -10)
  Check email_engagements:  Was Acme Corp emailed?           → YES (Day -180)
  Check web_engagements:    Did Acme Corp visit the site?    → YES (Day -30)
  Check deal lead source:   What does the CRM say?           → "6sense_display"

Result: 3 touchpoints across 3 channels in the attribution window
```

**Scale:** 17,702 total touchpoints mapped across 3,166 opportunities.

### The 6 Attribution Models

**Marketing Sourced**
- The CRM `LeadSource` field explicitly says a marketing channel
- Hard credit — 100% goes to that channel, no sharing with others
- Conservative. Only counts deals marketing officially originated
- Result: $4.2M pipeline, 511 deals

**Marketing Influenced**
- Did marketing touch this account *at any point* in the 365-day window before the deal?
- If yes, the deal is "influenced" regardless of what the CRM says
- Always larger than Sourced — captures deals where marketing warmed up an account that sales then closed
- Result: $6.3M pipeline, 708 deals

**First-Touch**
- 100% of the deal's dollar value goes to the *very first* touchpoint
- Answers: what channel starts conversations?
- Use for: measuring top-of-funnel investment effectiveness
- Key finding: Email gets the most credit ($4.0M) — email is how accounts first engage

**Last-Touch**
- 100% of the deal's dollar value goes to the *most recent* touchpoint before deal creation
- Answers: what channel triggers conversion?
- Use for: understanding what closes deals
- Key finding: 6sense Display gets more credit ($3.3M) — ads are still running when accounts reach out

**Linear**
- Credit split equally among ALL channels that touched the account
- If email + 6sense + web all touched the account → each gets 1/3 of the deal value
- Fairest model for seeing everyone's contribution
- Key finding: Email $3.6M | 6sense $2.7M | Web $250K

**Time-Decay**
- Credit weighted by recency. Half-life = 30 days
- A touchpoint 30 days ago gets 2x the credit of one 60 days ago
- Best model for budget decisions — rewards channels active at the end of the buying cycle
- Key finding: 6sense $3.5M (lots of late-stage ad activity) | Email $2.8M

### Attribution Example Walkthrough

```
Deal: Acme Corp — $50,000

Timeline:
  Day 1  (180 days before deal): Email sent, contact opens and clicks
  Day 45 (135 days before deal): 6sense ads running at Acme Corp
  Day 60 (120 days before deal): Contact visits website, completes demo form
  Day 90 (0 days):               Deal created in CRM — LeadSource = "Email MQA"

Attribution results:
  Marketing Sourced:  Email MQA gets $50,000 (CRM says so)
  Marketing Influenced: All 3 channels — deal is "influenced"
  First-Touch:        Email gets $50,000 (first contact)
  Last-Touch:         Web gets $50,000 (last touch before deal)
  Linear:             Email $16,667 | 6sense $16,667 | Web $16,667
  Time-Decay:         Web ~$28,000 | 6sense ~$14,000 | Email ~$8,000
                      (Web most recent = most credit)
```

---

## Step 5 — Advanced Analytics

**File:** `analytics_case_study/03c_advanced_analytics.py`  
**Output:** 7 additional Parquet files in `data/integrated/`

Four analyses that go beyond standard reporting.

### A. Win Probability Model (Machine Learning)

**Goal:** Score every open deal with a probability of closing (0–100%).

```
Algorithm:    Random Forest Classifier (scikit-learn)
Training set: 2,743 closed deals (won or lost)
Features:     deal amount, channel category, segment, tier, industry,
              campaign impressions received, email clicks recorded,
              number of contacts at the account, seniority breakdown

Training process:
  1. Merge opportunities with master_account data
  2. Encode categorical features (channel, segment, industry)
  3. Split: 80% train, 20% test
  4. Train Random Forest (100 trees)
  5. Evaluate on test set → AUC = 0.807

Scoring:
  Apply trained model to 545 currently open deals
  Output: win_probability column (0.0 to 1.0) per deal
```

**AUC = 0.807** means the model correctly ranks a won deal above a lost deal 80.7% of the time. Random guessing = 0.5. Perfect = 1.0.

**Top predictors found:**
1. Tier (account tier in CRM — how well qualified the account is)
2. Channel category (lead source predicts win likelihood)
3. Campaign impressions (accounts that saw more 6sense ads close more often)
4. Deal amount (larger deals have different dynamics)
5. Segment (Enterprise vs. Commercial vs. Mid-Market behaves differently)

### B. Account Coverage Gap Analysis

**Goal:** Of all target accounts, how many has marketing ever reached?

```
For every domain in the accounts table (4,797 companies):
  Check 6sense_campaign:    Was this domain ever in a campaign?
  Check email_engagements:  Was any contact at this domain ever emailed?

Categorize each account:
  "Not Reached"    → no email, no 6sense ads
  "6sense Only"    → saw ads but no email
  "Email Only"     → emailed but no ads
  "Both Channels"  → reached by both

Then calculate opportunity rate per group:
  (accounts with at least 1 CRM deal) ÷ (total accounts in group)
```

**Key finding:**

| Coverage Tier | Accounts | Opportunity Rate |
|---|---|---|
| Not Reached | 3,256 (67.9%) | 17.5% |
| 6sense Only | 312 (6.5%) | 28.2% |
| Email Only | 687 (14.3%) | 45.9% |
| Both Channels | 542 (11.3%) | 42.6% |

3,256 accounts have never seen a single marketing touchpoint. Reaching them with both channels at the "Both Channels" rate would add ~200+ new opportunities.

### C. Deal Velocity Analysis

**Goal:** How many days does it take to close a deal, broken down by channel?

```
Filter to closed won deals only
For each deal: days_to_close = close_date - created_date
Group by channel_category
Calculate: median days, mean days, deal count
```

**Findings:** Existing clients close in 34 days (median) — trust already exists. 6sense channel deals take 98 days — net-new accounts need more evaluation time. This directly impacts revenue forecasting.

### D. Cohort Analysis

**Goal:** How has pipeline quality changed over time?

```
Group all deals by the quarter they were created (2022Q1 → 2024Q4)
For each quarter calculate:
  - Total pipeline created ($ value of all deals created that quarter)
  - Win rate (won deals ÷ total deals created that quarter, measured retrospectively)
  - Marketing's share of deals (marketing-sourced deals ÷ total deals)
```

**Critical finding:** Pipeline is growing every quarter (positive). But win rate has dropped from 37% in 2022Q1 to 15% in 2024Q4 (warning signal). More deals are entering the funnel but fewer are closing as a percentage — meaning pipeline quality is declining even as volume grows.

### E. ABM Targeting Priority Matrix

**Goal:** Which account types should get the most ABM investment?

```
For every unique combination of [Segment × 6sense Profile Fit]:
  Count total deals
  Count won deals
  Calculate win rate

Pivot into a matrix (rows = segments, columns = profile fit tiers)
Each cell = win rate for that combination
```

**Output:** A heatmap where darker cells = higher win rate = higher-priority ABM targets. Commercial + Strong Fit (47% win rate) and Enterprise + Strong Fit (35% win rate, highest deal size) are the Tier 1 targeting zones.

### F. Journey Sequence Analysis

**Goal:** What are the most common channel paths that led to a won deal?

```
For won deals with multiple touchpoints:
  Sort touchpoints by date
  Record the sequence: [first_channel → second_channel → third_channel]
  Group by 2-channel sequence
  Count deals and sum pipeline per sequence
```

**Key finding:** Email MQA → 6sense Display is the most common winning 2-channel sequence. This validates the coordinated playbook: email opens the conversation, 6sense keeps the brand visible through the evaluation period.

---

## Step 6 — Dashboard

**File:** `analytics_case_study/04_html_dashboard.py`  
**Output:** `outputs/dashboard/Marketing_Analytics_Dashboard.html` (244 KB)

### Technical Architecture

The dashboard is a single self-contained HTML file. No server required — open it in any browser.

```
Python builds each chart using Plotly (a charting library)
↓
Each chart is serialized to JSON (a text representation of the chart data)
↓
That JSON is embedded directly into the HTML file as JavaScript variables
↓
When the browser opens the file, Plotly JS (loaded from CDN) reads the
variables and renders fully interactive charts
↓
Result: One file, works offline, works anywhere
```

### Chart Construction

Every chart follows the same pattern:

```python
def channel_bar():
    df = channel_pipeline.sort_values("total_pipeline", ascending=True)
    fig = go.Figure(go.Bar(
        y=df["channel_category"],
        x=df["total_pipeline"],
        text=[fmt(v) for v in df["total_pipeline"]],   # number labels on bars
        textposition="outside",
    ))
    fig.update_layout(title="Pipeline by Channel", ...)
    return fig
```

Then in `main()`:
```python
charts = {
    "bar_channel": fig_json(channel_bar()),   # convert to JSON
    ...
}
html = HTML_TEMPLATE.format(**charts)         # inject JSON into HTML template
```

### 7 Dashboard Sections

| Section | What It Shows |
|---|---|
| Executive Summary | KPI cards, pipeline by channel bar, monthly trend |
| Attribution Models | Model comparison chart, sourced vs influenced donuts, full attribution table |
| Channel Performance | Spend vs pipeline scatter, funnel chart, ROI table |
| Segment Analysis | Industry × segment pipeline heatmap, win rate by segment |
| Creative & Email | Top CTR ads, CTR by creative attribute, email engagement by seniority |
| Budget Scenarios | 3-scenario projection (Status Quo / ROI-Optimized / Growth Mode) |
| Advanced Analytics | ML win probability, account coverage gap, deal velocity, journey sequences, targeting matrix, cohort trend |

---

## Step 7 — Presentation

**File:** `analytics_case_study/05_presentation.py`  
**Output:** `outputs/presentation/Marketing_Analytics_Executive_Deck_v4.pptx` (21 slides, 951 KB)

### Technical Approach

Built entirely in Python using `python-pptx`. No manual PowerPoint work.

Every chart is:
```
1. Generated as a matplotlib figure (not Plotly — PowerPoint needs image files)
2. Saved to an in-memory PNG buffer (not written to disk)
3. Embedded directly into the slide as a picture
```

Every slide has:
```
- Title bar with slide title and subtitle
- Main chart(s) filling most of the slide
- Blue context box at the bottom with:
    WHAT THIS SHOWS: plain English description
    HOW TO READ:     how to interpret the chart
    INSIGHT:         the key business takeaway
```

### 21 Slides

| # | Slide | Key Content |
|---|---|---|
| 1 | Title | Company name, dataset summary, 4 stat cards |
| 2 | Executive Summary | 5 KPI cards + 5 strategic bullets |
| 3 | Data & Methodology | All 8 datasets listed with sizes and purpose |
| 4 | Attribution Methodology | 6 model explanations, when to use each |
| 5 | Attribution Results | Grouped bar chart — all 6 models × all channels |
| 6 | Sourced vs Influenced | Two pie charts — hard credit vs shadow credit |
| 7 | Marketing Funnel | Horizontal bar chart from impressions to closed won |
| 8 | Channel Attribution | Pipeline by channel + ROI table |
| 9 | 6sense Display | KPI cards + monthly spend & impressions trend |
| 10 | Email Performance | Open/click rates by seniority + quarterly trend |
| 11 | Web Engagement | Sessions, goal completions, traffic source pie |
| 12 | Creative Insights | Top 12 ads by CTR + CTR by creative attribute |
| 13 | Segment Analysis | Win rate + avg deal size by segment + ICP seniority list |
| 14 | Pipeline Health | Open pipeline by stage + segment breakdown + lost reasons |
| 15 | Intent & Profile Fit | 6sense profile fit distribution + strategic implications |
| 16 | Budget Recommendation | 3-scenario projected pipeline comparison |
| 17 | Win Probability Model | Feature importance bar + win probability histogram |
| 18 | Account Coverage Gap | Coverage tier bar chart + opportunity rate by tier |
| 19 | Cohort Trend | Pipeline bars + win rate line + marketing share line per quarter |
| 20 | Targeting Matrix | Win rate heatmap (Segment × Profile Fit) + priority guide |
| 21 | Next Steps | 30-day quick wins, 90-day initiatives, ongoing metrics |

---

## Full Pipeline Summary

```
Raw Excel Files (8 datasets, ~145,000 total rows)
        │
        ▼
01_data_cleaning.py
  ├── Fix iswon string→boolean bug
  ├── Deduplicate opportunities: 16,421 rows → 3,288 unique deals
  ├── Normalize domains (universal join key)
  ├── Standardize channel names (40+ raw → 12 clean categories)
  └── Output: 8 Parquet files → data/cleaned/
        │
        ▼
02_data_integration.py
  ├── Join all 8 datasets on company domain
  ├── Build master_account (one row per company)
  ├── Build channel_pipeline (one row per channel)
  ├── Build funnel_metrics (stage-by-stage counts)
  └── Output: 4 Parquet files → data/integrated/
        │
        ▼
03b_attribution.py
  ├── Map 17,702 touchpoints to 3,166 opportunities
  ├── Apply 6 attribution models (Sourced, Influenced, FT, LT, Linear, TD)
  └── Output: attribution_results.parquet
        │
        ▼
03c_advanced_analytics.py
  ├── Train Random Forest win probability model (AUC = 0.807)
  ├── Score 545 open deals
  ├── Account coverage gap analysis (67.9% unreached)
  ├── Deal velocity by channel (median days to close)
  ├── Journey sequence analysis (winning channel paths)
  ├── Cohort analysis (win rate declining: 37% → 15%)
  └── Output: 7 Parquet files → data/integrated/
        │
        ▼
03_analysis.py
  └── Output: 7 Excel reports → outputs/analysis/
        │
        ▼
04_html_dashboard.py
  └── Output: Marketing_Analytics_Dashboard.html (244 KB, self-contained)
        │
        ▼
05_presentation.py
  └── Output: Marketing_Analytics_Executive_Deck_v4.pptx (21 slides, 951 KB)
```

---

## Key Numbers (After All Cleaning)

| Metric | Value |
|---|---|
| Total pipeline | $25.0M |
| Won revenue | $5.4M |
| Win rate (all channels) | 33% |
| Marketing-sourced pipeline | $4.2M (16% of total) |
| Marketing-influenced pipeline | $6.3M (28% of total) |
| Total ad impressions | 135M |
| Total ad spend | $1.22M |
| Email engagements | 17,130 |
| Email click rate | 4.5% |
| Form fills / goal completions | 1,286 |
| Target accounts never reached | 3,256 (67.9%) |
| ML model accuracy | AUC = 0.807 |

---

## Tools Used

| Tool | Purpose |
|---|---|
| `pandas` | All data loading, cleaning, joining, and aggregation |
| `numpy` | Numeric operations, time-decay weighting |
| `scikit-learn` | Random Forest win probability model |
| `plotly` | Interactive charts in the HTML dashboard |
| `matplotlib` | Static charts embedded in the PowerPoint |
| `python-pptx` | PowerPoint generation (no manual slides) |
| `pyarrow` / `parquet` | Fast binary file format between pipeline stages |
| `openpyxl` | Reading raw Excel files |
