import type { Tree, TreeItem } from "@notemax/core";

/** One line of a book's contents: a chapter, or a book inside it read as a part. */
export interface Entry {
  item: TreeItem;
  /** 0 for what sits right in the book, 1 inside a part, and so on. */
  depth: number;
  /** Chapters are numbered straight through the parts, as in a printed book. Parts have none. */
  number: number | null;
}

/** A book's contents in reading order. Sub-pages of a chapter are not part of the book. */
export function readingOrder(book: TreeItem): Entry[] {
  const out: Entry[] = [];
  let number = 0;
  const walk = (items: readonly TreeItem[], depth: number) => {
    for (const item of items) {
      if (item.kind === "book") {
        out.push({ item, depth, number: null });
        walk(item.children, depth + 1);
      } else out.push({ item, depth, number: ++number });
    }
  };
  walk(book.children, 0);
  return out;
}

/** Every chapter of a book, parts included, in reading order. */
export const chaptersIn = (book: TreeItem): TreeItem[] => readingOrder(book).flatMap((entry) => (entry.number === null ? [] : [entry.item]));

/**
 * The book the open page belongs to: the open book itself, or the book its
 * chapter sits in. A part counts as part of the book that holds it, so the
 * outermost book is returned.
 */
export function bookOf(tree: Tree, activeId: string | null): TreeItem | undefined {
  const active = activeId ? tree.items.get(activeId) : undefined;
  if (!active) return undefined;
  let book = active.kind === "book" ? active : undefined;
  for (let parent = tree.items.get(active.parentId); parent?.kind === "book"; parent = tree.items.get(parent.parentId)) book = parent;
  return book;
}

/** Words in a book's notes. Null until every note has been counted. Boards have none. */
export function bookWords(book: TreeItem): number | null {
  let total = 0;
  for (const chapter of chaptersIn(book)) {
    if (chapter.kind !== "note") continue;
    if (chapter.words === null) return null;
    total += chapter.words;
  }
  return total;
}
