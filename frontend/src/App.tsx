import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Archive, ArrowRight, ArrowUpDown, Check, ChevronDown, CircleAlert, Download, ExternalLink,
  FileText, GitBranch, Info, Menu, Presentation, RotateCcw, Search, ShieldCheck,
  Sparkles, TrendingUp, X,
} from "lucide-react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChartMetadata, DashboardData, DataRow, SectionId } from "./types";
import { numberValue, REQUIRED_SECTION_IDS, textValue } from "./types";

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
    id: "recommendation-group",
    label: "Recommendation",
    icon: <Check size={16} />,
    children: [{ id: "s-conclusion", label: "Conclusion & Action Plan" }],
  },
  {
    id: "appendix-group",
    label: "Analyst Appendix",
    icon: <Archive size={16} />,
    children: [{ id: "s-appendix", label: "Case Deliverable Coverage" }],
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
    takeaway: "Recommended path: protect pipeline quality, test coverage on unreached target accounts, and treat attribution as directional planning evidence.",
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
    description: "Which ad creatives and email campaigns drive the highest engagement - tells you what messaging resonates with your target accounts.",
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
    body: <>Sourced credit is the CRM origin field. Influenced credit captures classified email or 6sense presence in an eligible pre-opportunity journey. The two totals use different definitions and populations.</>,
    insight: "Report both definitions with their populations; neither is a causal lift estimate.",
  },
  "c-essential-coverage": {
    title: "What this shows - Account Coverage",
    body: <>The account view separates target domains reached by email, 6sense, both, or neither. Opportunity rates are observational associations because coverage was not randomized.</>,
    insight: "Use unreached strong-fit accounts as a test audience and validate lift with a holdout.",
  },
  "c-essential-cohort": {
    title: "What this shows - Pipeline Cohorts",
    body: <>Pipeline volume, closed-deal win rate, and resolved share must be read together. Recent cohorts with low resolved share are provisional rather than comparable to mature cohorts.</>,
    insight: "Pipeline growth is not automatically healthy; protect win rate as volume grows.",
  },
  "c-bar-channel": {
    title: "What this shows - Pipeline by Channel",
    body: <>Each bar is total recorded opportunity amount grouped by CRM lead-source category. Other and Existing Client provide context; net-new marketing channels need maturity-aware interpretation.</>,
    insight: "Use channel concentration to frame investigation, not a causal leaderboard.",
  },
  "c-donut-won": {
    title: "What this shows - Won Revenue by Channel",
    body: <>Only closed-and-won opportunities appear. Existing-client and relationship motions can dominate because the relationship already exists; newer channels need time to mature.</>,
    insight: "Judge marketing channels with pipeline maturity and conversion timing in view.",
  },
  "c-monthly-trend": {
    title: "What this shows - Pipeline Created by Month",
    body: <>The five largest channels remain visible and the long tail is grouped into Other. Spikes and drops are useful leads to compare with the campaign calendar.</>,
    insight: "A time pattern is an investigation lead, not proof of campaign lift.",
  },
  "c-attrib-comparison": {
    title: "What this shows - Attribution Model Comparison",
    body: <>Compare the same channel across first-touch, last-touch, linear, and time-decay models. Source logs are normalized to one account-channel presence per ISO week; blank-UTM web sessions are excluded.</>,
    insight: "Differences show observed journey roles, not single-channel causality.",
  },
  "c-sourced-influenced": {
    title: "What this shows - Sourced vs. Influenced Pipeline",
    body: <>Sourced is hard CRM origin credit. Influenced is a classified touch within 365 days before opportunity creation. The gap is a definition difference, not proof of hidden causal value.</>,
    insight: "Report both totals with their populations and definitions.",
  },
  "c-attrib-waterfall": {
    title: "What this shows - First-Touch vs. Last-Touch Credit Shift",
    body: <>The diverging bars show how each channel's allocated credit changes between first-touch and last-touch. Teal gains later-stage credit; amber loses it.</>,
    insight: "Channels that gain or lose credit are planning signals to test, not budget mandates.",
  },
  "c-spend-pipeline": {
    title: "What this shows - Tracked-Spend ROI",
    body: <>Pipeline ROI uses total pipeline and revenue ROI uses recorded won amount. Only channels with tracked spend appear; referral and existing client have no media spend in this dataset.</>,
    insight: "Use this to choose where to investigate marginal spend; it is not a full marketing budget model.",
  },
  "c-funnel": {
    title: "What this shows - Channel Activity Volumes",
    body: <>Ad, email, web, and opportunity outcome populations use separate denominators. A log scale keeps very large and small counts readable together.</>,
    insight: "This view avoids implying that events, sessions, and CRM opportunities form one sequential funnel.",
  },
  "c-seg-heatmap": {
    title: "What this shows - Pipeline Heatmap: Industry x Segment",
    body: <>Each cell is total recorded pipeline from accounts in that industry and CRM market segment. Darker blue means more pipeline concentration; confirm conversion quality before turning concentration into a targeting rule.</>,
    insight: "Use high-concentration cells to frame tests, then qualify them with win rate and sample size.",
  },
  "c-seg-winrate": {
    title: "What this shows - Segment Tradeoff",
    body: <>The plot uses won opportunities divided by resolved opportunities, with 95% Wilson intervals, resolved-deal count, and average recorded deal amount for scale context.</>,
    insight: "Use this as a market-segment baseline; the targeting matrix adds profile fit and low-N flags.",
  },
  "c-creative-ctr": {
    title: "What this shows - High-Volume Creative CTR Within Platform",
    body: <>CTR is clicks divided by impressions. LinkedIn and 6sense are ranked separately because their delivery mechanics and baselines differ; only ads with at least 10,000 impressions appear.</>,
    insight: "Use the highest-CTR ads as the next creative brief, then test budget shifts.",
  },
  "c-creative-attr": {
    title: "What this shows - 6sense CTR by Recorded Copy Tone",
    body: <>This aggregates 6sense creative by copy-tone label and shows weighted CTR, impression volume, and distinct ad count. Unknown dominates delivery, so labeled differences have limited volume.</>,
    insight: "Treat labeled tone differences as test hypotheses; fixing metadata coverage is first.",
  },
  "c-email-seniority": {
    title: "What this shows - Email Engagement-Event Mix by Job Seniority",
    body: <>The supplied email file contains engagement events across people but no sent or delivered counts. Click-event share is clicks divided by recorded engagement rows for the group.</>,
    insight: "The log can rank engagement composition, but it cannot measure send-based effectiveness.",
  },
  "c-budget-scenario": {
    title: "What this shows - Budget-Neutral Measurement Allocation",
    body: <>Each stacked bar preserves the current tracked budget. The alternatives reserve part of that budget for a randomized or phased holdout and a pre-registered experiment pool.</>,
    insight: "The data supports a measurement plan, not an optimization claim.",
  },
  "c-feat-imp": {
    title: "What this shows - Win Probability: Top Predictors",
    body: <>A leakage-controlled baseline model uses opportunity-time channel, segment, amount, and create-date fields to prioritize active opportunities. Feature importance is a predictive pattern, not a causal effect.</>,
    insight: "Use win probability for sales prioritization alongside stage, account context, and seller judgment.",
  },
  "c-win-prob": {
    title: "What this shows - Active Opportunity Score Distribution",
    body: <>Each histogram bar is the number of active opportunities in a probability range. Deals to the right are higher-priority follow-up candidates, but no operating cutoff is implied.</>,
    insight: "Pilot score bands with sales before choosing a threshold.",
  },
  "c-account-coverage": {
    title: "What this shows - Account Coverage: Has Marketing Reached Your Target Accounts?",
    body: <>The rate view shows observed opportunity rate for each coverage group. Account selection and sales activity may explain part of the gap.</>,
    insight: "Only a controlled test can estimate incremental lift.",
  },
  "c-deal-velocity": {
    title: "What this shows - Deal Velocity: How Fast Do Different Channels Close?",
    body: <>Median days to close is paired with the middle 50% range. Channels with fewer than five won deals are suppressed so a tiny sample does not create a false speed recommendation.</>,
    insight: "Use this as a historical benchmark for established channels, not paid-channel runway guidance.",
  },
  "c-journey": {
    title: "What this shows - Winning Touchpoint Journey Sequences",
    body: <>For won deals with tracked touches, the sequence records the order of observed channels. Common paths are planning clues, not proof that the sequence caused the win.</>,
    insight: "Test email-first and 6sense overlay sequences against a holdout.",
  },
  "c-targeting-matrix": {
    title: "What this shows - ABM Targeting Priority Matrix",
    body: <>The heatmap crosses CRM segment with 6sense profile fit. Every cell includes its deal count; cells below 30 resolved deals remain exploratory regardless of color.</>,
    insight: "Commercial + Strong Fit combines strong conversion with a large resolved sample; validate before allocation.",
  },
  "c-cohort": {
    title: "What this shows - Pipeline Cohort Analysis by Quarter",
    body: <>Blue bars show pipeline created. The quality panel shows closed-deal win rate and resolved share so newer cohorts are not treated as mature evidence.</>,
    insight: "Investigate whether mature-cohort decline reflects ICP fit, qualification, or source mix.",
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
  link.click();
  URL.revokeObjectURL(url);
}

function downloadEvidence(data: DashboardData) {
  const rows = (Object.entries(data.datasets) as Array<[string, DataRow[]]>).flatMap(([dataset, values]) => values.map((row) => ({ dataset, ...row })));
  downloadRows("marketing-dashboard-evidence.csv", rows);
}

function validatePayload(value: unknown): DashboardData {
  const payload = value as DashboardData;
  if (!payload || payload.schema_version !== 2) throw new Error("Dashboard data schema is not version 2.");
  if (!payload.context?.metrics || !payload.meta || !payload.datasets || !Array.isArray(payload.chart_metadata) || !payload.tables || !payload.manifest) throw new Error("Dashboard data is missing its evidence contract.");
  const required = ["channel_pipeline", "cohorts", "coverage", "attribution", "attribution_coverage", "quality", "feature_importance", "model_stats", "budget_scenarios", "targeting", "monthly_pipeline", "funnel_metrics", "segment_industry", "segment_win_rate", "creative_ctr", "creative_tone", "email_seniority", "deal_velocity", "journey_sequences", "win_probability", "account_coverage_detail", "attribution_touchpoint_quality", "qa_performance"];
  const datasets = payload.datasets as unknown as Record<string, unknown>;
  const missing = required.filter((key) => !Array.isArray(datasets[key]));
  if (missing.length) throw new Error(`Dashboard data is missing datasets: ${missing.join(", ")}`);
  const metadataIds = payload.chart_metadata.map((item) => item.chart_id);
  if (metadataIds.length !== chartPlacementIds.length || chartPlacementIds.some((id) => !metadataIds.includes(id))) throw new Error("Dashboard chart metadata does not match the 24-placement preservation contract.");
  if (payload.manifest.chart_placement_count !== chartPlacementIds.length || payload.manifest.distinct_chart_count !== 21 || payload.manifest.section_ids.length !== REQUIRED_SECTION_IDS.length) throw new Error("Dashboard preservation manifest is incomplete.");
  if (tableIds.some((id) => !payload.tables[id as keyof typeof payload.tables]?.columns?.length)) throw new Error("Dashboard table contract is incomplete.");
  return payload;
}

function DataTable({ rows, label }: { rows: DataRow[]; label: string }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 9);
  const sorted = sort
    ? [...rows].sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), undefined, { numeric: true }) * sort.direction)
    : rows;
  if (!rows.length) return <div className="data-table-empty">No rows are available for this chart scope.</div>;
  return <div className="data-table-wrap">
    <div className="data-table-top"><span>{label}</span><button type="button" className="text-button" onClick={() => downloadRows(`${label.toLowerCase().replaceAll(" ", "-")}.csv`, rows)}><Download size={14} /> CSV</button></div>
    <div className="table-scroll"><table className="data-table"><caption className="sr-only">{label}</caption><thead><tr>{keys.map((key) => <th key={key} scope="col"><button type="button" onClick={() => setSort((current) => ({ key, direction: current?.key === key ? (current.direction * -1 as 1 | -1) : 1 }))}>{key.replaceAll("_", " ")} <ChevronDown size={12} aria-hidden="true" /></button></th>)}</tr></thead><tbody>{sorted.map((row, index) => <tr key={`${String(row[keys[0]])}-${index}`}>{keys.map((key) => <td key={key}>{String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div>
  </div>;
}

function ChartCard({ id, metadata, data, totalPipeline, coverageMix, presenting }: { id: string; metadata?: ChartMetadata; data: DashboardData; totalPipeline: number; coverageMix: DataRow[]; presenting: boolean }) {
  const [details, setDetails] = useState(false);
  const [table, setTable] = useState(false);
  const info = explain[id];
  const title = metadata?.title ?? info?.title ?? id;
  const subtitle = metadata?.subtitle ?? "Source-backed evidence";
  const source = metadata?.source_dataset as keyof DashboardData["datasets"] | undefined;
  const chartRows = source ? data.datasets[source] : [];
  return <article className="chart-card" data-chart-id={id} data-reveal>
    <div className="chart-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><div className="chart-actions"><button type="button" className="icon-button" title="View chart data" aria-label={`View data for ${title}`} aria-expanded={table} onClick={() => setTable((value) => !value)}><FileText size={15} /></button><button type="button" className="icon-button" title="Download chart data" aria-label={`Download data for ${title}`} onClick={() => downloadRows(`${id}.csv`, chartRows)}><Download size={15} /></button></div></div>
    <Suspense fallback={<div className="chart-empty">Loading visual…</div>}><ChartRenderer id={id} data={data.datasets} totalPipeline={totalPipeline} coverageMix={coverageMix} /></Suspense>
    <p className="chart-accessible-summary">{metadata?.accessible_summary}</p>
    {info && <div className="chart-explanation"><div className="explanation-row"><strong>{info.title}</strong><button type="button" className="text-button" aria-expanded={details} onClick={() => setDetails((value) => !value)}>{details ? "Hide details" : "How to read"}<ChevronDown className={details ? "rotate" : ""} size={14} /></button></div>{details && <div className="explanation-body"><p>{info.body}</p><div className="insight"><Sparkles size={14} />{interpolate(info.insight, data)}</div>{metadata?.caveat && <p className="chart-caveat"><CircleAlert size={14} />{metadata.caveat}</p>}</div>}</div>}
    {table && <DataTable rows={chartRows} label={`${title} data`} />}
    {presenting && <span className="presentation-mark" aria-hidden="true">Evidence</span>}
  </article>;
}

function SectionIntro({ id, data }: { id: SectionId; data: DashboardData }) {
  const item = copy[id];
  const takeaway = interpolate(item.takeaway, data);
  const [label, ...rest] = takeaway.split(":");
  return <><div className="section-heading"><h2>{item.title}</h2><p>{item.description}</p></div><div className="section-takeaway"><strong>{label}:</strong>{rest.join(":")}<div className="evidence-chips"><span className="chip chip-blue">{metric(data, "marketing_influenced_pipeline")} influenced</span><span className="chip chip-amber">{metric(data, "unreached_pct")} unreached</span><span className="chip chip-red">{metric(data, "cohort_start_win_rate")} → {metric(data, "cohort_end_win_rate")} mature win rate</span></div></div></>;
}

function ContextBox({ children }: { children: ReactNode }) { return <div className="context-box"><Info size={16} aria-hidden="true" /><div>{children}</div></div>; }

function EvidenceGrid({ items }: { items: Array<{ label: string; title: string; body: ReactNode; tone: "high" | "medium" | "directional" }> }) {
  return <div className="evidence-grid">{items.map((item) => <article className="evidence-card" key={item.title}><span className={`confidence ${item.tone}`}>{item.label}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>;
}

function PriorityGrid({ data }: { data: DashboardData }) {
  return <div className="priority-grid"><article className="priority-card"><span className="priority-tag">Do first</span><h3>Audit pipeline quality</h3><p>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}. Tighten ICP and qualification before increasing broad spend.</p></article><article className="priority-card"><span className="priority-tag amber">Test opportunity</span><h3>Reach unreached accounts</h3><p>{metric(data, "unreached_accounts")} target accounts, or {metric(data, "unreached_pct")}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and use a holdout.</p></article><article className="priority-card"><span className="priority-tag red">Budget lens</span><h3>Fund measurement first</h3><p>Use a budget-neutral holdout and experiment reserve. Do not optimize from two paid channels with insufficient won outcomes.</p></article></div>;
}

interface SectionProps { data: DashboardData; metadata: Map<string, ChartMetadata>; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; resetToken: number; }

function ChartGrid({ ids, data, presenting, totalPipeline, coverageMix, metadata, resetToken, className = "" }: { ids: string[]; data: DashboardData; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; metadata: Map<string, ChartMetadata>; resetToken: number; className?: string }) {
  return <div className={`chart-grid ${ids.length === 1 ? "single" : ids.length === 2 ? "two" : ""} ${className}`.trim()}>{ids.map((id) => <ChartCard key={`${id}-${resetToken}`} id={id} metadata={metadata.get(id)} data={data} totalPipeline={totalPipeline} coverageMix={coverageMix} presenting={presenting} />)}</div>;
}

function EvidenceTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  const [sort, setSort] = useState<{ index: number; direction: 1 | -1 } | null>(null);
  const sortedRows = sort
    ? [...rows].sort((left, right) => String(left[sort.index] ?? "").localeCompare(String(right[sort.index] ?? ""), undefined, { numeric: true }) * sort.direction)
    : rows;
  return <article className="evidence-table-card"><div className="table-heading"><h3>{title}</h3><span>{rows.length} rows · sortable</span></div><div className="table-scroll"><table className="evidence-table"><caption className="sr-only">{title}</caption><thead><tr>{columns.map((column, index) => { const active = sort?.index === index; return <th scope="col" key={column} aria-sort={active ? (sort?.direction === 1 ? "ascending" : "descending") : "none"}><button type="button" className="sort-button" onClick={() => setSort((current) => ({ index, direction: current?.index === index ? (current.direction * -1 as 1 | -1) : 1 }))}>{column}<ArrowUpDown size={11} aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{sortedRows.map((row, rowIndex) => <tr key={`${title}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div></article>;
}

function AttributionTable({ data }: { data: DashboardData }) {
  const channels = Array.from(new Set(data.datasets.attribution.map((row) => textValue(row, "channel"))));
  const models = ["First-Touch", "Last-Touch", "Linear", "Time-Decay", "Marketing Sourced", "Marketing Influenced"];
  const rows = channels.map((channel) => {
    const values = models.map((model) => data.datasets.attribution.filter((row) => textValue(row, "channel") === channel && textValue(row, "attribution_model") === model).reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0));
    const largest = models[values.indexOf(Math.max(...values.slice(0, 4)))] || "—";
    return [channel, ...values.map(money), largest];
  });
  return <EvidenceTable title="Full Attribution Table - All Models Side by Side" columns={["Channel", ...models, "Largest-Credit Model"]} rows={rows} />;
}

function EssentialSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-essential" className="dashboard-section"><SectionIntro id="s-essential" data={data} /><PriorityGrid data={data} /><ChartGrid ids={["c-essential-contribution", "c-essential-coverage", "c-essential-cohort"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><EvidenceTable title="Essential Action Plan" columns={["Priority", "Decision", "Why", "Next step"]} rows={[["1", "Protect quality", `Closed-deal win rate moved from ${metric(data, "cohort_start_win_rate")} to ${metric(data, "cohort_end_win_rate")} across cohorts at least 80% resolved.`, "Run a quarterly ICP and qualification review before scaling volume."], ["2", "Expand coverage", `${metric(data, "unreached_pct")} of target accounts are unreached by tracked email or 6sense.`, "Launch email-first coverage test with a holdout group."], ["3", "Use attribution carefully", `${metric(data, "linked_opportunities")} opportunities link to classified marketing touches; ${metric(data, "linked_win_share")} of won deals are covered.`, "Use journey models for hypothesis generation, then validate lift with holdouts."]]}/></section>;
}

function ExecutiveSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-exec" className="dashboard-section"><SectionIntro id="s-exec" data={data} /><ContextBox><strong>How to read this dashboard:</strong> This company uses Account-Based Marketing (ABM) - instead of advertising to everyone, they pick specific companies (target accounts) and run coordinated campaigns at those companies. The dashboard answers: <em>which marketing activities led to those deals?</em></ContextBox><ChartGrid ids={["c-bar-channel", "c-donut-won", "c-monthly-trend"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AttributionSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-attrib" className="dashboard-section"><SectionIntro id="s-attrib" data={data} /><ContextBox><strong>The core concept:</strong> For the subset of opportunities with classified marketing touches, attribution models answer: <em>how would observed pipeline credit move under different allocation rules?</em> They do not estimate incremental lift.<br /><br />We link marketing touchpoints to opportunities within a 365-day lookback window before deal creation. Sourced, Influenced, First-Touch, Last-Touch, Linear, and Time-Decay remain separate definitions.</ContextBox><EvidenceGrid items={[{ label: "Proves", title: "Marketing has measurable pipeline presence", body: <>Sourced credit reconciles to the full CRM source view; influenced credit reconciles within the linked opportunity population. Report both only with their populations.</>, tone: "high" }, { label: "Suggests", title: "Channels play different journey roles", body: <>First-touch, last-touch, linear, and time-decay views show whether a channel starts, assists, or closes account journeys.</>, tone: "medium" }, { label: "Does not prove", title: "Single-touch causality", body: <>A touchpoint receiving credit means it appeared in the pre-opportunity path; it does not mean it alone caused the deal.</>, tone: "directional" }]} /><ChartGrid ids={["c-attrib-comparison", "c-sourced-influenced", "c-attrib-waterfall"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><AttributionTable data={data} /></section>;
}

function ChannelSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  const rows = data.datasets.channel_pipeline.map((row) => [textValue(row, "channel_category"), numberValue(row, "deal_count").toLocaleString(), numberValue(row, "resolved_count").toLocaleString(), money(numberValue(row, "total_pipeline")), money(numberValue(row, "won_pipeline")), pct(numberValue(row, "win_rate")), money(numberValue(row, "avg_deal_size")), money(numberValue(row, "channel_spend")), numberValue(row, "pipeline_roi") ? `${numberValue(row, "pipeline_roi").toFixed(1)}×` : "—", numberValue(row, "revenue_roi") ? `${numberValue(row, "revenue_roi").toFixed(1)}×` : "—"]);
  return <section id="s-channel" className="dashboard-section"><SectionIntro id="s-channel" data={data} /><ContextBox><strong>What “ROI” means here:</strong> Pipeline ROI = CRM-sourced pipeline associated with a channel / tracked ad spend. Revenue ROI uses recorded won amount. These are observational efficiency ratios, and recorded revenue is understated because many won deals have zero amount.</ContextBox><EvidenceGrid items={[{ label: "Strong signal", title: "Relationship channels convert best", body: <>Existing client and referral performance explains why revenue is not only a paid-media story.</>, tone: "high" }, { label: "Efficiency signal", title: "Marketing builds future pipeline", body: <>Net-new channels should be judged by pipeline creation, later win conversion, and time-to-close together.</>, tone: "medium" }, { label: "Next test", title: "Separate quality from volume", body: <>Track whether added channel spend creates qualified opportunities, not just more opportunities.</>, tone: "directional" }]} /><ChartGrid ids={["c-spend-pipeline", "c-funnel"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><EvidenceTable title="Channel ROI Summary Table" columns={["Channel", "Deals", "Resolved", "Pipeline ($)", "Won ($)", "Closed Win Rate", "Avg Deal", "Spend ($)", "Pipeline ROI", "Revenue ROI"]} rows={rows} /></section>;
}

function SegmentSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-segment" className="dashboard-section"><SectionIntro id="s-segment" data={data} /><ContextBox><strong>What is a “Segment” here?</strong> The CRM segment field groups opportunities into Commercial, Mid, and Enterprise markets. It is not a 6sense buying-stage label. Profile fit is analyzed separately, and win rates use resolved opportunities only.</ContextBox><ChartGrid className="segment-grid" ids={["c-seg-heatmap", "c-seg-winrate"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function CreativeSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-creative" className="dashboard-section"><SectionIntro id="s-creative" data={data} /><ContextBox><strong>Why creative matters in ABM:</strong> Ads are shown specifically to people at target accounts. If creative is bad, prospects tune it out; if it is good, it builds recognition before sales calls. CTR is the primary display-creative effectiveness measure.<br /><br /><strong>Email Event Mix:</strong> The supplied email file contains engagement events across {metric(data, "email_people")} people, but no sent or delivered counts. Event composition can guide hypotheses; it cannot support send-based open or click-rate claims.</ContextBox><ChartGrid ids={["c-creative-ctr", "c-creative-attr", "c-email-seniority"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function BudgetSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-budget" className="dashboard-section"><SectionIntro id="s-budget" data={data} /><ContextBox><strong>How the plan works:</strong> Every scenario preserves the current tracked budget. The alternatives reserve part of that budget for a randomized or phased holdout and a pre-registered experiment pool.<br /><br /><strong>Three plans:</strong> Status Quo activates all tracked spend; 10% Holdout reserves 10%; Measurement First activates 80%, reserves 10% as holdout, and creates a 10% experiment pool.</ContextBox><ChartGrid ids={["c-budget-scenario"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AdvancedSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-advanced" className="dashboard-section"><SectionIntro id="s-advanced" data={data} /><ContextBox><strong>What makes this section different:</strong> Standard marketing analytics tells you what happened. This section adds prioritization signals for where to focus. The leakage-controlled baseline scores {metric(data, "active_scored_opportunities")} active opportunities with AUC {metric(data, "model_auc")} using {metric(data, "model_validation")}.</ContextBox><EvidenceGrid items={[{ label: "Observed gap", title: "Reached tiers show higher observed rates", body: <>Unreached accounts show a {metric(data, "not_reached_opportunity_rate")} opportunity rate, while email-only accounts show {metric(data, "email_only_opportunity_rate")} and both-channel accounts show {metric(data, "both_channels_opportunity_rate")}.</>, tone: "high" }, { label: "Quality diagnosis", title: "Growth is not automatically healthy", body: <>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} in {metric(data, "cohort_start_quarter")} to {metric(data, "cohort_end_win_rate")} in {metric(data, "cohort_end_quarter")}.</>, tone: "medium" }, { label: "Next test", title: "Validate causality", body: <>Run a holdout or phased rollout so the team can measure incremental lift from email-first outreach and a tested 6sense overlay.</>, tone: "directional" }]} /><ChartGrid ids={["c-feat-imp", "c-win-prob", "c-account-coverage", "c-deal-velocity", "c-journey", "c-targeting-matrix", "c-cohort"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AppendixSection({ data, onOpen }: { data: DashboardData; onOpen: (id: SectionId) => void }) {
  const cards: Array<{ id: SectionId; label: string; title: string; body: string }> = [
    { id: "s-exec", label: "Overview", title: "Executive Summary", body: "Top-line pipeline, won revenue, and monthly trend views." },
    { id: "s-segment", label: "Targeting", title: "Segment & ICP", body: "Segment, industry, and ICP evidence for account prioritization." },
    { id: "s-creative", label: "Engagement", title: "Creative & Email", body: "Creative CTR and email engagement detail for messaging decisions." },
    { id: "s-budget", label: "Planning", title: "Budget Scenarios", body: "Tracked-spend scenarios for sizing controlled budget tests." },
    { id: "s-advanced", label: "Modeling", title: "Advanced Analytics", body: "Win probability, deal velocity, journey, and targeting matrix detail." },
  ];
  return <section id="s-appendix" className="dashboard-section"><SectionIntro id="s-appendix" data={data} /><div className="appendix-grid">{cards.map((card) => <article className="appendix-card" key={card.id}><span className="priority-tag">{card.label}</span><h3>{card.title}</h3><p>{card.body}</p><button type="button" className="button button-small" onClick={() => onOpen(card.id)}>Open evidence <ArrowRight size={14} /></button></article>)}</div><EvidenceTable title="Case Deliverable Coverage" columns={["Rubric Area", "Where It Is Answered", "What The Evaluator Should See"]} rows={[["Data Processing", "Pipeline runner and methodology notes", "Eight raw sources are cleaned, deduplicated, normalized by domain, and rebuilt through reproducible scripts."], ["Data Integrity", "Quality scorecard, validation script, caveats", "Won revenue, attribution, funnel, and dashboard artifacts are checked for consistency before presentation."], ["Data Storytelling", "Essential View and Recommendation", "The story is focused: marketing influence is broader than source credit, but growth must protect quality."], ["Dashboard Design", "Short judging path plus appendix", "The default page prioritizes decision-critical charts; deeper charts are available but not forced."], ["Reporting & Analysis", "Attribution, coverage, cohort, targeting, budget sections", "Findings connect to evidence and translate into specific CMO recommendations."], ["Marketing Strategy", "Action plan, targeting matrix, budget scenario", "Recommended pivot: protect ICP quality, expand strong-fit account coverage, and test budget shifts before scaling."]]}/></section>;
}

function ConclusionSection({ data }: { data: DashboardData }) {
  const confidenceRows = [
    ["Expand coverage to unreached target accounts.", "High", `${metric(data, "unreached_accounts")} target accounts are unreached, and reached groups show materially higher opportunity rates than unreached accounts.`, "Prioritize strong-fit unreached accounts and compare opportunity creation against a holdout group."],
    ["Coordinate email engagement with 6sense display.", "Medium", "Journey and attribution patterns show email often starts conversations while 6sense appears later in the path.", "Trigger display frequency after email engagement and measure lift in meetings, opportunities, pipeline, and win rate."],
    ["Tighten ICP and qualification criteria.", "High", `Cohort analysis shows pipeline growth alongside a mature-cohort closed-win-rate move from ${metric(data, "cohort_start_win_rate")} to ${metric(data, "cohort_end_win_rate")}.`, "Track win rate, stage conversion, and disqualification reasons by source and profile fit."],
    ["Reserve budget for a causal measurement plan.", "High", "Only two paid channels have tracked spend, one has a single opportunity, and neither has recorded won revenue.", "Use a budget-neutral holdout and pre-register incremental qualified pipeline as the decision metric."],
  ];
  const actionRows = [
    ["P1", "Coverage: reach unreached target accounts with email first, then test 6sense overlay with a holdout.", `Email-only accounts show a ${metric(data, "email_only_opportunity_rate")} opportunity rate and both-channel accounts show ${metric(data, "both_channels_opportunity_rate")}, compared with ${metric(data, "not_reached_opportunity_rate")} for unreached accounts.`, "Target account coverage, opportunity rate, incremental lift, pipeline created."],
    ["P1", "Pipeline quality: tighten ICP and qualification criteria.", `Quarterly pipeline is rising while closed-deal win rate moved from ${metric(data, "cohort_start_win_rate")} to ${metric(data, "cohort_end_win_rate")}.`, "Win rate, stage conversion, disqualification reasons."],
    ["P2", "Attribution reporting: report sourced and influenced side by side.", `Sourced pipeline is ${metric(data, "sourced_pipeline")}, while influenced pipeline is ${metric(data, "marketing_influenced_pipeline")}.`, "Sourced pipeline, influenced pipeline, influenced won revenue."],
    ["P2", "Sales prioritization: use win probability bands in weekly pipeline review.", `The leakage-controlled baseline scored ${metric(data, "active_scored_opportunities")} active deals using opportunity-time fields.`, "Close rate by probability band, sales follow-up SLA."],
    ["P3", "Creative: scale high-CTR creative patterns and retire weak ads.", "Creative patterns are tied to click efficiency before accounts become opportunities.", "CTR, CPC, form fills, account engagement."],
  ];
  return <section id="s-conclusion" className="dashboard-section conclusion-section"><SectionIntro id="s-conclusion" data={data} /><div className="conclusion-hero"><span className="hero-label">Bottom-line recommendation</span><h3>Reach the right unreached accounts, start with email, test 6sense overlay with a holdout, and protect win rate as pipeline grows.</h3><p>Marketing is not just a source channel. It influenced {metric(data, "marketing_influenced_pipeline")} of pipeline, while {metric(data, "unreached_accounts")} target accounts ({metric(data, "unreached_pct")}) provide a large, measurable audience for a controlled coverage test.</p></div><div className="conclusion-grid"><article className="conclusion-card"><h3>What is working</h3><ul><li>Relationship-led channels remain the strongest won-revenue base.</li><li>Touchpoint attribution shows different channels appearing at different journey stages.</li><li>The win model is useful as a prioritization signal: AUC is {metric(data, "model_auc")} using {metric(data, "model_validation")}.</li></ul></article><article className="conclusion-card"><h3>What is at risk</h3><ul><li>Among mature cohorts, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}.</li><li>Marketing-sourced share was {metric(data, "latest_mature_marketing_sourced_share")} in the latest cohort meeting the maturity threshold.</li><li>Most target accounts are unreached, limiting ABM learning and leaving pipeline potential untouched.</li></ul></article><article className="conclusion-card"><h3>What to do next</h3><ul><li>Expand coverage to unreached strong-fit accounts before increasing broad demand-generation spend.</li><li>Test 6sense display after email engagement, using a holdout to prove whether the overlay creates lift.</li><li>Review ICP and qualification each quarter until win rate stabilizes.</li></ul></article></div><div className="priority-grid conclusion-priorities"><article className="priority-card"><h3><span className="priority-tag red">P1</span> Fix coverage and quality first</h3><p>Activate unreached target accounts and tighten ICP qualification before chasing more broad top-of-funnel volume.</p></article><article className="priority-card"><h3><span className="priority-tag amber">P2</span> Operationalize the evidence</h3><p>Report sourced plus influenced metrics together, and use win probability bands in weekly sales reviews.</p></article><article className="priority-card"><h3><span className="priority-tag">P3</span> Improve message efficiency</h3><p>Scale creative patterns that earn engagement and retire ads that do not move accounts forward.</p></article></div><EvidenceTable title="Decision Confidence" columns={["Recommendation", "Confidence", "Why We Believe It", "What To Test Next"]} rows={confidenceRows} /><EvidenceTable title="Recommended Action Plan" columns={["Priority", "Action", "Why", "Measure Success With"]} rows={actionRows} /><div className="presenting-script"><h3>How to Present the Conclusion</h3><div><strong>1. Start with contribution</strong><span>Marketing created measurable pipeline directly, but the stronger story is influence across the account journey.</span></div><div><strong>2. Name the tension</strong><span>The business is creating more pipeline, but lower recent win rates mean growth is not automatically healthy.</span></div><div><strong>3. Recommend the move</strong><span>Prioritize strong-fit account coverage, lead with email, and test 6sense overlay with a holdout before simply adding budget.</span></div><div><strong>4. State confidence</strong><span>Coverage expansion and ICP tightening are high-confidence recommendations; budget scaling is directional and should be tested in phases.</span></div></div></section>;
}

function Progress({ value, tone }: { value: number; tone: string }) { return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={`progress-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }

function App() {
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const caveatsTrigger = useRef<HTMLButtonElement>(null);
  const caveatsClose = useRef<HTMLButtonElement>(null);
  const caveatsWasOpen = useRef(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<SectionId>("s-essential");
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenting, setPresenting] = useState(() => localStorage.getItem("dashboardMode") === "presentation");
  const [search, setSearch] = useState("");
  const [caveatsOpen, setCaveatsOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    fetch("./dashboard-data.json")
      .then((response) => { if (!response.ok) throw new Error(`Dashboard data returned ${response.status}`); return response.json(); })
      .then((payload) => setData(validatePayload(payload)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard data"));
  }, []);

  useEffect(() => {
    const syncRoute = () => { const hash = window.location.hash.replace(/^#/, "") as SectionId; if (REQUIRED_SECTION_IDS.includes(hash)) setActive(hash); };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => { window.removeEventListener("hashchange", syncRoute); window.removeEventListener("popstate", syncRoute); };
  }, []);

  useEffect(() => {
    if (!data || !root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => { gsap.fromTo("[data-reveal]", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: "power2.out" }); ScrollTrigger.refresh(); }, root);
    return () => ctx.revert();
  }, [data, active]);

  useEffect(() => { document.body.classList.toggle("presentation-mode", presenting); localStorage.setItem("dashboardMode", presenting ? "presentation" : "analyst"); window.setTimeout(() => ScrollTrigger.refresh(), 200); }, [presenting]);
  useEffect(() => { if (!menuOpen) return; closeButton.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [menuOpen]);
  useEffect(() => {
    if (!caveatsOpen) {
      if (caveatsWasOpen.current) caveatsTrigger.current?.focus();
      caveatsWasOpen.current = false;
      document.body.style.overflow = "";
      return;
    }
    caveatsWasOpen.current = true;
    document.body.style.overflow = "hidden";
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
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [caveatsOpen]);

  if (error) return <main className="load-state"><CircleAlert size={24} /><h1>Dashboard data did not load.</h1><p>{error}</p><button type="button" className="button" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!data) return <main className="load-state"><span className="loader" /><p>Loading validated evidence…</p></main>;

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
  const openSection = (id: SectionId) => { setActive(id); setMenuOpen(false); if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`); window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  const props: SectionProps = { data, metadata, presenting, totalPipeline, coverageMix, resetToken };

  return <div ref={root} className="app-shell">
    <aside id="dashboard-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Dashboard sections"><div className="brand"><span>MA</span><div><strong>Marketing Analytics</strong><small>Decision system · {data.meta.period}</small></div></div><button ref={closeButton} className="sidebar-close" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X /></button><div className="nav-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a section" aria-label="Search dashboard sections" /></div><nav className="section-nav">{filteredGroups.map((group) => <div className="nav-group" key={group.id}><div className="nav-group-label">{group.icon}<span>{group.label}</span></div>{group.children.map((item) => <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); openSection(item.id); }}><span>{item.label}</span>{active === item.id && <span className="nav-active" aria-hidden="true" />}</a>)}</div>)}</nav>{search.trim() && !hasSearchResults && <p className="nav-empty" role="status">No sections match “{search}”.</p>}<a className="legacy-link" href="/full-analysis"><ExternalLink size={15} /><span><strong>Original full analysis</strong><small>Plotly parity reference</small></span></a><div className="sidebar-note"><ShieldCheck size={16} /><span>Evidence refreshed from validated Parquet outputs</span></div></aside>
    <main id="main-content"><header className="topbar"><div className="topbar-left"><button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="dashboard-navigation"><Menu size={18} /></button><div><span className="top-kicker">Marketing Analytics / {activeGroup?.label ?? "Dashboard"}</span><h1>Decision dashboard</h1></div></div><div className="top-actions"><span className="data-meta">Data: {metrics.data_year_range} · {metrics.total_opportunities} opportunities · 8 datasets</span><span className="validated"><Check size={13} /> Validated</span><button ref={caveatsTrigger} className="action-button" type="button" onClick={() => setCaveatsOpen(true)} aria-haspopup="dialog" aria-expanded={caveatsOpen}><Info size={15} /> Caveats</button><button className="action-button utility-export" type="button" onClick={() => downloadEvidence(data)}><Download size={15} /> Export</button><button className={`mode-button ${presenting ? "active" : ""}`} type="button" onClick={() => setPresenting((value) => !value)} aria-pressed={presenting}><Presentation size={15} /> {presenting ? "Analyst mode" : "Presentation mode"}</button><button className="icon-button utility-reset" type="button" onClick={() => { setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setResetToken((value) => value + 1); openSection("s-essential"); }} title="Reset dashboard" aria-label="Reset dashboard"><RotateCcw size={16} /></button></div></header>
      <section className="decision-panel" data-reveal><div className="decision-lead"><span className="decision-label">Decision in one line</span><h2>Targeted growth is credible. Blanket scaling is not — yet.</h2><p>Expand strong-fit account coverage, then prove incremental lift with holdouts.</p></div><div className="decision-metric"><span>Pipeline</span><strong>{metrics.total_pipeline}</strong><small>{metrics.total_opportunities} opportunities</small></div><div className="decision-metric"><span>Won revenue</span><strong>{metrics.won_revenue}</strong><small>{metrics.closed_deal_win_rate} closed-deal win rate</small></div><div className="decision-metric"><span>Marketing sourced</span><strong>{metrics.marketing_sourced_pipeline}</strong><small>{metrics.marketing_sourced_share} of pipeline</small></div><div className="decision-metric"><span>Influenced signal</span><strong>{metrics.marketing_influenced_pipeline}</strong><small>Only {metrics.attribution_linked_won_share} of wins linked</small></div></section>
      <section className="story-strip" data-reveal><div><strong>Signal</strong><span>Email-reached accounts show a {metrics.email_only_opportunity_rate} opportunity rate versus {metrics.not_reached_opportunity_rate} when unreached.</span></div><ArrowRight size={16} /><div><strong>Constraint</strong><span>{metrics.unreached_pct} of target accounts are unreached, while attribution links just {metrics.attribution_linked_won_share} of wins.</span></div><ArrowRight size={16} /><div><strong>Decision</strong><span>Expand targeted coverage and run a holdout — not a broad budget increase.</span></div></section>
      <div className="progress-rail" aria-label="Dashboard progress"><span style={{ width: `${((sectionOrder.indexOf(active) + 1) / sectionOrder.length) * 100}%` }} /></div>
      <div className="quality-strip" data-reveal><div><span>Domain match rate</span><strong>{metrics.domain_match_rate}</strong><Progress value={parseFloat(metrics.domain_match_rate) || 0} tone="teal" /></div><div><span>Won deals with zero amount</span><strong>{metrics.zero_amount_won_share}</strong><Progress value={parseFloat(metrics.zero_amount_won_share) || 0} tone="amber" /></div><div><span>Unknown CRM channel</span><strong>{metrics.unknown_channel_pct}</strong><Progress value={parseFloat(metrics.unknown_channel_pct) || 0} tone="amber" /></div><div><span>Attribution-linked wins</span><strong>{metrics.attribution_linked_won_share}</strong><Progress value={parseFloat(metrics.attribution_linked_won_share) || 0} tone="red" /></div></div>
      <div className="section-viewport">{active === "s-essential" && <EssentialSection {...props} />}{active === "s-exec" && <ExecutiveSection {...props} />}{active === "s-attrib" && <AttributionSection {...props} />}{active === "s-channel" && <ChannelSection {...props} />}{active === "s-segment" && <SegmentSection {...props} />}{active === "s-creative" && <CreativeSection {...props} />}{active === "s-budget" && <BudgetSection {...props} />}{active === "s-advanced" && <AdvancedSection {...props} />}{active === "s-appendix" && <AppendixSection data={data} onOpen={openSection} />}{active === "s-conclusion" && <ConclusionSection data={data} />}</div>
      <footer><span>Marketing Analytics Decision System</span><span>Source: validated integrated datasets · {data.meta.methodology}</span></footer>
    </main>
    {caveatsOpen && <><button className="drawer-backdrop" aria-label="Close caveats" onClick={() => setCaveatsOpen(false)} /><aside className="caveats-drawer" role="dialog" aria-modal="true" aria-labelledby="caveats-title"><div className="drawer-head"><h2 id="caveats-title">Data Caveats</h2><button ref={caveatsClose} type="button" className="icon-button" onClick={() => setCaveatsOpen(false)} aria-label="Close caveats"><X size={17} /></button></div><p>These constraints stay visible because they change what the dashboard can safely claim.</p><ul>{data.context.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul><div className="drawer-source"><strong>Methodology</strong><span>{data.meta.methodology}</span></div></aside></>}
  </div>;
}

export default App;
