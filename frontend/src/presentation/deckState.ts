export type Sequence = "main" | "appendix";
/** Which path through the main deck is being presented. Routes (#present/main-NN) stay valid in both. */
export type Cut = "full" | "executive";
export type SharedState = { slideId: string; sequence: Sequence; revision: number; timerStatus: "idle" | "running" | "paused"; elapsedBeforeStartMs: number; startedAtEpochMs: number | null; cut?: Cut };
export type DeckCommand = { kind: "next" | "previous" | "first" | "last" } | { kind: "go"; slideId: string } | { kind: "start" | "pause" | "reset" } | { kind: "cut"; cut: Cut };
export type SlideIdentity = { id: string; sequence: Sequence };

/**
 * The executive cut: a 10-minute, 8-slide path for judges and CMOs (big idea → plan → where value sits →
 * conversion gap → measurement gap → audience → the test → the ask). Seconds per slide sum to 600.
 */
export const EXECUTIVE_TIMING: Readonly<Record<string, number>> = { "main-01": 60, "main-02": 75, "main-04": 75, "main-06": 90, "main-10": 75, "main-12": 60, "main-14": 90, "main-16": 75 };
export const CUTS: readonly Cut[] = ["full", "executive"];
export const cutOf = (state: Pick<SharedState, "cut">): Cut => state.cut === "executive" ? "executive" : "full";
/** Is this slide on the cut's path? The appendix and the full cut include every slide. */
export const inCut = (slide: SlideIdentity, cut: Cut) => cut === "full" || slide.sequence !== "main" || slide.id in EXECUTIVE_TIMING;
/** The slides Next / Previous walk for a sequence under a cut, in deck order. */
export const cutSlides = <T extends SlideIdentity>(slides: T[], sequence: Sequence, cut: Cut) => slides.filter(x => x.sequence === sequence && inCut(x, cut));

export const initialState = (slides: SlideIdentity[]): SharedState => ({ slideId: slides[0]?.id ?? "main-01", sequence: slides[0]?.sequence ?? "main", revision: 0, timerStatus: "idle", elapsedBeforeStartMs: 0, startedAtEpochMs: null, cut: "full" });
export function validState(value: unknown, slides: SlideIdentity[]): value is SharedState {
  if (!value || typeof value !== "object") return false;
  const s = value as SharedState;
  return slides.some(x => x.id === s.slideId && x.sequence === s.sequence) && Number.isSafeInteger(s.revision) && s.revision >= 0 && ["idle", "running", "paused"].includes(s.timerStatus) && Number.isFinite(s.elapsedBeforeStartMs) && s.elapsedBeforeStartMs >= 0 && (s.startedAtEpochMs === null || (Number.isFinite(s.startedAtEpochMs) && s.startedAtEpochMs >= 0)) && (s.timerStatus === "running" ? s.startedAtEpochMs !== null : s.startedAtEpochMs === null) && (s.cut === undefined || CUTS.includes(s.cut));
}
export function validCommand(value: unknown): value is DeckCommand {
  if (!value || typeof value !== "object") return false;
  const c = value as DeckCommand;
  return ["next", "previous", "first", "last", "start", "pause", "reset"].includes(c.kind) || (c.kind === "go" && typeof c.slideId === "string") || (c.kind === "cut" && CUTS.includes(c.cut));
}
export const elapsedAt = (state: SharedState, now: number) => state.elapsedBeforeStartMs + (state.timerStatus === "running" && state.startedAtEpochMs !== null ? Math.max(0, now - state.startedAtEpochMs) : 0);
export function applyCommand(state: SharedState, command: DeckCommand, slides: SlideIdentity[], now: number): SharedState {
  const next = { ...state, revision: state.revision + 1 };
  if (command.kind === "start") return state.timerStatus === "running" ? state : { ...next, timerStatus: "running", startedAtEpochMs: now };
  if (command.kind === "pause") return { ...next, timerStatus: "paused", elapsedBeforeStartMs: elapsedAt(state, now), startedAtEpochMs: null };
  if (command.kind === "reset") return { ...next, timerStatus: "idle", elapsedBeforeStartMs: 0, startedAtEpochMs: null };
  const position = (id: string) => slides.findIndex(x => x.id === id);
  const at = position(state.slideId);
  if (command.kind === "cut") {
    if (command.cut === cutOf(state)) return state;
    // Switching onto a shorter path from a slide it skips: land on the nearest earlier slide on that path.
    const current = slides[at];
    if (!current || inCut(current, command.cut)) return { ...next, cut: command.cut };
    const path = cutSlides(slides, current.sequence, command.cut);
    const target = [...path].reverse().find(x => position(x.id) < at) ?? path[0];
    return target ? { ...next, cut: command.cut, slideId: target.id, sequence: target.sequence } : { ...next, cut: command.cut };
  }
  const list = cutSlides(slides, state.sequence, cutOf(state));
  let target: SlideIdentity | undefined;
  if (command.kind === "go") target = slides.find(x => x.id === command.slideId);
  else if (command.kind === "first") target = list[0];
  else if (command.kind === "last") target = list[list.length - 1];
  // Relative to deck order, so a slide reached by URL outside the cut still steps onto the cut's path.
  else if (command.kind === "next") target = list.find(x => position(x.id) > at) ?? slides[at];
  else target = [...list].reverse().find(x => position(x.id) < at) ?? slides[at];
  return target ? { ...next, slideId: target.id, sequence: target.sequence } : state;
}
export function slideFromHash(hash: string, slides: SlideIdentity[]): SlideIdentity | undefined {
  const match = /^#present\/(main|appendix)-\d+$/.exec(hash);
  return match ? slides.find(x => `#present/${x.id}` === hash) : undefined;
}
export function storageRead(storage: Storage, key: string): string | null { try { return storage.getItem(key); } catch { return null; } }
export function storageWrite(storage: Storage, key: string, value: string): boolean { try { storage.setItem(key, value); return true; } catch { return false; } }
