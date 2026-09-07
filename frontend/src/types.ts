export type Scalar = string | number | boolean | null;
export type DataRow = Record<string, Scalar>;
// Retained for the archived chart renderer; current sections read the same v3 rows by key.
export type DashboardDatasets = Record<string, DataRow[]>;

export interface DatasetStatus {
  status: "available" | "limited" | "unavailable";
  reason: string;
  source_ids: string[];
  population: string;
  period: string;
}

export interface Finding {
  id: string; question_id: string; headline: string; summary: string; evidence_status: string;
  metric_refs: string[]; chart_refs: string[]; source_ids: string[]; population: string; period: string;
  caveats: string[]; recommended_action_ids: string[];
}

export interface Recommendation {
  id: string; decision: string; audience: string; channel: string; content_or_creative_bundle: string;
  supporting_finding_ids: string[]; evidence_limitations: string[]; owner_role: string;
  immediate_next_step: string; primary_success_measure: string; scale_stop_rule: string; confidence_status: string;
}

export interface SlideNotes {
  say: string; why: string; do_not_claim: string; transition: string; judge_question: string; answer: string; sources: string[];
}

export interface SlideDefinition {
  id: string; sequence: "main" | "appendix"; order: number; title: string; layout: string;
  finding_ids: string[]; chart_refs: string[]; metric_refs: string[]; scope: string; body: string;
  source_footer: string; visible_caveat: string; speaker_notes: SlideNotes; target_duration_seconds: number;
}

export interface DashboardData {
  schema_version: 3;
  meta: { title: string; period: string; generated_at: string; snapshot_id: string; method_version: string; source_hashes: Record<string, string>; source_freshness: string };
  metric_definitions: Record<string, string>;
  datasets: DashboardDatasets;
  dataset_status: Record<string, DatasetStatus>;
  findings: Finding[];
  recommendations: Recommendation[];
  presentation: { target_duration_seconds: number; slides: SlideDefinition[] };
  manifest: { sections: string[]; case_questions: string[]; legacy_archive: string };
}

export const SECTION_LABELS: Record<string, string> = {
  "s-summary": "CMO Summary", "s-channels": "Channel Effectiveness", "s-content": "Content & Engagement",
  "s-attribution": "Attribution & Journeys", "s-trends": "Trends & Conversion", "s-audience": "Target Audience",
  "s-strategy": "Strategy & Experiments", "s-evidence": "Evidence & Methods",
};

export function numberValue(row: DataRow | undefined, key: string, fallback = 0): number {
  const value = row?.[key]; const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}
export function textValue(row: DataRow | undefined, key: string, fallback = ""): string {
  const value = row?.[key]; return value === null || value === undefined ? fallback : String(value);
}
