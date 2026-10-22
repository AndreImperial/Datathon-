// Deck-only wayfinding and source labels. Raw codes use the shared `displayName` from ../labels.
import { displayName } from "../labels";

const FIELD_NAMES: Record<string, string> = { assettype: "Asset type", messaging: "Messaging", tone: "Tone", ctacopysofthard: "CTA (soft / hard)", copyassettype: "Asset type", copymessaging: "Messaging", copytone: "Tone" };

/** Readable creative-metadata field name (e.g. `Ctacopysofthard` → `CTA (soft / hard)`). */
export function fieldLabel(value: unknown): string {
  const key = String(value ?? "").replace(/^_+/, "").toLowerCase();
  return FIELD_NAMES[key] ?? displayName(value);
}

const SOURCE_NAMES: Record<string, string> = {
  "opportunities.parquet": "CRM opportunities",
  "accounts.parquet": "CRM accounts",
  "icp_database.parquet": "ICP database",
  "ad_metrics.parquet": "Ad metrics",
  "email_engagements.parquet": "Email engagement",
  "web_engagements.parquet": "Web engagement",
  "6sense_campaign.parquet": "6sense campaign",
};

/** Readable source names for a `;`-separated footer of parquet files. */
export function readableSources(footer: string): string[] {
  return footer.split(";").map((item) => item.trim()).filter(Boolean).map((item) => SOURCE_NAMES[item] ?? displayName(item.replace(/\.parquet$/i, "")));
}

export const SECTIONS = ["Context", "Channels", "Content", "Attribution", "Audience", "Decision"] as const;
export type Section = (typeof SECTIONS)[number] | "Appendix";

/** Short section name derived from the main-deck order (1–16). */
export function sectionFor(sequence: "main" | "appendix", order: number): Section {
  if (sequence === "appendix") return "Appendix";
  if (order <= 3) return "Context";
  if (order <= 7) return "Channels";
  if (order <= 9) return "Content";
  if (order <= 11) return "Attribution";
  if (order <= 12) return "Audience";
  return "Decision";
}
