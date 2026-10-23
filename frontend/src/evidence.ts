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
  if (/_mrr$|^mrr$/.test(field)) return "recorded dollars per month (currency unverified)";
  if (/_amount$|_pipeline$|_revenue$|_spend$|^amount$|^pipeline$|^revenue$|^spend$|^cost_per_|^avg_deal|\(\$\)/.test(field) || ["cpc", "cpm", "attributed_amount"].includes(field)) return "recorded dollars (currency unverified)";
  if (/days/.test(field)) return "days";
  return "source value";
}
/**
 * Display-only dollar formatting. Amounts of $100 or more show whole dollars
 * (recorded cents add noise, not precision); small unit costs such as CPC keep
 * cents. CSV export never uses this — it serializes the raw source values.
 */
export function formatDollars(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 2;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits })}`;
}
/** Compact dollar form for tight spaces: $3.3M, $678K, $940. */
export function formatDollarsCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 999_500) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}
/** One percent format for every tile and title: a fraction (0.102) reads "10.2%". */
export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}
/** One count format for every tile and title: 4426 reads "4,426". */
export function formatCount(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "—";
}
const ISO_DATETIME =/^\d{4}-\d{2}-\d{2}(T|\s|$)/;
/** Observation-window bounds read as a month, e.g. "Jan 2023". */
export function formatMonthYear(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}
const ACRONYMS = new Set(["roi", "ctr", "cpc", "cpm", "mrr", "icp", "auc", "id", "crm", "abm", "pp", "iqr", "ci"]);
const UNIT_SUFFIX: Record<string, string> = {
  multiple: "×",
  "percentage points": "pp",
  fraction: "%",
  "recorded dollars (currency unverified)": "$",
  "recorded dollars per month (currency unverified)": "$/mo",
  days: "days",
};
/** Readable table header: "channel_spend" -> "Channel spend ($)". Units stay explicit but short. */
export function columnLabel(key: string): string {
  const words = key.replaceAll("_", " ").trim().split(/\s+/).map((word) => ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.toLowerCase());
  const text = words.join(" ");
  const label = text.charAt(0).toUpperCase() + text.slice(1);
  const suffix = UNIT_SUFFIX[fieldUnit(key)];
  return suffix ? `${label} (${suffix})` : label;
}
export function formatField(key: string, value: unknown): string {
  if (value == null || value === "" || (typeof value === "number" && !Number.isFinite(value))) return "—";
  if (typeof value === "string" && /_period_(start|end)$/.test(key) && ISO_DATETIME.test(value)) return formatMonthYear(value);
  if (typeof value !== "number") return String(value);
  if (key === "year" || key.endsWith("_year")) return String(value);
  const unit = fieldUnit(key);
  if (unit === "multiple") return `${value.toFixed(1)}×`;
  if (unit === "fraction") return `${(value * 100).toFixed(key.toLowerCase().includes("ctr") ? 4 : 2)}%`;
  if (unit === "percentage points") return `${value > 0 ? "+" : ""}${(key.includes("gap") ? value * 100 : value).toFixed(2)} pp`;
  if (unit.startsWith("recorded dollars")) return formatDollars(value);
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/** Joins names as prose: "A", "A and B", "A, B, and C". */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * The largest rows by a numeric field, for copy that names leaders ("A ($1.5M)
 * and B ($1.1M)"). Rows without a positive finite value never rank; ties keep
 * source order. `keep` filters rows before ranking.
 */
export function topRows<T extends Record<string, unknown>>(rows: T[], key: string, limit: number, keep: (row: T) => boolean = () => true): T[] {
  return rows
    .filter((row) => keep(row) && typeof row[key] === "number" && Number.isFinite(row[key] as number) && (row[key] as number) > 0)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, limit);
}
