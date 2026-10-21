import { createStore } from "@/platform/store";

/**
 * Tags the sidebar is filtered by. An item must carry all of them. Kept in
 * memory only: after a restart the full sidebar shows, so notes never seem lost.
 */
export const tagFilter = createStore<string[]>([]);

export function toggleTagFilter(tag: string) {
  const current = tagFilter.get();
  tagFilter.set(current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
}

/** Asks the open page's tag bar to open its input. A counter, so asking twice still counts. */
export const addTagRequests = createStore(0);
