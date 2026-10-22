import { useEffect, useLayoutEffect, useMemo, useRef, type DragEvent } from "react";
import { ROOT, canMove, createNode, moveNode, renameNode, type Tree } from "@notemax/core";
import { registry } from "@/plugins/registry";
import { formatShortcut, shortcutFor, shortcutOverrides } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { useSelect } from "@/platform/store";
import { contextMenuHandler, pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";
import { AddMenu } from "./AddMenu";
import { dragged, endDrag, useDragging } from "./drag";
import { FilteredList } from "./FilteredList";
import { dropTarget, editingId, expand, markedId } from "./state";
import { Rows, type RowContext } from "./TreeRows";
import { TrashSection } from "./TrashSection";
import "./sidebar.css";

/** The folders above an item, nearest first. A chapter's book counts, so its folders open too. */
function foldersAbove(tree: Tree, id: string): string[] {
  const out: string[] = [];
  for (let parentId = tree.items.get(id)?.parentId; parentId && parentId !== ROOT; parentId = tree.items.get(parentId)?.parentId) {
    out.push(parentId);
  }
  return out;
}

export function Sidebar({ app }: { app: AppContext }) {
  const { tree, doc, activeId } = app;
  const dragging = useDragging();
  const headerActive = useSelect(dropTarget, (target) => target?.id === ROOT);
  // The list of hooks never changes while the app runs, so they are called in the same order every time.
  const filters = registry.sidebarFilterHooks().flatMap((useFilter) => useFilter() ?? []);
  const overrides = shortcutOverrides.use();
  const settingsShortcut = registry.allCommands().find((command) => command.id === "settings.open");
  const settingsKeys = settingsShortcut && shortcutFor(settingsShortcut, overrides);
  const settingsTitle = settingsKeys ? `Settings (${formatShortcut(settingsKeys)})` : "Settings";
  const footerItems = registry.sidebarFooter();

  // The row actions read the latest app through this, so they can stay one object for good.
  const appRef = useRef(app);
  appRef.current = app;
  const ctx = useMemo<RowContext>(
    () => ({
      tree: () => appRef.current.tree,
      rename: (id, title) => renameNode(doc, id, title),
      select: (id) => appRef.current.open(id),
      add(kind, parentId) {
        const id = createNode(doc, kind, parentId);
        expand(parentId);
        // A note or book opens so its title can be typed. A folder has no page,
        // so its name is typed in the sidebar row instead.
        if (kind === "folder") editingId.set(id);
        else appRef.current.open(id);
      },
      trash: (id) => appRef.current.trash(id),
      menu: (id, event) => pageMenu(appRef.current.tree.byId.get(id))(event),
      drop({ parentId, index }) {
        const moving = dragged.get();
        if (!moving) return;
        moveNode(doc, moving.id, parentId, index);
        expand(parentId);
        endDrag();
      },
    }),
    [doc],
  );

  // A drag that started in the book panel may end there, so clear any marker left here.
  useEffect(() => {
    if (!dragging) dropTarget.set(null);
  }, [dragging]);

  // While a chapter is open, its book is marked, since the chapter has no row here.
  const parent = activeId ? tree.items.get(tree.items.get(activeId)?.parentId ?? "") : undefined;
  const marked = parent?.kind === "book" ? parent.id : activeId;
  useLayoutEffect(() => markedId.set(marked), [marked]);

  // Show the open page, wherever it was opened from: a link, Ctrl+K or Back.
  // Only when the page changes, so closing a folder by hand is left alone.
  useEffect(() => {
    if (!activeId) return;
    expand(...foldersAbove(appRef.current.tree, activeId));
    requestAnimationFrame(() => document.querySelector('.sidebar .row[aria-current="page"]')?.scrollIntoView({ block: "nearest" }));
  }, [activeId]);

  // Dropping on the section heading moves the item to the end of the top level.
  const headerDrop = {
    onDragOver(event: DragEvent) {
      const moving = dragged.get();
      if (!moving || canMove(tree, moving.id, ROOT)) return;
      event.preventDefault();
      if (!headerActive) dropTarget.set({ id: ROOT, zone: "inside" });
    },
    onDrop(event: DragEvent) {
      event.preventDefault();
      ctx.drop({ parentId: ROOT, index: Infinity });
    },
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll" onContextMenu={contextMenuHandler(() => ({ type: "sidebar" }))}>
        <section className="section">
          <header className="section-header" data-drop={headerActive ? "inside" : undefined} onDragOver={headerDrop.onDragOver} onDrop={headerDrop.onDrop}>
            <span>Notes</span>
            <AddMenu onAdd={(kind) => ctx.add(kind, ROOT)} />
          </header>
          {filters.length ? (
            <FilteredList tree={tree} filters={filters} activeId={activeId} onSelect={app.open} onMenu={(id, event) => pageMenu(tree.byId.get(id))(event)} />
          ) : tree.top.length ? (
            <Rows items={tree.top} depth={0} ctx={ctx} />
          ) : (
            <p className="empty">No notes yet. Use + to start one.</p>
          )}
        </section>
        {registry.sidebarSections().map(({ id, component: Section }) => (
          <Section key={id} app={app} />
        ))}
        <TrashSection tree={tree} doc={doc} />
      </div>
      <footer className="sidebar-footer">
        {footerItems.length ? (
          <>
            {footerItems.map(({ id, component: Item }) => (
              <Safe key={id} name={id}>
                <Item app={app} />
              </Safe>
            ))}
            <button className="footer-icon footer-button" aria-label="Settings" onClick={() => app.openSettings()} title={settingsTitle}>
              <Icon name="gear" />
            </button>
          </>
        ) : (
          <button className="footer-button" onClick={() => app.openSettings()} title={settingsTitle}>
            <Icon name="gear" />
            <span>Settings</span>
          </button>
        )}
      </footer>
    </aside>
  );
}
