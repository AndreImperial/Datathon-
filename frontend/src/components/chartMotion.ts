// Chart entrance choreography.
//
// Recharts always renders the final geometry (its own tweening is off), and this
// module layers a one-off entrance on top with the Web Animations API, touching
// only transform, opacity and stroke-dashoffset.  Animations use fill "backwards",
// so nothing persists once they end: the DOM at rest is exactly the static render.
//
// Guarantees:
// - plays once per chart per page session, on first visibility (IntersectionObserver);
//   re-renders, filters, Show data toggles and resizes never replay it;
// - motionAllowed() false (reduced motion, print-prep, print media) renders the final
//   state immediately, and beforeprint finishes anything still running, so a print
//   snapshot never holds a half-drawn chart;
// - the order explains the chart: marks first (bars grow from their baseline, lines
//   draw left to right, points pop in by row), then reference lines, then their labels,
//   then a single pulse on the accent marks.
import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { DURATION, EASE, STAGGER, countUp, isPrinting, motionAllowed } from "../motion";

/** CSS equivalents of the motion tokens (the WAAPI cannot read GSAP ease names). */
const CSS_EASE = {
  out: EASE.css,
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  settle: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

const ACCENT_FILL = "#e12636";
/** Longest stagger spread for one sequence, so long series still finish promptly. */
const MAX_SPREAD = 0.55;
const ms = (seconds: number) => Math.round(seconds * 1000);
const stepFor = (count: number, step: number = STAGGER.tight) => count > 1 ? Math.min(step, MAX_SPREAD / (count - 1)) : 0;

export interface ChoreoOptions {
  /** Value axis the bars grow along: "x" for horizontal bars, "y" (default) for columns. */
  bars?: "x" | "y";
  /** Stacked bars: segments grow one after another from the baseline. */
  stacked?: boolean;
  /** Pulse the accent-coloured marks once after the entrance. */
  pulse?: boolean;
}

// ---------------------------------------------------------------------------
// Registry: what has played, what is running, and the print/reduced-motion guard.
// ---------------------------------------------------------------------------

const played = new Set<string>();
interface Running { animation?: Animation; cleanup: () => void }
const running = new Set<Running>();
let suppressed = false;
let installed = false;
let anonymous = 0;

function allowed() {
  return !suppressed && motionAllowed();
}

/** Jump every running chart entrance to its final state (print, reduced motion). */
export function finishChartMotion() {
  for (const item of [...running]) {
    try { item.animation?.finish(); } catch { /* detached element */ }
    item.cleanup();
  }
  running.clear();
  document.querySelectorAll<HTMLElement>("[data-motion='armed'],[data-motion='enter']").forEach((node) => { node.dataset.motion = "still"; });
}

const STYLE = `
[data-motion="armed"] :is(.recharts-bar-rectangles,.recharts-line-curve,.recharts-line-dots,.recharts-label-list,.recharts-errorBars,.recharts-reference-line),
[data-motion="armed"] [data-motion-part] { opacity: 0; }
.chart-stage .recharts-bar-rectangle > *, .chart-stage .recharts-line-dots > * { transition: fill-opacity 150ms ease, opacity 150ms ease; }
.chart-tooltip { animation: chart-tip-in 120ms cubic-bezier(0.22, 1, 0.36, 1); }
@keyframes chart-tip-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  [data-motion="armed"] :is(.recharts-bar-rectangles,.recharts-line-curve,.recharts-line-dots,.recharts-label-list,.recharts-errorBars,.recharts-reference-line),
  [data-motion="armed"] [data-motion-part] { opacity: 1; }
  .chart-stage .recharts-bar-rectangle > *, .chart-stage .recharts-line-dots > * { transition: none; }
  .chart-tooltip { animation: none; }
}
@media print {
  [data-motion] :is(.recharts-bar-rectangles,.recharts-line-curve,.recharts-line-dots,.recharts-label-list,.recharts-errorBars,.recharts-reference-line),
  [data-motion] [data-motion-part] { opacity: 1 !important; }
  .chart-tooltip { animation: none; }
}
html.print-prep [data-motion] :is(.recharts-bar-rectangles,.recharts-line-curve,.recharts-line-dots,.recharts-label-list,.recharts-errorBars,.recharts-reference-line),
html.print-prep [data-motion] [data-motion-part] { opacity: 1 !important; }
`;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const style = document.createElement("style");
  style.dataset.chartMotion = "";
  style.textContent = STYLE;
  document.head.appendChild(style);
  const stop = () => { suppressed = true; finishChartMotion(); };
  window.addEventListener("beforeprint", stop);
  window.addEventListener("afterprint", () => { suppressed = false; });
  try {
    window.matchMedia("print").addEventListener("change", (event) => { if (event.matches) stop(); else suppressed = false; });
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => { if (event.matches) finishChartMotion(); });
  } catch { /* old matchMedia */ }
}

// ---------------------------------------------------------------------------
// Timeline helper
// ---------------------------------------------------------------------------

class Timeline {
  end = 0;
  readonly items: Running[] = [];

  /** Animate one element; returns the time (s) it settles. */
  play(element: Element, keyframes: Keyframe[], delay: number, duration: number, easing: string, origin?: string): number {
    const target = element as SVGElement | HTMLElement;
    if (!target.isConnected || typeof target.animate !== "function") return delay + duration;
    // A CSS transform would replace a transform attribute while it runs.
    if (target.hasAttribute("transform") && keyframes.some((frame) => "transform" in frame)) {
      keyframes = keyframes.map(({ transform: _ignored, ...rest }) => rest);
    }
    const restore = origin ? { box: target.style.transformBox, origin: target.style.transformOrigin } : null;
    if (origin) { target.style.transformBox = "fill-box"; target.style.transformOrigin = origin; }
    const animation = target.animate(keyframes, { delay: ms(delay), duration: ms(duration), easing, fill: "backwards" });
    const item: Running = {
      animation,
      cleanup: () => { if (restore) { target.style.transformBox = restore.box; target.style.transformOrigin = restore.origin; } },
    };
    this.track(item);
    animation.onfinish = () => { item.cleanup(); running.delete(item); };
    animation.oncancel = animation.onfinish;
    this.end = Math.max(this.end, delay + duration);
    return delay + duration;
  }

  /** Count a numeric label up in step with its mark, ending on the exact rendered text. */
  count(label: Element, delay: number, duration: number) {
    const leaf = numericLeaf(label);
    if (!leaf) return;
    const original = leaf.textContent ?? "";
    const parsed = parseNumeric(original);
    if (!parsed || parsed.value === 0) return;
    let written = "";
    let external: string | null = null;
    const format = (value: number) => {
      // React re-rendered the label mid-count (data changed): keep its text.
      if (written && leaf.textContent !== written && external === null) external = leaf.textContent;
      if (external !== null) return external;
      written = value === parsed.value ? original : parsed.render(value);
      return written;
    };
    const cancel = countUp(leaf as unknown as HTMLElement, parsed.value, format, { from: 0, duration, delay });
    const finish = () => { cancel(); if (external !== null) leaf.textContent = external; };
    const item: Running = { cleanup: finish };
    this.track(item);
    window.setTimeout(() => { if (running.has(item)) { if (external !== null) leaf.textContent = external; running.delete(item); } }, ms(delay + duration) + 120);
    this.end = Math.max(this.end, delay + duration);
  }

  private track(item: Running) {
    running.add(item);
    this.items.push(item);
  }
}

/** First text/tspan without element children whose text holds a number. */
function numericLeaf(element: Element): Element | null {
  const candidates = [element, ...Array.from(element.querySelectorAll("text, tspan, b, strong, span"))];
  return candidates.find((node) => node.children.length === 0 && /\d/.test(node.textContent ?? "")) ?? null;
}

/** Split "$1.2M", "+$350K", "LT $1.2M", "12.5%", "1,234" into prefix, number and suffix. */
export function parseNumeric(text: string): { value: number; render: (value: number) => string } | null {
  const match = /\d[\d,]*(?:\.\d+)?|\.\d+/.exec(text);
  if (!match) return null;
  const token = match[0];
  const value = Number(token.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const prefix = text.slice(0, match.index);
  const suffix = text.slice(match.index + token.length);
  const decimals = token.includes(".") ? token.split(".")[1].length : 0;
  const grouped = token.includes(",");
  const render = (current: number) => {
    const fixed = Math.max(0, current).toFixed(decimals);
    const [whole, fraction] = fixed.split(".");
    const wholeText = grouped ? Number(whole).toLocaleString("en-US") : whole;
    return `${prefix}${wholeText}${fraction !== undefined ? `.${fraction}` : ""}${suffix}`;
  };
  return { value, render };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface Box { x: number; y: number; width: number; height: number }
function box(element: Element): Box | null {
  try {
    const bbox = (element as SVGGraphicsElement).getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch {
    return null;
  }
}
/** The highlight series: marks filled with the accent (hollow provisional markers excluded). */
const isAccent = (element: Element) => (element.getAttribute("fill") ?? "").toLowerCase() === ACCENT_FILL;
const visibleStroke = (element: Element) => {
  const stroke = (element.getAttribute("stroke") ?? "").toLowerCase();
  return stroke !== "" && stroke !== "none" && stroke !== "transparent" && Number(element.getAttribute("stroke-width") ?? 1) > 0;
};
/** Label units: a label rendered as a <g> of several texts animates text by text. */
function labelUnits(list: Element): Element[] {
  return Array.from(list.children).flatMap((child) => child.tagName === "g" ? Array.from(child.querySelectorAll(":scope > text, :scope > g > text")) : [child]);
}

/** Time (0..1) at which an ease-in-out-cubic draw reaches `progress` of its length. */
function inverseInOut(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return p < 0.5 ? Math.cbrt(p / 4) : 1 - Math.cbrt((1 - p) / 4);
}

const FADE = [{ opacity: 0 }, { opacity: 1 }];
const POP = [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }];

// ---------------------------------------------------------------------------
// SVG (Recharts) choreography
// ---------------------------------------------------------------------------

interface BarMark { shape: Element; box: Box; delay: number; duration: number; negative: boolean }

export function choreographSvg(root: HTMLElement, options: ChoreoOptions): Timeline {
  const timeline = new Timeline();
  const axis = options.bars ?? "y";
  const accentMarks: Element[] = [];
  const lateLabels: Element[] = [];

  // 1. Bars: per-bar stagger from the baseline; stacked segments in stack order.
  const groups = Array.from(root.querySelectorAll(".recharts-bar"));
  const seriesCount = groups.length;
  let marksEnd = 0;
  groups.forEach((group, series) => {
    const slots = Array.from(group.querySelectorAll(":scope > .recharts-bar-rectangles .recharts-bar-rectangle"));
    const step = stepFor(slots.length);
    const segment = options.stacked ? Math.max(0.2, DURATION.slow / Math.max(2, seriesCount * 0.75)) : DURATION.slow;
    const marks: BarMark[] = [];
    slots.forEach((slot, index) => {
      const shape = slot.firstElementChild;
      const geometry = shape ? box(shape) : null;
      if (!shape || !geometry || geometry.width < 0.5 || geometry.height < 0.5) return;
      const delay = options.stacked ? index * step + series * segment * 0.85 : index * step + series * 0.03;
      const negative = shape.getAttribute("data-sign") === "negative";
      const origin = axis === "x" ? (negative ? "100% 50%" : "0% 50%") : "50% 100%";
      const scale = axis === "x" ? "scaleX" : "scaleY";
      timeline.play(shape, [{ transform: `${scale}(0)` }, { transform: `${scale}(1)` }], delay, segment, CSS_EASE.out, origin);
      marks.push({ shape, box: geometry, delay, duration: segment, negative });
      if (isAccent(shape)) accentMarks.push(shape);
      marksEnd = Math.max(marksEnd, delay + segment);
    });
    // Labels ride the bar tip and count up with it.
    group.querySelectorAll(":scope > .recharts-label-list").forEach((list) => labelUnits(list).forEach((label) => {
      const geometry = box(label);
      if (!geometry || !marks.length) { lateLabels.push(label); return; }
      const center = axis === "x" ? geometry.y + geometry.height / 2 : geometry.x + geometry.width / 2;
      const distance = (mark: BarMark) => axis === "x"
        ? Math.max(0, mark.box.y - center, center - (mark.box.y + mark.box.height))
        : Math.max(0, mark.box.x - center, center - (mark.box.x + mark.box.width));
      const mark = marks.reduce((best, item) => distance(item) < distance(best) ? item : best);
      if (distance(mark) > 32) { lateLabels.push(label); return; }
      const inside = distance(mark) === 0;
      const tipGap = axis === "x" ? Math.abs(geometry.x - (mark.box.x + mark.box.width)) : Math.abs(geometry.y + geometry.height - mark.box.y);
      const ride = inside && !mark.negative && tipGap < 24;
      const shift = axis === "x" ? `translateX(${-mark.box.width}px)` : `translateY(${mark.box.height}px)`;
      const frames: Keyframe[] = ride
        ? [{ opacity: 0, transform: shift }, { opacity: 1, offset: 0.25 }, { opacity: 1, transform: "translate(0px, 0px)" }]
        : [{ opacity: 0 }, { opacity: 1 }];
      timeline.play(label, frames, mark.delay, ride ? mark.duration : Math.min(mark.duration, DURATION.base), CSS_EASE.out);
      if (inside) timeline.count(label, mark.delay, mark.duration);
    }));
  });

  // 2. Lines draw left to right, then their markers pop; point charts pop by row.
  const lines = Array.from(root.querySelectorAll(".recharts-line"));
  const drawn = lines.filter((line) => { const curve = line.querySelector(".recharts-line-curve"); return !!curve && visibleStroke(curve); });
  const drawStart = marksEnd;
  let drawEnd = drawStart;
  drawn.forEach((line, index) => {
    const curve = line.querySelector<SVGPathElement>(".recharts-line-curve");
    if (!curve || typeof curve.getTotalLength !== "function") return;
    const length = curve.getTotalLength();
    if (!(length > 0)) return;
    const previous = curve.style.strokeDasharray;
    curve.style.strokeDasharray = `${length} ${length}`;
    const delay = drawStart + index * STAGGER.base;
    timeline.play(curve, [{ strokeDashoffset: `${length}` }, { strokeDashoffset: "0" }], delay, DURATION.draw, CSS_EASE.inOut);
    const restore: Running = { cleanup: () => { curve.style.strokeDasharray = previous; } };
    running.add(restore);
    timeline.items.push(restore);
    window.setTimeout(() => { if (running.has(restore)) { restore.cleanup(); running.delete(restore); } }, ms(delay + DURATION.draw) + 60);
    drawEnd = Math.max(drawEnd, delay + DURATION.draw);
  });
  lines.forEach((line) => {
    const isDrawn = drawn.includes(line);
    const dots = Array.from(line.querySelectorAll(":scope > .recharts-line-dots > *"));
    const start = isDrawn ? drawStart : marksEnd;
    const step = stepFor(dots.length);
    const centers = dots.map((dot) => { const geometry = box(dot); return geometry ? { cx: geometry.x + geometry.width / 2, cy: geometry.y + geometry.height / 2 } : { cx: 0, cy: 0 }; });
    const minX = Math.min(...centers.map((c) => c.cx));
    const spanX = Math.max(1, Math.max(...centers.map((c) => c.cx)) - minX);
    const timed = dots.map((dot, index) => {
      // On a drawn line a marker pops just after the stroke reaches it (the draw's
      // ease-in-out inverted to time); free-standing points pop row by row.
      const delay = isDrawn ? start + DURATION.draw * inverseInOut((centers[index].cx - minX) / spanX) + 0.06 : start + index * step;
      timeline.play(dot, POP, delay, DURATION.base, CSS_EASE.settle, "50% 50%");
      if (isAccent(dot)) accentMarks.push(dot);
      return { dot, delay, ...centers[index] };
    });
    if (timed.length) marksEnd = Math.max(marksEnd, Math.max(...timed.map((item) => item.delay)) + DURATION.base);
    const nearest = (element: Element) => {
      const geometry = box(element);
      if (!geometry || !timed.length) return null;
      const cx = geometry.x + geometry.width / 2;
      const cy = geometry.y + geometry.height / 2;
      return timed.reduce((best, item) => Math.hypot(item.cx - cx, item.cy - cy) < Math.hypot(best.cx - cx, best.cy - cy) ? item : best);
    };
    // Whiskers arrive with their point.
    line.querySelectorAll(".recharts-errorBar").forEach((whisker) => {
      const point = nearest(whisker);
      timeline.play(whisker, FADE, point ? point.delay : start, DURATION.base, CSS_EASE.out);
    });
    line.querySelectorAll(":scope > .recharts-label-list").forEach((list) => labelUnits(list).forEach((label) => {
      // Series-name labels on drawn lines come last; point values arrive with their point.
      if (isDrawn) { lateLabels.push(label); return; }
      const point = nearest(label);
      const delay = point ? point.delay : start;
      timeline.play(label, FADE, delay, DURATION.base, CSS_EASE.out);
      timeline.count(label, delay, DURATION.slow);
    }));
  });
  marksEnd = Math.max(marksEnd, drawEnd);

  // 3. Reference lines (averages, totals) draw across after the marks; label last.
  let referenceEnd = marksEnd;
  root.querySelectorAll(".recharts-reference-line").forEach((reference) => {
    const line = reference.querySelector(".recharts-reference-line-line");
    if (!line) return;
    const dashed = !!line.getAttribute("stroke-dasharray");
    if (!dashed) return; // a solid zero line is the baseline: it is there from the start
    const vertical = line.getAttribute("x1") === line.getAttribute("x2");
    const end = timeline.play(line, [{ transform: vertical ? "scaleY(0)" : "scaleX(0)" }, { transform: "scale(1)" }], marksEnd + 0.05, DURATION.base, CSS_EASE.out, vertical ? "50% 0%" : "0% 50%");
    reference.querySelectorAll(".recharts-label").forEach((label) => timeline.play(label, FADE, end, DURATION.fast, CSS_EASE.out));
    referenceEnd = Math.max(referenceEnd, end + DURATION.fast);
  });

  // 4. Direct labels that are not tied to a single mark fade in last.
  // They share the beat of the reference labels so the entrance stays near two seconds.
  const lateStart = referenceEnd > marksEnd ? referenceEnd - DURATION.fast : marksEnd;
  lateLabels.forEach((label) => timeline.play(label, FADE, lateStart, DURATION.base, CSS_EASE.out));
  const settled = lateLabels.length ? Math.max(referenceEnd, lateStart + DURATION.base) : referenceEnd;

  // 5. The accent marks pulse once to draw the eye, then rest.
  if (options.pulse) pulse(timeline, accentMarks, settled);
  return timeline;
}

function pulse(timeline: Timeline, marks: Element[], delay: number) {
  marks.forEach((mark) => {
    if (mark.tagName === "circle") timeline.play(mark, [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], delay, DURATION.slow, CSS_EASE.inOut, "50% 50%");
    else timeline.play(mark, [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], delay, DURATION.slow + 0.1, CSS_EASE.inOut);
  });
}

// ---------------------------------------------------------------------------
// HTML choreography (heatmaps, ROI rows, the coverage meter)
// ---------------------------------------------------------------------------

/**
 * Elements opt in with data-motion-part:
 * - "cell" (+ data-row, data-col): diagonal fade wave;
 * - "bar" (+ data-row): grows from the left, staggered by row; "value" counts up with its row;
 * - "rule" / "rule-label": a reference rule drawn after the bars, its label after it;
 * - "legend": arrives last.
 */
export function choreographHtml(root: HTMLElement, options: ChoreoOptions): Timeline {
  const timeline = new Timeline();
  const parts = (name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-motion-part='${name}']`));
  const row = (element: HTMLElement) => Number(element.dataset.row ?? 0);
  const col = (element: HTMLElement) => Number(element.dataset.col ?? 0);

  const cells = parts("cell");
  const waves = cells.length ? Math.max(...cells.map((cell) => row(cell) + col(cell))) + 1 : 0;
  const waveStep = stepFor(waves);
  cells.forEach((cell) => timeline.play(cell, [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "scale(1)" }], (row(cell) + col(cell)) * waveStep, DURATION.base, CSS_EASE.out, "50% 50%"));

  const bars = parts("bar");
  const rows = bars.length ? Math.max(...bars.map(row)) + 1 : 0;
  const barStep = stepFor(rows, STAGGER.base);
  const accent: Element[] = [];
  bars.forEach((bar) => {
    timeline.play(bar, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], row(bar) * barStep, DURATION.slow, CSS_EASE.out, "0% 50%");
    if (bar.dataset.accent === "true") accent.push(bar);
  });
  parts("value").forEach((value) => {
    const delay = row(value) * barStep;
    timeline.count(value, delay, DURATION.slow);
  });
  const marksEnd = timeline.end;
  parts("rule").forEach((rule) => timeline.play(rule, [{ opacity: 0, transform: "scaleY(0)" }, { opacity: 1, transform: "scaleY(1)" }], marksEnd + 0.05, DURATION.base, CSS_EASE.out, "50% 0%"));
  const ruleEnd = timeline.end;
  parts("rule-label").forEach((label) => timeline.play(label, FADE, ruleEnd, DURATION.fast, CSS_EASE.out));
  const legendStart = timeline.end;
  parts("legend").forEach((legend) => timeline.play(legend, FADE, legendStart, DURATION.base, CSS_EASE.out));
  if (options.pulse) pulse(timeline, accent, timeline.end + 0.1);
  return timeline;
}

// ---------------------------------------------------------------------------
// Hook: first visibility -> wait for a settled layout -> play once.
// ---------------------------------------------------------------------------

/**
 * Plays `choreograph` once per chart per page session, the first time the
 * element is on screen.  `part` separates several charts inside one card.
 */
export function useChartEntrance(ref: RefObject<HTMLElement | null>, part: string | number, kind: "svg" | "html", options: ChoreoOptions = {}) {
  const optionKey = `${options.bars ?? ""}|${options.stacked ? 1 : 0}|${options.pulse ? 1 : 0}`;
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    install();
    const chartId = root.closest("[data-chart-id]")?.getAttribute("data-chart-id");
    const id = `${chartId ?? `anonymous-${anonymous++}`}:${kind}:${part}`;
    // Mounted for print, under reduced motion, or already played: final state, for good.
    if (played.has(id) || !allowed()) {
      if (!played.has(id) && (isPrinting() || !motionAllowed())) played.add(id);
      root.dataset.motion = "still";
      return;
    }
    let disposed = false;
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let timeline: Timeline | null = null;
    const begin = () => {
      if (disposed || played.has(id)) return;
      observer?.disconnect();
      if (!allowed()) { root.dataset.motion = "still"; return; }
      played.add(id);
      root.dataset.motion = "armed";
      // Wait until the chart has its measured size (ResponsiveContainer re-renders
      // once after mount and re-keys the bars), then play on the settled marks.
      let last = -1;
      let stable = 0;
      let frames = 0;
      const settle = () => {
        if (disposed) return;
        // Layout sizes, not transformed boxes: a card's own reveal may still be scaling.
        const width = root.clientWidth;
        const svgWidth = Number(root.querySelector("svg.recharts-surface")?.getAttribute("width") ?? width);
        const size = Math.round(width) * 100000 + Math.round(svgWidth);
        stable = size === last ? stable + 1 : 0;
        last = size;
        frames += 1;
        if ((stable < 2 && frames < 24) || frames < 3) { frame = requestAnimationFrame(settle); return; }
        if (!allowed()) { root.dataset.motion = "still"; return; }
        root.dataset.motion = "enter";
        timeline = kind === "svg" ? choreographSvg(root, options) : choreographHtml(root, options);
        const total = timeline.end;
        window.setTimeout(() => { if (!disposed && root.dataset.motion === "enter") root.dataset.motion = "still"; }, ms(total) + 100);
      };
      frame = requestAnimationFrame(settle);
    };
    const rect = root.getBoundingClientRect();
    if (rect.width > 0 && rect.top < window.innerHeight && rect.bottom > 0) begin();
    else if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) begin(); }, { threshold: 0.15 });
      observer.observe(root);
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      // Unmounted before it could play (or React StrictMode's probe): let the next mount play it.
      if (root.dataset.motion === "armed") { root.dataset.motion = "still"; played.delete(id); }
      timeline?.items.forEach((item) => { if (running.has(item)) { try { item.animation?.finish(); } catch { /* detached */ } item.cleanup(); running.delete(item); } });
    };
  }, [ref, part, kind, optionKey]);
}
