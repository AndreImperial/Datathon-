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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_WORD = /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/i;
/** Codes in campaign email names that carry no meaning for the audience (sender prefix, brand, team, asset-type codes). */
const EMAIL_NOISE = /^(em\d*|3x|services|ws|bp|kl)$/i;
const EMAIL_LABEL_MAX = 34;

/**
 * Short, readable label for a campaign email name such as `EM_2024-01-29_3X_Newsletter_Jan-March_W2`
 * → `Newsletter Jan–Mar W2 · Jan 29` (joined with non-breaking spaces). Unparseable names come back unchanged; callers keep the full name as a tooltip.
 */
export function emailLabel(title: unknown): string {
  const raw = String(title ?? "").trim();
  if (!raw) return raw;
  let date = "";
  const words: string[] = [];
  let wave = "";
  for (const token of raw.split("_").filter(Boolean)) {
    const ymd = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(token);
    if (ymd && Number(ymd[2]) >= 1 && Number(ymd[2]) <= 12) { date = `${MONTHS[Number(ymd[2]) - 1]} ${Number(ymd[3])}`; continue; }
    if (EMAIL_NOISE.test(token)) continue;
    if (/^(W\d+)(-R\d+)?$|^R\d+$/i.test(token)) { wave = token.toUpperCase().split("-")[0]; continue; }
    const parts = token.split("-").map(part => part.replace(/([a-z])([A-Z])/g, "$1 $2"));
    const months = parts.every(part => MONTH_WORD.test(part));
    words.push(months ? parts.map(part => part.slice(0, 3)).join("–") : parts.join(" "));
  }
  let name = words.join(" ");
  if (!name) return raw;
  if (name.length > EMAIL_LABEL_MAX) { const cut = name.slice(0, EMAIL_LABEL_MAX + 1); name = `${cut.slice(0, cut.lastIndexOf(" ") > 12 ? cut.lastIndexOf(" ") : EMAIL_LABEL_MAX).trimEnd()}…`; }
  // Non-breaking spaces keep the separator with the name and the date on one line when the label wraps.
  return [wave ? `${name} ${wave}` : name, date.replace(" ", " ")].filter(Boolean).join(" · ");
}

export const SECTIONS =["Context", "Channels", "Content", "Attribution", "Audience", "Decision"] as const;
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
