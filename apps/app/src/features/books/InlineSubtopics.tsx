import type { CSSProperties, ReactNode } from "react";
import { createNode, renameNode } from "@notemax/core";
import type * as Y from "yjs";
import { Icon } from "@/ui/Icon";
import { LockedInline, useHidden } from "@/features/lock/LockedInline";
import { LazyMount } from "@/ui/LazyMount";
import type { TreeItem } from "@notemax/core";
import type { Subtopic } from "./reading";
import { BookItemMenu } from "./BookItemMenu";

const LOAD_AT_ONCE = 8;

/** A subtopic's text, or a lock in its place while it is locked. */
function Body({ item, children }: { item: TreeItem; children: ReactNode }) {
  return useHidden(item) ? <LockedInline /> : children;
}

/**
 * Subtopics in their page, after its text: a chapter's in a book, or those of
 * a note set to show its pages inside. Each has its number, a title and its
 * text to edit right there, and a ... menu to move or delete it. The sidebars
 * jump to each one by its data-reveal.
 */
export function InlineSubtopics({
  subtopics,
  hostId,
  workspaceDoc,
  renderNote,
  onOpen,
}: {
  subtopics: Subtopic[];
  /** The chapter or note whose page this is. */
  hostId: string;
  workspaceDoc: Y.Doc;
  /** The editor for a subtopic's text, given by the note page that holds this. */
  renderNote(id: string): ReactNode;
  onOpen(id: string): void;
}) {
  // A few open at once. Past that each editor loads as it comes near, so a long chapter opens fast.
  const lazy = subtopics.length > LOAD_AT_ONCE;
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
            <Body item={item}>{lazy ? <LazyMount height={80}>{renderNote(item.id)}</LazyMount> : renderNote(item.id)}</Body>
          ) : (
            <button className="link-button" onClick={() => onOpen(item.id)}>
              Open this {item.kind === "board" ? "board" : "page"}
            </button>
          )}
        </section>
      ))}
      <button className="button add-subtopic" onClick={() => onOpen(createNode(workspaceDoc, "note", hostId))}>
        <Icon name="plus" />
        <span>Add subtopic</span>
      </button>
    </div>
  );
}
