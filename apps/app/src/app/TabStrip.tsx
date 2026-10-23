import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { dragged, endDrag } from "@/features/sidebar/drag";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { contextMenuHandler } from "@/ui/ContextMenu";
import { Icon, type IconName } from "@/ui/Icon";
import { TabOverflow } from "./TabOverflow";
import { activatePane, activePane, activateTab, closeTab, isView, moveTab, moveTabToPane, newTab, openPage, viewId, type Pane, type Tab } from "./tabs";

const TAB_TYPE = "application/x-notemax-tab";

// Below this width a tab title is too short to read, so more tabs go into "+N".
const TAB_MIN = 110;
const PHONE_TAB_MIN = 84;
// The + for a new tab, and the "+N" button, beside the tabs.
const NEW_WIDTH = 32;
const MORE_WIDTH = 44;

/** How many tabs fit in `room` pixels, leaving space for the buttons beside them. */
function fitting(room: number, count: number): number {
  const min = innerWidth <= 700 ? PHONE_TAB_MIN : TAB_MIN;
  const all = Math.floor((room - NEW_WIDTH) / (min + 2));
  if (all >= count) return count;
  return Math.max(1, Math.floor((room - NEW_WIDTH - MORE_WIDTH) / (min + 2)));
}

/** What a tab shows: its title and icon. */
function labelOf(app: AppContext, tab: Tab): { title: string; icon: IconName } {
  const visit = tab.visits[tab.index];
  // An empty tab shows Home.
  if (!visit) return { title: "Home", icon: "home" };
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
export function TabStrip({ app, pane }: { app: AppContext; pane: Pane }) {
  // Where a dragged tab or page would land, as an index among the shown tabs, to draw a marker.
  const [dropAt, setDropAt] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(Infinity);

  // The strip takes the room the page buttons leave, whatever the tabs need.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width));
    observer.observe(strip.current!);
    return () => observer.disconnect();
  }, []);

  // The tabs that fit, in order. The open tab always shows: past the last
  // place, it takes that place, and the tab it pushed out goes into "+N".
  const fit = fitting(room, pane.tabs.length);
  const activeAt = pane.tabs.findIndex((tab) => tab.id === pane.active);
  const shown = activeAt < fit ? pane.tabs.slice(0, fit) : [...pane.tabs.slice(0, fit - 1), pane.tabs[activeAt]];
  const hidden = pane.tabs.filter((tab) => !shown.includes(tab));

  const indexAt = (event: DragEvent) => {
    const tabs = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(".tab")];
    const at = tabs.findIndex((tab) => {
      const rect = tab.getBoundingClientRect();
      return event.clientX < rect.left + rect.width / 2;
    });
    return at < 0 ? tabs.length : at;
  };
  // A place among the shown tabs, as a place among all of them.
  const paneIndex = (at: number) => (at < shown.length ? pane.tabs.indexOf(shown[at]) : pane.tabs.length);

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
    activatePane(pane.id);
    const at = paneIndex(indexAt(event));
    setDropAt(null);
    const tabId = event.dataTransfer.getData(TAB_TYPE);
    if (tabId) {
      const from = pane.tabs.findIndex((tab) => tab.id === tabId);
      // From another pane of the split view: it moves here.
      if (from < 0) return moveTabToPane(tabId, pane.id, at);
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
    // Anything done here is done to this pane, so it becomes the active one first.
    <div className="tab-strip" ref={strip} role="tablist" aria-label="Open pages" onPointerDownCapture={() => activatePane(pane.id)} onDragOver={onDragOver} onDragLeave={() => setDropAt(null)} onDrop={onDrop}>
      {shown.map((tab, i) => {
        const { title, icon } = labelOf(app, tab);
        const active = tab.id === pane.active;
        return (
          <div
            key={tab.id}
            className="tab"
            role="tab"
            aria-selected={active}
            data-drop={dropAt === i ? "before" : dropAt === i + 1 && i === shown.length - 1 ? "after" : undefined}
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
      {hidden.length > 0 && <TabOverflow hidden={hidden.map((tab) => ({ tab, ...labelOf(app, tab) }))} />}
      <button className="icon-button tab-new" aria-label="New tab" title="New tab" onClick={newTab}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
