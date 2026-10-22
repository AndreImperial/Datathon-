import type { CaseStudyData, DashboardData } from "./types";
import { REQUIRED_SECTION_IDS } from "./types";

export const chartPlacementIds = [
  "c-essential-contribution", "c-essential-coverage", "c-essential-cohort",
  "c-bar-channel", "c-donut-won", "c-monthly-trend", "c-attrib-comparison",
  "c-sourced-influenced", "c-attrib-waterfall", "c-spend-pipeline", "c-funnel",
  "c-seg-heatmap", "c-seg-winrate", "c-creative-ctr", "c-creative-attr",
  "c-email-seniority", "c-budget-scenario",
  "c-account-coverage", "c-deal-velocity", "c-journey", "c-targeting-matrix", "c-cohort",
];
export const tableIds = ["essential_action_plan", "attribution_models", "channel_roi_summary", "decision_confidence", "recommended_actions", "case_deliverable_coverage"];

export function validateDashboardPayload(value: unknown): DashboardData {
  const payload = value as DashboardData;
  if (!payload || payload.schema_version !== 2) throw new Error("Dashboard data schema is not version 2.");
  if (!payload.context?.metrics || !payload.meta || !payload.datasets || !payload.chart_data || !Array.isArray(payload.chart_metadata) || !payload.tables || !payload.manifest) throw new Error("Dashboard data is missing its evidence contract.");
  const required = ["channel_pipeline", "cohorts", "coverage", "attribution", "attribution_coverage", "attribution_sensitivity", "quality", "budget_scenarios", "targeting", "monthly_pipeline", "funnel_metrics", "segment_industry", "segment_win_rate", "creative_ctr", "creative_tone", "email_seniority", "deal_velocity", "journey_sequences", "account_coverage_detail", "attribution_touchpoint_quality", "qa_performance"];
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
  const emptyChartData = chartPlacementIds.filter((id) => !(chartData[id] as unknown[]).length && !payload.dataset_status?.[payload.chart_metadata.find((item) => item.chart_id === id)?.source_dataset ?? ""]);
  if (emptyChartData.length) throw new Error(`Dashboard chart data contains empty placements: ${emptyChartData.join(", ")}`);
  // Distinct chart definitions are derived from the chart metadata (canonical ids collapse
  // repeated placements of one chart) instead of a hard-coded count, so the manifest must agree
  // with the metadata it ships with rather than with a literal baked into the code.
  const distinctDefinitions = new Set(payload.manifest.distinct_chart_definitions ?? []);
  const metadataDefinitions = new Set(payload.chart_metadata.map((item) => item.canonical_chart_id ?? item.chart_id));
  if (payload.manifest.chart_placement_count !== chartPlacementIds.length || payload.manifest.distinct_chart_count !== distinctDefinitions.size || payload.manifest.distinct_chart_count !== metadataDefinitions.size || [...metadataDefinitions].some((id) => !distinctDefinitions.has(id)) || payload.manifest.section_ids.length !== REQUIRED_SECTION_IDS.length || payload.manifest.table_count !== tableIds.length) throw new Error("Dashboard preservation manifest is incomplete.");
  const incompleteTables = tableIds.filter((id) => {
    const table = payload.tables[id as keyof typeof payload.tables];
    return !table?.columns?.length || !Array.isArray(table.rows) || !Array.isArray(table.source_datasets) || typeof table.sortable !== "boolean" || table.rows.some((row) => table.columns.some((column) => !(column in row)));
  });
  if (incompleteTables.length) throw new Error(`Dashboard table contract is incomplete: ${incompleteTables.join(", ")}`);
  return payload;
}

export function validateCaseStudyPayload(value: unknown): CaseStudyData {
  const payload = value as CaseStudyData;
  if (!payload || payload.schema_version !== 3) throw new Error("Presentation evidence is not schema version 3.");
  return payload;
}
