import type { CSSProperties, ReactNode } from "react";
import { createNode, renameNode, type Tree } from "@notemax/core";
import type * as Y from "yjs";
import { Icon } from "@/ui/Icon";
import { subtopicsIn } from "./reading";
import { BookItemMenu } from "./BookItemMenu";

/**
 * A chapter's subtopics, in the chapter's own page after its text: each with
 * its number, a title and its text to edit right there, and a ... menu to
 * move or delete it. The sidebar jumps to each one by its data-reveal.
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
  const subtopics = subtopicsIn(tree, chapterId);
  return (
    <div className="inline-subtopics">
      {subtopics.map(({ item, label, depth }) => (
        <section key={item.id} className="inline-subtopic" data-reveal={item.id} style={{ "--depth": depth } as CSSProperties} aria-label={`${label} ${item.title || "Untitled"}`}>
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
      <button className="button add-subtopic" onClick={() => onOpen(createNode(workspaceDoc, "note", chapterId))}>
        <Icon name="plus" />
        <span>Add subtopic</span>
      </button>
    </div>
  );
}
