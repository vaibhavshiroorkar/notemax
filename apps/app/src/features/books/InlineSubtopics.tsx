import type { CSSProperties, ReactNode } from "react";
import { renameNode, type Tree } from "@notemax/core";
import type * as Y from "yjs";
import { inlineSubtopics } from "./reading";
import { BookItemMenu } from "./BookItemMenu";

/**
 * A chapter set to show its subtopics in its own page: each one follows the
 * chapter's text with its number and title, and its text can be edited right
 * there. Each stays a page of its own underneath, so switching back loses nothing.
 */
export function InlineSubtopics({
  tree,
  chapterId,
  workspaceDoc,
  renderNote,
  onOpen,
}: {
  tree: Tree;
  chapterId: string;
  workspaceDoc: Y.Doc;
  /** The editor for a subtopic's text, given by the note page that holds this. */
  renderNote(id: string): ReactNode;
  onOpen(id: string): void;
}) {
  const subtopics = inlineSubtopics(tree, chapterId);
  if (!subtopics.length) return null;
  return (
    <div className="inline-subtopics">
      {subtopics.map(({ item, label, depth }) => (
        <section key={item.id} className="inline-subtopic" style={{ "--depth": depth } as CSSProperties} aria-label={`${label} ${item.title || "Untitled"}`}>
          <header className="inline-subtopic-title">
            <span className="chapter-number">{label}</span>
            <input value={item.title} placeholder="Untitled" aria-label={`Title of ${label}`} onChange={(event) => renameNode(workspaceDoc, item.id, event.target.value)} />
            <BookItemMenu node={item} />
          </header>
          {item.kind === "note" ? (
            renderNote(item.id)
          ) : (
            <button className="link-button" onClick={() => onOpen(item.id)}>
              Open this {item.kind === "board" ? "board" : "page"}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
