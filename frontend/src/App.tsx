import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Archive, ArrowRight, ArrowUpDown, Check, ChevronDown, CircleAlert, Download, ExternalLink,
  FileText, GitBranch, Info, Menu, Presentation, Printer, RotateCcw, Search, ShieldCheck,
  Sparkles, TrendingUp, X,
} from "lucide-react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChartMetadata, DashboardData, DataRow, SectionId } from "./types";
import { numberValue, REQUIRED_SECTION_IDS, textValue } from "./types";
import { AnimatedNavIndicator } from "./components/AceternityMotion";

gsap.registerPlugin(Flip, ScrollTrigger);

const ChartRenderer = lazy(() => import("./components/Charts").then((module) => ({ default: module.ChartRenderer })));

type SectionGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  children: Array<{ id: SectionId; label: string }>;
};

const groups: SectionGroup[] = [
  {
    id: "essential-group",
    label: "Essential View",
    icon: <Sparkles size={16} />,
    children: [
      { id: "s-essential", label: "Essential View" },
      { id: "s-exec", label: "Executive Summary" },
    ],
  },
  {
    id: "attrib-group",
    label: "Attribution",
    icon: <GitBranch size={16} />,
    children: [{ id: "s-attrib", label: "Attribution Analysis" }],
  },
  {
    id: "channel-group",
    label: "Channel ROI",
    icon: <TrendingUp size={16} />,
    children: [
      { id: "s-channel", label: "Channel Performance" },
      { id: "s-segment", label: "Segment & ICP" },
      { id: "s-creative", label: "Creative & Email" },
      { id: "s-budget", label: "Budget Measurement" },
      { id: "s-advanced", label: "Advanced Analytics" },
    ],
  },
  {
    id: "appendix-group",
    label: "Analyst Appendix",
    icon: <Archive size={16} />,
    children: [{ id: "s-appendix", label: "Case Deliverable Coverage" }],
  },
  {
    id: "recommendation-group",
    label: "Recommendation",
    icon: <Check size={16} />,
    children: [{ id: "s-conclusion", label: "Conclusion & Action Plan" }],
  },
];

const sectionOrder: SectionId[] = [
  "s-essential", "s-exec", "s-attrib", "s-channel", "s-segment",
  "s-creative", "s-budget", "s-advanced", "s-appendix", "s-conclusion",
];

const chartPlacementIds = [
  "c-essential-contribution", "c-essential-coverage", "c-essential-cohort",
  "c-bar-channel", "c-donut-won", "c-monthly-trend", "c-attrib-comparison",
  "c-sourced-influenced", "c-attrib-waterfall", "c-spend-pipeline", "c-funnel",
  "c-seg-heatmap", "c-seg-winrate", "c-creative-ctr", "c-creative-attr",
  "c-email-seniority", "c-budget-scenario", "c-feat-imp", "c-win-prob",
  "c-account-coverage", "c-deal-velocity", "c-journey", "c-targeting-matrix", "c-cohort",
];
const tableIds = ["essential_action_plan", "attribution_models", "channel_roi_summary", "decision_confidence", "recommended_actions", "case_deliverable_coverage"];

const copy: Record<SectionId, { title: string; description: string; takeaway: string }> = {
  "s-essential": {
    title: "Essential View",
    description: "A focused version for decision-makers: the answer, the few charts that support it, and the next actions.",
    takeaway: "Recommended path: protect pipeline quality, test coverage on unreached CRM account domains, and treat attribution as directional planning evidence.",
  },
  "s-exec": {
    title: "Executive Summary",
    description: "High-level pipeline, revenue, and channel overview for a B2B ABM company targeting specific accounts with 6sense display ads, email, and events.",
    takeaway: "Executive takeaway: The business has meaningful pipeline volume, but the strongest story is how marketing supports future revenue beyond direct source credit.",
  },
  "s-attrib": {
    title: "Attribution Analysis",
    description: "How descriptive models allocate credit across classified, pre-opportunity marketing touchpoints.",
    takeaway: "Attribution takeaway: Report source credit and linked-journey credit separately.",
  },
  "s-channel": {
    title: "Channel Performance",
    description: "ROI, win rate, and funnel conversion by marketing channel - the efficiency scorecard.",
    takeaway: "Channel takeaway: Relationship channels close best, while marketing channels build the net-new funnel that needs time to mature.",
  },
  "s-segment": {
    title: "Segment & ICP Analysis",
    description: "Which account segments and industries have the most pipeline and highest win rates - your best ABM targeting zones.",
    takeaway: "Segment takeaway: The best targeting decision balances revenue potential with win probability, not just the largest deal size.",
  },
  "s-creative": {
    title: "Creative & Email Performance",
    description: "Which ad creatives and email campaigns drive the highest engagement - tells you what messaging resonates with the account universe.",
    takeaway: "Creative takeaway: Creative performance is an efficiency lever: better messages improve account engagement before opportunities appear in CRM.",
  },
  "s-budget": {
    title: "Budget Measurement Plan",
    description: "Three budget-neutral operating plans that reserve spend for causal measurement instead of extrapolating unstable historical ROI.",
    takeaway: "Budget takeaway: Do not claim an optimal mix from two tracked-spend channels - one has a single opportunity and neither has recorded won revenue.",
  },
  "s-advanced": {
    title: "Advanced Analytics",
    description: "ML win probability model, account coverage gap, deal velocity, journey sequences, and targeting matrix - datathon-level depth.",
    takeaway: "Advanced takeaway: The predictive model and coverage analysis point to the same action: focus sales and marketing on high-fit accounts that are not yet fully activated.",
  },
  "s-appendix": {
    title: "Analyst Appendix",
    description: "Extra evidence is still available, but it is no longer part of the default judging path.",
    takeaway: "Use this section when challenged: it holds the supporting analysis behind the recommendation without making the opening dashboard feel crowded.",
  },
  "s-conclusion": {
    title: "Conclusion",
    description: "The practical readout: what the analysis says, what risks matter, and what the next actions should be.",
    takeaway: "Final takeaway: The recommendation is targeted, measured growth rather than blanket budget expansion.",
  },
};

const explain: Record<string, { title: string; body: ReactNode; insight: string }> = {
  "c-essential-contribution": {
    title: "What this shows - Marketing Contribution vs Total Pipeline",
    body: <>Sourced credit is the CRM origin field. Influenced credit captures classified email or 6sense presence in an eligible pre-opportunity journey. The two totals use different definitions and populations.<br /><br /><strong>Read the bars against total pipeline:</strong> sourced credit is conservative CRM origin; influenced credit is the linked subset of classified journeys. The influenced total is not a full-population or causal lift estimate.</>,
    insight: "Report both definitions with their populations: sourced is $4.2M, while linked influenced pipeline is $6.3M across 695 opportunities.",
  },
  "c-essential-coverage": {
    title: "What this shows - Account Coverage",
    body: <>The account view separates CRM account domains reached by email, 6sense, both, or neither. Opportunity rates are observational associations because coverage was not randomized.<br /><br /><strong>Read the two panels together:</strong> account volume shows the size of each audience; the rate panel shows observed opportunity rate with a 95% Wilson interval.</>,
    insight: "Use unreached strong-fit accounts as a test audience and validate lift with a holdout; reached-group differences may reflect selection or sales activity.",
  },
  "c-essential-cohort": {
    title: "What this shows - Pipeline Cohorts",
    body: <>Pipeline volume, closed-deal win rate, and resolved share must be read together. Recent cohorts with low resolved share are provisional rather than comparable to mature cohorts. The maturity gate is 80% resolved before using closed-deal win rate as an executive comparison.</>,
    insight: "Pipeline growth is not automatically healthy; protect win rate as volume grows and investigate the mature-cohort decline.",
  },
  "c-bar-channel": {
    title: "What this shows - Pipeline by Channel",
    body: <>Each bar is the total recorded amount of opportunities (won, lost, discontinued, and active) grouped by CRM lead-source category. Marketing categories are sourced credit; sales, referral, and existing-client categories provide context.<br /><br /><strong>Why “Other” and “Existing Client” are biggest:</strong> Most B2B deals come from existing-customer expansions or sales-led outreach — that is normal. Marketing’s role is to generate net-new pipeline through 6sense, email, web inbound, and events.</>,
    insight: "6Sense Channel ($1.5M) + Web Inbound ($1.1M) + Event ($678K) are the top net-new marketing channels by sourced pipeline. Use channel concentration to frame investigation, not a causal leaderboard.",
  },
  "c-donut-won": {
    title: "What this shows - Won Revenue by Channel",
    body: <>Of all deals that were actually <strong>closed and won</strong> (signed contracts, recorded revenue), this shows which channel sourced them. Only channels with won revenue appear.<br /><br /><strong>Why Existing Client often dominates:</strong> Upselling to existing customers is usually a higher-conversion motion because the relationship already exists. New-business marketing channels need time to mature.</>,
    insight: "Other ($2.5M won) and Existing Client ($1.2M won) are the largest recorded won-revenue channels. Judge marketing channels with pipeline maturity and conversion timing in view.",
  },
  "c-monthly-trend": {
    title: "What this shows - Pipeline Created by Month",
    body: <>Each colored band represents pipeline created in that month. The view keeps the five largest channels and groups the long tail into Other, so the total shape remains readable without a 12-series legend.<br /><br /><strong>How to use it:</strong> Look for spikes — did they follow a campaign launch? Look for drops — did a channel go quiet? This helps connect campaign activity to deal creation with a time lag.</>,
    insight: "Compare this chart to the campaign calendar. Spikes are useful leads for investigation, but the chart alone does not prove campaign lift.",
  },
  "c-attrib-comparison": {
    title: "What this shows - Attribution Model Comparison",
    body: <>This comparison isolates the common touchpoint-linked channels across first-touch, last-touch, linear, and time-decay models. Sourced and influenced totals are shown separately because they use different definitions and populations.<br /><br /><strong>How to read it:</strong> Compare the same channel across models. If a channel is taller in First-Touch than Last-Touch, it appears earlier in the observed journey; the reverse suggests later-stage presence. Source logs are normalized to one account-channel presence per ISO week before crediting, and blank-UTM web sessions are excluded rather than assumed to be marketing traffic.</>,
    insight: "Compare first-touch, last-touch, linear, and time-decay side by side. Differences show observed journey roles, not single-channel causality.",
  },
  "c-sourced-influenced": {
    title: "What this shows - Sourced vs. Influenced Pipeline",
    body: <>Two horizontal bars, two definitions of marketing contribution.<br /><br /><strong>Sourced:</strong> the CRM “Lead Source” field explicitly says the deal came from marketing — hard, conservative attribution.<br /><br /><strong>Influenced:</strong> a classified email or 6sense touch occurred within 365 days before opportunity creation, even if CRM source credit belongs elsewhere. The gap is a definition difference, not proof of hidden causal value. Sourced covers CRM origin; influenced covers the linked subset of classified journeys.</>,
    insight: "Report both definitions with their populations. Sourced is $4.2M; linked influenced pipeline is $6.3M across 695 opportunities. Neither is a causal lift estimate.",
  },
  "c-attrib-waterfall": {
    title: "What this shows - First-Touch vs. Last-Touch Credit Shift",
    body: <>This shows how much each channel’s credit changes when switching from First-Touch to Last-Touch. Teal bars gain later-stage credit; amber bars lose it.<br /><br /><strong>Why it matters:</strong> A channel that loses credit is an awareness signal — it starts the conversation but is less present at the decision point. A channel that gains credit is a conversion signal — it appears later in tracked journeys.</>,
    insight: "Channels that gain last-touch credit appear later in tracked journeys; channels that lose it appear earlier. Treat the pattern as a planning signal to test.",
  },
  "c-spend-pipeline": {
    title: "What this shows - Tracked-Spend ROI",
    body: <>Each point compares return multiples for channels with tracked spend. Pipeline ROI uses total pipeline; Revenue ROI counts only won revenue.<br /><br /><strong>Why only some channels appear:</strong> only channels with tracked ad spend show up. Referral and Existing Client have $0 media spend in this dataset. Longer distances from zero mean more recorded pipeline or won revenue per tracked-spend dollar.</>,
    insight: "Only 6sense_display and linkedin have tracked spend, so use this to choose where to investigate marginal spend — it is not a full marketing budget model.",
  },
  "c-funnel": {
    title: "What this shows - Channel Activity Volumes",
    body: <>This separates ad, email, web, and opportunity-outcome populations so unrelated events are not presented as one linear conversion path.<br /><br /><strong>How to read it:</strong> each group has its own denominator. Ad rows show impression/click progression; email rows show the composition of the supplied engagement-event log; opportunity rows summarize CRM outcomes. A log scale keeps very large and small counts readable together.</>,
    insight: "This view is safer for analysis because it avoids implying that email events, website sessions, and CRM opportunities are one sequential funnel.",
  },
  "c-seg-heatmap": {
    title: "What this shows - Pipeline Heatmap: Industry x Segment",
    body: <>Each cell is total recorded pipeline from accounts in that industry and CRM market segment. Darker blue means more pipeline concentration.<br /><br /><strong>How to use it:</strong> the darkest cells identify concentration worth investigating. Confirm positive-amount coverage and conversion quality before turning concentration into a targeting rule. Dollar values in each cell show absolute pipeline value — useful for prioritizing where to spend ABM budget and sales time.</>,
    insight: "Use the highest-concentration cells to frame tests, then qualify them with resolved-deal win rate and sample size.",
  },
  "c-seg-winrate": {
    title: "What this shows - Segment Tradeoff",
    body: <>Each bar is the closed-deal win rate for a CRM market segment, with a 95% Wilson interval.<br /><br /><strong>How to read it:</strong> the x-axis is won opportunities divided by resolved opportunities. Resolved-deal count and average recorded deal amount provide scale context. Prefer segments with a stable interval, adequate resolved volume, and meaningful positive deal amounts.</>,
    insight: "Use this as a market-segment baseline; the targeting matrix adds profile fit and explicit low-N flags.",
  },
  "c-creative-ctr": {
    title: "What this shows - High-Volume Creative CTR Within Platform",
    body: <>CTR (click-through rate) is clicks divided by impressions. If 1,000 people saw an ad and 5 clicked it, CTR is 0.5%. LinkedIn and 6sense are ranked separately because their delivery mechanics and baseline CTR differ; only ads with at least 10,000 impressions appear.<br /><br /><strong>What to do with this:</strong> use the top ads to brief visual style, message, and CTA patterns — then test before making them always-on.</>,
    insight: "Use the highest-CTR ads as the next creative brief, then test budget shifts before scaling.",
  },
  "c-creative-attr": {
    title: "What this shows - 6sense CTR by Recorded Copy Tone",
    body: <>This aggregates 6sense creative by copy-tone label and shows weighted CTR, impression volume, and distinct ad count.<br /><br /><strong>How to use it:</strong> most 6sense impressions have an Unknown tone, while labeled tones have much smaller samples. Improve creative metadata before making a portfolio-wide tone recommendation.</>,
    insight: "Treat labeled tone differences as test hypotheses; fixing metadata coverage is the first action.",
  },
  "c-email-seniority": {
    title: "What this shows - Email Engagement-Event Mix by Job Seniority",
    body: <>The supplied email file contains 17,130 engagement events across 5,557 people. It does not contain sent or delivered counts. Click-event share is click rows divided by all recorded engagement rows for the seniority group. This is event composition, not a send-based click rate.<br /><br /><strong>How to use it:</strong> treat a higher click-event share as a hypothesis for message relevance. Acquire delivery denominators before judging subject lines, true open rates, or true click-through rates.</>,
    insight: "The current log can rank engagement composition, but it cannot measure campaign reach or send-based effectiveness.",
  },
  "c-budget-scenario": {
    title: "What this shows - Budget-Neutral Measurement Allocation",
    body: <>Each stacked bar is one operating plan. The segments show activated media, holdout reserve, and experiment pool; totals remain equal.<br /><br /><strong>How to use it:</strong> choose the measurement intensity the team can execute cleanly. Pre-register the target population, outcome window, and primary metric before launch.<br /><br /><strong>Important caveat:</strong> no pipeline forecast is shown because available paid-channel outcomes are too sparse for defensible extrapolation. Scale only if treatment creates incremental qualified opportunities or pipeline while maintaining closed-deal win-rate quality.</>,
    insight: "The data supports a measurement plan, not an optimization claim.",
  },
  "c-feat-imp": {
    title: "What this shows - Win Probability: Top Predictors",
    body: <>A leakage-reduced Random Forest model was trained on resolved deals to prioritize active opportunities. Feature importance shows which opportunity-time fields the model relied on. AUC is 0.712 using a time-based 80/20 holdout with preprocessing fit on the train window (1.0 is perfect; 0.5 is random).<br /><br /><strong>Leakage policy:</strong> the model uses channel, CRM market segment, amount, and create-date features. Present-day account intent, contact counts, and current stage are excluded because they may post-date historical outcomes.</>,
    insight: "Use win probability for sales prioritization alongside stage, account context, and seller judgment. Treat channel and account signals as predictive patterns, not proof that any single marketing touch caused a win.",
  },
  "c-win-prob": {
    title: "What this shows - Active Opportunity Score Distribution",
    body: <>This histogram shows 447 active opportunities scored by the baseline model. Each bar is the number of active opportunities in that probability range. Deals on the right side are higher-priority follow-up candidates.<br /><br /><strong>How to use it:</strong> use the score as one prioritization input alongside deal stage, account context, and seller judgment. Do not set an operating cutoff until calibration and precision/recall are validated at the proposed threshold.</>,
    insight: "Pilot the ranking with sales, measure conversion by score band, and choose a threshold only after observed performance supports it.",
  },
  "c-account-coverage": {
    title: "What this shows - CRM Account Coverage",
    body: <>Of all 4,797 CRM account domains, this shows how many have been reached by email, 6sense, both, or neither. The rate panel shows the observed opportunity rate — the share of accounts in each group with at least one CRM deal.<br /><br /><strong>The critical finding:</strong> 3,256 account domains (67.9%) have never received a tracked marketing touch. Yet accounts reached by email alone have a 45.9% observed opportunity rate versus 17.5% for unreached accounts.<br /><br /><strong>What to do:</strong> prioritize strong-fit unreached domains and compare treatment with a holdout before interpreting higher reached-account rates as lift.</>,
    insight: "Coverage and opportunity creation are associated, but account selection and sales activity may explain part of the gap. Only a controlled test can estimate incremental lift.",
  },
  "c-deal-velocity": {
    title: "What this shows - Deal Velocity: How Fast Do Different Channels Close?",
    body: <>Median days from deal creation to close-won is shown by channel. Error bars show the middle 50% range, so the chart shows typical speed and variability.<br /><br /><strong>Why it matters:</strong> sales-cycle medians help planning only when the underlying channel has enough wins. This view suppresses channels with fewer than five won deals and shows the interquartile range to make variability visible.</>,
    insight: "Use this as a historical benchmark for established channels. Paid-channel samples are too small to support a speed or runway recommendation.",
  },
  "c-journey": {
    title: "What this shows - Winning Touchpoint Journey Sequences",
    body: <>For won deals that had tracked marketing touchpoints, this shows the most common channel paths in observed order. For example, “email_mqa → 6sense_display” means email was the first touch, then 6sense display followed.<br /><br />Common winning sequences are planning clues, not proof that the sequence caused the win.</>,
    insight: "Build this as a controlled playbook: when email engagement is detected, test 6sense frequency against a holdout and measure meeting, opportunity, and win-rate lift.",
  },
  "c-targeting-matrix": {
    title: "What this shows - ABM Targeting Priority Matrix",
    body: <>This win-rate heatmap crosses CRM segment (Enterprise, Commercial, and Mid) with 6sense profile fit (Strong, Moderate, and Weak). Every cell includes its deal count; cells below 30 resolved deals are explicitly exploratory.<br /><br /><strong>How to use it:</strong> prioritize cells with both a strong adjusted win rate and decision-grade evidence. Low-sample cells remain exploratory regardless of color.</>,
    insight: "Commercial + Strong Fit combines strong conversion with a large resolved sample. Enterprise + Strong Fit has greater deal potential but too little evidence for an allocation decision.",
  },
  "c-cohort": {
    title: "What this shows - Pipeline Cohort Analysis by Quarter",
    body: <>Blue bars show pipeline created each quarter. The quality panel shows closed-deal win rate and resolved share so newer cohorts are not treated as mature evidence. The resolved-share line explains why recent cohorts remain provisional until they cross the 80% maturity gate.</>,
    insight: "Among mature cohorts, closed-deal win rate moved from 38% in 2022Q1 to 22% in 2024Q2. Investigate whether the decline reflects ICP fit, qualification, or source mix; do not treat unresolved recent cohorts as equivalent to fully matured cohorts.",
  },
};

const money = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const metric = (data: DashboardData, key: string) => data.context.metrics[key] ?? "N/A";
const parseCount = (value: string) => Number(value.replaceAll(",", "")) || 0;

function interpolate(text: string, data: DashboardData) {
  return text.replace(/\{([^}]+)\}/g, (_, key: string) => metric(data, key));
}

function downloadRows(filename: string, rows: DataRow[]) {
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [keys, ...rows.map((row) => keys.map((key) => row[key] ?? ""))]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // Attach the link before clicking for Safari/WebView compatibility, then
  // defer revocation so the download consumer has time to read the blob.
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
}

function downloadEvidence(data: DashboardData) {
  // Export the validated source datasets plus every transformed chart/table
  // scope.  The type marker keeps the one-file export auditable while the
  // source marker shows exactly which contract a row came from.
  const datasetRows = (Object.entries(data.datasets) as Array<[string, DataRow[]]>).flatMap(([dataset, values]) => values.map((row) => ({ record_type: "dataset", source: dataset, ...row })));
  const chartRows = Object.entries(data.chart_data).flatMap(([chart, values]) => values.map((row) => ({ record_type: "chart", source: chart, ...row })));
  const tableRows = (Object.entries(data.tables) as Array<[string, { rows: DataRow[] }]>).flatMap(([table, contract]) => contract.rows.map((row) => ({ record_type: "table", source: table, ...row })));
  downloadRows("marketing-dashboard-evidence.csv", [...datasetRows, ...chartRows, ...tableRows]);
}

function formatContractCell(column: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.includes("($)") || column === "Avg Deal") return money(Number(value));
  if (column === "Closed Win Rate") return pct(Number(value));
  if (column.includes("ROI")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric !== 0 ? `${numeric.toFixed(1)}×` : "—";
  }
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return String(value);
}

function contractRows(table: { columns: string[]; rows: DataRow[] }): string[][] {
  return table.rows.map((row) => table.columns.map((column) => formatContractCell(column, row[column])));
}

function validatePayload(value: unknown): DashboardData {
  const payload = value as DashboardData;
  if (!payload || payload.schema_version !== 2) throw new Error("Dashboard data schema is not version 2.");
  if (!payload.context?.metrics || !payload.meta || !payload.datasets || !payload.chart_data || !Array.isArray(payload.chart_metadata) || !payload.tables || !payload.manifest) throw new Error("Dashboard data is missing its evidence contract.");
  const required = ["channel_pipeline", "cohorts", "coverage", "attribution", "attribution_coverage", "attribution_sensitivity", "quality", "feature_importance", "model_stats", "model_calibration", "budget_scenarios", "targeting", "monthly_pipeline", "funnel_metrics", "segment_industry", "segment_win_rate", "creative_ctr", "creative_tone", "email_seniority", "deal_velocity", "journey_sequences", "win_probability", "account_coverage_detail", "attribution_touchpoint_quality", "qa_performance"];
  const datasets = payload.datasets as unknown as Record<string, unknown>;
  const missing = required.filter((key) => !Array.isArray(datasets[key]));
  if (missing.length) throw new Error(`Dashboard data is missing datasets: ${missing.join(", ")}`);
  const metadataIds = payload.chart_metadata.map((item) => item.chart_id);
  if (metadataIds.length !== chartPlacementIds.length || chartPlacementIds.some((id) => !metadataIds.includes(id))) throw new Error("Dashboard chart metadata does not match the 24-placement preservation contract.");
  const metadataErrors = payload.chart_metadata.filter((item) => !item.title || !item.subtitle || !item.source_dataset || !item.caveat || !item.accessible_summary || !Array.isArray(item.fields) || !item.fields.length);
  if (metadataErrors.length) throw new Error(`Dashboard chart metadata is incomplete: ${metadataErrors.map((item) => item.chart_id).join(", ")}`);
  const chartData = payload.chart_data as Record<string, unknown>;
  const unknownChartData = Object.keys(chartData).filter((id) => !chartPlacementIds.includes(id));
  if (unknownChartData.length) throw new Error(`Dashboard chart data contains unknown placements: ${unknownChartData.join(", ")}`);
  const metadataScopeErrors = payload.chart_metadata.filter((item) => !(REQUIRED_SECTION_IDS as string[]).includes(item.section_id) || !Array.isArray(datasets[item.source_dataset]));
  if (metadataScopeErrors.length) throw new Error(`Dashboard chart metadata references an invalid section or dataset: ${metadataScopeErrors.map((item) => item.chart_id).join(", ")}`);
  const missingChartData = chartPlacementIds.filter((id) => !Array.isArray(chartData[id]));
  if (missingChartData.length) throw new Error(`Dashboard chart data is missing placements: ${missingChartData.join(", ")}`);
  const emptyChartData = chartPlacementIds.filter((id) => !(chartData[id] as unknown[]).length);
  if (emptyChartData.length) throw new Error(`Dashboard chart data contains empty placements: ${emptyChartData.join(", ")}`);
  if (payload.manifest.chart_placement_count !== chartPlacementIds.length || payload.manifest.distinct_chart_count !== 21 || payload.manifest.section_ids.length !== REQUIRED_SECTION_IDS.length || payload.manifest.table_count !== tableIds.length) throw new Error("Dashboard preservation manifest is incomplete.");
  const incompleteTables = tableIds.filter((id) => {
    const table = payload.tables[id as keyof typeof payload.tables];
    return !table?.columns?.length || !Array.isArray(table.rows) || !Array.isArray(table.source_datasets) || typeof table.sortable !== "boolean" || table.rows.some((row) => table.columns.some((column) => !(column in row)));
  });
  if (incompleteTables.length) throw new Error(`Dashboard table contract is incomplete: ${incompleteTables.join(", ")}`);
  return payload;
}

function DataTable({ rows, label, id }: { rows: DataRow[]; label: string; id: string }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 9);
  const sorted = sort
    ? [...rows].sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), undefined, { numeric: true }) * sort.direction)
    : rows;
  if (!rows.length) return <div className="data-table-empty">No rows are available for this chart scope.</div>;
  return <div className="data-table-wrap" id={id}>
    <div className="data-table-top"><span>{label}</span><button type="button" className="text-button" onClick={() => downloadRows(`${label.toLowerCase().replaceAll(" ", "-")}.csv`, rows)}><Download size={14} /> CSV</button></div>
    <div className="table-scroll"><table className="data-table"><caption className="sr-only">{label}</caption><thead><tr>{keys.map((key) => { const active = sort?.key === key; return <th key={key} scope="col" aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}><button type="button" onClick={() => setSort((current) => ({ key, direction: current?.key === key ? (current.direction * -1 as 1 | -1) : 1 }))}>{key.replaceAll("_", " ")} <ChevronDown size={12} aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{sorted.map((row, index) => <tr key={`${String(row[keys[0]])}-${index}`}>{keys.map((key) => <td key={key}>{String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div>
  </div>;
}

function ChartCard({ id, metadata, data, totalPipeline, coverageMix, presenting }: { id: string; metadata?: ChartMetadata; data: DashboardData; totalPipeline: number; coverageMix: DataRow[]; presenting: boolean }) {
  const [details, setDetails] = useState(false);
  const [table, setTable] = useState(false);
  const info = explain[id];
  const title = metadata?.title ?? info?.title ?? id;
  const subtitle = metadata?.subtitle ?? "Source-backed evidence";
  const source = metadata?.source_dataset as keyof DashboardData["datasets"] | undefined;
  const chartRows = data.chart_data?.[id] ?? (source ? data.datasets[source] : []);
  const summaryId = `${id}-summary`;
  const tableId = `${id}-data`;
  return <article className="chart-card" data-chart-id={id} data-reveal aria-labelledby={`${id}-title`}>
    <div className="chart-heading"><div><h3 id={`${id}-title`}>{title}</h3><p id={`${id}-subtitle`}>{subtitle}</p></div><div className="chart-actions"><button type="button" className="icon-button" title="View chart data" aria-label={`View data for ${title}`} aria-expanded={table} aria-controls={tableId} onClick={() => setTable((value) => !value)}><FileText size={15} /></button><button type="button" className="icon-button" title="Download chart data" aria-label={`Download data for ${title}`} onClick={() => downloadRows(`${id}.csv`, chartRows)}><Download size={15} /></button></div></div>
    <div className="chart-visual" role="img" aria-labelledby={`${id}-title ${id}-subtitle`} aria-describedby={summaryId}><Suspense fallback={<div className="chart-empty" role="status">Loading visual…</div>}><ChartRenderer id={id} data={data.datasets} totalPipeline={totalPipeline} coverageMix={coverageMix} /></Suspense></div>
    <p id={summaryId} className="chart-accessible-summary">{metadata?.accessible_summary}</p>
    {metadata?.caveat && <p className="chart-caveat chart-caveat-visible"><CircleAlert size={14} /><span>{metadata.caveat}</span></p>}
    {info && <div className="chart-explanation"><div className="explanation-row"><strong>{info.title}</strong><button type="button" className="text-button" aria-expanded={details} onClick={() => setDetails((value) => !value)}>{details ? "Hide details" : "How to read"}<ChevronDown className={details ? "rotate" : ""} size={14} /></button></div>{details && <div className="explanation-body"><p>{info.body}</p><div className="insight"><Sparkles size={14} />{interpolate(info.insight, data)}</div></div>}</div>}
    {table && <DataTable id={tableId} rows={chartRows} label={`${title} data`} />}
    {presenting && <span className="presentation-mark" aria-hidden="true">Evidence</span>}
  </article>;
}

function SectionIntro({ id, data }: { id: SectionId; data: DashboardData }) {
  const item = copy[id];
  const takeaway = interpolate(item.takeaway, data);
  const [label, ...rest] = takeaway.split(":");
  return <><div className="section-heading"><h2>{item.title}</h2><p>{item.description}</p></div><div className="section-takeaway"><div className="takeaway-copy"><strong>{label}:</strong><span>{rest.join(":")}</span></div><div className="evidence-chips"><span className="chip chip-blue">{metric(data, "marketing_influenced_pipeline")} influenced</span><span className="chip chip-amber">{metric(data, "unreached_pct")} unreached</span><span className="chip chip-red">{metric(data, "cohort_start_win_rate")} → {metric(data, "cohort_end_win_rate")} mature win rate</span></div></div></>;
}

function ContextBox({ children }: { children: ReactNode }) { return <div className="context-box"><Info size={16} aria-hidden="true" /><div>{children}</div></div>; }

function EvidenceGrid({ items }: { items: Array<{ label: string; title?: string; body: ReactNode; tone: "high" | "medium" | "directional" }> }) {
  return <div className="evidence-grid">{items.map((item) => <article className="evidence-card" key={`${item.label}-${item.title ?? "label-only"}`}>{item.title ? <><span className={`confidence ${item.tone}`}>{item.label}</span><h3>{item.title}</h3></> : <h3 className="evidence-label-only"><span className={`confidence ${item.tone}`}>{item.label}</span></h3>}<p>{item.body}</p></article>)}</div>;
}

function AttributionSensitivityPanel({ data }: { data: DashboardData }) {
  const rows = [...data.datasets.attribution_sensitivity].sort((a, b) => numberValue(a, "lookback_days") - numberValue(b, "lookback_days"));
  if (!rows.length) return null;
  return <section className="method-panel" aria-labelledby="lookback-sensitivity-title">
    <div className="method-panel-head"><div><span className="panel-eyebrow">Robustness check</span><h3 id="lookback-sensitivity-title">Attribution lookback sensitivity</h3></div><span className="panel-note">Primary view: 365 days</span></div>
    <p className="method-panel-copy">Shorter windows link fewer CRM opportunities and won deals. The ranking is therefore a scope-sensitive planning signal, not a stable incrementality estimate.</p>
    <div className="method-metrics">{rows.map((row) => <div className={`method-metric${numberValue(row, "lookback_days") === 365 ? " is-primary" : ""}`} key={String(row.lookback_days)}><span>{numberValue(row, "lookback_days")} days</span><strong>{numberValue(row, "linked_opportunities").toLocaleString()}</strong><small>linked opps · {pct(numberValue(row, "linked_share_of_won_opportunities"))} of won deals</small></div>)}</div>
  </section>;
}

function CalibrationPanel({ data }: { data: DashboardData }) {
  const rows = data.datasets.model_calibration;
  if (!rows.length) return null;
  return <section className="method-panel calibration-panel" aria-labelledby="calibration-title">
    <div className="method-panel-head"><div><span className="panel-eyebrow">Model diagnostic</span><h3 id="calibration-title">Predicted vs observed win rate</h3></div><span className="panel-note">Time-based test holdout</span></div>
    <p className="method-panel-copy">The highest score band is directionally aligned; middle bands overpredict observed wins. Use scores to prioritize review, not as a promise of close probability.</p>
    <div className="calibration-rows" role="table" aria-label="Model calibration by test score band"><div className="calibration-head" role="row"><span role="columnheader">Score band</span><span role="columnheader">n</span><span role="columnheader">Predicted</span><span role="columnheader">Observed</span><span role="columnheader">Gap</span></div>{rows.map((row) => <div className="calibration-row" role="row" key={textValue(row, "score_band")}><span role="cell">{textValue(row, "score_band")}</span><span role="cell">{numberValue(row, "n").toLocaleString()}</span><span role="cell">{pct(numberValue(row, "predicted_win_rate"))}</span><span role="cell">{pct(numberValue(row, "observed_win_rate"))}</span><span role="cell" className={numberValue(row, "abs_gap") > 0.1 ? "gap-high" : ""}>{pct(numberValue(row, "abs_gap"))}</span></div>)}</div>
  </section>;
}

function PriorityGrid({ data }: { data: DashboardData }) {
  return <aside className="action-queue" aria-label="Recommended action queue">
    <div className="action-queue-head"><div><h3>Three decisions to move now</h3><span>Operating queue</span></div><strong>3</strong></div>
    <article className="action-row"><span className="action-sequence">01</span><div><span className="priority-tag red">Do first</span><h4>Audit pipeline quality</h4><p>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}. Tighten ICP and qualification before increasing broad spend.</p></div></article>
    <article className="action-row"><span className="action-sequence">02</span><div><span className="priority-tag amber">Test opportunity</span><h4>Reach unreached accounts</h4><p>{metric(data, "unreached_accounts")} CRM account domains, or {metric(data, "unreached_pct")}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and use a holdout.</p></div></article>
    <article className="action-row"><span className="action-sequence">03</span><div><span className="priority-tag">Budget lens</span><h4>Fund measurement first</h4><p>Use a budget-neutral holdout and experiment reserve. Do not optimize from two paid channels with insufficient won outcomes.</p></div></article>
  </aside>;
}

function QualityTape({ data }: { data: DashboardData }) {
  const metrics = data.context.metrics;
  return <section className="quality-tape" aria-label="Evidence quality status">
    <div className="quality-tape-head"><span>Evidence quality</span><strong>Decision constraints</strong></div>
    <div className="quality-tape-grid">
      <div><span>Domain match</span><strong>{metrics.domain_match_rate}</strong><Progress value={parseFloat(metrics.domain_match_rate) || 0} tone="teal" /></div>
      <div><span>Missing create dates</span><strong>{metrics.missing_create_dates}</strong><Progress value={0} tone="teal" /></div>
      <div><span>Won deals at $0</span><strong>{metrics.zero_amount_won_share}</strong><Progress value={parseFloat(metrics.zero_amount_won_share) || 0} tone="amber" /></div>
      <div><span>Unknown channel</span><strong>{metrics.unknown_channel_pct}</strong><Progress value={parseFloat(metrics.unknown_channel_pct) || 0} tone="amber" /></div>
      <div><span>Linked wins</span><strong>{metrics.attribution_linked_won_share}</strong><Progress value={parseFloat(metrics.attribution_linked_won_share) || 0} tone="red" /></div>
    </div>
  </section>;
}

function StoryStrip({ data }: { data: DashboardData }) {
  return <section className="story-strip" aria-label="Decision story framing">
    <div><strong>Influence is visible, but coverage is limited</strong><span><b>{metric(data, "marketing_influenced_pipeline")} influenced</b> is based on {metric(data, "linked_opportunities")} linked opportunities and only {metric(data, "attribution_linked_won_share")} of won deals.</span></div>
    <ArrowRight size={15} aria-hidden="true" />
    <div><strong>Coverage is the clearest test opportunity</strong><span><b>{metric(data, "unreached_pct")} unreached</b> CRM account domains define a measurable test audience, not guaranteed lift.</span></div>
    <ArrowRight size={15} aria-hidden="true" />
    <div><strong>Pipeline quality needs executive attention</strong><span><b>{metric(data, "cohort_start_win_rate")} → {metric(data, "cohort_end_win_rate")} closed win rate</b> among mature cohorts means pipeline growth must be checked against conversion quality.</span></div>
  </section>;
}

interface SectionProps { data: DashboardData; metadata: Map<string, ChartMetadata>; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; resetToken: number; }

function ChartGrid({ ids, data, presenting, totalPipeline, coverageMix, metadata, resetToken, className = "" }: { ids: string[]; data: DashboardData; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; metadata: Map<string, ChartMetadata>; resetToken: number; className?: string }) {
  return <div className={`chart-grid ${ids.length === 1 ? "single" : ids.length === 2 ? "two" : ""} ${className}`.trim()}>{ids.map((id) => <ChartCard key={`${id}-${resetToken}`} id={id} metadata={metadata.get(id)} data={data} totalPipeline={totalPipeline} coverageMix={coverageMix} presenting={presenting} />)}</div>;
}

function EvidenceTable({ title, columns, rows, note }: { title: string; columns: string[]; rows: string[][]; note?: ReactNode }) {
  const [sort, setSort] = useState<{ index: number; direction: 1 | -1 } | null>(null);
  const sortedRows = sort
    ? [...rows].sort((left, right) => String(left[sort.index] ?? "").localeCompare(String(right[sort.index] ?? ""), undefined, { numeric: true }) * sort.direction)
    : rows;
  return <article className="evidence-table-card"><div className="table-heading"><div><h3>{title}</h3>{note && <p className="table-note">{note}</p>}</div><span>{rows.length} rows · sortable</span></div><div className="table-scroll"><table className="evidence-table"><caption className="sr-only">{title}</caption><thead><tr>{columns.map((column, index) => { const active = sort?.index === index; return <th scope="col" key={column} aria-sort={active ? (sort?.direction === 1 ? "ascending" : "descending") : "none"}><button type="button" className="sort-button" onClick={() => setSort((current) => ({ index, direction: current?.index === index ? (current.direction * -1 as 1 | -1) : 1 }))}>{column}<ArrowUpDown size={11} aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{sortedRows.map((row, rowIndex) => <tr key={`${title}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div></article>;
}

function AttributionTable({ data }: { data: DashboardData }) {
  const table = data.tables.attribution_models;
  return <EvidenceTable title="Full Attribution Table - All Models Side by Side" note="Every channel across every model in one place. The last column identifies the largest-credit model descriptively; it is not a model recommendation." columns={table.columns} rows={contractRows(table)} />;
}

function EssentialSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  const chartProps = { data, presenting, totalPipeline, coverageMix };
  return <section id="s-essential" className="dashboard-section essential-section"><SectionIntro id="s-essential" data={data} />
    <div className="command-canvas">
      <div className="command-evidence">
        <div className="command-chart-pair">
          <ChartCard key={`c-essential-contribution-${resetToken}`} id="c-essential-contribution" metadata={metadata.get("c-essential-contribution")} {...chartProps} />
          <ChartCard key={`c-essential-cohort-${resetToken}`} id="c-essential-cohort" metadata={metadata.get("c-essential-cohort")} {...chartProps} />
        </div>
        <ChartCard key={`c-essential-coverage-${resetToken}`} id="c-essential-coverage" metadata={metadata.get("c-essential-coverage")} {...chartProps} />
      </div>
      <div className="command-rail"><PriorityGrid data={data} /><QualityTape data={data} /></div>
    </div>
    <EvidenceTable title="Essential Action Plan" columns={data.tables.essential_action_plan.columns} rows={contractRows(data.tables.essential_action_plan)} />
    <div className="scope-row" aria-label="Essential view drilldown"><span><strong>Scope</strong> only 3 charts are shown here by design</span><span>Deeper views are in the appendix</span><span>Caveats remain available from the top bar</span></div>
  </section>;
}

function ExecutiveSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-exec" className="dashboard-section"><SectionIntro id="s-exec" data={data} /><ContextBox><strong>How to read this dashboard:</strong> This company uses Account-Based Marketing (ABM) — instead of advertising to everyone, it coordinates campaigns around a defined account universe. A deal is born when an account agrees to a sales conversation and eventually signs a contract. The dashboard answers: <em>which marketing activities appeared in the path to those deals?</em></ContextBox><ChartGrid ids={["c-bar-channel", "c-donut-won", "c-monthly-trend"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AttributionSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-attrib" className="dashboard-section"><SectionIntro id="s-attrib" data={data} /><ContextBox><strong>The core concept:</strong> For the subset of opportunities with classified marketing touches, attribution models answer: <em>how would observed pipeline credit move under different allocation rules?</em> They do not estimate incremental lift.<br /><br />We link marketing touchpoints to opportunities within a 365-day lookback window before deal creation. Sourced, Influenced, First-Touch, Last-Touch, Linear, and Time-Decay remain separate definitions.</ContextBox><EvidenceGrid items={[{ label: "Proves", title: "Marketing has measurable pipeline presence", body: <>Sourced credit reconciles to the full CRM source view; influenced credit reconciles within the linked opportunity population. Report both only with their populations.</>, tone: "high" }, { label: "Suggests", title: "Channels play different journey roles", body: <>First-touch, last-touch, linear, and time-decay views show whether a channel starts, assists, or closes account journeys.</>, tone: "medium" }, { label: "Does not prove", title: "Single-touch causality", body: <>A touchpoint receiving credit means it appeared in the pre-opportunity path; it does not mean it alone caused the deal.</>, tone: "directional" }]} /><AttributionSensitivityPanel data={data} /><ChartGrid ids={["c-attrib-comparison", "c-sourced-influenced", "c-attrib-waterfall"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><AttributionTable data={data} /></section>;
}

function ChannelSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  const table = data.tables.channel_roi_summary;
  const rows = contractRows(table);
  return <section id="s-channel" className="dashboard-section"><SectionIntro id="s-channel" data={data} /><ContextBox><strong>What “ROI” means here:</strong> Pipeline ROI = CRM-sourced pipeline associated with a channel / tracked ad spend. Revenue ROI uses recorded won amount. These are observational efficiency ratios, and recorded revenue is understated because many won deals have zero amount. <strong>Avg Deal</strong> is the mean recorded amount among opportunities with a populated amount.</ContextBox><EvidenceGrid items={[{ label: "Strong signal", title: "Relationship channels convert best", body: <>Existing client and referral performance explains why revenue is not only a paid-media story.</>, tone: "high" }, { label: "Efficiency signal", title: "Marketing builds future pipeline", body: <>Net-new channels should be judged by pipeline creation, later win conversion, and time-to-close together.</>, tone: "medium" }, { label: "Next test", title: "Separate quality from volume", body: <>Track whether added channel spend creates qualified opportunities, not just more opportunities.</>, tone: "directional" }]} /><ChartGrid ids={["c-spend-pipeline", "c-funnel"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><EvidenceTable title="Channel ROI Summary Table" note="Pipeline ROI = total pipeline / spend. Revenue ROI = won revenue / spend. Channels with no spend tracked show — (they rely on sales effort, not ad budget)." columns={table.columns} rows={rows} /></section>;
}

function SegmentSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-segment" className="dashboard-section"><SectionIntro id="s-segment" data={data} /><ContextBox><strong>What is a “Segment” here?</strong> The CRM segment field groups opportunities into Commercial, Mid, and Enterprise markets. It is not a 6sense buying-stage label. Profile fit is analyzed separately, and win rates use resolved opportunities only.</ContextBox><ChartGrid className="segment-grid" ids={["c-seg-heatmap", "c-seg-winrate"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function CreativeSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-creative" className="dashboard-section"><SectionIntro id="s-creative" data={data} /><ContextBox><strong>Why creative matters in ABM:</strong> Ads are shown specifically to people at the account universe. If creative is bad, prospects tune it out; if it is good, it builds recognition before sales calls. CTR is the primary display-creative effectiveness measure.<br /><br /><strong>Email Event Mix:</strong> The supplied email file contains engagement events across {metric(data, "email_people")} people, but no sent or delivered counts. Event composition can guide hypotheses; it cannot support send-based open or click-rate claims.</ContextBox><ChartGrid ids={["c-creative-ctr", "c-creative-attr", "c-email-seniority"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function BudgetSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-budget" className="dashboard-section"><SectionIntro id="s-budget" data={data} /><ContextBox><strong>How the plan works:</strong> Every scenario preserves the current tracked budget. The alternatives reserve part of that budget for a randomized or phased holdout and a pre-registered experiment pool.<br /><br /><strong>Three plans:</strong> Status Quo activates all tracked spend; 10% Holdout reserves 10%; Measurement First activates 80%, reserves 10% as holdout, and creates a 10% experiment pool.</ContextBox><ChartGrid ids={["c-budget-scenario"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AdvancedSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-advanced" className="dashboard-section"><SectionIntro id="s-advanced" data={data} /><ContextBox><strong>What makes this section different:</strong> Standard marketing analytics tells you what happened. This section adds prioritization signals for where to focus. The leakage-reduced baseline scores {metric(data, "active_scored_opportunities")} active opportunities with AUC {metric(data, "model_auc")} using {metric(data, "model_validation")}.</ContextBox><EvidenceGrid items={[{ label: "Observed gap", title: "Reached tiers show higher observed rates", body: <>Unreached accounts show a {metric(data, "not_reached_opportunity_rate")} opportunity rate, while email-only accounts show {metric(data, "email_only_opportunity_rate")} and both-channel accounts show {metric(data, "both_channels_opportunity_rate")}.</>, tone: "high" }, { label: "Quality diagnosis", title: "Growth is not automatically healthy", body: <>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} in {metric(data, "cohort_start_quarter")} to {metric(data, "cohort_end_win_rate")} in {metric(data, "cohort_end_quarter")}.</>, tone: "medium" }, { label: "Next test", title: "Validate causality", body: <>Run a holdout or phased rollout so the team can measure incremental lift from email-first outreach and a tested 6sense overlay.</>, tone: "directional" }]} /><CalibrationPanel data={data} /><ChartGrid ids={["c-feat-imp", "c-win-prob", "c-account-coverage", "c-deal-velocity", "c-journey", "c-targeting-matrix", "c-cohort"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AppendixSection({ data, onOpen }: { data: DashboardData; onOpen: (id: SectionId) => void }) {
  const cards: Array<{ id: SectionId; label: string; title: string; body: string }> = [
    { id: "s-exec", label: "Overview", title: "Executive Summary", body: "Top-line pipeline, won revenue, and monthly trend views." },
    { id: "s-segment", label: "Targeting", title: "Segment & ICP", body: "Segment, industry, and ICP evidence for account prioritization." },
    { id: "s-creative", label: "Engagement", title: "Creative & Email", body: "Creative CTR and email engagement detail for messaging decisions." },
    { id: "s-budget", label: "Planning", title: "Budget Scenarios", body: "Tracked-spend scenarios for sizing controlled budget tests." },
    { id: "s-advanced", label: "Modeling", title: "Advanced Analytics", body: "Win probability, deal velocity, journey, and targeting matrix detail." },
  ];
  return <section id="s-appendix" className="dashboard-section"><SectionIntro id="s-appendix" data={data} /><div className="appendix-grid">{cards.map((card) => <article className="appendix-card" key={card.id}><span className="priority-tag">{card.label}</span><h3>{card.title}</h3><p>{card.body}</p><button type="button" className="button button-small" onClick={() => onOpen(card.id)}>Open evidence <ArrowRight size={14} /></button></article>)}</div><EvidenceTable title="Case Deliverable Coverage" columns={data.tables.case_deliverable_coverage.columns} rows={contractRows(data.tables.case_deliverable_coverage)} /></section>;
}

function ConclusionSection({ data }: { data: DashboardData }) {
  const confidenceTable = data.tables.decision_confidence;
  const actionsTable = data.tables.recommended_actions;
  return <section id="s-conclusion" className="dashboard-section conclusion-section"><SectionIntro id="s-conclusion" data={data} /><div className="conclusion-hero"><span className="hero-label">Bottom-line recommendation</span><h3>Reach the right unreached accounts, start with email, test 6sense overlay with a holdout, and protect win rate as pipeline grows.</h3><p>Marketing is not just a source channel. It influenced {metric(data, "marketing_influenced_pipeline")} of pipeline, while {metric(data, "unreached_accounts")} CRM account domains ({metric(data, "unreached_pct")}) provide a large, measurable audience for a controlled coverage test.</p></div><ContextBox><strong>How to read this conclusion:</strong> The conclusion combines three signals: attribution tells us where marketing contributes, coverage tells us where growth is still available, and cohort analysis tells us whether pipeline quality is improving or declining.<br /><br /><strong>Key takeaway:</strong> The best recommendation is not “spend more everywhere.” It is to reach the right unreached accounts, test channel overlays carefully, and protect win rate as pipeline grows.</ContextBox><div className="conclusion-grid"><article className="conclusion-card"><h3>What is working</h3><ul><li>Relationship-led channels remain the strongest won-revenue base.</li><li>Touchpoint attribution shows different channels appearing at different journey stages.</li><li>The win model is useful as a prioritization signal: AUC is {metric(data, "model_auc")} using {metric(data, "model_validation")}.</li></ul></article><article className="conclusion-card"><h3>What is at risk</h3><ul><li>Among mature cohorts, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}.</li><li>Marketing-sourced share was {metric(data, "latest_mature_marketing_sourced_share")} in the latest cohort meeting the maturity threshold.</li><li>Most CRM account domains are unreached, limiting ABM learning and leaving pipeline potential untouched.</li></ul></article><article className="conclusion-card"><h3>What to do next</h3><ul><li>Expand coverage to unreached strong-fit accounts before increasing broad demand-generation spend.</li><li>Test 6sense display after email engagement, using a holdout to prove whether the overlay creates lift.</li><li>Review ICP and qualification each quarter until win rate stabilizes.</li></ul></article></div><div className="priority-grid conclusion-priorities"><article className="priority-card"><h3><span className="priority-tag red">P1</span> Fix coverage and quality first</h3><p>Activate unreached CRM account domains and tighten ICP qualification before chasing more broad top-of-funnel volume.</p></article><article className="priority-card"><h3><span className="priority-tag amber">P2</span> Operationalize the evidence</h3><p>Report sourced plus influenced metrics together, and use win probability bands in weekly sales reviews.</p></article><article className="priority-card"><h3><span className="priority-tag">P3</span> Improve message efficiency</h3><p>Scale creative patterns that earn engagement and retire ads that do not move accounts forward.</p></article></div><EvidenceTable title="Decision Confidence" note="This separates what the data directly supports from what should be treated as a testable business hypothesis." columns={confidenceTable.columns} rows={contractRows(confidenceTable)} /><EvidenceGrid items={[{ label: "Direct observations", body: <>Pipeline, won revenue, marketing-sourced pipeline, marketing-influenced pipeline, account coverage gaps, and cohort win-rate movement are directly measurable.</>, tone: "high" }, { label: "What the data suggests", body: <>Email coverage is the strongest observed reach signal in this dataset, and 6sense overlay should be tested with a holdout.</>, tone: "medium" }, { label: "What needs testing", body: <>Causality and budget scaling need experiments, holdouts, or phased rollouts before making large spend commitments.</>, tone: "directional" }]} /><EvidenceTable title="Recommended Action Plan" note="Each row connects the dashboard evidence to a business action, so the analysis can be defended in a presentation." columns={actionsTable.columns} rows={contractRows(actionsTable)} /><div className="presenting-script"><h3>How to Present the Conclusion</h3><div><strong>1. Start with contribution</strong><span>Marketing created measurable pipeline directly, but the stronger story is influence across the account journey.</span></div><div><strong>2. Name the tension</strong><span>The business is creating more pipeline, but lower recent win rates mean growth is not automatically healthy.</span></div><div><strong>3. Recommend the move</strong><span>Prioritize strong-fit account coverage, lead with email, and test 6sense overlay with a holdout before simply adding budget.</span></div><div><strong>4. State confidence</strong><span>Coverage expansion and ICP tightening are high-confidence recommendations; budget scaling is directional and should be tested in phases.</span></div></div></section>;
}

function Progress({ value, tone }: { value: number; tone: string }) { return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={`progress-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }

function App() {
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const caveatsTrigger = useRef<HTMLButtonElement>(null);
  const caveatsClose = useRef<HTMLButtonElement>(null);
  const caveatsWasOpen = useRef(false);
  const routeHasRendered = useRef(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<SectionId>("s-essential");
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenting, setPresenting] = useState(() => localStorage.getItem("dashboardMode") === "presentation");
  const [search, setSearch] = useState("");
  const [caveatsOpen, setCaveatsOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [printAll, setPrintAll] = useState(false);

  useEffect(() => {
    fetch("./dashboard-data.json")
      .then((response) => { if (!response.ok) throw new Error(`Dashboard data returned ${response.status}`); return response.json(); })
      .then((payload) => setData(validatePayload(payload)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard data"));
  }, []);

  useEffect(() => {
    const syncRoute = () => { const hash = window.location.hash.replace(/^#/, "") as SectionId; if (REQUIRED_SECTION_IDS.includes(hash)) { setActive(hash); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" })); } };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => { window.removeEventListener("hashchange", syncRoute); window.removeEventListener("popstate", syncRoute); };
  }, []);

  // Hash navigation can run before the asynchronous evidence contract has
  // rendered the active section. Re-assert the command-console top position
  // after the payload/route render so deep links never open with the decision
  // header clipped above the viewport. Subsequent view changes retain the
  // dashboard's smooth transition.
  useEffect(() => {
    if (!data) return;
    const initialRoute = !routeHasRendered.current;
    routeHasRendered.current = true;
    const behavior = initialRoute || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior }));
    return () => window.cancelAnimationFrame(frame);
  }, [data, active]);

  useEffect(() => {
    if (!data || !root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = Array.from(root.current.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) { ScrollTrigger.refresh(); return; }
    const ctx = gsap.context(() => { gsap.fromTo(targets, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: "power2.out" }); ScrollTrigger.refresh(); }, root);
    return () => ctx.revert();
  }, [data, active]);

  useEffect(() => { document.body.classList.toggle("presentation-mode", presenting); localStorage.setItem("dashboardMode", presenting ? "presentation" : "analyst"); window.setTimeout(() => ScrollTrigger.refresh(), 200); }, [presenting]);
  useEffect(() => {
    if (!menuOpen) {
      // The trigger lives inside #main-content, which is inert while the
      // drawer is open.  Restore focus on the next frame, after the inert
      // attribute has been removed by the overlay effect.
      if (menuWasOpen.current) window.requestAnimationFrame(() => menuButton.current?.focus());
      menuWasOpen.current = false;
      return;
    }
    menuWasOpen.current = true;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus(); return; }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("#dashboard-navigation");
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  useEffect(() => {
    if (!caveatsOpen) {
      if (caveatsWasOpen.current) window.requestAnimationFrame(() => caveatsTrigger.current?.focus());
      caveatsWasOpen.current = false;
      return;
    }
    caveatsWasOpen.current = true;
    caveatsClose.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setCaveatsOpen(false); return; }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".caveats-drawer");
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [caveatsOpen]);
  useEffect(() => {
    document.body.style.overflow = menuOpen || caveatsOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, caveatsOpen]);
  useEffect(() => {
    // Keep the rest of the application out of the accessibility tree while
    // an overlay is active.  Focus trapping prevents keyboard escape, while
    // inert/aria-hidden also blocks programmatic and screen-reader traversal.
    const main = document.querySelector<HTMLElement>("#main-content");
    const sidebar = document.querySelector<HTMLElement>("#dashboard-navigation");
    const setInert = (node: HTMLElement | null, active: boolean) => {
      if (!node) return;
      if (active) {
        node.setAttribute("inert", "");
        node.setAttribute("aria-hidden", "true");
      } else {
        node.removeAttribute("inert");
        node.removeAttribute("aria-hidden");
      }
    };
    setInert(main, menuOpen || caveatsOpen);
    setInert(sidebar, caveatsOpen);
    return () => { setInert(main, false); setInert(sidebar, false); };
  }, [menuOpen, caveatsOpen]);
  useEffect(() => {
    const beforePrint = () => setPrintAll(true);
    const afterPrint = () => setPrintAll(false);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);

  if (error) return <main className="load-state" role="alert"><CircleAlert size={24} /><h1>Dashboard data did not load.</h1><p>{error}</p><button type="button" className="button" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!data) return <main className="load-state" aria-live="polite"><span className="loader" /><p>Loading validated evidence…</p></main>;

  const metrics = data.context.metrics;
  // This map is intentionally derived after the loading guards. Keeping it as a
  // plain value avoids changing the hook order when the static contract loads.
  const metadata = new Map(data.chart_metadata.map((item) => [item.chart_id, item]));
  const totalPipeline = data.datasets.channel_pipeline.reduce((sum, row) => sum + numberValue(row, "total_pipeline"), 0);
  const targetAccounts = parseCount(metric(data, "target_accounts"));
  const unreached = parseCount(metric(data, "unreached_accounts"));
  const coverageMix: DataRow[] = [{ name: "Unreached", value: unreached }, { name: "Reached", value: Math.max(0, targetAccounts - unreached) }];
  const activeGroup = groups.find((group) => group.children.some((child) => child.id === active));
  const filteredGroups = groups.map((group) => ({ ...group, children: group.children.filter((child) => !search.trim() || `${group.label} ${child.label}`.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.children.length || !search.trim());
  const hasSearchResults = filteredGroups.some((group) => group.children.length > 0);
  const openSection = (id: SectionId) => { setActive(id); setMenuOpen(false); if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`); };
  const togglePresentation = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>(".command-strip, .command-canvas")) : [];
    const state = !reduced && targets.length ? Flip.getState(targets) : null;
    setPresenting((value) => !value);
    if (state) window.requestAnimationFrame(() => Flip.from(state, { duration: 0.32, ease: "power2.out", nested: true, absolute: false }));
  };
  const props: SectionProps = { data, metadata, presenting, totalPipeline, coverageMix, resetToken };
  const renderSection = (id: SectionId) => {
    if (id === "s-essential") return <EssentialSection {...props} />;
    if (id === "s-exec") return <ExecutiveSection {...props} />;
    if (id === "s-attrib") return <AttributionSection {...props} />;
    if (id === "s-channel") return <ChannelSection {...props} />;
    if (id === "s-segment") return <SegmentSection {...props} />;
    if (id === "s-creative") return <CreativeSection {...props} />;
    if (id === "s-budget") return <BudgetSection {...props} />;
    if (id === "s-advanced") return <AdvancedSection {...props} />;
    if (id === "s-appendix") return <AppendixSection data={data} onOpen={openSection} />;
    return <ConclusionSection data={data} />;
  };

  return <div ref={root} className="app-shell">
    <aside id="dashboard-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} role={menuOpen ? "dialog" : undefined} aria-label="Dashboard sections" aria-modal={menuOpen ? "true" : undefined}><div className="brand"><span>RC</span><div><strong>Revenue Command Center</strong><small>Marketing analytics · {data.meta.period}</small></div></div><button ref={closeButton} className="sidebar-close" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X /></button><div className="nav-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find evidence" aria-label="Search dashboard sections" /></div><nav className="section-nav">{filteredGroups.map((group) => <div className="nav-group" key={group.id}><div className="nav-group-label">{group.icon}<span>{group.label}</span></div>{group.children.map((item) => <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); openSection(item.id); }}><span>{item.label}</span>{active === item.id && <AnimatedNavIndicator />}</a>)}</div>)}</nav>{search.trim() && !hasSearchResults && <p className="nav-empty" role="status">No sections match “{search}”.</p>}<a className="legacy-link" href="/full-analysis"><ExternalLink size={15} /><span><strong>Full analysis archive</strong><small>Original Plotly reference</small></span></a><div className="sidebar-note"><ShieldCheck size={16} /><span>Validated Parquet evidence<br />Schema v{data.schema_version}</span></div></aside>{menuOpen && <button type="button" className="nav-backdrop" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation" />}
      <main id="main-content"><header className="topbar"><div className="topbar-left"><button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="dashboard-navigation"><Menu size={18} /></button><div><h1>Revenue Command Center</h1><span className="top-context">Marketing Analytics / {activeGroup?.label ?? "Dashboard"}</span></div></div><div className="top-actions"><span className="data-meta">{metrics.data_year_range} · {metrics.total_opportunities} opportunities · 8 sources</span><span className="validated"><Check size={13} /> Evidence validated</span><button ref={caveatsTrigger} className="action-button" type="button" title="View data caveats" onClick={() => setCaveatsOpen(true)} aria-haspopup="dialog" aria-expanded={caveatsOpen}><Info size={15} /> Caveats</button><button className="action-button utility-export" type="button" title="Export all evidence" onClick={() => downloadEvidence(data)}><Download size={15} /> Export</button><button className="action-button utility-print" type="button" title="Print all dashboard sections" onClick={() => { setPrintAll(true); window.setTimeout(() => { window.print(); window.setTimeout(() => setPrintAll(false), 1500); }, 120); }}><Printer size={15} /> Print</button><button className={`mode-button ${presenting ? "active" : ""}`} type="button" title={presenting ? "Switch to analyst mode" : "Switch to presentation mode"} onClick={togglePresentation} aria-pressed={presenting}><Presentation size={15} /> {presenting ? "Analyst mode" : "Presentation mode"}</button><button className="icon-button utility-reset" type="button" onClick={() => { setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setPrintAll(false); setResetToken((value) => value + 1); openSection("s-essential"); }} title="Reset dashboard" aria-label="Reset dashboard"><RotateCcw size={16} /></button></div></header>
      <section className={`command-strip ${active === "s-essential" ? "" : "is-compact"}`} aria-label="Executive operating summary"><div className="command-decision"><h2>Protect win quality. Expand account coverage through a measured holdout.</h2><p>Attribution guides where to investigate; it does not justify blanket budget scaling.</p><span>Operating decision · measurement required</span></div><div className="command-kpis"><div><span>Total pipeline</span><strong>{metrics.total_pipeline}</strong><small>{metrics.total_opportunities} opportunities</small></div><div><span>Recorded won revenue</span><strong>{metrics.won_revenue}</strong><small>{metrics.closed_deal_win_rate} resolved win rate</small></div><div><span>Marketing sourced</span><strong>{metrics.marketing_sourced_pipeline}</strong><small>{metrics.marketing_sourced_share} of pipeline</small></div><div><span>Influenced signal</span><strong>{metrics.marketing_influenced_pipeline}</strong><small>{metrics.attribution_linked_won_share} of wins linked</small></div></div></section>
      <StoryStrip data={data} />
      <div className="progress-rail" aria-label={`Section ${sectionOrder.indexOf(active) + 1} of ${sectionOrder.length}`}><span style={{ width: "100%", transform: `scaleX(${(sectionOrder.indexOf(active) + 1) / sectionOrder.length})`, transformOrigin: "left center" }} /></div>
      <div className={`section-viewport ${printAll ? "print-all" : ""}`}>{printAll ? sectionOrder.map((id) => <div className="print-section" key={id}>{renderSection(id)}</div>) : renderSection(active)}</div>
      <footer><span>Marketing Analytics Decision System</span><span>Source: validated integrated datasets · {data.meta.methodology}</span></footer>
    </main>
    {caveatsOpen && <><button type="button" tabIndex={-1} className="drawer-backdrop" aria-hidden="true" aria-label="Close caveats" onClick={() => setCaveatsOpen(false)} /><aside className="caveats-drawer" role="dialog" aria-modal="true" aria-labelledby="caveats-title"><div className="drawer-head"><h2 id="caveats-title">Data Caveats</h2><button ref={caveatsClose} type="button" className="icon-button" onClick={() => setCaveatsOpen(false)} aria-label="Close caveats"><X size={17} /></button></div><p>These constraints stay visible because they change what the dashboard can safely claim.</p><ul>{data.context.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul><div className="drawer-source"><strong>Methodology</strong><span>{data.meta.methodology}</span></div></aside></>}
  </div>;
}

export default App;
