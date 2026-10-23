// Shared chart primitives: palette semantics, axis presets, the one tooltip
// used by every Recharts chart, hover-dimming and the entrance-motion shell.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

export const COLORS = {
  ink: "#F7F4F4",
  blue: "#E12636",
  azure: "#FF7B84",
  teal: "#F2EEEE",
  amber: "#C4616A",
  red: "#FF4F5D",
  violet: "#9F5660",
  slate: "#91888A",
  pale: "#BFB7B8",
  grid: "#332F30",
  muted: "#AFA6A7",
};

/**
 * Palette semantics.  ACCENT is reserved for the mark that carries the
 * card's point; CONTEXT is the neutral used for everything else so the accent
 * reads instantly.  Semantic gain/loss colours are used only for signed gaps.
 */
export const ACCENT = COLORS.blue;
export const CONTEXT = "#6F6769";
export const CONTEXT_LIGHT = COLORS.slate;
/** Chart card surface (styles.css `--surface`); the palette validator runs against it. */
export const SURFACE = "#111113";

/**
 * Categorical slots, fixed order, assigned by entity and never cycled.
 * Validated with dataviz `validate_palette.js --mode dark --surface #111113`:
 * lightness band, chroma floor, adjacent CVD (worst 8.4), normal-vision
 * (worst 19.8) and 3:1 contrast all PASS for slots 1-5.  Slot 1 is the brand
 * red.  A sixth series never gets a generated hue: it folds into NEUTRAL.
 */
export const SERIES = ["#E12636", "#3987E5", "#C98500", "#199E70", "#9085E9"] as const;
/** Neutral for folded tails and context segments (>= 3:1 on the surface). */
export const NEUTRAL = CONTEXT;

/**
 * Diverging pair: cool blue below / warm red above a neutral grey midpoint.
 * Poles are the darker steps so white in-cell text clears 4.5:1.
 */
export const DIVERGE_LOW = "#1C5CAB";
export const DIVERGE_HIGH = "#C1121F";
export const DIVERGE_MID = "#2B2829";
/** Sequential (one hue, dark surface -> brand red) for magnitude grids. */
export const SEQ_LOW = "#1D1A1B";
export const SEQ_HIGH = "#C1121F";
/** Signed shifts are polarity, not good/bad: blue gains, red loses. */
export const GAIN = SERIES[1];
export const LOSS = SERIES[0];

/** 2px surface gap between touching fills (stacked segments, adjacent bars). */
export const surfaceGap = { stroke: SURFACE, strokeWidth: 2 } as const;

/** Mix two hex colours (t = 0 -> a, 1 -> b) into an opaque hex. */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [from, to] = [parse(a), parse(b)];
  const k = Math.max(0, Math.min(1, t));
  return `#${from.map((value, index) => Math.round(value + (to[index] - value) * k).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, used to pick white or ink text inside a fill. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type ShapeProps = Record<string, unknown>;

/**
 * Bar shape with a 4px rounded data end and a square baseline.  Negative
 * bars (leftward) round their far end, so diverging bars stay anchored.
 * `rounded` lets a stack round only its outermost segment.
 */
export function dataEndBar(orientation: "horizontal" | "vertical", radius = 4, rounded: (props: ShapeProps) => boolean = () => true) {
  return function DataEndBar(input: unknown): ReactElement {
    const props = (input ?? {}) as ShapeProps;
    const rawX = Number(props.x ?? 0); const rawY = Number(props.y ?? 0);
    const rawW = Number(props.width ?? 0); const rawH = Number(props.height ?? 0);
    const x = Math.min(rawX, rawX + rawW); const w = Math.abs(rawW);
    const y = Math.min(rawY, rawY + rawH); const h = Math.abs(rawH);
    const common = { fill: props.fill as string | undefined, fillOpacity: props.fillOpacity as number | undefined, stroke: props.stroke as string | undefined, strokeWidth: props.strokeWidth as number | undefined };
    if (!w || !h) return <g />;
    if (!rounded(props)) return <rect x={x} y={y} width={w} height={h} {...common} />;
    if (orientation === "horizontal") {
      const r = Math.min(radius, w, h / 2);
      if (rawW < 0) return <path d={`M${x + w},${y} H${x + r} Q${x},${y} ${x},${y + r} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w} Z`} {...common} />;
      return <path d={`M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`} {...common} />;
    }
    const r = Math.min(radius, h, w / 2);
    return <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`} {...common} />;
  };
}

/** Legend key that mirrors the mark: rect for bars, short line for lines, ring for dots. */
export function LegendKey({ color, kind = "bar", hollow = false }: { color: string; kind?: "bar" | "line" | "dot" | "dash"; hollow?: boolean }) {
  const style: CSSProperties = kind === "line" ? { width: 14, height: 2, borderRadius: 2, background: color }
    : kind === "dash" ? { width: 14, height: 0, borderRadius: 0, borderTop: `2px dashed ${color}`, background: "transparent" }
    : kind === "dot" ? { width: 10, height: 10, borderRadius: 999, background: hollow ? SURFACE : color, border: hollow ? `2px solid ${color}` : undefined, boxSizing: "border-box" }
    : { width: 10, height: 10, borderRadius: 2, background: color };
  return <i aria-hidden="true" style={style} />;
}

export const TICK_SIZE = 12;
export const LIMITED_N = 30;
export const axisTick = { fill: COLORS.muted, fontSize: TICK_SIZE };
/** Faint horizontal gridlines only. */
export const gridProps = { stroke: COLORS.grid, strokeOpacity: 0.7, vertical: false };
/** Value axes carry no axis line or tick marks: the gridlines do that job. */
export const valueAxis = { axisLine: false, tickLine: false, tick: axisTick, tickMargin: 6 } as const;
/** Category axes keep a hairline baseline and drop tick marks. */
export const categoryAxis = { axisLine: { stroke: "#433A3B" }, tickLine: false } as const;

/** Round a positive maximum up to a "nice" axis bound split into `count` equal steps. */
export function niceTicks(maxValue: number, count = 4): number[] {
  const raw = Math.max(maxValue, Number.EPSILON) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= raw) ?? 10) * magnitude;
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export interface TipRow { label: string; value: string; color?: string; strong?: boolean }
export interface TipSpec { title: string; rows: TipRow[]; note?: string; flag?: string }
interface TipPayload { payload?: Record<string, unknown>; name?: string | number; value?: unknown; color?: string; dataKey?: unknown }
interface TipProps { active?: boolean; payload?: TipPayload[]; label?: unknown }

const tipPanel: CSSProperties = {
  background: "#0B0B0D",
  border: "1px solid #49383A",
  borderRadius: 10,
  padding: "10px 12px",
  color: COLORS.ink,
  fontSize: 12,
  lineHeight: 1.35,
  boxShadow: "0 14px 34px rgba(0, 0, 0, .5)",
  minWidth: 168,
  maxWidth: "min(300px, 78vw)",
  pointerEvents: "none",
  fontVariantNumeric: "tabular-nums",
};

/**
 * Build a Recharts `content` renderer that draws the dashboard tooltip:
 * a readable title, label/value rows with units, then an optional sample
 * note and a limited-sample flag.
 */
export function tooltipContent(build: (datum: Record<string, unknown>, payload: TipPayload[], label: unknown) => TipSpec | null) {
  return function ChartTooltipContent({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    const spec = build(payload[0]?.payload ?? {}, payload, label);
    if (!spec) return null;
    return <div className="chart-tooltip" style={tipPanel}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: spec.rows.length ? 6 : 0, overflowWrap: "anywhere" }}>{spec.title}</div>
      {spec.rows.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", columnGap: 8, rowGap: 3, alignItems: "center" }}>
        {spec.rows.map((row, index) => [
          <i key={`s${index}`} aria-hidden="true" style={{ width: 12, height: 3, borderRadius: 2, background: row.color ?? "transparent", display: "inline-block" }} />,
          <span key={`l${index}`} style={{ color: COLORS.muted }}>{row.label}</span>,
          <span key={`v${index}`} style={{ textAlign: "right", fontWeight: row.strong ? 700 : 600, color: COLORS.ink, whiteSpace: "nowrap" }}>{row.value}</span>,
        ])}
      </div>}
      {spec.note && <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid #2D2829", color: COLORS.muted }}>{spec.note}</div>}
      {spec.flag && <div style={{ marginTop: 5, color: COLORS.pale, fontWeight: 600 }}><span aria-hidden="true">⚠ </span>{spec.flag}</div>}
    </div>;
  };
}

/** Shared <Tooltip> props: stays inside the chart box, no lag animation. */
export const tooltipBase = {
  allowEscapeViewBox: { x: false, y: false },
  wrapperStyle: { outline: "none", zIndex: 6 },
  isAnimationActive: false,
  offset: 14,
} as const;
// ComposedChart draws its cursor as a line, so keep it a faint hairline; charts
// that dim the non-hovered marks pass cursor={false} instead.
export const bandCursor = { stroke: "rgba(255,255,255,.16)", strokeWidth: 1 };
// Crosshair: a solid hairline snapping to the nearest category (never dashed).
export const lineCursor = { stroke: "rgba(255,255,255,.28)", strokeWidth: 1 };

export const limitedFlag = (n: number, unit: string) => n < LIMITED_N ? `Limited sample: n=${n.toLocaleString()} ${unit} (below ${LIMITED_N}) · directional only` : undefined;

// ---------------------------------------------------------------------------
// Hover / focus dimming
// ---------------------------------------------------------------------------

/** Tracks the hovered category so the other marks can be dimmed. */
export function useActiveIndex() {
  const [active, setActive] = useState<number | null>(null);
  const handlers = {
    onMouseMove: (state: { activeTooltipIndex?: number; isTooltipActive?: boolean } | null) => {
      const next = state && state.isTooltipActive !== false && typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : null;
      setActive((current) => current === next ? current : next);
    },
    onMouseLeave: () => setActive(null),
  };
  const opacity = (index: number) => active === null || active === index ? 1 : 0.32;
  return { active, handlers, opacity };
}

// ---------------------------------------------------------------------------
// Entrance motion
// ---------------------------------------------------------------------------

export interface ChartMotion { isAnimationActive: boolean; animationDuration: number; animationEasing: "ease-out"; onAnimationEnd?: () => void }
const STILL: ChartMotion = { isAnimationActive: false, animationDuration: 0, animationEasing: "ease-out" };
const ENTRANCE_MS = 600;
// Charts that already played their entrance this page session; remounts
// (filters, reset, Show data toggles) never replay it.
const played = new Set<string>();
let anonymousShell = 0;

function prefersReducedMotion() {
  return typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Full-surface hover target
// ---------------------------------------------------------------------------

const SNAPPED = "__chartSnapped";

/**
 * Recharts only resolves a tooltip while the pointer is inside the plot area,
 * so the axis gutters (tick labels under a category, the value-axis column)
 * showed nothing.  When the pointer is over the chart surface but outside the
 * plot, swallow that move and re-dispatch it clamped onto the plot edge: the
 * nearest category's band then answers, and the tooltip is still positioned
 * (and contained) by Recharts as usual.
 */
function useSurfaceHover(ref: { current: HTMLDivElement | null }) {
  useEffect(() => {
    const shell = ref.current;
    if (!shell) return;
    const onMove = (event: MouseEvent) => {
      if ((event as unknown as Record<string, unknown>)[SNAPPED]) return;
      const wrapper = (event.target as Element | null)?.closest?.(".recharts-wrapper");
      const surface = wrapper?.querySelector<SVGSVGElement>("svg.recharts-surface");
      const plot = surface?.querySelector<SVGRectElement>("defs clipPath rect");
      if (!wrapper || !surface || !plot) return;
      const box = surface.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return;
      const left = box.left + plot.x.baseVal.value;
      const top = box.top + plot.y.baseVal.value;
      const right = left + plot.width.baseVal.value;
      const bottom = top + plot.height.baseVal.value;
      if (right - left < 2 || bottom - top < 2) return;
      const x = Math.min(Math.max(clientX, left + 1), right - 1);
      const y = Math.min(Math.max(clientY, top + 1), bottom - 1);
      if (x === clientX && y === clientY) return;
      event.stopPropagation();
      const snapped = new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: event.screenX + (x - clientX), screenY: event.screenY + (y - clientY), view: window });
      (snapped as unknown as Record<string, unknown>)[SNAPPED] = true;
      wrapper.dispatchEvent(snapped);
    };
    shell.addEventListener("mousemove", onMove, true);
    return () => shell.removeEventListener("mousemove", onMove, true);
  }, [ref]);
}

/**
 * Chart container.  Pass a render function to receive the motion props for
 * bars: a short ease-out grow only on first mount, only when the chart is on
 * screen and only when reduced motion is not requested.
 */
export function ChartShell({ children, minHeight = 280, part = 0 }: { children: ReactNode | ((motion: ChartMotion) => ReactNode); minHeight?: number; part?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<ChartMotion | null>(typeof children === "function" ? null : STILL);
  useSurfaceHover(ref);
  useLayoutEffect(() => {
    if (motion) return;
    const element = ref.current;
    const id = `${element?.closest("[data-chart-id]")?.getAttribute("data-chart-id") ?? `anon-${anonymousShell++}`}:${part}`;
    const rect = element?.getBoundingClientRect();
    const onScreen = !!rect && rect.top < window.innerHeight && rect.bottom > 0;
    const animate = onScreen && !played.has(id) && !prefersReducedMotion();
    played.add(id);
    // Once the grow finishes, switch animation off so later data changes
    // (filters) re-render instantly instead of replaying the transition.
    setMotion(animate ? { isAnimationActive: true, animationDuration: ENTRANCE_MS, animationEasing: "ease-out", onAnimationEnd: () => setMotion(STILL) } : STILL);
  }, []);
  useEffect(() => {
    if (!motion?.isAnimationActive) return;
    // Safety net in case the chart never mounts its bars (e.g. empty data).
    const timer = window.setTimeout(() => setMotion(STILL), ENTRANCE_MS + 4000);
    return () => window.clearTimeout(timer);
  }, [motion]);
  return <div ref={ref} className="chart-stage" style={{ minHeight }} data-motion={motion ? (motion.isAnimationActive ? "enter" : "still") : "pending"}>
    {motion ? (typeof children === "function" ? children(motion) : children) : null}
  </div>;
}

/** Plain-text explanatory line under a chart (limited samples, omissions). */
export function ChartNote({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "flag" }) {
  return <p className="chart-note" style={{ margin: "6px 0 0", color: tone === "flag" ? COLORS.pale : COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>{children}</p>;
}
