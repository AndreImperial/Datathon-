import { compareValues, serializeEvidenceCsv, formatField, fieldUnit, columnLabel } from "./evidence";
import { displayName } from "./labels";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Archive, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Check, ChevronDown, CircleAlert, Download, ExternalLink,
  FileText, GitBranch, Info, Menu, MoreHorizontal, Presentation, Printer, RotateCcw, Search, ShieldCheck,
  Sparkles, TrendingUp, X,
} from "lucide-react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChartMetadata, DashboardData, DataRow, SectionId } from "./types";
import { numberValue, REQUIRED_SECTION_IDS, textValue, type CaseStudyData } from "./types";
import { AnimatedNavIndicator } from "./components/AceternityMotion";
import { PresentationApp } from "./presentation/PresentationApp";
import { chartPlacementIds, tableIds, validateCaseStudyPayload, validateDashboardPayload } from "./dataContract";

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

// Keep progress and print order wired to the preservation contract so a visual
// redesign cannot silently reorder the analytical story. The five sidebar
// groups retain the separately locked primary-navigation order above.
const sectionOrder: SectionId[] = [...REQUIRED_SECTION_IDS];
const sectionLabel = (id: SectionId) => groups.flatMap((group) => group.children).find((child) => child.id === id)?.label ?? id;
const sectionGroupLabel = (id: SectionId) => groups.find((group) => group.children.some((child) => child.id === id))?.label ?? "";

/**
 * Headline findings from the current case analysis (schema v3). The legacy v2
 * contract predates them, so they are read from the v3 summary row and findings
 * rather than hard-coded; when the v3 file is unavailable the band is omitted.
 */
interface LatestBrief { summary: DataRow; findings: CaseStudyData["findings"]; methodVersion: string; snapshotId: string; }
function toLatestBrief(payload: CaseStudyData): LatestBrief | null {
  const summary = payload.datasets?.summary?.[0];
  if (!summary) return null;
  return { summary, findings: payload.findings ?? [], methodVersion: payload.meta?.method_version ?? "", snapshotId: payload.meta?.snapshot_id ?? "" };
}

const copy: Record<SectionId, { title: string; description: string; takeaway: string }> = {
  "s-essential": {
    title: "The decision in one view",
    description: "The evidence points to one disciplined move: protect conversion quality, then expand reach through a controlled account test.",
    takeaway: "Decision: tighten qualification, test the unreached audience, and use attribution to choose hypotheses—not to claim causality.",
  },
  "s-exec": {
    title: "The revenue story starts with concentration",
    description: "Recorded pipeline and won revenue show where the business performs today—and where marketing still has to prove future contribution.",
    takeaway: "Read first: relationship-led channels anchor recorded wins; marketing channels create net-new pipeline whose quality and maturity still need validation.",
  },
  "s-attrib": {
    title: "Influence is visible. Causality is not.",
    description: "Four attribution models show where tracked channels appear before opportunities, within the subset the marketing logs can observe.",
    takeaway: "Use attribution to frame channel roles: report CRM source and linked-journey credit separately, then validate lift with a controlled test.",
  },
  "s-channel": {
    title: "Relationship-led sources anchor wins; marketing must prove lift",
    description: "Compare recorded pipeline, resolved win rate, and tracked spend without turning sparse efficiency ratios into a winner.",
    takeaway: "Channel decision: protect relationship-led revenue, maintain measurable acquisition channels, and test incremental lift before moving budget.",
  },
  "s-segment": {
    title: "Prioritize fit and evidence—not deal size alone",
    description: "Segment and profile views identify where account potential and historical conversion evidence overlap.",
    takeaway: "Targeting decision: start with strong-fit cells that have enough resolved history and a reachable audience; keep sparse cells exploratory.",
  },
  "s-creative": {
    title: "Engagement reveals test ideas, not a format winner",
    description: "Advertising and email behavior show where attention appears, while incomplete metadata and missing delivery denominators limit broader claims.",
    takeaway: "Content decision: rank ads within platform, treat labeled creative combinations as bundles, and test matched variants before scaling a message.",
  },
  "s-budget": {
    title: "Fund learning before expansion",
    description: "Budget scenarios preserve the tracked envelope while reserving room for a holdout and a measurable experiment.",
    takeaway: "Budget decision: treat historical spend as context, not an approved mix; release more only when the test shows incremental qualified pipeline.",
  },
  "s-advanced": {
    title: "Read coverage, velocity and cohorts before testing",
    description: "Coverage, cohort, velocity, and journey diagnostics help focus review without replacing commercial judgment.",
    takeaway: "Operating decision: use coverage gaps to design controlled tests. The calendar-only win-probability model was withdrawn after a near-chance holdout.",
  },
  "s-appendix": {
    title: "The evidence behind the decision",
    description: "Supporting definitions, diagnostics, and detailed views stay available for judge questions without interrupting the main story.",
    takeaway: "When challenged: trace each recommendation back to its population, denominator, and limitation.",
  },
  "s-conclusion": {
    title: "The CMO decision",
    description: "A measured growth plan that connects the evidence, the risk, and the next decision.",
    takeaway: "Bottom line: stabilize conversion quality, test account coverage, and scale only what produces incremental lift.",
  },
};

const explain: Record<string, { title: string; body: ReactNode; insight: string }> = {
  "c-essential-contribution": {
    title: "What this shows - Marketing Contribution vs Total Pipeline",
    body: <>Sourced credit is the CRM origin field. Influenced credit captures classified email or 6sense presence in an eligible pre-opportunity journey. The two totals use different definitions and populations.<br /><br /><strong>Read the bars against total pipeline:</strong> sourced credit is conservative CRM origin; influenced credit is the linked subset of classified journeys. The influenced total is not a full-population or causal lift estimate.</>,
    insight: "Report both definitions with their populations: sourced is {marketing_sourced_pipeline}, while linked influenced pipeline is {marketing_influenced_pipeline}.",
  },
  "c-essential-coverage": {
    title: "What this shows - Account Coverage",
    body: <>The account view separates CRM account domains reached by email, 6sense, both, or neither. Historical opportunity prevalence associates supplied-window reach with all-history CRM outcomes; it does not measure conversion after exposure.<br /><br /><strong>Read the two panels together:</strong> account volume shows the size of each audience; the rate panel shows historical opportunity prevalence with a 95% Wilson interval.</>,
    insight: "Use unreached strong-fit accounts as a test audience and validate lift with a holdout; reached-group differences may reflect selection or sales activity.",
  },
  "c-essential-cohort": {
    title: "What this shows - Pipeline Cohorts",
    body: <>Pipeline volume, closed-deal win rate, and resolved share must be read together. Recent cohorts with low resolved share are provisional rather than comparable to mature cohorts. The maturity gate is 80% resolved before using closed-deal win rate as an executive comparison.</>,
    insight: "Pipeline growth is not automatically healthy; protect win rate as volume grows and investigate the mature-cohort decline.",
  },
  "c-bar-channel": {
    title: "What this shows - Pipeline by Channel",
    body: <>Each bar is the recorded amount of opportunities—won, lost, discontinued, and active—grouped by CRM lead source. Relationship-led sources provide the revenue base; marketing sources show where net-new pipeline enters the record.<br /><br /><strong>Decision use:</strong> compare scale first, then check resolution, win rate, and amount completeness before judging channel quality.</>,
    insight: "6Sense Channel ($1.5M), Web Inbound ($1.1M), and Event ($678K) are the largest named marketing sources by recorded pipeline. Treat that ordering as a starting point for investigation, not a causal leaderboard.",
  },
  "c-donut-won": {
    title: "What this shows - Won Revenue by Channel",
    body: <>This view shows recorded won amount by CRM lead source; only sources with a positive won amount appear.<br /><br /><strong>Decision use:</strong> separate the relationship-led revenue base from the acquisition channels expected to create future pipeline. The chart describes recorded outcomes, not incremental channel value.</>,
    insight: "Other ($2.5M won) and Existing Client ($1.2M won) are the largest recorded won-revenue channels. Judge marketing channels with pipeline maturity and conversion timing in view.",
  },
  "c-monthly-trend": {
    title: "What this shows - Pipeline Created by Month",
    body: <>Each colored band represents pipeline created in that month. The view keeps the five largest channels and groups the long tail into Other, so the total shape remains readable without a 12-series legend.<br /><br /><strong>How to use it:</strong> Look for spikes — did they follow a campaign launch? Look for drops — did a channel go quiet? This helps connect campaign activity to deal creation with a time lag.</>,
    insight: "Compare this chart to the campaign calendar. Spikes are useful leads for investigation, but the chart alone does not prove campaign lift.",
  },
  "c-attrib-comparison": {
    title: "What this shows - Attribution Model Comparison",
    body: <>This comparison isolates the common touchpoint-linked channels across first-touch, last-touch, linear, and time-decay models. Sourced and influenced totals are shown separately because they use different definitions and populations.<br /><br /><strong>How to read it:</strong> Compare the same channel across models. If a channel is taller in First-Touch than Last-Touch, it appears earlier in the observed journey; the reverse suggests later-stage presence. Eligible precreation source events are filtered by opportunity window before retaining the latest channel presence per ISO week; positional credit describes retained weekly presence, and blank-UTM web recordings are excluded rather than assumed to be marketing traffic.</>,
    insight: "Compare first-touch, last-touch, linear, and time-decay side by side. Differences show observed journey roles, not single-channel causality.",
  },
  "c-sourced-influenced": {
    title: "What this shows - Sourced vs. Influenced Pipeline",
    body: <>Two horizontal bars, two definitions of marketing contribution.<br /><br /><strong>Sourced:</strong> the CRM “Lead Source” field explicitly says the deal came from marketing — hard, conservative attribution.<br /><br /><strong>Influenced:</strong> a classified email or 6sense touch occurred within 365 days before opportunity creation, even if CRM source credit belongs elsewhere. The gap is a definition difference, not proof of hidden causal value. Sourced covers CRM origin; influenced covers the linked subset of classified journeys.</>,
    insight: "Report both definitions with their populations. Sourced is {marketing_sourced_pipeline}; linked influenced pipeline is {marketing_influenced_pipeline}. Neither is a causal lift estimate.",
  },
  "c-attrib-waterfall": {
    title: "What this shows - First-Touch vs. Last-Touch Credit Shift",
    body: <>This shows how much each channel’s allocated credit changes when switching from first-touch to last-touch. Positive bars indicate more later-position credit; negative bars indicate more earlier-position credit.<br /><br /><strong>Decision use:</strong> use the shift to form journey-role hypotheses. Later observed presence is not proof that a channel converted or closed the opportunity.</>,
    insight: "Channels that gain last-touch credit appear later in tracked journeys; channels that lose it appear earlier. Treat the pattern as a planning signal to test.",
  },
  "c-spend-pipeline": {
    title: "What this shows - Tracked-Spend ROI",
    body: <>Each point compares return multiples for channels with tracked spend. Pipeline and recorded-won multiples use opportunities created within each platform’s observed spend window. All-history totals are separate.<br /><br /><strong>Why only some channels appear:</strong> only channels with tracked ad spend show up. Referral and Existing Client have unmeasured media spend, not a measured zero. Longer distances from zero mean more recorded pipeline or won revenue per tracked-spend dollar.</>,
    insight: "Only 6sense_display and linkedin have tracked spend, so use this to choose where to investigate marginal spend — it is not a full marketing budget model.",
  },
  "c-funnel": {
    title: "What this shows - Channel Activity Volumes",
    body: <>This separates ad, email, web, and opportunity-outcome populations so unrelated events are not presented as one linear conversion path.<br /><br /><strong>How to read it:</strong> each group has its own denominator. Ad rows show impression/click progression; email rows show the composition of the supplied engagement-event log; opportunity rows summarize CRM outcomes. A log scale keeps very large and small counts readable together.</>,
    insight: "This view is safer for analysis because it avoids implying that email events, website recordings, and CRM opportunities are one sequential funnel.",
  },
  "c-seg-heatmap": {
    title: "What this shows - Pipeline Heatmap: Industry x Segment",
    body: <>Each cell is recorded pipeline from accounts in that industry and CRM market segment. Darker cells indicate greater concentration.<br /><br /><strong>Decision use:</strong> use concentration to identify where to investigate, then require adequate resolved volume, amount coverage, and conversion quality before turning a cell into a targeting rule.</>,
    insight: "Use the highest-concentration cells to frame tests, then qualify them with resolved-deal win rate and sample size.",
  },
  "c-seg-winrate": {
    title: "What this shows - Segment Tradeoff",
    body: <>Each bar is the closed-deal win rate for a CRM market segment, with a 95% Wilson interval.<br /><br /><strong>How to read it:</strong> the x-axis is won opportunities divided by resolved opportunities. Resolved-deal count and average recorded deal amount provide scale context. Prefer segments with a stable interval, adequate resolved volume, and meaningful positive deal amounts.</>,
    insight: "Use this as a market-segment baseline; the targeting matrix adds profile fit and explicit low-N flags.",
  },
  "c-creative-ctr": {
    title: "What this shows - High-Volume Creative CTR Within Platform",
    body: <>CTR is clicks divided by impressions. LinkedIn and 6sense are ranked separately because their delivery mechanics and baselines differ; only ads with at least 10,000 impressions appear.<br /><br /><strong>Decision use:</strong> carry the strongest observed ads into a controlled comparison. Do not infer which format, message, tone, or CTA caused the result unless the variants isolate that one difference.</>,
    insight: "Use the highest-CTR ads as test candidates, then isolate creative variables before shifting budget or declaring a format winner.",
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
  "c-account-coverage": {
    title: "What this shows - CRM Account Coverage",
    body: <>This shows CRM account domains reached by email, 6sense, both, or neither in the supplied marketing window. The rate panel shows historical opportunity prevalence — the share with any opportunity in the available CRM history.<br /><br /><strong>The critical finding:</strong> The unreached group has no observed email or 6sense touch in the supplied window. Higher prevalence in reached groups does not establish post-exposure conversion or incremental lift.<br /><br /><strong>What to do:</strong> Exclude customers and active pipeline, establish a prospective baseline, and test strong-fit eligible domains against a randomized holdout.</>,
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
    body: <>This win-rate heatmap crosses CRM segment with current 6sense profile fit. Every cell includes its resolved-deal count; cells below 30 are explicitly exploratory.<br /><br /><strong>Decision use:</strong> prioritize cells only when conversion history, sample size, and an eligible current audience align. Low-sample cells remain exploratory regardless of color.</>,
    insight: "Commercial + Strong Fit combines strong historical conversion with a larger resolved sample. Treat fit as a current-snapshot association, not proof of historical targeting effectiveness.",
  },
  "c-cohort": {
    title: "What this shows - Pipeline Cohort Analysis by Quarter",
    body: <>Blue bars show pipeline created each quarter. The quality panel shows closed-deal win rate and resolved share so newer cohorts are not treated as mature evidence. The resolved-share line explains why recent cohorts remain provisional until they cross the 80% maturity gate.</>,
    insight: "Among mature cohorts, closed-deal win rate moved from 38% in 2022Q1 to 22% in 2024Q2. Investigate whether the decline reflects ICP fit, qualification, or source mix; do not treat unresolved recent cohorts as equivalent to fully matured cohorts.",
  },
};

const GENERIC_CAVEAT = "Source-backed metric; see the analyst explanation and caveat in this section.";

const money = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 999_500) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const metric = (data: DashboardData, key: string) => data.context.metrics[key] ?? "N/A";
const parseCount = (value: string) => Number(value.replaceAll(",", "")) || 0;
const formatRefresh = (value?: string) => {
  if (!value) return "Latest validated build";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Latest validated build";
  return `Refreshed ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed)}`;
};

function interpolate(text: string, data: DashboardData) {
  return text.replace(/\{([^}]+)\}/g, (_, key: string) => metric(data, key));
}

function downloadRows(filename: string, rows: DataRow[], provenance: DataRow = {}) {
  if (!rows.length) return;
  const csv = serializeEvidenceCsv(rows, provenance);
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
  downloadRows("marketing-dashboard-evidence.csv", [...datasetRows, ...chartRows, ...tableRows], { snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: data.meta.generated_from, scope: data.meta.period, methodology: data.meta.methodology });
}

function formatContractCell(column: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.includes("($)") || column === "Avg Deal") return formatField("recorded_amount", Number(value));
  if (column === "Closed Win Rate") return pct(Number(value));
  if (column.includes("ROI")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && true ? `${numeric.toFixed(1)}×` : "—";
  }
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return String(value);
}

function contractRows(table: { columns: string[]; rows: DataRow[] }): (string | number | null)[][] {
  return table.rows.map((row) => table.columns.map((column) => row[column] as string | number | null));
}

// Raw CRM / channel codes (existing_client, email_mqa…) read as display names in
// tables; sentences and already-readable labels pass through untouched. Sorting
// and CSV export keep the raw source value.
const RAW_CODE = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;
function displayCell(column: string, value: unknown, formatted: string): string {
  if (typeof value !== "string") return formatted;
  if (RAW_CODE.test(value) || (/channel/i.test(column) && /^[a-z0-9_]+$/.test(value))) return displayName(value);
  return formatted;
}
const isMissing = (value: unknown) => value === null || value === undefined || value === "" || (typeof value === "number" && !Number.isFinite(value));
/** A column is numeric when every populated cell is a number; numeric columns right-align. */
const numericColumn = (values: unknown[]) => values.some((value) => !isMissing(value)) && values.every((value) => isMissing(value) || typeof value === "number");
/** The single shared value of a column (e.g. a repeated definition), or "" when it varies. */
function constantText(rows: DataRow[], key: string): string {
  const values = new Set(rows.map((row) => row[key]).filter((value) => !isMissing(value)).map(String));
  return values.size === 1 && rows.every((row) => !isMissing(row[key])) ? [...values][0] : "";
}

function DataTable({ rows, label, id, provenance = {}, hideKeys = [], note, isEmptyRow, emptyRowNoun = "rows" }: { rows: DataRow[]; label: string; id: string; provenance?: DataRow; hideKeys?: string[]; note?: ReactNode; isEmptyRow?: (row: DataRow) => boolean; emptyRowNoun?: string }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const allKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const keys = allKeys.filter((key) => !hideKeys.includes(key));
  const sorted = sort
    ? [...rows].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.direction))
    : rows;
  const emptyCount = isEmptyRow ? rows.filter(isEmptyRow).length : 0;
  const visible = isEmptyRow && !showEmpty ? sorted.filter((row) => !isEmptyRow(row)) : sorted;
  const numeric = new Set(keys.filter((key) => numericColumn(rows.map((row) => row[key]))));
  const hasDollars = keys.some((key) => fieldUnit(key).startsWith("recorded dollars"));
  if (!rows.length) return <div className="data-table-empty">No rows are available for this chart scope.</div>;
  return <div className="data-table-wrap" id={id}>
    {/* CSV keeps every row and column at full source precision, in the visible sort order. */}
    <div className="data-table-top"><span>{label}</span><button type="button" className="text-button" onClick={() => downloadRows(`${label.toLowerCase().replaceAll(" ", "-")}.csv`, sorted, provenance)}><Download size={14} /> CSV</button></div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`${label}; scroll to read all rows and columns`}><table className="data-table"><caption className="sr-only">{label}</caption><thead><tr>{keys.map((key) => { const active = sort?.key === key; return <th key={key} scope="col" className={numeric.has(key) ? "numeric" : undefined} aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}><button type="button" onClick={() => setSort((current) => ({ key, direction: current?.key === key ? (current.direction * -1 as 1 | -1) : 1 }))}>{columnLabel(key)} <ChevronDown className={active && sort.direction === 1 ? "rotate" : ""} size={12} aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{visible.map((row, index) => <tr key={`${String(row[keys[0]])}-${index}`}>{keys.map((key) => <td key={key} className={numeric.has(key) ? "numeric" : "text"}>{displayCell(key, row[key], formatField(key, row[key]))}</td>)}</tr>)}</tbody></table></div>
    {(note || hasDollars || emptyCount > 0) && <div className="data-table-foot">
      {emptyCount > 0 && <button type="button" className="text-button" aria-pressed={showEmpty} onClick={() => setShowEmpty((value) => !value)}>{showEmpty ? `Hide ${emptyCount} ${emptyRowNoun} with no measured values` : `Show ${emptyCount} ${emptyRowNoun} with no measured values`}</button>}
      {note && <p className="table-note">{note}</p>}
      {hasDollars && <p className="table-note">$ = recorded dollars; source currency is unverified.</p>}
    </div>}
  </div>;
}

function EvidenceDetails({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <details className="evidence-details"><summary><span>{title}</span><small>{count} rows</small><ChevronDown size={14} aria-hidden="true" /></summary>{children}</details>;
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
  const explanationId = `${id}-explanation`;
  // The generic placeholder adds no information; substantive caveats stay visible.
  const caveat = metadata?.caveat && metadata.caveat.trim() !== GENERIC_CAVEAT ? metadata.caveat : "";
  return <article className="chart-card" data-chart-id={id} data-reveal aria-labelledby={`${id}-title`}>
    <div className="chart-heading"><div><h3 id={`${id}-title`}>{title}</h3><p id={summaryId} className="chart-takeaway">{metadata?.accessible_summary}{source === "attribution" && " Linked opportunity counts describe the whole selected window, repeated for reference; do not sum across channels or models."}</p><span id={`${id}-subtitle`} className="chart-unit">{subtitle}</span></div><div className="chart-actions"><button type="button" className={`icon-button chart-view-toggle${table ? " is-active" : ""}`} title={table ? "Return to chart" : "View chart data"} aria-label={table ? `View chart for ${title}` : `View data for ${title}`} aria-pressed={table} aria-expanded={table} aria-controls={tableId} onClick={() => setTable((value) => !value)}><FileText size={15} /><span>{table ? "Hide data" : "Show data"}</span></button><button type="button" className="icon-button" title="Download chart data" aria-label={`Download data for ${title}`} onClick={() => downloadRows(`${id}.csv`, chartRows, { snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: metadata?.source_dataset ?? "Unavailable", scope: metadata?.subtitle ?? data.meta.period, methodology: data.meta.methodology, caveat: metadata?.caveat ?? "" })}><Download size={15} /></button></div></div>
    <div className="chart-visual" role="img" aria-labelledby={`${id}-title ${id}-subtitle`} aria-describedby={summaryId}><Suspense fallback={<div className="chart-empty" role="status">Loading visual…</div>}>{!chartRows.length ? <div className="chart-empty" role="status">Chart unavailable: {source ? data.dataset_status?.[source]?.reason ?? "No observations in this scope." : "No observations in this scope."}</div> : <ChartRenderer id={id} data={data.datasets} totalPipeline={totalPipeline} coverageMix={coverageMix} />}</Suspense></div>
    {(caveat || info) && <div className="chart-explanation">
      <div className="explanation-row">
        {caveat ? <p className="chart-caveat"><CircleAlert size={13} aria-hidden="true" /><span><span className="sr-only">Caveat: </span>{caveat}</span></p> : <span />}
        {info && <button type="button" className="text-button" aria-expanded={details} aria-controls={explanationId} onClick={() => setDetails((value) => !value)}>{details ? "Hide explanation" : "What this shows"}<span className="sr-only">: {title}</span><ChevronDown className={details ? "rotate" : ""} size={14} aria-hidden="true" /></button>}
      </div>
      {info && details && <div className="explanation-body" id={explanationId}><p>{info.body}</p><div className="insight"><Sparkles size={14} />{interpolate(info.insight, data)}</div></div>}
    </div>}
    {table && <DataTable id={tableId} rows={chartRows} label={`${title} data`} provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: metadata?.source_dataset ?? "Unavailable", scope: subtitle, methodology: data.meta.methodology, caveat: metadata?.caveat ?? "" }} />}
    {presenting && <span className="presentation-mark" aria-hidden="true">Evidence</span>}
  </article>;
}

function SectionIntro({ id, data }: { id: SectionId; data: DashboardData }) {
  const item = copy[id];
  const takeaway = interpolate(item.takeaway, data);
  const [label, ...rest] = takeaway.split(":");
  // The three headline evidence chips frame the opening and the close; repeating
  // them on every section dilutes each section's own "so what".
  const showChips = id === "s-essential" || id === "s-conclusion";
  const position = sectionOrder.indexOf(id) + 1;
  const group = sectionGroupLabel(id);
  const sectionName = sectionLabel(id);
  return <><div className="section-heading"><div className="section-title-block"><span className="section-eyebrow"><span className="section-index"><span className="sr-only">Section </span>{String(position).padStart(2, "0")}<span className="sr-only"> of {sectionOrder.length}</span><span aria-hidden="true"> / {String(sectionOrder.length).padStart(2, "0")}</span></span>{group && group !== sectionName ? `${group} · ${sectionName}` : sectionName}</span><h2>{item.title}</h2></div><p>{item.description}</p></div><div className="section-takeaway"><div className="takeaway-copy"><strong>{label}:</strong><span>{rest.join(":")}</span></div>{showChips && <div className="evidence-chips"><span className="chip chip-blue">{metric(data, "marketing_influenced_pipeline")} linked-journey signal</span><span className="chip chip-amber">{metric(data, "unreached_pct")} domains unreached</span><span className="chip chip-red">{metric(data, "cohort_start_win_rate")} → {metric(data, "cohort_end_win_rate")} mature-cohort win rate</span></div>}</div></>;
}

function LatestFindings({ brief, data }: { brief: LatestBrief; data: DashboardData }) {
  const s = brief.summary;
  const has = (key: string) => typeof s[key] === "number" && Number.isFinite(s[key] as number);
  const finding = (id: string) => brief.findings.find((item) => item.id === id);
  const withdrawnCaveat = data.context.caveats.find((caveat) => /withdrawn/i.test(caveat));
  const tiles: Array<{ key: string; label: string; value: string; context: ReactNode; status: string; tone: "risk" | "strength" | "gap" | "neutral" }> = [];
  if (has("marketing_recent_win_rate")) tiles.push({ key: "marketing", label: "Marketing-sourced conversion", value: pct(numberValue(s, "marketing_recent_win_rate")), context: <>Lowest of the source groups for 2023–24 new-logo deals{has("recent_best_win_rate") && <> · {textValue(s, "recent_best_rate_source") || "best group"} converts at {pct(numberValue(s, "recent_best_win_rate"))}</>}</>, status: finding("f-marketing")?.evidence_status ?? "Observed", tone: "risk" });
  if (textValue(s, "top_channel")) tiles.push({ key: "referral", label: "Strongest new-logo source", value: textValue(s, "top_channel"), context: <>{has("top_channel_win_rate") && <>{pct(numberValue(s, "top_channel_win_rate"))} resolved win rate · </>}leads recorded new-logo won amount, 2018–2024</>, status: finding("f-channel")?.evidence_status ?? "Observed", tone: "strength" });
  if (has("zero_amount_win_mrr")) tiles.push({ key: "mrr", label: "MRR on $0-amount wins", value: `${money(numberValue(s, "zero_amount_win_mrr"))}/mo`, context: <>{has("zero_amount_wins") && has("won") ? <>{numberValue(s, "zero_amount_wins").toLocaleString()} of {numberValue(s, "won").toLocaleString()} wins record no amount; </> : null}reported beside won amount, never added</>, status: finding("f-value")?.evidence_status ?? "Observed", tone: "gap" });
  if (withdrawnCaveat) tiles.push({ key: "model", label: "Win-probability model", value: "Withdrawn", context: <>Near-chance holdout, so no deal scores are published</>, status: "Not used", tone: "neutral" });
  if (!tiles.length) return null;
  return <section className="latest-findings" aria-labelledby="latest-findings-title">
    <div className="latest-findings-head"><div><span className="latest-kicker">Latest case analysis{brief.methodVersion && ` · ${brief.methodVersion}`}</span><h2 id="latest-findings-title">What the CMO should act on now</h2></div><a className="text-button latest-deck-link" href="#present/main-01">Walk through the findings deck <ArrowRight size={14} aria-hidden="true" /></a></div>
    <dl className="latest-findings-grid">{tiles.map((tile) => <div key={tile.key} className={`latest-tile tone-${tile.tone}`}><dt>{tile.label}</dt><dd className="latest-value">{tile.value}</dd><dd className="latest-context">{tile.context}</dd><dd className="latest-status">{tile.status}</dd></div>)}</dl>
  </section>;
}

function SectionPager({ active, onOpen }: { active: SectionId; onOpen: (id: SectionId) => void }) {
  const index = sectionOrder.indexOf(active);
  const previous = index > 0 ? sectionOrder[index - 1] : undefined;
  const next = index < sectionOrder.length - 1 ? sectionOrder[index + 1] : undefined;
  const link = (id: SectionId, direction: "previous" | "next") => <a className={`pager-link pager-${direction}`} href={`#${id}`} onClick={(event) => { event.preventDefault(); onOpen(id); }} aria-keyshortcuts={direction === "next" ? "]" : "["}>
    {direction === "previous" && <ArrowLeft size={16} aria-hidden="true" />}
    <span><small>{direction === "previous" ? "Previous" : "Next"} · {String(sectionOrder.indexOf(id) + 1).padStart(2, "0")}</small><strong>{sectionLabel(id)}</strong></span>
    {direction === "next" && <ArrowRight size={16} aria-hidden="true" />}
  </a>;
  return <nav className="section-pager" aria-label="Section pagination">
    {previous ? link(previous, "previous") : <span className="pager-spacer" />}
    <span className="pager-hint" aria-hidden="true"><kbd>[</kbd> <kbd>]</kbd> to move between sections</span>
    {next ? link(next, "next") : <span className="pager-spacer" />}
  </nav>;
}

function DashboardSkeleton() {
  return <div className="app-shell skeleton-shell" aria-busy="true">
    <aside className="sidebar skeleton-sidebar" aria-hidden="true"><div className="brand"><span>RC</span><div><strong>Revenue Command</strong><small>Decision analytics</small></div></div>{Array.from({ length: 9 }, (_, index) => <i key={index} className="sk sk-nav" />)}</aside>
    <main id="main-content" className="skeleton-main"><header className="topbar"><div><h1>Revenue Command Center</h1><span className="top-context" role="status">Loading validated evidence…</span></div></header>
      <div className="skeleton-body" aria-hidden="true">
        <div className="sk sk-hero" />
        <div className="skeleton-row three"><i className="sk sk-card" /><i className="sk sk-card" /><i className="sk sk-card" /></div>
        <i className="sk sk-heading" />
        <div className="skeleton-row two"><i className="sk sk-chart" /><i className="sk sk-chart" /></div>
      </div>
    </main>
  </div>;
}

function ContextBox({ children }: { children: ReactNode }) { return <div className="context-box"><Info size={16} aria-hidden="true" /><div>{children}</div></div>; }

function EvidenceGrid({ items }: { items: Array<{ label: string; title?: string; body: ReactNode; tone: "high" | "medium" | "directional" }> }) {
  return <div className="evidence-grid">{items.map((item) => <article className="evidence-card" key={`${item.label}-${item.title ?? "label-only"}`}>{item.title ? <><span className={`confidence ${item.tone}`}>{item.label}</span><h3>{item.title}</h3></> : <h3 className="evidence-label-only"><span className={`confidence ${item.tone}`}>{item.label}</span></h3>}<p>{item.body}</p></article>)}</div>;
}

function AttributionSensitivityPanel({ data }: { data: DashboardData }) {
  const rows = [...data.datasets.attribution_sensitivity].sort((a, b) => numberValue(a, "lookback_days") - numberValue(b, "lookback_days"));
  if (!rows.length) return null;
  return <section className="method-panel" aria-labelledby="lookback-sensitivity-title">
    <div className="method-panel-head"><div><h3 id="lookback-sensitivity-title">Attribution lookback sensitivity</h3></div><span className="panel-note">Primary view: 365 days · Robustness check</span></div>
    <p className="method-panel-copy">Shorter windows link fewer CRM opportunities and won deals. The ranking is therefore a scope-sensitive planning signal, not a stable incrementality estimate.</p>
    <div className="method-metrics">{rows.map((row) => <div className={`method-metric${numberValue(row, "lookback_days") === 365 ? " is-primary" : ""}`} key={String(row.lookback_days)}><span>{numberValue(row, "lookback_days")} days</span><strong>{numberValue(row, "linked_opportunities").toLocaleString()}</strong><small>linked opps · {pct(numberValue(row, "linked_share_of_won_opportunities"))} of won deals</small></div>)}</div>
  </section>;
}

function PriorityGrid({ data }: { data: DashboardData }) {
  return <aside className="action-queue" aria-label="Recommended action queue">
    <div className="action-queue-head"><div><h3>The next three decisions</h3><span>Evidence to action</span></div><strong>3</strong></div>
    <article className="action-row"><span className="action-sequence">01</span><div><span className="priority-tag red">Protect the base</span><h4>Diagnose conversion quality</h4><p>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}. Review ICP, qualification, and loss reasons before increasing broad spend.</p></div></article>
    <article className="action-row"><span className="action-sequence">02</span><div><span className="priority-tag amber">Create the test</span><h4>Build an eligible coverage cohort</h4><p>{metric(data, "unreached_accounts")} CRM account domains, or {metric(data, "unreached_pct")}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and retain a holdout.</p></div></article>
    <article className="action-row"><span className="action-sequence">03</span><div><span className="priority-tag">Earn the scale</span><h4>Fund measurement before expansion</h4><p>Use the tracked budget to run a controlled test. Scale only if treatment creates incremental qualified pipeline.</p></div></article>
  </aside>;
}

function QualityTape({ data }: { data: DashboardData }) {
  const metrics = data.context.metrics;
  return <section className="quality-tape" aria-label="Evidence quality status">
    <div className="quality-tape-head"><span>Evidence quality</span><strong>Decision constraints</strong></div>
    <div className="quality-tape-grid">
      <div><span>Domain match</span><strong>{metrics.domain_match_rate}</strong><Progress label="Domain match" value={parseFloat(metrics.domain_match_rate) || 0} tone="teal" /></div>
      <div><span>Missing create dates</span><strong>{metrics.missing_create_dates}</strong><span className="quality-count">records with no create date</span></div>
      <div><span>Won deals at $0</span><strong>{metrics.zero_amount_won_share}</strong><Progress label="Won deals with zero recorded amount" value={parseFloat(metrics.zero_amount_won_share) || 0} tone="amber" /></div>
      <div><span>Unknown channel</span><strong>{metrics.unknown_channel_pct}</strong><Progress label="Unknown channel" value={parseFloat(metrics.unknown_channel_pct) || 0} tone="amber" /></div>
      <div><span>Linked wins</span><strong>{metrics.attribution_linked_won_share}</strong><Progress label="Linked wins" value={parseFloat(metrics.attribution_linked_won_share) || 0} tone="red" /></div>
    </div>
  </section>;
}

function StoryStrip({ data }: { data: DashboardData }) {
  return <section className="story-strip" aria-label="Decision story framing">
    <div><strong>Pipeline grew, but win quality weakened</strong><span><b>{metric(data, "cohort_start_win_rate")} → {metric(data, "cohort_end_win_rate")} closed win rate</b> among mature cohorts makes conversion quality the first guardrail.</span></div>
    <ArrowRight size={15} aria-hidden="true" />
    <div><strong>The largest measurable opportunity is reach</strong><span><b>{metric(data, "unreached_pct")} unreached</b> CRM account domains provide a clear audience for a controlled coverage test.</span></div>
    <ArrowRight size={15} aria-hidden="true" />
    <div><strong>Prove lift before moving budget</strong><span><b>{metric(data, "marketing_influenced_pipeline")} linked-journey signal</b> across {metric(data, "linked_opportunities")} opportunities shows presence—not causality.</span></div>
  </section>;
}

interface SectionProps { data: DashboardData; metadata: Map<string, ChartMetadata>; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; resetToken: number; }

function ChartGrid({ ids, data, presenting, totalPipeline, coverageMix, metadata, resetToken, className = "" }: { ids: string[]; data: DashboardData; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; metadata: Map<string, ChartMetadata>; resetToken: number; className?: string }) {
  return <div className={`chart-grid ${ids.length === 1 ? "single" : ids.length === 2 ? "two" : ""} ${className}`.trim()}>{ids.map((id) => <ChartCard key={`${id}-${resetToken}`} id={id} metadata={metadata.get(id)} data={data} totalPipeline={totalPipeline} coverageMix={coverageMix} presenting={presenting} />)}</div>;
}

function EvidenceTable({ title, columns, rows, note }: { title: string; columns: string[]; rows: (string | number | null)[][]; note?: ReactNode }) {
  const [sort, setSort] = useState<{ index: number; direction: 1 | -1 } | null>(null);
  const sortedRows = sort
    ? [...rows].sort((left, right) => compareValues(left[sort.index], right[sort.index], sort.direction))
    : rows;
  const numeric = columns.map((_, index) => numericColumn(rows.map((row) => row[index])));
  return <article className="evidence-table-card"><div className="table-heading"><div><h3>{title}</h3>{note && <p className="table-note">{note}</p>}</div><span>{rows.length} rows · sortable</span></div><div className="table-scroll" tabIndex={0} role="region" aria-label="Evidence table; scroll to read all rows and columns"><table className="evidence-table"><caption className="sr-only">{title}</caption><thead><tr>{columns.map((column, index) => { const active = sort?.index === index; return <th scope="col" key={column} className={numeric[index] ? "numeric" : undefined} aria-sort={active ? (sort?.direction === 1 ? "ascending" : "descending") : "none"}><button type="button" className="sort-button" onClick={() => setSort((current) => ({ index, direction: current?.index === index ? (current.direction * -1 as 1 | -1) : 1 }))}>{column}{active && <span>{sort.direction === 1 ? " ↑" : " ↓"}</span>}<ArrowUpDown size={11} aria-hidden="true" /></button></th>; })}</tr></thead><tbody>{sortedRows.map((row, rowIndex) => <tr key={`${title}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className={numeric[cellIndex] ? "numeric" : "text"}>{displayCell(columns[cellIndex], cell, formatContractCell(columns[cellIndex], cell))}</td>)}</tr>)}</tbody></table></div></article>;
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
  return <section id="s-exec" className="dashboard-section"><SectionIntro id="s-exec" data={data} /><ContextBox><strong>Follow the decision path:</strong> first, see where recorded pipeline and won revenue come from; second, identify where marketing appears before opportunities; third, choose the gap that can be tested. Because this is account-based marketing, the useful unit is the account—not a disconnected click or impression.</ContextBox><ChartGrid ids={["c-bar-channel", "c-donut-won", "c-monthly-trend"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AttributionSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-attrib" className="dashboard-section"><SectionIntro id="s-attrib" data={data} /><ContextBox><strong>Decision use:</strong> attribution shows where classified channels appear in tracked pre-opportunity journeys; it does not estimate incremental lift. Compare first-touch, last-touch, linear, and time-decay within the same 365-day linked population, while keeping CRM source credit separate.</ContextBox><EvidenceGrid items={[{ label: "Observed", title: "Marketing appears in measurable journeys", body: <>Sourced credit reconciles to the full CRM source view; influenced credit reconciles within the linked opportunity population. Each number must travel with its denominator.</>, tone: "high" }, { label: "Directional pattern", title: "Channels occupy different journey positions", body: <>Model differences show whether a channel tends to appear earlier or later in the observed path.</>, tone: "medium" }, { label: "Limit", title: "Credit is not causality", body: <>A touchpoint receiving credit means it appeared before opportunity creation; it does not mean that touch caused or closed the deal.</>, tone: "directional" }]} /><AttributionSensitivityPanel data={data} /><ChartGrid ids={["c-attrib-comparison", "c-sourced-influenced", "c-attrib-waterfall"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><AttributionTable data={data} /></section>;
}

function ChannelSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  const table = data.tables.channel_roi_summary;
  const rows = contractRows(table);
  const efficiencyRows = data.datasets.channel_pipeline.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ["channel_category", "spend_measurement_status", "pipeline_period_start", "pipeline_period_end", "spend_period_start", "spend_period_end", "period_matched_pipeline", "period_matched_won_amount", "period_matched_opportunities", "channel_spend", "pipeline_roi", "revenue_roi", "ratio_definition"].includes(key)))) as DataRow[];
  // Identifiers and the shared definition never count as a "measured value".
  const efficiencyLabelKeys = ["channel_category", "spend_measurement_status", "ratio_definition"];
  const ratioDefinition = constantText(efficiencyRows, "ratio_definition");
  return <section id="s-channel" className="dashboard-section"><SectionIntro id="s-channel" data={data} /><ContextBox><strong>Decision use:</strong> multiples compare same-period recorded CRM-sourced pipeline or won amount with tracked ad spend. Only two paid channels have tracked spend, so treat these as diagnostic efficiency ratios—not an incremental ROI ranking. <strong>Avg Deal</strong> uses opportunities with a populated amount.</ContextBox><EvidenceGrid items={[{ label: "Recorded outcome", title: "Relationship-led revenue is the strongest base", body: <>Existing-client and referral sources lead recorded won outcomes, so the current revenue story is broader than paid media.</>, tone: "high" }, { label: "Acquisition role", title: "Marketing channels build net-new pipeline", body: <>Judge acquisition channels through pipeline creation, later conversion, and time-to-close together.</>, tone: "medium" }, { label: "Decision gate", title: "Separate quality from volume", body: <>Increase spend only when added reach creates incremental qualified opportunities—not simply more activity.</>, tone: "directional" }]} /><ChartGrid ids={["c-spend-pipeline", "c-funnel"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><EvidenceTable title="Channel ROI Summary Table" note="Multiples = same-period recorded sourced pipeline or won amount / tracked spend. The period-matched inputs and observation windows are listed below. Channels without measured media spend remain unavailable rather than being assigned a zero-cost return." columns={table.columns} rows={rows} /><EvidenceDetails title="Period-matched efficiency inputs and observation windows" count={efficiencyRows.length}><DataTable id="period-matched-efficiency" provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: "channel_pipeline", scope: data.meta.period, methodology: data.meta.methodology }} label="Period-matched efficiency inputs and observation windows" rows={efficiencyRows} hideKeys={ratioDefinition ? ["ratio_definition"] : []} note={ratioDefinition ? <>Ratio definition: {ratioDefinition}.</> : undefined} isEmptyRow={(row) => Object.entries(row).every(([key, value]) => efficiencyLabelKeys.includes(key) || isMissing(value))} emptyRowNoun="channels" /></EvidenceDetails></section>;
}

function SegmentSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-segment" className="dashboard-section"><SectionIntro id="s-segment" data={data} /><ContextBox><strong>Decision use:</strong> CRM segment groups opportunities by the supplied market categories; profile fit is a separate current-account attribute. Use resolved opportunities for historical win rates, then require sufficient sample and an eligible audience before selecting a target cell.</ContextBox><ChartGrid className="segment-grid" ids={["c-seg-heatmap", "c-seg-winrate"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function CreativeSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-creative" className="dashboard-section"><SectionIntro id="s-creative" data={data} /><ContextBox><strong>Decision use:</strong> compare ad CTR only within platform. The supplied metadata covers a narrow creative subset, so format, message, and tone must be read as combined bundles—not independent winners.<br /><br /><strong>Email denominator:</strong> the email file records engagement events across {metric(data, "email_people")} people but contains no sent or delivered counts. It can suggest content tests; it cannot support campaign response rates.</ContextBox><ChartGrid ids={["c-creative-ctr", "c-creative-attr", "c-email-seniority"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function BudgetSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  return <section id="s-budget" className="dashboard-section"><SectionIntro id="s-budget" data={data} /><ContextBox><strong>Decision use:</strong> these are planning allocations, not an optimized channel mix. Each option preserves the current tracked envelope while reserving a different amount for a holdout and pre-registered test. The decision gate is incremental qualified pipeline—not click volume.</ContextBox><ChartGrid ids={["c-budget-scenario"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /></section>;
}

function AdvancedSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken }: SectionProps) {
  const velocityRows = data.datasets.deal_velocity_exclusions ?? [];
  const intervalDefinition = constantText(velocityRows, "interval_definition");
  return <section id="s-advanced" className="dashboard-section"><SectionIntro id="s-advanced" data={data} /><ContextBox><strong>Decision use:</strong> coverage, cohort, velocity and journey views describe observed patterns, not causal effects. A calendar-only win-probability baseline was withdrawn: its time-based holdout was near chance and predicted no wins, so no deal scores are shown.</ContextBox><EvidenceGrid items={[{ label: "Observed gap", title: "Reached tiers show higher observed rates", body: <>Unreached accounts show a {metric(data, "not_reached_opportunity_rate")} historical opportunity prevalence, while email-only accounts show {metric(data, "email_only_opportunity_rate")} and both-channel accounts show {metric(data, "both_channels_opportunity_rate")}. CRM outcomes can precede the reach window; selection and sales activity can explain the association.</>, tone: "high" }, { label: "Quality diagnosis", title: "Growth is not automatically healthy", body: <>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} in {metric(data, "cohort_start_quarter")} to {metric(data, "cohort_end_win_rate")} in {metric(data, "cohort_end_quarter")}.</>, tone: "medium" }, { label: "Next test", title: "Validate causality", body: <>Run a holdout or phased rollout to measure incremental lift from email-first outreach; test a 6sense overlay separately.</>, tone: "directional" }]} /><ChartGrid ids={["c-account-coverage", "c-deal-velocity", "c-journey", "c-targeting-matrix", "c-cohort"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><EvidenceDetails title="Won-deal duration eligibility by channel and motion" count={velocityRows.length}><DataTable id="velocity-eligibility" provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: "deal_velocity_exclusions", scope: "Canonical won outcomes", methodology: data.meta.methodology }} label="Canonical won duration eligibility by channel and motion" rows={velocityRows} hideKeys={intervalDefinition ? ["interval_definition"] : []} note={intervalDefinition ? <>Interval definition: {intervalDefinition}.</> : undefined} /></EvidenceDetails></section>;
}

function AppendixSection({ data, onOpen }: { data: DashboardData; onOpen: (id: SectionId) => void }) {
  const cards: Array<{ id: SectionId; label: string; title: string; body: string }> = [
    { id: "s-exec", label: "Overview", title: "Executive Summary", body: "Top-line pipeline, won revenue, and monthly trend views." },
    { id: "s-segment", label: "Targeting", title: "Segment & ICP", body: "Segment, industry, and ICP evidence for account prioritization." },
    { id: "s-creative", label: "Engagement", title: "Creative & Email", body: "Creative CTR and email engagement detail for messaging decisions." },
    { id: "s-budget", label: "Planning", title: "Budget Scenarios", body: "Tracked-spend scenarios for sizing controlled budget tests." },
    { id: "s-advanced", label: "Diagnostics", title: "Advanced Analytics", body: "Account coverage, deal velocity, journey, and targeting matrix detail." },
  ];
  return <section id="s-appendix" className="dashboard-section"><SectionIntro id="s-appendix" data={data} /><div className="appendix-grid">{cards.map((card) => <article className="appendix-card" key={card.id}><span className="priority-tag">{card.label}</span><h3>{card.title}</h3><p>{card.body}</p><button type="button" className="button button-small" onClick={() => onOpen(card.id)}>Open evidence <ArrowRight size={14} /></button></article>)}</div><EvidenceTable title="Case Deliverable Coverage" columns={data.tables.case_deliverable_coverage.columns} rows={contractRows(data.tables.case_deliverable_coverage)} /></section>;
}

function ConclusionSection({ data }: { data: DashboardData }) {
  const confidenceTable = data.tables.decision_confidence;
  const actionsTable = data.tables.recommended_actions;
  // Present the CMO plan in priority order (P1, P2, P3…) regardless of source order.
  const priorityIndex = actionsTable.columns.indexOf("Priority");
  const actionRows = priorityIndex < 0 ? contractRows(actionsTable) : [...contractRows(actionsTable)].sort((left, right) => String(left[priorityIndex] ?? "").localeCompare(String(right[priorityIndex] ?? ""), "en", { numeric: true }));
  return <section id="s-conclusion" className="dashboard-section conclusion-section">
    <SectionIntro id="s-conclusion" data={data} />
    <div className="conclusion-hero">
      <span className="hero-label">Decision for the CMO</span>
      <h3>Protect win quality, expand coverage to strong-fit unreached accounts, and require a holdout before scaling spend.</h3>
      <p>Tracked marketing appears in pre-opportunity journeys linked to {metric(data, "marketing_influenced_pipeline")} in recorded pipeline, while {metric(data, "unreached_accounts")} CRM account domains ({metric(data, "unreached_pct")}) have no tracked email or 6sense touch. Both are observational signals; the holdout determines whether broader coverage creates lift.</p>
    </div>
    <ContextBox><strong>How the evidence connects:</strong> cohort analysis identifies the risk, coverage identifies the opportunity, and attribution shapes the test. The holdout—not historical association—determines whether the strategy scales.</ContextBox>
    <div className="conclusion-grid">
      <article className="conclusion-card"><h3>What the evidence supports</h3><ul><li>Relationship-led sources anchor recorded won revenue.</li><li>Marketing appears at different positions in tracked pre-opportunity journeys.</li><li>A large unreached CRM audience creates a measurable growth test.</li></ul></article>
      <article className="conclusion-card"><h3>What could derail growth</h3><ul><li>Among mature cohorts, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}.</li><li>Only {metric(data, "attribution_linked_won_share")} of won deals link to classified marketing touches.</li><li>Sparse spend and creative metadata cannot identify an optimal budget or a standalone format winner.</li></ul></article>
      <article className="conclusion-card"><h3>What the CMO should authorize</h3><ul><li>Tighten ICP and qualification before adding broad top-of-funnel volume.</li><li>Launch an email-first account test with a retained holdout.</li><li>Test the 6sense overlay separately and scale only on incremental qualified pipeline.</li></ul></article>
    </div>
    <div className="priority-grid conclusion-priorities">
      <article className="priority-card"><h3><span className="priority-tag red">P1</span> Stabilize conversion quality</h3><p>Review ICP, qualification, and loss reasons before asking a larger funnel to carry weaker conversion.</p></article>
      <article className="priority-card"><h3><span className="priority-tag amber">P2</span> Run the coverage experiment</h3><p>Activate eligible strong-fit accounts with an account-level holdout and a pre-registered 90-day endpoint.</p></article>
      <article className="priority-card"><h3><span className="priority-tag">P3</span> Scale only on measured lift</h3><p>Release more budget only when treatment improves qualified opportunity creation without weakening win quality.</p></article>
    </div>
    <EvidenceTable title="Decision Confidence" note="This separates what the data directly supports from what remains an association or testable hypothesis." columns={confidenceTable.columns} rows={contractRows(confidenceTable)} />
    <EvidenceGrid items={[{ label: "Observed", body: <>Recorded pipeline, won amount, account coverage, and mature-cohort win-rate movement are directly measurable.</>, tone: "high" }, { label: "Associated", body: <>Marketing touches and reached-account outcomes move together in the observed data, but selection and sales activity may explain part of the pattern.</>, tone: "medium" }, { label: "Requires a test", body: <>Incremental channel lift, creative causality, and budget scaling require holdouts or phased experiments.</>, tone: "directional" }]} />
    <EvidenceTable title="CMO Action Plan" note="Each row connects the evidence to an action and the metric that decides whether it continues." columns={actionsTable.columns} rows={actionRows} />
    <div className="presenting-script"><h3>Tell the story in four moves</h3><div><strong>1. Lead with the tension</strong><span>Pipeline exists, but mature-cohort conversion has weakened.</span></div><div><strong>2. Show the opportunity</strong><span>Most CRM account domains remain unreached, creating a measurable test audience.</span></div><div><strong>3. Make the decision</strong><span>Protect qualification, run an email-first holdout, and test the 6sense overlay separately.</span></div><div><strong>4. Set the guardrail</strong><span>Scale only when the experiment creates incremental qualified pipeline without weakening win quality.</span></div></div>
  </section>;
}

function Progress({ value, tone, label }: { value: number; tone: string; label: string }) { return <div className="progress" role="progressbar" aria-label={label} aria-valuetext={`${value.toFixed(1)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={`progress-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }

function LegacyDashboard() {
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const caveatsTrigger = useRef<HTMLButtonElement>(null);
  const caveatsClose = useRef<HTMLButtonElement>(null);
  const caveatsWasOpen = useRef(false);
  const utilityMenu = useRef<HTMLDivElement>(null);
  const utilityTrigger = useRef<HTMLButtonElement>(null);
  const routeHasRendered = useRef(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<SectionId>("s-essential");
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenting, setPresenting] = useState(() => { try { return localStorage.getItem("dashboardMode") === "presentation"; } catch { return false; } });
  const [search, setSearch] = useState("");
  const [caveatsOpen, setCaveatsOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [printAll, setPrintAll] = useState(false);
  const [brief, setBrief] = useState<LatestBrief | null>(null);

  useEffect(() => {
    fetch("./dashboard-data.json")
      .then((response) => { if (!response.ok) throw new Error(`Dashboard data returned ${response.status}`); return response.json(); })
      .then((payload) => setData(validateDashboardPayload(payload)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard data"));
    // The latest findings band is additive: a missing or invalid v3 file never blocks the dashboard.
    fetch("./dashboard-data-v3.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (payload) setBrief(toLatestBrief(validateCaseStudyPayload(payload))); })
      .catch(() => setBrief(null));
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
    const shell = root.current;
    const targets = Array.from(shell.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) { ScrollTrigger.refresh(); return; }
    // Cards may only be hidden once GSAP is running: styles.css forces
    // [data-reveal] visible unless the shell carries .js-motion, so a failed or
    // interrupted tween can never leave evidence invisible.
    const reveal = () => targets.forEach((node) => { node.style.removeProperty("opacity"); node.style.removeProperty("visibility"); node.style.removeProperty("transform"); });
    let ctx: gsap.Context | null = null;
    try {
      ctx = gsap.context(() => { gsap.fromTo(targets, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: "power2.out", clearProps: "opacity,visibility,transform" }); ScrollTrigger.refresh(); }, shell);
      shell.classList.add("js-motion");
    } catch {
      shell.classList.remove("js-motion");
      reveal();
    }
    const fallback = window.setTimeout(() => { shell.classList.remove("js-motion"); reveal(); }, 2500);
    return () => { window.clearTimeout(fallback); ctx?.revert(); shell.classList.remove("js-motion"); };
  }, [data, active]);

  useEffect(() => { document.body.classList.toggle("presentation-mode", presenting); try { localStorage.setItem("dashboardMode", presenting ? "presentation" : "analyst"); } catch { /* In-memory mode remains usable. */ } const timer = window.setTimeout(() => ScrollTrigger.refresh(), 200); return () => { clearTimeout(timer); document.body.classList.remove("presentation-mode"); }; }, [presenting]);
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
    if (!utilityOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!utilityMenu.current?.contains(event.target as Node)) setUtilityOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setUtilityOpen(false);
        utilityTrigger.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [utilityOpen]);
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
    setInert(sidebar, caveatsOpen || (!menuOpen && window.matchMedia("(max-width: 900px)").matches));
    return () => { setInert(main, false); setInert(sidebar, false); };
  }, [menuOpen, caveatsOpen]);
  useEffect(() => {
    // "[" and "]" step through sections; ignored while typing or when an overlay is open.
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || menuOpen || caveatsOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key !== "[" && event.key !== "]") return;
      const index = sectionOrder.indexOf(active) + (event.key === "]" ? 1 : -1);
      if (index < 0 || index >= sectionOrder.length) return;
      event.preventDefault();
      const id = sectionOrder[index];
      setActive(id);
      if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, menuOpen, caveatsOpen]);
  useEffect(() => {
    // Collapsed supporting tables must still print.
    const beforePrint = () => { setPrintAll(true); document.querySelectorAll<HTMLDetailsElement>("details.evidence-details").forEach((node) => { node.open = true; }); };
    const afterPrint = () => setPrintAll(false);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);

  if (error) return <main className="load-state" role="alert"><span className="load-state-icon"><CircleAlert size={22} aria-hidden="true" /></span><h1>The evidence could not be loaded</h1><p>The dashboard only renders data that passes its validation contract, so nothing is shown rather than a partial view. Refreshing usually resolves a network interruption.</p><div className="load-state-actions"><button type="button" className="button button-primary" onClick={() => window.location.reload()}><RotateCcw size={14} aria-hidden="true" /> Try again</button><a className="button" href={`${(import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL}full-analysis/`}><ExternalLink size={14} aria-hidden="true" /> Open the analysis archive</a></div><details className="load-state-detail"><summary>Technical detail</summary><code>{error}</code></details></main>;
  if (!data) return <DashboardSkeleton />;

  const metrics = data.context.metrics;
  const refreshed = formatRefresh(data.meta.generated_at);
  // This map is intentionally derived after the loading guards. Keeping it as a
  // plain value avoids changing the hook order when the static contract loads.
  const metadata = new Map(data.chart_metadata.map((item) => [item.chart_id, item]));
  const totalPipeline = data.datasets.channel_pipeline.reduce((sum, row) => sum + numberValue(row, "total_pipeline"), 0);
  const targetAccounts = parseCount(metric(data, "target_accounts"));
  const unreached = parseCount(metric(data, "unreached_accounts"));
  const coverageMix: DataRow[] = [{ name: "Unreached", value: unreached }, { name: "Reached", value: Math.max(0, targetAccounts - unreached) }];
  const activeGroup = groups.find((group) => group.children.some((child) => child.id === active));
  const activeSection = activeGroup?.children.find((child) => child.id === active);
  const filteredGroups = groups.map((group) => ({ ...group, children: group.children.filter((child) => !search.trim() || `${group.label} ${child.label}`.toLowerCase().includes(search.trim().toLowerCase())) })).filter((group) => group.children.length || !search.trim());
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
    <aside id="dashboard-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} role={menuOpen ? "dialog" : undefined} aria-label="Dashboard sections" aria-modal={menuOpen ? "true" : undefined}><div className="brand"><span>RC</span><div><strong>Revenue Command</strong><small>Decision analytics · {data.meta.period}</small></div></div><button ref={closeButton} className="sidebar-close" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X /></button><div className="nav-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a section" aria-label="Search dashboard sections" />{search && <button type="button" aria-label="Clear section search" onClick={() => setSearch("")}><X size={14} /></button>}</div><nav className="section-nav">{filteredGroups.map((group) => <div className="nav-group" key={group.id}><div className="nav-group-label">{group.icon}<span>{group.label}</span></div>{group.children.map((item) => <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); openSection(item.id); }}><span>{item.label}</span>{active === item.id && <AnimatedNavIndicator />}</a>)}</div>)}</nav>{search.trim() && !hasSearchResults && <p className="nav-empty" role="status">No sections match “{search}”.</p>}<a className="legacy-link" href={`${(import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL}full-analysis/`}><ExternalLink size={15} /><span><strong>Full analysis archive</strong><small>Original Plotly reference</small></span></a><div className="sidebar-note"><ShieldCheck size={16} /><span>Validated Parquet evidence<br />Schema v{data.schema_version}</span></div></aside>{menuOpen && <button type="button" className="nav-backdrop" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation" />}
      <main id="main-content" tabIndex={-1}><header className="topbar"><div className="topbar-left"><button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="dashboard-navigation"><Menu size={18} /></button><div><h1>Revenue Command<span className="wide-title"> Center</span></h1><span className="top-context">{activeGroup && activeSection && activeSection.label !== activeGroup.label ? `${activeGroup.label} / ${activeSection.label}` : activeSection?.label ?? activeGroup?.label ?? "Dashboard"} · {data.meta.period}<span className="context-refresh"> · {refreshed} · {metrics.total_opportunities} opportunities</span></span></div></div><div className="top-actions"><span className="validated"><Check size={13} /> Validated snapshot</span><button ref={caveatsTrigger} className="action-button" type="button" title="View data caveats" onClick={() => setCaveatsOpen(true)} aria-haspopup="dialog" aria-expanded={caveatsOpen}><Info size={15} /> Caveats</button><button className="action-button utility-export" type="button" title="Export all evidence" onClick={() => downloadEvidence(data)}><Download size={15} /> Export</button><button className="action-button utility-print" type="button" title="Print all dashboard sections" onClick={() => { setPrintAll(true); window.setTimeout(() => { window.print(); window.setTimeout(() => setPrintAll(false), 1500); }, 120); }}><Printer size={15} /> Print</button><a className="action-button browser-deck-link" href="#present/main-01" title="Open the browser findings deck"><Presentation size={15} /> Findings deck</a><button className={`mode-button ${presenting ? "active" : ""}`} type="button" title={presenting ? "Switch to analyst mode" : "Switch to presentation mode"} onClick={togglePresentation} aria-pressed={presenting}><Presentation size={15} /> {presenting ? "Analyst mode" : "Presentation mode"}</button><button className="icon-button utility-reset" type="button" onClick={() => { setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setPrintAll(false); setResetToken((value) => value + 1); openSection("s-essential"); }} title="Reset dashboard" aria-label="Reset dashboard"><RotateCcw size={16} /></button><div ref={utilityMenu} className="utility-menu-wrap"><button ref={utilityTrigger} className="icon-button utility-more" type="button" aria-label="More dashboard actions" aria-haspopup={undefined} aria-expanded={utilityOpen} aria-controls="utility-menu" onClick={() => setUtilityOpen((value) => !value)}><MoreHorizontal size={18} /></button>{utilityOpen && <div id="utility-menu" className="utility-menu-popover" role="group" aria-label="Dashboard actions"><button type="button"  onClick={() => { downloadEvidence(data); setUtilityOpen(false); }}><Download size={16} /><span><strong>Export evidence</strong><small>Download the full validated dataset</small></span></button><button type="button"  onClick={() => { setUtilityOpen(false); setPrintAll(true); window.setTimeout(() => { window.print(); window.setTimeout(() => setPrintAll(false), 1500); }, 120); }}><Printer size={16} /><span><strong>Print dashboard</strong><small>Prepare every section for print</small></span></button><button type="button"  aria-pressed={presenting} onClick={() => { togglePresentation(); setUtilityOpen(false); }}><Presentation size={16} /><span><strong>{presenting ? "Analyst mode" : "Presentation mode"}</strong><small>{presenting ? "Restore the working layout" : "Expand the executive canvas"}</small></span></button><button type="button"  onClick={() => { setUtilityOpen(false); setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setPrintAll(false); setResetToken((value) => value + 1); openSection("s-essential"); }}><RotateCcw size={16} /><span><strong>Reset dashboard</strong><small>Return to the essential view</small></span></button></div>}</div></div></header>
      {active !== "s-essential" && !printAll ? <section className="command-strip is-compact" aria-label="Executive operating summary"><div className="command-decision"><h2>Fix conversion before buying volume. Prove reach before scaling spend.</h2></div><dl className="command-inline-kpis"><div><dt>Pipeline</dt><dd>{metrics.total_pipeline}</dd></div><div><dt>Won</dt><dd>{metrics.won_revenue}</dd></div><div><dt>Win rate</dt><dd>{metrics.closed_deal_win_rate}</dd></div></dl></section> : <section className="command-strip" aria-label="Executive operating summary"><div className="command-decision"><span>CMO decision · controlled growth</span><h2>Fix conversion before buying volume. Prove reach before scaling spend.</h2><p>Marketing-sourced deals convert lowest while referral converts best; history names the risk and the test audience, and a holdout decides the next budget move.</p></div><div className="command-kpis"><div><span>Total pipeline</span><strong>{metrics.total_pipeline}</strong><small>{metrics.total_opportunities} opportunities</small></div><div><span>Recorded won revenue</span><strong>{metrics.won_revenue}</strong><small>{metrics.closed_deal_win_rate} resolved win rate</small></div><div><span>Marketing sourced</span><strong>{metrics.marketing_sourced_pipeline}</strong><small>{metrics.marketing_sourced_share} of pipeline</small></div><div><span>Marketing-linked</span><strong>{metrics.marketing_influenced_pipeline}</strong><small>{metrics.attribution_linked_won_share} of wins linked</small></div></div></section>}
      {(active === "s-essential" || printAll) && brief && <LatestFindings brief={brief} data={data} />}
      {(active === "s-essential" || printAll) && <StoryStrip data={data} />}
      <div className="progress-rail" aria-label={`Section ${sectionOrder.indexOf(active) + 1} of ${sectionOrder.length}`}><span style={{ width: "100%", transform: `scaleX(${(sectionOrder.indexOf(active) + 1) / sectionOrder.length})`, transformOrigin: "left center" }} /></div>
      <div className={`section-viewport ${printAll ? "print-all" : ""}`}>{printAll ? sectionOrder.map((id) => <div className="print-section" key={id}>{renderSection(id)}</div>) : <>{renderSection(active)}<SectionPager active={active} onOpen={openSection} /></>}</div>
      <footer><div className="footer-id"><strong>Marketing Analytics Decision System</strong><span>{refreshed}{data.meta.snapshot_id ? ` · Snapshot ${data.meta.snapshot_id}` : ""} · Schema v{data.schema_version}</span></div><p><span className="footer-label">Source</span> {data.meta.generated_from} · {data.meta.methodology}</p><button type="button" className="text-button back-to-top" onClick={() => { window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); document.querySelector<HTMLElement>("#main-content")?.focus({ preventScroll: true }); }}><ArrowUp size={14} aria-hidden="true" /> Back to top</button></footer>
    </main>
    {caveatsOpen && <><button type="button" tabIndex={-1} className="drawer-backdrop" aria-hidden="true" aria-label="Close caveats" onClick={() => setCaveatsOpen(false)} /><aside className="caveats-drawer" role="dialog" aria-modal="true" aria-labelledby="caveats-title"><div className="drawer-head"><h2 id="caveats-title">Data Caveats</h2><button ref={caveatsClose} type="button" className="icon-button" onClick={() => setCaveatsOpen(false)} aria-label="Close caveats"><X size={17} /></button></div><p>These constraints stay visible because they change what the dashboard can safely claim.</p><ul>{data.context.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul><div className="drawer-source"><strong>Methodology</strong><span>{data.meta.methodology}</span></div></aside></>}
  </div>;
}

function CaseStudyPresentation({ presenter = false }: { presenter?: boolean }) {
  const [data, setData] = useState<CaseStudyData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("./dashboard-data-v3.json", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`Presentation evidence returned ${response.status}`); return response.json(); })
      .then((payload) => setData(validateCaseStudyPayload(payload)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load presentation evidence"));
  }, []);
  if (error) return <main className="load-state" role="alert"><CircleAlert size={24} /><h1>Presentation evidence did not load.</h1><p>{error}</p><a className="button" href="#s-essential">Return to dashboard</a></main>;
  if (!data) return <main className="load-state" aria-live="polite"><span className="loader" /><p>Loading case-study evidence…</p></main>;
  return <PresentationApp data={data} presenter={presenter} />;
}

function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => { const sync = () => setRoute(window.location.hash); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  if (route.startsWith("#presenter/")) return <CaseStudyPresentation presenter />;
  if (route.startsWith("#present/")) return <CaseStudyPresentation />;
  return <LegacyDashboard />;
}

export default App;
