import type { TreeNode } from "@notemax/core";
import { useOption } from "@/plugins/options";
import type { AppContext } from "@/plugins/types";
import { bookOf, bookWords } from "./reading";

const count = (n: number) => n.toLocaleString();
const words = (n: number) => `${count(n)} ${n === 1 ? "word" : "words"}`;

// A common estimate for silent reading of prose.
const WORDS_PER_MINUTE = 230;
const readTime = (n: number) => `About ${Math.max(1, Math.round(n / WORDS_PER_MINUTE))} min to read`;

/**
 * Bottom right of the right sidebar: the open page's words. In a book, a
 * chapter or part shows its share of the whole book. Chapters that were never
 * opened have no count yet; the book page fills those in.
 */
export function PageWordCount({ node, app }: { node: TreeNode; app: AppContext }) {
  const on = useOption("books", "wordCount");
  if (!on) return null;
  const book = bookOf(app.tree, node.id);

  if (!book) {
    if (node.kind !== "note" || node.words === null) return null;
    return (
      <span className="page-words" title={readTime(node.words)}>
        {words(node.words)}
      </span>
    );
  }

  const total = bookWords(book);
  const totalText = total !== null ? words(total) : "counting words...";
  const own = node.id === book.id ? null : node.kind === "book" ? bookWords(app.tree.items.get(node.id)!) : (node.words ?? 0);
  return (
    <span className="page-words" title={own !== null ? `This ${node.kind === "book" ? "part" : "chapter"}, out of the whole book` : total !== null ? readTime(total) : undefined}>
      {own !== null && total !== null ? `${count(own)} of ${totalText}` : own !== null ? words(own) : totalText}
    </span>
  );
}
