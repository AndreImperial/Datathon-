export type MetricMap = Record<string, string>;

export interface DashboardData {
  meta: { title: string; period: string; generated_from: string; methodology: string };
  context: {
    metrics: MetricMap;
    recommendation: { headline: string; actions: string[] };
    caveats: string[];
  };
  channel_pipeline: Array<Record<string, string | number | null>>;
  cohorts: Array<Record<string, string | number | boolean | null>>;
  coverage: Array<Record<string, string | number | null>>;
  attribution: Array<Record<string, string | number | null>>;
  attribution_coverage: Array<Record<string, string | number | null>>;
  quality: Array<Record<string, string | number | null>>;
  feature_importance: Array<Record<string, string | number | null>>;
  model_stats: Array<Record<string, string | number | null>>;
  budget_scenarios: Array<Record<string, string | number | null>>;
  targeting: Array<Record<string, string | number | null>>;
}
