import { savedStore } from "@/platform/store";

const MAX = 30;

/** Pages opened lately, newest first. Ctrl+K lists them, and the app falls back to them. */
export const recentPages = savedStore<string[]>("recentPages", [], {
  decode(raw) {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error("not a list");
    return value.filter((id): id is string => typeof id === "string").slice(0, MAX);
  },
});

export function addRecent(id: string) {
  const list = recentPages.get();
  if (list[0] === id) return;
  recentPages.set([id, ...list.filter((other) => other !== id)].slice(0, MAX));
}
