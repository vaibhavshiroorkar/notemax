import { useState, type DragEvent } from "react";
import { dragged, endDrag } from "@/features/sidebar/drag";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { contextMenuHandler } from "@/ui/ContextMenu";
import { Icon, type IconName } from "@/ui/Icon";
import { activePane, activateTab, closeTab, isView, moveTab, newTab, openPage, viewId, type Layout, type Tab } from "./tabs";

const TAB_TYPE = "application/x-notemax-tab";

/** What a tab shows: its title and icon. */
function labelOf(app: AppContext, tab: Tab): { title: string; icon: IconName } {
  const visit = tab.visits[tab.index];
  if (!visit) return { title: "New tab", icon: "plus" };
  if (isView(visit.page)) {
    const view = registry.view(viewId(visit.page));
    return { title: view?.title ?? "Missing view", icon: view?.icon ?? "page" };
  }
  const node = app.tree.byId.get(visit.page);
  if (!node) return { title: "Deleted page", icon: "note" };
  return { title: node.title || "Untitled", icon: registry.iconOf(node.kind) };
}

/**
 * The open tabs, above the page. Drag a tab to reorder it, or drop a page from
 * the sidebar here to open it in a new tab. The middle button closes a tab.
 */
export function TabStrip({ app, layout }: { app: AppContext; layout: Layout }) {
  const pane = activePane(layout);
  // Where a dragged tab or page would land, as an index, to draw a marker.
  const [dropAt, setDropAt] = useState<number | null>(null);

  const indexAt = (event: DragEvent) => {
    const tabs = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(".tab")];
    const at = tabs.findIndex((tab) => {
      const rect = tab.getBoundingClientRect();
      return event.clientX < rect.left + rect.width / 2;
    });
    return at < 0 ? tabs.length : at;
  };

  const onDragOver = (event: DragEvent) => {
    const fromTab = event.dataTransfer.types.includes(TAB_TYPE);
    const page = dragged.get();
    if (!fromTab && (!page || page.kind === "folder")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = fromTab ? "move" : "copy";
    const at = indexAt(event);
    if (at !== dropAt) setDropAt(at);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const at = indexAt(event);
    setDropAt(null);
    const tabId = event.dataTransfer.getData(TAB_TYPE);
    if (tabId) {
      const from = pane.tabs.findIndex((tab) => tab.id === tabId);
      moveTab(tabId, from < at ? at - 1 : at);
      return;
    }
    const page = dragged.get();
    endDrag();
    if (!page || page.kind === "folder") return;
    openPage(page.id, { newTab: true });
    // The new tab lands next to the active one; move it to where it was dropped.
    const id = activePane().active;
    moveTab(id, at);
  };

  return (
    <div className="tab-strip" role="tablist" aria-label="Open pages" onDragOver={onDragOver} onDragLeave={() => setDropAt(null)} onDrop={onDrop}>
      {pane.tabs.map((tab, i) => {
        const { title, icon } = labelOf(app, tab);
        const active = tab.id === pane.active;
        return (
          <div
            key={tab.id}
            className="tab"
            role="tab"
            aria-selected={active}
            data-drop={dropAt === i ? "before" : dropAt === i + 1 && i === pane.tabs.length - 1 ? "after" : undefined}
            title={title}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(TAB_TYPE, tab.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDropAt(null)}
            onClick={() => activateTab(tab.id)}
            // The middle button would start scrolling the page instead.
            onMouseDown={(event) => event.button === 1 && event.preventDefault()}
            onAuxClick={(event) => event.button === 1 && closeTab(tab.id)}
            onContextMenu={contextMenuHandler(() => ({ type: "tab", tabId: tab.id }))}
          >
            <Icon name={icon} />
            <span className="tab-title">{title}</span>
            <button
              className="icon-button tab-close"
              aria-label={`Close ${title}`}
              title="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <Icon name="close" />
            </button>
          </div>
        );
      })}
      <button className="icon-button tab-new" aria-label="New tab" title="New tab" onClick={newTab}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
