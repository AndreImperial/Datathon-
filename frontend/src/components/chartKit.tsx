// Shared chart primitives: palette semantics, axis presets, the one tooltip
// used by every Recharts chart, hover-dimming and the entrance-motion shell.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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
export const GAIN = COLORS.teal;
export const LOSS = COLORS.amber;

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
          <i key={`s${index}`} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: row.color ?? "transparent", display: "inline-block" }} />,
          <span key={`l${index}`} style={{ color: COLORS.muted }}>{row.label}</span>,
          <span key={`v${index}`} style={{ textAlign: "right", fontWeight: row.strong ? 700 : 600, color: COLORS.ink, whiteSpace: "nowrap" }}>{row.value}</span>,
        ])}
      </div>}
      {spec.note && <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid #2D2829", color: COLORS.muted }}>{spec.note}</div>}
      {spec.flag && <div style={{ marginTop: 5, color: COLORS.azure, fontWeight: 600 }}>{spec.flag}</div>}
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
export const lineCursor = { stroke: COLORS.slate, strokeDasharray: "3 3" };

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

/**
 * Chart container.  Pass a render function to receive the motion props for
 * bars: a short ease-out grow only on first mount, only when the chart is on
 * screen and only when reduced motion is not requested.
 */
export function ChartShell({ children, minHeight = 280, part = 0 }: { children: ReactNode | ((motion: ChartMotion) => ReactNode); minHeight?: number; part?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<ChartMotion | null>(typeof children === "function" ? null : STILL);
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
