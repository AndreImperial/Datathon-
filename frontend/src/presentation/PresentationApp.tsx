import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Clock3, ExternalLink, Expand, Grid2X2, Play, RotateCcw, Square, X } from "lucide-react";

import type { CaseSlide, CaseStudyData } from "../types";
import { formatField } from "../evidence";



import { applyCommand, elapsedAt, initialState, slideFromHash, storageRead, storageWrite, validCommand, validState, type DeckCommand, type SharedState } from "./deckState";

const readSession = () => { try { return storageRead(window.sessionStorage, "deck-session"); } catch { return null; } };
const newSession = () => globalThis.crypto?.randomUUID?.() ?? `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const persist = (key: string, value: string) => { try { return storageWrite(window.sessionStorage, key, value); } catch { return false; } };

function fmt(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`; }

function slideList(data: CaseStudyData, sequence: "main" | "appendix") { return data.presentation.slides.filter((slide) => slide.sequence === sequence).sort((a, b) => a.order - b.order); }



type Row = Record<string, unknown>;

const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

const label = (value: unknown) => value === null || value === undefined ? "Unavailable" : String(value).replaceAll("_", " ");

const count = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const dollars = (value: number) => value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Bars({ rows, name, value, format = count, detail }: { rows: Row[]; name: (row: Row) => string; value: string; format?: (n: number) => string; detail?: (row: Row) => string }) {

  const observedMax = Math.max(0, ...rows.map(row => Math.abs(numeric(row[value]) ?? 0)));
  const max = observedMax > 0 ? observedMax : 1;

  return <div className="slide-bars">{rows.length ? rows.map((row, index) => { const n = numeric(row[value]); return <div className="slide-bar" key={`${name(row)}-${index}`}><span>{name(row)}{detail && <small>{detail(row)}</small>}</span><i className={n !== null && n < 0 ? "negative" : ""}><b style={{ width: `${n === null ? 0 : Math.abs(n) / max * 100}%` }} /></i><strong>{n === null ? "Unavailable" : format(n)}</strong></div>; }) : <p>Evidence unavailable for this scope.</p>}</div>;

}

function evidenceValue(field: string, value: unknown): string {
  return formatField(field, value);
}
function EvidenceTable({ rows, fields }: { rows: Row[]; fields: string[] }) {

  return <div className="slide-table-wrap" tabIndex={0} role="region" aria-label="Slide evidence table; scroll for more rows and columns" data-evidence-scroll><table className="slide-table"><caption>Evidence values · {rows.length} records</caption><thead><tr>{fields.map(field => <th scope="col" key={field}>{label(field)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{fields.map(field => <td key={field}>{evidenceValue(field, row[field])}</td>)}</tr>)}</tbody></table>{!rows.length && <p>Evidence unavailable.</p>}</div>;

}

function AttributionEvidence({ rows }: { rows: Row[] }) {

  const models = Array.from(new Set(rows.map(row => String(row.model))));

  const windows = Array.from(new Set(rows.map(row => Number(row.lookback_days)))).sort((a,b) => a-b);

  const [model, setModel] = useState(models.includes("Linear") ? "Linear" : models[0] ?? "");

  const [windowDays, setWindowDays] = useState(windows.includes(365) ? 365 : windows[0]);

  const selected = rows.filter(row => row.model === model && row.lookback_days === windowDays);
  const population = selected[0]?.window_linked_population ?? selected[0]?.linked_opportunities;
  return <><div className="slide-evidence-filters"><label>Attribution model <select value={model} onChange={event => setModel(event.target.value)}>{models.map(item => <option key={item}>{item}</option>)}</select></label><label>Lookback <select value={windowDays} onChange={event => setWindowDays(Number(event.target.value))}>{windows.map(item => <option key={item} value={item}>{item} days</option>)}</select></label></div><p>Whole-window linked population: {population == null ? "unavailable" : String(population)} opportunities. This is shared across channels and must not be summed.</p><EvidenceTable rows={selected} fields={["model", "lookback_days", "channel", "attributed_amount"]} /></>;

}

function DecompositionEvidence({ rows }: { rows: Row[] }) {
  const dimensions = Array.from(new Set(rows.map(row => String(row.dimension))));
  const [dimension, setDimension] = useState(dimensions[0] ?? "");
  const selected = rows.filter(row => row.dimension === dimension);
  const components = ["mix_effect_pp", "within_effect_pp", "entry_exit_effect_pp"];
  const magnitude = Math.max(0, ...selected.flatMap(row => components.map(key => Math.abs(numeric(row[key]) ?? 0)))) || 1;
  return <><div className="slide-evidence-filters"><label>Grouping <select value={dimension} onChange={event => setDimension(event.target.value)}>{dimensions.map(item => <option key={item}>{item}</option>)}</select></label></div><div className="decomposition-legend">Mix · within common support · entry / exit (percentage points)</div><div className="decomposition-grid">{selected.map((row, index) => <section key={`${dimension}-${index}`}><b>{label(row.group)}</b>{components.map(key => { const n = numeric(row[key]); return <div className="signed-effect" key={key}><small>{label(key).replace(" effect pp", "")}</small><i><b className={n !== null && n < 0 ? "negative" : "positive"} style={{ left: `${n !== null && n < 0 ? 50 - Math.abs(n) / magnitude * 50 : 50}%`, width: `${n === null ? 0 : Math.abs(n) / magnitude * 50}%` }} /></i><strong>{n === null ? "N/A" : `${n > 0 ? "+" : ""}${n.toFixed(2)} pp`}</strong></div>; })}</section>)}</div></>;
}
function SlideVisual({ data, slide }: { data: CaseStudyData; slide: CaseSlide }) {

  const rows = (key: string): Row[] => data.datasets[key] ?? [];

  const panel = (title: string, content: React.ReactNode) => <section className="slide-visual"><h2 className="slide-visual-label">{title}</h2>{content}</section>;

  const channel = rows("channel_scorecard");

  const groups = rows("source_group_scorecard");

  switch (slide.id) {

    case "main-04": {

      const sum = (selected: Row[], key: string) => selected.reduce((total, row) => total + (numeric(row[key]) ?? 0), 0);
      const motions = ["Acquisition", "Existing customer"].map(motion => {

        const selected = channel.filter(row => row.scope === "All history" && row.business_motion === motion);

        return { motion, opportunities: selected.length ? sum(selected, "opportunities") : null, won: selected.length ? sum(selected, "won") : null, recorded_won_amount: selected.length ? sum(selected, "recorded_won_amount") : null, zero_amount_win_mrr: selected.length ? sum(selected, "zero_amount_win_mrr") : null };

      });

      return panel("All history · motion from account history", <><EvidenceTable rows={motions} fields={["motion", "opportunities", "won", "recorded_won_amount", "zero_amount_win_mrr"]} /><EvidenceTable rows={rows("motion_classification_coverage")} fields={["created_year", "acquisition_opportunities", "existing_customer_opportunities", "crm_type_coverage"]} /></>);

    }

    case "main-05": return panel("Acquisition · 2018–2024 · ranked recorded won amount", <Bars rows={groups.filter(row => row.scope === "All history" && row.ranked_channel === true).sort((a,b) => (numeric(b.recorded_won_amount) ?? -Infinity) - (numeric(a.recorded_won_amount) ?? -Infinity))} name={row => label(row.source_group)} value="recorded_won_amount" format={dollars} detail={row => `Won ${label(row.won)} / resolved ${label(row.resolved)} · win rate ${numeric(row.win_rate) === null ? "unavailable" : percent(Number(row.win_rate))} · MRR on zero-amount wins ${dollars(numeric(row.zero_amount_win_mrr) ?? 0)}/mo`} />);

    case "main-06": return panel("Acquisition · 2023–24 · resolved win rate by source", <Bars rows={groups.filter(row => row.scope === "2023–2024" && row.ranked_channel === true).sort((a,b) => (numeric(b.win_rate) ?? -Infinity) - (numeric(a.win_rate) ?? -Infinity))} name={row => label(row.source_group)} value="win_rate" format={percent} detail={row => `Won ${label(row.won)} / resolved ${label(row.resolved)} of ${label(row.opportunities)} · 95% interval ${numeric(row.win_rate_ci_low) === null ? "unavailable" : `${percent(Number(row.win_rate_ci_low))}–${percent(Number(row.win_rate_ci_high))}`} · ${label(row.evidence_status)}`} />);

    case "main-07": return panel("Signed percentage-point contributions · common support and entry / exit", <DecompositionEvidence rows={rows("conversion_decomposition")} />);

    case "main-08": return panel("Labeled creative bundles · observational CTR", <Bars rows={rows("creative_bundles")} name={row => ["_platform", "_copyassettype", "_copymessaging", "_copytone", "_ctacopysofthard"].map(key => label(row[key])).join(" / ")} value="ctr" format={n => `${(n * 100).toFixed(4)}%`} detail={row => `${label(row.ads)} ads · ${label(row.impressions)} impressions`} />);

    case "main-09": return <div className="slide-panels">{panel("Email · top 6 titles by unique clickers among engaged people", <Bars rows={[...rows("email_content")].sort((a,b) => (numeric(b.unique_clickers) ?? -Infinity) - (numeric(a.unique_clickers) ?? -Infinity)).slice(0,6)} name={row => label(row.content_title)} value="unique_clickers" detail={row => `${label(row.unique_engaged_people)} engaged people; delivery denominator unavailable`} />)}{panel("Website · recordings and observed visitors", <EvidenceTable rows={rows("web_content")} fields={["page_group", "unique_recordings", "unique_visitors", "recordings_with_observed_contact_activity"]} />)}</div>;

    case "main-10": return panel("Exclusive source / touch overlap groups", <Bars rows={rows("attribution_overlap")} name={row => label(row.overlap_group)} value="opportunities" />);

    case "main-11": return <div className="slide-panels">{panel("Attribution · model and lookback window kept explicit", <AttributionEvidence rows={rows("attribution_model_sensitivity")} />)}{panel("Observed journeys · resolved denominator", <EvidenceTable rows={rows("journey_outcomes")} fields={["sequence", "resolved_opportunities", "wins", "win_rate"]} />)}</div>;

    case "main-12": return <div className="slide-panels">{panel("Domain exclusions", <Bars rows={rows("audience_exclusions")} name={row => label(row.exclusion)} value="domains" />)}{panel("Eligible audience priority · domain grain", <EvidenceTable rows={rows("audience_priority")} fields={["segment_fit", "eligible_domains", "resolved", "win_rate", "status"]} />)}</div>;

    case "main-13": case "main-16": return <div className="slide-decision-cards">{data.recommendations.map(item => <section key={item.id}><small>{item.confidence_status}</small><h2>{item.decision}</h2><p>{item.immediate_next_step}</p><p><b>Owner:</b> {item.owner_role}</p><p><b>Measure:</b> {item.primary_success_measure}</p><p><b>Scale / stop:</b> {item.scale_stop_rule}</p><p className="decision-limit">{item.evidence_limitations.join(" · ")}</p></section>)}</div>;

    case "main-14": return panel("Hypothetical power scenarios · required vs available audience", <EvidenceTable rows={rows("experiment_scenarios")} fields={["scenario", "required_per_arm", "required_total", "eligible_audience", "feasibility", "assumption"]} />);

    case "main-15": return panel("Budget planning inputs are unavailable", <div className="slide-statement"><h2>Planning formula</h2><p>Required treatment accounts × cost per treatment account + fixed implementation cost.</p><p>Cost per treatment account, fixed cost and approved budget were not supplied. No dollar allocation is supported. Confirm costs and choose a feasible audience / lift scenario before committing spend.</p></div>);

    default: return slide.chart_refs.length ? <div className="slide-panels">{slide.chart_refs.map(ref => <section className="slide-visual" key={ref}><h2 className="slide-visual-label">{label(ref)}</h2>{ref === "source_coverage" ? <EvidenceTable rows={rows(ref)} fields={["source", "min_timestamp", "max_timestamp", "rows", "usable_touchpoints", "rule"]} /> : <EvidenceTable rows={rows(ref)} fields={Array.from(new Set(rows(ref).flatMap(row => Object.keys(row))))} />}</section>)}</div> : <div className="slide-statement"><span>{slide.sequence === "appendix" ? "METHODS AND LIMITATIONS" : "DECISION BRIEF"}</span><p>{slide.body}</p></div>;

  }

}



export function PresentationApp({ data, presenter = false }: { data: CaseStudyData; presenter?: boolean }) {
  const main = useMemo(() => slideList(data, "main"), [data]);
  const appendix = useMemo(() => slideList(data, "appendix"), [data]);
  const identities = useMemo(() => [...main, ...appendix], [main, appendix]);
  const session = useMemo(() => (presenter ? /^#presenter\/([a-zA-Z0-9-]+)$/.exec(location.hash)?.[1] : undefined) || readSession() || newSession(), [presenter]);
  const storageKey = `deck-state-${session}-${data.meta.snapshot_id}`;
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [state, setState] = useState<SharedState>(() => {
    let saved: unknown;
    try { saved = JSON.parse(storageRead(window.sessionStorage, storageKey) ?? "null"); } catch { saved = null; }
    const base = validState(saved, identities) ? saved : initialState(identities);
    const route = !presenter ? slideFromHash(location.hash, identities) : undefined;
    return route ? { ...base, slideId: route.id, sequence: route.sequence } : base;
  });
  const stateRef = useRef(state); stateRef.current = state;
  const [elapsed, setElapsed] = useState(() => elapsedAt(state, Date.now()));
  const [overview, setOverview] = useState(false);
  const [connection, setConnection] = useState<"waiting" | "connected" | "stale" | "unavailable">("waiting");
  const channel = useRef<BroadcastChannel | null>(null);
  const lastContact = useRef(0);
  const controllerId = useRef(newSession());
  const commandCounter = useRef(0);
  const lastCommands = useRef(new Map<string, number>());
  const overviewFocus = useRef<HTMLElement | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  const openOverview = () => { overviewFocus.current = document.activeElement as HTMLElement; setOverview(true); };
  useEffect(() => { if (surface.current) surface.current.inert = overview; if (!overview) overviewFocus.current?.focus(); }, [overview]);
  const slides = state.sequence === "main" ? main : appendix;
  const currentIndex = Math.max(0, slides.findIndex(x => x.id === state.slideId));
  const current = slides[currentIndex] || main[0];
  const send = (payload: Record<string, unknown>) => channel.current?.postMessage({ ...payload, session, snapshotId: data.meta.snapshot_id });
  const command = (cmd: DeckCommand) => {
    if (presenter) { if (connection === "connected") send({ type: "command", command: cmd, controllerId: controllerId.current, commandId: ++commandCounter.current }); }
    else setState(previous => applyCommand(previous, cmd, identities, Date.now()));
  };
  useEffect(() => {
    setStorageAvailable(persist("deck-session", session));
    let bus: BroadcastChannel;
    try { bus = new BroadcastChannel(`datathon-deck-${session}`); } catch { setConnection("unavailable"); return; }
    channel.current = bus;
    const publish = () => bus.postMessage({ type: "state", session, snapshotId: data.meta.snapshot_id, state: stateRef.current });
    const receive = (event: MessageEvent) => {
      const p = event.data;
      if (!p || p.session !== session || p.snapshotId !== data.meta.snapshot_id) return;
      if (presenter && p.type === "state" && validState(p.state, identities)) {
        lastContact.current = Date.now(); setConnection("connected");
        setState(previous => p.state.revision >= previous.revision ? p.state : previous);
      } else if (!presenter && p.type === "hello") { publish(); }
      else if (!presenter && p.type === "command" && typeof p.controllerId === "string" && Number.isSafeInteger(p.commandId) && validCommand(p.command)) {
        const seen = lastCommands.current.get(p.controllerId) ?? 0;
        if (p.commandId <= seen) return;
        lastCommands.current.set(p.controllerId, p.commandId);
        setState(previous => applyCommand(previous, p.command, identities, Date.now()));
      } else if (presenter && p.type === "bye") setConnection("stale");
    };
    bus.addEventListener("message", receive);
    if (presenter) bus.postMessage({ type: "hello", session, snapshotId: data.meta.snapshot_id }); else publish();
    const heartbeat = window.setInterval(() => {
      if (presenter) { if (lastContact.current && Date.now() - lastContact.current > 3500) setConnection("stale"); bus.postMessage({ type: "hello", session, snapshotId: data.meta.snapshot_id }); }
      else publish();
    }, 1000);
    const departing = () => { if (!presenter) bus.postMessage({ type: "bye", session, snapshotId: data.meta.snapshot_id }); };
    window.addEventListener("pagehide", departing);
    return () => { departing(); clearInterval(heartbeat); window.removeEventListener("pagehide", departing); bus.close(); channel.current = null; };
  }, [session, data.meta.snapshot_id, presenter, identities]);
  useEffect(() => {
    setStorageAvailable(persist(storageKey, JSON.stringify(state)));
    if (!presenter) {
      history.replaceState(null, "", `#present/${state.slideId}`);
      send({ type: "state", state });
    }
  }, [state, presenter, storageKey]);
  useEffect(() => {
    if (presenter) return;
    const route = () => {
      const selected = slideFromHash(location.hash, identities);
      if (selected) setState(previous => selected.id === previous.slideId ? previous : applyCommand(previous, { kind: "go", slideId: selected.id }, identities, Date.now()));
      else if (location.hash.startsWith("#present/")) history.replaceState(null, "", `#present/${stateRef.current.slideId}`);
    };
    route(); window.addEventListener("hashchange", route); return () => window.removeEventListener("hashchange", route);
  }, [presenter, identities]);
  useEffect(() => { const tick = () => setElapsed(elapsedAt(stateRef.current, Date.now())); tick(); const id = window.setInterval(tick, 250); return () => clearInterval(id); }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && overview) { event.preventDefault(); setOverview(false); return; }
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest("button,a,input,textarea,select,[contenteditable],[data-evidence-scroll]")) return;
      if (overview && event.key !== "Escape") return;
      const keys: Record<string, DeckCommand> = { ArrowRight: {kind:"next"}, PageDown: {kind:"next"}, " ": {kind:"next"}, ArrowLeft: {kind:"previous"}, PageUp: {kind:"previous"}, Home: {kind:"first"}, End: {kind:"last"} };
      if (keys[event.key]) { event.preventDefault(); command(keys[event.key]); }
      if (event.key.toLowerCase() === "o" && !presenter) openOverview();
      if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (event.key === "Escape") { if (overview) setOverview(false); else if (document.fullscreenElement) document.exitFullscreen(); else location.hash = "#s-summary"; }
    };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [overview, presenter, connection, identities]);
  const timerButtons = <><button disabled={presenter && connection !== "connected"} onClick={() => command({kind: state.timerStatus === "running" ? "pause" : "start"})}>{state.timerStatus === "running" ? <Square /> : <Play />} {state.timerStatus === "running" ? "Pause timer" : "Start timer"}</button><button disabled={presenter && connection !== "connected"} onClick={() => command({kind:"reset"})}><RotateCcw /> Reset timer</button></>;
  const limitation = !storageAvailable ? <p role="status">Session storage is unavailable. This view works, but refresh cannot restore its timer.</p> : null;
  if (presenter) return <main className="presenter-console" tabIndex={0} aria-label="Presenter keyboard controls"><header><span className="signal" data-status={connection} /> Presenter console <small role="status">{connection === "unavailable" ? "Cross-window control unavailable; use audience controls." : `Audience ${connection}`} · session {session.slice(0,8)}</small></header>{limitation}<section className="presenter-current"><p>NOW · {state.sequence.toUpperCase()} {currentIndex + 1}</p><h1>{current?.title}</h1><div className="timer"><Clock3 /> {fmt(elapsed / 1000)} <small>/ {fmt(data.presentation.target_duration_seconds)}</small></div></section><section className="presenter-notes"><h2>Speaker notes</h2><p><b>Say:</b> {current?.speaker_notes.say}</p><p><b>Do not claim:</b> {current?.speaker_notes.do_not_claim}</p><p><b>Likely question:</b> {current?.speaker_notes.judge_question}</p><p><b>Answer:</b> {current?.speaker_notes.answer}</p></section><footer><button disabled={connection !== "connected" || currentIndex === 0} onClick={() => command({kind:"previous"})}><ChevronLeft /> Back</button><button disabled={connection !== "connected" || currentIndex === slides.length - 1} className="red" onClick={() => command({kind:"next"})}>Next <ChevronRight /></button>{timerButtons}</footer></main>;
  return <main className="presentation-shell" tabIndex={0} aria-label="Presentation keyboard controls"><div ref={surface}><header className="presentation-header"><a href="#s-summary" className="wordmark">REVENUE <span>COMMAND</span> / CMO BRIEF</a><span>{state.sequence === "main" ? `MAIN ${currentIndex + 1} / ${main.length}` : `APPENDIX ${currentIndex + 1} / ${appendix.length}`}</span><div><button aria-label="Overview" onClick={openOverview}><Grid2X2 /></button><button aria-label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}><Expand /></button><a aria-label="Open presenter console" href={`${location.pathname}#presenter/${session}`} target="_blank" rel="noopener"><ExternalLink /> Presenter</a><a href="#s-summary" aria-label="Exit presentation"><X /></a></div></header>{limitation}<article className="slide-canvas" aria-label={`Slide ${current?.order}: ${current?.title}`}><div className="slide-kicker">{current?.scope}</div><h1>{current?.title}</h1><p className="slide-body">{current?.body}</p><SlideVisual data={data} slide={current} /><div className="slide-caveat">{current?.visible_caveat}</div><footer>{current?.source_footer}<span>{data.meta.snapshot_id}</span></footer></article><nav className="presentation-controls"><button disabled={currentIndex === 0} onClick={() => command({kind:"previous"})}><ChevronLeft /> Previous</button>{state.sequence === "main" && currentIndex === main.length - 1 ? <button onClick={openOverview}>Appendix <Grid2X2 /></button> : <button className="red" disabled={currentIndex === slides.length - 1} onClick={() => command({kind:"next"})}>Next <ChevronRight /></button>}<span aria-label="Elapsed presentation time">{fmt(elapsed / 1000)} / {fmt(data.presentation.target_duration_seconds)}</span>{timerButtons}</nav></div>{overview && <div className="slide-overview" role="dialog" aria-modal="true" aria-labelledby="overview-title" onKeyDown={event => { if (event.key === "Tab") { const elements = event.currentTarget.querySelectorAll<HTMLButtonElement>("button"); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}><button autoFocus aria-label="Close slide overview" className="close" onClick={() => setOverview(false)}><X /></button><h2 id="overview-title">Slide overview</h2><div>{identities.map(slide => <button key={slide.id} onClick={() => { command({kind:"go",slideId:slide.id}); setOverview(false); }}><small>{slide.sequence} {slide.order}</small>{slide.title}</button>)}</div></div>}</main>;
}
