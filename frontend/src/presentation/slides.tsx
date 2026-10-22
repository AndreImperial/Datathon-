import { useEffect, useRef, useState, type ReactNode } from "react";

import { TableProperties, X } from "lucide-react";

import type { CaseSlide, CaseStudyData } from "../types";
import { columnLabel, formatDollarsCompact, formatField, formatMonthYear } from "../evidence";
import { displayName } from "../labels";
import { fieldLabel } from "./labels";

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

export function Bars({ rows, name, value, format = count, detail, label }: { rows: Row[]; name: (row: Row) => string; value: string; format?: (n: number) => string; detail?: (row: Row) => string; label: string }) {
  const observedMax = Math.max(0, ...rows.map(row => Math.abs(numeric(row[value]) ?? 0)));
  const max = observedMax > 0 ? observedMax : 1;
  if (!rows.length) return <p className="deck-empty">Evidence unavailable for this scope.</p>;
  return <ul className="slide-bars" aria-label={label}>{rows.map((row, index) => {
    const n = numeric(row[value]);
    const title = name(row);
    return <li className="slide-bar" key={`${title}-${index}`}>
      <span className="slide-bar-name" title={title}>{title}</span>
      <i className={n !== null && n < 0 ? "negative" : ""} aria-hidden="true"><b style={{ width: `${n === null ? 0 : Math.abs(n) / max * 100}%` }} /></i>
      <strong>{n === null ? "Unavailable" : format(n)}</strong>
      {detail && <small>{detail(row)}</small>}
    </li>;
  })}</ul>;
}

type Column = { key: string; label: string; format?: (value: unknown, row: Row) => string; numeric?: boolean };
function CompactTable({ rows, columns, limit, caption }: { rows: Row[]; columns: Column[]; limit?: number; caption: string }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!rows.length) return <p className="deck-empty">No rows are available for this evidence.</p>;
  const truncated = Boolean(limit && rows.length > (limit ?? 0));
  return <table className="deck-table"><caption className={truncated ? "" : "sr-only"}>{truncated ? <><span className="sr-only">{caption}: </span>Top {shown.length} of {count(rows.length)} · all rows under View evidence</> : caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={column.key} className={column.numeric ? "num" : ""}>{column.label}</th>)}</tr></thead><tbody>{shown.map((row, index) => <tr key={index}>{columns.map(column => <td key={column.key} className={column.numeric ? "num" : ""}>{column.format ? column.format(row[column.key], row) : formatField(column.key, row[column.key])}</td>)}</tr>)}</tbody></table>;
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

function CaseQuestionTiles({ data }: { data: CaseStudyData }) {
  const s = summaryRow(data);
  const ranked = rankedRecent(data).length;
  return <KpiTiles className="deck-kpis-hero" items={[
    { label: "Top new-logo source · all history", value: displayName(s.top_channel), note: `${orNA(num(s, "top_channel_win_rate"), percent)} resolved win rate`, tone: "accent" },
    { label: "Marketing-sourced win rate · 2023–24", value: orNA(num(s, "marketing_recent_win_rate"), percent), note: `vs ${orNA(num(s, "recent_best_win_rate"), percent)} for ${displayName(s.recent_best_rate_source)} (best)${num(s, "marketing_recent_rank") !== null && ranked ? ` · rank ${num(s, "marketing_recent_rank")} of ${ranked}` : ""}` },
    { label: "MRR on zero-amount wins", value: orNA(num(s, "zero_amount_win_mrr"), money), note: `${orNA(num(s, "zero_amount_wins"), count)} wins record no contract amount; MRR is shown beside amount, never added` },
  ]} />;
}

function StrategyTiles({ data }: { data: CaseStudyData }) {
  const s = summaryRow(data);
  return <KpiTiles className="deck-kpis-four" items={[
    { label: `Protect ${displayName(s.recent_best_rate_source)}`, value: orNA(num(s, "recent_best_win_rate"), percent), note: "2023–24 acquisition win rate, best ranked source", tone: "accent" },
    { label: "Fix marketing conversion", value: orNA(num(s, "marketing_recent_win_rate"), percent), note: `${orNA(num(s, "marketing_recent_opportunities"), count)} of ${orNA(num(s, "recent_acquisition_opportunities"), count)} new-logo opportunities in 2023–24` },
    { label: "Record contract value", value: `${orNA(num(s, "zero_amount_wins"), count)} of ${orNA(num(s, "won"), count)}`, note: "wins carry a zero or blank recorded amount" },
    { label: "Test before scaling", value: orNA(num(s, "eligible_domains"), count), note: "eligible ICP domains for a controlled test" },
  ]} />;
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

function BusinessMotion({ data }: { data: CaseStudyData }) {
  const [acq, existing] = motionTotals(data);
  const totalWins = (acq.won ?? 0) + (existing.won ?? 0);
  const share = totalWins > 0 && existing.won !== null ? existing.won / totalWins : null;
  const coverage = [...(data.datasets.motion_classification_coverage ?? [])].sort((a, b) => (numeric(a.created_year) ?? 0) - (numeric(b.created_year) ?? 0));
  const peak = Math.max(1, ...coverage.map(row => (numeric(row.acquisition_opportunities) ?? 0) + (numeric(row.existing_customer_opportunities) ?? 0)));
  return <div className="deck-motion">
    <div className="deck-motion-kpis">
      <p className="deck-callout"><strong>{share === null ? "Unavailable" : percent(share)}</strong> of {count(totalWins)} wins come from existing customers <span>({orNA(existing.won, count)} existing · {orNA(acq.won, count)} acquisition, all history)</span></p>
      <KpiTiles items={[
        { label: "Acquisition", value: `${orNA(acq.won, count)} wins`, note: `${orNA(acq.recorded_won_amount, money)} recorded won amount` },
        { label: "Existing customer", value: `${orNA(existing.won, count)} wins`, note: `${orNA(existing.recorded_won_amount, money)} recorded won amount · ${orNA(existing.zero_amount_win_mrr, money)} MRR on zero-amount wins`, tone: "accent" },
      ]} />
    </div>
    <Panel title="Opportunities by created year · motion from account history" className="deck-motion-chart">
      <div className="deck-legend" aria-hidden="true"><span className="acq">Acquisition</span><span className="ext">Existing customer</span><span className="note">% = CRM type field filled</span></div>
      <ol className="deck-columns" aria-label="Acquisition and existing-customer opportunities by created year">{coverage.map(row => {
        const a = numeric(row.acquisition_opportunities) ?? 0, e = numeric(row.existing_customer_opportunities) ?? 0;
        const crmType = numeric(row.crm_type_coverage);
        return <li key={String(row.created_year)} aria-label={`${row.created_year}: ${count(a)} acquisition, ${count(e)} existing customer; CRM type filled ${orNA(crmType, n => percent(n, 0))}`}>
          <div className="deck-column" aria-hidden="true"><span className="total">{count(a + e)}</span><b className="ext" style={{ height: `${e / peak * 100}%` }}>{e / peak > 0.09 ? count(e) : ""}</b><b className="acq" style={{ height: `${a / peak * 100}%` }}>{a / peak > 0.09 ? count(a) : ""}</b></div>
          <strong>{String(row.created_year)}</strong>
          <small className={crmType !== null && crmType < 0.5 ? "low" : ""}>{orNA(crmType, n => percent(n, 0))}</small>
        </li>;
      })}</ol>
    </Panel>
  </div>;
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
  return <div className={`deck-decomp ${compact ? "compact" : ""}`.trim()}>
    <div className="deck-decomp-head">
      <p className="deck-callout"><strong>{signedPp(total)}</strong> resolved win-rate change, {periodA} → {periodB} <span>{orNA(rateA, percent)} → {orNA(rateB, percent)}; group contributions below sum to the total</span></p>
      <label className="deck-select">Grouping <select value={dimension} onChange={event => setDimension(event.target.value)}>{dimensions.map(item => <option key={item} value={item}>{displayName(item)}</option>)}</select></label>
    </div>
    <ul className="deck-diverging" aria-label={`Net percentage-point contribution by ${displayName(dimension)}, sorted`}>{plotted.map(row => {
      const n = numeric(row.total_effect_pp) ?? 0;
      const left = n < 0 ? zero - Math.abs(n) / span * 100 : zero;
      return <li key={String(row.group)}>
        <span className="slide-bar-name">{displayName(row.group)}{row.support !== "Common support" && <em> · entry/exit</em>}</span>
        <i aria-hidden="true"><u style={{ left: `${zero}%` }} /><b className={n < 0 ? "negative" : "positive"} style={{ left: `${left}%`, width: `${Math.max(0.4, Math.abs(n) / span * 100)}%` }} /></i>
        <strong>{signedPp(n, 2)}</strong>
        {!compact && <small>{detail(row)}</small>}
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

function DecisionTable({ data }: { data: CaseStudyData }) {
  return <table className="deck-decisions">
    <caption className="sr-only">Decisions with success measure and stop rule</caption>
    <thead><tr><th scope="col">Decision</th><th scope="col">Measure</th><th scope="col">Scale / stop rule</th></tr></thead>
    <tbody>{data.recommendations.map(item => <tr key={item.id}><th scope="row"><span className={`deck-chip ${item.confidence_status === "Observed" ? "observed" : "hypothesis"}`}>{item.confidence_status}</span>{item.decision}</th><td>{item.primary_success_measure}</td><td>{item.scale_stop_rule}</td></tr>)}</tbody>
  </table>;
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
    <Bars label="Attributed recorded amount by channel" rows={selected} name={row => displayName(row.channel)} value="attributed_amount" format={money} detail={row => `${orNA(numeric(row.share_of_linked_amount), percent)} of linked amount · rank ${text(row.rank)}`} />
  </>;
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
    case "main-01": return <CaseQuestionTiles data={data} />;
    case "main-02": return <StrategyTiles data={data} />;
    case "main-03": return <Panel title="Observation window by source">{<CoverageTimeline data={data} />}</Panel>;
    case "main-04": return <BusinessMotion data={data} />;
    case "main-05": return <Panel title="Acquisition · 2018–2024 · recorded won amount by source"><Bars label="Recorded won amount by source group" rows={groups.filter(row => row.scope === "All history" && row.ranked_channel === true).sort(byDesc("recorded_won_amount"))} name={row => displayName(row.source_group)} value="recorded_won_amount" format={money} detail={row => `Won ${text(row.won)} of ${text(row.resolved)} resolved · win rate ${orNA(numeric(row.win_rate), percent)} · MRR on zero-amount wins ${orNA(numeric(row.zero_amount_win_mrr), money)}`} /></Panel>;
    case "main-06": return <Panel title="Acquisition · 2023–24 · resolved win rate by source"><Bars label="Resolved win rate by source group" rows={groups.filter(row => row.scope === "2023–2024" && row.ranked_channel === true).sort(byDesc("win_rate"))} name={row => displayName(row.source_group)} value="win_rate" format={percent} detail={row => `Won ${text(row.won)} of ${text(row.resolved)} resolved (${text(row.opportunities)} opps) · 95% interval ${numeric(row.win_rate_ci_low) === null ? "unavailable" : `${percent(Number(row.win_rate_ci_low))}–${percent(Number(row.win_rate_ci_high))}`}`} /></Panel>;
    case "main-07": return <Decomposition rows={rows("conversion_decomposition")} slide={slide} />;
    case "main-08": return <Panel title="Labeled creative bundles · observational CTR"><Bars label="CTR by creative bundle" rows={[...rows("creative_bundles")].sort(byDesc("ctr"))} name={row => ["_copyassettype", "_copymessaging", "_copytone"].map(key => text(row[key])).join(" / ")} value="ctr" format={n => `${(n * 100).toFixed(3)}%`} detail={row => `${displayName(row._platform)} · ${text(row._ctacopysofthard)} · ${text(row.ads)} ads · ${orNA(numeric(row.impressions), count)} impressions · ${orNA(numeric(row.clicks), count)} clicks`} /></Panel>;
    case "main-09": return <div className="deck-two">
      <Panel title="Email · top 5 titles by unique clickers"><Bars label="Unique clickers by email title" rows={[...rows("email_content")].sort(byDesc("unique_clickers")).slice(0, 5)} name={row => text(row.content_title)} value="unique_clickers" detail={row => `${orNA(numeric(row.unique_engaged_people), count)} engaged people · no delivery denominator`} /></Panel>
      <Panel title="Website · recordings and observed contact activity"><CompactTable caption="Page groups" rows={[...rows("web_content")].sort(byDesc("unique_recordings"))} columns={[{ key: "page_group", label: "Page group" }, { key: "unique_recordings", label: "Recordings", numeric: true }, { key: "unique_visitors", label: "Visitors", numeric: true }, { key: "recordings_with_observed_contact_activity", label: "Contact flag", numeric: true }]} /></Panel>
    </div>;
    case "main-10": return <Panel title="Exclusive source / touch overlap groups · opportunities"><Bars label="Opportunities by overlap group" rows={rows("attribution_overlap")} name={row => text(row.overlap_group)} value="opportunities" detail={row => `${orNA(numeric(row.won_opportunities), count)} won · ${orNA(numeric(row.recorded_pipeline), money)} recorded pipeline`} /></Panel>;
    case "main-11": return <div className="deck-two">
      <Panel title="Attribution · model and lookback kept explicit"><AttributionPanel rows={rows("attribution_model_sensitivity")} /></Panel>
      <Panel title="Observed journeys · resolved denominator"><CompactTable caption="Journey sequences" rows={rows("journey_outcomes")} columns={[{ key: "sequence", label: "Sequence" }, { key: "resolved_opportunities", label: "Resolved", numeric: true }, { key: "wins", label: "Wins", numeric: true }, { key: "win_rate", label: "Win rate", numeric: true, format: v => orNA(numeric(v), percent) }]} /></Panel>
    </div>;
    case "main-12": return <div className="deck-two">
      <Panel title="From assessed domains to eligible audience"><AudienceWaterfall rows={rows("audience_exclusions")} summary={summaryRow(data)} /></Panel>
      <Panel title="Top 5 segment / fit cells · historical win rate"><Bars label="Top segment and fit cells by win rate" rows={rows("audience_priority").filter(row => row.shortlist_eligible === true).sort(byDesc("win_rate")).slice(0, 5)} name={row => text(row.segment_fit)} value="win_rate" format={percent} detail={row => `n = ${orNA(numeric(row.resolved), count)} resolved · ${orNA(numeric(row.eligible_domains), count)} eligible domains`} /></Panel>
    </div>;
    case "main-13": case "main-16": return <DecisionTable data={data} />;
    case "main-14": return <ScenarioGrid rows={rows("experiment_scenarios")} />;
    case "main-15": return <BudgetFormula data={data} />;
    default: return null;
  }
}
