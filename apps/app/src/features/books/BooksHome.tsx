import { useMemo } from "react";
import type { TreeItem } from "@notemax/core";
import { HomeList } from "@/features/workspaces/HomeList";
import type { AppContext } from "@/plugins/types";
import { bookWords, chapterStops } from "./reading";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** Every book in the workspace on Home, the last edited first, with its chapters and words. */
export function BooksHome({ app }: { app: AppContext }) {
  const books = useMemo(() => [...app.tree.items.values()].filter((item) => item.kind === "book").sort((a, b) => b.editedAt - a.editedAt), [app.tree]);
  const note = (book: TreeItem) => {
    const words = bookWords(book);
    return `${plural(chapterStops(book).length, "chapter")}${words ? `, ${plural(words, "word")}` : ""}`;
  };
  return <HomeList app={app} items={books} note={note} empty="Books you start show up here." />;
}
