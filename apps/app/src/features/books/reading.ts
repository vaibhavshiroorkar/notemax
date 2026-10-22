import type { Tree, TreeItem } from "@notemax/core";

/** One line of a book's contents: a chapter, or a book inside it read as a part. */
export interface Entry {
  item: TreeItem;
  /** 0 for what sits right in the book, 1 inside a part, and so on. */
  depth: number;
  /** Chapters are numbered straight through the parts, as in a printed book. Parts have none. */
  number: number | null;
}

/** A book's chapters and parts in reading order. Subtopics are listed by subtopicsOf. */
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

/** A page inside a chapter, numbered after it: 6.1, and 6.1.1 one level further in. */
export interface Subtopic {
  item: TreeItem;
  label: string;
  /** 1 right inside the chapter, 2 inside a subtopic, and so on. */
  depth: number;
}

/** A chapter's subtopics in reading order. Books and folders inside it are not subtopics. */
export function subtopicsOf(chapter: TreeItem, label: string, depth = 1): Subtopic[] {
  const out: Subtopic[] = [];
  let n = 0;
  for (const item of chapter.children) {
    if (item.kind === "book" || item.kind === "folder") continue;
    const own = `${label}.${++n}`;
    out.push({ item, label: own, depth }, ...subtopicsOf(item, own, depth + 1));
  }
  return out;
}

/** True when a chapter shows its subtopics in its own page rather than one page each. */
const subtopicsTogether = (chapter: TreeItem) => chapter.props.subtopics === "together";

/** A page to read in a book, with its number: a chapter like 6, or a subtopic like 6.1. */
export interface Stop {
  item: TreeItem;
  label: string;
}

/** Every chapter and subtopic of a book, in reading order. */
export function allStops(book: TreeItem): Stop[] {
  return readingOrder(book).flatMap(({ item, number }) => (number === null ? [] : [{ item, label: String(number) }, ...subtopicsOf(item, String(number))]));
}

/** The pages Next and Previous walk through: subtopics shown inside their chapter are skipped. */
export function readingStops(book: TreeItem): Stop[] {
  return readingOrder(book).flatMap(({ item, number }) => {
    if (number === null) return [];
    const label = String(number);
    return [{ item, label }, ...(subtopicsTogether(item) ? [] : subtopicsOf(item, label))];
  });
}

/**
 * The book a page belongs to: the open book itself, the book its chapter sits
 * in, or for a subtopic the book of its chapter. A part counts as part of the
 * book that holds it, so the outermost book is returned.
 */
export function bookOf(tree: Tree, activeId: string | null): TreeItem | undefined {
  const active = activeId ? tree.items.get(activeId) : undefined;
  if (!active) return undefined;
  let book = active.kind === "book" ? active : undefined;
  let parent = tree.items.get(active.parentId);
  // Up from a subtopic through the pages it sits in, to its chapter's book.
  if (!book) while (parent && parent.kind !== "book" && parent.kind !== "folder") parent = tree.items.get(parent.parentId);
  for (; parent?.kind === "book"; parent = tree.items.get(parent.parentId)) book = parent;
  return book;
}

/** The chapter a page is, or the chapter a subtopic sits in. Undefined outside books, and for parts. */
export function chapterOf(tree: Tree, id: string): TreeItem | undefined {
  for (let item = tree.items.get(id); item; item = tree.items.get(item.parentId)) {
    if (item.kind === "folder") return undefined;
    if (tree.items.get(item.parentId)?.kind === "book") return item.kind === "book" ? undefined : item;
  }
  return undefined;
}

/** A chapter's or subtopic's number, like "6" or "6.2". */
export function labelOf(tree: Tree, id: string): string | undefined {
  const book = bookOf(tree, id);
  return book ? allStops(book).find((stop) => stop.item.id === id)?.label : undefined;
}

/** The subtopics a chapter shows in its own page, or none when they have pages of their own. */
export function inlineSubtopics(tree: Tree, chapterId: string): Subtopic[] {
  const chapter = tree.items.get(chapterId);
  if (!chapter || !subtopicsTogether(chapter) || chapterOf(tree, chapterId)?.id !== chapterId) return [];
  const label = labelOf(tree, chapterId);
  return label ? subtopicsOf(chapter, label) : [];
}

/** Words in a book's notes, subtopics included. Null until every note has been counted. Boards have none. */
export function bookWords(book: TreeItem): number | null {
  let total = 0;
  for (const { item } of allStops(book)) {
    if (item.kind !== "note") continue;
    if (item.words === null) return null;
    total += item.words;
  }
  return total;
}
