import { useEffect, useState, type DragEvent } from "react";
import type * as Y from "yjs";
import { canMove, createNode, moveNode, trashNode, type Tree, type TreeItem } from "@notemax/core";
import { endDrag, placementFor, startDrag, useDragging, type DropTarget, type Placement } from "@/features/sidebar/drag";
import { Icon } from "@/ui/Icon";
import "./books.css";

/**
 * The right-hand sidebar for a book: its chapters in reading order. It shows
 * while the book or one of its chapters is open, so the left sidebar can keep
 * each book to a single row.
 */
export function BookPanel({
  book,
  tree,
  doc,
  activeId,
  onSelect,
}: {
  book: TreeItem;
  tree: Tree;
  doc: Y.Doc;
  activeId: string;
  onSelect(id: string): void;
}) {
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

  // Anywhere in the panel that is not a chapter row means "at the end".
  const panelDrop = {
    onDragOver(event: DragEvent) {
      if (!accepts(dragging)) return;
      event.preventDefault();
      setDropTarget({ id: book.id, zone: "inside" });
    },
    onDrop: (event: DragEvent) => drop(event, { parentId: book.id, index: Infinity }),
  };

  return (
    <aside className="book-panel" aria-label="Chapters" data-drop={dropTarget?.id === book.id ? "inside" : undefined} {...panelDrop}>
      <button className="book-panel-title" aria-current={activeId === book.id ? "page" : undefined} onClick={() => onSelect(book.id)}>
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
                  onClick={() => trashNode(doc, chapter.id)}
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
    </aside>
  );
}
