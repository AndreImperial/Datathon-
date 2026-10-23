import { compareValues, serializeEvidenceCsv, formatField, fieldUnit, columnLabel, formatCount, formatDollarsCompact, formatPercent, listPhrase, topRows } from "./evidence";
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
interface LatestBrief {
  summary: DataRow;
  findings: CaseStudyData["findings"];
  recommendations: CaseStudyData["recommendations"];
  /** 2023–24 new-logo source groups that are ranked, best win rate first. */
  sourceGroups: DataRow[];
  scenarios: DataRow[];
  methodVersion: string;
  snapshotId: string;
}
function toLatestBrief(payload: CaseStudyData): LatestBrief | null {
  const summary = payload.datasets?.summary?.[0];
  if (!summary) return null;
  const sourceGroups = (payload.datasets?.source_group_scorecard ?? [])
    .filter((row) => row.ranked_channel === true && textValue(row, "business_motion") === "Acquisition" && /2023/.test(textValue(row, "scope")) && Number.isFinite(numberValue(row, "win_rate")))
    .sort((a, b) => numberValue(b, "win_rate") - numberValue(a, "win_rate"));
  return { summary, findings: payload.findings ?? [], recommendations: payload.recommendations ?? [], sourceGroups, scenarios: payload.datasets?.experiment_scenarios ?? [], methodVersion: payload.meta?.method_version ?? "", snapshotId: payload.meta?.snapshot_id ?? "" };
}

/* ------------------------------------------------------------------------- *
 * The story (Knaflic). One big idea, stated identically in the hero, the
 * compact strip and the conclusion; every section title is an action title
 * built from the data, tagged with its place in the arc
 * context -> tension -> resolution -> ask. Reading only the titles in order
 * tells the whole story (horizontal logic).
 * ------------------------------------------------------------------------- */
const BIG_IDEA = "Fix conversion before buying volume. Prove reach before scaling spend.";

type ArcStage = "Big idea" | "Context" | "Tension" | "Resolution" | "Evidence" | "Ask";
const arcStage: Record<SectionId, ArcStage> = {
  "s-essential": "Big idea",
  "s-exec": "Context",
  "s-attrib": "Tension",
  "s-channel": "Tension",
  "s-segment": "Resolution",
  "s-creative": "Resolution",
  "s-budget": "Resolution",
  "s-advanced": "Resolution",
  "s-appendix": "Evidence",
  "s-conclusion": "Ask",
};

interface StoryNumbers {
  marketingRate?: string; bestSource?: string; bestRate?: string; rankedSources?: number;
  openPipeline?: string; eligible?: string; defaultNeed?: string; defaultLabel?: string;
  feasibleLabel?: string; feasibleNeed?: string; zeroWins?: string; zeroMrr?: string;
}
/** Every figure the narrative quotes, read from the v3 brief; absent when the brief is unavailable. */
function storyNumbers(brief: LatestBrief | null): StoryNumbers {
  if (!brief) return {};
  const s = brief.summary;
  const num = (key: string) => numberValue(s, key);
  const out: StoryNumbers = {};
  if (Number.isFinite(num("marketing_recent_win_rate"))) out.marketingRate = pct(num("marketing_recent_win_rate"));
  if (Number.isFinite(num("recent_best_win_rate"))) { out.bestRate = pct(num("recent_best_win_rate")); out.bestSource = textValue(s, "recent_best_rate_source") || "the best source"; }
  if (brief.sourceGroups.length) out.rankedSources = brief.sourceGroups.length;
  if (Number.isFinite(num("open_pipeline"))) out.openPipeline = money(num("open_pipeline"));
  if (Number.isFinite(num("zero_amount_wins"))) out.zeroWins = formatCount(num("zero_amount_wins"));
  if (Number.isFinite(num("zero_amount_win_mrr"))) out.zeroMrr = money(num("zero_amount_win_mrr"));
  const scenarios = brief.scenarios.filter((row) => Number.isFinite(numberValue(row, "required_total")));
  const eligible = Number.isFinite(num("eligible_domains")) ? num("eligible_domains") : numberValue(scenarios[0] ?? {}, "eligible_audience");
  if (Number.isFinite(eligible)) out.eligible = formatCount(eligible);
  const label = (row: DataRow) => `${pct(numberValue(row, "baseline_rate")).replace(".0%", "%")} baseline, +${Math.round(numberValue(row, "absolute_lift") * 100)}pp lift`;
  // The deck's default design is the 5% baseline / +2pp scenario.
  const defaultRow = scenarios.find((row) => numberValue(row, "baseline_rate") === 0.05 && numberValue(row, "absolute_lift") === 0.02);
  if (defaultRow) { out.defaultNeed = formatCount(numberValue(defaultRow, "required_total")); out.defaultLabel = label(defaultRow); }
  const feasible = scenarios.filter((row) => row.feasible === true).sort((a, b) => numberValue(a, "absolute_lift") - numberValue(b, "absolute_lift") || numberValue(a, "required_total") - numberValue(b, "required_total"))[0];
  if (feasible) { out.feasibleLabel = label(feasible); out.feasibleNeed = formatCount(numberValue(feasible, "required_total")); }
  return out;
}

/** The single sentence of evidence that travels with the big idea. */
function bigIdeaSupport(data: DashboardData, n: StoryNumbers): string {
  if (n.marketingRate && n.bestRate) return `Marketing-sourced new logos win ${n.marketingRate} of resolved deals; ${n.bestSource} wins ${n.bestRate} (2023–24). Fix the handoff first, then let a holdout decide the next budget move.`;
  return `Mature-cohort win rate fell from ${metric(data, "cohort_start_win_rate")} to ${metric(data, "cohort_end_win_rate")} while ${metric(data, "unreached_pct")} of account domains went unreached. Fix qualification first, then let a holdout decide the next budget move.`;
}

interface SectionCopy { title: string; description: string; takeaway: string }
function sectionCopy(id: SectionId, data: DashboardData, n: StoryNumbers): SectionCopy {
  const m = (key: string) => metric(data, key);
  switch (id) {
    case "s-essential": return {
      title: `Win quality fell ${m("cohort_start_win_rate")} → ${m("cohort_end_win_rate")} while ${m("unreached_pct")} of accounts went unreached`,
      description: "Three charts carry the case: what marketing contributes, how conversion is trending, and which accounts no campaign has touched.",
      takeaway: "Decision: tighten qualification first, then test reach on unreached strong-fit accounts with a holdout.",
    };
    case "s-exec": return {
      title: `Three sources hold ${m("top3_pipeline_share")} of ${m("total_pipeline")} recorded pipeline`,
      description: n.openPipeline ? `Relationship-led sources anchor recorded wins. Only ${n.openPipeline} of the ${m("total_pipeline")} is still open, so read these as history, not as a forecast.` : "Relationship-led sources anchor recorded wins; marketing sources show where net-new pipeline enters.",
      takeaway: "Context: today's revenue base is relationship-led; marketing's job is net-new pipeline that converts.",
    };
    case "s-attrib": return {
      title: `Only ${m("attribution_linked_won_share")} of won deals link to a tracked marketing touch`,
      description: "Email, web and 6sense logs cover 2024 only. Four models show where tracked channels appear before an opportunity, not what caused it.",
      takeaway: "So what: report CRM source and linked-journey credit side by side, and use a holdout to measure lift.",
    };
    case "s-channel": return {
      title: n.marketingRate && n.bestRate ? `Marketing-sourced new logos win ${n.marketingRate}, the lowest of ${n.rankedSources ?? "the"} sources; ${n.bestSource} wins ${n.bestRate}` : "Relationship-led sources win more often; marketing must prove lift",
      description: `New-logo opportunities created 2023–24, resolved outcomes only. Tracked spend exists for just ${m("tracked_spend_channels").split(",").filter(Boolean).length} paid channels, too few to rank ROI.`,
      takeaway: "So what: fix the marketing-to-sales handoff before buying more volume, and build referral asks into account reviews.",
    };
    case "s-segment": {
      const rows = data.datasets.segment_win_rate.filter((row) => numberValue(row, "deals") >= 30 && Number.isFinite(numberValue(row, "win_rate")));
      const best = [...rows].sort((a, b) => numberValue(b, "win_rate") - numberValue(a, "win_rate"))[0];
      const biggest = [...rows].sort((a, b) => numberValue(b, "pipeline") - numberValue(a, "pipeline"))[0];
      const name = (row: DataRow) => textValue(row, "segment__c");
      const title = best && biggest && best !== biggest
        ? `${name(best)} wins ${pct(numberValue(best, "win_rate"))}; ${name(biggest)}, the biggest pipeline, wins ${pct(numberValue(biggest, "win_rate"))}`
        : "Target fit with proven history, not deal size";
      return { title, description: "Closed-deal win rate by CRM segment, with industry concentration and profile fit. Small cells stay exploratory.", takeaway: "So what: aim the test at strong-fit cells with enough resolved history; treat small cells as exploratory." };
    }
    case "s-creative": return {
      title: "Creative labels are too sparse to name a winner; test matched variants",
      description: `Ad CTR is compared only within platform. The email file logs engagement across ${m("email_people")} people but has no send counts, so it cannot give response rates.`,
      takeaway: "So what: carry the strongest ads into a matched test; fix creative metadata before any tone or format claim.",
    };
    case "s-budget": return {
      title: n.eligible && n.feasibleLabel ? `Keep spend flat: ${n.eligible} eligible domains can only detect a ${n.feasibleLabel.split(", ")[1]} on a ${n.feasibleLabel.split(", ")[0]}` : "Keep spend flat and fund a holdout before expansion",
      description: n.eligible && n.defaultNeed ? `The default test (${n.defaultLabel}) needs ${n.defaultNeed} domains; only ${n.eligible} are eligible. Size the test to the audience, or widen the audience first.` : "Each plan keeps the tracked envelope and reserves a holdout. No pipeline forecast is shown; paid outcomes are too sparse.",
      takeaway: "So what: keep the budget envelope, reserve the holdout, and release more only on incremental qualified pipeline.",
    };
    case "s-advanced": return {
      title: n.eligible ? `${m("unreached_accounts")} account domains are unreached; ${n.eligible} are eligible to test` : `${m("unreached_accounts")} account domains (${m("unreached_pct")}) are unreached: that is the test audience`,
      description: "Coverage and the targeting matrix pick the audience; cohorts, velocity and journeys set expectations. The win-probability model was withdrawn after a near-chance holdout, so no deal scores are shown.",
      takeaway: "So what: exclude customers and open pipeline, randomize strong-fit domains, and keep a holdout.",
    };
    case "s-appendix": return {
      title: "Every number traces to a population, a denominator and a limit",
      description: "Definitions, diagnostics and deliverable coverage for judge questions, kept out of the main story.",
      takeaway: "When challenged: trace each recommendation to its population, denominator and limitation.",
    };
    case "s-conclusion": return {
      title: "Approve three decisions, each with an owner and a measure",
      description: "Each decision names who owns it, the first step, the metric that decides it, and when to stop.",
      takeaway: "Bottom line: fix conversion, record value, and scale only what a holdout proves.",
    };
  }
}

/*
 * Explanation copy that quotes a figure reads it from the loaded contract, so a
 * data refresh can never leave a stale number in the prose. Static strings may
 * still use {metric_key} placeholders (see interpolate).
 */
type Copy<T> = T | ((data: DashboardData) => T);
const resolveCopy = <T,>(copy: Copy<T>, data: DashboardData): T => (typeof copy === "function" ? (copy as (data: DashboardData) => T)(data) : copy);

// CRM categories that are not marketing programmes; mirrors the chart's split (Charts.tsx).
const NON_MARKETING_CHANNELS = new Set(["other", "existing_client", "referral"]);
const channelRows = (data: DashboardData, chartId: string) => data.chart_data?.[chartId] ?? data.datasets.channel_pipeline;
/** "A at $1.5M, B at $1.1M, and C at $678K" for the largest channels by `key`. */
function channelLeaders(data: DashboardData, chartId: string, key: string, limit: number, keep: (row: DataRow) => boolean = () => true): { count: number; phrase: string } {
  const rows = topRows(channelRows(data, chartId), key, limit, keep);
  return { count: rows.length, phrase: listPhrase(rows.map((row) => `${displayName(textValue(row, "channel_category"))} at ${money(numberValue(row, key))}`)) };
}
/** Channels whose media spend is tracked, as display names. */
const trackedSpendChannels = (data: DashboardData) => data.datasets.channel_pipeline.filter((row) => textValue(row, "spend_measurement_status") === "tracked").map((row) => displayName(textValue(row, "channel_category")));
const countWord = (value: number) => ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][value] ?? formatCount(value);

const explain: Record<string, { title: string; body: Copy<ReactNode>; insight: Copy<string> }> = {
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
    insight: (data) => {
      const leaders = channelLeaders(data, "c-bar-channel", "total_pipeline", 3, (row) => !NON_MARKETING_CHANNELS.has(textValue(row, "channel_category")));
      const lead = leaders.count ? `By recorded pipeline, the largest named marketing ${leaders.count === 1 ? "source is" : "sources are"} ${leaders.phrase}. ` : "";
      return `${lead}Treat that ordering as a starting point for investigation, not a causal leaderboard.`;
    },
  },
  "c-donut-won": {
    title: "What this shows - Won Revenue by Channel",
    body: <>This view shows recorded won amount by CRM lead source; only sources with a positive won amount appear.<br /><br /><strong>Decision use:</strong> separate the relationship-led revenue base from the acquisition channels expected to create future pipeline. The chart describes recorded outcomes, not incremental channel value.</>,
    insight: (data) => {
      const leaders = channelLeaders(data, "c-donut-won", "won_pipeline", 2);
      const lead = leaders.count ? `The largest recorded won-revenue ${leaders.count === 1 ? "channel is" : "channels are"} ${leaders.phrase}. ` : "";
      return `${lead}Judge marketing channels with pipeline maturity and conversion timing in view.`;
    },
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
    insight: (data) => {
      const tracked = trackedSpendChannels(data);
      return `${tracked.length ? `Only ${listPhrase(tracked)} ${tracked.length === 1 ? "has" : "have"} tracked spend, so use` : "Use"} this to choose where to investigate marginal spend — it is not a full marketing budget model.`;
    },
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
    body: <>CTR is clicks divided by impressions. LinkedIn and 6sense are ranked separately because their delivery mechanics and baselines differ; only high-volume ads above the impression threshold in the chart subtitle appear.<br /><br /><strong>Decision use:</strong> carry the strongest observed ads into a controlled comparison. Do not infer which format, message, tone, or CTA caused the result unless the variants isolate that one difference.</>,
    insight: "Use the highest-CTR ads as test candidates, then isolate creative variables before shifting budget or declaring a format winner.",
  },
  "c-creative-attr": {
    title: "What this shows - 6sense CTR by Recorded Copy Tone",
    body: <>This aggregates 6sense creative by copy-tone label and shows weighted CTR, impression volume, and distinct ad count.<br /><br /><strong>How to use it:</strong> most 6sense impressions have an Unknown tone, while labeled tones have much smaller samples. Improve creative metadata before making a portfolio-wide tone recommendation.</>,
    insight: "Treat labeled tone differences as test hypotheses; fixing metadata coverage is the first action.",
  },
  "c-email-seniority": {
    title: "What this shows - Email Engagement-Event Mix by Job Seniority",
    body: (data) => <>The supplied email file contains {metric(data, "email_events")} engagement events across {metric(data, "email_people")} people. It does not contain sent or delivered counts. Click-event share is click rows divided by all recorded engagement rows for the seniority group. This is event composition, not a send-based click rate.<br /><br /><strong>How to use it:</strong> treat a higher click-event share as a hypothesis for message relevance. Acquire delivery denominators before judging subject lines, true open rates, or true click-through rates.</>,
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
    insight: (data) => {
      // The leading cell is the highest adjusted win rate among decision-grade (n >= 30) cells.
      const rows = data.chart_data?.["c-targeting-matrix"] ?? data.datasets.targeting;
      const [best] = topRows(rows, "adjusted_win_rate", 1, (row) => textValue(row, "evidence_tier") === "decision-grade");
      const lead = best ? `${textValue(best, "segment__c")} + ${textValue(best, "accountprofilefit6sense__c")} Fit has the highest adjusted win rate among decision-grade cells (${pct(numberValue(best, "adjusted_win_rate"))} across ${formatCount(numberValue(best, "resolved_deals"))} resolved deals). ` : "";
      return `${lead}Treat fit as a current-snapshot association, not proof of historical targeting effectiveness.`;
    },
  },
  "c-cohort": {
    title: "What this shows - Pipeline Cohort Analysis by Quarter",
    body: <>Blue bars show pipeline created each quarter. The quality panel shows closed-deal win rate and resolved share so newer cohorts are not treated as mature evidence. The resolved-share line explains why recent cohorts remain provisional until they cross the 80% maturity gate.</>,
    insight: "Among mature cohorts, closed-deal win rate moved from {cohort_start_win_rate} in {cohort_start_quarter} to {cohort_end_win_rate} in {cohort_end_quarter}. Investigate whether the decline reflects ICP fit, qualification, or source mix; do not treat unresolved recent cohorts as equivalent to fully matured cohorts.",
  },
};

const GENERIC_CAVEAT = "Source-backed metric; see the analyst explanation and caveat in this section.";

// One formatter per unit, shared by tiles, titles and tables (evidence.ts).
const money = formatDollarsCompact;
const pct = (value: number) => formatPercent(value);
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
  downloadRows("marketing-dashboard-evidence.csv", [...datasetRows, ...chartRows, ...tableRows], { snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", generated_from: data.meta.generated_from, scope: data.meta.period, methodology: data.meta.methodology });
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
      {info && details && <div className="explanation-body" id={explanationId}><p>{resolveCopy(info.body, data)}</p><div className="insight"><Sparkles size={14} aria-hidden="true" />{interpolate(resolveCopy(info.insight, data), data)}</div></div>}
    </div>}
    {table && <DataTable id={tableId} rows={chartRows} label={`${title} data`} provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: metadata?.source_dataset ?? "Unavailable", scope: subtitle, methodology: data.meta.methodology, caveat: metadata?.caveat ?? "" }} />}
    {presenting && <span className="presentation-mark" aria-hidden="true">Evidence</span>}
  </article>;
}

/**
 * Action-title intro: the eyebrow places the section in the arc, the h2 states
 * the takeaway (not the topic), one sentence says what the evidence below is,
 * and the "so what" line carries the single accent mark.
 */
function SectionIntro({ id, data, story }: { id: SectionId; data: DashboardData; story: StoryNumbers }) {
  const item = sectionCopy(id, data, story);
  const [label, ...rest] = item.takeaway.split(":");
  const position = sectionOrder.indexOf(id) + 1;
  const group = sectionGroupLabel(id);
  const sectionName = sectionLabel(id);
  const stage = arcStage[id];
  return <><div className="section-heading"><div className="section-title-block"><span className="section-eyebrow"><span className="section-index"><span className="sr-only">Section </span>{String(position).padStart(2, "0")}<span className="sr-only"> of {sectionOrder.length}</span><span aria-hidden="true"> / {String(sectionOrder.length).padStart(2, "0")}</span></span><span className={`arc-stage arc-${stage.toLowerCase().replace(" ", "-")}`}>{stage}</span><span className="section-topic">{group && group !== sectionName ? `${group} · ${sectionName}` : sectionName}</span></span><h2>{item.title}</h2></div><p>{item.description}</p></div><div className="section-takeaway"><div className="takeaway-copy"><strong>{label}:</strong><span>{rest.join(":")}</span></div></div></>;
}

/** Method notes stay one click away instead of standing between a title and its evidence. */
function ReadingNote({ children }: { children: ReactNode }) {
  return <details className="evidence-details reading-note"><summary><Info size={14} aria-hidden="true" /><span>How to read this section</span><ChevronDown size={14} aria-hidden="true" /></summary><div className="reading-note-body">{children}</div></details>;
}

function LatestFindings({ brief, data }: { brief: LatestBrief; data: DashboardData }) {
  const s = brief.summary;
  const has = (key: string) => typeof s[key] === "number" && Number.isFinite(s[key] as number);
  const finding = (id: string) => brief.findings.find((item) => item.id === id);
  const withdrawnCaveat = data.context.caveats.find((caveat) => /withdrawn/i.test(caveat));
  const tiles: Array<{ key: string; label: string; value: string; context: ReactNode; status: string; tone: "risk" | "neutral" }> = [];
  // Ordered as the argument runs: the problem (the one accent), the proof point, then the two limits a CMO must know.
  if (has("marketing_recent_win_rate")) tiles.push({ key: "marketing", label: "Marketing-sourced new-logo win rate", value: pct(numberValue(s, "marketing_recent_win_rate")), context: <>Lowest of {brief.sourceGroups.length || "the"} sources, 2023–24{has("recent_best_win_rate") && <> · {textValue(s, "recent_best_rate_source") || "best source"} wins {pct(numberValue(s, "recent_best_win_rate"))}</>}</>, status: finding("f-marketing")?.evidence_status ?? "Observed", tone: "risk" });
  if (textValue(s, "top_channel")) tiles.push({ key: "referral", label: "Strongest new-logo source", value: textValue(s, "top_channel"), context: <>{has("top_channel_win_rate") && <>{pct(numberValue(s, "top_channel_win_rate"))} win rate, 2018–2024 · </>}most recorded new-logo won amount</>, status: finding("f-channel")?.evidence_status ?? "Observed", tone: "neutral" });
  if (has("zero_amount_win_mrr")) tiles.push({ key: "mrr", label: "MRR on wins recorded at $0", value: `${money(numberValue(s, "zero_amount_win_mrr"))}/mo`, context: <>{has("zero_amount_wins") && has("won") ? <>{formatCount(numberValue(s, "zero_amount_wins"))} of {formatCount(numberValue(s, "won"))} wins carry no amount; </> : null}shown beside won amount, never added</>, status: finding("f-value")?.evidence_status ?? "Observed", tone: "neutral" });
  if (withdrawnCaveat) tiles.push({ key: "model", label: "Win-probability model", value: "Withdrawn", context: <>Holdout was near chance, so no deal scores are published</>, status: "Not used", tone: "neutral" });
  if (!tiles.length) return null;
  return <section className="latest-findings" aria-labelledby="latest-findings-title">
    <div className="latest-findings-head"><div><span className="latest-kicker">Evidence{brief.methodVersion && ` · ${brief.methodVersion}`}</span><h2 id="latest-findings-title">{countWord(tiles.length)} finding{tiles.length === 1 ? "" : "s"} behind the decision</h2></div><a className="text-button latest-deck-link" href="#present/main-01">Walk through the findings deck <ArrowRight size={14} aria-hidden="true" /></a></div>
    <dl className="latest-findings-grid">{tiles.map((tile) => <div key={tile.key} className={`latest-tile tone-${tile.tone}`}><dt>{tile.label}</dt><dd className="latest-value">{tile.value}</dd><dd className="latest-context">{tile.context}</dd><dd className="latest-status">{tile.status}</dd></div>)}</dl>
  </section>;
}

function SectionPager({ active, onOpen }: { active: SectionId; onOpen: (id: SectionId) => void }) {
  const index = sectionOrder.indexOf(active);
  const previous = index > 0 ? sectionOrder[index - 1] : undefined;
  const next = index < sectionOrder.length - 1 ? sectionOrder[index + 1] : undefined;
  const link = (id: SectionId, direction: "previous" | "next") => <a className={`pager-link pager-${direction}`} href={`#${id}`} onClick={(event) => { event.preventDefault(); onOpen(id); }} aria-keyshortcuts={direction === "next" ? "]" : "["}>
    {direction === "previous" && <ArrowLeft size={16} aria-hidden="true" />}
    <span><small>{direction === "previous" ? "Previous" : "Next"} · {String(sectionOrder.indexOf(id) + 1).padStart(2, "0")} · {arcStage[id]}</small><strong>{sectionLabel(id)}</strong></span>
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

function PriorityGrid({ data, onOpen }: { data: DashboardData; onOpen: (id: SectionId) => void }) {
  return <aside className="action-queue" aria-label="Recommended action queue">
    <div className="action-queue-head"><div><h3>The next three decisions</h3><span>Owners and measures in the ask</span></div><a className="text-button" href="#s-conclusion" onClick={(event) => { event.preventDefault(); onOpen("s-conclusion"); }}>Go to the ask <ArrowRight size={13} aria-hidden="true" /></a></div>
    <article className="action-row"><span className="action-sequence">01</span><div><span className="priority-tag red">Protect the base</span><h4>Diagnose conversion quality</h4><p>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} to {metric(data, "cohort_end_win_rate")}. Review ICP, qualification, and loss reasons before increasing broad spend.</p></div></article>
    <article className="action-row"><span className="action-sequence">02</span><div><span className="priority-tag muted">Create the test</span><h4>Build an eligible coverage cohort</h4><p>{metric(data, "unreached_accounts")} CRM account domains, or {metric(data, "unreached_pct")}, have no tracked email or 6sense touch. Prioritize strong-fit accounts and retain a holdout.</p></div></article>
    <article className="action-row"><span className="action-sequence">03</span><div><span className="priority-tag muted">Earn the scale</span><h4>Fund measurement before expansion</h4><p>Use the tracked budget to run a controlled test. Scale only if treatment creates incremental qualified pipeline.</p></div></article>
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

/**
 * The narrative arc as navigation: reading the four steps left to right is
 * the whole argument, and each step opens the section that proves it. Only
 * the tension step wears the accent.
 */
function ArcStrip({ data, story, onOpen }: { data: DashboardData; story: StoryNumbers; onOpen: (id: SectionId) => void }) {
  const steps: Array<{ stage: ArcStage; target: SectionId; line: string; detail: string }> = [
    // Words carry the arc; each detail adds a figure the tiles below do not repeat.
    { stage: "Context", target: "s-exec", line: "Revenue is relationship-led", detail: `Three sources hold ${metric(data, "top3_pipeline_share")} of recorded pipeline` },
    { stage: "Tension", target: "s-channel", line: story.marketingRate ? "Marketing-sourced deals convert worst" : "Win quality is falling", detail: `Mature-cohort win rate ${metric(data, "cohort_start_win_rate")} → ${metric(data, "cohort_end_win_rate")}` },
    { stage: "Resolution", target: "s-budget", line: "Fix the handoff; size the test to the audience", detail: story.eligible && story.defaultNeed ? `${story.eligible} eligible domains; default test needs ${story.defaultNeed}` : `${metric(data, "unreached_accounts")} account domains unreached` },
    { stage: "Ask", target: "s-conclusion", line: "Approve three decisions", detail: "Each with an owner, a measure and a stop rule" },
  ];
  return <nav className="arc-strip" aria-label="The story in four steps">
    <ol>{steps.map((step) => <li key={step.stage} className={step.stage === "Tension" ? "is-tension" : undefined}><a href={`#${step.target}`} onClick={(event) => { event.preventDefault(); onOpen(step.target); }}><span className="arc-step-stage">{step.stage}</span><strong>{step.line}</strong><span className="arc-step-detail">{step.detail}</span></a></li>)}</ol>
  </nav>;
}

interface SectionProps { data: DashboardData; metadata: Map<string, ChartMetadata>; presenting: boolean; totalPipeline: number; coverageMix: DataRow[]; resetToken: number; brief: LatestBrief | null; story: StoryNumbers; onOpen: (id: SectionId) => void; }

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

function EssentialSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story, onOpen }: SectionProps) {
  const chartProps = { data, presenting, totalPipeline, coverageMix };
  const plan = data.tables.essential_action_plan;
  return <section id="s-essential" className="dashboard-section essential-section"><SectionIntro id="s-essential" data={data} story={story} />
    <div className="command-canvas">
      <div className="command-evidence">
        <div className="command-chart-pair">
          {/* Tension first: the conversion trend, then what marketing contributes. */}
          <ChartCard key={`c-essential-cohort-${resetToken}`} id="c-essential-cohort" metadata={metadata.get("c-essential-cohort")} {...chartProps} />
          <ChartCard key={`c-essential-contribution-${resetToken}`} id="c-essential-contribution" metadata={metadata.get("c-essential-contribution")} {...chartProps} />
        </div>
        <ChartCard key={`c-essential-coverage-${resetToken}`} id="c-essential-coverage" metadata={metadata.get("c-essential-coverage")} {...chartProps} />
      </div>
      <div className="command-rail"><PriorityGrid data={data} onOpen={onOpen} /><QualityTape data={data} /></div>
    </div>
    <EvidenceDetails title="Essential action plan: why and next step" count={plan.rows.length}><EvidenceTable title="Essential Action Plan" columns={plan.columns} rows={contractRows(plan)} /></EvidenceDetails>
  </section>;
}

function ExecutiveSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  return <section id="s-exec" className="dashboard-section"><SectionIntro id="s-exec" data={data} story={story} /><ChartGrid ids={["c-bar-channel", "c-donut-won", "c-monthly-trend"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><ReadingNote><strong>Follow the decision path:</strong> first, see where recorded pipeline and won revenue come from; second, identify where marketing appears before opportunities; third, choose the gap that can be tested. Because this is account-based marketing, the useful unit is the account, not a disconnected click or impression.</ReadingNote></section>;
}

function AttributionSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  return <section id="s-attrib" className="dashboard-section"><SectionIntro id="s-attrib" data={data} story={story} />
    {/* The lookback panel is the direct proof of the title (share of won deals linked), so it leads. */}
    <AttributionSensitivityPanel data={data} />
    <ChartGrid ids={["c-attrib-comparison", "c-sourced-influenced", "c-attrib-waterfall"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} />
    <EvidenceGrid items={[{ label: "Observed", title: "Marketing appears in measurable journeys", body: <>Sourced credit reconciles to the full CRM source view; influenced credit reconciles within the linked opportunity population. Each number must travel with its denominator.</>, tone: "high" }, { label: "Directional pattern", title: "Channels occupy different journey positions", body: <>Model differences show whether a channel tends to appear earlier or later in the observed path.</>, tone: "medium" }, { label: "Limit", title: "Credit is not causality", body: <>A touchpoint receiving credit means it appeared before opportunity creation; it does not mean that touch caused or closed the deal.</>, tone: "directional" }]} />
    <EvidenceDetails title="Full attribution table: all models side by side" count={data.tables.attribution_models.rows.length}><AttributionTable data={data} /></EvidenceDetails>
    <ReadingNote><strong>Decision use:</strong> attribution shows where classified channels appear in tracked pre-opportunity journeys; it does not estimate incremental lift. Compare first-touch, last-touch, linear and time-decay within the same 365-day linked population, while keeping CRM source credit separate.</ReadingNote>
  </section>;
}

/**
 * Ranked new-logo win rate by source (v3). A bar table: one series, so no
 * legend; the tension row (marketing-sourced) wears the only accent and the
 * rest stay muted. Every value is printed in the row, so the table is its
 * own accessible equivalent; the whisker is the 95% Wilson interval.
 */
function SourceScorecard({ brief }: { brief: LatestBrief }) {
  const rows = brief.sourceGroups;
  if (!rows.length) return null;
  const max = Math.min(1, Math.ceil(Math.max(...rows.map((row) => numberValue(row, "win_rate_ci_high", numberValue(row, "win_rate")))) * 10) / 10);
  const x = (value: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  return <article className="rank-card" aria-labelledby="source-scorecard-title">
    <div className="rank-card-head"><h3 id="source-scorecard-title">New-logo win rate by lead source, 2023–24</h3><span className="chart-unit">Resolved opportunities · bar = win rate · line = 95% interval</span></div>
    <table className="rank-table"><caption className="sr-only">New-logo win rate by lead source, opportunities created 2023–24, resolved outcomes only</caption>
      <thead><tr><th scope="col">Source</th><th scope="col"><span className="sr-only">Win rate bar</span></th><th scope="col" className="numeric">Win rate</th><th scope="col" className="numeric">Won / resolved</th></tr></thead>
      <tbody>{rows.map((row) => {
        const name = textValue(row, "source_group");
        const rate = numberValue(row, "win_rate");
        const low = numberValue(row, "win_rate_ci_low"); const high = numberValue(row, "win_rate_ci_high");
        const focus = /marketing/i.test(name);
        return <tr key={name} className={focus ? "is-focus" : undefined} title={`${name}: ${pct(rate)} (95% interval ${pct(low)}–${pct(high)}), ${formatCount(numberValue(row, "won"))} won of ${formatCount(numberValue(row, "resolved"))} resolved`}>
          <th scope="row">{name}</th>
          <td className="rank-bar-cell" aria-hidden="true"><span className="rank-track"><span className="rank-bar" style={{ width: x(rate) }} />{Number.isFinite(low) && Number.isFinite(high) && <span className="rank-ci" style={{ left: x(low), width: `calc(${x(high)} - ${x(low)})` }} />}</span></td>
          <td className="numeric rank-value">{pct(rate)}</td>
          <td className="numeric">{formatCount(numberValue(row, "won"))} / {formatCount(numberValue(row, "resolved"))}{numberValue(row, "resolved") < 50 && <small className="rank-small-n">small sample</small>}</td>
        </tr>;
      })}</tbody>
    </table>
    <p className="rank-note">Existing-client deals are excluded from the ranking. Rates are observational; recent cohorts still have open deals.</p>
  </article>;
}

function ChannelSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, brief, story }: SectionProps) {
  const table = data.tables.channel_roi_summary;
  const rows = contractRows(table);
  const efficiencyRows = data.datasets.channel_pipeline.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ["channel_category", "spend_measurement_status", "pipeline_period_start", "pipeline_period_end", "spend_period_start", "spend_period_end", "period_matched_pipeline", "period_matched_won_amount", "period_matched_opportunities", "channel_spend", "pipeline_roi", "revenue_roi", "ratio_definition"].includes(key)))) as DataRow[];
  // Identifiers and the shared definition never count as a "measured value".
  const efficiencyLabelKeys = ["channel_category", "spend_measurement_status", "ratio_definition"];
  const ratioDefinition = constantText(efficiencyRows, "ratio_definition");
  return <section id="s-channel" className="dashboard-section"><SectionIntro id="s-channel" data={data} story={story} />
    {brief && <SourceScorecard brief={brief} />}
    <ChartGrid ids={["c-spend-pipeline", "c-funnel"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} />
    <EvidenceGrid items={[{ label: "Recorded outcome", title: "Relationship-led revenue is the strongest base", body: <>Existing-client and referral sources lead recorded won outcomes, so the current revenue story is broader than paid media.</>, tone: "high" }, { label: "Acquisition role", title: "Marketing channels build net-new pipeline", body: <>Judge acquisition channels through pipeline creation, later conversion and time-to-close together.</>, tone: "medium" }, { label: "Decision gate", title: "Separate quality from volume", body: <>Increase spend only when added reach creates incremental qualified opportunities, not simply more activity.</>, tone: "directional" }]} />
    <EvidenceTable title="Channel ROI Summary Table" note="Multiples = same-period recorded sourced pipeline or won amount / tracked spend. Channels without measured media spend remain unavailable rather than being assigned a zero-cost return." columns={table.columns} rows={rows} />
    <EvidenceDetails title="Period-matched efficiency inputs and observation windows" count={efficiencyRows.length}><DataTable id="period-matched-efficiency" provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: "channel_pipeline", scope: data.meta.period, methodology: data.meta.methodology }} label="Period-matched efficiency inputs and observation windows" rows={efficiencyRows} hideKeys={ratioDefinition ? ["ratio_definition"] : []} note={ratioDefinition ? <>Ratio definition: {ratioDefinition}.</> : undefined} isEmptyRow={(row) => Object.entries(row).every(([key, value]) => efficiencyLabelKeys.includes(key) || isMissing(value))} emptyRowNoun="channels" /></EvidenceDetails>
    <ReadingNote><strong>Decision use:</strong> multiples compare same-period recorded CRM-sourced pipeline or won amount with tracked ad spend. {(() => { const tracked = trackedSpendChannels(data).length; return tracked ? `Only ${countWord(tracked).toLowerCase()} paid channel${tracked === 1 ? " has" : "s have"} tracked spend, so treat` : "No paid channel has tracked spend, so treat"; })()} these as diagnostic efficiency ratios, not an incremental ROI ranking. <strong>Avg Deal</strong> uses opportunities with a populated amount.</ReadingNote>
  </section>;
}

function SegmentSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  return <section id="s-segment" className="dashboard-section"><SectionIntro id="s-segment" data={data} story={story} />
    {/* Win rate first: it is the evidence for the title; concentration follows as context. */}
    <ChartGrid className="segment-grid" ids={["c-seg-winrate", "c-seg-heatmap"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} />
    <ReadingNote><strong>Decision use:</strong> CRM segment groups opportunities by the supplied market categories; profile fit is a separate current-account attribute. Use resolved opportunities for historical win rates, then require sufficient sample and an eligible audience before selecting a target cell.</ReadingNote>
  </section>;
}

function CreativeSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  return <section id="s-creative" className="dashboard-section"><SectionIntro id="s-creative" data={data} story={story} /><ChartGrid ids={["c-creative-ctr", "c-creative-attr", "c-email-seniority"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><ReadingNote><strong>Decision use:</strong> compare ad CTR only within platform. The supplied metadata covers a narrow creative subset, so format, message and tone must be read as combined bundles, not independent winners. <strong>Email denominator:</strong> the email file records engagement events across {metric(data, "email_people")} people but contains no sent or delivered counts. It can suggest content tests; it cannot support campaign response rates.</ReadingNote></section>;
}

/**
 * Test sizing as three stat tiles (the number is the chart). The shortfall
 * between the default design and the eligible audience is the only accent.
 */
function ExperimentPower({ story }: { story: StoryNumbers }) {
  if (!story.eligible || !story.defaultNeed) return null;
  return <dl className="power-tiles" aria-label="Experiment sizing">
    <div><dt>Eligible test audience</dt><dd className="power-value">{story.eligible}</dd><dd className="power-context">ICP target domains after excluding customers and open pipeline</dd></div>
    <div className="is-focus"><dt>Default test needs</dt><dd className="power-value">{story.defaultNeed}</dd><dd className="power-context">{story.defaultLabel} · two arms, 80% power</dd></div>
    {story.feasibleLabel && <div><dt>Smallest detectable lift</dt><dd className="power-value">{story.feasibleLabel.split(", ")[1]?.replace(" lift", "")}</dd><dd className="power-context">On a {story.feasibleLabel.split(", ")[0]} · needs {story.feasibleNeed} domains</dd></div>}
  </dl>;
}

function BudgetSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  return <section id="s-budget" className="dashboard-section"><SectionIntro id="s-budget" data={data} story={story} /><ExperimentPower story={story} /><ChartGrid ids={["c-budget-scenario"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} /><ReadingNote><strong>Decision use:</strong> these are planning allocations, not an optimized channel mix. Each option preserves the current tracked envelope while reserving a different amount for a holdout and pre-registered test. The decision gate is incremental qualified pipeline, not click volume. Sizing assumes a two-sided alpha of .05 and 80% power; the baselines are hypothetical.</ReadingNote></section>;
}

function AdvancedSection({ data, metadata, presenting, totalPipeline, coverageMix, resetToken, story }: SectionProps) {
  const velocityRows = data.datasets.deal_velocity_exclusions ?? [];
  const intervalDefinition = constantText(velocityRows, "interval_definition");
  return <section id="s-advanced" className="dashboard-section"><SectionIntro id="s-advanced" data={data} story={story} />
    {/* Audience evidence first (coverage, then who to target), expectations after (cohorts, velocity, journeys). */}
    <ChartGrid ids={["c-account-coverage", "c-targeting-matrix", "c-cohort", "c-deal-velocity", "c-journey"]} data={data} presenting={presenting} totalPipeline={totalPipeline} coverageMix={coverageMix} metadata={metadata} resetToken={resetToken} />
    <EvidenceGrid items={[{ label: "Observed gap", title: "Reached tiers show higher observed rates", body: <>Unreached accounts show a {metric(data, "not_reached_opportunity_rate")} historical opportunity prevalence, while email-only accounts show {metric(data, "email_only_opportunity_rate")} and both-channel accounts show {metric(data, "both_channels_opportunity_rate")}. CRM outcomes can precede the reach window; selection and sales activity can explain the association.</>, tone: "high" }, { label: "Quality diagnosis", title: "Growth is not automatically healthy", body: <>Among cohorts at least 80% resolved, closed-deal win rate moved from {metric(data, "cohort_start_win_rate")} in {metric(data, "cohort_start_quarter")} to {metric(data, "cohort_end_win_rate")} in {metric(data, "cohort_end_quarter")}.</>, tone: "medium" }, { label: "Next test", title: "Validate causality", body: <>Run a holdout or phased rollout to measure incremental lift from email-first outreach; test a 6sense overlay separately.</>, tone: "directional" }]} />
    <EvidenceDetails title="Won-deal duration eligibility by channel and motion" count={velocityRows.length}><DataTable id="velocity-eligibility" provenance={{ snapshot_id: data.meta.snapshot_id ?? "Unavailable", snapshot_generated_at: data.meta.generated_at ?? "Unavailable", source: "deal_velocity_exclusions", scope: "Canonical won outcomes", methodology: data.meta.methodology }} label="Canonical won duration eligibility by channel and motion" rows={velocityRows} hideKeys={intervalDefinition ? ["interval_definition"] : []} note={intervalDefinition ? <>Interval definition: {intervalDefinition}.</> : undefined} /></EvidenceDetails>
    <ReadingNote><strong>Decision use:</strong> coverage, cohort, velocity and journey views describe observed patterns, not causal effects. A calendar-only win-probability baseline was withdrawn: its time-based holdout was near chance and predicted no wins, so no deal scores are shown.</ReadingNote>
  </section>;
}

function AppendixSection({ data, story, onOpen }: SectionProps) {
  const cards: Array<{ id: SectionId; label: string; title: string; body: string }> = [
    { id: "s-exec", label: "Context", title: "Executive Summary", body: "Top-line pipeline, won revenue and monthly trend views." },
    { id: "s-segment", label: "Targeting", title: "Segment & ICP", body: "Segment, industry and ICP evidence for account prioritization." },
    { id: "s-creative", label: "Engagement", title: "Creative & Email", body: "Creative CTR and email engagement detail for messaging decisions." },
    { id: "s-budget", label: "Planning", title: "Budget Scenarios", body: "Test sizing and budget-neutral holdout scenarios." },
    { id: "s-advanced", label: "Diagnostics", title: "Advanced Analytics", body: "Account coverage, deal velocity, journey and targeting matrix detail." },
  ];
  return <section id="s-appendix" className="dashboard-section"><SectionIntro id="s-appendix" data={data} story={story} /><div className="appendix-grid">{cards.map((card) => <article className="appendix-card" key={card.id}><span className="priority-tag muted">{card.label}</span><h3>{card.title}</h3><p>{card.body}</p><button type="button" className="button button-small" onClick={() => onOpen(card.id)}>Open evidence <ArrowRight size={14} /></button></article>)}</div><EvidenceTable title="Case Deliverable Coverage" columns={data.tables.case_deliverable_coverage.columns} rows={contractRows(data.tables.case_deliverable_coverage)} /></section>;
}

/** The three decisions the big idea needs: fix conversion, prove reach, record value. */
const PRIMARY_DECISIONS = ["r-marketing", "r-test", "r-value"];

function DecisionCards({ brief }: { brief: LatestBrief }) {
  const byId = new Map(brief.recommendations.map((item) => [item.id, item]));
  const primary = PRIMARY_DECISIONS.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const decisions = primary.length ? primary : brief.recommendations.slice(0, 3);
  const queued = brief.recommendations.filter((item) => !decisions.includes(item));
  return <>
    <ol className="decision-list" aria-label="Decisions for the CMO">{decisions.map((item, index) => <li key={item.id} className={`decision-card${index === 0 ? " is-focus" : ""}`}>
      <div className="decision-card-head"><span className="decision-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h3>{item.decision}</h3><span className={`confidence ${/observed/i.test(item.confidence_status) ? "high" : "medium"}`}>{item.confidence_status}</span></div>
      <dl>
        <div><dt>Owner</dt><dd>{item.owner_role}</dd></div>
        <div><dt>First step</dt><dd>{item.immediate_next_step}</dd></div>
        <div><dt>Measure</dt><dd>{item.primary_success_measure}</dd></div>
        <div><dt>Stop rule</dt><dd>{item.scale_stop_rule}</dd></div>
      </dl>
    </li>)}</ol>
    {queued.length > 0 && <div className="decision-queued"><span>Also queued</span><ul>{queued.map((item) => <li key={item.id}><strong>{item.decision}</strong> · {item.owner_role}</li>)}</ul></div>}
  </>;
}

function ConclusionSection({ data, brief, story }: SectionProps) {
  const confidenceTable = data.tables.decision_confidence;
  const actionsTable = data.tables.recommended_actions;
  // Present the CMO plan in priority order (P1, P2, P3…) regardless of source order.
  const priorityIndex = actionsTable.columns.indexOf("Priority");
  const actionRows = priorityIndex < 0 ? contractRows(actionsTable) : [...contractRows(actionsTable)].sort((left, right) => String(left[priorityIndex] ?? "").localeCompare(String(right[priorityIndex] ?? ""), "en", { numeric: true }));
  return <section id="s-conclusion" className="dashboard-section conclusion-section">
    <SectionIntro id="s-conclusion" data={data} story={story} />
    <div className="conclusion-hero">
      <span className="hero-label">The big idea</span>
      <h3>{BIG_IDEA}</h3>
      <p>{bigIdeaSupport(data, story)}</p>
    </div>
    {brief && brief.recommendations.length ? <DecisionCards brief={brief} /> : <div className="priority-grid conclusion-priorities">
      <article className="priority-card"><h3><span className="priority-tag red">P1</span> Stabilize conversion quality</h3><p>Review ICP, qualification and loss reasons before asking a larger funnel to carry weaker conversion.</p></article>
      <article className="priority-card"><h3><span className="priority-tag muted">P2</span> Run the coverage experiment</h3><p>Activate eligible strong-fit accounts with an account-level holdout and a pre-registered 90-day endpoint.</p></article>
      <article className="priority-card"><h3><span className="priority-tag muted">P3</span> Scale only on measured lift</h3><p>Release more budget only when treatment improves qualified opportunity creation without weakening win quality.</p></article>
    </div>}
    <div className="ask-links"><a className="button button-primary" href="#present/main-16"><Presentation size={15} aria-hidden="true" /> Present the decisions</a><a className="button" href="#present/main-14">Experiment design slide <ArrowRight size={14} aria-hidden="true" /></a></div>
    <EvidenceDetails title="Supporting tables: decision confidence and full action plan" count={confidenceTable.rows.length + actionsTable.rows.length}>
      <div className="details-stack">
        <EvidenceTable title="Decision Confidence" note="This separates what the data directly supports from what remains an association or testable hypothesis." columns={confidenceTable.columns} rows={contractRows(confidenceTable)} />
        <EvidenceGrid items={[{ label: "Observed", body: <>Recorded pipeline, won amount, account coverage and mature-cohort win-rate movement are directly measurable.</>, tone: "high" }, { label: "Associated", body: <>Marketing touches and reached-account outcomes move together in the observed data, but selection and sales activity may explain part of the pattern.</>, tone: "medium" }, { label: "Requires a test", body: <>Incremental channel lift, creative causality and budget scaling require holdouts or phased experiments.</>, tone: "directional" }]} />
        <EvidenceTable title="CMO Action Plan" note="Each row connects the evidence to an action and the metric that decides whether it continues." columns={actionsTable.columns} rows={actionRows} />
      </div>
    </EvidenceDetails>
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
  const sectionNav = useRef<HTMLElement>(null);
  const [navMore, setNavMore] = useState(false);
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
    // The section list scrolls inside the drawer on short screens; a bottom fade
    // and "More sections" cue stay until the last link is in view.
    const nav = sectionNav.current;
    if (!nav) return;
    const update = () => setNavMore(nav.scrollHeight - nav.scrollTop - nav.clientHeight > 4);
    update();
    nav.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(nav);
    window.addEventListener("resize", update);
    return () => { nav.removeEventListener("scroll", update); observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [data, menuOpen, search]);
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
  // Render every section, give lazy charts a moment to measure, then print.
  // The view returns to the single section on afterprint (see the effect
  // above). Browsers whose print() returns before printing finishes never block
  // here, so the view also returns on the next pointer or key press instead of
  // a fixed timer that could fire while the print snapshot is still pending.
  const printAllSections = () => {
    setPrintAll(true);
    window.setTimeout(() => {
      window.print();
      const reset = () => { setPrintAll(false); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
      window.addEventListener("pointerdown", reset);
      window.addEventListener("keydown", reset);
    }, 400);
  };
  const story = storyNumbers(brief);
  const props: SectionProps = { data, metadata, presenting, totalPipeline, coverageMix, resetToken, brief, story, onOpen: openSection };
  const renderSection = (id: SectionId) => {
    if (id === "s-essential") return <EssentialSection {...props} />;
    if (id === "s-exec") return <ExecutiveSection {...props} />;
    if (id === "s-attrib") return <AttributionSection {...props} />;
    if (id === "s-channel") return <ChannelSection {...props} />;
    if (id === "s-segment") return <SegmentSection {...props} />;
    if (id === "s-creative") return <CreativeSection {...props} />;
    if (id === "s-budget") return <BudgetSection {...props} />;
    if (id === "s-advanced") return <AdvancedSection {...props} />;
    if (id === "s-appendix") return <AppendixSection {...props} />;
    return <ConclusionSection {...props} />;
  };

  return <div ref={root} className="app-shell">
    {/* A div, not <aside>: ARIA forbids role="dialog" on <aside>. Closed it is the complementary landmark; open (mobile) it is a modal dialog. */}
    <div id="dashboard-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} role={menuOpen ? "dialog" : "complementary"} aria-label="Dashboard sections" aria-modal={menuOpen ? "true" : undefined}><div className="brand"><span>RC</span><div><strong>Revenue Command</strong><small>Decision analytics · {data.meta.period}</small></div></div><button ref={closeButton} className="sidebar-close" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X /></button><div className="nav-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a section" aria-label="Search dashboard sections" />{search && <button type="button" aria-label="Clear section search" onClick={() => setSearch("")}><X size={14} /></button>}</div><div className={`section-nav-scroll${navMore ? " has-more" : ""}`}><nav ref={sectionNav} className="section-nav" aria-label="Section navigation">{filteredGroups.map((group) => <div className="nav-group" key={group.id}><div className="nav-group-label">{group.icon}<span>{group.label}</span></div>{group.children.map((item) => <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); openSection(item.id); }}><span>{item.label}</span>{active === item.id && <AnimatedNavIndicator />}</a>)}</div>)}</nav><span className="nav-more-cue" aria-hidden="true"><ChevronDown size={13} />More sections</span></div>{search.trim() && !hasSearchResults && <p className="nav-empty" role="status">No sections match “{search}”.</p>}<a className="legacy-link" href={`${(import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL}full-analysis/`}><ExternalLink size={15} /><span><strong>Full analysis archive</strong><small>Original Plotly reference</small></span></a><div className="sidebar-note"><ShieldCheck size={16} /><span>Validated Parquet evidence<br />Schema v{data.schema_version}</span></div></div>{menuOpen && <button type="button" className="nav-backdrop" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation" />}
      <main id="main-content" tabIndex={-1}><header className="topbar"><div className="topbar-left"><button ref={menuButton} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="dashboard-navigation"><Menu size={18} /></button><div><h1>Revenue Command<span className="wide-title"> Center</span></h1><span className="top-context">{activeGroup && activeSection && activeSection.label !== activeGroup.label ? `${activeGroup.label} / ${activeSection.label}` : activeSection?.label ?? activeGroup?.label ?? "Dashboard"} · {data.meta.period}<span className="context-refresh"> · {refreshed} · {metrics.total_opportunities} opportunities</span></span></div></div><div className="top-actions"><span className="validated"><Check size={13} /> Validated snapshot</span><button ref={caveatsTrigger} className="action-button" type="button" title="View data caveats" onClick={() => setCaveatsOpen(true)} aria-haspopup="dialog" aria-expanded={caveatsOpen}><Info size={15} /> Caveats</button><button className="action-button utility-export" type="button" title="Export all evidence" onClick={() => downloadEvidence(data)}><Download size={15} /> Export</button><button className="action-button utility-print" type="button" title="Print all dashboard sections" onClick={() => { printAllSections(); }}><Printer size={15} /> Print</button><a className="action-button browser-deck-link" href="#present/main-01" title="Open the browser findings deck"><Presentation size={15} /> Findings deck</a><button className={`mode-button ${presenting ? "active" : ""}`} type="button" title={presenting ? "Switch to analyst mode" : "Switch to presentation mode"} onClick={togglePresentation} aria-pressed={presenting}><Presentation size={15} /> {presenting ? "Analyst mode" : "Presentation mode"}</button><button className="icon-button utility-reset" type="button" onClick={() => { setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setPrintAll(false); setResetToken((value) => value + 1); openSection("s-essential"); }} title="Reset dashboard" aria-label="Reset dashboard"><RotateCcw size={16} /></button><div ref={utilityMenu} className="utility-menu-wrap"><button ref={utilityTrigger} className="icon-button utility-more" type="button" aria-label="More dashboard actions" aria-haspopup={undefined} aria-expanded={utilityOpen} aria-controls="utility-menu" onClick={() => setUtilityOpen((value) => !value)}><MoreHorizontal size={18} /></button>{utilityOpen && <div id="utility-menu" className="utility-menu-popover" role="group" aria-label="Dashboard actions"><button type="button"  onClick={() => { downloadEvidence(data); setUtilityOpen(false); }}><Download size={16} /><span><strong>Export evidence</strong><small>Download the full validated dataset</small></span></button><button type="button"  onClick={() => { setUtilityOpen(false); printAllSections(); }}><Printer size={16} /><span><strong>Print dashboard</strong><small>Prepare every section for print</small></span></button><button type="button"  aria-pressed={presenting} onClick={() => { togglePresentation(); setUtilityOpen(false); }}><Presentation size={16} /><span><strong>{presenting ? "Analyst mode" : "Presentation mode"}</strong><small>{presenting ? "Restore the working layout" : "Expand the executive canvas"}</small></span></button><button type="button"  onClick={() => { setUtilityOpen(false); setPresenting(false); setSearch(""); setMenuOpen(false); setCaveatsOpen(false); setPrintAll(false); setResetToken((value) => value + 1); openSection("s-essential"); }}><RotateCcw size={16} /><span><strong>Reset dashboard</strong><small>Return to the essential view</small></span></button></div>}</div></div></header>
      {/* The conclusion restates the big idea in its own hero, so the compact strip would only repeat it. */}
      {active === "s-conclusion" && !printAll ? null : active !== "s-essential" && !printAll ? <section className="command-strip is-compact" aria-label="The big idea"><div className="command-decision"><h2>{BIG_IDEA}</h2></div><dl className="command-inline-kpis"><div><dt>Pipeline</dt><dd>{metrics.total_pipeline}</dd></div><div><dt>Won</dt><dd>{metrics.won_revenue}</dd></div><div><dt>Win rate</dt><dd>{metrics.closed_deal_win_rate}</dd></div></dl></section> : <section className="command-strip" aria-label="The big idea"><div className="command-decision"><span>The big idea</span><h2>{BIG_IDEA}</h2><p>{bigIdeaSupport(data, story)}</p></div><dl className="command-kpis"><div><dt>Recorded pipeline</dt><dd className="kpi-value">{metrics.total_pipeline}</dd><dd className="kpi-context">{metrics.total_opportunities} opportunities, {metrics.data_year_range}</dd></div>{story.openPipeline ? <div><dt>Still open</dt><dd className="kpi-value">{story.openPipeline}</dd><dd className="kpi-context">The rest is already resolved</dd></div> : null}<div><dt>Recorded won</dt><dd className="kpi-value">{metrics.won_revenue}</dd><dd className="kpi-context">{metrics.closed_deal_win_rate} resolved win rate</dd></div><div><dt>Marketing-sourced</dt><dd className="kpi-value">{metrics.marketing_sourced_pipeline}</dd><dd className="kpi-context">{metrics.marketing_sourced_share} of recorded pipeline</dd></div>{story.openPipeline ? null : <div><dt>Marketing-linked</dt><dd className="kpi-value">{metrics.marketing_influenced_pipeline}</dd><dd className="kpi-context">{metrics.attribution_linked_won_share} of wins linked</dd></div>}</dl></section>}
      {(active === "s-essential" || printAll) && <ArcStrip data={data} story={story} onOpen={openSection} />}
      {(active === "s-essential" || printAll) && brief && <LatestFindings brief={brief} data={data} />}
      <div className="progress-rail" role="progressbar" aria-label="Story progress" aria-valuemin={1} aria-valuemax={sectionOrder.length} aria-valuenow={sectionOrder.indexOf(active) + 1} aria-valuetext={`Section ${sectionOrder.indexOf(active) + 1} of ${sectionOrder.length}`}><span style={{ width: "100%", transform: `scaleX(${(sectionOrder.indexOf(active) + 1) / sectionOrder.length})`, transformOrigin: "left center" }} /></div>
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
