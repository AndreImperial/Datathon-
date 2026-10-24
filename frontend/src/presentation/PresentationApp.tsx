import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ChevronLeft, ChevronRight, Clock3, ExternalLink, Expand, Grid2X2, Play, RotateCcw, Square, X } from "lucide-react";

import type { CaseStudyData } from "../types";
import "./deck.css";

import { applyCommand, cutOf, cutSlides, CUTS, elapsedAt, EXECUTIVE_TIMING, initialState, slideFromHash, storageRead, storageWrite, validCommand, validState, type Cut, type DeckCommand, type SharedState } from "./deckState";
import { readableSources, SECTIONS, sectionFor } from "./labels";
import { actionTitle, BIG_IDEA, EvidenceDrawer, evidenceFor, pilotDesign, SlideVisual, transitionFor } from "./slides";

/** First section of the dashboard (App.tsx); used by the exit link and Escape. */
const DASHBOARD_HASH = "#s-essential";
/** Logical stage size; the slide is laid out at this size and scaled to fit. */
const STAGE_W = 1280;
const STAGE_H = 720;
/** Below this frame width the slide reflows instead of scaling (phones). */
const FLOW_BREAKPOINT = 760;
/** Target of the page-level skip link in index.html; the deck's <main> carries it. */
const MAIN_ID = "main-content";
/** Slides whose authored body only restates the action title and the visual; it stays in the presenter's "Say" note. */
const BODY_REPEATS_HEADLINE = new Set(["main-02", "main-13", "main-16"]);
/** With a pilot design in the contract, these slides' authored body describes the older scenario framing; the pilot visual replaces it. */
const PILOT_SLIDES = new Set(["main-14", "main-15"]);

const readSession = () => { try { return storageRead(window.sessionStorage, "deck-session"); } catch { return null; } };
const newSession = () => globalThis.crypto?.randomUUID?.() ?? `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const persist = (key: string, value: string) => { try { return storageWrite(window.sessionStorage, key, value); } catch { return false; } };

function fmt(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`; }

function slideList(data: CaseStudyData, sequence: "main" | "appendix") { return data.presentation.slides.filter((slide) => slide.sequence === sequence).sort((a, b) => a.order - b.order); }

const CUT_NAMES: Record<Cut, string> = { full: "Full", executive: "Executive" };

/** Full / Executive switch. Shown in the deck header, the overview and the presenter console. */
function CutToggle({ cut, minutes, onChange, disabled = false, className = "" }: { cut: Cut; minutes: Record<Cut, number>; onChange: (cut: Cut) => void; disabled?: boolean; className?: string }) {
  return <div role="group" aria-label="Presentation length" className={`deck-cut ${className}`.trim()}>{CUTS.map(option => <button key={option} type="button" aria-pressed={option === cut} disabled={disabled} onClick={() => onChange(option)}>{CUT_NAMES[option]}<span aria-hidden="true"> · </span><small>{minutes[option]} min</small></button>)}</div>;
}

/** Scale factor that fits a STAGE_W × STAGE_H slide into the frame, or null for reflow mode. */
function useStageScale(frame: React.RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState<number | null>(1);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (!(width > 0) || !(height > 0)) return;
      setScale(width < FLOW_BREAKPOINT ? null : Math.min(width / STAGE_W, height / STAGE_H));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame]);
  return scale;
}

export function PresentationApp({ data, presenter = false }: { data: CaseStudyData; presenter?: boolean }) {
  const main = useMemo(() => slideList(data, "main"), [data]);
  const appendix = useMemo(() => slideList(data, "appendix"), [data]);
  const identities = useMemo(() => [...main, ...appendix], [main, appendix]);
  /** Takeaway headline per slide (main slides); the authored title becomes the kicker topic. */
  const headlines = useMemo(() => new Map(identities.map(slide => [slide.id, actionTitle(data, slide)])), [data, identities]);
  const hasPilot = useMemo(() => pilotDesign(data) !== null, [data]);
  /** Main-deck sections in order with their slide counts, for the segmented progress bar. */
  const sectionRuns = useMemo(() => SECTIONS.map(name => ({ name, slides: main.filter(slide => sectionFor("main", slide.order) === name) })).filter(run => run.slides.length), [main]);
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
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLElement | null>(null);
  const scale = useStageScale(frame);
  const openOverview = () => { overviewFocus.current = document.activeElement as HTMLElement; setOverview(true); };
  useEffect(() => { if (surface.current) surface.current.inert = overview; if (!overview) overviewFocus.current?.focus(); }, [overview]);
  const cut = cutOf(state);
  /** Main slides on the active cut's path; the full deck is the default. */
  const mainPath = useMemo(() => cutSlides(main, "main", cut), [main, cut]);
  const pathRuns = useMemo(() => sectionRuns.map(run => ({ ...run, slides: run.slides.filter(slide => mainPath.includes(slide)) })).filter(run => run.slides.length), [sectionRuns, mainPath]);
  const slides = state.sequence === "main" ? mainPath : appendix;
  const current = identities.find(x => x.id === state.slideId) || main[0];
  /** Position on the active path, or -1 for a main slide the cut skips (still reachable by URL). */
  const pathIndex = slides.findIndex(x => x.id === current?.id);
  const currentIndex = Math.max(0, pathIndex);
  const deckPosition = (id: string | undefined) => identities.findIndex(x => x.id === id);
  const hasPrevious = slides.some(x => deckPosition(x.id) < deckPosition(current?.id));
  const hasNext = slides.some(x => deckPosition(x.id) > deckPosition(current?.id));
  // Timing follows the cut: the executive cut has its own seconds per slide; the full deck uses the authored ones.
  const fullTarget = data.presentation.target_duration_seconds;
  const executiveTarget = Object.values(EXECUTIVE_TIMING).reduce((total, seconds) => total + seconds, 0);
  const target = cut === "executive" ? executiveTarget : fullTarget;
  const minutes: Record<Cut, number> = { full: Math.round(fullTarget / 60), executive: Math.round(executiveTarget / 60) };
  const slideSeconds = (slide: (typeof main)[number]) => cut === "executive" ? EXECUTIVE_TIMING[slide.id] ?? 0 : slide.target_duration_seconds ?? 0;
  const counterText = state.sequence === "appendix" ? `Appendix ${currentIndex + 1} / ${appendix.length}` : pathIndex < 0 ? `Extra · not in ${CUT_NAMES[cut].toLowerCase()} cut` : `${pathIndex + 1} / ${mainPath.length}`;
  const send = (payload: Record<string, unknown>) => channel.current?.postMessage({ ...payload, session, snapshotId: data.meta.snapshot_id });
  const command = (cmd: DeckCommand) => {
    if (presenter) { if (connection === "connected") send({ type: "command", command: cmd, controllerId: controllerId.current, commandId: ++commandCounter.current }); }
    else setState(previous => applyCommand(previous, cmd, identities, Date.now()));
  };
  const setCut = (next: Cut) => command({ kind: "cut", cut: next });
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
  // The page-level skip link (index.html) targets #main-content. Following it as a hash would leave the deck,
  // so move focus to the deck's own <main id="main-content"> instead.
  useEffect(() => {
    const skip = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href="#${MAIN_ID}"]`);
      if (!link) return;
      event.preventDefault();
      document.getElementById(MAIN_ID)?.focus();
    };
    document.addEventListener("click", skip);
    return () => document.removeEventListener("click", skip);
  }, []);
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
      if (event.key === "Escape") { if (overview) setOverview(false); else if (document.fullscreenElement) document.exitFullscreen(); else if (!presenter) location.hash = DASHBOARD_HASH; }
    };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [overview, presenter, connection, identities]);

  // Evidence density: if a slide's visual overflows its stage area, step its zoom down (to a floor) so it fits.
  const [density, setDensity] = useState<{ id: string; value: number }>({ id: "", value: 1 });
  const densityValue = density.id === current?.id ? density.value : 1;
  useLayoutEffect(() => {
    if (presenter || scale === null || !current) return;
    const box = canvas.current?.querySelector<HTMLElement>(".deck-visual");
    const inner = box?.firstElementChild as HTMLElement | null | undefined;
    if (!box || !inner) return;
    const available = box.getBoundingClientRect().height;
    const used = inner.getBoundingClientRect().height;
    if (available > 0 && used > available + 1 && densityValue > 0.72) setDensity({ id: current.id, value: Math.round((densityValue - 0.04) * 100) / 100 });
  });

  const section = current ? sectionFor(current.sequence, current.order) : "Context";
  const sources = current ? readableSources(current.source_footer) : [];
  const timerButtons = <><button disabled={presenter && connection !== "connected"} onClick={() => command({kind: state.timerStatus === "running" ? "pause" : "start"})}>{state.timerStatus === "running" ? <Square /> : <Play />} {state.timerStatus === "running" ? "Pause timer" : "Start timer"}</button><button disabled={presenter && connection !== "connected"} onClick={() => command({kind:"reset"})}><RotateCcw /> Reset timer</button></>;
  const limitation = !storageAvailable ? <p role="status" className="deck-status">Session storage is unavailable. This view works, but refresh cannot restore its timer.</p> : null;

  if (presenter) {
    const limits = current && (current.id === "main-13" || current.id === "main-16") ? data.recommendations.map(item => `${item.decision}: ${item.evidence_limitations.join(" ")} Owner: ${item.owner_role}. Next step: ${item.immediate_next_step}`) : [];
    const upcoming = slides.find(x => deckPosition(x.id) > deckPosition(current?.id));
    // Pace: where the timer should be when this main slide starts, from the active cut's seconds per slide
    // (an even split when no per-slide seconds are authored).
    const planned = mainPath.map(slideSeconds);
    const plannedTotal = planned.reduce((total, seconds) => total + seconds, 0);
    const before = mainPath.filter(x => deckPosition(x.id) < deckPosition(current?.id)).length;
    const expected = state.sequence === "main" ? (plannedTotal > 0 ? target * planned.slice(0, before).reduce((total, seconds) => total + seconds, 0) / plannedTotal : target * before / mainPath.length) : null;
    const drift = expected === null || elapsed === 0 ? null : elapsed / 1000 - expected;
    const pace = drift === null ? null : Math.abs(drift) < 30 ? { tone: "ok", label: "On pace" } : drift > 0 ? { tone: "behind", label: `${fmt(drift)} behind` } : { tone: "ahead", label: `${fmt(-drift)} ahead` };
    const label = (slide: typeof current) => {
      if (!slide) return "";
      const at = mainPath.indexOf(slide);
      return `${sectionFor(slide.sequence, slide.order)} · ${slide.sequence === "appendix" ? `A${slide.order}` : at < 0 ? `extra, ${slide.order} of ${main.length}` : `${at + 1} / ${mainPath.length}`}`;
    };
    return <main id={MAIN_ID} className="presenter-console deck" tabIndex={0} aria-label="Presenter keyboard controls">
      <header><span className="signal" data-status={connection} /> Presenter console <small role="status">{connection === "unavailable" ? "Cross-window control unavailable; use the audience window's keyboard controls." : `Audience ${connection}`} · session {session.slice(0,8)}</small><CutToggle cut={cut} minutes={minutes} onChange={setCut} disabled={connection !== "connected"} /><kbd className="presenter-keys"><span aria-hidden="true">→ Space next · ← back · Home / End · F fullscreen</span><span className="sr-only">Keyboard: right arrow, Space or Page Down for next; left arrow or Page Up for back; Home and End jump; F fullscreen</span></kbd></header>
      {limitation}
      <div className="presenter-top">
        <section className="presenter-current" aria-label="Current slide"><p>Now · {label(current)}</p><h1>{current ? headlines.get(current.id) : ""}</h1>{current && headlines.get(current.id) !== current.title && <p className="presenter-topic">{current.title}</p>}</section>
        <section className="presenter-clock" aria-label="Timer"><div className="timer"><Clock3 /> {fmt(elapsed / 1000)} <small>/ {fmt(target)}</small></div>{pace ? <p className={`presenter-pace ${pace.tone}`}>{pace.label} <small>· {pathIndex < 0 ? "extra slide" : `slide ${pathIndex + 1}`} due at {fmt(expected ?? 0)}</small></p> : <p className="presenter-pace">Timer not started</p>}<div className="presenter-progress" aria-hidden="true"><b style={{ width: `${Math.min(100, elapsed / 1000 / target * 100)}%` }} /><i style={{ left: `${expected === null ? 0 : expected / target * 100}%` }} /></div></section>
        <section className="presenter-upnext" aria-label="Next slide"><p>Next · {upcoming ? label(upcoming) : state.sequence === "main" ? "Appendix" : "End"}</p><h2>{upcoming ? headlines.get(upcoming.id) : state.sequence === "main" ? "End of main deck · open the appendix from the overview" : "Last appendix slide"}</h2></section>
      </div>
      <p className="presenter-bigidea"><b>Big idea</b> {BIG_IDEA}</p>
      <section className="presenter-notes"><h2>Speaker notes</h2><p><b>Say:</b> {current?.speaker_notes.say}</p>{current && <p className="presenter-transition"><b>Transition:</b> {transitionFor(data, current, upcoming)}</p>}<p><b>Do not claim:</b> {current?.speaker_notes.do_not_claim}</p><p><b>Likely question:</b> {current?.speaker_notes.judge_question}</p><p><b>Answer:</b> {current?.speaker_notes.answer}</p>{limits.length > 0 && <><h3>Evidence limits and owners</h3><ul>{limits.map(item => <li key={item}>{item}</li>)}</ul></>}<p className="presenter-sources"><b>Sources:</b> {(current?.speaker_notes.sources.length ? current.speaker_notes.sources : current?.source_footer.split(";").map(s => s.trim()) ?? []).join("; ")} · scope: {current?.scope}</p></section>
      <footer><button disabled={connection !== "connected" || !hasPrevious} onClick={() => command({kind:"previous"})}><ChevronLeft /> Back</button><button disabled={connection !== "connected" || !hasNext} className="red" onClick={() => command({kind:"next"})}>Next <ChevronRight /></button>{timerButtons}</footer>
    </main>;
  }

  const stageStyle = scale === null ? undefined : { width: `${STAGE_W * scale}px`, height: `${STAGE_H * scale}px`, "--deck-scale": scale } as CSSProperties;
  const canvasStyle = { "--deck-density": densityValue } as CSSProperties;
  const isAppendix = current?.sequence === "appendix";
  return <main id={MAIN_ID} className={`presentation-shell deck ${scale === null ? "is-flow" : "is-stage"}`} tabIndex={0} aria-label="Presentation keyboard controls"><div ref={surface}>
    <header className="presentation-header">
      <a href={DASHBOARD_HASH} className="wordmark">REVENUE <span>COMMAND</span> / CMO BRIEF</a>
      <ol className="deck-sections" aria-label="Deck sections">{[...SECTIONS.filter(name => pathRuns.some(run => run.name === name)), "Appendix" as const].map(name => <li key={name} aria-current={name === section ? "step" : undefined}>{name}</li>)}</ol>
      <span className="deck-counter">{counterText}</span>
      <CutToggle cut={cut} minutes={minutes} onChange={setCut} className="deck-cut-header" />
      <div><button aria-label="Overview" onClick={openOverview}><Grid2X2 /></button><button aria-label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}><Expand /></button><a aria-label="Open presenter console" href={`${location.pathname}#presenter/${session}`} target="_blank" rel="noopener"><ExternalLink /> <span>Presenter</span></a><a href={DASHBOARD_HASH} aria-label="Exit presentation"><X /></a></div>
    </header>
    {limitation}
    <div className="deck-frame" ref={frame}>
      <div className="deck-stage" style={stageStyle}>
        <article ref={canvas} key={current?.id} className={`slide-canvas deck-slide ${isAppendix ? "layout-split" : "layout-stack"} slide-${current?.id}`} style={canvasStyle} aria-label={`Slide ${current?.order}: ${current?.title}`}>
          <div className="deck-slide-head">
            <div className="slide-kicker"><span>{section}</span>{current && headlines.get(current.id) !== current.title && <em>{current.title}</em>}<b>{state.sequence === "appendix" ? `A${currentIndex + 1}` : pathIndex < 0 ? `${String(current?.order ?? 0).padStart(2, "0")} · extra` : `${String(pathIndex + 1).padStart(2, "0")} / ${mainPath.length}`}</b></div>
            <h1>{current ? headlines.get(current.id) : ""}</h1>
            {current && !BODY_REPEATS_HEADLINE.has(current.id) && !(hasPilot && PILOT_SLIDES.has(current.id)) && <p className="slide-body">{current.body}</p>}
          </div>
          <div className="deck-visual"><div className="deck-visual-inner">{current && <SlideVisual data={data} slide={current} />}</div></div>
          <footer className="deck-slide-foot">
            <p className="slide-caveat">{current?.visible_caveat}</p>
            <div className="deck-source"><span title={sources.join(" · ")}>Source: {sources.join(" · ")}</span><span title="Data snapshot">Snapshot {data.meta.snapshot_id.slice(0, 7)}</span>{current && <EvidenceDrawer sets={evidenceFor(data, current)} slideTitle={current.title} />}</div>
          </footer>
        </article>
      </div>
    </div>
    <nav className="presentation-controls" aria-label="Slide navigation">
      <button disabled={!hasPrevious} onClick={() => command({kind:"previous"})}><ChevronLeft /> Previous</button>
      <div className="deck-progress" aria-hidden="true">{(state.sequence === "main" ? pathRuns : [{ name: "Appendix", slides: appendix }]).map(run => {
        const done = run.slides.filter(slide => deckPosition(slide.id) <= deckPosition(current?.id)).length;
        return <span key={run.name} className={run.slides.some(slide => slide.id === current?.id) ? "is-current" : undefined} style={{ flexGrow: run.slides.length }}><b style={{ width: `${done / run.slides.length * 100}%` }} /><small>{run.name}</small></span>;
      })}</div>
      <span className="deck-elapsed"><span className="sr-only">Elapsed presentation time </span>{fmt(elapsed / 1000)} / {fmt(target)}</span>
      {state.sequence === "main" && !hasNext ? <button onClick={openOverview}>Appendix <Grid2X2 /></button> : <button className="red" disabled={!hasNext} onClick={() => command({kind:"next"})}>Next <ChevronRight /></button>}
    </nav>
  </div>
  {overview && <div className="slide-overview" role="dialog" aria-modal="true" aria-labelledby="overview-title" onKeyDown={event => { if (event.key === "Tab") { const elements = event.currentTarget.querySelectorAll<HTMLButtonElement>("button"); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}><button autoFocus aria-label="Close slide overview" className="close" onClick={() => setOverview(false)}><X /></button><h2 id="overview-title">Slide overview</h2><div className="overview-cut"><CutToggle cut={cut} minutes={minutes} onChange={setCut} /><p className="overview-hint">{cut === "executive" ? `Executive cut · ${mainPath.length} of ${main.length} main slides` : `${main.length} main slides`} · {appendix.length} appendix · Esc to close</p></div><div className="overview-groups">{[...pathRuns, { name: "Appendix" as const, slides: appendix }].map(run => <section key={run.name} aria-label={run.name}><h3>{run.name}</h3><div>{run.slides.map(slide => <button key={slide.id} aria-current={slide.id === current?.id ? "true" : undefined} onClick={() => { command({kind:"go",slideId:slide.id}); setOverview(false); }}><small>{slide.sequence === "main" ? `${String(cut === "executive" ? mainPath.indexOf(slide) + 1 : slide.order).padStart(2, "0")} · ${slide.title}` : `A${slide.order}`}</small><span>{headlines.get(slide.id)}</span></button>)}</div></section>)}</div></div>}
  </main>;
}
