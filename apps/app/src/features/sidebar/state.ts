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
  const { sort } = sidebarView.get();
  const walk = (items: readonly TreeItem[]) => {
    for (const item of sortItems(items, sort)) {
      out.push(item.id);
      if (item.kind !== "book" && !closed.has(item.id)) walk(item.children);
    }
  };
  for (const group of topGroups(tree)) walk(group.items);
  return out;
}

export type SortBy = "manual" | "title" | "created" | "edited";
export type GroupBy = "none" | "kind";
const SORTS: SortBy[] = ["manual", "title", "created", "edited"];

/** How the sidebar orders and groups its rows. Kept across restarts. */
export const sidebarView = savedStore<{ sort: SortBy; group: GroupBy }>(
  "sidebarView",
  { sort: "manual", group: "none" },
  {
    decode(raw) {
      const value = JSON.parse(raw) as { sort?: SortBy; group?: GroupBy };
      return { sort: SORTS.includes(value.sort!) ? value.sort! : "manual", group: value.group === "kind" ? "kind" : "none" };
    },
  },
);

const byTitle = (a: TreeItem, b: TreeItem) => (a.title || "Untitled").localeCompare(b.title || "Untitled", undefined, { numeric: true, sensitivity: "base" });

/** One level of rows in the chosen order. Sorted, folders stay above pages, as in a file manager. */
export function sortItems(items: readonly TreeItem[], sort: SortBy): readonly TreeItem[] {
  if (sort === "manual") return items;
  const key = sort === "title" ? byTitle : sort === "created" ? (a: TreeItem, b: TreeItem) => b.createdAt - a.createdAt : (a: TreeItem, b: TreeItem) => b.editedAt - a.editedAt;
  const folder = (item: TreeItem) => (item.kind === "folder" ? 0 : 1);
  return [...items].sort((a, b) => folder(a) - folder(b) || (folder(a) === 0 ? byTitle(a, b) : key(a, b)));
}

// Headings when the top level is grouped by kind, in the + menu's order.
const GROUP_NAMES: Record<string, string> = { folder: "Folders", note: "Notes", book: "Books", board: "Boards" };

// Kinds a plugin added go after the known ones.
const groupRank = (kind: string) => (kind in GROUP_NAMES ? Object.keys(GROUP_NAMES).indexOf(kind) : 99);

/** The top level, in groups with a heading when grouped by kind. Each group's rows are not sorted yet. */
export function topGroups(tree: Tree): { label: string | null; items: TreeItem[] }[] {
  if (sidebarView.get().group === "none") return [{ label: null, items: tree.top }];
  const groups = new Map<string, TreeItem[]>();
  for (const item of tree.top) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  return [...groups.entries()]
    .sort(([a], [b]) => groupRank(a) - groupRank(b))
    .map(([kind, items]) => ({ label: GROUP_NAMES[kind] ?? kind, items }));
}

/** The title search under the Notes heading. Null while it is closed. */
export const titleQuery = createStore<string | null>(null);
