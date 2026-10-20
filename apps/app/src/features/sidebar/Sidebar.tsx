import { useEffect, useState, type DragEvent } from "react";
import type * as Y from "yjs";
import { ROOT, canMove, createNode, moveNode, renameNode, trashNode, type Tree } from "@notemax/core";
import { Icon } from "@/ui/Icon";
import { AddMenu } from "./AddMenu";
import { endDrag, startDrag, useDragging, type DropTarget } from "./drag";
import { Rows, type RowContext } from "./TreeRows";
import { TrashSection } from "./TrashSection";
import { useCollapsed } from "./useCollapsed";
import "./sidebar.css";

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
  const { collapsed, toggle, expand } = useCollapsed();
  const dragging = useDragging();
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // A drag that started in the book panel may end there, so clear any marker left here.
  useEffect(() => {
    if (!dragging) setDropTarget(null);
  }, [dragging]);

  const ctx: RowContext = {
    tree,
    activeId,
    collapsed,
    dragging,
    dropTarget,
    editingId,
    edit: setEditingId,
    rename: (id, title) => renameNode(doc, id, title),
    toggle,
    select: onSelect,
    add(kind, parentId) {
      const id = createNode(doc, kind, parentId);
      expand(parentId);
      // A note or book opens so its title can be typed. A folder has no page,
      // so its name is typed in the sidebar row instead.
      if (kind === "folder") setEditingId(id);
      else onSelect(id);
    },
    trash: (id) => trashNode(doc, id),
    startDrag,
    endDrag,
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
        <TrashSection tree={tree} doc={doc} />
      </div>
      <footer className="sidebar-footer">
        <button className="footer-button" onClick={onOpenSettings} title="Settings (Ctrl+,)">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
      </footer>
    </aside>
  );
}
