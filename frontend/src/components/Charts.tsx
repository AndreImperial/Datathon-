import { columnLabel, formatDollars, formatDollarsCompact, formatField, formatMonthYear } from "../evidence";
import { displayName } from "../labels";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { DashboardDatasets, DataRow } from "../types";
import { numberValue, textValue } from "../types";
import {
  ACCENT,
  COLORS,
  CONTEXT,
  CONTEXT_LIGHT,
  ChartNote,
  ChartShell,
  GAIN,
  LIMITED_N,
  LOSS,
  TICK_SIZE,
  axisTick,
  bandCursor,
  categoryAxis,
  gridProps,
  limitedFlag,
  lineCursor,
  niceTicks,
  tooltipBase,
  tooltipContent,
  useActiveIndex,
  valueAxis,
} from "./chartKit";
import type { TipRow } from "./chartKit";

export { COLORS } from "./chartKit";

// Distinct, ordered series colours for multi-series charts (largest series
// first).  The neutral tail colour is reserved for the long-tail bucket.
const SERIES = [COLORS.blue, COLORS.teal, COLORS.slate, COLORS.azure, COLORS.violet];
const TAIL_COLOR = "#5C5455";
const TAIL_BUCKET = "Other";
const TAIL_LABEL = "All other channels";

// CRM channel categories that are not marketing programmes.  Everything else
// is a marketing channel; together those sum to the marketing-sourced total.
const NON_MARKETING = new Set(["other", "existing_client", "referral"]);

// Compact axis/label money: $1.2M, $350K, $940.
const money = formatDollarsCompact;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const count = (value: number) => Math.round(value).toLocaleString("en-US");
const legendStyle: CSSProperties = { fontSize: 12 };

/** Pretty label for a raw code or a "a -> b" journey sequence. */
const prettyLabel = (value: unknown) => String(value ?? "").split(" -> ").map((part) => displayName(part.trim())).join(" → ");

/** Greedy word wrap into at most `maxLines` lines of roughly `maxChars`. */
function wrapText(value: string, maxChars: number, maxLines = 2): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) { current = next; continue; }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  const hardWrapped = lines.flatMap((line) => line.length <= maxChars ? [line] : (line.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [line]));
  if (hardWrapped.length <= maxLines) return hardWrapped;
  const kept = hardWrapped.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1))}…`;
  return kept;
}

/** Nice ticks whose top bound overshoots the maximum the least (3–6 steps). */
function bestTicks(maxValue: number): number[] {
  const options = [4, 5, 3, 6].map((steps) => niceTicks(maxValue, steps));
  return options.reduce((best, ticks) => ticks[ticks.length - 1] < best[best.length - 1] ? ticks : best);
}

interface TickProps { x?: number | string; y?: number | string; payload?: { value?: unknown } }

/** Category-axis tick that renders up to two lines (primary + optional secondary). */
function stackedTick(lines: (value: string) => string[], { anchor = "end", vertical = true }: { anchor?: "end" | "middle"; vertical?: boolean } = {}) {
  return function StackedTick(props: TickProps): ReactElement {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const parts = lines(String(props.payload?.value ?? ""));
    const lineHeight = 14;
    const offset = vertical ? -((parts.length - 1) * lineHeight) / 2 : 0;
    return <g transform={`translate(${x},${y})`}>
      <text x={vertical ? -8 : 0} y={vertical ? offset : 6} textAnchor={anchor} fontSize={TICK_SIZE}>
        {parts.map((part, index) => <tspan key={index} x={vertical ? -8 : 0} dy={index === 0 ? (vertical ? 4 : 12) : lineHeight} fill={index === 0 ? COLORS.pale : COLORS.muted}>{part}</tspan>)}
      </text>
    </g>;
  };
}

/** Single-line category tick (Recharts' default tick wraps long labels into overlapping lines). */
const lineTick = stackedTick((value) => [value]);

function useNarrow(breakpoint = 560) {
  const query = `(max-width: ${breakpoint}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

function EmptyChart({ message = "No chart data available for this scope." }: { message?: string }) {
  return <div className="chart-empty" role="status"><strong>Chart unavailable</strong><span>{message}</span></div>;
}

/** Footnote naming the categories whose sample is too small to rank on. */
function LimitedNote({ labels, unit }: { labels: string[]; unit: string }) {
  if (!labels.length) return null;
  return <ChartNote tone="flag">Fewer than {LIMITED_N} {unit}: {labels.join(", ")}. Read {labels.length === 1 ? "it" : "these"} as directional only.</ChartNote>;
}

const valueLabel = (format: (value: number) => string) => ({ fill: COLORS.ink, fontSize: TICK_SIZE, formatter: (value: number) => format(value) });

/** Accent only a clear leader: at least 5% ahead of the runner-up. */
const clearLeader = (values: number[]) => values.length < 2 || values[0] >= values[1] * 1.05;
const UNLABELED = /^(unknown|other|unavailable)\b/i;

const swatch = (color: string, extra: CSSProperties = {}) => <i style={{ background: color, ...extra }} />;

export function PipelineChart({ data, won = false }: { data: DataRow[]; won?: boolean }) {
  const narrow = useNarrow();
  const { handlers, opacity } = useActiveIndex();
  const key = won ? "won_pipeline" : "total_pipeline";
  const total = data.reduce((sum, row) => sum + Math.max(0, numberValue(row, key)), 0);
  const shaped = data
    .filter((row) => numberValue(row, key) > 0)
    .sort((a, b) => numberValue(b, key) - numberValue(a, key))
    .map((row) => {
      const code = textValue(row, "channel_category");
      return { channel: displayName(code), amount: numberValue(row, key), marketing: !NON_MARKETING.has(code), deals: numberValue(row, "deal_count"), wonDeals: numberValue(row, "won_count"), share: total ? numberValue(row, key) / total : 0 };
    });
  if (!shaped.length) return <EmptyChart />;
  const marketingTotal = shaped.filter((row) => row.marketing).reduce((sum, row) => sum + row.amount, 0);
  const height = Math.max(300, shaped.length * (narrow ? 34 : 30));
  const ticks = bestTicks(Math.max(...shaped.map((row) => row.amount)));
  const tick = narrow ? stackedTick((value) => wrapText(value, 14, 2)) : lineTick;
  const metric = won ? "Won revenue" : "Pipeline";
  const limited = shaped.filter((row) => row.deals < LIMITED_N).map((row) => row.channel);
  return <>
    <ChartShell minHeight={height}>{(motion) => <ResponsiveContainer width="100%" height={height}><ComposedChart data={shaped} layout="vertical" margin={{ left: 4, right: 60, top: 8, bottom: 12 }} {...handlers}>
      <CartesianGrid {...gridProps} horizontal={false} vertical />
      <XAxis type="number" {...valueAxis} domain={[0, ticks[ticks.length - 1]]} ticks={narrow ? ticks.filter((_, index) => index % 2 === 0) : ticks} tickFormatter={money} />
      <YAxis type="category" dataKey="channel" width={narrow ? 112 : 160} tick={tick} interval={0} {...categoryAxis} />
      <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
        title: String(row.channel),
        rows: [
          { label: metric, value: formatDollars(Number(row.amount)), color: row.marketing ? ACCENT : CONTEXT_LIGHT, strong: true },
          { label: `Share of ${won ? "won revenue" : "pipeline"}`, value: pct(Number(row.share)) },
          { label: "Deals", value: count(Number(row.deals)) },
          ...(won ? [{ label: "Won deals", value: count(Number(row.wonDeals)) }] : []),
        ],
        note: row.marketing ? "Marketing channel" : "Not a marketing programme (referral, existing client or unlabeled CRM)",
        flag: limitedFlag(Number(row.deals), "deals"),
      }))} />
      <Bar dataKey="amount" name={metric} barSize={17} radius={[0, 4, 4, 0]} {...motion}>
        {shaped.map((row, index) => <Cell key={row.channel} fill={row.marketing ? ACCENT : CONTEXT_LIGHT} fillOpacity={opacity(index)} />)}
        <LabelList dataKey="amount" position="right" {...valueLabel(money)} />
      </Bar>
    </ComposedChart></ResponsiveContainer>}</ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label={`${metric} by channel legend`}>
      <span>{swatch(ACCENT)}Marketing channels · {money(marketingTotal)} ({total ? pct(marketingTotal / total, 0) : "0%"})</span>
      <span>{swatch(CONTEXT_LIGHT)}Referral, existing client &amp; unlabeled CRM · {money(total - marketingTotal)}</span>
    </div>
    <LimitedNote labels={limited} unit="deals" />
  </>;
}

export function MonthlyPipelineChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const channels = Array.from(new Set(data.map((row) => textValue(row, "channel"))));
  const months = Array.from(new Set(data.map((row) => textValue(row, "month")))).sort();
  // Keep the long-tail bucket last so the stack and legend read as a ranked
  // story.  The source contract limits this dataset to the top channel groups
  // plus that bucket, which is labelled distinctly from the CRM "other" value.
  const totals = new Map(channels.map((channel) => [channel, data.filter((row) => textValue(row, "channel") === channel).reduce((sum, row) => sum + numberValue(row, "pipeline"), 0)]));
  const orderedChannels = [...channels].sort((a, b) => {
    if (a === TAIL_BUCKET) return 1;
    if (b === TAIL_BUCKET) return -1;
    return (totals.get(b) ?? 0) - (totals.get(a) ?? 0);
  });
  const series = orderedChannels.map((channel, index) => ({
    channel,
    key: `s${index}`,
    label: channel === TAIL_BUCKET ? TAIL_LABEL : displayName(channel),
    color: channel === TAIL_BUCKET ? TAIL_COLOR : SERIES[index % SERIES.length],
  }));
  const rows = months.map((month) => {
    const row: Record<string, string | number> = { month };
    let total = 0;
    series.forEach(({ channel, key }) => {
      const value = data.filter((item) => textValue(item, "month") === month && textValue(item, "channel") === channel).reduce((sum, item) => sum + numberValue(item, "pipeline"), 0);
      row[key] = value;
      total += value;
    });
    row.total = total;
    return row;
  });
  if (!rows.length || !series.length) return <EmptyChart />;
  // One tick per January (every other year on phones) reads as a timeline,
  // instead of arbitrary YYYY-MM labels.
  const januaries = months.filter((month) => month.endsWith("-01"));
  const yearTicks = (narrow ? januaries.filter((_, index) => index % 2 === 0) : januaries);
  const yTicks = bestTicks(Math.max(...rows.map((row) => Number(row.total))));
  return <>
    <ChartShell minHeight={320}>{(motion) => <ResponsiveContainer width="100%" height={320}><ComposedChart data={rows} margin={{ left: 0, right: 16, top: 10, bottom: 8 }} barCategoryGap={1}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="month" {...categoryAxis} tick={axisTick} ticks={yearTicks.length >= 2 ? yearTicks : undefined} interval={yearTicks.length >= 2 ? 0 : "preserveStartEnd"} minTickGap={8} tickFormatter={(value: string) => yearTicks.length >= 2 ? value.slice(0, 4) : value} tickMargin={6} />
      <YAxis {...valueAxis} domain={[0, yTicks[yTicks.length - 1]]} ticks={yTicks} tickFormatter={money} width={56} />
      <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => {
        const parts: TipRow[] = series.map(({ key, label, color }) => ({ label, value: formatDollars(Number(row[key] ?? 0)), color, amount: Number(row[key] ?? 0) }))
          .filter((part) => part.amount > 0).sort((a, b) => b.amount - a.amount).map(({ label, value, color }) => ({ label, value, color }));
        return { title: formatMonthYear(`${row.month}-01`), rows: [...parts, { label: "Total pipeline created", value: formatDollars(Number(row.total)), strong: true }] };
      })} />
      {series.map(({ key, label, color }) => <Bar key={key} dataKey={key} name={label} stackId="mix" fill={color} {...motion} />)}
    </ComposedChart></ResponsiveContainer>}</ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label="Monthly pipeline mix legend">{series.map(({ key, label, color }) => <span key={key}>{swatch(color)}{label}</span>)}</div>
  </>;
}

export function CohortChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => textValue(row, "quarter") >= "2022Q1");
  if (!rows.length) return <EmptyChart />;
  const rateOf = (row: DataRow) => numberValue(row, "closed_win_rate", numberValue(row, "win_rate"));
  const lineRows = rows.map((row) => {
    const rate = rateOf(row);
    const low = numberValue(row, "win_rate_ci_low", numberValue(row, "ci_low", rate));
    const high = numberValue(row, "win_rate_ci_high", numberValue(row, "ci_high", rate));
    return {
      quarter: textValue(row, "quarter"),
      is_mature: Boolean(row.is_mature),
      // `closed_win_rate` is the canonical contract key; the fallback keeps
      // the evidence line resilient if an older validated cohort export only
      // exposes the legacy `win_rate` alias.
      "Closed-deal win rate": rate * 100,
      winError: [Math.max(0, (rate - low) * 100), Math.max(0, (high - rate) * 100)],
      low: low * 100,
      high: high * 100,
      "Resolved share": numberValue(row, "resolved_share") * 100,
      won: numberValue(row, "won", Number.NaN),
      resolved: numberValue(row, "resolved", Number.NaN),
    };
  });
  const pipelineRows = rows.map((row) => ({ quarter: textValue(row, "quarter"), Pipeline: numberValue(row, "pipeline"), deals: numberValue(row, "deals", Number.NaN), is_mature: Boolean(row.is_mature), resolvedShare: numberValue(row, "resolved_share") }));
  // Reference: pooled closed-deal win rate across mature cohorts in view.
  const mature = lineRows.filter((row) => row.is_mature);
  const pooledWon = mature.reduce((sum, row) => sum + (Number.isFinite(row.won) ? row.won : 0), 0);
  const pooledResolved = mature.reduce((sum, row) => sum + (Number.isFinite(row.resolved) ? row.resolved : 0), 0);
  const matureAvg = pooledResolved > 0 ? (pooledWon / pooledResolved) * 100 : mature.length ? mature.reduce((sum, row) => sum + row["Closed-deal win rate"], 0) / mature.length : Number.NaN;
  const provisional = lineRows.filter((row) => !row.is_mature).map((row) => row.quarter);
  const pipelineTicks = bestTicks(Math.max(...pipelineRows.map((row) => row.Pipeline)));
  const provisionalBand = provisional.length ? <ReferenceArea x1={provisional[0]} x2={provisional[provisional.length - 1]} fill="#FFFFFF" fillOpacity={0.06} stroke="none" /> : null;
  const quarterAxis = { dataKey: "quarter", ...categoryAxis, tick: axisTick, interval: "preserveStartEnd" as const, minTickGap: 24, tickMargin: 6 };
  return <div className="chart-stack">
    <div className="mini-chart-label">Pipeline created</div>
    <ChartShell minHeight={170}>{(motion) =>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={pipelineRows} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid {...gridProps} />
          <XAxis {...quarterAxis} />
          <YAxis {...valueAxis} domain={[0, pipelineTicks[pipelineTicks.length - 1]]} ticks={pipelineTicks} tickFormatter={money} width={56} />
          <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => ({
            title: `${row.quarter} cohort`,
            rows: [
              { label: "Pipeline created", value: formatDollars(Number(row.Pipeline)), color: ACCENT, strong: true },
              ...(Number.isFinite(Number(row.deals)) ? [{ label: "Deals", value: count(Number(row.deals)) }] : []),
              { label: "Resolved share", value: pct(Number(row.resolvedShare), 0) },
            ],
            flag: row.is_mature ? undefined : "Provisional cohort: too few deals resolved to judge quality",
          }))} />
          <Bar dataKey="Pipeline" radius={[3, 3, 0, 0]} maxBarSize={28} {...motion}>
            {pipelineRows.map((row) => <Cell key={row.quarter} fill={ACCENT} fillOpacity={row.is_mature ? 1 : 0.45} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>}
    </ChartShell>
    <div className="mini-chart-label">Closed-deal quality and cohort maturity</div>
    <ChartShell minHeight={190} part={1}>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={lineRows} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid {...gridProps} />
          {provisionalBand}
          <XAxis {...quarterAxis} />
          <YAxis {...valueAxis} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={56} />
          {Number.isFinite(matureAvg) && <ReferenceLine y={matureAvg} stroke={COLORS.pale} strokeDasharray="4 4" strokeOpacity={0.7} />}
          <Tooltip {...tooltipBase} cursor={lineCursor} content={tooltipContent((row) => ({
            title: `${row.quarter} cohort`,
            rows: [
              { label: "Closed-deal win rate", value: `${Number(row["Closed-deal win rate"]).toFixed(1)}%`, color: ACCENT, strong: true },
              { label: "95% interval", value: `${Number(row.low).toFixed(0)}–${Number(row.high).toFixed(0)}%` },
              { label: "Resolved share", value: `${Number(row["Resolved share"]).toFixed(0)}%`, color: CONTEXT_LIGHT },
              ...(Number.isFinite(Number(row.resolved)) ? [{ label: "Won / resolved", value: `${count(Number(row.won))} / ${count(Number(row.resolved))}` }] : []),
            ],
            note: Number.isFinite(matureAvg) ? `Mature-cohort average ${matureAvg.toFixed(1)}%` : undefined,
            flag: row.is_mature ? limitedFlag(Number(row.resolved), "resolved deals") : "Provisional cohort: win rate may still move",
          }))} />
          <Line type="monotone" dataKey="Resolved share" stroke={CONTEXT_LIGHT} strokeWidth={2} dot={{ r: 2.5, fill: CONTEXT_LIGHT, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Closed-deal win rate" stroke={ACCENT} strokeWidth={2.5} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { is_mature?: boolean } }) => <circle key={`cohort-dot-${props.index}`} cx={props.cx} cy={props.cy} r={props.payload?.is_mature ? 3 : 4.5} fill={props.payload?.is_mature ? ACCENT : "#111113"} stroke={ACCENT} strokeWidth={props.payload?.is_mature ? 1 : 2} />} activeDot={{ r: 5, fill: ACCENT, stroke: "#111113", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false}><ErrorBar dataKey="winError" direction="y" width={4} stroke={ACCENT} strokeOpacity={0.55} /></Line>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label="Cohort quality legend"><span>{swatch(ACCENT)}Closed-deal win rate · 95% interval</span><span>{swatch(CONTEXT_LIGHT)}Resolved share</span><span><i style={{ border: `2px solid ${ACCENT}`, borderRadius: 999, background: "#111113" }} />Provisional cohort · hollow marker, faded bar, shaded band</span>{Number.isFinite(matureAvg) && <span><i style={{ height: 0, borderTop: `2px dashed ${COLORS.pale}`, borderRadius: 0 }} />Mature-cohort average {matureAvg.toFixed(0)}%</span>}</div>
  </div>;
}

export function ContributionChart({ data, totalPipeline }: { data: DataRow[]; totalPipeline: number }) {
  const sourced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Sourced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const influenced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Influenced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const rows = [
    { metric: "Marketing sourced", amount: sourced, share: totalPipeline ? sourced / totalPipeline : 0, fill: ACCENT },
    { metric: "Marketing influenced", amount: influenced, share: totalPipeline ? influenced / totalPipeline : 0, fill: COLORS.pale },
  ];
  const ticks = bestTicks(Math.max(totalPipeline, ...rows.map((row) => row.amount)));
  // Category names sit above each bar (not in a fixed-width axis) so the
  // bars keep the full plot width in the narrow essential card.
  const BarText = (props: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; index?: number }) => {
    const row = rows[props.index ?? 0];
    if (!row) return null;
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const end = x + Math.max(0, Number(props.width ?? 0));
    return <g>
      <text x={x} y={y - 7} fill={COLORS.pale} fontSize={TICK_SIZE} fontWeight={600}>{row.metric}</text>
      <text x={end + 8} y={y + Number(props.height ?? 0) / 2} dominantBaseline="middle" fill={COLORS.ink} fontSize={TICK_SIZE}><tspan fontWeight={700}>{money(row.amount)}</tspan><tspan fill={COLORS.muted}>{` · ${(row.share * 100).toFixed(0)}% of total`}</tspan></text>
    </g>;
  };
  return <ChartShell minHeight={200}>{(motion) => <ResponsiveContainer width="100%" height={200}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 30, bottom: 8 }} barCategoryGap="38%">
    <CartesianGrid {...gridProps} horizontal={false} vertical />
    <XAxis type="number" {...valueAxis} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={money} />
    <YAxis type="category" dataKey="metric" hide />
    <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => ({
      title: String(row.metric),
      rows: [
        { label: "Pipeline", value: formatDollars(Number(row.amount)), color: String(row.fill), strong: true },
        { label: "Share of total pipeline", value: pct(Number(row.share)) },
        { label: "Total pipeline", value: formatDollars(totalPipeline) },
      ],
      note: "Descriptive contribution, not causal lift.",
    }))} />
    <ReferenceLine x={totalPipeline} stroke={COLORS.pale} strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: `Total pipeline ${money(totalPipeline)}`, fill: COLORS.pale, fontSize: TICK_SIZE, position: "insideTopRight", offset: 6 }} />
    <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={24} {...motion}>
      {rows.map((row) => <Cell key={row.metric} fill={row.fill} />)}
      <LabelList dataKey="amount" content={BarText} />
    </Bar>
  </ComposedChart></ResponsiveContainer>}</ChartShell>;
}

const coverageTick = stackedTick((value) => wrapText(value, 9, 2), { anchor: "middle", vertical: false });
const UNREACHED = "Not Reached";

export function CoverageChart({ data }: { data: DataRow[] }) {
  const order = ["Not Reached", "6sense Only", "Email Only", "Both Channels"];
  const rows = [...data].sort((a, b) => order.indexOf(textValue(a, "coverage_tier")) - order.indexOf(textValue(b, "coverage_tier"))).map((row) => ({
    tier: textValue(row, "coverage_tier"), accounts: numberValue(row, "accounts"), rate: numberValue(row, "opp_rate") * 100,
    withOpp: numberValue(row, "with_opp", Number.NaN), shareOfAccounts: numberValue(row, "pct_of_total", Number.NaN),
    low: numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100,
    high: numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100,
    error: [Math.max(0, numberValue(row, "opp_rate") * 100 - numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100), Math.max(0, numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100 - numberValue(row, "opp_rate") * 100)],
  }));
  if (!rows.length) return <EmptyChart />;
  const xAxisProps = { dataKey: "tier", tick: coverageTick, interval: 0 as const, height: 40, ...categoryAxis };
  const accountTicks = niceTicks(Math.max(...rows.map((row) => row.accounts)));
  const tierColor = (tier: string) => tier === UNREACHED ? ACCENT : CONTEXT_LIGHT;
  const tip = tooltipContent((row) => ({
    title: String(row.tier),
    rows: [
      { label: "CRM account domains", value: count(Number(row.accounts)), color: tierColor(String(row.tier)) },
      ...(Number.isFinite(Number(row.shareOfAccounts)) ? [{ label: "Share of accounts", value: pct(Number(row.shareOfAccounts)) }] : []),
      { label: "Opportunity prevalence", value: `${Number(row.rate).toFixed(1)}%`, strong: true },
      { label: "95% Wilson interval", value: `${Number(row.low).toFixed(1)}–${Number(row.high).toFixed(1)}%` },
      ...(Number.isFinite(Number(row.withOpp)) ? [{ label: "Accounts with an opportunity", value: count(Number(row.withOpp)) }] : []),
    ],
    note: "Historical prevalence; many opportunities predate reach.",
    flag: limitedFlag(Number(row.accounts), "accounts"),
  }));
  return <div className="chart-stack coverage-chart">
    <div className="mini-chart-label">CRM account domains by coverage tier</div>
    <ChartShell minHeight={200}>{(motion) => <ResponsiveContainer width="100%" height={200}><ComposedChart data={rows} margin={{ left: 0, right: 12, top: 20, bottom: 4 }}>
      <CartesianGrid {...gridProps} /><XAxis {...xAxisProps} /><YAxis {...valueAxis} width={52} domain={[0, accountTicks[accountTicks.length - 1]]} ticks={accountTicks} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip {...tooltipBase} cursor={bandCursor} content={tip} />
      <Bar dataKey="accounts" radius={[5, 5, 0, 0]} maxBarSize={44} {...motion}>{rows.map((row) => <Cell key={row.tier} fill={tierColor(row.tier)} />)}<LabelList dataKey="accounts" position="top" formatter={(value: number) => value.toLocaleString()} fill={COLORS.ink} fontSize={TICK_SIZE} /></Bar>
    </ComposedChart></ResponsiveContainer>}</ChartShell>
    <div className="mini-chart-label">Historical opportunity prevalence · 95% Wilson interval</div>
    <ChartShell minHeight={200} part={1}><ResponsiveContainer width="100%" height={200}><ComposedChart data={rows} margin={{ left: 0, right: 12, top: 12, bottom: 4 }}>
      <CartesianGrid {...gridProps} /><XAxis {...xAxisProps} padding={{ left: 36, right: 36 }} /><YAxis {...valueAxis} domain={[0, 60]} ticks={[0, 15, 30, 45, 60]} tickFormatter={(value) => `${value}%`} width={52} /><Tooltip {...tooltipBase} cursor={lineCursor} content={tip} />
      <Line dataKey="rate" name="Historical opportunity prevalence" stroke="transparent" strokeWidth={0} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { tier?: string } }) => <circle key={`coverage-dot-${props.index}`} cx={props.cx} cy={props.cy} r={5.5} fill={props.payload?.tier === UNREACHED ? ACCENT : COLORS.pale} stroke="#111113" strokeWidth={1.5} />} activeDot={{ r: 7, fill: COLORS.ink }} isAnimationActive={false}><ErrorBar dataKey="error" direction="y" width={5} stroke={COLORS.slate} /><LabelList dataKey="rate" position="right" offset={12} formatter={(value: number) => `${value.toFixed(1)}%`} fill={COLORS.ink} fontSize={TICK_SIZE} /></Line>
    </ComposedChart></ResponsiveContainer></ChartShell>
  </div>;
}

export function CoverageMixChart({ data }: { data: DataRow[] }) {
  const rows = data.map((row) => ({ name: textValue(row, "name"), value: numberValue(row, "value") }));
  if (!rows.length) return <EmptyChart />;
  const colors = [CONTEXT_LIGHT, ACCENT];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <><ChartShell minHeight={220}><ResponsiveContainer width="100%" height={220}><PieChart>
    <Tooltip {...tooltipBase} content={tooltipContent((row) => ({ title: String(row.name), rows: [{ label: "Accounts", value: count(Number(row.value)), strong: true }, { label: "Share", value: total ? pct(Number(row.value) / total) : "—" }] }))} />
    <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" stroke="#080809" isAnimationActive={false}>{rows.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie>
  </PieChart></ResponsiveContainer></ChartShell><div className="chart-legend" style={legendStyle} aria-label="Coverage mix legend">{rows.map((row, index) => <span key={row.name}>{swatch(colors[index % colors.length])}{row.name} · {row.value.toLocaleString()}</span>)}</div></>;
}

const ATTRIBUTION_MODELS = ["First-Touch", "Last-Touch", "Linear", "Time-Decay"];
const MODEL_SWATCH = [COLORS.blue, COLORS.teal, COLORS.amber, COLORS.violet];

function attributionByChannel(data: DataRow[], models: string[]) {
  const channels = Array.from(new Set(data.map((row) => textValue(row, "channel"))));
  const all = channels.map((channel) => {
    const values = Object.fromEntries(models.map((model) => [model, data.filter((item) => textValue(item, "channel") === channel && textValue(item, "attribution_model") === model).reduce((sum, item) => sum + numberValue(item, "attributed_pipeline"), 0)]));
    return { channel, label: displayName(channel), values };
  });
  const linked = all.filter((row) => models.some((model) => row.values[model] !== 0));
  const unlinked = all.filter((row) => !models.some((model) => row.values[model] !== 0));
  return { linked, unlinked };
}

function UnlinkedNote({ channels }: { channels: { label: string }[] }) {
  if (!channels.length) return null;
  return <ChartNote>{channels.length} {channels.length === 1 ? "channel has" : "channels have"} no linked touches under these models and {channels.length === 1 ? "is" : "are"} omitted: {channels.map((row) => row.label).join(", ")}.</ChartNote>;
}

export function AttributionComparison({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const models = ATTRIBUTION_MODELS;
  const { linked, unlinked } = attributionByChannel(data, models);
  const rows = linked.map((row) => ({ channel: row.label, ...row.values }))
    .sort((a, b) => models.reduce((sum, model) => sum + Number((b as Record<string, unknown>)[model]), 0) - models.reduce((sum, model) => sum + Number((a as Record<string, unknown>)[model]), 0));
  if (!rows.length) return <><EmptyChart message="No channel has linked touches under the four attribution models." /><UnlinkedNote channels={unlinked} /></>;
  const height = Math.max(180, rows.length * 72 + 40);
  const ticks = bestTicks(Math.max(...rows.flatMap((row) => models.map((model) => Number((row as Record<string, unknown>)[model])))));
  return <><ChartShell minHeight={height}>{(motion) => <ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 60, top: 10, bottom: 12 }} barCategoryGap="18%">
    <defs>
      <pattern id="attr-stripe-teal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill={COLORS.teal} /><rect width="2" height="6" fill="#ffffff" fillOpacity=".42" /></pattern>
      <pattern id="attr-stripe-amber" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.amber} /><rect width="6" height="2" fill="#ffffff" fillOpacity=".42" /></pattern>
      <pattern id="attr-dot-violet" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.violet} /><circle cx="2" cy="2" r="1.1" fill="#ffffff" fillOpacity=".58" /></pattern>
    </defs>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} domain={[0, ticks[ticks.length - 1]]} ticks={narrow ? ticks.filter((_, index) => index % 2 === 0) : ticks} tickFormatter={money} /><YAxis type="category" dataKey="channel" width={narrow ? 92 : 130} tick={narrow ? stackedTick((value) => wrapText(value, 11, 2)) : lineTick} interval={0} {...categoryAxis} />
    <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => ({
      title: String(row.channel),
      rows: models.map((model, index) => ({ label: model, value: formatDollars(Number(row[model] ?? 0)), color: MODEL_SWATCH[index] })),
      note: "Same journeys credited four ways; do not sum across models.",
    }))} />
    {models.map((model, index) => <Bar key={model} dataKey={model} name={model} fill={[COLORS.blue, "url(#attr-stripe-teal)", "url(#attr-stripe-amber)", "url(#attr-dot-violet)"][index]} barSize={11} radius={[0, 3, 3, 0]} {...motion}><LabelList dataKey={model} position="right" {...valueLabel(money)} /></Bar>)}
  </ComposedChart></ResponsiveContainer>}</ChartShell><div className="chart-legend" style={legendStyle} aria-label="Attribution model legend"><span><i className="attr-swatch attr-ft" />FT · First-Touch</span><span><i className="attr-swatch attr-lt" />LT · Last-Touch</span><span><i className="attr-swatch attr-lin" />LIN · Linear</span><span><i className="attr-swatch attr-td" />TD · Time-Decay</span></div><UnlinkedNote channels={unlinked} /></>;
}

const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

export function CreditShiftChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const { linked, unlinked } = attributionByChannel(data, ["First-Touch", "Last-Touch"]);
  const rows = linked.map((row) => ({ channel: row.label, first: row.values["First-Touch"], last: row.values["Last-Touch"], delta: row.values["Last-Touch"] - row.values["First-Touch"] })).sort((a, b) => b.delta - a.delta);
  if (!rows.length) return <><EmptyChart message="No channel has First-Touch or Last-Touch credit." /><UnlinkedNote channels={unlinked} /></>;
  const height = Math.max(160, rows.length * 56 + 40);
  const half = niceTicks(Math.max(...rows.map((row) => Math.abs(row.delta)), 1), 2);
  const extent = half[half.length - 1];
  const shiftTicks = [...half.slice(1).reverse().map((value) => -value), ...half];
  return <><ChartShell minHeight={height}>{(motion) => <ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 68, top: 10, bottom: 12 }}>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} domain={[-extent, extent]} ticks={narrow ? shiftTicks.filter((_, index) => index % 2 === 0) : shiftTicks} tickFormatter={(value: number) => value === 0 ? "$0" : signedMoney(value)} /><YAxis type="category" dataKey="channel" width={narrow ? 92 : 130} tick={narrow ? stackedTick((value) => wrapText(value, 11, 2)) : lineTick} interval={0} axisLine={false} tickLine={false} /><ReferenceLine x={0} stroke={COLORS.ink} strokeOpacity={0.8} />
    <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => ({
      title: String(row.channel),
      rows: [
        { label: "First-Touch credit", value: formatDollars(Number(row.first)) },
        { label: "Last-Touch credit", value: formatDollars(Number(row.last)) },
        { label: "Shift (LT − FT)", value: `${Number(row.delta) >= 0 ? "+" : "−"}${formatDollars(Math.abs(Number(row.delta)))}`, color: Number(row.delta) >= 0 ? GAIN : LOSS, strong: true },
      ],
      note: "A planning signal about journey role, not incrementality.",
    }))} />
    <Bar dataKey="delta" barSize={20} {...motion}>
      {rows.map((row) => <Cell key={row.channel} fill={row.delta >= 0 ? GAIN : LOSS} />)}
      <LabelList dataKey="delta" content={(props: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; value?: unknown }) => {
        // Negative bars grow leftwards toward the category axis, so their
        // label sits just right of the zero line instead of at the bar end.
        const x = Number(props.x ?? 0);
        const width = Number(props.width ?? 0);
        const right = Math.max(x, x + width);
        const value = Number(props.value ?? 0);
        return <text x={right + 6} y={Number(props.y ?? 0) + Number(props.height ?? 0) / 2} dominantBaseline="middle" textAnchor="start" fill={COLORS.ink} fontSize={TICK_SIZE}>{signedMoney(value)}</text>;
      }} />
    </Bar>
  </ComposedChart></ResponsiveContainer>}</ChartShell><div className="chart-legend" style={legendStyle} aria-label="Credit shift legend"><span>{swatch(GAIN)}Gains credit under Last-Touch</span><span>{swatch(LOSS)}Loses credit under Last-Touch</span></div><UnlinkedNote channels={unlinked} /></>;
}

export function RoiChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => numberValue(row, "channel_spend") > 0).map((row) => {
    const spend = numberValue(row, "channel_spend");
    const multiple = numberValue(row, "pipeline_roi", 0);
    const revenueMultiple = numberValue(row, "revenue_roi", 0);
    const pipeline = numberValue(row, "period_matched_pipeline", multiple * spend);
    const won = numberValue(row, "period_matched_won_amount", revenueMultiple * spend);
    return { channel: displayName(textValue(row, "channel_category")), spend, multiple, revenueMultiple, pipeline, won };
  }).sort((a, b) => b.multiple - a.multiple);
  if (!rows.length) return <EmptyChart message="No tracked-spend channels are available." />;
  const scaleMax = Math.max(1.25, ...rows.map((row) => Math.max(row.multiple, row.revenueMultiple) * 1.1));
  const at = (value: number) => `${Math.min(100, Math.max(0, (value / scaleMax) * 100))}%`;
  const muted: CSSProperties = { color: COLORS.muted, fontSize: 12 };
  return <div className="roi-compare" style={{ display: "grid", gap: 14, padding: "6px 0 2px" }}>
    {rows.map((row) => <div key={row.channel} style={{ display: "grid", gap: 6, paddingBottom: 12, borderBottom: `1px solid ${COLORS.grid}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 12px", alignItems: "baseline" }}>
        <strong style={{ color: COLORS.ink, fontSize: 14 }}>{row.channel}</strong>
        <span style={{ color: COLORS.ink, fontSize: 13, fontVariantNumeric: "tabular-nums" }}><b>{row.multiple.toFixed(2)}×</b> pipeline · <b>{row.revenueMultiple.toFixed(2)}×</b> won</span>
      </div>
      <div style={{ ...muted, fontVariantNumeric: "tabular-nums" }}>{money(row.spend)} tracked spend → {money(row.pipeline)} recorded pipeline · {money(row.won)} won</div>
      <div aria-hidden="true" style={{ position: "relative", height: 10, marginTop: 2, borderRadius: 5, background: "rgba(255,255,255,.06)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: at(row.multiple), minWidth: row.multiple > 0 ? 3 : 0, borderRadius: 5, background: row.multiple >= 1 ? ACCENT : CONTEXT_LIGHT }} />
        <div style={{ position: "absolute", left: at(1), top: -4, bottom: -4, borderLeft: `2px dashed ${COLORS.pale}` }} />
      </div>
    </div>)}
    <div aria-hidden="true" style={{ position: "relative", height: 16, marginTop: -6, ...muted }}><span style={{ position: "absolute", left: 0 }}>0×</span><span style={{ position: "absolute", left: at(1), transform: "translateX(-50%)", whiteSpace: "nowrap", color: COLORS.pale }}>1× break-even</span></div>
    <div style={{ ...muted }}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ACCENT, marginRight: 6, verticalAlign: "-1px" }} />At or above break-even · <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: CONTEXT_LIGHT, marginRight: 6, verticalAlign: "-1px" }} />Below break-even. Bar = same-period recorded pipeline ÷ tracked spend; dashed line = 1×.</div>
  </div>;
}

const FUNNEL_GROUPS: { group: string; color: string; channels: Record<string, string> }[] = [
  { group: "Ads", color: COLORS.blue, channels: { "6sense Display": "6sense", "Paid Ads": "Paid ads" } },
  { group: "Email", color: COLORS.teal, channels: { "Email Event Mix": "Email" } },
  { group: "Web", color: COLORS.slate, channels: { Web: "Web" } },
  { group: "CRM", color: COLORS.azure, channels: { "All Opportunity Outcomes": "CRM", "Marketing-Sourced Outcomes": "Sourced" } },
];
const FUNNEL_STAGES: Record<string, string> = {
  "Influenced Form Fills": "Form fills",
  "Recorded web events": "Recorded events",
  "Unique recordings (session definition unverified)": "Unique recordings*",
  "Unique visitors": "Unique visitors",
  "Observed contact-activity rows": "Contact-activity rows",
  "Recordings with observed contact activity": "Recordings w/ contact",
  "Unknown contact-flag rows": "Unknown-flag rows",
  "All Opportunities": "All opps",
  "Closed Won (All)": "Closed won",
  "Marketing-Sourced Opps": "Opps",
  "Marketing-Sourced Won": "Won",
};

export function ActivityVolumesChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const { handlers, opacity } = useActiveIndex();
  const groupOf = (channel: string) => FUNNEL_GROUPS.findIndex((group) => channel in group.channels);
  const rows = data.map((row) => {
    const channel = textValue(row, "channel");
    const stage = textValue(row, "stage");
    const groupIndex = groupOf(channel);
    const group = FUNNEL_GROUPS[groupIndex];
    const source = group?.channels[channel] ?? channel;
    return { label: `${source} · ${FUNNEL_STAGES[stage] ?? stage}`, fullLabel: `${channel} · ${stage}`, group: group?.group ?? "Other", count: numberValue(row, "count"), groupIndex: groupIndex < 0 ? FUNNEL_GROUPS.length : groupIndex, color: group?.color ?? COLORS.pale };
  }).filter((row) => Number.isFinite(row.count) && row.count > 0)
    .sort((a, b) => a.groupIndex - b.groupIndex || b.count - a.count);
  if (!rows.length) return <EmptyChart />;
  const height = Math.max(300, rows.length * (narrow ? 34 : 26) + 40);
  const funnelTick = narrow ? stackedTick((value) => wrapText(value, 19, 2)) : lineTick;
  const maxCount = Math.max(...rows.map((row) => row.count));
  const topTick = 10 ** Math.max(2, Math.ceil(Math.log10(maxCount)));
  const ticks: number[] = [];
  for (let tick = 10; tick <= topTick; tick *= 100) ticks.push(tick);
  if (ticks[ticks.length - 1] < topTick) ticks.push(topTick);
  const groupsShown = FUNNEL_GROUPS.filter((_, index) => rows.some((row) => row.groupIndex === index));
  return <>
    <div className="mini-chart-label">Positive measured counts · logarithmic scale · separate populations; zero/unavailable rows remain in Show data</div>
    <ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 52, top: narrow ? 18 : 8, bottom: 16 }} {...handlers}>
      <CartesianGrid stroke={COLORS.grid} strokeOpacity={0.7} horizontal={false} vertical />
      <XAxis type="number" scale="log" domain={[10, topTick]} ticks={ticks} allowDataOverflow tickFormatter={(value: number) => compact.format(value)} {...valueAxis} />
      <YAxis type="category" dataKey="label" width={narrow ? 134 : 190} tick={funnelTick} interval={0} {...categoryAxis} />
      <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
        title: String(row.fullLabel),
        rows: [{ label: "Count", value: count(Number(row.count)), color: String(row.color), strong: true }, { label: "Population", value: String(row.group) }],
        note: "Separate population; not a sequential funnel step.",
      }))} />
      <Line dataKey="count" name="Count" stroke="transparent" strokeWidth={0} isAnimationActive={false} activeDot={{ r: 6 }} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { color?: string } }) => <circle key={`funnel-dot-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill={props.payload?.color ?? COLORS.pale} fillOpacity={opacity(props.index ?? -1)} stroke="#080809" strokeWidth={1} />}>
        <LabelList dataKey="count" position="right" offset={10} formatter={(value: number) => compact.format(value)} fill={COLORS.ink} fontSize={TICK_SIZE} />
      </Line>
    </ComposedChart></ResponsiveContainer></ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label="Population legend">{groupsShown.map((group) => <span key={group.group}><i className="dot" style={{ background: group.color }} />{group.group}</span>)}<span>* session definition unverified</span></div>
  </>;
}

export function Heatmap({ data, xKey, yKey, valueKey, valueFormatter = (value: number) => money(value), domain = [0, 1], lowSampleKey, xOrder, anchor, countKey }: { data: DataRow[]; xKey: string; yKey: string; valueKey: string; valueFormatter?: (value: number) => string; domain?: [number, number]; lowSampleKey?: string; xOrder?: string[]; anchor?: number; countKey?: string }) {
  const rawXs = Array.from(new Set(data.map((row) => textValue(row, xKey))));
  const xs = xOrder ? [...xOrder.filter((x) => rawXs.includes(x)), ...rawXs.filter((x) => !xOrder.includes(x))] : rawXs;
  const ys = Array.from(new Set(data.map((row) => textValue(row, yKey))));
  if (!xs.length || !ys.length) return <EmptyChart />;
  const [min, max] = domain;
  const diverging = anchor !== undefined && Number.isFinite(anchor);
  const values = data.map((row) => numberValue(row, valueKey)).filter(Number.isFinite);
  const spread = diverging ? Math.max(0.02, ...values.map((value) => Math.abs(value - (anchor as number)))) : 0;
  const fill = (value: number) => {
    if (!Number.isFinite(value)) return "transparent";
    if (diverging) {
      const delta = value - (anchor as number);
      const t = Math.min(1, Math.abs(delta) / spread);
      return delta >= 0 ? `rgba(225,38,54,${0.16 + t * 0.74})` : `rgba(191,183,184,${0.06 + t * 0.36})`;
    }
    const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
    return `rgba(225,38,54,${0.10 + ratio * 0.78})`;
  };
  const describe = (value: number) => diverging ? `${formatField(valueKey, value)} (${value >= (anchor as number) ? "+" : "−"}${Math.abs((value - (anchor as number)) * 100).toFixed(1)} pts vs overall)` : formatField(valueKey, value);
  const scaleText = diverging ? `diverging around the overall rate ${valueFormatter(anchor as number)}; red is above, grey is below; deeper means further away` : `scale ${valueFormatter(min)} to ${valueFormatter(max)}; values beyond endpoints saturate`;
  const headerStyle: CSSProperties = { fontSize: 12 };
  // Wide enough for the longest column header on one line at 12px.
  const columnMin = Math.max(64, Math.ceil(Math.max(...xs.map((x) => x.length)) * 7.4) + 10);
  return <div className="heatmap-wrap">
    <div className="heatmap" role="table" aria-label={`${valueKey}; ${scaleText}; dash means unavailable; Low n means below 30`} style={{ gridTemplateColumns: `minmax(84px, 1.1fr) repeat(${xs.length}, minmax(${columnMin}px, 1fr))` }}>
      <div className="heatmap-corner" style={headerStyle}>{diverging ? <>vs overall {valueFormatter(anchor as number)}</> : <>{valueFormatter(min)} → {valueFormatter(max)}<small> · saturated endpoints</small></>}</div>{xs.map((x) => <div className="heatmap-x" role="columnheader" key={x} title={x} style={{ ...headerStyle, overflowWrap: "normal", wordBreak: "normal" }}>{x}</div>)}
      {ys.map((y) => <div className="heatmap-row" role="row" key={y}><div className="heatmap-y" role="rowheader" title={y} style={headerStyle}>{y}</div>{xs.map((x) => {
        const row = data.find((item) => textValue(item, yKey) === y && textValue(item, xKey) === x);
        const value = row ? numberValue(row, valueKey) : Number.NaN;
        const low = lowSampleKey && row ? numberValue(row, lowSampleKey) < 30 : false;
        const count = countKey && row ? numberValue(row, countKey) : Number.NaN;
        const text = `${y} · ${x}: ${Number.isFinite(value) ? describe(value) : "Unavailable"}${Number.isFinite(count) ? ` · n=${count.toLocaleString()}` : ""}${low ? " · Low n" : ""}`;
        return <div className={`heatmap-cell${low ? " is-low" : ""}`} key={`${y}-${x}`} style={{ backgroundColor: fill(value), color: COLORS.ink, fontSize: 12 }} role="cell" aria-label={text} title={text}>{row && Number.isFinite(value) ? <><strong style={{ fontSize: 13 }}>{valueFormatter(value)}</strong>{Number.isFinite(count) && <small style={{ fontSize: 12, opacity: 0.85 }}>n={count.toLocaleString()}</small>}{low && <small style={{ fontSize: 12 }}>Low n</small>}</> : <span>—</span>}</div>;
      })}</div>)}
    </div>
    {diverging && <div className="chart-legend" style={{ ...legendStyle, marginTop: 8 }} aria-label="Heatmap colour legend"><span><i style={{ background: "rgba(191,183,184,.42)" }} />Below overall {valueFormatter(anchor as number)}</span><span><i style={{ background: "rgba(225,38,54,.22)" }} /><i style={{ background: "rgba(225,38,54,.9)" }} />Above overall · stronger = larger gap</span></div>}
  </div>;
}

export function SegmentWinRateChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const { handlers, opacity } = useActiveIndex();
  const rows = data.map((row) => {
    const rate = numberValue(row, "win_rate");
    const deals = numberValue(row, "deals");
    const avg = numberValue(row, "avg_deal");
    const low = numberValue(row, "ci_low", rate);
    const high = numberValue(row, "ci_high", rate);
    return { segment: textValue(row, "segment__c"), rate: rate * 100, low: low * 100, high: high * 100, error: [Math.max(0, (rate - low) * 100), Math.max(0, (high - rate) * 100)], deals, won: numberValue(row, "won", Number.NaN), avg, pipeline: numberValue(row, "pipeline", Number.NaN) };
  }).sort((a, b) => b.rate - a.rate);
  if (!rows.length) return <EmptyChart />;
  // Overall (pooled) closed-deal win rate across segments, as the reference.
  const pooledDeals = rows.reduce((sum, row) => sum + row.deals, 0);
  const pooledWon = rows.reduce((sum, row) => sum + (Number.isFinite(row.won) ? row.won : 0), 0);
  const overall = pooledDeals > 0 && rows.every((row) => Number.isFinite(row.won)) ? (pooledWon / pooledDeals) * 100 : Number.NaN;
  const below = (rate: number) => Number.isFinite(overall) && rate < overall;
  const tickLines = new Map(rows.map((row) => [row.segment, narrow ? [row.segment, `n=${row.deals.toLocaleString()}`] : [row.segment, `n=${row.deals.toLocaleString()} · avg ${money(row.avg)}`]]));
  const tick = stackedTick((value) => tickLines.get(value) ?? [value]);
  const height = Math.max(240, rows.length * 62 + 60);
  return <><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 24, bottom: 12 }} {...handlers}>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} domain={[0, 100]} ticks={narrow ? [0, 50, 100] : [0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="segment" width={narrow ? 96 : 150} tick={tick} interval={0} padding={{ top: 26, bottom: 26 }} {...categoryAxis} />
    {Number.isFinite(overall) && <ReferenceLine x={overall} stroke={COLORS.pale} strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: `All segments ${overall.toFixed(1)}%`, position: "top", fill: COLORS.pale, fontSize: TICK_SIZE }} />}
    <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
      title: String(row.segment),
      rows: [
        { label: "Closed-deal win rate", value: `${Number(row.rate).toFixed(1)}%`, color: below(Number(row.rate)) ? ACCENT : COLORS.pale, strong: true },
        { label: "95% Wilson interval", value: `${Number(row.low).toFixed(1)}–${Number(row.high).toFixed(1)}%` },
        ...(Number.isFinite(Number(row.won)) ? [{ label: "Won / resolved", value: `${count(Number(row.won))} / ${count(Number(row.deals))}` }] : [{ label: "Resolved deals", value: count(Number(row.deals)) }]),
        { label: "Average deal", value: formatDollars(Number(row.avg)) },
        ...(Number.isFinite(Number(row.pipeline)) ? [{ label: "Pipeline", value: formatDollars(Number(row.pipeline)) }] : []),
      ],
      note: Number.isFinite(overall) ? `${Number(row.rate) >= overall ? "+" : "−"}${Math.abs(Number(row.rate) - overall).toFixed(1)} pts vs all segments (${overall.toFixed(1)}%)` : undefined,
      flag: limitedFlag(Number(row.deals), "resolved deals"),
    }))} />
    <Line dataKey="rate" name="Win rate" stroke="transparent" strokeWidth={0} isAnimationActive={false} activeDot={false} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { rate?: number } }) => <circle key={`seg-dot-${props.index}`} cx={props.cx} cy={props.cy} r={6} fill={below(props.payload?.rate ?? 0) ? ACCENT : COLORS.pale} fillOpacity={opacity(props.index ?? -1)} stroke="#111113" strokeWidth={1.5} />}>
      <ErrorBar dataKey="error" direction="x" width={6} stroke={COLORS.slate} />
      <LabelList dataKey="rate" position="top" offset={10} formatter={(value: number) => `${value.toFixed(1)}%`} fill={COLORS.ink} fontSize={TICK_SIZE} />
    </Line>
  </ComposedChart></ResponsiveContainer></ChartShell>
  {Number.isFinite(overall) && <div className="chart-legend" style={legendStyle} aria-label="Segment win rate legend"><span><i className="dot" style={{ background: ACCENT }} />Below the all-segment rate</span><span><i className="dot" style={{ background: COLORS.pale }} />At or above</span><span>Whiskers · 95% interval</span></div>}</>;
}

export function CreativeCtrChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const platforms = Array.from(new Set(data.map((row) => textValue(row, "platform"))));
  if (!platforms.length) return <EmptyChart />;
  const axisWidth = narrow ? 150 : 200;
  const chars = narrow ? 21 : 27;
  const tick = stackedTick((value) => wrapText(value.replaceAll("_", " "), chars, 2));
  return <div className="facet-grid">{platforms.map((platform, platformIndex) => <CreativeFacet key={platform} platform={platform} part={platformIndex} rows={data.filter((row) => textValue(row, "platform") === platform)} axisWidth={axisWidth} tick={tick} />)}</div>;
}

function CreativeFacet({ platform, part, rows: source, axisWidth, tick }: { platform: string; part: number; rows: DataRow[]; axisWidth: number; tick: (props: TickProps) => ReactElement }) {
  const { handlers, opacity } = useActiveIndex();
  const rows = [...source].sort((a, b) => numberValue(b, "ctr") - numberValue(a, "ctr")).map((row) => ({ ad_name: textValue(row, "ad_name"), ctr: numberValue(row, "ctr"), impressions: numberValue(row, "impressions"), clicks: numberValue(row, "clicks", Number.NaN) }));
  const leader = clearLeader(rows.map((row) => row.ctr));
  const ctrTicks = niceTicks(Math.max(...rows.map((row) => row.ctr), 0.0001), 3);
  const ctrStep = ctrTicks[1] * 100;
  const ctrDigits = ctrStep >= 1 ? 0 : ctrStep >= 0.1 ? 1 : 2;
  const height = Math.max(200, rows.length * 44 + 30);
  return <div className="facet"><div className="mini-chart-label">{platform}: top high-volume ads</div><ChartShell minHeight={height} part={part}>{(motion) => <ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 0, right: 52, top: 14, bottom: 8 }} {...handlers}>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} domain={[0, ctrTicks[ctrTicks.length - 1]]} ticks={ctrTicks} tickFormatter={(value: number) => value === 0 ? "0%" : `${(value * 100).toFixed(ctrDigits)}%`} /><YAxis type="category" dataKey="ad_name" width={axisWidth} tick={tick} interval={0} {...categoryAxis} />
    <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
      title: String(row.ad_name).replaceAll("_", " "),
      rows: [
        { label: "CTR", value: `${(Number(row.ctr) * 100).toFixed(2)}%`, color: leader && row.ad_name === rows[0]?.ad_name ? ACCENT : CONTEXT_LIGHT, strong: true },
        { label: "Impressions", value: count(Number(row.impressions)) },
        ...(Number.isFinite(Number(row.clicks)) ? [{ label: "Clicks", value: count(Number(row.clicks)) }] : []),
      ],
      note: `${platform} · ads with at least 10,000 impressions`,
    }))} />
    <Bar dataKey="ctr" name="CTR" barSize={14} radius={[0, 4, 4, 0]} {...motion}>{rows.map((row, index) => <Cell key={`${row.ad_name}-${index}`} fill={leader && index === 0 ? ACCENT : CONTEXT_LIGHT} fillOpacity={opacity(index)} />)}<LabelList dataKey="ctr" position="right" {...valueLabel((value) => `${(value * 100).toFixed(2)}%`)} /></Bar>
  </ComposedChart></ResponsiveContainer>}</ChartShell></div>;
}

export function SimpleRankedChart({ data, labelKey, valueKey, color = COLORS.blue, formatter = (value: number) => value.toLocaleString(), suffixKey, metricLabel, sampleKey, sampleUnit = "observations" }: { data: DataRow[]; labelKey: string; valueKey: string; color?: string; formatter?: (value: number) => string; suffixKey?: string; metricLabel?: string; sampleKey?: string; sampleUnit?: string }) {
  const narrow = useNarrow();
  const { handlers, opacity } = useActiveIndex();
  const rows = data.map((row) => ({
    label: prettyLabel(textValue(row, labelKey)),
    value: numberValue(row, valueKey),
    suffix: suffixKey ? (suffixKey === "pipeline" ? money(numberValue(row, suffixKey)) : `${textValue(row, suffixKey)} ${suffixKey.replaceAll("_", " ")}`) : "",
    suffixValue: suffixKey ? numberValue(row, suffixKey) : Number.NaN,
    sample: sampleKey ? numberValue(row, sampleKey, Number.NaN) : Number.NaN,
  })).sort((a, b) => b.value - a.value);
  if (!rows.length) return <EmptyChart />;
  const longest = Math.max(...rows.map((row) => row.label.length));
  const twoLine = longest > 24;
  const tick = stackedTick((value) => wrapText(value, 24, 2));
  const height = Math.max(230, rows.length * (twoLine ? 40 : 32));
  const metric = metricLabel ?? columnLabel(valueKey);
  // Accent only a clear leader among known, adequately sampled categories;
  // an "Unknown" bucket or a tiny sample never carries the highlight.
  const eligible = rows.filter((row) => !UNLABELED.test(row.label) && !(Number.isFinite(row.sample) && row.sample < LIMITED_N));
  const leaderLabel = eligible.length && clearLeader(eligible.map((row) => row.value)) ? eligible[0].label : null;
  const limited = rows.filter((row) => Number.isFinite(row.sample) && row.sample < LIMITED_N).map((row) => row.label);
  return <><ChartShell minHeight={height}>{(motion) => <ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 64, top: 16, bottom: 12 }} {...handlers}>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} tickFormatter={formatter} tickCount={narrow ? 3 : 5} /><YAxis type="category" dataKey="label" width={170} tick={tick} interval={0} {...categoryAxis} />
    <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
      title: String(row.label),
      rows: [
        { label: metric, value: formatter(Number(row.value)), color: row.label === leaderLabel ? color : CONTEXT_LIGHT, strong: true },
        ...(suffixKey && Number.isFinite(Number(row.suffixValue)) ? [{ label: columnLabel(suffixKey).replace(/ \(\$\)$/, ""), value: suffixKey === "pipeline" ? formatDollars(Number(row.suffixValue)) : count(Number(row.suffixValue)) }] : []),
        ...(sampleKey && sampleKey !== suffixKey && Number.isFinite(Number(row.sample)) ? [{ label: columnLabel(sampleKey), value: count(Number(row.sample)) }] : []),
      ],
      flag: sampleKey && Number.isFinite(Number(row.sample)) ? limitedFlag(Number(row.sample), sampleUnit) : undefined,
    }))} />
    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={17} {...motion}>{rows.map((row, index) => <Cell key={row.label} fill={row.label === leaderLabel ? color : CONTEXT_LIGHT} fillOpacity={opacity(index)} />)}<LabelList dataKey="value" position="right" {...valueLabel(formatter)} /></Bar>
  </ComposedChart></ResponsiveContainer>}</ChartShell>{suffixKey && <div className="ranked-samples" aria-label="Supporting sample and amount labels">{rows.map(row => <span key={row.label}><b>{row.label}:</b> {row.suffix}</span>)}</div>}<LimitedNote labels={limited} unit={sampleUnit} /></>;
}

const budgetTick = stackedTick((value) => wrapText(value, 11, 2), { anchor: "middle", vertical: false });
const BUDGET_PARTS = [
  { key: "activated", label: "Activated media", color: CONTEXT },
  { key: "holdout", label: "Holdout reserve", color: ACCENT },
  { key: "experiment", label: "Experiment pool", color: COLORS.azure },
] as const;

export function BudgetChart({ data }: { data: DataRow[] }) {
  const order = ["Status Quo", "10% Holdout", "Measurement First"];
  const rows = order.map((scenario) => {
    const group = data.filter((row) => textValue(row, "Scenario") === scenario);
    const activated = group.reduce((sum, row) => sum + numberValue(row, "Active Spend ($)"), 0);
    const holdout = group.reduce((sum, row) => sum + numberValue(row, "Holdout Reserve ($)"), 0);
    const experiment = group.reduce((sum, row) => sum + numberValue(row, "Experiment Pool ($)"), 0);
    return { scenario, activated, holdout, experiment, total: activated + holdout + experiment };
  });
  if (!rows.some((row) => row.total > 0)) return <EmptyChart message="No budget scenarios are available." />;
  const ticks = bestTicks(Math.max(...rows.map((row) => row.total)) * 1.08);
  return <><ChartShell minHeight={300}>{(motion) => <ResponsiveContainer width="100%" height={300}><ComposedChart data={rows} margin={{ left: 0, right: 16, top: 22, bottom: 4 }}>
    <CartesianGrid {...gridProps} /><XAxis dataKey="scenario" tick={budgetTick} interval={0} height={40} {...categoryAxis} /><YAxis {...valueAxis} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={money} width={56} />
    <Tooltip {...tooltipBase} cursor={bandCursor} content={tooltipContent((row) => ({
      title: String(row.scenario),
      rows: [
        ...BUDGET_PARTS.map((part) => ({ label: part.label, value: `${formatDollars(Number(row[part.key]))} · ${Number(row.total) ? pct(Number(row[part.key]) / Number(row.total), 0) : "0%"}`, color: part.color })),
        { label: "Total budget", value: formatDollars(Number(row.total)), strong: true },
      ],
      note: "Every plan keeps the same total budget.",
    }))} />
    {BUDGET_PARTS.map((part, index) => <Bar key={part.key} dataKey={part.key} stackId="budget" fill={part.color} name={part.label} maxBarSize={180} {...motion}>{index === BUDGET_PARTS.length - 1 && <LabelList dataKey="total" position="top" offset={8} formatter={(value: number) => `${money(value)} total`} fill={COLORS.ink} fontSize={TICK_SIZE} />}</Bar>)}
  </ComposedChart></ResponsiveContainer>}</ChartShell><div className="chart-legend" style={legendStyle} aria-label="Budget allocation legend">{BUDGET_PARTS.map((part) => <span key={part.key}>{swatch(part.color)}{part.label}</span>)}</div></>;
}

export function VelocityChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const { handlers, opacity } = useActiveIndex();
  const rows = data.filter((row) => numberValue(row, "deal_count") >= 5).map((row) => {
    const median = numberValue(row, "median_days");
    const count = numberValue(row, "deal_count");
    const p25 = numberValue(row, "p25", median);
    const p75 = numberValue(row, "p75", median);
    return { channel: displayName(textValue(row, "channel_category")), median, p25, p75, error: [Math.max(0, median - p25), Math.max(0, p75 - median)], count, limited: count < LIMITED_N };
  }).sort((a, b) => b.median - a.median);
  if (!rows.length) return <EmptyChart message="No channel has at least five won deals." />;
  const tickLines = new Map(rows.map((row) => [row.channel, [row.channel, `n=${row.count.toLocaleString()} won${row.limited ? " · limited" : ""}`]]));
  const tick = stackedTick((value) => tickLines.get(value) ?? [value]);
  const height = Math.max(260, rows.length * 48 + 50);
  const ticks = bestTicks(Math.max(...rows.map((row) => row.p75)));
  const limited = rows.filter((row) => row.limited);
  return <><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 12, bottom: 12 }} {...handlers}>
    <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" {...valueAxis} domain={[0, ticks[ticks.length - 1]]} ticks={narrow ? ticks.filter((_, index) => index % 2 === 0) : ticks} tickFormatter={(value) => `${value}d`} /><YAxis type="category" dataKey="channel" width={narrow ? 128 : 160} tick={tick} interval={0} padding={{ top: 20, bottom: 20 }} {...categoryAxis} />
    <Tooltip {...tooltipBase} cursor={false} content={tooltipContent((row) => ({
      title: String(row.channel),
      rows: [
        { label: "Median days to close", value: `${Number(row.median).toFixed(0)} days`, color: row.limited ? CONTEXT_LIGHT : ACCENT, strong: true },
        { label: "Interquartile range", value: `${Number(row.p25).toFixed(0)}–${Number(row.p75).toFixed(0)} days` },
        { label: "Won deals", value: count(Number(row.count)) },
      ],
      flag: limitedFlag(Number(row.count), "won deals"),
    }))} />
    <Line dataKey="median" name="Median days" stroke="transparent" strokeWidth={0} isAnimationActive={false} activeDot={false} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { limited?: boolean } }) => <circle key={`velocity-dot-${props.index}`} cx={props.cx} cy={props.cy} r={6} fill={props.payload?.limited ? "#111113" : ACCENT} stroke={props.payload?.limited ? COLORS.pale : "#111113"} strokeWidth={props.payload?.limited ? 2 : 1.5} opacity={opacity(props.index ?? -1)} />}>
      <ErrorBar dataKey="error" direction="x" width={7} stroke={COLORS.slate} />
      <LabelList dataKey="median" position="top" offset={10} formatter={(value: number) => `${value.toFixed(0)}d`} fill={COLORS.ink} fontSize={TICK_SIZE} />
    </Line>
  </ComposedChart></ResponsiveContainer></ChartShell>
  <div className="chart-legend" style={legendStyle} aria-label="Deal velocity legend"><span><i className="dot" style={{ background: ACCENT }} />Median · {LIMITED_N}+ won deals</span>{limited.length > 0 && <span><i className="dot" style={{ border: `2px solid ${COLORS.pale}`, background: "#111113" }} />Median · fewer than {LIMITED_N} (directional)</span>}<span>Whiskers · 25th–75th percentile</span></div></>;
}

const FIT_ORDER = ["Strong", "Moderate", "Weak"];

export function TargetingHeatmap({ data }: { data: DataRow[] }) {
  const won = data.reduce((sum, row) => sum + numberValue(row, "won", 0), 0);
  const resolved = data.reduce((sum, row) => sum + numberValue(row, "resolved_deals", numberValue(row, "deals", 0)), 0);
  const overall = resolved > 0 ? won / resolved : 0.378;
  return <Heatmap data={data} xKey="accountprofilefit6sense__c" yKey="segment__c" valueKey="adjusted_win_rate" valueFormatter={(value) => pct(value)} domain={[0, 0.55]} lowSampleKey="deals" xOrder={FIT_ORDER} anchor={overall} countKey="deals" />;
}

export function ChartRenderer({ id, data, totalPipeline, coverageMix }: { id: string; data: DashboardDatasets; totalPipeline: number; coverageMix: DataRow[] }) {
  switch (id) {
    case "c-essential-contribution": case "c-sourced-influenced": return <ContributionChart data={data.attribution} totalPipeline={totalPipeline} />;
    case "c-essential-coverage": case "c-account-coverage": return <CoverageChart data={data.coverage} />;
    case "c-essential-cohort": case "c-cohort": return <CohortChart data={data.cohorts} />;
    case "c-bar-channel": return <PipelineChart data={data.channel_pipeline} />;
    case "c-donut-won": return <PipelineChart data={data.channel_pipeline} won />;
    case "c-monthly-trend": return <MonthlyPipelineChart data={data.monthly_pipeline} />;
    case "c-attrib-comparison": return <AttributionComparison data={data.attribution} />;
    case "c-attrib-waterfall": return <CreditShiftChart data={data.attribution} />;
    case "c-spend-pipeline": return <RoiChart data={data.channel_pipeline} />;
    case "c-funnel": return <ActivityVolumesChart data={data.funnel_metrics} />;
    case "c-seg-heatmap": return <Heatmap data={data.segment_industry} xKey="segment__c" yKey="industry" valueKey="total_pipeline" valueFormatter={formatDollarsCompact} domain={[0, Math.max(...data.segment_industry.map((row) => numberValue(row, "total_pipeline")), 1)]} />;
    case "c-seg-winrate": return <SegmentWinRateChart data={data.segment_win_rate} />;
    case "c-creative-ctr": return <CreativeCtrChart data={data.creative_ctr} />;
    case "c-creative-attr": return <SimpleRankedChart data={data.creative_tone} labelKey="_copytone" valueKey="ctr" color={COLORS.blue} formatter={(value) => `${(value * 100).toFixed(2)}%`} suffixKey="impressions" metricLabel="CTR" sampleKey="ads" sampleUnit="ads" />;
    case "c-email-seniority": return <SimpleRankedChart data={data.email_seniority} labelKey="_seniority" valueKey="click_event_share" color={COLORS.blue} formatter={(value) => `${(value * 100).toFixed(1)}%`} suffixKey="engaged_people" metricLabel="Click-event share" sampleKey="engaged_people" sampleUnit="engaged people" />;
    case "c-budget-scenario": return <BudgetChart data={data.budget_scenarios} />;
    case "c-deal-velocity": return <VelocityChart data={data.deal_velocity} />;
    case "c-journey": return <SimpleRankedChart data={data.journey_sequences} labelKey="sequence_2ch" valueKey="deals" formatter={(value) => value.toLocaleString()} suffixKey="pipeline" metricLabel="Won deals" sampleKey="deals" sampleUnit="won deals" />;
    case "c-targeting-matrix": return <TargetingHeatmap data={data.targeting} />;
    default: return id === "coverage-mix" ? <CoverageMixChart data={coverageMix} /> : <EmptyChart />;
  }
}
