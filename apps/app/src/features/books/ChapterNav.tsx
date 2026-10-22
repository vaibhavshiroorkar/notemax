import type { Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { bookOf, chapterOf, chaptersIn, labelOf, readingStops } from "./reading";

/**
 * Shown above a chapter or subtopic: its book, its part if it has one, where it
 * sits in the book, and arrows to the chapter before and after. On a phone it
 * comes back with the top bar when scrolling up, so the way back is near.
 */
export function ChapterNav({ tree, chapterId: id, onOpen }: { tree: Tree; chapterId: string; onOpen(id: string): void }) {
  const book = bookOf(tree, id);
  const chapter = chapterOf(tree, id);
  if (!book || !chapter) return null;
  const chapters = chaptersIn(book);
  const number = chapters.findIndex((c) => c.id === chapter.id) + 1;
  const parent = tree.items.get(chapter.parentId);
  const part = parent && parent.id !== book.id ? parent : undefined;
  const stops = readingStops(book);
  const here = stops.findIndex((stop) => stop.item.id === id);
  const previous = here > 0 ? stops[here - 1] : undefined;
  const next = here >= 0 ? stops[here + 1] : undefined;
  return (
    <nav className="note-book" aria-label="Book">
      <button className="note-book-link" onClick={() => onOpen(book.id)}>
        <Icon name="book" />
        <span>{book.title || "Untitled book"}</span>
      </button>
      {part && (
        <button className="note-book-link" onClick={() => onOpen(part.id)}>
          <span>{part.title || "Untitled part"}</span>
        </button>
      )}
      {chapter.id === id ? (
        <span>
          Chapter {number} of {chapters.length}
        </span>
      ) : (
        <>
          <button className="note-book-link" onClick={() => onOpen(chapter.id)}>
            <span>
              {number}. {chapter.title || "Untitled"}
            </span>
          </button>
          <span>{labelOf(tree, id)}</span>
        </>
      )}
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
