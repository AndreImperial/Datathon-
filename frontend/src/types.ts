export type Scalar = string | number | boolean | null;
export type DataRow = Record<string, Scalar>;

export interface DashboardContext {
  project: string;
  scope: string[];
  guardrails: string[];
  metrics: Record<string, string>;
  recommendation: { headline: string; actions: string[] };
  caveats: string[];
  marketing_concepts?: Record<string, string>;
}

export interface DashboardMeta {
  title: string;
  period: string;
  generated_from: string;
  methodology: string;
  generated_at?: string;
  source_freshness?: string;
}

export interface ChartMetadata {
  chart_id: string;
  section_id: string;
  title: string;
  subtitle: string;
  source_dataset: string;
  fields: string[];
  units?: string;
  caveat: string;
  accessible_summary: string;
}

export interface DashboardDatasets {
  channel_pipeline: DataRow[];
  cohorts: DataRow[];
  coverage: DataRow[];
  attribution: DataRow[];
  attribution_coverage: DataRow[];
  attribution_sensitivity: DataRow[];
  quality: DataRow[];
  feature_importance: DataRow[];
  model_stats: DataRow[];
  model_calibration: DataRow[];
  budget_scenarios: DataRow[];
  targeting: DataRow[];
  monthly_pipeline: DataRow[];
  funnel_metrics: DataRow[];
  segment_industry: DataRow[];
  segment_win_rate: DataRow[];
  creative_ctr: DataRow[];
  creative_tone: DataRow[];
  email_seniority: DataRow[];
  deal_velocity: DataRow[];
  journey_sequences: DataRow[];
  win_probability: DataRow[];
  account_coverage_detail: DataRow[];
  attribution_touchpoint_quality: DataRow[];
  qa_performance: DataRow[];
}

export interface TableContract {
  columns: string[];
  rows: DataRow[];
  source_datasets: string[];
  sortable: boolean;
}

export interface DashboardTables {
  essential_action_plan: TableContract;
  attribution_models: TableContract;
  channel_roi_summary: TableContract;
  decision_confidence: TableContract;
  recommended_actions: TableContract;
  case_deliverable_coverage: TableContract;
}

export interface DashboardManifest {
  primary_navigation: string[];
  section_sequence: string[];
  section_ids: string[];
  chart_placements: string[];
  chart_placement_count: number;
  distinct_chart_definitions: string[];
  distinct_chart_count: number;
  table_ids: string[];
  table_count: number;
  required_audit_phrases: string[];
  legacy_reference: string;
}

export interface DashboardData {
  schema_version: number;
  meta: DashboardMeta;
  context: DashboardContext;
  datasets: DashboardDatasets;
  chart_data: Record<string, DataRow[]>;
  chart_metadata: ChartMetadata[];
  tables: DashboardTables;
  manifest: DashboardManifest;
}

export type SectionId =
  | "s-essential"
  | "s-exec"
  | "s-attrib"
  | "s-channel"
  | "s-segment"
  | "s-creative"
  | "s-budget"
  | "s-advanced"
  | "s-conclusion"
  | "s-appendix";

export const REQUIRED_SECTION_IDS: SectionId[] = [
  "s-essential", "s-exec", "s-attrib", "s-channel", "s-segment",
  "s-creative", "s-budget", "s-advanced", "s-appendix", "s-conclusion",
];

export function numberValue(row: DataRow, key: string, fallback = 0): number {
  const value = row[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function textValue(row: DataRow, key: string, fallback = ""): string {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}
