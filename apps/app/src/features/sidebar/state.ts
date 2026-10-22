import type { Tree, TreeItem } from "@notemax/core";
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

/** Rows picked with Ctrl+click or Shift+click. Empty when only the open page is marked. */
export const selection = createStore<ReadonlySet<string>>(new Set());

// Where a Shift+click range starts: the last row clicked without Shift.
let anchor: string | null = null;

export function clearSelection() {
  if (selection.get().size) selection.set(new Set());
}

/** Ctrl+click: adds the row, or takes it out. The open page joins in, as in a file manager. */
export function toggleSelected(id: string, current: string | null) {
  const next = new Set(selection.get());
  if (!next.size && current && current !== id) next.add(current);
  if (!next.delete(id)) next.add(id);
  anchor = id;
  selection.set(next);
}

/** Shift+click: every row shown between the last one clicked and this one. */
export function selectRange(tree: Tree, id: string, current: string | null) {
  const order = shownOrder(tree);
  const from = order.indexOf(anchor ?? current ?? id);
  const to = order.indexOf(id);
  if (to < 0) return;
  const [start, end] = from < 0 ? [to, to] : [Math.min(from, to), Math.max(from, to)];
  selection.set(new Set(order.slice(start, end + 1)));
}

/** A plain click starts over: no selection, and the next range starts here. */
export function plainClick(id: string) {
  anchor = id;
  clearSelection();
}

/** Selected ids in the order the sidebar shows them, so a moved group keeps its order. */
export const selectedInOrder = (tree: Tree): string[] => shownOrder(tree).filter((id) => selection.get().has(id));

/** Every row the sidebar shows, top to bottom: open folders show their contents, books never do. */
function shownOrder(tree: Tree): string[] {
  const out: string[] = [];
  const closed = collapsed.get();
  const walk = (items: readonly TreeItem[]) => {
    for (const item of items) {
      out.push(item.id);
      if (item.kind !== "book" && !closed.has(item.id)) walk(item.children);
    }
  };
  walk(tree.top);
  return out;
}
