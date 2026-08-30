import {
  AreaChart as TremorAreaChart,
  BarChart as TremorBarChart,
  DonutChart as TremorDonutChart,
} from "@tremor/react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type { DashboardDatasets, DataRow } from "../types";
import { numberValue, textValue } from "../types";

export const COLORS = {
  ink: "#12233F",
  blue: "#1E40AF",
  azure: "#3B82F6",
  teal: "#0F766E",
  amber: "#D97706",
  red: "#B42318",
  violet: "#6D4AFF",
  slate: "#627087",
  pale: "#F8FAFC",
  grid: "#D6DFEA",
  muted: "#627087",
};

const money = (value: number) => {
  if (!Number.isFinite(value)) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
};
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const short = (value: string, length = 26) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const tooltipStyle = { background: COLORS.ink, border: "1px solid #3f566c", borderRadius: 4, color: "#fff", fontSize: 12 };
const axisTick = { fill: COLORS.muted, fontSize: 11 };
const gridProps = { stroke: COLORS.grid, strokeDasharray: "3 4", vertical: false };

function EmptyChart({ message = "No chart data available for this scope." }: { message?: string }) {
  return <div className="chart-empty" role="status"><strong>Chart unavailable</strong><span>{message}</span></div>;
}

function ChartShell({ children, minHeight = 280 }: { children: ReactNode; minHeight?: number }) {
  return <div className="chart-stage" style={{ minHeight }}>{children}</div>;
}

export function PipelineChart({ data, won = false }: { data: DataRow[]; won?: boolean }) {
  const rows = data
    .filter((row) => won ? numberValue(row, "won_pipeline") > 0 : numberValue(row, "total_pipeline") > 0)
    .sort((a, b) => numberValue(a, won ? "won_pipeline" : "total_pipeline") - numberValue(b, won ? "won_pipeline" : "total_pipeline"));
  const shaped = rows.map((row) => ({
    channel: textValue(row, "channel_category"),
    amount: numberValue(row, won ? "won_pipeline" : "total_pipeline"),
  }));
  if (!shaped.length) return <EmptyChart />;
  return <ChartShell minHeight={Math.max(300, shaped.length * 28)}><ResponsiveContainer width="100%" height={Math.max(300, shaped.length * 28)}><ComposedChart data={shaped} layout="vertical" margin={{ left: 8, right: 76, top: 8, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={money} tick={axisTick} /><YAxis type="category" dataKey="channel" width={136} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [money(value), won ? "Won revenue" : "Pipeline"]} />
    <Bar dataKey="amount" fill={won ? COLORS.teal : COLORS.blue} barSize={17} radius={[0, 4, 4, 0]} isAnimationActive={false}><LabelList dataKey="amount" position="right" formatter={(value: number) => money(value)} fill={COLORS.ink} fontSize={10} /></Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function MonthlyPipelineChart({ data }: { data: DataRow[] }) {
  const channels = Array.from(new Set(data.map((row) => textValue(row, "channel"))));
  const months = Array.from(new Set(data.map((row) => textValue(row, "month")))).sort();
  const rows = months.map((month) => {
    const row: Record<string, string | number> = { month };
    channels.forEach((channel) => {
      const match = data.find((item) => textValue(item, "month") === month && textValue(item, "channel") === channel);
      row[channel] = match ? numberValue(match, "pipeline") : 0;
    });
    return row;
  });
  if (!rows.length || !channels.length) return <EmptyChart />;
  const palette = ["blue", "teal", "amber", "slate", "cyan", "gray"];
  return <ChartShell minHeight={330}><TremorAreaChart
    className="tremor-chart"
    data={rows}
    index="month"
    categories={channels}
    colors={palette.slice(0, channels.length)}
    valueFormatter={(value) => money(value)}
    showLegend
    showGridLines={false}
    showAnimation={false}
    curveType="monotone"
  /></ChartShell>;
}

export function CohortChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => textValue(row, "quarter") >= "2022Q1");
  if (!rows.length) return <EmptyChart />;
  const lineRows = rows.map((row) => ({
    quarter: textValue(row, "quarter"),
    // `closed_win_rate` is the canonical contract key; the fallback keeps
    // the evidence line resilient if an older validated cohort export only
    // exposes the legacy `win_rate` alias.
    "Closed-deal win rate": numberValue(row, "closed_win_rate", numberValue(row, "win_rate")) * 100,
    "Resolved share": numberValue(row, "resolved_share") * 100,
  }));
  const pipelineRows = rows.map((row) => ({ quarter: textValue(row, "quarter"), Pipeline: numberValue(row, "pipeline") }));
  return <div className="chart-stack">
    <div className="mini-chart-label">Pipeline created</div>
    <ChartShell minHeight={170}><TremorBarChart className="tremor-chart compact" data={pipelineRows} index="quarter" categories={["Pipeline"]} colors={["blue"]} valueFormatter={money} showLegend={false} showGridLines={false} showAnimation={false} /></ChartShell>
    <div className="mini-chart-label">Closed-deal quality and cohort maturity</div>
    <ChartShell minHeight={190}>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={lineRows} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="quarter" tick={axisTick} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={axisTick} width={42} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(0)}%`, ""]} />
          <Line type="monotone" dataKey="Closed-deal win rate" stroke={COLORS.amber} strokeWidth={2.5} dot={{ r: 2.5, fill: COLORS.amber }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="Resolved share" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 2.5, fill: COLORS.teal }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
    <div className="chart-legend" aria-label="Cohort quality legend"><span><i style={{ background: COLORS.amber }} />Closed-deal win rate</span><span><i style={{ background: COLORS.teal }} />Resolved share</span></div>
  </div>;
}

export function ContributionChart({ data, totalPipeline }: { data: DataRow[]; totalPipeline: number }) {
  const sourced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Sourced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const influenced = data.filter((row) => textValue(row, "attribution_model") === "Marketing Influenced").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0);
  const rows = [
    { metric: "Marketing sourced", amount: sourced, share: totalPipeline ? sourced / totalPipeline : 0, fill: COLORS.blue },
    { metric: "Marketing influenced", amount: influenced, share: totalPipeline ? influenced / totalPipeline : 0, fill: COLORS.teal },
  ];
  return <ChartShell minHeight={190}><ResponsiveContainer width="100%" height={190}><ComposedChart data={rows} layout="vertical" margin={{ left: 12, right: 72, top: 12, bottom: 16 }}>
    <CartesianGrid {...gridProps} />
    <XAxis type="number" domain={[0, Math.max(totalPipeline, ...rows.map((row) => row.amount))]} tickFormatter={money} tick={axisTick} />
    <YAxis type="category" dataKey="metric" width={132} tick={axisTick} />
    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [money(value), "Pipeline"]} />
    <ReferenceLine x={totalPipeline} stroke={COLORS.slate} strokeDasharray="4 4" label={{ value: "Total pipeline", fill: COLORS.muted, fontSize: 10, position: "insideTopRight" }} />
    <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={25} isAnimationActive={false}>
      {rows.map((row) => <Cell key={row.metric} fill={row.fill} />)}
      <LabelList dataKey="share" position="right" formatter={(value: number) => `${money(rows.find((row) => row.share === value)?.amount ?? 0)} (${(value * 100).toFixed(0)}%)`} fill={COLORS.ink} fontSize={11} />
    </Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function CoverageChart({ data }: { data: DataRow[] }) {
  const order = ["Not Reached", "6sense Only", "Email Only", "Both Channels"];
  const rows = [...data].sort((a, b) => order.indexOf(textValue(a, "coverage_tier")) - order.indexOf(textValue(b, "coverage_tier"))).map((row) => ({
    tier: textValue(row, "coverage_tier"), accounts: numberValue(row, "accounts"), rate: numberValue(row, "opp_rate") * 100,
    low: numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100,
    high: numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100,
    error: [Math.max(0, numberValue(row, "opp_rate") * 100 - numberValue(row, "opp_rate_ci_low", numberValue(row, "ci_low")) * 100), Math.max(0, numberValue(row, "opp_rate_ci_high", numberValue(row, "ci_high")) * 100 - numberValue(row, "opp_rate") * 100)],
  }));
  if (!rows.length) return <EmptyChart />;
  return <div className="chart-stack coverage-chart">
    <div className="mini-chart-label">CRM account domains by coverage tier</div>
    <ChartShell minHeight={190}><ResponsiveContainer width="100%" height={190}><ComposedChart data={rows} margin={{ left: 0, right: 16, top: 16, bottom: 34 }}>
      <CartesianGrid {...gridProps} /><XAxis dataKey="tier" tick={axisTick} angle={-16} textAnchor="end" height={48} /><YAxis tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toLocaleString(), "Accounts"]} />
      <Bar dataKey="accounts" fill={COLORS.blue} radius={[5, 5, 0, 0]} barSize={34} isAnimationActive={false}><LabelList dataKey="accounts" position="top" formatter={(value: number) => value.toLocaleString()} fill={COLORS.ink} fontSize={11} /></Bar>
    </ComposedChart></ResponsiveContainer></ChartShell>
    <div className="mini-chart-label">Observed opportunity rate · 95% Wilson interval</div>
    <ChartShell minHeight={190}><ResponsiveContainer width="100%" height={190}><ComposedChart data={rows} margin={{ left: 0, right: 20, top: 18, bottom: 34 }}>
      <CartesianGrid {...gridProps} /><XAxis dataKey="tier" tick={axisTick} angle={-16} textAnchor="end" height={48} /><YAxis domain={[0, 60]} tickFormatter={(value) => `${value}%`} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)}%`, "Opportunity rate"]} />
      <Bar dataKey="rate" fill={COLORS.teal} radius={[5, 5, 0, 0]} barSize={22} isAnimationActive={false}><ErrorBar dataKey="error" width={5} stroke={COLORS.slate} /><LabelList dataKey="rate" position="top" formatter={(value: number) => `${value.toFixed(1)}%`} fill={COLORS.ink} fontSize={10} /></Bar>
      <Line dataKey="rate" stroke={COLORS.teal} dot={{ fill: COLORS.teal, r: 5 }} activeDot={{ r: 7 }} isAnimationActive={false} />
      {rows.map((row) => <ReferenceLine key={row.tier} x={row.tier} stroke="transparent" />)}
    </ComposedChart></ResponsiveContainer></ChartShell>
  </div>;
}

export function CoverageMixChart({ data }: { data: DataRow[] }) {
  const rows = data.map((row) => ({ name: textValue(row, "name"), value: numberValue(row, "value") }));
  if (!rows.length) return <EmptyChart />;
  return <ChartShell minHeight={220}><TremorDonutChart className="donut-chart" data={rows} category="value" index="name" colors={["slate", "blue"]} valueFormatter={(value) => value.toLocaleString()} showAnimation={false} /></ChartShell>;
}

export function AttributionComparison({ data }: { data: DataRow[] }) {
  const models = ["First-Touch", "Last-Touch", "Linear", "Time-Decay"];
  const channels = Array.from(new Set(data.map((row) => textValue(row, "channel"))));
  const rows = channels.map((channel) => {
    const row: Record<string, string | number> = { channel };
    models.forEach((model) => { row[model] = data.filter((item) => textValue(item, "channel") === channel && textValue(item, "attribution_model") === model).reduce((sum, item) => sum + numberValue(item, "attributed_pipeline"), 0); });
    return row;
  }).sort((a, b) => models.reduce((sum, model) => sum + Number(a[model]), 0) - models.reduce((sum, model) => sum + Number(b[model]), 0));
  if (!rows.length) return <EmptyChart />;
  return <><ChartShell minHeight={Math.max(320, rows.length * 35)}><ResponsiveContainer width="100%" height={Math.max(320, rows.length * 35)}><ComposedChart data={rows} layout="vertical" margin={{ left: 10, right: 70, top: 10, bottom: 22 }}>
    <defs>
      <pattern id="attr-stripe-teal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill={COLORS.teal} /><rect width="2" height="6" fill="#ffffff" fillOpacity=".28" /></pattern>
      <pattern id="attr-stripe-amber" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.amber} /><rect width="6" height="2" fill="#ffffff" fillOpacity=".28" /></pattern>
      <pattern id="attr-dot-violet" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={COLORS.violet} /><circle cx="2" cy="2" r="1.1" fill="#ffffff" fillOpacity=".45" /></pattern>
    </defs>
    <CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={money} tick={axisTick} /><YAxis type="category" dataKey="channel" width={120} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [money(value)]} />
    {models.map((model, index) => <Bar key={model} dataKey={model} fill={[COLORS.blue, "url(#attr-stripe-teal)", "url(#attr-stripe-amber)", "url(#attr-dot-violet)"][index]} barSize={10} radius={[0, 3, 3, 0]} isAnimationActive={false} />)}
  </ComposedChart></ResponsiveContainer></ChartShell><div className="chart-legend" aria-label="Attribution model legend"><span><i className="attr-swatch attr-ft" />FT · First-Touch</span><span><i className="attr-swatch attr-lt" />LT · Last-Touch</span><span><i className="attr-swatch attr-lin" />LIN · Linear</span><span><i className="attr-swatch attr-td" />TD · Time-Decay</span></div></>;
}

export function CreditShiftChart({ data }: { data: DataRow[] }) {
  const channels = Array.from(new Set(data.map((row) => textValue(row, "channel"))));
  const rows = channels.map((channel) => ({ channel, delta: data.filter((row) => textValue(row, "channel") === channel && textValue(row, "attribution_model") === "Last-Touch").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0) - data.filter((row) => textValue(row, "channel") === channel && textValue(row, "attribution_model") === "First-Touch").reduce((sum, row) => sum + numberValue(row, "attributed_pipeline"), 0) })).sort((a, b) => a.delta - b.delta);
  if (!rows.length) return <EmptyChart />;
  return <ChartShell minHeight={Math.max(280, rows.length * 30)}><ResponsiveContainer width="100%" height={Math.max(280, rows.length * 30)}><ComposedChart data={rows} layout="vertical" margin={{ left: 12, right: 70, top: 10, bottom: 22 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={money} tick={axisTick} /><YAxis type="category" dataKey="channel" width={120} tick={axisTick} /><ReferenceLine x={0} stroke={COLORS.ink} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [money(value), "Credit shift"]} />
    <Bar dataKey="delta" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}><LabelList dataKey="delta" position="right" formatter={(value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`} fill={COLORS.ink} fontSize={10} />{rows.map((row) => <Cell key={row.channel} fill={row.delta >= 0 ? COLORS.teal : COLORS.amber} />)}</Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function RoiChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => numberValue(row, "channel_spend") > 0).map((row) => ({ channel: textValue(row, "channel_category"), pipeline: numberValue(row, "pipeline_roi"), revenue: numberValue(row, "revenue_roi") })).sort((a, b) => a.pipeline - b.pipeline);
  if (!rows.length) return <EmptyChart message="No tracked-spend channels are available." />;
  const points = (key: "pipeline" | "revenue") => rows.map((row, index) => ({ x: row[key], y: index }));
  return <><ChartShell minHeight={Math.max(220, rows.length * 70)}><ResponsiveContainer width="100%" height={Math.max(220, rows.length * 70)}><ScatterChart layout="vertical" margin={{ left: 12, right: 34, top: 12, bottom: 18 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" dataKey="x" domain={[0, "auto"]} tickFormatter={(value) => `${value}×`} tick={axisTick} /><YAxis type="number" dataKey="y" domain={[-0.5, rows.length - 0.5]} ticks={rows.map((_, index) => index)} tickFormatter={(value) => rows[value]?.channel ?? ""} width={120} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}×`, name === "Pipeline ROI" ? "Pipeline ROI" : "Revenue ROI"]} />
    <Scatter name="Pipeline ROI" data={points("pipeline")} dataKey="x" fill={COLORS.blue} shape="circle" isAnimationActive={false} />
    <Scatter name="Revenue ROI" data={points("revenue")} dataKey="x" fill={COLORS.teal} shape="diamond" isAnimationActive={false} />
  </ScatterChart></ResponsiveContainer></ChartShell><div className="chart-legend" aria-label="ROI legend"><span><i className="dot" style={{ background: COLORS.blue }} />Pipeline ROI</span><span><i className="diamond" style={{ background: COLORS.teal }} />Revenue ROI</span></div></>;
}

export function ActivityVolumesChart({ data }: { data: DataRow[] }) {
  const channelNames: Record<string, string> = { "Email Event Mix": "Email events", "All Opportunity Outcomes": "CRM outcomes", "Marketing-Sourced Outcomes": "Sourced outcomes" };
  const stageNames: Record<string, string> = { "Influenced Form Fills": "Form fills", "Goal Completions": "Goals", "Closed Won (All)": "Closed won", "Marketing-Sourced Opps": "Opps", "Marketing-Sourced Won": "Won" };
  const rows = data.map((row) => { const channel = textValue(row, "channel"); const stage = textValue(row, "stage"); return { label: `${channelNames[channel] ?? channel} · ${stageNames[stage] ?? stage}`, count: numberValue(row, "count") }; }).sort((a, b) => a.count - b.count);
  if (!rows.length) return <EmptyChart />;
  return <><div className="mini-chart-label">Count · logarithmic scale · separate populations</div><ChartShell minHeight={Math.max(330, rows.length * 30)}><ResponsiveContainer width="100%" height={Math.max(330, rows.length * 30)}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 62, top: 10, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" scale="log" domain={[1, "auto"]} tickFormatter={(value) => Number(value).toLocaleString()} tick={axisTick} /><YAxis type="category" dataKey="label" width={138} tick={{ ...axisTick, fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toLocaleString(), "Count"]} /><Bar dataKey="count" fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={15} isAnimationActive={false} />
  </ComposedChart></ResponsiveContainer></ChartShell></>;
}

export function Heatmap({ data, xKey, yKey, valueKey, valueFormatter = (value: number) => money(value), domain = [0, 1], lowSampleKey }: { data: DataRow[]; xKey: string; yKey: string; valueKey: string; valueFormatter?: (value: number) => string; domain?: [number, number]; lowSampleKey?: string }) {
  const xs = Array.from(new Set(data.map((row) => textValue(row, xKey))));
  const ys = Array.from(new Set(data.map((row) => textValue(row, yKey))));
  if (!xs.length || !ys.length) return <EmptyChart />;
  const [min, max] = domain;
  return <div className="heatmap" style={{ gridTemplateColumns: `minmax(120px, 1.3fr) repeat(${xs.length}, minmax(76px, 1fr))` }}>
    <div className="heatmap-corner" />{xs.map((x) => <div className="heatmap-x" key={x}>{short(x, 17)}</div>)}
    {ys.map((y) => <div className="heatmap-row" key={y}><div className="heatmap-y">{short(y, 24)}</div>{xs.map((x) => { const row = data.find((item) => textValue(item, yKey) === y && textValue(item, xKey) === x); const value = row ? numberValue(row, valueKey) : 0; const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0; const low = lowSampleKey && row ? numberValue(row, lowSampleKey) < 30 : false; return <div className={`heatmap-cell${low ? " is-low" : ""}`} key={`${y}-${x}`} style={{ backgroundColor: `rgba(30,64,175,${0.08 + ratio * 0.82})`, color: ratio > 0.48 ? "#fff" : COLORS.ink }} title={`${y} · ${x}: ${valueFormatter(value)}${low ? " · Low n" : ""}`}>{row ? <><strong>{valueFormatter(value)}</strong>{low && <small>Low n</small>}</> : <span>—</span>}</div>; })}</div>)}
  </div>;
}

export function SegmentWinRateChart({ data }: { data: DataRow[] }) {
  const rows = data.map((row) => { const rate = numberValue(row, "win_rate"); return { segment: textValue(row, "segment__c"), rate: rate * 100, error: [Math.max(0, (rate - numberValue(row, "ci_low")) * 100), Math.max(0, (numberValue(row, "ci_high") - rate) * 100)], deals: numberValue(row, "deals"), avg: numberValue(row, "avg_deal") }; }).sort((a, b) => a.rate - b.rate);
  if (!rows.length) return <EmptyChart />;
  return <ChartShell minHeight={Math.max(230, rows.length * 54)}><ResponsiveContainer width="100%" height={Math.max(230, rows.length * 54)}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 90, top: 12, bottom: 20 }}>
    <CartesianGrid {...gridProps} /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={axisTick} /><YAxis type="category" dataKey="segment" width={110} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "rate" ? `${value.toFixed(1)}%` : value, name === "rate" ? "Win rate" : name]} /><Bar dataKey="rate" fill={COLORS.blue} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}><ErrorBar dataKey="error" width={6} stroke={COLORS.slate} /><LabelList dataKey="deals" position="right" formatter={(value: number) => `n=${value}`} fill={COLORS.muted} fontSize={10} /></Bar>
  </ComposedChart></ResponsiveContainer></ChartShell>;
}

export function CreativeCtrChart({ data }: { data: DataRow[] }) {
  const platforms = Array.from(new Set(data.map((row) => textValue(row, "platform"))));
  if (!platforms.length) return <EmptyChart />;
  return <div className="facet-grid">{platforms.map((platform) => { const rows = data.filter((row) => textValue(row, "platform") === platform).sort((a, b) => numberValue(a, "ctr") - numberValue(b, "ctr")); return <div className="facet" key={platform}><div className="mini-chart-label">{platform}: top high-volume ads</div><ChartShell minHeight={Math.max(180, rows.length * 34)}><ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}><ComposedChart data={rows} layout="vertical" margin={{ left: 4, right: 60, top: 4, bottom: 15 }}><CartesianGrid {...gridProps} /><XAxis type="number" domain={[0, "auto"]} tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} tick={axisTick} /><YAxis type="category" dataKey="ad_name" width={125} tick={{ ...axisTick, fontSize: 10 }} tickFormatter={(value) => short(String(value), 18)} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, "CTR"]} /><Bar dataKey="ctr" fill={platform === "6sense" ? COLORS.amber : COLORS.blue} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></ChartShell></div>; })}</div>;
}

export function SimpleRankedChart({ data, labelKey, valueKey, color = COLORS.blue, formatter = (value: number) => value.toLocaleString(), suffixKey }: { data: DataRow[]; labelKey: string; valueKey: string; color?: string; formatter?: (value: number) => string; suffixKey?: string }) {
  const rows = data.map((row) => ({ label: textValue(row, labelKey), value: numberValue(row, valueKey), suffix: suffixKey ? textValue(row, suffixKey) : "" })).sort((a, b) => a.value - b.value);
  if (!rows.length) return <EmptyChart />;
  return <ChartShell minHeight={Math.max(230, rows.length * 32)}><ResponsiveContainer width="100%" height={Math.max(230, rows.length * 32)}><ComposedChart data={rows} layout="vertical" margin={{ left: 8, right: 74, top: 10, bottom: 18 }}><CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={formatter} tick={axisTick} /><YAxis type="category" dataKey="label" width={150} tick={{ ...axisTick, fontSize: 10 }} tickFormatter={(value) => short(String(value), 24)} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatter(value), valueKey]} /><Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={17} isAnimationActive={false}><LabelList dataKey="value" position="right" formatter={(value: number, entry: { payload?: { suffix?: string } }) => `${formatter(value)}${entry?.payload?.suffix ? ` · ${entry.payload.suffix}` : ""}`} fill={COLORS.ink} fontSize={10} /></Bar></ComposedChart></ResponsiveContainer></ChartShell>;
}

export function BudgetChart({ data }: { data: DataRow[] }) {
  const order = ["Status Quo", "10% Holdout", "Measurement First"];
  const rows = order.map((scenario) => { const group = data.filter((row) => textValue(row, "Scenario") === scenario); return { scenario, activated: group.reduce((sum, row) => sum + numberValue(row, "Active Spend ($)"), 0), holdout: group.reduce((sum, row) => sum + numberValue(row, "Holdout Reserve ($)"), 0), experiment: group.reduce((sum, row) => sum + numberValue(row, "Experiment Pool ($)"), 0) }; });
  return <><ChartShell minHeight={320}><ResponsiveContainer width="100%" height={320}><ComposedChart data={rows} margin={{ left: 12, right: 24, top: 18, bottom: 42 }}><CartesianGrid {...gridProps} /><XAxis dataKey="scenario" tick={axisTick} angle={-12} textAnchor="end" height={55} /><YAxis tickFormatter={money} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [money(value), name]} /><Bar dataKey="activated" stackId="budget" fill={COLORS.blue} name="Activated media" isAnimationActive={false} /><Bar dataKey="holdout" stackId="budget" fill={COLORS.amber} name="Holdout reserve" isAnimationActive={false} /><Bar dataKey="experiment" stackId="budget" fill={COLORS.teal} name="Experiment pool" isAnimationActive={false} /></ComposedChart></ResponsiveContainer></ChartShell><div className="chart-legend" aria-label="Budget allocation legend"><span><i style={{ background: COLORS.blue }} />Activated media</span><span><i style={{ background: COLORS.amber }} />Holdout reserve</span><span><i style={{ background: COLORS.teal }} />Experiment pool</span></div></>;
}

export function ProbabilityHistogram({ data }: { data: DataRow[] }) {
  const values = data.map((row) => numberValue(row, "win_probability")).filter((value) => Number.isFinite(value));
  if (!values.length) return <EmptyChart />;
  const bins = Array.from({ length: 10 }, (_, index) => ({ bucket: `${index * 10}–${index * 10 + 10}%`, count: values.filter((value) => value >= index / 10 && (index === 9 ? value <= 1 : value < (index + 1) / 10)).length }));
  return <ChartShell minHeight={290}><ResponsiveContainer width="100%" height={290}><ComposedChart data={bins} margin={{ left: 10, right: 20, top: 18, bottom: 42 }}><CartesianGrid {...gridProps} /><XAxis dataKey="bucket" tick={{ ...axisTick, fontSize: 10 }} angle={-28} textAnchor="end" height={54} /><YAxis tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toLocaleString(), "Active deals"]} /><Bar dataKey="count" fill={COLORS.blue} radius={[4, 4, 0, 0]} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></ChartShell>;
}

export function VelocityChart({ data }: { data: DataRow[] }) {
  const rows = data.filter((row) => numberValue(row, "deal_count") >= 5).map((row) => ({ channel: textValue(row, "channel_category"), median: numberValue(row, "median_days"), error: [Math.max(0, numberValue(row, "median_days") - numberValue(row, "p25")), Math.max(0, numberValue(row, "p75") - numberValue(row, "median_days"))], count: numberValue(row, "deal_count") })).sort((a, b) => a.median - b.median);
  if (!rows.length) return <EmptyChart message="No channel has at least five won deals." />;
  return <ChartShell minHeight={Math.max(240, rows.length * 42)}><ResponsiveContainer width="100%" height={Math.max(240, rows.length * 42)}><ComposedChart data={rows} layout="vertical" margin={{ left: 10, right: 70, top: 10, bottom: 20 }}><CartesianGrid {...gridProps} /><XAxis type="number" tickFormatter={(value) => `${value}d`} tick={axisTick} /><YAxis type="category" dataKey="channel" width={120} tick={axisTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(0)} days`, "Median"]} /><Bar dataKey="median" fill={COLORS.blue} barSize={17} radius={[0, 4, 4, 0]} isAnimationActive={false}><ErrorBar dataKey="error" width={7} stroke={COLORS.slate} /><LabelList dataKey="count" position="right" formatter={(value: number) => `n=${value}`} fill={COLORS.muted} fontSize={10} /></Bar></ComposedChart></ResponsiveContainer></ChartShell>;
}

export function TargetingHeatmap({ data }: { data: DataRow[] }) {
  return <Heatmap data={data} xKey="accountprofilefit6sense__c" yKey="segment__c" valueKey="adjusted_win_rate" valueFormatter={(value) => pct(value)} domain={[0, 0.55]} lowSampleKey="deals" />;
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
    case "c-seg-heatmap": return <Heatmap data={data.segment_industry} xKey="segment__c" yKey="industry" valueKey="total_pipeline" valueFormatter={money} domain={[0, Math.max(...data.segment_industry.map((row) => numberValue(row, "total_pipeline")), 1)]} />;
    case "c-seg-winrate": return <SegmentWinRateChart data={data.segment_win_rate} />;
    case "c-creative-ctr": return <CreativeCtrChart data={data.creative_ctr} />;
    case "c-creative-attr": return <SimpleRankedChart data={data.creative_tone} labelKey="_copytone" valueKey="ctr" color={COLORS.blue} formatter={(value) => `${(value * 100).toFixed(2)}%`} suffixKey="impressions" />;
    case "c-email-seniority": return <SimpleRankedChart data={data.email_seniority} labelKey="_seniority" valueKey="click_event_share" color={COLORS.amber} formatter={(value) => `${(value * 100).toFixed(1)}%`} suffixKey="engaged_people" />;
    case "c-budget-scenario": return <BudgetChart data={data.budget_scenarios} />;
    case "c-feat-imp": return <SimpleRankedChart data={data.feature_importance} labelKey="feature" valueKey="importance" formatter={(value) => value.toFixed(3)} />;
    case "c-win-prob": return <ProbabilityHistogram data={data.win_probability} />;
    case "c-deal-velocity": return <VelocityChart data={data.deal_velocity} />;
    case "c-journey": { const rows = data.journey_sequences.reduce<DataRow[]>((acc, row) => { const key = textValue(row, "sequence_2ch"); const current = acc.find((item) => textValue(item, "sequence_2ch") === key); if (current) { current.deals = numberValue(current, "deals") + 1; current.pipeline = numberValue(current, "pipeline") + numberValue(row, "amount"); } else acc.push({ sequence_2ch: key, deals: 1, pipeline: numberValue(row, "amount") }); return acc; }, []).sort((a, b) => numberValue(a, "deals") - numberValue(b, "deals")).slice(-10); return <SimpleRankedChart data={rows} labelKey="sequence_2ch" valueKey="deals" formatter={(value) => value.toLocaleString()} suffixKey="pipeline" />; }
    case "c-targeting-matrix": return <TargetingHeatmap data={data.targeting} />;
    default: return id === "coverage-mix" ? <CoverageMixChart data={coverageMix} /> : <EmptyChart />;
  }
}
