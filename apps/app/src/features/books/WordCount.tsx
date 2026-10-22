import type { TreeNode } from "@notemax/core";
import { useOption } from "@/plugins/options";
import type { AppContext } from "@/plugins/types";
import { bookOf } from "./book-of";

const count = (n: number) => n.toLocaleString();

/**
 * Top right of a book and its chapters: the book's words, and on a chapter
 * that chapter's share of them. Chapters that were never opened have no count
 * yet; the book page fills those in.
 */
export function BookWordCount({ node, app }: { node: TreeNode; app: AppContext }) {
  const on = useOption("books", "wordCount");
  const book = bookOf(app.tree, node.id);
  if (!on || !book) return null;

  const counted = book.children.every((chapter) => chapter.words !== null);
  const total = book.children.reduce((sum, chapter) => sum + (chapter.words ?? 0), 0);
  const totalText = counted ? `${count(total)} ${total === 1 ? "word" : "words"}` : "counting words...";

  if (node.kind === "book") return <span className="page-words">{totalText}</span>;
  const words = node.words ?? 0;
  return (
    <span className="page-words" title={`This chapter, out of the whole book${counted ? "" : " (still counting)"}`}>
      {counted ? `${count(words)} of ${totalText}` : `${count(words)} words`}
    </span>
  );
}
