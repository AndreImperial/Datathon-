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
