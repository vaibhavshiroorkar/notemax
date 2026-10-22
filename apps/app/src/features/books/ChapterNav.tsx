import type { Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { bookOf, chaptersIn } from "./reading";

/** Shown above a chapter: its book, its part if it has one, and where it sits in the book. */
export function ChapterNav({ tree, chapterId, onOpen }: { tree: Tree; chapterId: string; onOpen(id: string): void }) {
  const book = bookOf(tree, chapterId);
  if (!book) return null;
  const chapters = chaptersIn(book);
  const parent = tree.items.get(tree.items.get(chapterId)?.parentId ?? "");
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
      <span>
        Chapter {chapters.findIndex((chapter) => chapter.id === chapterId) + 1} of {chapters.length}
      </span>
    </nav>
  );
}
