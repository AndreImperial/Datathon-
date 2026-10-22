export function compareValues(a: unknown, b: unknown, direction: 1 | -1 = 1): number {
  const missing = (v: unknown) => v == null || v === "" || v === "—" || (typeof v === "number" && !Number.isFinite(v));
  if (missing(a) || missing(b)) return missing(a) === missing(b) ? 0 : missing(a) ? 1 : -1;
  return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))) * direction;
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(value)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function serializeEvidenceCsv(rows: Record<string, unknown>[], provenance: Record<string, unknown> = {}): string {
  const enriched = rows.map(row => ({ export_snapshot: provenance.snapshot_id ?? provenance.snapshot_generated_at ?? "Unavailable", export_order: "visible sort order for table; source order otherwise", ...provenance, field_units: Object.keys(row).map(key => `${key}: ${fieldUnit(key)}`).join("; "), ...row }));
  const keys = Array.from(new Set(enriched.flatMap(row => Object.keys(row))));
  return [keys, ...enriched.map(row => keys.map(key => (row as Record<string, unknown>)[key] ?? ""))].map(row => row.map(csvCell).join(",")).join("\n");
}
export function fieldUnit(key: string): string {
  const field = key.toLowerCase();
  if (/_roi$|^roi$|multiple|per_tracked_spend/.test(field)) return "multiple";
  if (/^abs_gap$|^gap$|_pp$/.test(field)) return "percentage points";
  if (/(_rate|_share|_coverage|_pct|_probability|_ci_low|_ci_high)$/.test(field) || ["win_rate", "rate", "share", "ctr", "precision", "recall", "accuracy", "mean_score", "score_min", "score_max", "absolute_lift", "wilson_low", "observed_win_rate", "predicted_win_rate", "lower_bound", "upper_bound", "pct_of_total", "importance", "auc_gap"].includes(field)) return "fraction";
  if (/(rows|count|opportunities|records|domains)$/.test(field) || field.startsWith("eligible_") || ["auc", "brier", "brier_score"].includes(field)) return "source value";
  if (/_amount$|_pipeline$|_revenue$|_spend$|^amount$|^pipeline$|^revenue$|^spend$|^cost_per_|^avg_deal|\(\$\)/.test(field) || ["cpc", "cpm", "attributed_amount"].includes(field)) return "recorded dollars (currency unverified)";
  if (/days/.test(field)) return "days";
  return "source value";
}
export function formatField(key: string, value: unknown): string {
  if (value == null || value === "" || (typeof value === "number" && !Number.isFinite(value))) return "—";
  if (typeof value !== "number") return String(value);
  if (key === "year" || key.endsWith("_year")) return String(value);
  const unit = fieldUnit(key);
  if (unit === "multiple") return `${value.toFixed(1)}×`;
  if (unit === "fraction") return `${(value * 100).toFixed(key.toLowerCase().includes("ctr") ? 4 : 2)}%`;
  if (unit === "percentage points") return `${value > 0 ? "+" : ""}${(key.includes("gap") ? value * 100 : value).toFixed(2)} pp`;
  if (unit.startsWith("recorded dollars")) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
