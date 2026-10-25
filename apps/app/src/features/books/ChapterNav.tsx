import type { Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { bookOf, chapterStops } from "./reading";

/**
 * Chapter navigation stays above formatting on phones, outside the page scroller.
 */
export function ChapterNav({ tree, chapterId: id, onOpen }: { tree: Tree; chapterId: string; onOpen(id: string): void }) {
  const book = bookOf(tree, id);
  if (!book) return null;
  const stops = chapterStops(book);
  const here = stops.findIndex((stop) => stop.item.id === id);
  if (here < 0) return null;
  const previous = stops[here - 1];
  const next = stops[here + 1];
  return (
    <nav className="note-book" aria-label="Book">
      <button className="note-book-link" onClick={() => onOpen(book.id)}>
        <Icon name="book" />
        <span>{book.title || "Untitled book"}</span>
      </button>
      <span>
        Chapter {here + 1} of {stops.length}
      </span>
      <span className="note-book-steps">
        <button
          className="icon-button"
          aria-label="Previous chapter"
          title={previous ? `Previous: ${previous.label} ${previous.item.title || "Untitled"}` : "This is the first"}
          disabled={!previous}
          onClick={() => previous && onOpen(previous.item.id)}
        >
          <Icon name="arrow-left" />
        </button>
        <button
          className="icon-button"
          aria-label="Next chapter"
          title={next ? `Next: ${next.label} ${next.item.title || "Untitled"}` : "This is the last"}
          disabled={!next}
          onClick={() => next && onOpen(next.item.id)}
        >
          <Icon name="arrow-right" />
        </button>
      </span>
    </nav>
  );
}
