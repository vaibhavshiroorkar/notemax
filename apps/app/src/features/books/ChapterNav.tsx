import type { Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { bookOf, chapterOf, chaptersIn, labelOf } from "./reading";

/** Shown above a chapter or subtopic: its book, its part if it has one, and where it sits in the book. */
export function ChapterNav({ tree, chapterId: id, onOpen }: { tree: Tree; chapterId: string; onOpen(id: string): void }) {
  const book = bookOf(tree, id);
  const chapter = chapterOf(tree, id);
  if (!book || !chapter) return null;
  const chapters = chaptersIn(book);
  const number = chapters.findIndex((c) => c.id === chapter.id) + 1;
  const parent = tree.items.get(chapter.parentId);
  const part = parent && parent.id !== book.id ? parent : undefined;
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
    </nav>
  );
}
