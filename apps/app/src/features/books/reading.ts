import type { Tree, TreeItem, TreeNode } from "@notemax/core";
import { createStore } from "@/platform/store";

// How much of the book its page shows: chapter titles alone, the outline of
// chapters and subtopics (the usual choice), the first lines of each chapter,
// or every chapter written out.
export type BookView = "chapters" | "titles" | "previews" | "whole";

/**
 * A page setting, so the choice syncs with the book and each book keeps its own.
 * Books from before the Chapters choice kept it as bookSubtopics "hidden".
 */
export const bookViewOf = (book: TreeNode | TreeItem): BookView => {
  const view = book.props.bookView;
  if (view === "whole" || view === "previews" || view === "chapters") return view;
  return book.props.bookSubtopics === "hidden" ? "chapters" : "titles";
};

/** The chapter or subtopic at the top of the screen while a book is read as one page (Full text). */
export const pieceInView = createStore<string | null>(null);

/** A book's chapters in reading order. The tree keeps folders and books out of a book. */
const chaptersIn = (book: TreeItem): readonly TreeItem[] => book.children;

/** How a book numbers its chapters. Subtopics follow: 6.1, or VI.1. */
export type ChapterNumbers = "numbers" | "roman" | "none";

/** A page setting, like the view, so each book keeps its own and it syncs with the book. */
export const chapterNumbersOf = (book: TreeItem | TreeNode): ChapterNumbers => {
  const kind = book.props.chapterNumbers;
  return kind === "roman" || kind === "none" ? kind : "numbers";
};

/** What a book calls its chapters, like Part or Lesson. Empty shows no word at all. */
export const chapterWordOf = (book: TreeItem | TreeNode): string => {
  const word = book.props.chapterWord;
  return typeof word === "string" ? word.trim() : "Chapter";
};

/** The word for more than one, for the book's buttons and counts: Part, parts. Plain chapters without a word. */
export function chapterNoun(book: TreeItem | TreeNode, many = false): string {
  const word = (chapterWordOf(book) || "Chapter").toLowerCase();
  if (!many) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const roman = (n: number) => ROMAN.reduce((out, [value, letters]) => {
  for (; n >= value; n -= value) out += letters;
  return out;
}, "");

/** A page inside a chapter, numbered after it: 6.1, and 6.1.1 one level further in. Empty in a book without numbers. */
export interface Subtopic {
  item: TreeItem;
  label: string;
  /** 1 right inside the chapter, 2 inside a subtopic, and so on. */
  depth: number;
}

/**
 * A chapter's subtopics in reading order. Folders inside it are not subtopics.
 * With no label, as for a note outside any book, they number from 1. An
 * empty label is a chapter in a book without numbers, so they have none too.
 * Counting down, as a note set to newest first does, each keeps its number
 * when a new one arrives on top.
 */
export function subtopicsOf(chapter: TreeItem, label: string | undefined, depth = 1, down = false): Subtopic[] {
  const out: Subtopic[] = [];
  const items = chapter.children.filter((item) => item.kind !== "folder");
  items.forEach((item, i) => {
    const n = down ? items.length - i : i + 1;
    const own = label === undefined ? String(n) : label && `${label}.${n}`;
    out.push({ item, label: own, depth }, ...subtopicsOf(item, own, depth + 1));
  });
  return out;
}

/** A page to read in a book, with its number: a chapter like 6, or a subtopic like 6.1. Empty in a book without numbers. */
export interface Stop {
  item: TreeItem;
  label: string;
}

/** A page in a book left without a number, like a prologue or an interlude. The chapters around it count on as if it were not there. */
export const isUnnumbered = (item: TreeItem | TreeNode) => item.props.unnumbered === true;

/** The chapters as Next and Previous walk them. Subtopics are read inside their chapter's page. */
export function chapterStops(book: TreeItem): Stop[] {
  const numbers = chapterNumbersOf(book);
  let n = 0;
  return chaptersIn(book).map((item) => {
    if (numbers === "none" || isUnnumbered(item)) return { item, label: "" };
    n++;
    return { item, label: numbers === "roman" ? roman(n) : String(n) };
  });
}

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
function labelOf(tree: Tree, id: string): string | undefined {
  const book = bookOf(tree, id);
  return book ? allStops(book).find((stop) => stop.item.id === id)?.label : undefined;
}

/** The subtopics a chapter shows in its own page, numbered. None for anything that is not a chapter. */
export function subtopicsIn(tree: Tree, chapterId: string): Subtopic[] {
  const chapter = chapterOf(tree, chapterId);
  if (chapter?.id !== chapterId) return [];
  const label = labelOf(tree, chapterId);
  return label === undefined ? [] : subtopicsOf(chapter, label);
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
