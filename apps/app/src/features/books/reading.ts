import type { Tree, TreeItem } from "@notemax/core";

/** A book's chapters in reading order. The tree keeps folders and books out of a book. */
export const chaptersIn = (book: TreeItem): readonly TreeItem[] => book.children;

/** A page inside a chapter, numbered after it: 6.1, and 6.1.1 one level further in. */
export interface Subtopic {
  item: TreeItem;
  label: string;
  /** 1 right inside the chapter, 2 inside a subtopic, and so on. */
  depth: number;
}

/** A chapter's subtopics in reading order. Folders inside it are not subtopics. */
export function subtopicsOf(chapter: TreeItem, label: string, depth = 1): Subtopic[] {
  const out: Subtopic[] = [];
  let n = 0;
  for (const item of chapter.children) {
    if (item.kind === "folder") continue;
    const own = `${label}.${++n}`;
    out.push({ item, label: own, depth }, ...subtopicsOf(item, own, depth + 1));
  }
  return out;
}

/** A page to read in a book, with its number: a chapter like 6, or a subtopic like 6.1. */
export interface Stop {
  item: TreeItem;
  label: string;
}

/** The chapters as Next and Previous walk them. Subtopics are read inside their chapter's page. */
export const chapterStops = (book: TreeItem): Stop[] => chaptersIn(book).map((item, i) => ({ item, label: String(i + 1) }));

/** Every chapter and subtopic of a book, in reading order. */
export const allStops = (book: TreeItem): Stop[] => chapterStops(book).flatMap((stop) => [stop, ...subtopicsOf(stop.item, stop.label)]);

/** The book a page belongs to: the open book itself, the book its chapter sits in, or for a subtopic the book of its chapter. */
export function bookOf(tree: Tree, activeId: string | null): TreeItem | undefined {
  const seen = new Set<string>();
  for (let item = activeId ? tree.items.get(activeId) : undefined; item && item.kind !== "folder" && !seen.has(item.id); item = tree.items.get(item.parentId)) {
    if (item.kind === "book") return item;
    seen.add(item.id);
  }
  return undefined;
}

/** The chapter a page is, or the chapter a subtopic sits in. Undefined outside books. */
export function chapterOf(tree: Tree, id: string): TreeItem | undefined {
  const seen = new Set<string>();
  for (let item = tree.items.get(id); item && !seen.has(item.id); item = tree.items.get(item.parentId)) {
    if (item.kind === "folder" || item.kind === "book") return undefined;
    if (tree.items.get(item.parentId)?.kind === "book") return item;
    seen.add(item.id);
  }
  return undefined;
}

/** For a written subtopic, the chapter whose page shows it. Boards keep their own page, since they need the room. */
export function hostChapter(tree: Tree, id: string): string | undefined {
  if (tree.items.get(id)?.kind !== "note") return undefined;
  const chapter = chapterOf(tree, id);
  return chapter?.kind === "note" && chapter.id !== id ? chapter.id : undefined;
}

/** A chapter's or subtopic's number, like "6" or "6.2". */
export function labelOf(tree: Tree, id: string): string | undefined {
  const book = bookOf(tree, id);
  return book ? allStops(book).find((stop) => stop.item.id === id)?.label : undefined;
}

/** The subtopics a chapter shows in its own page, numbered. None for anything that is not a chapter. */
export function subtopicsIn(tree: Tree, chapterId: string): Subtopic[] {
  const chapter = chapterOf(tree, chapterId);
  if (chapter?.id !== chapterId) return [];
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
