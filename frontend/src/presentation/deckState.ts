export type Sequence = "main" | "appendix";
export type SharedState = { slideId: string; sequence: Sequence; revision: number; timerStatus: "idle" | "running" | "paused"; elapsedBeforeStartMs: number; startedAtEpochMs: number | null };
export type DeckCommand = { kind: "next" | "previous" | "first" | "last" } | { kind: "go"; slideId: string } | { kind: "start" | "pause" | "reset" };
export type SlideIdentity = { id: string; sequence: Sequence };
export const initialState = (slides: SlideIdentity[]): SharedState => ({ slideId: slides[0]?.id ?? "main-01", sequence: slides[0]?.sequence ?? "main", revision: 0, timerStatus: "idle", elapsedBeforeStartMs: 0, startedAtEpochMs: null });
export function validState(value: unknown, slides: SlideIdentity[]): value is SharedState {
  if (!value || typeof value !== "object") return false;
  const s = value as SharedState;
  return slides.some(x => x.id === s.slideId && x.sequence === s.sequence) && Number.isSafeInteger(s.revision) && s.revision >= 0 && ["idle", "running", "paused"].includes(s.timerStatus) && Number.isFinite(s.elapsedBeforeStartMs) && s.elapsedBeforeStartMs >= 0 && (s.startedAtEpochMs === null || (Number.isFinite(s.startedAtEpochMs) && s.startedAtEpochMs >= 0)) && (s.timerStatus === "running" ? s.startedAtEpochMs !== null : s.startedAtEpochMs === null);
}
export function validCommand(value: unknown): value is DeckCommand {
  if (!value || typeof value !== "object") return false;
  const c = value as DeckCommand;
  return ["next", "previous", "first", "last", "start", "pause", "reset"].includes(c.kind) || (c.kind === "go" && typeof c.slideId === "string");
}
export const elapsedAt = (state: SharedState, now: number) => state.elapsedBeforeStartMs + (state.timerStatus === "running" && state.startedAtEpochMs !== null ? Math.max(0, now - state.startedAtEpochMs) : 0);
export function applyCommand(state: SharedState, command: DeckCommand, slides: SlideIdentity[], now: number): SharedState {
  const next = { ...state, revision: state.revision + 1 };
  if (command.kind === "start") return state.timerStatus === "running" ? state : { ...next, timerStatus: "running", startedAtEpochMs: now };
  if (command.kind === "pause") return { ...next, timerStatus: "paused", elapsedBeforeStartMs: elapsedAt(state, now), startedAtEpochMs: null };
  if (command.kind === "reset") return { ...next, timerStatus: "idle", elapsedBeforeStartMs: 0, startedAtEpochMs: null };
  const list = slides.filter(x => x.sequence === state.sequence);
  const index = Math.max(0, list.findIndex(x => x.id === state.slideId));
  const target = command.kind === "go" ? slides.find(x => x.id === command.slideId) : list[command.kind === "first" ? 0 : command.kind === "last" ? list.length - 1 : Math.max(0, Math.min(list.length - 1, index + (command.kind === "next" ? 1 : -1)))];
  return target ? { ...next, slideId: target.id, sequence: target.sequence } : state;
}
export function slideFromHash(hash: string, slides: SlideIdentity[]): SlideIdentity | undefined {
  const match = /^#present\/(main|appendix)-\d+$/.exec(hash);
  return match ? slides.find(x => `#present/${x.id}` === hash) : undefined;
}
export function storageRead(storage: Storage, key: string): string | null { try { return storage.getItem(key); } catch { return null; } }
export function storageWrite(storage: Storage, key: string, value: string): boolean { try { storage.setItem(key, value); return true; } catch { return false; } }
