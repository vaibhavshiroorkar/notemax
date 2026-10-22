import { getPref, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";

// Open pages live in tabs, and each tab keeps its own Back and Forward list.
// Tabs sit in a pane. There is one pane for now; split view will add more
// without changing the shape saved here.
//
// A page is a node id, or "view:<id>" for a plugin's full page that is not a
// node, like the graph.

export interface Visit {
  page: string;
  /** For a view, what it was opened with, like the page the graph centers on. */
  options?: Record<string, unknown>;
}

export interface Tab {
  id: string;
  /** Pages opened in this tab, oldest first. Empty for a new tab. */
  visits: Visit[];
  /** The visit showing now. */
  index: number;
}

export interface Pane {
  id: string;
  tabs: Tab[];
  active: string;
}

export interface Layout {
  panes: Pane[];
  activePane: string;
}

const VIEW = "view:";
export const isView = (page: string) => page.startsWith(VIEW);
export const viewPage = (id: string) => VIEW + id;
export const viewId = (page: string) => page.slice(VIEW.length);

/** Back goes this far at most, per tab. */
const MAX_VISITS = 50;

const newId = () => Math.random().toString(36).slice(2, 10);
const blankTab = (): Tab => ({ id: newId(), visits: [], index: -1 });
const tabWith = (visit: Visit): Tab => ({ id: newId(), visits: [visit], index: 0 });

function fresh(page: string | null): Layout {
  const tab = page ? tabWith({ page }) : blankTab();
  return { panes: [{ id: "main", tabs: [tab], active: tab.id }], activePane: "main" };
}

function decode(raw: string | null, fallbackPage: string | null): Layout {
  try {
    const value = JSON.parse(raw ?? "") as Layout;
    const pane = value.panes[0];
    if (!pane?.tabs.length) throw new Error("no tabs");
    for (const tab of pane.tabs) {
      if (typeof tab.id !== "string" || !Array.isArray(tab.visits)) throw new Error("bad tab");
      tab.visits = tab.visits.filter((visit) => typeof visit?.page === "string");
      tab.index = Math.min(Math.max(tab.index, -1), tab.visits.length - 1);
      if (tab.index < 0 && tab.visits.length) tab.index = tab.visits.length - 1;
    }
    if (!pane.tabs.some((tab) => tab.id === pane.active)) pane.active = pane.tabs[0].id;
    // One pane until split view exists.
    return { panes: [pane], activePane: pane.id };
  } catch {
    return fresh(fallbackPage);
  }
}

// Not a savedStore: two browser tabs of the web app must not switch each
// other's pages. Each window reads the saved tabs once, at start.
export const layout = createStore<Layout>(fresh(null));

let saveTimer: ReturnType<typeof setTimeout> | undefined;
layout.subscribe(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setPref("tabs", JSON.stringify(layout.get())), 300);
});

/** Loads the saved tabs. `fallbackPage` opens when there are none, like on first start. */
export function loadTabs(fallbackPage: string | null) {
  layout.set(decode(getPref("tabs"), fallbackPage));
}

export const activePane = (value = layout.get()) => value.panes.find((pane) => pane.id === value.activePane)!;
export const activeTab = (value = layout.get()) => {
  const pane = activePane(value);
  return pane.tabs.find((tab) => tab.id === pane.active)!;
};
/** What the active tab shows, or null for a new tab. */
export const currentVisit = (value = layout.get()): Visit | null => {
  const tab = activeTab(value);
  return tab.visits[tab.index] ?? null;
};

/** Changes the active pane's tabs and returns nothing, so callers stay short. */
function updatePane(change: (pane: Pane) => Pane) {
  const value = layout.get();
  layout.set({ ...value, panes: value.panes.map((pane) => (pane.id === value.activePane ? change(pane) : pane)) });
}

function updateTab(id: string, change: (tab: Tab) => Tab) {
  updatePane((pane) => ({ ...pane, tabs: pane.tabs.map((tab) => (tab.id === id ? change(tab) : tab)) }));
}

/** Opens a page in the active tab, or in a new tab next to it. */
export function openPage(page: string, { newTab = false, options }: { newTab?: boolean; options?: Record<string, unknown> } = {}) {
  const visit: Visit = options ? { page, options } : { page };
  if (newTab) {
    const tab = tabWith(visit);
    updatePane((pane) => {
      const at = pane.tabs.findIndex((t) => t.id === pane.active) + 1;
      return { ...pane, tabs: [...pane.tabs.slice(0, at), tab, ...pane.tabs.slice(at)], active: tab.id };
    });
    return;
  }
  const tab = activeTab();
  const current = tab.visits[tab.index];
  if (current?.page === page && JSON.stringify(current.options) === JSON.stringify(options)) return;
  // Opening a page drops whatever was ahead, as in a browser.
  const visits = [...tab.visits.slice(0, tab.index + 1), visit].slice(-MAX_VISITS);
  updateTab(tab.id, () => ({ ...tab, visits, index: visits.length - 1 }));
}

/** Shows another page in the active tab without adding a visit, like after the open page was trashed. */
export function replacePage(page: string) {
  const tab = activeTab();
  if (tab.index < 0) return openPage(page);
  const visits = tab.visits.map((visit, i) => (i === tab.index ? { page } : visit));
  updateTab(tab.id, () => ({ ...tab, visits }));
}

export const canGoBack = (value = layout.get()) => activeTab(value).index > 0;
export const canGoForward = (value = layout.get()) => {
  const tab = activeTab(value);
  return tab.index < tab.visits.length - 1;
};

export function goBack() {
  const tab = activeTab();
  if (tab.index > 0) updateTab(tab.id, () => ({ ...tab, index: tab.index - 1 }));
}

export function goForward() {
  const tab = activeTab();
  if (tab.index < tab.visits.length - 1) updateTab(tab.id, () => ({ ...tab, index: tab.index + 1 }));
}

export function newTab() {
  const tab = blankTab();
  updatePane((pane) => ({ ...pane, tabs: [...pane.tabs, tab], active: tab.id }));
}

export function activateTab(id: string) {
  updatePane((pane) => (pane.tabs.some((tab) => tab.id === id) ? { ...pane, active: id } : pane));
}

/** Closes a tab. The one to its right becomes active, or to its left at the end. The last tab becomes a new tab. */
export function closeTab(id = activeTab().id) {
  updatePane((pane) => {
    const at = pane.tabs.findIndex((tab) => tab.id === id);
    if (at < 0) return pane;
    if (pane.tabs[at].visits.length) closed.push({ tab: pane.tabs[at], at });
    const tabs = pane.tabs.filter((tab) => tab.id !== id);
    if (!tabs.length) {
      const blank = blankTab();
      return { ...pane, tabs: [blank], active: blank.id };
    }
    const active = pane.active === id ? tabs[Math.min(at, tabs.length - 1)].id : pane.active;
    return { ...pane, tabs, active };
  });
}

// Closed tabs, newest last, for Ctrl+Shift+T. In memory only.
const closed: { tab: Tab; at: number }[] = [];

export function reopenClosedTab() {
  const last = closed.pop();
  if (!last) return;
  const tab = { ...last.tab, id: newId() };
  updatePane((pane) => {
    // A lone new tab is replaced rather than kept beside the reopened one.
    const tabs = pane.tabs.length === 1 && !pane.tabs[0].visits.length ? [] : pane.tabs;
    const at = Math.min(last.at, tabs.length);
    return { ...pane, tabs: [...tabs.slice(0, at), tab, ...tabs.slice(at)], active: tab.id };
  });
}

export function closeOtherTabs(id: string) {
  updatePane((pane) => ({ ...pane, tabs: pane.tabs.filter((tab) => tab.id === id), active: id }));
}

/** Ctrl+Tab and Ctrl+Shift+Tab: the next or previous tab, wrapping around. */
export function cycleTab(step: 1 | -1) {
  updatePane((pane) => {
    const at = pane.tabs.findIndex((tab) => tab.id === pane.active);
    return { ...pane, active: pane.tabs[(at + step + pane.tabs.length) % pane.tabs.length].id };
  });
}

/** Drag and drop in the tab strip. */
export function moveTab(id: string, to: number) {
  updatePane((pane) => {
    const tab = pane.tabs.find((t) => t.id === id);
    if (!tab) return pane;
    const rest = pane.tabs.filter((t) => t.id !== id);
    const at = Math.max(0, Math.min(to, rest.length));
    return { ...pane, tabs: [...rest.slice(0, at), tab, ...rest.slice(at)] };
  });
}
