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

// The legacy dashboard above remains the default application surface. These
// additive types describe the case-study evidence contract consumed only by
// the browser presentation route.
export interface CaseDatasetStatus { status: "available" | "limited" | "unavailable"; reason: string; source_ids: string[]; population: string; period: string; }
export interface CaseFinding { id: string; question_id: string; headline: string; summary: string; evidence_status: string; metric_refs: string[]; chart_refs: string[]; source_ids: string[]; population: string; period: string; caveats: string[]; recommended_action_ids: string[]; }
export interface CaseRecommendation { id: string; decision: string; audience: string; channel: string; content_or_creative_bundle: string; supporting_finding_ids: string[]; evidence_limitations: string[]; owner_role: string; immediate_next_step: string; primary_success_measure: string; scale_stop_rule: string; confidence_status: string; }
export interface CaseSlideNotes { say: string; why: string; do_not_claim: string; transition: string; judge_question: string; answer: string; sources: string[]; }
export interface CaseSlide { id: string; sequence: "main" | "appendix"; order: number; title: string; layout: string; finding_ids: string[]; chart_refs: string[]; metric_refs: string[]; scope: string; body: string; source_footer: string; visible_caveat: string; speaker_notes: CaseSlideNotes; target_duration_seconds: number; }
export interface CaseStudyData { schema_version: 3; meta: { title: string; period: string; generated_at: string; snapshot_id: string; method_version: string; source_hashes: Record<string, string>; source_freshness: string }; metric_definitions: Record<string, string>; datasets: Record<string, DataRow[]>; dataset_status: Record<string, CaseDatasetStatus>; findings: CaseFinding[]; recommendations: CaseRecommendation[]; presentation: { target_duration_seconds: number; slides: CaseSlide[] }; manifest: { sections: string[]; case_questions: string[]; legacy_archive: string }; }
