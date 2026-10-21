import { createStore, savedStore } from "@/platform/store";
import type { DropTarget } from "./drag";

// Sidebar state lives in stores rather than in props, so each row watches only
// its own part of it (see useSelect) and a change redraws a few rows, not all.

/** Folders and books closed in the sidebar, remembered across restarts. */
export const collapsed = savedStore<Set<string>>("collapsed", new Set(), {
  decode: (raw) => new Set(JSON.parse(raw) as string[]),
  encode: (value) => JSON.stringify([...value]),
});

export function toggleCollapsed(id: string) {
  const next = new Set(collapsed.get());
  if (!next.delete(id)) next.add(id);
  collapsed.set(next);
}

/** Opens folders, so whatever was just added, dropped or opened inside them is visible. */
export function expand(...ids: string[]) {
  const current = collapsed.get();
  if (!ids.some((id) => current.has(id))) return;
  const next = new Set(current);
  ids.forEach((id) => next.delete(id));
  collapsed.set(next);
}

/** The folder whose name is being typed in its row. */
export const editingId = createStore<string | null>(null);

export const dropTarget = createStore<DropTarget | null>(null);

/** The row marked as the open page. For a chapter, that is its book. */
export const markedId = createStore<string | null>(null);
