import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { TableProperties, X } from "lucide-react";

import type { CaseSlide, CaseStudyData } from "../types";
import { columnLabel, formatDollarsCompact, formatField, formatMonthYear } from "../evidence";
import { displayName } from "../labels";
import { emailLabel, fieldLabel } from "./labels";

export type Row = Record<string, unknown>;

export const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown) => value === null || value === undefined || value === "" ? "Unavailable" : String(value).replaceAll("_", " ");
const count = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const money = formatDollarsCompact;
const signedPp = (value: number, digits = 1) => { const shown = Math.abs(value).toFixed(digits); return `${Number(shown) === 0 ? "" : value > 0 ? "+" : "−"}${shown} pp`; };
const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + (numeric(row[key]) ?? 0), 0);
const byDesc = (key: string) => (a: Row, b: Row) => (numeric(b[key]) ?? -Infinity) - (numeric(a[key]) ?? -Infinity);
const dateMs = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
const monthLabel = (ms: number) => formatMonthYear(new Date(ms).toISOString());

/* ---------- primitives ---------- */

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`deck-panel ${className}`.trim()} aria-label={title}><h2 className="deck-panel-label">{title}</h2>{children}</section>;
}

type Kpi = { label: string; value: string; note?: string; tone?: "accent" | "muted" };
function KpiTiles({ items, className = "" }: { items: Kpi[]; className?: string }) {
  return <dl className={`deck-kpis ${className}`.trim()}>{items.map(item => <div key={item.label} className={`deck-kpi ${item.tone ?? ""}`.trim()}><dt>{item.label}</dt><dd>{item.value}</dd>{item.note && <dd className="deck-kpi-note">{item.note}</dd>}</div>)}</dl>;
}

/** How a bar is emphasized: the bar that makes the slide's point is "accent"; a comparison bar is "reference"; the rest stay muted. */
type Emphasis = "accent" | "reference" | undefined;

export function Bars({ rows, name, value, format = count, detail, label, emphasis, hint }: { rows: Row[]; name: (row: Row) => string; value: string; format?: (n: number) => string; detail?: (row: Row) => string; label: string; emphasis?: (row: Row, index: number) => Emphasis; hint?: (row: Row) => string }) {
  const observedMax = Math.max(0, ...rows.map(row => Math.abs(numeric(row[value]) ?? 0)));
  const max = observedMax > 0 ? observedMax : 1;
  if (!rows.length) return <p className="deck-empty">Evidence unavailable for this scope.</p>;
  const tone = emphasis ?? ((_row: Row, index: number): Emphasis => index === 0 ? "accent" : undefined);
  return <ul className="slide-bars" aria-label={label}>{rows.map((row, index) => {
    const n = numeric(row[value]);
    const title = name(row);
    const emphasized = tone(row, index);
    return <li className={`slide-bar ${emphasized ? `is-${emphasized}` : ""}`.trim()} key={`${title}-${index}`}>
      <span className="slide-bar-name" title={hint?.(row) ?? title}>{title}</span>
      <i className={n !== null && n < 0 ? "negative" : ""} aria-hidden="true"><b style={{ width: `${n === null ? 0 : Math.abs(n) / max * 100}%` }} /></i>
      <strong>{n === null ? "Unavailable" : format(n)}</strong>
      {detail && <small>{detail(row)}</small>}
    </li>;
  })}</ul>;
}

type Column = { key: string; label: string; format?: (value: unknown, row: Row) => string; numeric?: boolean };
function CompactTable({ rows, columns, limit, caption, highlight }: { rows: Row[]; columns: Column[]; limit?: number; caption: string; highlight?: (row: Row) => boolean }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!rows.length) return <p className="deck-empty">No rows are available for this evidence.</p>;
  const truncated = Boolean(limit && rows.length > (limit ?? 0));
  return <table className="deck-table"><caption className={truncated ? "" : "sr-only"}>{truncated ? <><span className="sr-only">{caption}: </span>Top {shown.length} of {count(rows.length)} · all rows under View evidence</> : caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={column.key} className={column.numeric ? "num" : ""}>{column.label}</th>)}</tr></thead><tbody>{shown.map((row, index) => <tr key={index} className={highlight?.(row) ? "is-highlight" : undefined}>{columns.map(column => <td key={column.key} className={column.numeric ? "num" : ""}>{column.format ? column.format(row[column.key], row) : formatField(column.key, row[column.key])}</td>)}</tr>)}</tbody></table>;
}

function EvidenceTable({ rows, fields, title }: { rows: Row[]; fields: string[]; title: string }) {
  return <div className="slide-table-wrap" tabIndex={0} role="region" aria-label={`${title} evidence table; scroll for more rows and columns`} data-evidence-scroll>
    <table className="slide-table"><caption>{title} · {count(rows.length)} {rows.length === 1 ? "record" : "records"}</caption><thead><tr>{fields.map(field => <th scope="col" key={field}>{columnLabel(field)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{fields.map(field => <td key={field}>{Array.isArray(row[field]) ? (row[field] as unknown[]).join(" · ") : formatField(field, row[field])}</td>)}</tr>)}</tbody></table>
    {!rows.length && <p>Evidence unavailable.</p>}
  </div>;
}

/* ---------- evidence drawer ---------- */

type EvidenceSet = { title: string; rows: Row[]; fields: string[] };
const fieldsOf = (rows: Row[]) => Array.from(new Set(rows.flatMap(row => Object.keys(row))));

function motionTotals(data: CaseStudyData) {
  const channel = data.datasets.channel_scorecard ?? [];
  return ["Acquisition", "Existing customer"].map(motion => {
    const selected = channel.filter(row => row.scope === "All history" && row.business_motion === motion);
    const has = selected.length > 0;
    return { motion, opportunities: has ? sum(selected, "opportunities") : null, won: has ? sum(selected, "won") : null, recorded_won_amount: has ? sum(selected, "recorded_won_amount") : null, zero_amount_win_mrr: has ? sum(selected, "zero_amount_win_mrr") : null };
  });
}

export function evidenceFor(data: CaseStudyData, slide: CaseSlide): EvidenceSet[] {
  const rows = (key: string): Row[] => data.datasets[key] ?? [];
  if (slide.id === "main-04") {
    return [
      { title: "All history · motion from account history", rows: motionTotals(data), fields: ["motion", "opportunities", "won", "recorded_won_amount", "zero_amount_win_mrr"] },
      { title: "Motion classification coverage", rows: rows("motion_classification_coverage"), fields: ["created_year", "acquisition_opportunities", "existing_customer_opportunities", "crm_type_coverage"] },
    ];
  }
  if (slide.id === "main-11") {
    return [
      { title: "Attribution model sensitivity", rows: rows("attribution_model_sensitivity"), fields: ["model", "lookback_days", "channel", "attributed_amount", "share_of_linked_amount", "rank"] },
      { title: "Journey outcomes", rows: rows("journey_outcomes"), fields: fieldsOf(rows("journey_outcomes")) },
    ];
  }
  const refs = slide.chart_refs.length ? slide.chart_refs : ["summary"];
  return refs.map(ref => {
    if (ref === "recommendations") {
      const recs = data.recommendations.map(item => ({ ...item, evidence_limitations: item.evidence_limitations.join(" · ") }) as unknown as Row);
      return { title: "Recommendations", rows: recs, fields: ["decision", "owner_role", "immediate_next_step", "primary_success_measure", "scale_stop_rule", "confidence_status", "evidence_limitations"] };
    }
    const selected = rows(ref);
    return { title: displayName(ref), rows: selected, fields: fieldsOf(selected) };
  });
}

export function EvidenceDrawer({ sets, slideTitle }: { sets: EvidenceSet[]; slideTitle: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) close.current?.focus();
    else if (wasOpen.current) toggle.current?.focus();
    wasOpen.current = open;
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open]);
  const records = sets.reduce((total, set) => total + set.rows.length, 0);
  return <>
    <button ref={toggle} type="button" className="deck-evidence-toggle" aria-expanded={open} aria-controls="deck-evidence-drawer" onClick={() => setOpen(value => !value)}><TableProperties aria-hidden="true" /> View evidence <span>{count(records)} {records === 1 ? "row" : "rows"}</span></button>
    <div id="deck-evidence-drawer" className="deck-evidence-drawer" role="region" aria-label={`Evidence tables for ${slideTitle}`} hidden={!open}>
      <header><h2>Evidence · {slideTitle}</h2><button ref={close} type="button" aria-label="Close evidence" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></header>
      <div className="deck-evidence-body">{sets.map(set => <EvidenceTable key={set.title} title={set.title} rows={set.rows} fields={set.fields} />)}</div>
    </div>
  </>;
}

/* ---------- slide-specific visuals ---------- */

function summaryRow(data: CaseStudyData): Row { return data.datasets.summary?.[0] ?? {}; }
const num = (row: Row, key: string) => numeric(row[key]);
const orNA = (value: number | null, format: (n: number) => string) => value === null ? "Unavailable" : format(value);

function rankedRecent(data: CaseStudyData) {
  return (data.datasets.source_group_scorecard ?? []).filter(row => row.scope === "2023–2024" && row.ranked_channel === true);
}

/** Share of opportunities with neither a marketing source nor a 365-day linked touch (main-10). */
function unmeasuredShare(data: CaseStudyData) {
  const overlap = data.datasets.attribution_overlap ?? [];
  const neither = overlap.find(row => /neither/i.test(String(row.overlap_group)));
  const total = sum(overlap, "opportunities");
  return neither && total ? (numeric(neither.opportunities) ?? 0) / total : null;
}

/** main-01: the three gaps the deck is about, one tile each; conversion is the lead gap. */
function GapTiles({ data }: { data: CaseStudyData }) {
  const s = summaryRow(data);
  const unmeasured = unmeasuredShare(data);
  return <KpiTiles className="deck-kpis-hero" items={[
    { label: "1 · Conversion", value: orNA(num(s, "marketing_recent_win_rate"), percent), note: `marketing-sourced win rate, 2023–24, vs ${orNA(num(s, "recent_best_win_rate"), percent)} for ${displayName(s.recent_best_rate_source)}`, tone: "accent" },
    { label: "2 · Recorded value", value: `${orNA(num(s, "zero_amount_wins"), count)} of ${orNA(num(s, "won"), count)}`, note: "wins record no contract amount" },
    { label: "3 · Measurement", value: orNA(unmeasured, n => percent(n, 0)), note: "of opportunities have neither a marketing source nor a linked touch" },
  ]} />;
}

/** The four decisions the deck asks for, in the order main-02 promises and main-16 closes on. */
const ASK_ORDER = ["r-marketing", "r-test", "r-value"] as const;
function askDecisions(data: CaseStudyData) {
  return ASK_ORDER.map(id => data.recommendations.find(item => item.id === id)).filter((item): item is CaseStudyData["recommendations"][number] => Boolean(item));
}
const MOVE_NAMES: Record<string, (s: Row) => string> = {
  "r-marketing": () => "Fix marketing conversion",
  "r-test": () => "Prove reach with a 90-day test",
  "r-value": () => "Record contract value",
};
const actLabel = (status: string) => status === "Observed" ? "Act now" : "Test first";

/** main-02: the plan as four moves; numbers are kept for the evidence slides, so the tiles carry the move, its timing and its owner. */
function MoveTiles({ data }: { data: CaseStudyData }) {
  const s = summaryRow(data);
  return <KpiTiles className="deck-kpis-hero deck-kpis-moves" items={askDecisions(data).map((item, index) => ({
    label: `${index + 1} · ${actLabel(item.confidence_status)}`,
    value: MOVE_NAMES[item.id]?.(s) ?? item.decision,
    note: `Owner: ${item.owner_role}`,
    tone: item.id === "r-marketing" ? "accent" as const : undefined,
  }))} />;
}

/** main-04: one 100% bar per measure, existing-customer share accented. Proves "most wins, and most unrecorded value, are existing customers". */
function ShareBar({ label, parts, format }: { label: string; parts: { name: string; value: number | null; accent?: boolean }[]; format: (n: number) => string }) {
  const total = parts.reduce((t, part) => t + (part.value ?? 0), 0);
  if (!total) return <p className="deck-empty">{label}: unavailable.</p>;
  return <figure className="deck-share" aria-label={`${label}: ${parts.map(part => `${part.name} ${orNA(part.value, format)} (${percent((part.value ?? 0) / total)})`).join(", ")}`}>
    <figcaption>{label} <span>{format(total)} total</span></figcaption>
    <div className="deck-share-bar" aria-hidden="true">{parts.map(part => <b key={part.name} className={part.accent ? "is-accent" : undefined} style={{ flexGrow: (part.value ?? 0) / total }} />)}</div>
    <ul aria-hidden="true">{parts.map(part => <li key={part.name} className={part.accent ? "is-accent" : undefined} style={{ flexGrow: Math.max(0.22, (part.value ?? 0) / total) }}><strong>{percent((part.value ?? 0) / total)}</strong><span>{part.name} · {orNA(part.value, format)}</span></li>)}</ul>
  </figure>;
}

function MotionShare({ data }: { data: CaseStudyData }) {
  const [acq, existing] = motionTotals(data);
  return <div className="deck-shares">
    <ShareBar label="Won deals, all history" format={count} parts={[{ name: "Existing customer", value: existing.won, accent: true }, { name: "Acquisition", value: acq.won }]} />
    <ShareBar label="MRR on wins that record no contract amount" format={money} parts={[{ name: "Existing customer", value: existing.zero_amount_win_mrr, accent: true }, { name: "Acquisition", value: acq.zero_amount_win_mrr }]} />
    <p className="deck-footnote">MRR is a monthly field shown beside recorded amount, never added to it. Channel comparisons that follow use new-logo (acquisition) deals only.</p>
  </div>;
}

function CoverageTimeline({ data }: { data: CaseStudyData }) {
  type Span = { name: string; start: number; end: number; value: string };
  const spans: Span[] = [];
  const missing: string[] = [];
  const crm = data.datasets.motion_classification_coverage ?? [];
  const crmStarts = crm.map(row => dateMs(row.period_start)).filter(Number.isFinite);
  const crmEnds = crm.map(row => dateMs(row.period_end)).filter(Number.isFinite);
  if (crmStarts.length) spans.push({ name: "CRM opportunities", start: Math.min(...crmStarts), end: Math.max(...crmEnds), value: `${count(sum(crm, "opportunities"))} opps` });
  const ads = data.datasets.ad_rankings ?? [];
  const adStarts = ads.map(row => dateMs(row.date_start)).filter(Number.isFinite);
  const adEnds = ads.map(row => dateMs(row.date_end)).filter(Number.isFinite);
  if (adStarts.length) spans.push({ name: "Ad metrics", start: Math.min(...adStarts), end: Math.max(...adEnds), value: "spend · CTR" });
  for (const row of data.datasets.source_coverage ?? []) {
    const start = dateMs(row.min_timestamp), end = dateMs(row.max_timestamp);
    if (Number.isFinite(start) && Number.isFinite(end)) spans.push({ name: displayName(row.source), start, end, value: `${orNA(numeric(row.usable_touchpoints), count)} touches` });
    else missing.push(`${displayName(row.source)} (${orNA(numeric(row.rows), count)} rows, no usable timestamps)`);
  }
  if (!spans.length) return <p className="deck-empty">Coverage windows unavailable.</p>;
  const firstYear = new Date(Math.min(...spans.map(s => s.start))).getUTCFullYear();
  const lastYear = new Date(Math.max(...spans.map(s => s.end))).getUTCFullYear();
  const lo = Date.UTC(firstYear, 0, 1), hi = Date.UTC(lastYear + 1, 0, 1);
  const pos = (ms: number) => (ms - lo) / (hi - lo) * 100;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  return <figure className="deck-timeline" aria-label={`Observation windows by source, ${firstYear} to ${lastYear}`}>
    <div className="deck-timeline-axis" aria-hidden="true"><span />{<div>{years.map(year => <b key={year} style={{ left: `${pos(Date.UTC(year, 0, 1))}%` }}>{year}</b>)}</div>}<span /></div>
    <ul>{spans.map(span => <li key={span.name}><span className="deck-timeline-name">{span.name}</span><i>{years.map(year => <em key={year} style={{ left: `${pos(Date.UTC(year, 0, 1))}%` }} />)}<b style={{ left: `${pos(span.start)}%`, width: `${Math.max(0.6, pos(span.end) - pos(span.start))}%` }} title={`${monthLabel(span.start)} – ${monthLabel(span.end)}`} /></i><small>{monthLabel(span.start)} – {monthLabel(span.end)}</small><strong>{span.value}</strong></li>)}</ul>
    {missing.length > 0 && <figcaption>Not plotted: {missing.join("; ")}.</figcaption>}
  </figure>;
}

function periodLabels(slide: CaseSlide) {
  const match = /(\d{4} H\d)\D+(\d{4} H\d)/.exec(`${slide.visible_caveat} ${slide.body}`);
  return match ? [match[1], match[2]] : ["Period A", "Period B"];
}

export function Decomposition({ rows, slide, compact = false }: { rows: Row[]; slide: CaseSlide; compact?: boolean }) {
  const dimensions = Array.from(new Set(rows.map(row => String(row.dimension))));
  const [dimension, setDimension] = useState(dimensions[0] ?? "");
  const selected = rows.filter(row => row.dimension === dimension);
  const [periodA, periodB] = periodLabels(slide);
  const rateA = sum(selected, "period_a_resolved") ? selected.reduce((t, r) => t + (numeric(r.period_a_resolved) ?? 0) * (numeric(r.period_a_win_rate) ?? 0), 0) / sum(selected, "period_a_resolved") : null;
  const rateB = sum(selected, "period_b_resolved") ? selected.reduce((t, r) => t + (numeric(r.period_b_resolved) ?? 0) * (numeric(r.period_b_win_rate) ?? 0), 0) / sum(selected, "period_b_resolved") : null;
  const total = sum(selected, "total_effect_pp");
  const inert = selected.filter(row => (numeric(row.total_effect_pp) ?? 0) === 0 && numeric(row.mix_effect_pp) === null && numeric(row.within_effect_pp) === null);
  const plotted = selected.filter(row => !inert.includes(row)).sort((a, b) => (numeric(a.total_effect_pp) ?? 0) - (numeric(b.total_effect_pp) ?? 0));
  const values = plotted.map(row => numeric(row.total_effect_pp) ?? 0);
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const zero = (0 - lo) / span * 100;
  const detail = (row: Row) => {
    const mix = numeric(row.mix_effect_pp), within = numeric(row.within_effect_pp), entry = numeric(row.entry_exit_effect_pp) ?? 0;
    return mix === null && within === null ? `entry / exit ${signedPp(entry, 2)}` : `mix ${signedPp(mix ?? 0, 2)} · within ${signedPp(within ?? 0, 2)}${entry ? ` · entry / exit ${signedPp(entry, 2)}` : ""}`;
  };
  // The largest contributor carries the slide's point: it alone is accented and annotated; the rest stay muted.
  const lead = plotted.reduce<Row | undefined>((best, row) => Math.abs(numeric(row.total_effect_pp) ?? 0) > Math.abs(numeric(best?.total_effect_pp) ?? 0) ? row : best, undefined);
  return <div className={`deck-decomp ${compact ? "compact" : "focus"}`}>
    <div className="deck-decomp-head">
      {compact
        ? <p className="deck-callout"><strong>{signedPp(total)}</strong> resolved win-rate change, {periodA} → {periodB} <span>{orNA(rateA, percent)} → {orNA(rateB, percent)}; group contributions below sum to the total</span></p>
        : <p className="deck-decomp-sub">Resolved win rate {orNA(rateA, percent)} in {periodA} → {orNA(rateB, percent)} in {periodB}. Bars are each group's contribution in pp; they sum to {signedPp(total)}.</p>}
      <label className="deck-select">Grouping <select value={dimension} onChange={event => setDimension(event.target.value)}>{dimensions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}</select></label>
    </div>
    <ul className="deck-diverging" aria-label={`Net percentage-point contribution by ${displayName(dimension)}, sorted`}>{plotted.map(row => {
      const n = numeric(row.total_effect_pp) ?? 0;
      const left = n < 0 ? zero - Math.abs(n) / span * 100 : zero;
      const isLead = !compact && row === lead;
      return <li key={String(row.group)} className={isLead ? "is-accent" : undefined}>
        <span className="slide-bar-name">{displayName(row.group)}{row.support !== "Common support" && <em> · entry/exit</em>}</span>
        <i aria-hidden="true"><u style={{ left: `${zero}%` }} /><b className={n < 0 ? "negative" : "positive"} style={{ left: `${left}%`, width: `${Math.max(0.4, Math.abs(n) / span * 100)}%` }} /></i>
        <strong>{signedPp(n, 2)}</strong>
        {!compact && <small>{isLead ? detail(row) : ""}</small>}
      </li>;
    })}</ul>
    {inert.length > 0 && <p className="deck-footnote">No contribution (absent from one period, no common support): {inert.map(row => displayName(row.group)).join(", ")}.</p>}
  </div>;
}

function AudienceWaterfall({ rows, summary }: { rows: Row[]; summary: Row }) {
  const eligibleRow = rows.find(row => /^eligible/i.test(String(row.exclusion)));
  const eligible = numeric(eligibleRow?.domains) ?? numeric(summary.eligible_domains);
  const exclusions = rows.filter(row => row !== eligibleRow).sort(byDesc("domains"));
  const total = sum(exclusions, "domains") + (eligible ?? 0);
  if (!total) return <p className="deck-empty">Exclusion counts unavailable.</p>;
  let remaining = total;
  const steps = exclusions.map(row => { const n = numeric(row.domains) ?? 0; const start = remaining - n; remaining = start; return { label: String(row.exclusion), n, start }; });
  return <ol className="deck-waterfall" aria-label={`Account domains from ${count(total)} assessed to ${orNA(eligible, count)} eligible`}>
    <li className="total"><span className="slide-bar-name">Account domains assessed</span><i aria-hidden="true"><b style={{ left: 0, width: "100%" }} /></i><strong>{count(total)}</strong></li>
    {steps.map(step => <li key={step.label}><span className="slide-bar-name" title={step.label}>− {step.label}</span><i aria-hidden="true"><b style={{ left: `${step.start / total * 100}%`, width: `${Math.max(0.3, step.n / total * 100)}%` }} /></i><strong>−{count(step.n)}</strong></li>)}
    <li className="result"><span className="slide-bar-name">Eligible ICP target domains</span><i aria-hidden="true"><b style={{ left: 0, width: `${(eligible ?? 0) / total * 100}%` }} /></i><strong>{orNA(eligible, count)}</strong></li>
  </ol>;
}

function ScenarioGrid({ rows, compact = false }: { rows: Row[]; compact?: boolean }) {
  const baselines = Array.from(new Set(rows.map(row => numeric(row.baseline_rate)).filter((n): n is number => n !== null))).sort((a, b) => a - b);
  const lifts = Array.from(new Set(rows.map(row => numeric(row.absolute_lift)).filter((n): n is number => n !== null))).sort((a, b) => a - b);
  const audience = numeric(rows[0]?.eligible_audience);
  const cell = (baseline: number, lift: number) => rows.find(row => numeric(row.baseline_rate) === baseline && numeric(row.absolute_lift) === lift);
  if (!rows.length) return <p className="deck-empty">Scenarios unavailable.</p>;
  return <div className={`deck-grid-wrap ${compact ? "compact" : ""}`.trim()}>
    <table className="deck-scenarios">
      <caption>Required total domains (two arms) vs {orNA(audience, count)} eligible · alpha .05, power .80, 50/50 allocation</caption>
      <thead><tr><th scope="col">Baseline ↓ · lift →</th>{lifts.map(lift => <th scope="col" key={lift}>+{(lift * 100).toFixed(0)} pp</th>)}</tr></thead>
      <tbody>{baselines.map(baseline => <tr key={baseline}><th scope="row">{percent(baseline, 0)} baseline</th>{lifts.map(lift => {
        const row = cell(baseline, lift);
        const required = numeric(row?.required_total);
        const feasible = row?.feasible === true;
        return <td key={lift} className={feasible ? "feasible" : "infeasible"}><strong>{orNA(required, count)}</strong><small>{feasible ? "Feasible" : required !== null && audience ? `${(required / audience).toFixed(required / audience < 2 ? 2 : 1)}× audience` : "Insufficient"}</small></td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}

function BudgetFormula({ data }: { data: CaseStudyData }) {
  const scenarios = data.datasets.experiment_scenarios ?? [];
  const feasible = scenarios.filter(row => row.feasible === true);
  const audience = numeric(scenarios[0]?.eligible_audience);
  const smallest = feasible.length ? feasible.reduce((best, row) => (numeric(row.required_per_arm) ?? Infinity) < (numeric(best.required_per_arm) ?? Infinity) ? row : best) : null;
  return <div className="deck-formula">
    <ol className="deck-formula-terms" aria-label="Planning budget formula">
      <li className="known"><small>Required treatment accounts</small><strong>{smallest ? count(numeric(smallest.required_per_arm) ?? 0) : "None feasible"}</strong><span>{smallest ? `treatment arm of ${text(smallest.scenario)}` : `no scenario fits ${orNA(audience, count)} eligible domains`}</span></li>
      <li className="op" aria-hidden="true">×</li>
      <li className="unknown"><small>Cost per treatment account</small><strong>Not supplied</strong><span>not in the supplied data</span></li>
      <li className="op" aria-hidden="true">+</li>
      <li className="unknown"><small>Fixed implementation cost</small><strong>Not supplied</strong><span>not in the supplied data</span></li>
      <li className="op" aria-hidden="true">=</li>
      <li className="result"><small>Planning budget</small><strong>Unavailable</strong><span>no dollar allocation is supported</span></li>
    </ol>
    <div className="deck-formula-feasible">
      <h2 className="deck-panel-label">Feasible scenarios at {orNA(audience, count)} eligible domains</h2>
      {feasible.length ? <ul>{feasible.map(row => <li key={String(row.scenario)}><strong>{text(row.scenario)}</strong> · {orNA(numeric(row.required_per_arm), count)} per arm · {orNA(numeric(row.required_total), count)} total</li>)}</ul> : <p>No scenario is feasible with the current audience.</p>}
      <p className="deck-footnote">Next step: confirm unit and fixed costs, then pick one feasible baseline / lift scenario before committing spend.</p>
    </div>
  </div>;
}

/** The evidence number behind each recommendation, so main-13 reads gap → proof → action. */
function gapFor(data: CaseStudyData, id: string): { gap: string; evidence: string } {
  const s = summaryRow(data);
  const best = displayName(s.recent_best_rate_source ?? "Referral");
  switch (id) {
    case "r-marketing": return { gap: "Conversion", evidence: `${orNA(num(s, "marketing_recent_win_rate"), percent)} marketing-sourced win rate vs ${orNA(num(s, "recent_best_win_rate"), percent)} ${best}` };
    case "r-value": return { gap: "Recorded value", evidence: `${orNA(num(s, "zero_amount_wins"), count)} of ${orNA(num(s, "won"), count)} wins record no amount` };
    case "r-channel": {
      const sorted = (data.datasets.source_group_scorecard ?? []).filter(row => row.scope === "All history" && row.ranked_channel === true).sort(byDesc("recorded_won_amount"));
      return { gap: "Benchmark", evidence: `${displayName(sorted[0]?.source_group ?? best)} leads new-logo won amount at ${orNA(numeric(sorted[0]?.recorded_won_amount), money)}` };
    }
    case "r-content": return { gap: "Creative evidence", evidence: `Only ${count(sum(data.datasets.creative_bundles ?? [], "ads"))} labeled ads; attributes confounded` };
    case "r-test": return { gap: "Proof of lift", evidence: `${orNA(num(s, "eligible_domains"), count)} eligible domains; attribution is not lift` };
    case "r-measurement": return { gap: "Measurement", evidence: `${orNA(unmeasuredShare(data), n => percent(n, 0))} of opportunities neither sourced nor linked` };
    default: return { gap: "—", evidence: "" };
  }
}

/** main-13: each gap found in the evidence maps to exactly one action, tagged act-now or test-first. */
function GapActionMap({ data }: { data: CaseStudyData }) {
  const order = ["r-marketing", "r-value", "r-channel", "r-measurement", "r-content", "r-test"];
  const rank = (id: string) => { const at = order.indexOf(id); return at < 0 ? order.length : at; };
  const items = [...data.recommendations].sort((a, b) => rank(a.id) - rank(b.id));
  return <table className="deck-decisions deck-gapmap">
    <caption className="sr-only">Each gap, the evidence for it, and the action it leads to</caption>
    <thead><tr><th scope="col">Gap</th><th scope="col">Evidence</th><th scope="col">Action</th></tr></thead>
    <tbody>{items.map(item => { const g = gapFor(data, item.id); const now = item.confidence_status === "Observed"; return <tr key={item.id} className={now ? undefined : "is-test"}>
      <th scope="row">{g.gap}</th>
      <td>{g.evidence}</td>
      <td><span className={`deck-chip ${now ? "observed" : "hypothesis"}`}>{actLabel(item.confidence_status)}</span>{item.decision}</td>
    </tr>; })}</tbody>
  </table>;
}

/** When each decision is next reviewed, read from the recommendation's own measure and next-step text. */
function reviewFor(item: CaseStudyData["recommendations"][number]) {
  const textOf = `${item.primary_success_measure} ${item.immediate_next_step} ${item.scale_stop_rule}`;
  const days = /(\d+)\s*days/i.exec(textOf)?.[1] ?? /(\d+)-day/i.exec(item.decision)?.[1];
  if (days) return `Day ${days} of the test`;
  if (/two consecutive quarters/i.test(textOf)) return "Quarterly; scale after 2 improving quarters";
  if (/quarter/i.test(textOf)) return "Quarterly";
  if (/backfill/i.test(textOf)) return "Once the 2023–24 backfill is done";
  return "Next quarterly review";
}

/** main-16: the ask. Four decisions, each with owner, first measure and review point, then the big idea again. */
function AskTable({ data }: { data: CaseStudyData }) {
  const asks = askDecisions(data);
  const others = data.recommendations.filter(item => !asks.includes(item));
  return <div className="deck-ask">
    <table className="deck-decisions">
      <caption className="sr-only">Decisions requested today, with owner, first measure and review point</caption>
      <thead><tr><th scope="col">Decision</th><th scope="col">Owner</th><th scope="col">First measure</th><th scope="col">Review</th></tr></thead>
      <tbody>{asks.map((item, index) => <tr key={item.id} className={index === 0 ? "is-accent" : undefined}>
        <th scope="row"><span className={`deck-chip ${item.confidence_status === "Observed" ? "observed" : "hypothesis"}`}>{actLabel(item.confidence_status)}</span>{item.decision}</th>
        <td>{item.owner_role}</td>
        <td>{item.primary_success_measure}</td>
        <td>{reviewFor(item)}</td>
      </tr>)}</tbody>
    </table>
    {others.length > 0 && <p className="deck-footnote">Also in the plan: {others.map(item => item.decision.toLowerCase()).join("; ")}. Full measures and stop rules under View evidence.</p>}
    <p className="deck-bigidea"><small>The big idea</small>{BIG_IDEA}</p>
  </div>;
}

function AttributionPanel({ rows }: { rows: Row[] }) {
  const models = Array.from(new Set(rows.map(row => String(row.model))));
  const windows = Array.from(new Set(rows.map(row => Number(row.lookback_days)))).sort((a, b) => a - b);
  const [model, setModel] = useState(models.includes("Linear") ? "Linear" : models[0] ?? "");
  const [windowDays, setWindowDays] = useState(windows.includes(365) ? 365 : windows[0]);
  const selected = rows.filter(row => row.model === model && row.lookback_days === windowDays).sort(byDesc("attributed_amount"));
  const population = selected[0]?.window_linked_population ?? selected[0]?.linked_opportunities;
  return <>
    <div className="slide-evidence-filters">
      <label className="deck-select">Model <select value={model} onChange={event => setModel(event.target.value)}>{models.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="deck-select">Lookback <select value={windowDays} onChange={event => setWindowDays(Number(event.target.value))}>{windows.map(item => <option key={item} value={item}>{item} days</option>)}</select></label>
    </div>
    <p className="deck-note">Whole-window linked population: {population == null ? "unavailable" : String(population)} opportunities. This is shared across channels and must not be summed.</p>
    <Bars label="Attributed recorded amount by channel" rows={selected} emphasis={(_row, index) => index === 0 ? "reference" : undefined} name={row => displayName(row.channel)} value="attributed_amount" format={money} detail={row => `${orNA(numeric(row.share_of_linked_amount), percent)} of linked amount · rank ${text(row.rank)}`} />
  </>;
}

/**
 * main-11: rank-1 channel for every model × lookback. Light cells share the default view's leader, muted cells do not;
 * the default view (Linear, 365 days, explored at right) is outlined as the slide's one accent: it is one of sixteen.
 */
function LeaderGrid({ rows }: { rows: Row[] }) {
  const models = Array.from(new Set(rows.map(row => String(row.model))));
  const windows = Array.from(new Set(rows.map(row => numeric(row.lookback_days)).filter((n): n is number => n !== null))).sort((a, b) => a - b);
  const leader = (model: string, days: number) => rows.filter(row => row.model === model && row.lookback_days === days).sort(byDesc("share_of_linked_amount"))[0];
  const reference = leader("Linear", 365) ?? leader(models[0], windows[windows.length - 1]);
  if (!models.length || !windows.length || !reference) return <p className="deck-empty">Model sensitivity unavailable.</p>;
  const cells = models.flatMap(model => windows.map(days => leader(model, days)));
  const same = cells.filter(top => top && top.channel === reference.channel).length;
  return <table className="deck-leaders">
    <caption>{displayName(reference.channel)} leads in {same} of {cells.length} views (light cells); the <b>outlined</b> view is the one explored at right</caption>
    <thead><tr><th scope="col">Model</th>{windows.map(days => <th scope="col" key={days}>{days} d</th>)}</tr></thead>
    <tbody>{models.map(model => <tr key={model}><th scope="row">{model}</th>{windows.map(days => {
      const top = leader(model, days);
      const tone = [top === reference ? "is-accent" : "", top && top.channel === reference.channel ? "is-same" : ""].filter(Boolean).join(" ");
      return <td key={days} className={tone || undefined}><strong>{top ? displayName(top.channel) : "—"}</strong><small>{orNA(numeric(top?.share_of_linked_amount), n => percent(n, 0))}</small></td>;
    })}</tr>)}</tbody>
  </table>;
}

const bundleName = (row: Row | undefined) => row ? ["_copyassettype", "_copymessaging", "_copytone"].map(key => text(row[key])).join(" / ") : "Unavailable";
const ratioLabel = (value: number) => `${value.toFixed(1)}×`;

/** main-08: the one comparison the labeled subset supports, with its sample size kept beside it. */
function CreativeBundles({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort(byDesc("ctr"));
  // The headline carries the ratio; the visual shows the two CTRs and, as large as the bars, how few ads stand behind them.
  const shared = rows.length > 1 && new Set(rows.map(row => `${row._platform}|${row._ctacopysofthard}`)).size === 1;
  return <div className="deck-creative">
    <Panel title="Labeled creative bundles · observational CTR"><Bars label="CTR by creative bundle" rows={sorted} name={bundleName} value="ctr" format={n => `${(n * 100).toFixed(3)}%`} detail={row => `${text(row.ads)} ads · ${orNA(numeric(row.impressions), count)} impressions · ${orNA(numeric(row.clicks), count)} clicks`} /></Panel>
    <p className="deck-sample"><strong>{count(sum(rows, "ads"))}</strong> labeled ads in total <span>{shared ? `Every bundle runs on ${displayName(sorted[0]?._platform)} with the same ${text(sorted[0]?._ctacopysofthard).replace(/\s*CTA$/i, "").toLowerCase()} CTA, and format, message and tone move together, so no single attribute can be credited.` : "Format, message and tone move together across bundles, so no single attribute can be credited."} Enough to design a test, not to pick a winner.</span></p>
  </div>;
}

/** main-09 right column: the contact-flag share leads; the page-group table is supporting context. */
function WebContact({ rows }: { rows: Row[] }) {
  const flagged = sum(rows, "recordings_with_observed_contact_activity");
  const recordings = sum(rows, "unique_recordings");
  const groups = rows.filter(row => (numeric(row.recordings_with_observed_contact_activity) ?? 0) > 0).map(row => text(row.page_group));
  return <>
    <p className="deck-callout deck-callout-sm"><strong>{recordings ? percent(flagged / recordings) : "Unavailable"}</strong> of site recordings carry an observed contact flag <span>{count(flagged)} of {count(recordings)} recordings{groups.length ? ` · all on ${groups.join(", ")} pages` : ""} · a flag is not a completed acquisition</span></p>
    <CompactTable caption="Page groups" rows={[...rows].sort(byDesc("unique_recordings"))} highlight={row => (numeric(row.recordings_with_observed_contact_activity) ?? 0) > 0} columns={[{ key: "page_group", label: "Page group" }, { key: "unique_recordings", label: "Recordings", numeric: true }, { key: "unique_visitors", label: "Visitors", numeric: true }, { key: "recordings_with_observed_contact_activity", label: "Contact flag", numeric: true }]} />
  </>;
}

/** main-10: the four exclusive groups as the 2×2 they are (marketing-sourced × 365-day touch link). */
function OverlapMatrix({ rows }: { rows: Row[] }) {
  const find = (pattern: RegExp) => rows.find(row => pattern.test(String(row.overlap_group)));
  const both = find(/^both/i), sourced = find(/sourced only/i), linked = find(/linked only/i), neither = find(/neither/i);
  if (!both || !sourced || !linked || !neither) return <Bars label="Opportunities by overlap group" rows={rows} name={row => text(row.overlap_group)} value="opportunities" />;
  const total = sum(rows, "opportunities");
  const largest = [both, sourced, linked, neither].reduce((best, row) => (numeric(row.opportunities) ?? 0) > (numeric(best.opportunities) ?? 0) ? row : best);
  const cell = (row: Row) => {
    const n = numeric(row.opportunities) ?? 0;
    const share = total ? n / total : 0;
    return <td className={row === largest ? "is-accent" : undefined} style={{ "--share": share } as CSSProperties}>
      <strong>{count(n)}</strong>
      <em>{percent(share)} of opportunities</em>
      <small>{orNA(numeric(row.won_opportunities), count)} won · {orNA(numeric(row.recorded_pipeline), money)} recorded pipeline</small>
    </td>;
  };
  return <table className="deck-matrix">
    <caption className="sr-only">Opportunities by marketing source and 365-day touch link; groups are exclusive and sum to {count(total)}</caption>
    <thead><tr><td /><th scope="col">Linked to a prior touch</th><th scope="col">No linked touch</th></tr></thead>
    <tbody>
      <tr><th scope="row">Marketing-sourced</th>{cell(both)}{cell(sourced)}</tr>
      <tr><th scope="row">Not marketing-sourced</th>{cell(linked)}{cell(neither)}</tr>
    </tbody>
  </table>;
}

/* ---------- the story: big idea, action titles, transitions ---------- */

/**
 * The one sentence a CMO should remember. It is the opening headline (main-01) and the closing line (main-16),
 * so the deck starts and ends on the same point of view.
 */
export const BIG_IDEA = "Fix conversion before buying volume. Prove reach before scaling spend.";

function decompositionLead(rows: Row[]) {
  const dimension = rows[0]?.dimension;
  const selected = rows.filter(row => row.dimension === dimension);
  if (!selected.length) return null;
  const total = sum(selected, "total_effect_pp");
  const lead = [...selected].sort((a, b) => Math.abs(numeric(b.total_effect_pp) ?? 0) - Math.abs(numeric(a.total_effect_pp) ?? 0))[0];
  const mix = Math.abs(numeric(lead?.mix_effect_pp) ?? 0), within = Math.abs(numeric(lead?.within_effect_pp) ?? 0);
  return { total, lead: displayName(lead?.group), leadEffect: numeric(lead?.total_effect_pp) ?? 0, driver: mix > within ? "mostly mix shift" : "mostly a within-group rate drop" };
}

/**
 * Takeaway headline for a main slide, computed from the snapshot so numbers never drift from the evidence.
 * Read in order, the sixteen headlines tell the story on their own: big idea → plan → evidence limits →
 * tension (value, conversion, measurement) → resolution (audience, actions, test, budget) → the ask.
 * The authored topic title (`slide.title`) moves to the kicker. Returns the topic title when inputs are missing.
 */
export function actionTitle(data: CaseStudyData, slide: CaseSlide): string {
  if (slide.sequence !== "main") return slide.title;
  const rows = (key: string): Row[] => data.datasets[key] ?? [];
  const s = summaryRow(data);
  const groups = rows("source_group_scorecard");
  const best = displayName(s.recent_best_rate_source ?? "Referral");
  try {
    switch (slide.id) {
      case "main-01": return BIG_IDEA;
      case "main-02": return "Three moves: fix marketing conversion, prove reach with a 90-day test, record contract value";
      case "main-03": {
        const crm = rows("motion_classification_coverage").map(row => numeric(row.created_year)).filter((n): n is number => n !== null);
        const logs = rows("source_coverage").map(row => dateMs(row.min_timestamp)).filter(Number.isFinite).map(ms => new Date(ms).getUTCFullYear());
        if (!crm.length || !logs.length) break;
        const logYears = Array.from(new Set(logs));
        return `CRM covers ${Math.min(...crm)}–${Math.max(...crm)} but marketing activity only ${logYears.length === 1 ? logYears[0] : `${Math.min(...logYears)}–${Math.max(...logYears)}`}: we see outcomes, not causal lift`;
      }
      case "main-04": {
        const [acq, existing] = motionTotals(data);
        const wins = (acq.won ?? 0) + (existing.won ?? 0);
        const mrr = (acq.zero_amount_win_mrr ?? 0) + (existing.zero_amount_win_mrr ?? 0);
        if (!wins || existing.won === null || !mrr || existing.zero_amount_win_mrr === null) break;
        return `Existing customers produce ${percent(existing.won / wins)} of wins and ${percent(existing.zero_amount_win_mrr / mrr, 0)} of the MRR missing from recorded amounts`;
      }
      case "main-05": {
        const sorted = groups.filter(row => row.scope === "All history" && row.ranked_channel === true).sort(byDesc("recorded_won_amount"));
        const a = numeric(sorted[0]?.recorded_won_amount), b = numeric(sorted[1]?.recorded_won_amount);
        if (a === null || b === null || b <= 0) break;
        return `On new logos, ${displayName(sorted[0].source_group)} is the benchmark: ${money(a)} won, ${ratioLabel(a / b)} the next source`;
      }
      case "main-06": {
        const top = num(s, "recent_best_win_rate"), mkt = num(s, "marketing_recent_win_rate");
        const rank = num(s, "marketing_recent_rank"), ranked = rankedRecent(data).length;
        if (top === null || mkt === null) break;
        return `Marketing-sourced deals convert at ${percent(mkt)}, ${mkt < top / 2 ? "under half" : "below"} ${best}’s ${percent(top)}${rank !== null && rank === ranked ? ` and lowest of ${ranked} sources` : ""}`;
      }
      case "main-07": {
        const lead = decompositionLead(rows("conversion_decomposition"));
        const [periodA] = periodLabels(slide);
        if (!lead) break;
        return `Overall win rate ${lead.total < 0 ? "fell" : "rose"} ${Math.abs(lead.total).toFixed(1)} pp since ${periodA}; ${lead.lead} accounts for ${Math.abs(lead.leadEffect).toFixed(1)} pp, ${lead.driver}`;
      }
      case "main-08": {
        const sorted = [...rows("creative_bundles")].sort(byDesc("ctr"));
        const a = numeric(sorted[0]?.ctr), b = numeric(sorted[1]?.ctr);
        if (a === null || b === null || b <= 0) break;
        return `The best creative bundle drew ${ratioLabel(a / b)} the CTR, but ${count(sum(sorted, "ads"))} labeled ads can only seed a test`;
      }
      case "main-09": {
        const web = rows("web_content");
        const flagged = sum(web, "recordings_with_observed_contact_activity"), recordings = sum(web, "unique_recordings");
        if (!recordings) break;
        return `Web and email show interest, not acquisition: only ${percent(flagged / recordings)} of site recordings reach Contact`;
      }
      case "main-10": {
        const share = unmeasuredShare(data);
        if (share === null) break;
        return `${percent(share, 0)} of opportunities have neither a marketing source nor a linked touch`;
      }
      case "main-11": {
        const sens = rows("attribution_model_sensitivity");
        const leaders = Array.from(new Set(sens.filter(row => row.rank === 1).map(row => displayName(row.channel))));
        if (!leaders.length) break;
        return leaders.length > 1
          ? `Attribution can't settle credit: ${leaders.slice(0, -1).join(", ")} or ${leaders[leaders.length - 1]} leads, depending on model and window`
          : `${leaders[0]} leads linked credit under every model and window, but credit is not lift`;
      }
      case "main-12": {
        const eligible = num(s, "eligible_domains");
        const excluded = sum(rows("audience_exclusions").filter(row => !/^eligible/i.test(String(row.exclusion))), "domains");
        if (eligible === null) break;
        return `${count(eligible)} ICP domains are eligible for a controlled test${excluded ? `, after excluding ${count(excluded)}` : ""}`;
      }
      case "main-13": {
        const observed = data.recommendations.filter(item => item.confidence_status === "Observed").length;
        return `Every gap maps to one action: ${observed} to act on now, ${data.recommendations.length - observed} to test first`;
      }
      case "main-14": {
        const scenarios = rows("experiment_scenarios");
        const feasible = scenarios.filter(row => row.feasible === true);
        const audience = numeric(scenarios[0]?.eligible_audience);
        if (!scenarios.length || audience === null) break;
        if (feasible.length === 1) {
          const base = numeric(feasible[0].baseline_rate), lift = numeric(feasible[0].absolute_lift);
          if (base !== null && lift !== null) return `Only 1 of ${scenarios.length} test designs fits ${count(audience)} domains: it must detect +${(lift * 100).toFixed(0)} pp from a ${percent(base, 0)} baseline`;
        }
        return `${feasible.length === 0 ? "None" : feasible.length} of ${scenarios.length} sample-size scenarios fit the ${count(audience)} eligible domains`;
      }
      case "main-15": {
        const feasible = rows("experiment_scenarios").filter(row => row.feasible === true).map(row => numeric(row.required_per_arm)).filter((n): n is number => n !== null);
        return feasible.length ? `The test budget needs one missing input: cost per account for ${count(Math.min(...feasible))} treatment accounts` : "No feasible test yet, so no planning budget can be set";
      }
      case "main-16": return "Decide today: fix marketing conversion, run the 90-day coverage test, record contract value";
    }
  } catch { /* fall back to the authored title */ }
  return slide.title;
}

/**
 * Presenter bridge from each main slide to the next one's headline (the JSON's transition note is generic).
 * Spoken right before advancing, so the next headline lands as the answer.
 */
const BRIDGES: Record<string, string> = {
  "main-01": "Here is how we get there, in three moves.",
  "main-02": "First, be clear about what this data can and cannot show.",
  "main-03": "Within that window, start with where wins and value actually sit.",
  "main-04": "Because existing customers dominate, we compare channels on new logos only.",
  "main-05": "Against that benchmark, look at how marketing-sourced deals convert.",
  "main-06": "And conversion is sliding across the whole business, not just in marketing.",
  "main-07": "Can creative fix it? The content evidence is thin.",
  "main-08": "Email and web give us interest signals, but not acquisition.",
  "main-09": "So how much of the pipeline can marketing even see?",
  "main-10": "And where we do see touches, attribution cannot settle the credit.",
  "main-11": "If attribution can't prove reach, a controlled test must. So who can we test on?",
  "main-12": "Here is how each gap turns into one action.",
  "main-13": "The test has to fit the audience we have.",
  "main-14": "With the design fixed, the budget needs one more input.",
  "main-15": "That brings us to the decisions we need today.",
};

/** Transition note for the presenter: a spoken bridge plus the next headline it leads into. */
export function transitionFor(data: CaseStudyData, slide: CaseSlide, next: CaseSlide | undefined): string {
  if (slide.sequence === "appendix") return slide.speaker_notes.transition;
  if (!next) return `Close on the big idea: “${BIG_IDEA}” Then open the appendix for questions.`;
  return `${BRIDGES[slide.id] ?? "Next:"} → “${actionTitle(data, next)}”`;
}

/* ---------- appendix renderers ---------- */

function summaryTiles(row: Row, keys: [string, string, (n: number) => string][]): Kpi[] {
  return keys.map(([key, labelText, format]) => ({ label: labelText, value: orNA(numeric(row[key]), format) }));
}

function AppendixRef({ data, slide, refName, limit }: { data: CaseStudyData; slide: CaseSlide; refName: string; limit: number }) {
  const rows = data.datasets[refName] ?? [];
  const title = displayName(refName);
  switch (refName) {
    case "summary": {
      const row = rows[0] ?? {};
      const keys: [string, string, (n: number) => string][] = slide.id === "appendix-06"
        ? [["recorded_pipeline", "Recorded pipeline", money], ["open_pipeline", "Open pipeline", money], ["recorded_won_amount", "Recorded won amount", money], ["zero_amount_wins", "Zero-amount wins", count], ["zero_amount_win_mrr", "MRR on zero-amount wins", money], ["zero_amount_win_mrr_existing_share", "…of it existing customer", percent]]
        : [["opportunities", "Opportunities", count], ["resolved", "Resolved", count], ["won", "Won", count], ["recorded_pipeline", "Recorded pipeline", money], ["recorded_won_amount", "Recorded won amount", money], ["zero_amount_wins", "Zero-amount wins", count]];
      return <Panel title="Population summary"><KpiTiles className="deck-kpis-compact" items={summaryTiles(row, keys)} /></Panel>;
    }
    case "population_reconciliation":
      return <Panel title="Population reconciliation"><CompactTable caption="Raw → canonical opportunities" rows={rows} columns={[{ key: "stage", label: "Stage" }, { key: "opportunities", label: "Opps", numeric: true }, { key: "won_opportunities", label: "Won", numeric: true }, { key: "recorded_amount", label: "Recorded amount", numeric: true, format: v => orNA(numeric(v), money) }]} /></Panel>;
    case "source_coverage":
      return <Panel title="Source coverage"><CompactTable caption="Activity log windows" rows={rows} limit={limit} columns={[{ key: "source", label: "Source", format: v => displayName(v) }, { key: "min_timestamp", label: "Window", format: (_v, row) => Number.isFinite(dateMs(row.min_timestamp)) ? `${monthLabel(dateMs(row.min_timestamp))} – ${monthLabel(dateMs(row.max_timestamp))}` : "No timestamps" }, { key: "rows", label: "Rows", numeric: true }, { key: "usable_touchpoints", label: "Usable", numeric: true }]} /></Panel>;
    case "content_metadata_coverage":
      return <Panel title="Creative metadata coverage"><CompactTable caption="Labeled creative fields" rows={rows} limit={limit} columns={[{ key: "platform", label: "Platform", format: v => displayName(v) }, { key: "field", label: "Field", format: v => fieldLabel(v) }, { key: "distinct_ads_known", label: "Ads", numeric: true }, { key: "known_impression_share", label: "Impr. share", numeric: true, format: v => orNA(numeric(v), n => percent(n, 2)) }]} /></Panel>;
    case "email_content":
      return <Panel title="Email titles by unique clickers"><CompactTable caption="Email content" rows={[...rows].sort(byDesc("unique_clickers"))} limit={limit} columns={[{ key: "content_title", label: "Title", format: v => text(v) }, { key: "unique_engaged_people", label: "Engaged", numeric: true }, { key: "unique_clickers", label: "Clickers", numeric: true }]} /></Panel>;
    case "attribution_model_sensitivity": {
      const models = Array.from(new Set(rows.map(row => String(row.model))));
      const channels = Array.from(new Set(rows.map(row => String(row.channel))));
      const longest = Math.max(0, ...rows.map(row => numeric(row.lookback_days) ?? 0));
      const pivot = channels.map(channel => Object.fromEntries([["channel", channel], ...models.map(model => [model, rows.find(row => row.channel === channel && row.model === model && row.lookback_days === longest)?.share_of_linked_amount ?? null])]) as Row);
      return <Panel title={`Share of linked amount by model · ${longest}-day window`}><CompactTable caption="Attribution model sensitivity" rows={pivot} columns={[{ key: "channel", label: "Channel", format: v => displayName(v) }, ...models.map(model => ({ key: model, label: model, numeric: true, format: (v: unknown) => orNA(numeric(v), percent) }))]} /></Panel>;
    }
    case "attribution_year_coverage": {
      const windows = Array.from(new Set(rows.map(row => numeric(row.lookback_days)).filter((n): n is number => n !== null))).sort((a, b) => a - b);
      const years = Array.from(new Set(rows.map(row => numeric(row.created_year)).filter((n): n is number => n !== null))).sort((a, b) => a - b);
      const byYear = years.map(year => Object.fromEntries([["created_year", String(year)], ...windows.map(w => [`w${w}`, rows.find(row => row.created_year === year && row.lookback_days === w)?.linked_share ?? null])]) as Row);
      // Collapse the leading run of years with no linked opportunities at any window into one row.
      const empty = (row: Row) => windows.every(w => numeric(row[`w${w}`]) === 0);
      let run = 0; while (run < byYear.length && empty(byYear[run])) run += 1;
      const pivot = run > 1 ? [{ ...byYear[0], created_year: `${byYear[0].created_year}–${byYear[run - 1].created_year}` }, ...byYear.slice(run)] : byYear;
      return <Panel title="Linked share of opportunities by year and lookback"><CompactTable caption="Attribution year coverage" rows={pivot} columns={[{ key: "created_year", label: "Year" }, ...windows.map(w => ({ key: `w${w}`, label: `${w}d`, numeric: true, format: (v: unknown) => orNA(numeric(v), n => percent(n, 0)) }))]} /></Panel>;
    }
    case "attribution_overlap":
      return <Panel title="Exclusive overlap groups"><CompactTable caption="Source / touch overlap" rows={rows} limit={limit} columns={[{ key: "overlap_group", label: "Group" }, { key: "opportunities", label: "Opps", numeric: true }, { key: "won_opportunities", label: "Won", numeric: true }, { key: "recorded_pipeline", label: "Pipeline", numeric: true, format: v => orNA(numeric(v), money) }]} /></Panel>;
    case "conversion_decomposition":
      return <Panel title="Net contribution by group"><Decomposition rows={rows} slide={slide} compact /></Panel>;
    case "loss_reason_summary":
      return rows.length ? <Panel title="Loss reasons"><CompactTable caption="Loss reasons" rows={rows} limit={limit} columns={fieldsOf(rows).slice(0, 4).map(key => ({ key, label: text(key) }))} /></Panel> : <Panel title="Loss reasons"><p className="deck-empty">Loss-reason mapping is unavailable pending a versioned rule for free text.</p></Panel>;
    case "audience_exclusions":
      return <Panel title="Domain eligibility"><AudienceWaterfall rows={rows} summary={summaryRow(data)} /></Panel>;
    case "audience_priority":
      return <Panel title="Priority cells · resolved win rate"><Bars label="Top segment and fit cells" rows={rows.filter(row => row.shortlist_eligible === true).sort(byDesc("win_rate")).slice(0, limit)} name={row => text(row.segment_fit)} value="win_rate" format={percent} /></Panel>;
    case "experiment_scenarios":
      return <Panel title="Sample-size scenarios"><ScenarioGrid rows={rows} compact /></Panel>;
    case "source_group_scorecard":
      return <Panel title="Acquisition value by source · all history"><CompactTable caption="Recorded amount beside MRR (never added)" rows={rows.filter(row => row.scope === "All history").sort(byDesc("recorded_won_amount"))} limit={limit} columns={[{ key: "source_group", label: "Source", format: v => displayName(v) }, { key: "won", label: "Won", numeric: true }, { key: "recorded_won_amount", label: "Won amount", numeric: true, format: v => orNA(numeric(v), money) }, { key: "zero_amount_win_mrr", label: "Zero-amount MRR", numeric: true, format: v => orNA(numeric(v), money) }]} /></Panel>;
    default: {
      if (rows.length === 1) return <Panel title={title}><KpiTiles className="deck-kpis-compact" items={Object.entries(rows[0]).filter(([, v]) => numeric(v) !== null).slice(0, 6).map(([key, v]) => ({ label: displayName(key), value: formatField(key, v) }))} /></Panel>;
      return <Panel title={title}><CompactTable caption={title} rows={rows} limit={limit} columns={fieldsOf(rows).slice(0, 4).map(key => ({ key, label: text(key) }))} /></Panel>;
    }
  }
}

/* ---------- dispatcher ---------- */

export function SlideVisual({ data, slide }: { data: CaseStudyData; slide: CaseSlide }) {
  const rows = (key: string): Row[] => data.datasets[key] ?? [];
  const groups = rows("source_group_scorecard");
  if (slide.sequence === "appendix") {
    const refs = slide.id === "appendix-05" ? slide.chart_refs.filter(ref => ref !== "audience_priority") : slide.chart_refs;
    const limit = refs.length >= 3 ? 4 : refs.length === 2 ? 6 : 10;
    return <div className={`deck-appendix refs-${refs.length}`}>{refs.map(ref => <AppendixRef key={ref} data={data} slide={slide} refName={ref} limit={limit} />)}</div>;
  }
  switch (slide.id) {
    case "main-01": return <GapTiles data={data} />;
    case "main-02": return <MoveTiles data={data} />;
    case "main-03": return <Panel title="Observation window by source">{<CoverageTimeline data={data} />}</Panel>;
    case "main-04": return <MotionShare data={data} />;
    case "main-05": return <Panel title="New-logo deals · 2018–2024 · recorded won amount by source"><Bars label="Recorded won amount by source group" rows={groups.filter(row => row.scope === "All history" && row.ranked_channel === true).sort(byDesc("recorded_won_amount"))} name={row => displayName(row.source_group)} value="recorded_won_amount" format={money} detail={row => `${text(row.won)} new-logo wins`} /></Panel>;
    case "main-06": return <Panel title="New-logo deals · 2023–24 · resolved win rate by source"><Bars label="Resolved win rate by source group" rows={groups.filter(row => row.scope === "2023–2024" && row.ranked_channel === true).sort(byDesc("win_rate"))} emphasis={(row, index) => /marketing/i.test(displayName(row.source_group)) ? "accent" : index === 0 ? "reference" : undefined} name={row => displayName(row.source_group)} value="win_rate" format={percent} detail={row => `${text(row.won)} of ${text(row.resolved)} resolved · 95% CI ${numeric(row.win_rate_ci_low) === null ? "unavailable" : `${percent(Number(row.win_rate_ci_low))}–${percent(Number(row.win_rate_ci_high))}`}`} /></Panel>;
    case "main-07": return <Decomposition rows={rows("conversion_decomposition")} slide={slide} />;
    case "main-08": return <CreativeBundles rows={rows("creative_bundles")} />;
    case "main-09": return <div className="deck-two">
      <Panel title="Email · top 5 titles by unique clickers · no delivery denominator"><Bars label="Unique clickers by email title" rows={[...rows("email_content")].sort(byDesc("unique_clickers")).slice(0, 5)} emphasis={() => undefined} name={row => emailLabel(row.content_title) || text(row.content_title)} hint={row => text(row.content_title) === "Unavailable" ? "Unavailable" : String(row.content_title)} value="unique_clickers" /></Panel>
      <Panel title="Website · recordings and observed contact activity"><WebContact rows={rows("web_content")} /></Panel>
    </div>;
    case "main-10": return <Panel title="Exclusive groups · marketing source × 365-day touch link · opportunities"><OverlapMatrix rows={rows("attribution_overlap")} /></Panel>;
    case "main-11": return <div className="deck-two">
      <Panel title="Rank-1 channel by model and lookback"><LeaderGrid rows={rows("attribution_model_sensitivity")} /></Panel>
      <Panel title="Explore one view · credit is shared, not summed"><AttributionPanel rows={rows("attribution_model_sensitivity")} /></Panel>
    </div>;
    case "main-12": return <div className="deck-two">
      <Panel title="From assessed domains to eligible audience"><AudienceWaterfall rows={rows("audience_exclusions")} summary={summaryRow(data)} /></Panel>
      <Panel title="Where to start · top 5 segment / fit cells by historical win rate"><Bars label="Top segment and fit cells by win rate" rows={rows("audience_priority").filter(row => row.shortlist_eligible === true).sort(byDesc("win_rate")).slice(0, 5)} emphasis={(_row, index) => index === 0 ? "reference" : undefined} name={row => text(row.segment_fit)} value="win_rate" format={percent} detail={row => `n = ${orNA(numeric(row.resolved), count)} resolved · ${orNA(numeric(row.eligible_domains), count)} eligible`} /></Panel>
    </div>;
    case "main-13": return <GapActionMap data={data} />;
    case "main-16": return <AskTable data={data} />;
    case "main-14": return <ScenarioGrid rows={rows("experiment_scenarios")} />;
    case "main-15": return <BudgetFormula data={data} />;
    default: return null;
  }
}
