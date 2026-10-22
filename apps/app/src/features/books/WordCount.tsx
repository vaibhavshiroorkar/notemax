import type { TreeNode } from "@notemax/core";
import { useOption } from "@/plugins/options";
import type { AppContext } from "@/plugins/types";
import { bookOf, bookWords } from "./reading";

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

  const total = bookWords(book);
  const totalText = total !== null ? `${count(total)} ${total === 1 ? "word" : "words"}` : "counting words...";

  if (node.kind === "book") {
    // A part shows its own words, and the whole book's once they are counted.
    const own = node.id === book.id ? null : bookWords(app.tree.items.get(node.id)!);
    return <span className="page-words">{own !== null && total !== null ? `${count(own)} of ${totalText}` : totalText}</span>;
  }
  const words = node.words ?? 0;
  return (
    <span className="page-words" title={`This chapter, out of the whole book${total !== null ? "" : " (still counting)"}`}>
      {total !== null ? `${count(words)} of ${totalText}` : `${count(words)} words`}
    </span>
  );
}
