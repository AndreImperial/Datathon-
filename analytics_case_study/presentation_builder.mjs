import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[i + 1]]);
  return pairs;
}, []));

if (!args.data || !args.output || !args["render-dir"]) {
  throw new Error("Usage: node presentation_builder.mjs --data payload.json --output deck.pptx --render-dir dir");
}

const data = JSON.parse(await fs.readFile(args.data, "utf8"));
const renderDir = args["render-dir"];
await fs.mkdir(renderDir, { recursive: true });
await fs.mkdir(path.dirname(args.output), { recursive: true });

const C = {
  bg: "#F8FAFC", navy: "#12233F", blue: "#1E40AF", azure: "#3B82F6",
  amber: "#B45309", teal: "#0F766E", red: "#B91C1C", ink: "#172033",
  muted: "#64748B", line: "#D8E1EB", white: "#FFFFFF", paleBlue: "#EAF1FF",
  paleAmber: "#FFF6E6", paleRed: "#FDECEC", paleTeal: "#E9F7F3"
};
const FONT = "Aptos";
const W = 1280, H = 720;
const M = 62;

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function rect(slide, x, y, w, h, fill = C.white, line = C.line, radius = false) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = String(value);
  box.text.style = {
    fontFamily: FONT,
    fontSize: opts.size ?? 18,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "middle",
  };
  return box;
}

function pill(slide, value, x, y, w, fill = C.paleBlue, color = C.blue) {
  rect(slide, x, y, w, 28, fill, "none", true);
  text(slide, value, x + 10, y + 2, w - 20, 23, { size: 12, bold: true, color, align: "center" });
}

function title(slide, number, heading, subtitle = "") {
  text(slide, `MARKETING ANALYTICS  /  ${String(number).padStart(2, "0")}`, M, 28, 360, 24, { size: 12, bold: true, color: C.blue });
  text(slide, heading, M, 62, 1125, 54, { size: 32, bold: true, color: C.navy });
  if (subtitle) text(slide, subtitle, M, 118, 1125, 40, { size: 16, color: C.muted });
  rect(slide, M, 168, 1156, 2, C.line, "none");
}

function footer(slide, number, label = "Internal CRM + marketing data") {
  rect(slide, M, 680, 1156, 1, C.line, "none");
  text(slide, label, M, 688, 950, 20, { size: 10, color: C.muted });
  text(slide, String(number).padStart(2, "0"), 1160, 688, 58, 20, { size: 10, bold: true, color: C.navy, align: "right" });
}

function notes(slide, sourceLines, methodology) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    ...sourceLines.map((s) => `- ${s}`),
    "",
    "[Methodology]",
    methodology,
  ].join("\n"));
  slide.speakerNotes.setVisible(true);
}

function kpi(slide, x, y, w, value, label, tone = "blue", detail = "") {
  const palette = {
    blue: [C.paleBlue, C.blue], amber: [C.paleAmber, C.amber],
    teal: [C.paleTeal, C.teal], red: [C.paleRed, C.red], white: [C.white, C.navy]
  }[tone];
  rect(slide, x, y, w, 112, palette[0], "none", true);
  text(slide, value, x + 18, y + 13, w - 36, 45, { size: 30, bold: true, color: palette[1] });
  text(slide, label, x + 18, y + 55, w - 36, 24, { size: 13, bold: true, color: C.ink });
  if (detail) text(slide, detail, x + 18, y + 78, w - 36, 25, { size: 11, color: C.muted });
}

function callout(slide, x, y, w, h, heading, body, accent = C.blue, fill = C.white) {
  const dark = fill === "#1C2E49";
  rect(slide, x, y, w, h, fill, dark ? "#3D587A" : C.line, true);
  rect(slide, x, y, 6, h, accent, "none", true);
  text(slide, heading, x + 24, y + 16, w - 42, 26, { size: 16, bold: true, color: dark ? C.white : C.navy });
  text(slide, body, x + 24, y + 47, w - 42, h - 60, { size: 13, color: dark ? "#CBD7E7" : C.muted, valign: "top" });
}

function chartCard(slide, x, y, w, h, heading, subheading = "") {
  rect(slide, x, y, w, h, C.white, C.line, true);
  text(slide, heading, x + 22, y + 14, w - 44, 28, { size: 17, bold: true, color: C.navy });
  if (subheading) text(slide, subheading, x + 22, y + 42, w - 44, 24, { size: 11, color: C.muted });
  return { left: x + 22, top: y + (subheading ? 73 : 55), width: w - 44, height: h - (subheading ? 92 : 74) };
}

function moneyM(v) { return `$${(Number(v) / 1e6).toFixed(1)}M`; }
function pct(v, digits = 0) { return `${(Number(v) * 100).toFixed(digits)}%`; }
function sumBy(rows, key, value, expected) {
  return rows.filter((r) => r[key] === expected).reduce((a, r) => a + Number(r[value] || 0), 0);
}
function byKey(rows, key, value) { return rows.find((r) => r[key] === value) || {}; }

// 1 — thesis
{
  const s = presentation.slides.add();
  s.background.fill = C.navy;
  pill(s, "EXECUTIVE READOUT", M, 44, 180, "#233957", "#BFD4FF");
  text(s, "Targeted growth is credible.\nBlanket scaling is not—yet.", M, 105, 790, 165, { size: 48, bold: true, color: C.white, valign: "top" });
  text(s, "The opportunity is large, but measurement coverage and CRM completeness must improve before budget claims become decision-grade.", M, 290, 780, 72, { size: 20, color: "#CBD7E7", valign: "top" });
  kpi(s, M, 420, 255, moneyM(data.totals.pipeline), "Recorded pipeline", "white", `${data.totals.opportunities.toLocaleString()} deduplicated opportunities`);
  kpi(s, 335, 420, 255, moneyM(data.totals.won_revenue), "Recorded won revenue", "white", `${pct(data.totals.closed_win_rate, 1)} closed-deal win rate`);
  kpi(s, 608, 420, 255, String(data.totals.active), "Active opportunities", "white", "Scored only after leakage controls");
  kpi(s, 881, 420, 255, pct(data.totals.unreached_rate, 1), "CRM domains unreached", "white", "Largest testable audience");
  text(s, "Recommendation  /  protect quality • expand strong-fit coverage • reserve spend for causal measurement", M, 640, 1120, 28, { size: 13, bold: true, color: "#BFD4FF" });
  notes(s, ["data/cleaned/opportunities.parquet", "data/integrated/account_coverage_summary.parquet", "data/integrated/model_stats.parquet"], "Pipeline and won revenue use recorded CRM amounts. Closed win rate is won divided by resolved outcomes. Active opportunities are excluded from that denominator.");
}

// 2 — executive answer
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 2, "The executive answer: scale learning before spend", "Three decisions connect the analysis to an operating plan.");
  callout(s, M, 205, 354, 330, "1  Protect pipeline quality", `Closed-deal win rate moved from 38% in 2022 Q1 to 22% in 2024 Q2 among cohorts at least 80% resolved. Review ICP and qualification before broad acquisition grows.`, C.red, C.paleRed);
  callout(s, 463, 205, 354, 330, "2  Expand strong-fit coverage", `${pct(data.totals.unreached_rate, 1)} of CRM account domains have no tracked email or 6sense touch. Use that audience for a randomized or phased coverage test.`, C.blue, C.paleBlue);
  callout(s, 862, 205, 354, 330, "3  Measure before reallocating", "Only two paid channels have tracked spend; one has a single opportunity and neither has recorded won revenue. Reserve a holdout instead of claiming an optimizer.", C.amber, C.paleAmber);
  text(s, "Decision rule", M, 565, 150, 24, { size: 13, bold: true, color: C.blue });
  text(s, "Scale only after incremental qualified opportunities or pipeline are demonstrated without degrading closed-deal quality.", 190, 555, 970, 48, { size: 20, bold: true, color: C.navy });
  footer(s, 2);
  notes(s, ["data/integrated/cohort_analysis.parquet", "data/integrated/account_coverage_summary.parquet", "data/integrated/budget_scenarios.parquet"], "The three recommendations separate observed evidence from causal claims. Coverage groups are observational until tested with a holdout.");
}

// 3 — evidence boundaries
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 3, "Four evidence boundaries change the interpretation", "A strong analysis shows what the data cannot support—not only what it can.");
  const ac = data.attribution_coverage[0] || {};
  const cards = [
    [pct(data.totals.zero_amount_won_rate, 1), "Won opportunities with zero amount", "Recorded revenue and revenue ROI are understated.", "red"],
    [pct(ac.linked_share_of_won_opportunities || 0, 1), "Won opportunities linked to touches", "Influenced attribution describes a linked subset, not every win.", "amber"],
    ["2", "Paid channels with tracked spend", "One has a single opportunity; neither has recorded won revenue.", "amber"],
    ["No", "Delivered-email denominator", "Open/click rates cannot be calculated from an engagement-event log.", "red"],
  ];
  cards.forEach((c, i) => kpi(s, M + i * 287, 210, 265, c[0], c[1], c[3], c[2]));
  callout(s, M, 360, 553, 230, "What remains decision-grade", "Opportunity counts, recorded pipeline, closed outcomes, source credit, account coverage counts, and time-based model evaluation are reproducible and validated across outputs.", C.teal, C.paleTeal);
  callout(s, 655, 360, 561, 230, "What remains directional", "Influence attribution, reached-vs-unreached opportunity rates, email event composition, creative CTR comparisons, and budget scenarios require explicit scope labels or experiments.", C.amber, C.paleAmber);
  footer(s, 3, "Internal data | Known limitations surfaced before recommendations");
  notes(s, ["data/integrated/data_quality_summary.parquet", "data/integrated/attribution_coverage.parquet", "outputs/analysis/email_campaign_performance.xlsx", "data/integrated/budget_scenarios.parquet"], "Zero-amount won opportunities are counted from deduplicated CRM opportunities. Touch linkage uses a 365-day lookback and one account-channel presence per ISO week.");
}

// 4 — cohort quality
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 4, "Pipeline growth is outpacing conversion quality", "Compare only cohorts with at least 80% of opportunities resolved.");
  const frame = chartCard(s, M, 200, 780, 420, "Closed-deal win rate by create quarter", "Mature cohorts only • 95% intervals are available in the dashboard");
  const cats = data.cohorts.map((r) => r.quarter);
  const vals = data.cohorts.map((r) => Number((r.closed_win_rate * 100).toFixed(1)));
  s.charts.add("line", { position: frame, categories: cats, series: [{ name: "Closed win rate", values: vals, line: { style: "solid", fill: C.blue, width: 3 }, marker: { symbol: "circle", size: 7 }, valuesFormatCode: "0.0\"%\"" }], hasLegend: false, xAxis: { textStyle: { fill: C.muted, fontSize: 11 }, line: { style: "solid", fill: C.line, width: 1 } }, yAxis: { min: 0, max: 50, majorUnit: 10, numberFormatCode: "0\"%\"", textStyle: { fill: C.muted, fontSize: 11 }, majorGridlines: { style: "solid", fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: "above", textStyle: { fill: C.navy, fontSize: 10, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  kpi(s, 875, 205, 341, "38% → 22%", "2022 Q1 to 2024 Q2", "red", "Resolved-outcome denominator");
  kpi(s, 875, 335, 341, moneyM(data.cohorts.at(-1)?.pipeline || 0), "Pipeline in 2024 Q2 cohort", "blue", `${Math.round((data.cohorts.at(-1)?.resolved_share || 0) * 100)}% resolved`);
  callout(s, 875, 465, 341, 155, "Decision", "Audit ICP fit, qualification, and source mix before accelerating broad acquisition. Keep 2024 Q3–Q4 provisional until they mature.", C.red, C.paleRed);
  footer(s, 4);
  notes(s, ["data/integrated/cohort_analysis.parquet"], "Win rate equals won divided by resolved outcomes (closed won, closed lost, or discontinued). This slide includes only cohorts with resolved share at or above 80%.");
}

// 5 — contribution scope
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 5, "Source credit and linked influence answer different questions", "Report both, but never present influenced attribution as full-population or causal credit.");
  const rows = ["Marketing Sourced", "Marketing Influenced"].map((name) => ({ name, value: sumBy(data.contribution, "attribution_model", "attributed_pipeline", name) }));
  const frame = chartCard(s, M, 205, 700, 390, "Recorded pipeline contribution", "CRM source vs touchpoint-linked opportunity subset");
  s.charts.add("bar", { position: frame, categories: ["CRM sourced", "Linked influenced"], series: [{ name: "Pipeline ($M)", values: rows.map((r) => Number((r.value / 1e6).toFixed(2))), fill: C.blue, points: [{ idx: 1, fill: C.amber }], valuesFormatCode: "$0.0\"M\"" }], barOptions: { direction: "bar", grouping: "clustered", gapWidth: 60 }, hasLegend: false, xAxis: { min: 0, numberFormatCode: "$0.0\"M\"", majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 11 } }, yAxis: { textStyle: { fill: C.ink, fontSize: 13, bold: true }, line: { style: "solid", fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.navy, fontSize: 13, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  const ac = data.attribution_coverage[0] || {};
  kpi(s, 810, 205, 406, `${Number(ac.linked_opportunities || 0).toLocaleString()} / ${Number(ac.all_opportunities || 0).toLocaleString()}`, "Opportunities linked", "amber", pct(ac.linked_share_of_all_opportunities || 0, 1));
  kpi(s, 810, 335, 406, `${Number(ac.linked_won_opportunities || 0).toLocaleString()} / ${Number(ac.all_won_opportunities || 0).toLocaleString()}`, "Won opportunities linked", "red", pct(ac.linked_share_of_won_opportunities || 0, 1));
  callout(s, 810, 465, 406, 130, "Interpretation", "Influenced pipeline is useful journey context for linked opportunities. CRM sourced remains the conservative contribution view.", C.amber, C.paleAmber);
  footer(s, 5, "365-day lookback | one account-channel presence per ISO week");
  notes(s, ["data/integrated/attribution_results.parquet", "data/integrated/attribution_coverage.parquet"], "Marketing sourced uses CRM source mapping. Marketing influenced includes opportunities linked to normalized pre-opportunity touches within 365 days. Blank-UTM web sessions are excluded.");
}

// 6 — journey roles
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 6, "Email opens journeys; 6sense appears later in linked paths", "Descriptive journey role—not proof that either channel caused the outcome.");
  const models = ["First-Touch", "Last-Touch", "Time-Decay"];
  const channels = [{ key: "email_mqa", label: "Email" }, { key: "6sense_display", label: "6sense display" }];
  const frame = chartCard(s, M, 205, 850, 405, "Attribution credit by journey model", "Pipeline in millions • linked opportunities only");
  s.charts.add("bar", { position: frame, categories: channels.map((c) => c.label), series: models.map((m, i) => ({ name: m, values: channels.map((c) => Number((sumBy(data.journey.filter((r) => r.channel === c.key), "attribution_model", "attributed_pipeline", m) / 1e6).toFixed(2))), fill: [C.blue, C.amber, C.teal][i], valuesFormatCode: "$0.0\"M\"" })), barOptions: { direction: "column", grouping: "clustered", gapWidth: 45 }, hasLegend: true, legend: { position: "bottom", overlay: false, textStyle: { fill: C.muted, fontSize: 11 } }, xAxis: { textStyle: { fill: C.ink, fontSize: 12, bold: true }, line: { style: "solid", fill: C.line, width: 1 } }, yAxis: { min: 0, numberFormatCode: "$0.0\"M\"", majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 10 } }, dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.navy, fontSize: 10, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  callout(s, 950, 210, 266, 170, "Observed pattern", "Email receives more first-touch credit. 6sense display receives more last-touch and time-decay credit within the linked subset.", C.blue, C.paleBlue);
  callout(s, 950, 400, 266, 210, "Next test", "After email engagement, randomize eligible strong-fit accounts into a 6sense overlay and holdout. Measure meetings, qualified opportunities, pipeline, and closed-deal quality.", C.amber, C.paleAmber);
  footer(s, 6);
  notes(s, ["data/integrated/attribution_results.parquet", "data/integrated/attribution_touchpoint_quality.parquet"], "Touchpoints are normalized to one account-channel presence per ISO week before first-touch, last-touch, linear, and time-decay allocation.");
}

// 7 — coverage
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 7, "The largest measurable opportunity is account coverage", "Reached-account opportunity rates are observational and include selection effects.");
  const order = ["Not Reached", "Email Only", "Both Channels", "6sense Only"];
  const rows = order.map((name) => byKey(data.coverage, "coverage_tier", name));
  const frame = chartCard(s, M, 205, 720, 405, "CRM account domains by tracked coverage", "Counts by normalized company domain");
  s.charts.add("bar", { position: frame, categories: order, series: [{ name: "Accounts", values: rows.map((r) => Number(r.accounts || 0)), fill: C.blue, points: [{ idx: 0, fill: C.amber }] }], barOptions: { direction: "bar", grouping: "clustered", gapWidth: 48 }, hasLegend: false, xAxis: { min: 0, majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 10 } }, yAxis: { textStyle: { fill: C.ink, fontSize: 12, bold: true }, line: { style: "solid", fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.navy, fontSize: 12, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  text(s, "Observed opportunity rate", 830, 215, 386, 28, { size: 16, bold: true, color: C.navy });
  rows.forEach((r, i) => {
    const y = 260 + i * 72;
    text(s, order[i], 830, y, 170, 24, { size: 13, bold: true, color: C.ink });
    text(s, pct(r.opp_rate || 0, 1), 1030, y - 3, 90, 30, { size: 23, bold: true, color: i === 0 ? C.amber : C.blue, align: "right" });
    text(s, `${pct(r.opp_rate_ci_low || 0, 0)}–${pct(r.opp_rate_ci_high || 0, 0)} 95% CI`, 940, y + 27, 180, 18, { size: 10, color: C.muted, align: "right" });
  });
  callout(s, 830, 550, 386, 88, "Test, do not infer", "Randomize strong-fit unreached accounts; use opportunity creation as the primary outcome.", C.amber, C.paleAmber);
  footer(s, 7);
  notes(s, ["data/integrated/account_coverage_summary.parquet"], "Coverage tier is based on tracked email and 6sense presence by normalized domain. Wilson intervals describe observed account-level opportunity rates; groups were not randomized.");
}

// 8 — email semantics
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 8, "Email data measures event composition—not campaign rates", "The supplied file contains engagement events, without sent or delivered counts.");
  const names = Object.keys(data.email.events); const vals = Object.values(data.email.events);
  const frame = chartCard(s, M, 205, 690, 405, "Recorded engagement-event mix", `${Number(data.email.event_total).toLocaleString()} event rows`);
  s.charts.add("doughnut", { position: frame, categories: names, series: [{ name: "Events", values: vals, fill: C.blue, points: [{ idx: 1, fill: C.amber }, { idx: 2, fill: C.teal }] }], hasLegend: true, legend: { position: "right", overlay: false, textStyle: { fill: C.muted, fontSize: 11 } }, doughnutOptions: { holeSize: 62, firstSliceAngle: 270 }, dataLabels: { showPercent: true, showCategoryName: false, textStyle: { fill: C.navy, fontSize: 11, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  kpi(s, 800, 205, 416, Number(data.email.engaged_people).toLocaleString(), "Unique engaged email addresses", "blue", "Deduplicated within the engagement log");
  kpi(s, 800, 335, 416, pct((data.email.events["Click events"] || 0) / data.email.event_total, 1), "Click-event share", "amber", "Clicks / all recorded engagement events");
  callout(s, 800, 465, 416, 145, "Measurement requirement", "Acquire sent, delivered, unique-open, unique-click, bounce, and unsubscribe denominators before publishing campaign reach, open rate, or CTR.", C.red, C.paleRed);
  footer(s, 8, "No send-based open or click rate is claimed");
  notes(s, ["data/cleaned/email_engagements.parquet", "outputs/analysis/email_campaign_performance.xlsx"], "Event shares divide event-type rows by all supplied engagement-event rows. They are not standard email rates and should not be benchmarked against campaign norms.");
}

// 9 — creative
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 9, "Creative efficiency must be compared within platform", "Delivery mechanics and baseline CTR differ between LinkedIn and 6sense.");
  const rows = [...data.creative].sort((a, b) => Number(b.ctr) - Number(a.ctr));
  const frame = chartCard(s, M, 205, 760, 405, "Weighted platform CTR", "Clicks / impressions across supplied creative rows");
  s.charts.add("bar", { position: frame, categories: rows.map((r) => String(r._platform)), series: [{ name: "CTR", values: rows.map((r) => Number((r.ctr * 100).toFixed(3))), fill: C.blue, points: rows.map((r, i) => ({ idx: i, fill: String(r._platform).toLowerCase().includes("linkedin") ? C.azure : C.amber })), valuesFormatCode: "0.000\"%\"" }], barOptions: { direction: "bar", grouping: "clustered", gapWidth: 55 }, hasLegend: false, xAxis: { min: 0, numberFormatCode: "0.00\"%\"", majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 10 } }, yAxis: { textStyle: { fill: C.ink, fontSize: 13, bold: true }, line: { style: "solid", fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.navy, fontSize: 12, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  callout(s, 855, 205, 361, 180, "Use for optimization", "Rank ads within each platform, require minimum impression volume, and evaluate downstream account engagement before scaling.", C.blue, C.paleBlue);
  callout(s, 855, 405, 361, 205, "Metadata gap", "Most 6sense delivery is labeled with unknown copy tone and asset metadata. Backfill taxonomy before claiming that a creative attribute drives performance.", C.amber, C.paleAmber);
  footer(s, 9);
  notes(s, ["data/integrated/creative_performance.parquet"], "Platform CTR is weighted clicks divided by impressions. The dashboard further limits creative ranking to the top five ads within each platform with at least 10,000 impressions.");
}

// 10 — model
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 10, "The model is a useful baseline—not an automated decision", "Time-based evaluation and feature-policy controls replace the prior lookahead-prone specification.");
  const m = data.model;
  kpi(s, M, 205, 255, Number(m.auc || 0).toFixed(3), "ROC AUC", "blue", "Time-based 80/20 holdout");
  kpi(s, 335, 205, 255, pct(m.precision || 0, 1), "Precision", "teal", "At the default threshold");
  kpi(s, 608, 205, 255, pct(m.recall || 0, 1), "Recall", "amber", "At the default threshold");
  kpi(s, 881, 205, 255, Number(m.brier_score || 0).toFixed(3), "Brier score", "white", `${Number(m.active_scored_rows || 0)} active opportunities scored`);
  const frame = chartCard(s, M, 350, 760, 275, "Opportunity-time feature importance", "Aggregated Random Forest importance");
  const fi = [...data.feature_importance].reverse();
  const labels = fi.map((r) => ({ channel_category: "Channel category", _amount: "Recorded amount", create_year: "Create year", segment__c: "CRM market segment", create_quarter: "Create quarter" }[r.feature] || r.feature));
  s.charts.add("bar", { position: frame, categories: labels, series: [{ name: "Importance", values: fi.map((r) => Number((r.importance * 100).toFixed(1))), fill: C.blue, valuesFormatCode: "0.0\"%\"" }], barOptions: { direction: "bar", grouping: "clustered", gapWidth: 45 }, hasLegend: false, xAxis: { min: 0, numberFormatCode: "0\"%\"", majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 10 } }, yAxis: { textStyle: { fill: C.ink, fontSize: 11 }, line: { style: "solid", fill: C.line, width: 1 } }, dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.navy, fontSize: 10, bold: true } }, chartFill: C.white, plotAreaFill: C.white });
  callout(s, 855, 350, 361, 275, "Leakage policy", "Uses channel, CRM market segment, recorded amount, and create-date features. Excludes current stage, present-day intent, account snapshots, and contact counts. Pilot probability bands with sales before setting a cutoff.", C.blue, C.paleBlue);
  footer(s, 10);
  notes(s, ["data/integrated/model_stats.parquet", "data/integrated/feature_importance.parquet", "data/integrated/win_probability.parquet"], "Preprocessing is fit on the earlier 80% training window and evaluated on the later 20% holdout. The final model scores active opportunities only after evaluation.");
}

// 11 — budget measurement plan
{
  const s = presentation.slides.add(); s.background.fill = C.bg; title(s, 11, "Use the budget to create evidence—not a false forecast", "Every plan preserves the same tracked-spend total.");
  const scenarios = ["Status Quo", "10% Holdout", "Measurement First"];
  const sums = (column) => scenarios.map((sc) => Number((data.budget.filter((r) => r.Scenario === sc).reduce((a, r) => a + Number(r[column] || 0), 0) / 1e6).toFixed(3)));
  const frame = chartCard(s, M, 205, 820, 405, "Budget-neutral operating plans", "Tracked spend in millions • no pipeline forecast");
  s.charts.add("bar", { position: frame, categories: scenarios, series: [{ name: "Activated media", values: sums("Active Spend ($)"), fill: C.blue }, { name: "Holdout reserve", values: sums("Holdout Reserve ($)"), fill: C.amber }, { name: "Experiment pool", values: sums("Experiment Pool ($)"), fill: C.teal }], barOptions: { direction: "column", grouping: "stacked", gapWidth: 50 }, hasLegend: true, legend: { position: "bottom", overlay: false, textStyle: { fill: C.muted, fontSize: 11 } }, xAxis: { textStyle: { fill: C.ink, fontSize: 11, bold: true }, line: { style: "solid", fill: C.line, width: 1 } }, yAxis: { min: 0, numberFormatCode: "$0.0\"M\"", majorGridlines: { style: "solid", fill: C.line, width: 1 }, textStyle: { fill: C.muted, fontSize: 10 } }, chartFill: C.white, plotAreaFill: C.white });
  callout(s, 930, 205, 286, 180, "Recommended", "Measurement First: activate 80%, reserve 10% as holdout, and use 10% for a pre-registered experiment pool.", C.teal, C.paleTeal);
  callout(s, 930, 405, 286, 205, "Scale gate", "Require incremental qualified opportunities or pipeline, stable closed-deal win rate, and clean spend/outcome reconciliation before expanding.", C.amber, C.paleAmber);
  footer(s, 11);
  notes(s, ["data/integrated/budget_scenarios.parquet", "outputs/analysis/budget_recommendation.xlsx"], "All scenarios preserve total tracked spend. No historical ROI is extrapolated because only two paid channels have spend and outcome evidence is insufficient.");
}

// 12 — operating plan
{
  const s = presentation.slides.add(); s.background.fill = C.navy;
  pill(s, "30 / 60 / 90", M, 38, 150, "#233957", "#BFD4FF");
  text(s, "Turn the analysis into a measurement system", M, 80, 1090, 56, { size: 36, bold: true, color: C.white });
  text(s, "The goal is not another dashboard refresh. It is a clean decision loop from data quality to experiment to scale.", M, 140, 1100, 40, { size: 17, color: "#CBD7E7" });
  callout(s, M, 220, 354, 300, "30 days  /  repair", "Backfill zero-amount won opportunities. Reconcile 6sense spend sources. Add sent/delivered email denominators. Freeze attribution definitions and owners.", C.red, "#1C2E49");
  callout(s, 463, 220, 354, 300, "60 days  /  test", "Randomize strong-fit unreached accounts. Test email-first outreach and a 6sense overlay. Pre-register outcomes, windows, exclusions, and stop rules.", C.amber, "#1C2E49");
  callout(s, 862, 220, 354, 300, "90 days  /  decide", "Scale only when incremental qualified pipeline is positive, closed-deal quality holds, and model score bands show stable conversion in production.", C.teal, "#1C2E49");
  text(s, "Gates", M, 565, 90, 24, { size: 13, bold: true, color: "#BFD4FF" });
  text(s, "CRM completeness  ≥ 95%  •  attribution coverage reported  •  holdout integrity verified  •  closed-win quality protected", 150, 552, 1060, 42, { size: 18, bold: true, color: C.white });
  text(s, "Bottom line  /  Targeted, measured growth can win—once the data can distinguish activity from incrementality.", M, 640, 1120, 28, { size: 14, bold: true, color: "#BFD4FF" });
  notes(s, ["data/integrated/data_quality_summary.parquet", "data/integrated/account_coverage_summary.parquet", "data/integrated/budget_scenarios.parquet", "data/integrated/model_stats.parquet"], "The operating plan converts current limitations into explicit remediation, experiment, and scale gates.");
}

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(renderDir, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(renderDir, `${stem}.layout.json`), await layout.text());
}
const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(renderDir, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(args.output);
console.log(`Saved ${presentation.slides.items.length} slides to ${args.output}`);
