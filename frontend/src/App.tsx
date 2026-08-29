import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Check, CircleAlert, Download, Menu, Presentation, Target, X } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatedSectionNav, PointerSpotlight } from "./components/AceternityMotion";
import type { DashboardData } from "./types";

const TremorChart = lazy(() => import("./components/TremorChart"));

gsap.registerPlugin(ScrollTrigger);

const sections = [
  { id: "overview", label: "Decision brief" },
  { id: "attribution", label: "Attribution" },
  { id: "coverage", label: "Coverage" },
  { id: "quality", label: "Evidence quality" },
  { id: "measurement", label: "Measurement" },
  { id: "recommendation", label: "Action plan" },
];

const money = (value: number) => `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function downloadCsv(data: DashboardData) {
  const rows = [["section", "dimension", "value"], ...data.channel_pipeline.flatMap((row) => [
    ["channel_pipeline", String(row.channel_category), String(row.total_pipeline)],
    ["channel_win_rate", String(row.channel_category), String(row.win_rate)],
  ]), ...data.attribution.filter((row) => row.attribution_model === "First-Touch").map((row) => ["first_touch_attribution", String(row.channel), String(row.attributed_pipeline)]),
  ...data.coverage.map((row) => ["account_coverage", String(row.coverage_tier), String(row.opp_rate)]),
  ...data.cohorts.filter((row) => row.is_mature === true).map((row) => ["mature_cohort_win_rate", String(row.quarter), String(row.win_rate)]),
  ...Object.entries(data.context.metrics).filter(([key]) => ["domain_match_rate", "zero_amount_won_share", "unknown_channel_pct", "attribution_linked_won_share"].includes(key)).map(([key, value]) => ["evidence_quality", key, value])];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "marketing-dashboard-evidence.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function AccessibleTable({ caption, data, index, value }: { caption: string; data: Array<Record<string, string | number>>; index: string; value: string }) {
  return <table className="sr-only"><caption>{caption}</caption><thead><tr><th>{labelize(index)}</th><th>{labelize(value)}</th></tr></thead><tbody>{data.map((row, position) => <tr key={`${row[index]}-${position}`}><th>{row[index]}</th><td>{row[value]}</td></tr>)}</tbody></table>;
}

function ChartFallback() { return <div className="chart chart-fallback" aria-hidden="true">Loading chart…</div>; }

function Progress({ value, tone }: { value: number; tone: string }) {
  return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span className={`progress__fill progress__fill--${tone}`} style={{ width: `${value}%` }} /></div>;
}

function FigureHeader({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <header className="figure-header">
      <div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>
      <p>{note}</p>
    </header>
  );
}

function App() {
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    fetch("./dashboard-data.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Dashboard data returned ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard data"));
  }, []);

  useEffect(() => {
    if (!data || !root.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (!reduceMotion) {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.fromTo(element, { autoAlpha: 0, y: 14 }, {
            autoAlpha: 1, y: 0, duration: 0.42, ease: "power1.out",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        });
      }
      sections.forEach(({ id }) => {
        ScrollTrigger.create({
          trigger: `#${id}`,
          start: "top 35%",
          end: "bottom 35%",
          onToggle: (self) => self.isActive && setActive(id),
        });
      });
    }, root);
    return () => ctx.revert();
  }, [data]);

  useEffect(() => {
    document.body.classList.toggle("presentation-mode", presenting);
    window.setTimeout(() => ScrollTrigger.refresh(), 220);
    return () => document.body.classList.remove("presentation-mode");
  }, [presenting]);

  useEffect(() => {
    if (!menuOpen) return;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      if (event.key === "Tab") {
        const drawer = document.getElementById("dashboard-navigation");
        const focusable = drawer ? Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const charts = useMemo(() => {
    if (!data) return null;
    const channel = [...data.channel_pipeline]
      .sort((a, b) => Number(b.total_pipeline) - Number(a.total_pipeline))
      .map((row) => ({ channel: labelize(String(row.channel_category)), "Pipeline ($M)": Number(row.total_pipeline) / 1_000_000 }));
    const cohorts = data.cohorts.filter((row) => String(row.quarter) >= "2022Q1" && row.is_mature === true).map((row) => ({
      quarter: String(row.quarter), "Closed-deal win rate": Number(row.win_rate) * 100,
    }));
    const coverage = data.coverage.map((row) => ({
      tier: labelize(String(row.coverage_tier)), "Opportunity rate": Number(row.opp_rate) * 100,
    }));
    const attribution = data.attribution.filter((row) => row.attribution_model === "First-Touch").sort((a, b) => Number(b.attributed_pipeline) - Number(a.attributed_pipeline)).slice(0, 7).map((row) => ({
      channel: labelize(String(row.channel)), "Influenced pipeline ($M)": Number(row.attributed_pipeline) / 1_000_000,
    }));
    return { channel, cohorts, coverage, attribution };
  }, [data]);

  if (error) return <main className="load-state"><CircleAlert /><h1>Dashboard data did not load.</h1><p>{error}</p></main>;
  if (!data || !charts) return <main className="load-state"><span className="loader" /><p>Loading validated evidence…</p></main>;

  const metrics = data.context.metrics;
  const coverageMix = [
    { name: "Unreached", value: Number(metrics.unreached_accounts.replaceAll(",", "")) },
    { name: "Reached", value: Number(metrics.target_accounts.replaceAll(",", "")) - Number(metrics.unreached_accounts.replaceAll(",", "")) },
  ];

  return (
    <div ref={root} className="app-shell">
      <aside id="dashboard-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand"><span>MA</span><div><strong>Marketing Analytics</strong><small>Decision system · {data.meta.period}</small></div></div>
        <button ref={closeButton} className="sidebar-close" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X /></button>
        <AnimatedSectionNav items={sections} active={active} />
        <div className="sidebar-note"><Check size={16} /><span>Evidence refreshed from validated Parquet outputs</span></div>
      </aside>

      <main id="main-content" aria-hidden={menuOpen || undefined}>
        <div className="mobile-bar"><button ref={menuButton} onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="dashboard-navigation"><Menu /></button><strong>Decision brief</strong></div>

        <PointerSpotlight className="hero" >
          <div id="overview" className="hero__content" data-reveal>
            <div className="hero__topline"><span className="badge badge--blue">Executive recommendation</span><span>2018–2024 · 3,288 opportunities</span></div>
            <h1>Targeted growth is credible. <em>Blanket scaling is not—yet.</em></h1>
            <p className="hero__dek">Marketing is associated with meaningful pipeline, but attribution coverage and revenue completeness limit causal confidence. Expand strong-fit account coverage, then prove incremental lift with holdouts.</p>
            <div className="hero__actions">
              <a className="button button--primary" href="#recommendation">See the action plan <ArrowDown size={17} /></a>
              <button className="button" onClick={() => setPresenting((value) => !value)} aria-pressed={presenting}><Presentation size={17} /> {presenting ? "Exit presentation" : "Presentation view"}</button>
              <button className="button button--quiet" onClick={() => downloadCsv(data)}><Download size={17} /> Export evidence</button>
            </div>
          </div>
          <div className="evidence-ledger" data-reveal>
            <div className="ledger-lead"><span>Total pipeline</span><strong>{metrics.total_pipeline}</strong><small>{metrics.total_opportunities} opportunities</small></div>
            <div><span>Won revenue</span><strong>{metrics.won_revenue}</strong><small>{metrics.closed_deal_win_rate} closed-deal win rate</small></div>
            <div><span>Marketing sourced</span><strong>{metrics.marketing_sourced_pipeline}</strong><small>{metrics.marketing_sourced_share} of pipeline</small></div>
            <div><span>Influenced signal</span><strong>{metrics.marketing_influenced_pipeline}</strong><small>Only {metrics.attribution_linked_won_share} of wins linked</small></div>
          </div>
        </PointerSpotlight>

        <section className="story-band" data-reveal aria-label="Decision logic">
          <p><strong>Signal</strong> Email-reached accounts show a {metrics.email_only_opportunity_rate} opportunity rate versus {metrics.not_reached_opportunity_rate} when unreached.</p>
          <ArrowUpRight aria-hidden="true" />
          <p><strong>Constraint</strong> {metrics.unreached_pct} of target accounts are unreached, while attribution links just {metrics.attribution_linked_won_share} of wins.</p>
          <ArrowUpRight aria-hidden="true" />
          <p><strong>Decision</strong> Expand targeted coverage and run a holdout—not a broad budget increase.</p>
        </section>

        <section className="content-section" data-reveal>
          <div className="section-heading"><p className="eyebrow">01 · Pipeline composition</p><h2>Most pipeline sits outside cleanly attributable channels.</h2><p>The “Other” and existing-client categories dominate. Treat channel comparisons as a prioritization signal, not a causal leaderboard.</p></div>
          <div className="chart-card">
            <FigureHeader eyebrow="Pipeline by CRM channel" title="Concentration is the first analytical constraint" note="USD millions · sorted descending" />
            <Suspense fallback={<ChartFallback />}><TremorChart variant="pipeline" data={charts.channel} /></Suspense>
            <AccessibleTable caption="Pipeline by CRM channel in USD millions" data={charts.channel} index="channel" value="Pipeline ($M)" />
          </div>
        </section>

        <section id="attribution" className="content-section content-section--split" data-reveal>
          <div className="section-heading"><p className="eyebrow">02 · Attribution</p><h2>Influence is visible, but linkage is selective.</h2><p>A 365-day first-touch view associates {metrics.marketing_influenced_pipeline} with eligible pre-opportunity engagement. Only {metrics.linked_won_opportunities} won opportunities are linked, so this is journey context—not proof of incrementality.</p><div className="confidence-callout"><CircleAlert size={18} /><span><strong>{metrics.attribution_linked_won_share} linked-win coverage.</strong> Use sourced pipeline for conservative credit and influenced pipeline for context.</span></div></div>
          <div className="chart-card">
            <FigureHeader eyebrow="First-touch influenced pipeline" title="Where linked journeys begin" note="Linked subset only · USD millions" />
            <Suspense fallback={<ChartFallback />}><TremorChart variant="attribution" data={charts.attribution} /></Suspense>
            <AccessibleTable caption="First-touch influenced pipeline by channel in USD millions" data={charts.attribution} index="channel" value="Influenced pipeline ($M)" />
          </div>
        </section>

        <section id="coverage" className="content-section" data-reveal>
          <div className="section-heading"><p className="eyebrow">03 · Account coverage</p><h2>The clearest growth lever is reach—not spend.</h2><p>{metrics.unreached_accounts} of {metrics.target_accounts} target accounts have neither tracked email nor 6sense coverage. The association with opportunity creation is large enough to test, but not yet causal.</p></div>
          <div className="coverage-grid">
            <div className="chart-card">
              <FigureHeader eyebrow="Opportunity rate by coverage" title="Reached accounts convert to opportunity more often" note="Observed association · 95% CIs in source table" />
              <Suspense fallback={<ChartFallback />}><TremorChart variant="coverage" data={charts.coverage} /></Suspense>
              <AccessibleTable caption="Opportunity rate by account coverage tier in percent" data={charts.coverage} index="tier" value="Opportunity rate" />
            </div>
            <div className="coverage-card">
              <div><p className="eyebrow">Coverage gap</p><strong>{metrics.unreached_pct}</strong><span>of target accounts unreached</span></div>
              <Suspense fallback={<ChartFallback />}><TremorChart variant="mix" data={coverageMix} /></Suspense>
              <AccessibleTable caption="Reached and unreached target accounts" data={coverageMix} index="name" value="value" />
              <p>Start with strong-fit unreached accounts. Use email as the base treatment and test 6sense as an overlay.</p>
            </div>
          </div>
        </section>

        <section id="quality" className="content-section evidence-section" data-reveal>
          <div className="section-heading"><p className="eyebrow">04 · Evidence quality</p><h2>The analysis is decision-ready—with explicit limits.</h2><p>Strong entity matching supports segmentation. Missing won amounts and selective touch linkage weaken revenue and attribution claims.</p></div>
          <div className="quality-ledger">
            <div><span>Domain match rate</span><strong>{metrics.domain_match_rate}</strong><Progress value={96.4} tone="teal" /><small>Strong basis for account-level joins</small></div>
            <div><span>Won deals with zero amount</span><strong>{metrics.zero_amount_won_share}</strong><Progress value={65.3} tone="amber" /><small>Won revenue and revenue ROI are understated</small></div>
            <div><span>Unknown CRM channel</span><strong>{metrics.unknown_channel_pct}</strong><Progress value={34.1} tone="amber" /><small>Limits channel-level diagnosis</small></div>
            <div><span>Attribution-linked wins</span><strong>{metrics.attribution_linked_won_share}</strong><Progress value={11.7} tone="red" /><small>Influence applies to a selective subset</small></div>
          </div>
        </section>

        <section id="measurement" className="content-section content-section--split" data-reveal>
          <div className="section-heading"><p className="eyebrow">05 · Trend and model</p><h2>Quality is softening, and prioritization can help.</h2><p>Mature cohort closed-deal win rate moves from {metrics.cohort_start_win_rate} in {metrics.cohort_start_quarter} to {metrics.cohort_end_win_rate} in {metrics.cohort_end_quarter}. The time-based model reaches {metrics.model_auc} AUC—useful for ranking, not forecasting certainty.</p><div className="model-stamp"><Target /><div><strong>{metrics.active_scored_opportunities} active opportunities scored</strong><span>Time-based 80/20 holdout; preprocessing fit on train only</span></div></div></div>
          <div className="chart-card">
            <FigureHeader eyebrow="Mature cohort performance" title="Closed-deal win rate has declined" note="Percent · resolved outcomes only" />
            <Suspense fallback={<ChartFallback />}><TremorChart variant="cohort" data={charts.cohorts} /></Suspense>
            <AccessibleTable caption="Mature cohort closed-deal win rate in percent" data={charts.cohorts} index="quarter" value="Closed-deal win rate" />
          </div>
        </section>

        <section id="recommendation" className="action-section" data-reveal>
          <div className="action-section__intro"><span className="badge badge--amber">Recommended decision</span><h2>{data.context.recommendation.headline}</h2><p>Approve a measured coverage expansion with explicit treatment and holdout groups. Keep channel budgets stable until lift is demonstrated.</p></div>
          <ol className="action-list">
            {data.context.recommendation.actions.map((action, index) => <li key={action}><span>{String(index + 1).padStart(2, "0")}</span><p>{action}</p></li>)}
          </ol>
          <div className="experiment-strip"><strong>90-day proof plan</strong><span>Baseline → randomized coverage → opportunity/pipeline lift → quality guardrails → scale decision</span></div>
        </section>

        <section className="method-section" data-reveal>
          <div><p className="eyebrow">Method and caveats</p><h2>Read every number in context.</h2></div>
          <ul>{data.context.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
        </section>

        <footer><span>Marketing Analytics Decision System</span><span>Source: validated integrated datasets · {data.meta.methodology}</span></footer>
      </main>
    </div>
  );
}

export default App;
