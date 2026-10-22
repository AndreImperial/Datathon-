import { formatDollarsCompact, formatField } from "../evidence";
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { DashboardDatasets, DataRow } from "../types";
import { numberValue, textValue } from "../types";

export const COLORS = {
  ink: "#F7F4F4",
  blue: "#E12636",
  azure: "#FF7B84",
  teal: "#F2EEEE",
  amber: "#C4616A",
  red: "#FF4F5D",
  violet: "#9F5660",
  slate: "#91888A",
  pale: "#BFB7B8",
  grid: "#332F30",
  muted: "#AFA6A7",
};

// Distinct, ordered series colours for multi-series charts (largest series
// first).  The neutral tail colour is reserved for the long-tail bucket.
const SERIES = [COLORS.blue, COLORS.teal, COLORS.slate, COLORS.azure, COLORS.violet];
const TAIL_COLOR = "#5C5455";
const TAIL_BUCKET = "Other";
const TAIL_LABEL = "All other channels";

// Compact axis/label money: $1.2M, $350K, $940.
const money = formatDollarsCompact;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const tooltipStyle: CSSProperties = { background: "#080809", border: "1px solid #49383A", borderRadius: 8, color: "#FFFFFF", fontSize: 12, boxShadow: "0 14px 34px rgba(0, 0, 0, .42)", maxWidth: 340, whiteSpace: "normal" };
const tooltipLabelStyle: CSSProperties = { color: "#FFFFFF", fontWeight: 700, marginBottom: 4, overflowWrap: "anywhere" };
const TICK_SIZE = 12;
const axisTick = { fill: COLORS.muted, fontSize: TICK_SIZE };
const gridProps = { stroke: COLORS.grid, vertical: false };
const legendStyle: CSSProperties = { fontSize: 12 };
const noteStyle: CSSProperties = { margin: "6px 0 0", color: COLORS.muted, fontSize: 12, lineHeight: 1.4 };

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

/** Round a positive maximum up to a "nice" axis bound split into `count` equal steps. */
function niceTicks(maxValue: number, count = 4): number[] {
  const raw = Math.max(maxValue, Number.EPSILON) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= raw) ?? 10) * magnitude;
  return Array.from({ length: count + 1 }, (_, index) => index * step);
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

function ChartShell({ children, minHeight = 280 }: { children: ReactNode; minHeight?: number }) {
  return <div className="chart-stage" style={{ minHeight }}>{children}</div>;
}

const valueLabel = (format: (value: number) => string) => ({ fill: COLORS.ink, fontSize: TICK_SIZE, formatter: (value: number) => format(value) });

export function PipelineChart({ data, won = false }: { data: DataRow[]; won?: boolean }) {
  const key = won ? "won_pipeline" : "total_pipeline";
  const shaped = data
    .filter((row) => numberValue(row, key) > 0)
    .sort((a, b) => numberValue(b, key) - numberValue(a, key))
    .map((row) => ({ channel: displayName(textValue(row, "channel_category")), amount: numberValue(row, key) }));
  if (!shaped.length) return <EmptyChart />;
  const height = Math.max(300, shaped.length * 30);
  return <ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={shaped} layout="vertical" margin={{ left: 8, right: 64, top: 8, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={money} tick={axisTick} /><YAxis type="category" dataKey="channel" width={160} tick={lineTick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [formatField("recorded_amount", value), won ? "Won revenue" : "Pipeline"]} />
    <Bar dataKey="amount" fill={won ? COLORS.teal : COLORS.blue} barSize={17} radius={[0, 4, 4, 0]} isAnimationActive={false}><LabelList dataKey="amount" position="right" {...valueLabel(money)} /></Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function MonthlyPipelineChart({ data }: { data: DataRow[] }) {
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
    series.forEach(({ channel, key }) => {
      row[key] = data.filter((item) => textValue(item, "month") === month && textValue(item, "channel") === channel).reduce((sum, item) => sum + numberValue(item, "pipeline"), 0);
    });
    return row;
  });
  if (!rows.length || !series.length) return <EmptyChart />;
  return <>
    <ChartShell minHeight={320}><ResponsiveContainer width="100%" height={320}><ComposedChart data={rows} margin={{ left: 0, right: 28, top: 10, bottom: 8 }} barCategoryGap={1}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="month" tick={axisTick} interval="preserveStartEnd" minTickGap={24} tickMargin={6} />
      <YAxis tickFormatter={money} tick={axisTick} width={56} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(255,255,255,.06)" }} formatter={(value: number, name: string) => [formatField("recorded_amount", value), name]} />
      {series.map(({ key, label, color }) => <Bar key={key} dataKey={key} name={label} stackId="mix" fill={color} isAnimationActive={false} />)}
    </ComposedChart></ResponsiveContainer></ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label="Monthly pipeline mix legend">{series.map(({ key, label, color }) => <span key={key}><i style={{ background: color }} />{label}</span>)}</div>
  </>;
}

export function CohortChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => textValue(row, "quarter") >= "2022Q1");
  if (!rows.length) return <EmptyChart />;
  const lineRows = rows.map((row) => ({
    quarter: textValue(row, "quarter"),
    is_mature: Boolean(row.is_mature),
    // `closed_win_rate` is the canonical contract key; the fallback keeps
    // the evidence line resilient if an older validated cohort export only
    // exposes the legacy `win_rate` alias.
    "Closed-deal win rate": numberValue(row, "closed_win_rate", numberValue(row, "win_rate")) * 100,
    winError: (() => {
      const rate = numberValue(row, "closed_win_rate", numberValue(row, "win_rate"));
      const low = numberValue(row, "win_rate_ci_low", numberValue(row, "ci_low", rate));
      const high = numberValue(row, "win_rate_ci_high", numberValue(row, "ci_high", rate));
      return [Math.max(0, (rate - low) * 100), Math.max(0, (high - rate) * 100)];
    })(),
    "Resolved share": numberValue(row, "resolved_share") * 100,
  }));
  const pipelineRows = rows.map((row) => ({ quarter: textValue(row, "quarter"), Pipeline: numberValue(row, "pipeline") }));
  return <div className="chart-stack">
    <div className="mini-chart-label">Pipeline created</div>
    <ChartShell minHeight={170}>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={pipelineRows} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="quarter" tick={axisTick} interval="preserveStartEnd" minTickGap={24} tickMargin={6} />
          <YAxis tickFormatter={money} tick={axisTick} width={56} tickCount={4} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(255,255,255,.06)" }} formatter={(value: number) => [formatField("recorded_amount", value), "Pipeline created"]} />
          <Bar dataKey="Pipeline" fill={COLORS.blue} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
    <div className="mini-chart-label">Closed-deal quality and cohort maturity</div>
    <ChartShell minHeight={190}>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={lineRows} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="quarter" tick={axisTick} interval="preserveStartEnd" minTickGap={24} tickMargin={6} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={axisTick} width={56} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number, name: string) => [`${value.toFixed(0)}%`, name]} />
          <Line type="monotone" dataKey="Closed-deal win rate" stroke={COLORS.amber} strokeWidth={2.5} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { is_mature?: boolean } }) => <circle key={`cohort-dot-${props.index}`} cx={props.cx} cy={props.cy} r={props.payload?.is_mature ? 2.8 : 4.5} fill={props.payload?.is_mature ? COLORS.amber : COLORS.pale} stroke={COLORS.amber} strokeWidth={props.payload?.is_mature ? 1 : 2} strokeDasharray={props.payload?.is_mature ? undefined : "2 2"} />} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false}><ErrorBar dataKey="winError" direction="y" width={4} stroke={COLORS.amber} /></Line>
          <Line type="monotone" dataKey="Resolved share" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 2.5, fill: COLORS.teal }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
    <div className="chart-legend" style={legendStyle} aria-label="Cohort quality legend"><span><i style={{ background: COLORS.amber }} />Closed-deal win rate · 95% interval</span><span><i style={{ background: COLORS.teal }} />Resolved share</span><span><i className="cohort-marker provisional" />Hollow marker · provisional cohort</span></div>
  </div>;
}

export function ContributionChart({ data, totalPipeline }: { data: DataRow[]; totalPipeline: number }) {
  const sourced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Sourced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const influenced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Influenced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const rows = [
    { metric: "Marketing sourced", amount: sourced, share: totalPipeline ? sourced / totalPipeline : 0, fill: COLORS.blue },
    { metric: "Marketing influenced", amount: influenced, share: totalPipeline ? influenced / totalPipeline : 0, fill: COLORS.teal },
  ];
  return <ChartShell minHeight={190}><ResponsiveContainer width="100%" height={190}><ComposedChart data={rows} layout="vertical" margin={{ left: 12, right: 84, top: 12, bottom: 16 }}>
    <CartesianGrid {...gridProps} />
    <XAxis type="number" domain={[0, Math.max(totalPipeline, ...rows.map((row) => row.amount))]} tickFormatter={money} tick={axisTick} />
    <YAxis type="category" dataKey="metric" width={150} tick={lineTick} />
    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [formatField("recorded_amount", value), "Pipeline"]} />
    <ReferenceLine x={totalPipeline} stroke={COLORS.slate} strokeDasharray="4 4" label={{ value: "Total pipeline", fill: COLORS.muted, fontSize: TICK_SIZE, position: "insideTopRight" }} />
    <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={25} isAnimationActive={false}>
      {rows.map((row) => <Cell key={row.metric} fill={row.fill} />)}
      <LabelList dataKey="share" position="right" formatter={(value: number) => `${money(rows.find((row) => row.share === value)?.amount ?? 0)} (${(value * 100).toFixed(0)}%)`} fill={COLORS.ink} fontSize={TICK_SIZE} />
    </Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

const coverageTick = stackedTick((value) => wrapText(value, 9, 2), { anchor: "middle", vertical: false });

export function CoverageChart({ data }: { data: DataRow[] }) {
  const order = ["Not Reached", "6sense Only", "Email Only", "Both Channels"];
  const rows = [...data].sort((a, b) => order.indexOf(textValue(a, "coverage_tier")) - order.indexOf(textValue(b, "coverage_tier"))).map((row) => ({
    tier: textValue(row, "coverage_tier"), accounts: numberValue(row, "accounts"), rate: numberValue(row, "opp_rate") * 100,
    low: numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100,
    high: numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100,
    error: [Math.max(0, numberValue(row, "opp_rate") * 100 - numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100), Math.max(0, numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100 - numberValue(row, "opp_rate") * 100)],
  }));
  if (!rows.length) return <EmptyChart />;
  const xAxisProps = { dataKey: "tier", tick: coverageTick, interval: 0 as const, height: 40, tickLine: false };
  const accountTicks = niceTicks(Math.max(...rows.map((row) => row.accounts)));
  return <div className="chart-stack coverage-chart">
    <div className="mini-chart-label">CRM account domains by coverage tier</div>
    <ChartShell minHeight={200}><ResponsiveContainer width="100%" height={200}><ComposedChart data={rows} margin={{ left: 0, right: 12, top: 20, bottom: 4 }}>
      <CartesianGrid {...gridProps} /><XAxis {...xAxisProps} /><YAxis tick={axisTick} width={52} domain={[0, accountTicks[accountTicks.length - 1]]} ticks={accountTicks} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [value.toLocaleString(), "Accounts"]} />
      <Bar dataKey="accounts" fill={COLORS.blue} radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false}><LabelList dataKey="accounts" position="top" formatter={(value: number) => value.toLocaleString()} fill={COLORS.ink} fontSize={TICK_SIZE} /></Bar>
    </ComposedChart></ResponsiveContainer></ChartShell>
    <div className="mini-chart-label">Historical opportunity prevalence · 95% Wilson interval</div>
    <ChartShell minHeight={200}><ResponsiveContainer width="100%" height={200}><ComposedChart data={rows} margin={{ left: 0, right: 12, top: 12, bottom: 4 }}>
      <CartesianGrid {...gridProps} /><XAxis {...xAxisProps} padding={{ left: 36, right: 36 }} /><YAxis domain={[0, 60]} ticks={[0, 15, 30, 45, 60]} tickFormatter={(value) => `${value}%`} tick={axisTick} width={52} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [`${value.toFixed(1)}%`, "Historical opportunity prevalence"]} />
      <Line dataKey="rate" name="Historical opportunity prevalence" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.teal, r: 5, stroke: COLORS.teal, strokeWidth: 1 }} activeDot={{ r: 7 }} isAnimationActive={false}><ErrorBar dataKey="error" direction="y" width={5} stroke={COLORS.slate} /><LabelList dataKey="rate" position="right" offset={12} formatter={(value: number) => `${value.toFixed(1)}%`} fill={COLORS.ink} fontSize={TICK_SIZE} /></Line>
    </ComposedChart></ResponsiveContainer></ChartShell>
  </div>;
}

export function CoverageMixChart({ data }: { data: DataRow[] }) {
  const rows = data.map((row) => ({ name: textValue(row, "name"), value: numberValue(row, "value") }));
  if (!rows.length) return <EmptyChart />;
  const colors = [COLORS.slate, COLORS.blue];
  return <><ChartShell minHeight={220}><ResponsiveContainer width="100%" height={220}><PieChart>
    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
    <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" stroke="#080809" isAnimationActive={false}>{rows.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie>
  </PieChart></ResponsiveContainer></ChartShell><div className="chart-legend" style={legendStyle} aria-label="Coverage mix legend">{rows.map((row, index) => <span key={row.name}><i style={{ background: colors[index % colors.length] }} />{row.name} · {row.value.toLocaleString()}</span>)}</div></>;
}

const ATTRIBUTION_MODELS = ["First-Touch", "Last-Touch", "Linear", "Time-Decay"];

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
  return <p className="chart-note" style={noteStyle} title={channels.map((row) => row.label).join(", ")}>{channels.length} {channels.length === 1 ? "channel has" : "channels have"} no linked touches under these models and {channels.length === 1 ? "is" : "are"} omitted: {channels.map((row) => row.label).join(", ")}.</p>;
}

export function AttributionComparison({ data }: { data: DataRow[] }) {
  const models = ATTRIBUTION_MODELS;
  const { linked, unlinked } = attributionByChannel(data, models);
  const rows = linked.map((row) => ({ channel: row.label, ...row.values }))
    .sort((a, b) => models.reduce((sum, model) => sum + Number((b as Record<string, unknown>)[model]), 0) - models.reduce((sum, model) => sum + Number((a as Record<string, unknown>)[model]), 0));
  if (!rows.length) return <><EmptyChart message="No channel has linked touches under the four attribution models." /><UnlinkedNote channels={unlinked} /></>;
  const height = Math.max(180, rows.length * 72 + 40);
  return <><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 64, top: 10, bottom: 20 }} barCategoryGap="18%">
    <defs>
      <pattern id="attr-stripe-teal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill={COLORS.teal} /><rect width="2" height="6" fill="#ffffff" fillOpacity=".42" /></pattern>
      <pattern id="attr-stripe-amber" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.amber} /><rect width="6" height="2" fill="#ffffff" fillOpacity=".42" /></pattern>
      <pattern id="attr-dot-violet" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.violet} /><circle cx="2" cy="2" r="1.1" fill="#ffffff" fillOpacity=".58" /></pattern>
    </defs>
    <CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={money} tick={axisTick} /><YAxis type="category" dataKey="channel" width={130} tick={lineTick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number, name: string) => [formatField("recorded_amount", value), name]} />
    {models.map((model, index) => <Bar key={model} dataKey={model} name={model} fill={[COLORS.blue, "url(#attr-stripe-teal)", "url(#attr-stripe-amber)", "url(#attr-dot-violet)"][index]} barSize={11} radius={[0, 3, 3, 0]} isAnimationActive={false}><LabelList dataKey={model} position="right" {...valueLabel(money)} /></Bar>)}
  </ComposedChart></ResponsiveContainer></ChartShell><div className="chart-legend" style={legendStyle} aria-label="Attribution model legend"><span><i className="attr-swatch attr-ft" />FT · First-Touch</span><span><i className="attr-swatch attr-lt" />LT · Last-Touch</span><span><i className="attr-swatch attr-lin" />LIN · Linear</span><span><i className="attr-swatch attr-td" />TD · Time-Decay</span></div><UnlinkedNote channels={unlinked} /></>;
}

const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

export function CreditShiftChart({ data }: { data: DataRow[] }) {
  const { linked, unlinked } = attributionByChannel(data, ["First-Touch", "Last-Touch"]);
  const rows = linked.map((row) => ({ channel: row.label, delta: row.values["Last-Touch"] - row.values["First-Touch"] })).sort((a, b) => b.delta - a.delta);
  if (!rows.length) return <><EmptyChart message="No channel has First-Touch or Last-Touch credit." /><UnlinkedNote channels={unlinked} /></>;
  const height = Math.max(160, rows.length * 56 + 40);
  const half = niceTicks(Math.max(...rows.map((row) => Math.abs(row.delta)), 1), 2);
  const extent = half[half.length - 1];
  const shiftTicks = [...half.slice(1).reverse().map((value) => -value), ...half];
  return <><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 72, top: 10, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" domain={[-extent, extent]} ticks={shiftTicks} tickFormatter={(value: number) => value === 0 ? "$0" : signedMoney(value)} tick={axisTick} /><YAxis type="category" dataKey="channel" width={130} tick={lineTick} interval={0} /><ReferenceLine x={0} stroke={COLORS.ink} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [formatField("recorded_amount", value), "Last-Touch minus First-Touch"]} />
    <Bar dataKey="delta" barSize={20} isAnimationActive={false}>
      {rows.map((row) => <Cell key={row.channel} fill={row.delta >= 0 ? COLORS.teal : COLORS.amber} />)}
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
  </ComposedChart></ResponsiveContainer></ChartShell><div className="chart-legend" style={legendStyle} aria-label="Credit shift legend"><span><i style={{ background: COLORS.teal }} />Gains credit under Last-Touch</span><span><i style={{ background: COLORS.amber }} />Loses credit under Last-Touch</span></div><UnlinkedNote channels={unlinked} /></>;
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
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: at(row.multiple), minWidth: row.multiple > 0 ? 3 : 0, borderRadius: 5, background: COLORS.blue }} />
        <div style={{ position: "absolute", left: at(1), top: -4, bottom: -4, borderLeft: `2px dashed ${COLORS.pale}` }} />
      </div>
    </div>)}
    <div aria-hidden="true" style={{ position: "relative", height: 16, marginTop: -6, ...muted }}><span style={{ position: "absolute", left: 0 }}>0×</span><span style={{ position: "absolute", left: at(1), transform: "translateX(-50%)", whiteSpace: "nowrap", color: COLORS.pale }}>1× break-even</span></div>
    <div style={{ ...muted }}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: COLORS.blue, marginRight: 6, verticalAlign: "-1px" }} />Bar = same-period recorded pipeline ÷ tracked spend; dashed line = 1× break-even.</div>
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
  const groupOf = (channel: string) => FUNNEL_GROUPS.findIndex((group) => channel in group.channels);
  const rows = data.map((row) => {
    const channel = textValue(row, "channel");
    const stage = textValue(row, "stage");
    const groupIndex = groupOf(channel);
    const group = FUNNEL_GROUPS[groupIndex];
    const source = group?.channels[channel] ?? channel;
    return { label: `${source} · ${FUNNEL_STAGES[stage] ?? stage}`, fullLabel: `${channel} · ${stage}`, count: numberValue(row, "count"), groupIndex: groupIndex < 0 ? FUNNEL_GROUPS.length : groupIndex, color: group?.color ?? COLORS.pale };
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
    <ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 52, top: narrow ? 18 : 8, bottom: 16 }}>
      <CartesianGrid stroke={COLORS.grid} horizontal={false} vertical />
      <XAxis type="number" scale="log" domain={[10, topTick]} ticks={ticks} allowDataOverflow tickFormatter={(value: number) => compact.format(value)} tick={axisTick} />
      <YAxis type="category" dataKey="label" width={narrow ? 134 : 190} tick={funnelTick} interval={0} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} labelFormatter={(_label, payload) => (payload?.[0]?.payload as { fullLabel?: string } | undefined)?.fullLabel ?? String(_label)} formatter={(value: number) => [value.toLocaleString(), "Count"]} />
      <Line dataKey="count" name="Count" stroke="transparent" strokeWidth={0} isAnimationActive={false} activeDot={{ r: 6 }} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { color?: string } }) => <circle key={`funnel-dot-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill={props.payload?.color ?? COLORS.pale} stroke="#080809" strokeWidth={1} />}>
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
  const rows = data.map((row) => { const rate = numberValue(row, "win_rate"); const deals = numberValue(row, "deals"); const avg = numberValue(row, "avg_deal"); return { segment: textValue(row, "segment__c"), rate: rate * 100, error: [Math.max(0, (rate - numberValue(row, "ci_low", rate)) * 100), Math.max(0, (numberValue(row, "ci_high", rate) - rate) * 100)], deals, avg }; }).sort((a, b) => b.rate - a.rate);
  if (!rows.length) return <EmptyChart />;
  const tickLines = new Map(rows.map((row) => [row.segment, [row.segment, `n=${row.deals.toLocaleString()} · avg ${money(row.avg)}`]]));
  const tick = stackedTick((value) => tickLines.get(value) ?? [value]);
  const height = Math.max(220, rows.length * 58 + 40);
  return <ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 20, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={axisTick} /><YAxis type="category" dataKey="segment" width={150} tick={tick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number, name: string) => [name === "Win rate" ? `${value.toFixed(1)}%` : value, name]} /><Line dataKey="rate" name="Win rate" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.blue, r: 5, stroke: COLORS.blue, strokeWidth: 1 }} activeDot={{ r: 7 }} isAnimationActive={false}><ErrorBar dataKey="error" direction="x" width={6} stroke={COLORS.slate} /></Line>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function CreativeCtrChart({ data }: { data: DataRow[] }) {
  const narrow = useNarrow();
  const platforms = Array.from(new Set(data.map((row) => textValue(row, "platform"))));
  if (!platforms.length) return <EmptyChart />;
  const axisWidth = narrow ? 150 : 200;
  const chars = narrow ? 21 : 27;
  const tick = stackedTick((value) => wrapText(value.replaceAll("_", " "), chars, 2));
  return <div className="facet-grid">{platforms.map((platform) => {
    const rows = data.filter((row) => textValue(row, "platform") === platform).sort((a, b) => numberValue(b, "ctr") - numberValue(a, "ctr")).map((row) => ({ ad_name: textValue(row, "ad_name"), ctr: numberValue(row, "ctr"), impressions: numberValue(row, "impressions") }));
    const ctrTicks = niceTicks(Math.max(...rows.map((row) => row.ctr), 0.0001), 3);
    const ctrStep = ctrTicks[1] * 100;
    const ctrDigits = ctrStep >= 1 ? 0 : ctrStep >= 0.1 ? 1 : 2;
    const height = Math.max(200, rows.length * 44 + 30);
    return <div className="facet" key={platform}><div className="mini-chart-label">{platform}: top high-volume ads</div><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 0, right: 52, top: 14, bottom: 15 }}><CartesianGrid {...gridProps} /><XAxis type="number" domain={[0, ctrTicks[ctrTicks.length - 1]]} ticks={ctrTicks} tickFormatter={(value: number) => value === 0 ? "0%" : `${(value * 100).toFixed(ctrDigits)}%`} tick={axisTick} /><YAxis type="category" dataKey="ad_name" width={axisWidth} tick={tick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "CTR"]} /><Bar dataKey="ctr" name="CTR" fill={COLORS.blue} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}><LabelList dataKey="ctr" position="right" {...valueLabel((value) => `${(value * 100).toFixed(2)}%`)} /></Bar></ComposedChart></ResponsiveContainer></ChartShell></div>;
  })}</div>;
}

export function SimpleRankedChart({ data, labelKey, valueKey, color = COLORS.blue, formatter = (value: number) => value.toLocaleString(), suffixKey }: { data: DataRow[]; labelKey: string; valueKey: string; color?: string; formatter?: (value: number) => string; suffixKey?: string }) {
  const rows = data.map((row) => ({ label: prettyLabel(textValue(row, labelKey)), value: numberValue(row, valueKey), suffix: suffixKey ? (suffixKey === "pipeline" ? money(numberValue(row, suffixKey)) : `${textValue(row, suffixKey)} ${suffixKey.replaceAll("_", " ")}`) : "" })).sort((a, b) => b.value - a.value);
  if (!rows.length) return <EmptyChart />;
  const longest = Math.max(...rows.map((row) => row.label.length));
  const twoLine = longest > 24;
  const tick = stackedTick((value) => wrapText(value, 24, 2));
  const height = Math.max(230, rows.length * (twoLine ? 40 : 32));
  return <><ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 64, top: 16, bottom: 18 }}><CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={formatter} tick={axisTick} /><YAxis type="category" dataKey="label" width={170} tick={tick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [formatField(valueKey, value), valueKey.replaceAll("_", " ")]} /><Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={17} isAnimationActive={false}><LabelList dataKey="value" position="right" {...valueLabel(formatter)} /></Bar></ComposedChart></ResponsiveContainer></ChartShell>{suffixKey && <div className="ranked-samples" aria-label="Supporting sample and amount labels">{rows.map(row => <span key={row.label}><b>{row.label}:</b> {row.suffix}</span>)}</div>}</>;
}

const budgetTick = stackedTick((value) => wrapText(value, 11, 2), { anchor: "middle", vertical: false });

export function BudgetChart({ data }: { data: DataRow[] }) {
  const order = ["Status Quo", "10% Holdout", "Measurement First"];
  const rows = order.map((scenario) => { const group = data.filter((row) => textValue(row, "Scenario") === scenario); return { scenario, activated: group.reduce((sum, row) => sum + numberValue(row, "Active Spend ($)"), 0), holdout: group.reduce((sum, row) => sum + numberValue(row, "Holdout Reserve ($)"), 0), experiment: group.reduce((sum, row) => sum + numberValue(row, "Experiment Pool ($)"), 0) }; });
  return <><ChartShell minHeight={300}><ResponsiveContainer width="100%" height={300}><ComposedChart data={rows} margin={{ left: 0, right: 16, top: 18, bottom: 4 }}><CartesianGrid {...gridProps} /><XAxis dataKey="scenario" tick={budgetTick} interval={0} height={40} tickLine={false} /><YAxis tickFormatter={money} tick={axisTick} width={56} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number, name: string) => [formatField("recorded_amount", value), name]} /><Bar dataKey="activated" stackId="budget" fill={COLORS.blue} name="Activated media" isAnimationActive={false} /><Bar dataKey="holdout" stackId="budget" fill={COLORS.amber} name="Holdout reserve" isAnimationActive={false} /><Bar dataKey="experiment" stackId="budget" fill={COLORS.teal} name="Experiment pool" isAnimationActive={false} /></ComposedChart></ResponsiveContainer></ChartShell><div className="chart-legend" style={legendStyle} aria-label="Budget allocation legend"><span><i style={{ background: COLORS.blue }} />Activated media</span><span><i style={{ background: COLORS.amber }} />Holdout reserve</span><span><i style={{ background: COLORS.teal }} />Experiment pool</span></div></>;
}

export function VelocityChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => numberValue(row, "deal_count") >= 5).map((row) => { const median = numberValue(row, "median_days"); const count = numberValue(row, "deal_count"); return { channel: displayName(textValue(row, "channel_category")), median, error: [Math.max(0, median - numberValue(row, "p25", median)), Math.max(0, numberValue(row, "p75", median) - median)], count }; }).sort((a, b) => b.median - a.median);
  if (!rows.length) return <EmptyChart message="No channel has at least five won deals." />;
  const tickLines = new Map(rows.map((row) => [row.channel, [row.channel, `n=${row.count.toLocaleString()} won`]]));
  const tick = stackedTick((value) => tickLines.get(value) ?? [value]);
  const height = Math.max(240, rows.length * 46 + 30);
  return <ChartShell minHeight={height}><ResponsiveContainer width="100%" height={height}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 20, bottom: 20 }}><CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={(value) => `${value}d`} tick={axisTick} /><YAxis type="category" dataKey="channel" width={160} tick={tick} interval={0} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => [`${value.toFixed(0)} days`, "Median"]} /><Line dataKey="median" name="Median days" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.blue, r: 5, stroke: COLORS.blue, strokeWidth: 1 }} activeDot={{ r: 7 }} isAnimationActive={false}><ErrorBar dataKey="error" direction="x" width={7} stroke={COLORS.slate} /></Line></ComposedChart></ResponsiveContainer></ChartShell>;
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
    case "c-creative-attr": return <SimpleRankedChart data={data.creative_tone} labelKey="_copytone" valueKey="ctr" color={COLORS.blue} formatter={(value) => `${(value * 100).toFixed(2)}%`} suffixKey="impressions" />;
    case "c-email-seniority": return <SimpleRankedChart data={data.email_seniority} labelKey="_seniority" valueKey="click_event_share" color={COLORS.amber} formatter={(value) => `${(value * 100).toFixed(1)}%`} suffixKey="engaged_people" />;
    case "c-budget-scenario": return <BudgetChart data={data.budget_scenarios} />;
    case "c-deal-velocity": return <VelocityChart data={data.deal_velocity} />;
    case "c-journey": return <SimpleRankedChart data={data.journey_sequences} labelKey="sequence_2ch" valueKey="deals" formatter={(value) => value.toLocaleString()} suffixKey="pipeline" />;
    case "c-targeting-matrix": return <TargetingHeatmap data={data.targeting} />;
    default: return id === "coverage-mix" ? <CoverageMixChart data={coverageMix} /> : <EmptyChart />;
  }
}
