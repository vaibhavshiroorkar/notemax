import { useEffect, type CSSProperties } from "react";
import { createNode, renameNode } from "@notemax/core";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { bookWords, chaptersIn, readingOrder } from "./reading";
import { useWordBackfill } from "./useWordBackfill";
import "./books.css";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export function BookPane({ node, app, tree, workspaceDoc, onSelect, onStatus, onReady }: PageProps) {
  const book = tree.items.get(node.id);
  const entries = book ? readingOrder(book) : [];
  const chapters = book ? chaptersIn(book) : [];
  useWordBackfill(
    chapters.filter((chapter) => chapter.kind === "note"),
    workspaceDoc,
  );

  // This page has no body of its own, so nothing here is waiting to be saved.
  useEffect(() => {
    onStatus({ state: "saved" });
    onReady();
  }, [onStatus, onReady]);

  const total = book ? bookWords(book) : 0;
  const parts = entries.length - chapters.length;

  return (
    <article className="note book">
      <input
        className="note-title"
        value={node.title}
        placeholder="Untitled book"
        aria-label="Book title"
        autoFocus={node.title === ""}
        onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
      />
      <PageHeader node={node} app={app} />
      <p className="book-summary">
        {parts > 0 && `${plural(parts, "part")}, `}
        {plural(chapters.length, "chapter")}
        {chapters.length > 0 && `, ${total !== null ? plural(total, "word") : "counting words..."}`}
      </p>

      {entries.length > 0 ? (
        <ol className="chapter-list" aria-label="Chapters">
          {entries.map(({ item, depth, number }) => (
            <li key={item.id} style={{ "--depth": depth } as CSSProperties}>
              <button className="chapter" data-part={number === null || undefined} onClick={() => onSelect(item.id)}>
                <span className="chapter-number">{number ?? <Icon name="book" />}</span>
                <span className="chapter-title">{item.title || (number === null ? "Untitled part" : "Untitled")}</span>
                <span className="chapter-words">
                  {item.kind === "board" ? "Board" : item.kind === "note" && item.words !== null ? plural(item.words, "word") : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="book-empty">No chapters yet. Drag notes, boards or books onto the book in the sidebar, or add a new one.</p>
      )}

      <div className="book-actions">
        <button className="button add-chapter" onClick={() => onSelect(createNode(workspaceDoc, "note", node.id))}>
          <Icon name="plus" />
          <span>Add chapter</span>
        </button>
        <button className="button add-chapter" onClick={() => onSelect(createNode(workspaceDoc, "book", node.id))}>
          <Icon name="book" />
          <span>Add part</span>
        </button>
      </div>
    </article>
  );
}
