import { memo, type DragEvent, type MouseEvent } from "react";
import { canMove, isContainer, type NodeKind, type Tree, type TreeItem } from "@notemax/core";
import { prefetchDoc } from "@/data/docCache";
import { useSelect } from "@/platform/store";
import { registry } from "@/plugins/registry";
import { Icon } from "@/ui/Icon";
import { dragged, endDrag, placementFor, startDrag, zoneFor, type Placement, type Zone } from "./drag";
import { collapsed, dropTarget, editingId, markedId, toggleCollapsed } from "./state";

/**
 * Actions the rows share. The sidebar makes it once, so it never changes and
 * never makes a row redraw. Anything that changes is read from a store.
 */
export interface RowContext {
  /** The latest tree, for working out where a drop lands. */
  tree(): Tree;
  rename(id: string, title: string): void;
  select(id: string): void;
  add(kind: NodeKind, parentId: string): void;
  trash(id: string): void;
  drop(placement: Placement): void;
  /** Right click on a row. */
  menu(id: string, event: MouseEvent): void;
}

export function Rows({ items, depth, ctx }: { items: TreeItem[]; depth: number; ctx: RowContext }) {
  if (!items.length) return null;
  return (
    <ul>
      {items.map((item) => (
        <Row key={item.id} item={item} depth={depth} ctx={ctx} />
      ))}
    </ul>
  );
}

/** Renames a folder in place. Every keystroke is saved, so Enter, Esc and clicking away all just finish. */
function FolderNameInput({ item, ctx }: { item: TreeItem; ctx: RowContext }) {
  return (
    <span className="row-title icon-title">
      <Icon name="folder" />
      <input
        className="folder-name"
        aria-label="Folder name"
        placeholder="Folder name"
        value={item.title}
        autoFocus
        onFocus={(event) => event.target.select()}
        onChange={(event) => ctx.rename(item.id, event.target.value)}
        onKeyDown={(event) => (event.key === "Enter" || event.key === "Escape") && editingId.set(null)}
        onBlur={() => editingId.set(null)}
      />
    </span>
  );
}

// Resting on a note for a moment, or pressing on it, starts loading it, so the
// click usually finds it ready. Passing over rows on the way elsewhere does not.
const HOVER_MS = 80;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
const prefetchOnHover = (id: string) => ({
  onPointerEnter: () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => prefetchDoc(id), HOVER_MS);
  },
  onPointerLeave: () => clearTimeout(hoverTimer),
  onPointerDown: () => prefetchDoc(id),
});

const setDropTarget = (id: string, zone: Zone) => {
  const current = dropTarget.get();
  // Dragover fires many times a second; only a real change is worth telling the rows about.
  if (current?.id !== id || current.zone !== zone) dropTarget.set({ id, zone });
};

// Memoized: the tree keeps unchanged items as the same objects, so a row redraws
// only when its own item, or something inside it, changed.
const Row = memo(function Row({ item, depth, ctx }: { item: TreeItem; depth: number; ctx: RowContext }) {
  const open = useSelect(collapsed, (closed) => !closed.has(item.id));
  const editing = useSelect(editingId, (id) => id === item.id);
  const current = useSelect(markedId, (id) => id === item.id);
  const isDragged = useSelect(dragged, (d) => d?.id === item.id);
  const dropZone = useSelect(dropTarget, (target) => (target?.id === item.id ? target.zone : undefined));

  // A book's chapters are listed in the book panel on the right, not here.
  const hasChildren = item.kind !== "book" && item.children.length > 0;
  const title = item.title || "Untitled";

  const allowedPlacement = (event: DragEvent) => {
    const moving = dragged.get();
    if (!moving) return null;
    const tree = ctx.tree();
    const placement = placementFor(tree, moving, item, zoneFor(event, item, moving));
    return placement && !canMove(tree, moving.id, placement.parentId) ? placement : null;
  };

  return (
    <li>
      <div
        className="row"
        data-kind={item.kind}
        data-drop={dropZone}
        data-dragging={isDragged || undefined}
        aria-current={current ? "page" : undefined}
        style={{ paddingLeft: 4 + depth * 14 }}
        // Off while naming, so selecting text in the name box does not start a drag.
        draggable={!editing}
        onDragStart={(event) => {
          // Firefox only starts a drag when some data is set.
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          startDrag(item);
        }}
        onDragEnd={endDrag}
        onContextMenu={(event) => ctx.menu(item.id, event)}
        onDragOver={(event) => {
          const moving = dragged.get();
          if (!moving) return;
          if (!allowedPlacement(event)) return dropTarget.get() && dropTarget.set(null);
          // Calling preventDefault is how a drop target says "you may drop here".
          event.preventDefault();
          setDropTarget(item.id, zoneFor(event, item, moving));
        }}
        onDrop={(event) => {
          event.preventDefault();
          const placement = allowedPlacement(event);
          if (placement) ctx.drop(placement);
        }}
      >
        {hasChildren ? (
          <button className="icon-button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => toggleCollapsed(item.id)}>
            <Icon name={open ? "chevron-down" : "chevron-right"} />
          </button>
        ) : (
          <span className="icon-spacer" />
        )}
        {item.kind === "folder" && editing ? (
          <FolderNameInput item={item} ctx={ctx} />
        ) : item.kind === "folder" ? (
          // Folders have no page of their own: clicking one opens or closes it.
          <button
            className="row-title icon-title"
            aria-expanded={open}
            title="Double-click or F2 to rename"
            onClick={() => toggleCollapsed(item.id)}
            onDoubleClick={() => editingId.set(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "F2") return;
              // Keeps the app-wide F2 (rename the open page) from also running.
              event.stopPropagation();
              event.preventDefault();
              editingId.set(item.id);
            }}
          >
            <Icon name="folder" />
            <span>{title}</span>
          </button>
        ) : item.kind === "book" ? (
          // A book opens its own page, with the chapters in order. It is renamed there.
          <button className="row-title icon-title" onClick={() => ctx.select(item.id)}>
            <Icon name="book" />
            <span>{title}</span>
          </button>
        ) : item.kind === "note" ? (
          <button className="row-title" onClick={() => ctx.select(item.id)} {...prefetchOnHover(item.id)}>
            {title}
          </button>
        ) : (
          // Other pages, like boards, show the icon their plugin gave them.
          <button className="row-title icon-title" onClick={() => ctx.select(item.id)} {...prefetchOnHover(item.id)}>
            <Icon name={registry.iconOf(item.kind)} />
            <span>{title}</span>
          </button>
        )}
        {item.kind === "book" && item.children.length > 0 && (
          <span className="row-count" title={`${item.children.length} ${item.children.length === 1 ? "chapter" : "chapters"}`}>
            {item.children.length}
          </span>
        )}
        {isContainer(item.kind) && (
          <button
            className="icon-button row-action"
            aria-label={item.kind === "book" ? `Add chapter to ${title}` : `Add note inside ${title}`}
            title={item.kind === "book" ? "Add chapter" : "Add note inside"}
            onClick={() => ctx.add("note", item.id)}
          >
            <Icon name="plus" />
          </button>
        )}
        <button className="icon-button row-action" aria-label={`Move ${title} to trash`} title="Move to trash" onClick={() => ctx.trash(item.id)}>
          <Icon name="trash" />
        </button>
      </div>
      {hasChildren && open && <Rows items={item.children} depth={depth + 1} ctx={ctx} />}
    </li>
  );
});
