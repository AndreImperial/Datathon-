import { BarChart, DonutChart, LineChart } from "@tremor/react";

type Row = Record<string, string | number>;

export default function TremorChart({ variant, data }: { variant: "pipeline" | "attribution" | "coverage" | "mix" | "cohort"; data: Row[] }) {
  if (variant === "pipeline") return <BarChart className="chart" data={data} index="channel" categories={["Pipeline ($M)"]} colors={["blue"]} valueFormatter={(value) => `$${value.toFixed(1)}M`} yAxisWidth={54} showLegend={false} />;
  if (variant === "attribution") return <BarChart className="chart chart--compact" data={data} index="channel" categories={["Influenced pipeline ($M)"]} colors={["cyan"]} layout="vertical" valueFormatter={(value) => `$${value.toFixed(2)}M`} showLegend={false} />;
  if (variant === "coverage") return <BarChart className="chart" data={data} index="tier" categories={["Opportunity rate"]} colors={["emerald"]} valueFormatter={(value) => `${value.toFixed(1)}%`} showLegend={false} />;
  if (variant === "mix") return <DonutChart data={data} category="value" index="name" colors={["slate", "blue"]} valueFormatter={(value) => value.toLocaleString()} className="donut" />;
  return <LineChart className="chart" data={data} index="quarter" categories={["Closed-deal win rate"]} colors={["blue"]} valueFormatter={(value) => `${value.toFixed(0)}%`} showLegend={false} connectNulls />;
}
