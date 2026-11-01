// Shared motion system for the dashboard, charts and deck.
//
// Rules every caller follows:
// - Motion explains structure (what arrived, what changed, where you are); it never decorates.
// - Only transform, opacity, clip-path and stroke-dashoffset animate; never layout properties.
// - Content is readable at rest: entrances start from a visible-safe state when motion is off,
//   play once per view, and never replay on filter, refresh or redraw.
// - prefers-reduced-motion and print turn every effect into its final state immediately.

export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  base: 0.38,
  slow: 0.6,
  count: 1.1,
  draw: 0.9,
} as const;

export const EASE = {
  out: "power3.out",
  inOut: "power2.inOut",
  settle: "back.out(1.4)",
  css: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const STAGGER = {
  tight: 0.04,
  base: 0.07,
  loose: 0.12,
} as const;

// Entrance presets, from largest to smallest element: big objects travel further.
export const ENTER = {
  // KPI tiles "deal in": alternate a small tilt so a row reads as a hand of cards.
  tile: (index: number) => ({ y: 40, rotate: index % 2 === 0 ? -2.5 : 2.5, scale: 0.95, autoAlpha: 0 }),
  panel: { y: 26, scale: 0.985, autoAlpha: 0 },
  card: { y: 12, autoAlpha: 0 },
  row: { y: 6, autoAlpha: 0 },
} as const;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function isPrinting(): boolean {
  try {
    return typeof window !== "undefined" && (window.matchMedia("print").matches || document.documentElement.classList.contains("print-prep"));
  } catch {
    return false;
  }
}

export function motionAllowed(): boolean {
  return !prefersReducedMotion() && !isPrinting();
}

// Ease-out cubic, used by the count-up so numbers decelerate into their final value.
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

// Value shown at progress t (0..1) of a count from `from` to `to`.
export function countValueAt(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(t);
}

const counted = new WeakSet<Element>();

// Count a number up into an element once. The final formatted value is written first so the
// element is correct at rest, for screen readers and if motion is off; aria-hidden is not used.
export function countUp(element: HTMLElement, to: number, format: (value: number) => string, options: { from?: number; duration?: number; delay?: number } = {}): () => void {
  const finalText = format(to);
  element.textContent = finalText;
  if (!Number.isFinite(to) || counted.has(element) || !motionAllowed()) return () => undefined;
  counted.add(element);
  const from = options.from ?? 0;
  const duration = (options.duration ?? DURATION.count) * 1000;
  const delay = (options.delay ?? 0) * 1000;
  element.setAttribute("aria-label", finalText);
  let frame = 0;
  let start = 0;
  const step = (now: number) => {
    if (!start) start = now + delay;
    const t = (now - start) / duration;
    if (t < 0) { frame = requestAnimationFrame(step); return; }
    element.textContent = t >= 1 ? finalText : format(countValueAt(from, to, t));
    if (t < 1) frame = requestAnimationFrame(step);
    else element.removeAttribute("aria-label");
  };
  element.textContent = format(from);
  frame = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(frame); element.textContent = finalText; element.removeAttribute("aria-label"); };
}

// Briefly highlight an element whose value just changed (e.g. a recalculated budget).
export function flash(element: HTMLElement): void {
  if (!motionAllowed()) return;
  element.classList.remove("motion-flash");
  void element.offsetWidth;
  element.classList.add("motion-flash");
}

// ---------------------------------------------------------------------------------------------
// Additive helpers shared by the dashboard, charts and deck.

// EASE.css as a cubic-bezier tuple, for libraries (motion/react, WAAPI) that take numbers.
export const EASE_BEZIER = [0.22, 1, 0.36, 1] as const;

// Publish the timing tokens as CSS custom properties so stylesheet transitions and keyframes use
// the same values as scripted motion (styles.css reads var(--motion-*) with matching fallbacks).
export function applyMotionTokens(root: HTMLElement = document.documentElement): void {
  (Object.keys(DURATION) as Array<keyof typeof DURATION>).forEach((key) => root.style.setProperty(`--motion-${key}`, `${Math.round(DURATION[key] * 1000)}ms`));
  root.style.setProperty("--motion-ease", EASE.css);
}

const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;
const YEAR_TOKEN = /^(?:19|20)\d\d$/;
const GROUPED = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

type NumberPart = { value: number; decimals: number; grouped: boolean };

// A displayed figure ("$24.9M", "10.2%", "2,034 domains", "30.1% → 20.5%", "+3.1 pp") as a
// template: format(progress) rebuilds the same text with every number scaled by progress, keeping
// its decimals and thousands grouping, so $24.9M counts $0.0M → $24.9M and format(1) is the
// original text exactly. Years stay fixed. Returns null when the text has nothing to count.
export function numberTemplate(text: string): ((progress: number) => string) | null {
  const parts: Array<string | NumberPart> = [];
  let last = 0;
  let counted = 0;
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const raw = match[0].replace(/,+$/, "");
    const index = match.index ?? 0;
    const value = Number(raw.replaceAll(",", ""));
    const yearRangeEnd = /(?:19|20)\d\d[–-]$/.test(text.slice(Math.max(0, index - 5), index));
    if (!Number.isFinite(value) || YEAR_TOKEN.test(raw) || yearRangeEnd || (raw.includes(",") && !GROUPED.test(raw))) continue;
    parts.push(text.slice(last, index), { value, decimals: raw.split(".")[1]?.length ?? 0, grouped: raw.includes(",") });
    last = index + raw.length;
    if (value !== 0) counted += 1;
  }
  if (!counted) return null;
  parts.push(text.slice(last));
  const format = (progress: number) => parts.map((part) => {
    if (typeof part === "string") return part;
    const value = progress >= 1 ? part.value : part.value * Math.max(0, progress);
    return part.grouped
      ? value.toLocaleString("en-US", { minimumFractionDigits: part.decimals, maximumFractionDigits: part.decimals })
      : value.toFixed(part.decimals);
  }).join("");
  return format(1) === text ? format : null;
}

// Count the figure an element already displays (rendered by React with the dashboard's own
// formatter) up from zero. The element's original text nodes are restored when the count ends,
// so the framework keeps ownership of them; at rest the text is the final value.
export function countUpDisplayed(element: HTMLElement, options: { duration?: number; delay?: number } = {}): () => void {
  const text = element.textContent ?? "";
  const format = numberTemplate(text);
  if (!format || !motionAllowed()) return () => undefined;
  const original = Array.from(element.childNodes);
  // Hold the box at its final size while the digits change, so a shorter interim value
  // ("$9.9M" before "$24.9M") never reflows its neighbours: count-up adds no layout shift.
  // Call it before any entrance transform is applied: the box is measured as rendered.
  const box = element.getBoundingClientRect();
  const held = { minWidth: element.style.minWidth, minHeight: element.style.minHeight };
  element.style.minWidth = `${box.width}px`;
  element.style.minHeight = `${box.height}px`;
  const stop = countUp(element, 1, format, options);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    window.clearTimeout(timer);
    stop();
    if (element.textContent === text) element.replaceChildren(...original);
    element.style.minWidth = held.minWidth;
    element.style.minHeight = held.minHeight;
  };
  const timer = window.setTimeout(restore, ((options.delay ?? 0) + (options.duration ?? DURATION.count)) * 1000 + 80);
  return restore;
}
