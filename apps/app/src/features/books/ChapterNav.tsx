import type { TreeItem } from "@notemax/core";
import { Icon } from "@/ui/Icon";

/** Shown above a chapter: which book it belongs to, and where it sits in it. */
export function ChapterNav({ book, chapterId, onOpen }: { book: TreeItem; chapterId: string; onOpen(id: string): void }) {
  return (
    <nav className="note-book" aria-label="Book">
      <button className="note-book-link" onClick={() => onOpen(book.id)}>
        <Icon name="book" />
        <span>{book.title || "Untitled book"}</span>
      </button>
      <span>
        Chapter {book.children.findIndex((chapter) => chapter.id === chapterId) + 1} of {book.children.length}
      </span>
    </nav>
  );
}
