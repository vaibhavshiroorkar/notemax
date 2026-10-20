import type { DragEvent } from "react";
import { canMove, type NodeKind, type Tree, type TreeItem } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { placementFor, zoneFor, type DropTarget, type Placement } from "./drag";

export interface RowContext {
  tree: Tree;
  activeId: string | null;
  collapsed: Set<string>;
  dragging: TreeItem | null;
  dropTarget: DropTarget | null;
  /** The folder whose name is being typed in its row. */
  editingId: string | null;
  edit(id: string | null): void;
  rename(id: string, title: string): void;
  toggle(id: string): void;
  select(id: string): void;
  add(kind: NodeKind, parentId: string): void;
  trash(id: string): void;
  startDrag(item: TreeItem): void;
  endDrag(): void;
  hover(target: DropTarget | null): void;
  drop(placement: Placement): void;
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
        onKeyDown={(event) => (event.key === "Enter" || event.key === "Escape") && ctx.edit(null)}
        onBlur={() => ctx.edit(null)}
      />
    </span>
  );
}

function Row({ item, depth, ctx }: { item: TreeItem; depth: number; ctx: RowContext }) {
  const hasChildren = item.children.length > 0;
  const open = !ctx.collapsed.has(item.id);
  const title = item.title || "Untitled";
  const dropZone = ctx.dropTarget?.id === item.id ? ctx.dropTarget.zone : undefined;

  const allowedPlacement = (event: DragEvent) => {
    if (!ctx.dragging) return null;
    const placement = placementFor(ctx.tree, ctx.dragging, item, zoneFor(event, item, ctx.dragging));
    return placement && !canMove(ctx.tree, ctx.dragging.id, placement.parentId) ? placement : null;
  };

  return (
    <li>
      <div
        className="row"
        data-kind={item.kind}
        data-drop={dropZone}
        data-dragging={ctx.dragging?.id === item.id || undefined}
        aria-current={item.id === ctx.activeId ? "page" : undefined}
        style={{ paddingLeft: 4 + depth * 14 }}
        // Off while naming, so selecting text in the name box does not start a drag.
        draggable={ctx.editingId !== item.id}
        onDragStart={(event) => {
          // Firefox only starts a drag when some data is set.
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          ctx.startDrag(item);
        }}
        onDragEnd={ctx.endDrag}
        onDragOver={(event) => {
          if (!ctx.dragging) return;
          if (!allowedPlacement(event)) return ctx.hover(null);
          // Calling preventDefault is how a drop target says "you may drop here".
          event.preventDefault();
          ctx.hover({ id: item.id, zone: zoneFor(event, item, ctx.dragging) });
        }}
        onDrop={(event) => {
          event.preventDefault();
          const placement = allowedPlacement(event);
          if (placement) ctx.drop(placement);
        }}
      >
        {hasChildren ? (
          <button className="icon-button" aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => ctx.toggle(item.id)}>
            <Icon name={open ? "chevron-down" : "chevron-right"} />
          </button>
        ) : (
          <span className="icon-spacer" />
        )}
        {item.kind === "folder" && ctx.editingId === item.id ? (
          <FolderNameInput item={item} ctx={ctx} />
        ) : item.kind === "folder" ? (
          // Folders have no page of their own: clicking one opens or closes it.
          <button
            className="row-title icon-title"
            aria-expanded={open}
            title="Double-click to rename"
            onClick={() => ctx.toggle(item.id)}
            onDoubleClick={() => ctx.edit(item.id)}
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
        ) : (
          <button className="row-title" onClick={() => ctx.select(item.id)}>
            {title}
          </button>
        )}
        {item.kind !== "note" && (
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
}
