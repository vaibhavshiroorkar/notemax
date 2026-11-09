import type { Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { bookOf, chapterStops, chapterWordOf } from "./reading";

/** The book line at the top of a chapter: the book, where this chapter is in it, and the arrows to the ones beside it. */
export function ChapterNav({ tree, chapterId: id, onOpen }: { tree: Tree; chapterId: string; onOpen(id: string): void }) {
  const book = bookOf(tree, id);
  if (!book) return null;
  const stops = chapterStops(book);
  const here = stops.findIndex((stop) => stop.item.id === id);
  if (here < 0) return null;
  const previous = stops[here - 1];
  const next = stops[here + 1];
  // "Chapter 3 of 9", or the book's own word, or "3 of 9" with none. A book without numbers shows no count.
  // Pages without a number, like a prologue, are not counted.
  const where = stops[here].label && [chapterWordOf(book), stops[here].label, "of", stops.filter((stop) => stop.label).length].filter(Boolean).join(" ");
  const named = (stop: (typeof stops)[number]) => [stop.label, stop.item.title || "Untitled"].filter(Boolean).join(" ");
  return (
    <nav className="note-book" aria-label="Book">
      <button className="note-book-link" onClick={() => onOpen(book.id)}>
        <Icon name="book" />
        <span>{book.title || "Untitled book"}</span>
      </button>
      {where && <span className="note-book-where">{where}</span>}
      <span className="note-book-steps">
        <button
          className="icon-button"
          aria-label="Previous chapter"
          title={previous ? `Previous: ${named(previous)}` : "This is the first"}
          disabled={!previous}
          onClick={() => previous && onOpen(previous.item.id)}
        >
          <Icon name="arrow-left" />
        </button>
        <button
          className="icon-button"
          aria-label="Next chapter"
          title={next ? `Next: ${named(next)}` : "This is the last"}
          disabled={!next}
          onClick={() => next && onOpen(next.item.id)}
        >
          <Icon name="arrow-right" />
        </button>
      </span>
    </nav>
  );
}
