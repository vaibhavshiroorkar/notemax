import { getPref, setPref } from "@/platform/prefs";

/** Where someone was in a note: how far down, and where the cursor or selection was. */
export interface Position {
  top: number;
  from: number;
  to: number;
}

const KEY = "positions";
// Enough for every note someone actually moves between. The oldest drop off first.
const MAX = 200;
// Scrolling and typing move these constantly, so they are written in batches.
const SAVE_MS = 1000;

function load(): Map<string, Position> {
  try {
    const value: unknown = JSON.parse(getPref(KEY) ?? "[]");
    return new Map(Array.isArray(value) ? (value as [string, Position][]) : []);
  } catch {
    return new Map();
  }
}

// A Map keeps insertion order, so moving a note to the end on every change
// makes the first entries the least recently used.
const positions = load();
let timer: ReturnType<typeof setTimeout> | undefined;

function save() {
  clearTimeout(timer);
  timer = undefined;
  setPref(KEY, JSON.stringify([...positions]));
}

addEventListener("pagehide", () => timer && save());
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && timer && save());

export function getPosition(id: string): Position | undefined {
  return positions.get(id);
}

export function setPosition(id: string, change: Partial<Position>) {
  const next = { top: 0, from: 1, to: 1, ...positions.get(id), ...change };
  positions.delete(id);
  positions.set(id, next);
  while (positions.size > MAX) positions.delete(positions.keys().next().value!);
  timer ??= setTimeout(save, SAVE_MS);
}
