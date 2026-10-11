import { useState, type DragEvent, type ReactNode } from "react";
import type * as Y from "yjs";
import {
  INBOX,
  ROOT,
  canMove,
  childrenOf,
  createNode,
  moveNode,
  restoreNode,
  trashNode,
  type NodeKind,
  type Tree,
  type TreeItem,
} from "@notemax/core";
import { Icon } from "./Icon";
import { getPref, setPref } from "./prefs";

type Zone = "before" | "after" | "inside";
type DropTarget = { id: string; zone: Zone } | { section: "inbox" | "books" };
interface Placement {
  parentId: string;
  index: number;
}

interface RowContext {
  tree: Tree;
  activeId: string | null;
  collapsed: Set<string>;
  dragging: TreeItem | null;
  dropTarget: DropTarget | null;
  toggle(id: string): void;
  select(id: string): void;
  add(kind: NodeKind, parentId: string): void;
  trash(id: string): void;
  startDrag(item: TreeItem): void;
  endDrag(): void;
  hover(target: DropTarget | null): void;
  drop(placement: Placement): void;
}

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(getPref("collapsed") ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Which part of a row the pointer is over decides where the dragged item lands. */
function zoneFor(event: DragEvent, dragged: TreeItem, target: TreeItem): Zone {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - rect.top) / rect.height;
  if (dragged.kind === "book") return y < 0.5 ? "before" : "after";
  if (target.kind === "book") return "inside";
  return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
}

function placementFor(tree: Tree, dragged: TreeItem, target: TreeItem, zone: Zone): Placement | null {
  if (dragged.id === target.id) return null;
  if (zone === "inside") return { parentId: target.id, index: target.children.length };
  const siblings = childrenOf(tree, target.parentId).filter((item) => item.id !== dragged.id);
  const index = siblings.findIndex((item) => item.id === target.id);
  return { parentId: target.parentId, index: zone === "before" ? index : index + 1 };
}

export function Sidebar({
  tree,
  doc,
  activeId,
  onSelect,
}: {
  tree: Tree;
  doc: Y.Doc;
  activeId: string | null;
  onSelect(id: string): void;
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [dragging, setDragging] = useState<TreeItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const setCollapsedAndSave = (next: Set<string>) => {
    setCollapsed(next);
    setPref("collapsed", JSON.stringify([...next]));
  };
  // Make sure a note is visible after something is added or dropped inside its parent.
  const expand = (id: string) => {
    if (!collapsed.has(id)) return;
    const next = new Set(collapsed);
    next.delete(id);
    setCollapsedAndSave(next);
  };

  const ctx: RowContext = {
    tree,
    activeId,
    collapsed,
    dragging,
    dropTarget,
    toggle(id) {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      setCollapsedAndSave(next);
    },
    select: onSelect,
    add(kind, parentId) {
      const id = createNode(doc, kind, parentId);
      expand(parentId);
      onSelect(id);
    },
    trash: (id) => trashNode(doc, id),
    startDrag: setDragging,
    endDrag() {
      setDragging(null);
      setDropTarget(null);
    },
    hover: setDropTarget,
    drop({ parentId, index }) {
      if (!dragging) return;
      moveNode(doc, dragging.id, parentId, index);
      expand(parentId);
      ctx.endDrag();
    },
  };

  // Dropping on a section heading moves the item to the end of that section.
  const sectionDrop = (section: "inbox" | "books", parentId: string) => ({
    active: dropTarget !== null && "section" in dropTarget && dropTarget.section === section,
    onDragOver(event: DragEvent) {
      if (!dragging || canMove(tree, dragging.id, parentId)) return;
      event.preventDefault();
      setDropTarget({ section });
    },
    onDrop(event: DragEvent) {
      event.preventDefault();
      ctx.drop({ parentId, index: Infinity });
    },
  });

  return (
    <aside className="sidebar">
      <Section label="Inbox" addLabel="New note in inbox" onAdd={() => ctx.add("note", INBOX)} drop={sectionDrop("inbox", INBOX)}>
        <Rows items={tree.inbox} depth={0} ctx={ctx} empty="Nothing here. Quick notes land in the inbox." />
      </Section>
      <Section label="Books" addLabel="New book" onAdd={() => ctx.add("book", ROOT)} drop={sectionDrop("books", ROOT)}>
        <Rows items={tree.books} depth={0} ctx={ctx} empty="No books yet." />
      </Section>
      {tree.trash.length > 0 && (
        <details className="trash">
          <summary>Trash ({tree.trash.length})</summary>
          <ul>
            {tree.trash.map((node) => (
              <li key={node.id} className="row">
                <span className="row-title">{node.title || "Untitled"}</span>
                <button className="text-button" onClick={() => restoreNode(doc, node.id)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

function Section({
  label,
  addLabel,
  onAdd,
  drop,
  children,
}: {
  label: string;
  addLabel: string;
  onAdd(): void;
  drop: { active: boolean; onDragOver(e: DragEvent): void; onDrop(e: DragEvent): void };
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header className="section-header" data-drop={drop.active ? "inside" : undefined} onDragOver={drop.onDragOver} onDrop={drop.onDrop}>
        <span>{label}</span>
        <button className="icon-button" aria-label={addLabel} title={addLabel} onClick={onAdd}>
          <Icon name="plus" />
        </button>
      </header>
      {children}
    </section>
  );
}

function Rows({ items, depth, ctx, empty }: { items: TreeItem[]; depth: number; ctx: RowContext; empty?: string }) {
  if (!items.length) return empty ? <p className="empty">{empty}</p> : null;
  return (
    <ul>
      {items.map((item) => (
        <Row key={item.id} item={item} depth={depth} ctx={ctx} />
      ))}
    </ul>
  );
}

function Row({ item, depth, ctx }: { item: TreeItem; depth: number; ctx: RowContext }) {
  const hasChildren = item.children.length > 0;
  const open = !ctx.collapsed.has(item.id);
  const title = item.title || "Untitled";
  const target = ctx.dropTarget;
  const dropZone = target && "id" in target && target.id === item.id ? target.zone : undefined;

  const allowedPlacement = (event: DragEvent) => {
    if (!ctx.dragging) return null;
    const placement = placementFor(ctx.tree, ctx.dragging, item, zoneFor(event, ctx.dragging, item));
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
        draggable
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
          ctx.hover({ id: item.id, zone: zoneFor(event, ctx.dragging, item) });
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
        <button className="row-title" onClick={() => ctx.select(item.id)}>
          {title}
        </button>
        <button className="icon-button row-action" aria-label={`Add note inside ${title}`} title="Add note inside" onClick={() => ctx.add("note", item.id)}>
          <Icon name="plus" />
        </button>
        <button className="icon-button row-action" aria-label={`Move ${title} to trash`} title="Move to trash" onClick={() => ctx.trash(item.id)}>
          <Icon name="trash" />
        </button>
      </div>
      {hasChildren && open && <Rows items={item.children} depth={depth + 1} ctx={ctx} />}
    </li>
  );
}
