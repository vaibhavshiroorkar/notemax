import { useEffect, useState, type DragEvent } from "react";
import { canMove, createNode, moveNode, type TreeItem } from "@notemax/core";
import { endDrag, placementFor, startDrag, useDragging, type DropTarget, type Placement } from "@/features/sidebar/drag";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { bookOf } from "./book-of";
import "./books.css";

/**
 * A book's chapters in reading order, as a section of the right sidebar. It
 * shows while the book or one of its chapters is open, so the left sidebar can
 * keep each book to a single row.
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

  // Notes from the left sidebar may be dropped here too. Folders and books may not.
  const accepts = (item: TreeItem | null): item is TreeItem => !!item && !canMove(tree, item.id, book.id);

  const drop = (event: DragEvent, placement: Placement) => {
    event.preventDefault();
    if (accepts(dragging)) moveNode(doc, dragging.id, placement.parentId, placement.index);
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
          {book.children.map((chapter, i) => {
            const title = chapter.title || "Untitled";
            const zone = dropTarget?.id === chapter.id ? dropTarget.zone : undefined;
            const half = (event: DragEvent) => {
              const rect = event.currentTarget.getBoundingClientRect();
              return event.clientY - rect.top < rect.height / 2 ? "before" : "after";
            };
            return (
              <li
                key={chapter.id}
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
                onContextMenu={pageMenu(tree.byId.get(chapter.id))}
                onDragOver={(event) => {
                  if (!accepts(dragging) || dragging.id === chapter.id) return;
                  event.preventDefault();
                  // Otherwise the panel underneath would take over the marker.
                  event.stopPropagation();
                  setDropTarget({ id: chapter.id, zone: half(event) });
                }}
                onDrop={(event) => {
                  event.stopPropagation();
                  const placement = dragging && placementFor(tree, dragging, chapter, half(event));
                  if (placement) drop(event, placement);
                }}
              >
                <button className="row-title chapter-row" onClick={() => onSelect(chapter.id)}>
                  <span className="chapter-number">{i + 1}</span>
                  <span className="chapter-title">{title}</span>
                </button>
                <button
                  className="icon-button row-action"
                  aria-label={`Move ${title} to trash`}
                  title="Move to trash"
                  onClick={() => app.trash(chapter.id)}
                >
                  <Icon name="trash" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="book-panel-empty">No chapters yet. Drag a note here, or add one.</p>
      )}

      <button className="footer-button" onClick={() => onSelect(createNode(doc, "note", book.id))}>
        <Icon name="plus" />
        <span>Add chapter</span>
      </button>
    </div>
  );
}
