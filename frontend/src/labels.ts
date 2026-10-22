// Display names for raw CRM / channel codes shown in charts, tables and the deck.
const NAMES: Record<string, string> = {
  existing_client: "Existing client",
  referral: "Referral",
  web_inbound: "Web inbound",
  "6sense_channel": "6sense channel referral",
  "6sense_display": "6sense display",
  "6sense_event": "6sense event",
  email_mqa: "Email MQA",
  event: "Event",
  webinar: "Webinar",
  linkedin: "LinkedIn",
  other_marketing: "Other marketing",
  other: "Other (CRM unlabeled)",
};

export function displayName(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const raw = String(value);
  if (raw in NAMES) return NAMES[raw];
  if (!raw.includes("_")) return raw;
  const words = raw.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
