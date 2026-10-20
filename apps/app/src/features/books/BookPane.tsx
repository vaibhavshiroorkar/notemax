import { useEffect } from "react";
import type * as Y from "yjs";
import { createNode, renameNode, type SaveStatus, type Tree, type TreeNode } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { useWordBackfill } from "./useWordBackfill";
import "./books.css";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export function BookPane({
  node,
  tree,
  workspaceDoc,
  onSelect,
  onStatus,
  onReady,
}: {
  node: TreeNode;
  tree: Tree;
  workspaceDoc: Y.Doc;
  onSelect(id: string): void;
  onStatus(status: SaveStatus): void;
  onReady(): void;
}) {
  const chapters = tree.items.get(node.id)?.children ?? [];
  useWordBackfill(chapters, workspaceDoc);

  // This page has no body of its own, so nothing here is waiting to be saved.
  useEffect(() => {
    onStatus({ state: "saved" });
    onReady();
  }, [onStatus, onReady]);

  const counted = chapters.every((chapter) => chapter.words !== null);
  const total = chapters.reduce((sum, chapter) => sum + (chapter.words ?? 0), 0);

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
      <p className="book-summary">
        {plural(chapters.length, "chapter")}
        {chapters.length > 0 && `, ${counted ? plural(total, "word") : "counting words..."}`}
      </p>

      {chapters.length > 0 ? (
        <ol className="chapter-list" aria-label="Chapters">
          {chapters.map((chapter, i) => (
            <li key={chapter.id}>
              <button className="chapter" onClick={() => onSelect(chapter.id)}>
                <span className="chapter-number">{i + 1}</span>
                <span className="chapter-title">{chapter.title || "Untitled"}</span>
                <span className="chapter-words">{chapter.words === null ? "" : plural(chapter.words, "word")}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="book-empty">No chapters yet. Drag notes onto the book in the sidebar, or add a new one.</p>
      )}

      <button className="button add-chapter" onClick={() => onSelect(createNode(workspaceDoc, "note", node.id))}>
        <Icon name="plus" />
        <span>Add chapter</span>
      </button>
    </article>
  );
}
