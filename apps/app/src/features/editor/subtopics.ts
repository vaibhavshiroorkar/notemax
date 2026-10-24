import { setKind, setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import { bookOf, subtopicsOf, type Subtopic } from "@/features/books/reading";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";

// Any note can show the pages inside it on its own page, as numbered
// subtopics, the way a book's chapters do. It is a choice per note, off at
// first, so pages inside a note keep opening on their own unless asked.

const PROP = "subtopics";

/** A note set to show the pages inside it as subtopics. Chapters do it in their book whatever this says. */
export const showsSubtopics = (node: TreeNode) => node.kind === "note" && node.props[PROP] === "inline";

/** The subtopics a note shows, numbered from 1. None for a note in a book: its chapter shows them. */
export function noteSubtopics(tree: Tree, id: string): Subtopic[] {
  const item = tree.items.get(id);
  if (!item || !showsSubtopics(item) || bookOf(tree, id)) return [];
  return subtopicsOf(item, "");
}

/**
 * The note whose page shows this one: the outermost note above it set to
 * show subtopics. Boards keep their own page, since they need the room.
 */
export function inlineHost(tree: Tree, id: string): string | undefined {
  const item = tree.items.get(id);
  if (item?.kind !== "note") return undefined;
  let host: string | undefined;
  const seen = new Set<string>();
  for (let above = tree.items.get(item.parentId); above && !seen.has(above.id); above = tree.items.get(above.parentId)) {
    seen.add(above.id);
    // A book's chapters show their own subtopics.
    if (above.kind === "book") return undefined;
    if (above.kind !== "note") break;
    if (showsSubtopics(above)) host = above.id;
  }
  return host;
}

/** Turns the choice on or off for a note. */
export const setShowsSubtopics = (app: AppContext, id: string, on: boolean) => setProp(app.doc, id, PROP, on ? "inline" : null);

/** The note a page menu or a right click inside a note is about, when it may choose: not in a book. */
function noteOf(target: ContextTarget, app: AppContext): TreeNode | null {
  const node = target.type === "page" ? target.node : target.type === "editor" ? app.tree.byId.get(target.noteId) : undefined;
  return node?.kind === "note" && !bookOf(app.tree, node.id) ? node : null;
}

export const SUBTOPICS_MENU: ContextMenuItem[] = [
  {
    id: "notes.subtopics.on",
    inside: "options",
    title: "Show pages inside as subtopics",
    group: "layout",
    icon: "outline",
    targets: ["page", "editor"],
    when: (target, app) => {
      const node = noteOf(target, app);
      return !!node && !showsSubtopics(node);
    },
    run: (target, app) => setShowsSubtopics(app, noteOf(target, app)!.id, true),
  },
  {
    id: "notes.subtopics.off",
    inside: "options",
    title: "Open pages inside on their own",
    group: "layout",
    icon: "outline",
    targets: ["page", "editor"],
    when: (target, app) => {
      const node = noteOf(target, app);
      return !!node && showsSubtopics(node);
    },
    run: (target, app) => setShowsSubtopics(app, noteOf(target, app)!.id, false),
  },
];

/**
 * Makes a folder one page: a note that shows what was in the folder as its
 * subtopics. Nothing moves, since a note may hold anything a folder holds.
 * A journal (the place for daily notes) keeps its days newest first.
 */
export function turnIntoOnePage(app: AppContext, id: string) {
  const node = app.tree.byId.get(id);
  if (node?.kind !== "folder") return;
  app.doc.transact(() => {
    setKind(app.doc, id, "note");
    setProp(app.doc, id, PROP, "inline");
    if (node.props.dailyFolder === true && (node.props.sort === undefined || node.props.sort === "title")) setProp(app.doc, id, "sort", "days");
  });
  app.open(id);
}

export const ONE_PAGE_MENU: ContextMenuItem = {
  id: "folders.onePage",
  inside: "options",
  title: "Turn into one page",
  group: "layout",
  icon: "outline",
  targets: ["page"],
  when: (target) => target.type === "page" && target.node.kind === "folder",
  run: (target, app) => target.type === "page" && turnIntoOnePage(app, target.node.id),
};

/** Subtopics whose title has every word typed, for the filter boxes. */
export function filterSubtopics(list: Subtopic[], query: string): Subtopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter(({ item }) => words.every((word) => (item.title || "Untitled").toLowerCase().includes(word)));
}

/** Past this many, a list of subtopics sits in a box of its own with a filter. */
export const BOX_FROM = 6;

export type { Subtopic, TreeItem };
