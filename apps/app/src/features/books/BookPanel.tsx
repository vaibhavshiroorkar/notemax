import { Fragment, useEffect, useState, type CSSProperties, type DragEvent } from "react";
import { canMove, createNode, moveNode, type TreeItem } from "@notemax/core";
import { endDrag, placementFor, startDrag, useDragging, type DropTarget, type Placement, type Zone } from "@/features/sidebar/drag";
import type { AppContext } from "@/plugins/types";
import { dragRowMenu, pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { BookItemMenu } from "./BookItemMenu";
import { bookOf, chapterStops, subtopicsOf } from "./reading";
import "./books.css";

/**
 * A book's chapters in reading order, as a section of the right sidebar, each
 * with its subtopics under it. A subtopic is read in its chapter's
 * page, so clicking one scrolls there. It shows while the book or a chapter is
 * open, so the left sidebar can keep each book to a single row.
 */
export function BookPanel({ app }: { app: AppContext }) {
  const { tree, doc, activeId, open: onSelect } = app;
  // Only shown while bookOf finds a book, so this is always set.
  const book = bookOf(tree, activeId)!;
  const dragging = useDragging();
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const bookTitle = book.title || "Untitled book";

  useEffect(() => {
    if (!dragging) setDropTarget(null);
  }, [dragging]);

  // Pages from the left sidebar may be dropped here too. Folders may not.
  const accepts = (item: TreeItem | null, parentId = book.id): item is TreeItem => !!item && !canMove(tree, item.id, parentId);
  // The middle of a chapter's row makes the item one of its subtopics.
  const zoneOf = (event: DragEvent): Zone => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = (event.clientY - rect.top) / rect.height;
    return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
  };

  const drop = (event: DragEvent, placement: Placement) => {
    event.preventDefault();
    if (accepts(dragging, placement.parentId)) moveNode(doc, dragging.id, placement.parentId, placement.index);
    endDrag();
  };

  // Anywhere in the section that is not a chapter row means "at the end".
  const panelDrop = {
    onDragOver(event: DragEvent) {
      if (!accepts(dragging)) return;
      event.preventDefault();
      setDropTarget({ id: book.id, zone: "inside" });
    },
    onDrop: (event: DragEvent) => drop(event, { parentId: book.id, index: Infinity }),
  };

  return (
    <div className="book-panel" role="group" aria-label="Chapters" data-drop={dropTarget?.id === book.id ? "inside" : undefined} {...panelDrop}>
      <button className="book-panel-title" onContextMenu={pageMenu(tree.byId.get(book.id))} aria-current={activeId === book.id ? "page" : undefined} onClick={() => onSelect(book.id)}>
        <Icon name="book" />
        <span>{bookTitle}</span>
      </button>

      {book.children.length > 0 ? (
        <ol className="book-panel-chapters">
          {chapterStops(book).map(({ item: chapter, label }) => {
            const title = chapter.title || "Untitled";
            const zone = dropTarget?.id === chapter.id ? dropTarget.zone : undefined;
            const placement = (event: DragEvent) => dragging && placementFor(tree, dragging, chapter, zoneOf(event));
            return (
              <Fragment key={chapter.id}>
                <li
                  className="row"
                  draggable
                  data-drop={zone}
                  data-dragging={dragging?.id === chapter.id || undefined}
                  aria-current={chapter.id === activeId ? "page" : undefined}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", chapter.id);
                    event.dataTransfer.effectAllowed = "move";
                    startDrag(chapter);
                  }}
                  onDragEnd={endDrag}
                  onContextMenu={dragRowMenu(pageMenu(tree.byId.get(chapter.id)))}
                  onDragOver={(event) => {
                    const where = placement(event);
                    // Otherwise the panel underneath would take over the marker.
                    event.stopPropagation();
                    if (!where || !accepts(dragging, where.parentId)) return setDropTarget(null);
                    event.preventDefault();
                    setDropTarget({ id: chapter.id, zone: zoneOf(event) });
                  }}
                  onDrop={(event) => {
                    event.stopPropagation();
                    const where = placement(event);
                    if (where && accepts(dragging, where.parentId)) drop(event, where);
                  }}
                >
                  <button className="row-title chapter-row" onClick={() => onSelect(chapter.id)}>
                    <span className="chapter-number">{label}</span>
                    <span className="chapter-title">{title}</span>
                  </button>
                  {/* The page menu, with Move to trash in it. On a phone it is the way to the menu, since a long press drags. */}
                  <button className="icon-button row-action" aria-label={`Add subtopic to ${title}`} title="Add subtopic" onClick={() => onSelect(createNode(doc, "note", chapter.id))}>
                    <Icon name="plus" />
                  </button>
                  <BookItemMenu node={chapter} className="row-action" />
                </li>
                {subtopicsOf(chapter, label).map((sub) => (
                    <li
                      key={sub.item.id}
                      className="row subtopic"
                      style={{ "--depth": sub.depth } as CSSProperties}
                      onContextMenu={pageMenu(tree.byId.get(sub.item.id))}
                    >
                      <button className="row-title chapter-row" onClick={() => onSelect(sub.item.id)}>
                        <span className="chapter-number">{sub.label}</span>
                        <span className="chapter-title">{sub.item.title || "Untitled"}</span>
                      </button>
                      <BookItemMenu node={sub.item} className="row-action" />
                    </li>
                  ))}
              </Fragment>
            );
          })}
        </ol>
      ) : (
        <p className="book-panel-empty">No chapters yet. Drag a note or board here, or add one.</p>
      )}

      <button className="footer-button" onClick={() => onSelect(createNode(doc, "note", book.id))}>
        <Icon name="plus" />
        <span>Add chapter</span>
      </button>
    </div>
  );
}
