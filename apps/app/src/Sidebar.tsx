import { useEffect, useRef, useState, type DragEvent } from "react";
import type * as Y from "yjs";
import {
  ROOT,
  canMove,
  childrenOf,
  createNode,
  deleteForever,
  descendantsOf,
  moveNode,
  renameNode,
  restoreNode,
  trashNode,
  type NodeKind,
  type Tree,
  type TreeItem,
  type TreeNode,
} from "@notemax/core";
import { ConfirmDialog } from "./Dialog";
import { Icon } from "./Icon";
import { getStore } from "./platform";
import { getPref, setPref } from "./prefs";

type Zone = "before" | "after" | "inside";
type DropTarget = { id: string; zone: Zone };
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

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(getPref("collapsed") ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Which part of a row the pointer is over decides where the dragged item lands.
 * The middle of a folder means inside it. Notes hold nothing, so a note row
 * only has a top half and a bottom half.
 */
function zoneFor(event: DragEvent, target: TreeItem): Zone {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - rect.top) / rect.height;
  if (target.kind === "note") return y < 0.5 ? "before" : "after";
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
  onOpenSettings,
}: {
  tree: Tree;
  doc: Y.Doc;
  activeId: string | null;
  onSelect(id: string): void;
  onOpenSettings(): void;
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [dragging, setDragging] = useState<TreeItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [toDelete, setToDelete] = useState<TreeNode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    editingId,
    edit: setEditingId,
    rename: (id, title) => renameNode(doc, id, title),
    toggle(id) {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      setCollapsedAndSave(next);
    },
    select: onSelect,
    add(kind, parentId) {
      const id = createNode(doc, kind, parentId);
      expand(parentId);
      // A note opens so its title can be typed. A folder has no page, so its
      // name is typed in the sidebar row instead.
      if (kind === "note") onSelect(id);
      else setEditingId(id);
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

  // Dropping on the section heading moves the item to the end of the top level.
  const headerDrop = {
    active: dropTarget?.id === ROOT,
    onDragOver(event: DragEvent) {
      if (!dragging || canMove(tree, dragging.id, ROOT)) return;
      event.preventDefault();
      setDropTarget({ id: ROOT, zone: "inside" });
    },
    onDrop(event: DragEvent) {
      event.preventDefault();
      ctx.drop({ parentId: ROOT, index: Infinity });
    },
  };

  const confirmDelete = (node: TreeNode) => {
    setToDelete(null);
    const ids = deleteForever(doc, node.id);
    // The tree no longer lists them, so a failure here only leaves unreachable
    // text behind on disk. It never brings a deleted note back.
    getStore()
      .then((store) => Promise.all(ids.map((id) => store.remove(id))))
      .catch((err) => console.warn("[notemax] could not erase note bodies", err));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <section className="section">
          <header
            className="section-header"
            data-drop={headerDrop.active ? "inside" : undefined}
            onDragOver={headerDrop.onDragOver}
            onDrop={headerDrop.onDrop}
          >
            <span>Notes</span>
            <AddMenu onAdd={(kind) => ctx.add(kind, ROOT)} />
          </header>
          {tree.top.length ? <Rows items={tree.top} depth={0} ctx={ctx} /> : <p className="empty">No notes yet. Use + to start one.</p>}
        </section>
        {tree.trash.length > 0 && (
          <details className="trash">
            <summary>Trash ({tree.trash.length})</summary>
            <ul>
              {tree.trash.map((node) => {
                const title = node.title || "Untitled";
                return (
                  <li key={node.id} className="row">
                    <span className="row-title">{title}</span>
                    <button className="icon-button" aria-label={`Restore ${title}`} title="Restore" onClick={() => restoreNode(doc, node.id)}>
                      <Icon name="restore" />
                    </button>
                    <button className="icon-button danger" aria-label={`Delete ${title} forever`} title="Delete forever" onClick={() => setToDelete(node)}>
                      <Icon name="trash" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
      <footer className="sidebar-footer">
        <button className="footer-button" onClick={onOpenSettings} title="Settings (Ctrl+,)">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
      </footer>
      {toDelete && <DeleteDialog node={toDelete} inside={descendantsOf(doc, toDelete.id).length} onConfirm={() => confirmDelete(toDelete)} onCancel={() => setToDelete(null)} />}
    </aside>
  );
}

function DeleteDialog({ node, inside, onConfirm, onCancel }: { node: TreeNode; inside: number; onConfirm(): void; onCancel(): void }) {
  const title = node.title || "Untitled";
  return (
    <ConfirmDialog
      title="Delete forever?"
      message={
        <>
          <strong>{title}</strong>
          {inside > 0 && ` and the ${inside} ${inside === 1 ? "note" : "notes"} inside it`} will be erased from this device. This cannot be undone.
        </>
      }
      confirmLabel="Delete forever"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/** The one + at the top. It asks what to make, since notes and folders share one list. */
function AddMenu({ onAdd }: { onAdd(kind: NodeKind): void }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (kind: NodeKind) => {
    setOpen(false);
    onAdd(kind);
  };

  return (
    <div className="add-menu" ref={wrapper}>
      <button className="icon-button" aria-label="New" aria-haspopup="menu" aria-expanded={open} title="New note or folder" onClick={() => setOpen(!open)}>
        <Icon name="plus" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <button ref={first} role="menuitem" className="menu-item" onClick={() => pick("note")}>
            <Icon name="note" />
            <span>New note</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => pick("folder")}>
            <Icon name="folder" />
            <span>New folder</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Renames a folder in place. Every keystroke is saved, so Enter, Esc and clicking away all just finish. */
function FolderNameInput({ item, ctx }: { item: TreeItem; ctx: RowContext }) {
  return (
    <span className="row-title folder-title">
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

function Rows({ items, depth, ctx }: { items: TreeItem[]; depth: number; ctx: RowContext }) {
  if (!items.length) return null;
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
  const dropZone = ctx.dropTarget?.id === item.id ? ctx.dropTarget.zone : undefined;

  const allowedPlacement = (event: DragEvent) => {
    if (!ctx.dragging) return null;
    const placement = placementFor(ctx.tree, ctx.dragging, item, zoneFor(event, item));
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
          ctx.hover({ id: item.id, zone: zoneFor(event, item) });
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
            className="row-title folder-title"
            aria-expanded={open}
            title="Double-click to rename"
            onClick={() => ctx.toggle(item.id)}
            onDoubleClick={() => ctx.edit(item.id)}
          >
            <Icon name="folder" />
            <span>{title}</span>
          </button>
        ) : (
          <button className="row-title" onClick={() => ctx.select(item.id)}>
            {title}
          </button>
        )}
        {item.kind === "folder" && (
          <button className="icon-button row-action" aria-label={`Add note inside ${title}`} title="Add note inside" onClick={() => ctx.add("note", item.id)}>
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
