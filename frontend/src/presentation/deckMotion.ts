// Deck motion: directional slide transitions, the per-slide build sequence and the overview zoom.
//
// Built on the shared motion system (../motion): same tokens, same rules. Only transform, opacity and
// clip-path animate. Every effect is a Web Animation with fill "backwards", so an element's resting CSS
// state is its final state: finishing an animation (Next during a build, print, unmount) or never starting
// one (reduced motion, print, no WAAPI, jsdom) leaves the slide exactly as authored.

import { DURATION, EASE, ENTER, STAGGER, countUp, motionAllowed } from "../motion";

export type Direction = "next" | "prev" | "none";

/** Total budget for the directional slide transition (View Transitions or the crossfade fallback). */
export const TRANSITION_MS = 240;
/** Whole build (kicker â†’ headline â†’ numbers â†’ visual â†’ footer) settles inside this budget, accent pulse included. */
export const BUILD_MS = 900;

const OUT = EASE.css;
/** A small overshoot for tiles that "deal in" (CSS twin of EASE.settle). */
const SETTLE = "cubic-bezier(0.34, 1.32, 0.64, 1)";
const ms = (seconds: number) => Math.round(seconds * 1000);

/** True when the browser can run the deck's motion and the viewer allows it. */
export function canAnimate(): boolean {
  return motionAllowed()
    && typeof Element !== "undefined" && typeof Element.prototype.animate === "function"
    && typeof requestAnimationFrame === "function";
}

/* ---------- count-up formatting ---------- */

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/**
 * A format(progress) for countUp that rebuilds `text` with every number in it scaled by progress (0..1),
 * keeping prefix, suffix, separators and decimal places. format(1) returns `text` unchanged, so the
 * count always ends on the exact authored string. Null when the text holds no number.
 */
export function progressFormat(text: string): ((progress: number) => string) | null {
  const tokens = text.match(NUMBER);
  if (!tokens) return null;
  return (progress: number) => {
    if (progress >= 1) return text;
    return text.replace(NUMBER, token => {
      const decimals = token.includes(".") ? token.split(".")[1].length : 0;
      const value = Number(token.replaceAll(",", "")) * Math.max(0, progress);
      return token.includes(",")
        ? value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : value.toFixed(decimals);
    });
  };
}

/* ---------- build sequence ---------- */

export type Build = { finish: () => void };
const NOOP: Build = { finish: () => undefined };

type Step = { delay: number; duration: number; easing?: string };

/** Cell order for a diagonal reveal: row index + column index of a td/th inside its table body. */
function diagonal(cell: HTMLTableCellElement): number {
  const row = cell.parentElement as HTMLTableRowElement | null;
  return (row?.sectionRowIndex ?? 0) + cell.cellIndex;
}

/**
 * Play the entrance build of one slide. Timeline (ms from slide entry):
 *   0    kicker
 *   40   headline, word by word (tight stagger, â‰¤ 240 ms spread)
 *   140  body line and the visual: tiles deal in, bars grow in order with the accent bar last,
 *        grid cells reveal diagonally; key numbers count up with their element
 *   ~600 accent bar / feasible cell / pilot callout: a single subtle pulse
 *   560  caveat and source footer
 * Everything settles by BUILD_MS. finish() jumps to the final state at once.
 */
export function playBuild(slide: HTMLElement | null, options: { stage?: HTMLElement | null; direction: Direction; stageEntrance: boolean }): Build {
  if (!slide || !canAnimate()) return NOOP;
  const animations: Animation[] = [];
  const stops: (() => void)[] = [];
  const add = (element: Element | null | undefined, keyframes: Keyframe[], step: Step, extra: KeyframeAnimationOptions = {}) => {
    if (!element) return;
    animations.push(element.animate(keyframes, { delay: step.delay, duration: step.duration, easing: step.easing ?? OUT, fill: "backwards", ...extra }));
  };
  const rise = (distance: number): Keyframe[] => [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }];
  const count = (element: Element | null | undefined, delay: number, duration = 520) => {
    if (!(element instanceof HTMLElement) || element.childElementCount > 0) return;
    // Only values that lead with their number (12.3%, 1,017, $4.1M, 41 of 1,070); never prose such as "90-day test".
    if (!/^[^\p{L}\d]*\d/u.test(element.textContent ?? "")) return;
    const format = progressFormat(element.textContent ?? "");
    if (!format) return;
    stops.push(countUp(element, 1, format, { from: 0, delay: delay / 1000, duration: duration / 1000 }));
  };
  const pulse = (element: Element | null | undefined, delay: number, keyframes: Keyframe[] = [{ transform: "none" }, { transform: "scale(1.035)", offset: 0.45 }, { transform: "none" }]) => {
    if (!element) return;
    // fill "none": the pulse starts and ends at rest, so it never overrides an earlier entrance while it waits.
    animations.push(element.animate(keyframes, { delay, duration: 300, easing: "ease-in-out", fill: "none" }));
  };

  // Slide container: directional crossfade when no View Transition carried the change.
  if (options.stage && options.stageEntrance) {
    const shift = options.direction === "next" ? 28 : options.direction === "prev" ? -28 : 0;
    add(options.stage, [{ opacity: 0, transform: `translate(${shift}px, ${Math.sign(shift) * 6}px)` }, { opacity: 1, transform: "none" }], { delay: 0, duration: options.direction === "none" ? 150 : 220 });
  }

  // 1. kicker, 2. headline words, then the body line.
  add(slide.querySelector(".slide-kicker"), rise(6), { delay: 0, duration: 200 });
  const words = [...slide.querySelectorAll<HTMLElement>(".deck-slide-head h1 .deck-word")];
  if (words.length) {
    const stagger = Math.min(ms(STAGGER.tight), 240 / Math.max(1, words.length - 1));
    words.forEach((word, index) => add(word, [{ opacity: 0, transform: "translateY(0.4em)" }, { opacity: 1, transform: "none" }], { delay: 40 + index * stagger, duration: 260 }));
  } else add(slide.querySelector(".deck-slide-head h1"), rise(8), { delay: 40, duration: 260 });
  add(slide.querySelector(".slide-body"), rise(6), { delay: 160, duration: 260 });

  // 3. the visual.
  const visual = slide.querySelector<HTMLElement>(".deck-visual-inner");
  const V = 140;
  if (visual) {
    add(visual, rise(10), { delay: V - 20, duration: ms(DURATION.fast) + 60 });

    // KPI tiles deal in with alternating tilt and count up.
    slide.querySelectorAll<HTMLElement>(".deck-kpis").forEach(group => {
      group.querySelectorAll<HTMLElement>(":scope > .deck-kpi").forEach((tile, index) => {
        const from = ENTER.tile(index);
        const delay = V + index * ms(STAGGER.base);
        add(tile, [{ opacity: 0, transform: `translateY(${from.y}px) rotate(${from.rotate}deg) scale(${from.scale})` }, { opacity: 1, transform: "none" }], { delay, duration: 440, easing: SETTLE });
        count(tile.querySelector("dd:not(.deck-kpi-note)"), delay + 60);
      });
    });

    // Bars grow in order; the emphasised bar grows last and pulses once.
    const bars = [...visual.querySelectorAll<HTMLElement>(".slide-bar i > b, .deck-diverging i > b, .deck-waterfall i > b, .deck-share-bar > b, .deck-timeline li i > b")];
    const isAccent = (bar: HTMLElement) => bar.classList.contains("is-accent") || Boolean(bar.closest("li.is-accent"));
    const ordered = [...bars.filter(bar => !isAccent(bar)), ...bars.filter(isAccent)];
    if (ordered.length) {
      const start = V + 60;
      const stagger = Math.min(60, 180 / ordered.length);
      ordered.forEach((bar, index) => {
        const delay = start + index * stagger;
        add(bar, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay, duration: 260 });
        if (isAccent(bar)) {
          // The track pulses (the bar itself sits inside an overflow-clipped track).
          pulse(bar.parentElement, Math.min(delay + 260, BUILD_MS - 300), [{ transform: "none" }, { transform: "scaleY(1.3)", offset: 0.45 }, { transform: "none" }]);
          count(bar.closest("li")?.querySelector(":scope > strong"), delay, 360);
        }
      });
      visual.querySelectorAll(".deck-share").forEach(share => share.querySelectorAll(":scope > ul strong").forEach(label => count(label, start, 420)));
    }

    // Grids: cells reveal along the diagonal; feasible cells and the pilot callout highlight after.
    const grids = [...visual.querySelectorAll<HTMLTableElement>(".deck-scenarios, .deck-matrix, .deck-leaders")];
    let gridEnd = V;
    grids.forEach(grid => grid.querySelectorAll<HTMLTableCellElement>("tbody td, tbody th").forEach(cell => {
      const delay = V + 40 + diagonal(cell) * 45;
      gridEnd = Math.max(gridEnd, delay + 240);
      add(cell, [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], { delay, duration: 240 });
    }));
    visual.querySelectorAll(".deck-matrix td strong").forEach(value => count(value, V + 80, 480));
    const lit = [...visual.querySelectorAll<HTMLElement>(".deck-scenarios td.feasible"), ...visual.querySelectorAll<HTMLElement>(".deck-pilot")];
    const pilot = visual.querySelector<HTMLElement>(".deck-pilot");
    if (pilot) {
      add(pilot, [{ opacity: 0, transform: "translateX(18px)" }, { opacity: 1, transform: "none" }], { delay: V + 120, duration: 300 });
      count(pilot.querySelector(".deck-pilot-head > strong"), V + 140, 460);
    }
    if (grids.length && lit.length) {
      const at = Math.min(gridEnd + 20, BUILD_MS - 320);
      lit.forEach(element => {
        pulse(element, at);
        animations.push(element.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { pseudoElement: "::after", delay: at, duration: 300, easing: "ease-out", fill: "none" }));
      });
    }

    // Tables, formula terms and decision rows rise in order.
    const rows = [...visual.querySelectorAll<HTMLElement>(".deck-table tbody tr, .deck-decisions tbody tr, .deck-pilot-lifts tbody tr, .deck-formula-terms > li")];
    const rowStagger = Math.min(40, 240 / Math.max(1, rows.length));
    rows.forEach((row, index) => add(row, rise(ENTER.row.y), { delay: V + 60 + index * rowStagger, duration: 260 }));
    visual.querySelectorAll(".deck-formula-terms li.known > strong, .deck-waterfall li.result > strong").forEach(value => count(value, V + 100, 480));
    visual.querySelectorAll(".deck-callout > strong, .deck-sample > strong").forEach(value => count(value, V + 60, 520));
  }

  // 4. caveat and footer.
  add(slide.querySelector(".deck-slide-foot"), rise(6), { delay: 560, duration: 260 });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    for (const animation of animations) { try { animation.finish(); } catch { animation.cancel(); } }
    for (const stop of stops) stop();
  };
  return { finish };
}

/* ---------- directional slide transitions ---------- */

type ViewTransitionLike = { skipTransition: () => void; finished: Promise<unknown>; ready: Promise<unknown>; updateCallbackDone: Promise<unknown> };
type TransitionDocument = Document & { startViewTransition?: (update: () => void) => ViewTransitionLike };

let active: ViewTransitionLike | null = null;
let lastStart = -Infinity;
/** How the next slide entry should play; read once by the slide's layout effect. */
let entering: { direction: Direction; viaTransition: boolean } = { direction: "none", viaTransition: false };

export function takeEntrance() { const value = entering; entering = { direction: "none", viaTransition: false }; return value; }

/**
 * Change slide with directional motion. `apply` must commit the new slide synchronously (flushSync).
 * - View Transitions when available: the outgoing slide leaves and the incoming one enters along the direction.
 * - A press during an in-flight transition skips it and applies at once: rapid Next never queues or lags.
 * - Otherwise (no API, reduced motion, print, hidden tab) the slide changes at once with the crossfade fallback.
 */
export function navigate(direction: Direction, apply: () => void, beforeCapture?: () => void): void {
  beforeCapture?.();
  const doc = document as TransitionDocument;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const rapid = now - lastStart < TRANSITION_MS + 20;
  if (active) { try { active.skipTransition(); } catch { /* already done */ } active = null; }
  const useTransition = canAnimate() && typeof doc.startViewTransition === "function" && !rapid && doc.visibilityState === "visible";
  if (!useTransition) {
    entering = { direction: rapid ? "none" : direction, viaTransition: false };
    apply();
    return;
  }
  lastStart = now;
  const root = doc.documentElement;
  root.dataset.deckDir = direction;
  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition!(() => { entering = { direction, viaTransition: true }; apply(); });
  } catch {
    delete root.dataset.deckDir;
    entering = { direction, viaTransition: false };
    apply();
    return;
  }
  active = transition;
  // A skipped transition rejects these promises; they are expected, never errors.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  transition.finished.catch(() => undefined).then(() => {
    if (active === transition) active = null;
    if (!active) delete root.dataset.deckDir;
  });
}

/* ---------- overview ---------- */

/** Overview opening: cards stagger in and the current card zooms down from the slide's position. */
export function playOverviewOpen(dialog: HTMLElement | null, stage: HTMLElement | null): Build {
  if (!dialog || !canAnimate()) return NOOP;
  const animations: Animation[] = [];
  const cards = [...dialog.querySelectorAll<HTMLElement>(".overview-groups button")];
  const current = dialog.querySelector<HTMLElement>(".overview-groups button[aria-current]");
  cards.filter(card => card !== current).forEach((card, index) => {
    animations.push(card.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { delay: Math.min(index * 12, 220), duration: 220, easing: OUT, fill: "backwards" }));
  });
  if (current && stage) {
    const from = stage.getBoundingClientRect(), to = current.getBoundingClientRect();
    if (from.width > 0 && to.width > 0) {
      const scale = from.width / to.width;
      dialog.classList.add("is-zooming");
      const zoom = current.animate([
        { opacity: 0.25, transform: `translate(${from.left - to.left}px, ${from.top + (from.height - to.height * scale) / 2 - to.top}px) scale(${scale})` },
        { opacity: 1, transform: "none" },
      ], { duration: 300, easing: OUT, fill: "backwards" });
      animations.push(zoom);
      zoom.finished.catch(() => undefined).then(() => dialog.classList.remove("is-zooming"));
    }
  }
  return { finish: () => { animations.forEach(animation => { try { animation.finish(); } catch { animation.cancel(); } }); dialog.classList.remove("is-zooming"); } };
}

/** Selecting a card: the stage zooms up from the card's rectangle into the full slide. */
export function playZoomFrom(stage: HTMLElement | null, card: DOMRect | null): void {
  if (!stage || !card || !canAnimate()) return;
  const to = stage.getBoundingClientRect();
  if (!(to.width > 0) || !(card.width > 0)) return;
  const scale = card.width / to.width;
  stage.animate([
    { opacity: 0.35, transformOrigin: "0 0", transform: `translate(${card.left - to.left}px, ${card.top + (card.height - to.height * scale) / 2 - to.top}px) scale(${scale})` },
    { opacity: 1, transformOrigin: "0 0", transform: "none" },
  ], { duration: 300, easing: OUT, fill: "backwards" });
}
