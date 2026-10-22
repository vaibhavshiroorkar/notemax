import { getPref, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";

// Open pages live in tabs, and each tab keeps its own Back and Forward list.
// Tabs sit in panes. Split view puts panes side by side or one above another,
// as a tree: each split is a row or a column of parts, each part a pane or
// another split. Everything acts on the active pane, the one last clicked.
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

/** How panes are arranged: one pane, or a row or column of parts, each with its share of the room. */
export type Split = { pane: string } | { dir: "row" | "column"; parts: Split[]; sizes?: number[] };

export interface Layout {
  panes: Pane[];
  activePane: string;
  /** Left out when there is one pane. */
  split?: Split;
}

export type Edge = "left" | "right" | "top" | "bottom";

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
    const panes = value.panes.filter((pane) => pane?.tabs?.length);
    if (!panes.length) throw new Error("no tabs");
    for (const pane of panes) {
      for (const tab of pane.tabs) {
        if (typeof tab.id !== "string" || !Array.isArray(tab.visits)) throw new Error("bad tab");
        tab.visits = tab.visits.filter((visit) => typeof visit?.page === "string");
        tab.index = Math.min(Math.max(tab.index, -1), tab.visits.length - 1);
        if (tab.index < 0 && tab.visits.length) tab.index = tab.visits.length - 1;
      }
      if (!pane.tabs.some((tab) => tab.id === pane.active)) pane.active = pane.tabs[0].id;
    }
    const ids = new Set(panes.map((pane) => pane.id));
    // A saved arrangement that no longer matches its panes falls back to the first pane alone.
    const split = value.split && sameIds(value.split, ids) ? value.split : undefined;
    const kept = split ? panes : [panes[0]];
    const active = kept.some((pane) => pane.id === value.activePane) ? value.activePane : kept[0].id;
    return { panes: kept, activePane: active, split };
  } catch {
    return fresh(fallbackPage);
  }
}

/** Pane ids in a split, in order. */
function panesIn(split: Split): string[] {
  return "pane" in split ? [split.pane] : split.parts.flatMap(panesIn);
}

function sameIds(split: Split, ids: Set<string>) {
  const inSplit = panesIn(split);
  return inSplit.length === ids.size && inSplit.every((id) => ids.has(id));
}

/** The arrangement, with one pane standing for itself. */
export const splitOf = (value = layout.get()): Split => value.split ?? { pane: value.panes[0].id };

/** A split with a pane taken out. A row or column left with one part becomes that part. */
function without(split: Split, id: string): Split | null {
  if ("pane" in split) return split.pane === id ? null : split;
  const kept = split.parts.map((part, i) => ({ part: without(part, id), size: split.sizes?.[i] ?? 1 })).filter((p) => p.part !== null);
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0].part;
  return { dir: split.dir, parts: kept.map((p) => p.part!), sizes: kept.map((p) => p.size) };
}

/** A split with a new pane put beside `target`, on its `edge`. */
function beside(split: Split, target: string, added: string, edge: Edge): Split {
  if ("pane" in split) {
    if (split.pane !== target) return split;
    const dir = edge === "left" || edge === "right" ? "row" : "column";
    const parts: Split[] = edge === "left" || edge === "top" ? [{ pane: added }, split] : [split, { pane: added }];
    return { dir, parts, sizes: [1, 1] };
  }
  const dir = edge === "left" || edge === "right" ? "row" : "column";
  const at = split.parts.findIndex((part) => "pane" in part && part.pane === target);
  // Beside a pane in a row of the same direction: a new part of that row, not a split inside a split.
  if (at >= 0 && split.dir === dir) {
    const parts = [...split.parts];
    const sizes = [...(split.sizes ?? split.parts.map(() => 1))];
    const i = edge === "left" || edge === "top" ? at : at + 1;
    parts.splice(i, 0, { pane: added });
    sizes.splice(i, 0, sizes[at]);
    return { ...split, parts, sizes };
  }
  return { ...split, parts: split.parts.map((part) => beside(part, target, added, edge)) };
}

/** Removes empty panes, keeping at least one, and drops the split when one pane is left. */
function tidy(value: Layout): Layout {
  let split = splitOf(value);
  let panes = value.panes;
  for (const pane of value.panes) {
    if (pane.tabs.length || panes.length === 1) continue;
    panes = panes.filter((p) => p.id !== pane.id);
    split = without(split, pane.id) ?? { pane: panes[0].id };
  }
  const active = panes.some((pane) => pane.id === value.activePane) ? value.activePane : panes[0].id;
  return { panes, activePane: active, split: "pane" in split ? undefined : split };
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
const activeTab = (value = layout.get()) => {
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

/**
 * Closes a tab. The one to its right becomes active, or to its left at the
 * end. A pane's last tab closes the pane, unless it is the only one: then it
 * becomes a new tab.
 */
export function closeTab(id = activeTab().id) {
  const lone = layout.get().panes.length === 1;
  updatePane((pane) => {
    const at = pane.tabs.findIndex((tab) => tab.id === id);
    if (at < 0) return pane;
    if (pane.tabs[at].visits.length) closed.push({ tab: pane.tabs[at], at });
    const tabs = pane.tabs.filter((tab) => tab.id !== id);
    if (!tabs.length) {
      if (!lone) return { ...pane, tabs };
      const blank = blankTab();
      return { ...pane, tabs: [blank], active: blank.id };
    }
    const active = pane.active === id ? tabs[Math.min(at, tabs.length - 1)].id : pane.active;
    return { ...pane, tabs, active };
  });
  layout.set(tidy(layout.get()));
}

/** Makes a pane the active one, the one Back, Ctrl+W and opening pages act on. */
export function activatePane(id: string) {
  const value = layout.get();
  if (value.activePane !== id && value.panes.some((pane) => pane.id === id)) layout.set({ ...value, activePane: id });
}

const paneWithTab = (value: Layout, tabId: string) => value.panes.find((pane) => pane.tabs.some((tab) => tab.id === tabId));

/**
 * Moves a tab to a new pane on one edge of `target`: the split view. A tab
 * dragged to the edge of its own pane, when it is the pane's only tab, keeps a
 * copy behind so the pane is not left empty.
 */
export function splitTab(tabId: string, target: string, edge: Edge) {
  const value = layout.get();
  const from = paneWithTab(value, tabId);
  const tab = from?.tabs.find((t) => t.id === tabId);
  if (!from || !tab || !value.panes.some((pane) => pane.id === target)) return;
  const moving = from.id === target && from.tabs.length === 1 ? { ...tab, id: newId() } : tab;
  const added: Pane = { id: newId(), tabs: [moving], active: moving.id };
  const panes = value.panes.map((pane) => {
    if (pane.id !== from.id || moving !== tab) return pane;
    const tabs = pane.tabs.filter((t) => t.id !== tabId);
    return { ...pane, tabs, active: pane.active === tabId ? (tabs[0]?.id ?? "") : pane.active };
  });
  layout.set(tidy({ panes: [...panes, added], activePane: added.id, split: beside(splitOf(value), target, added.id, edge) }));
}

/** Moves a tab into another pane, at `index` among its tabs. */
export function moveTabToPane(tabId: string, target: string, index = Infinity) {
  const value = layout.get();
  const from = paneWithTab(value, tabId);
  const tab = from?.tabs.find((t) => t.id === tabId);
  if (!from || !tab || from.id === target) return;
  const panes = value.panes.map((pane) => {
    if (pane.id === from.id) {
      const tabs = pane.tabs.filter((t) => t.id !== tabId);
      return { ...pane, tabs, active: pane.active === tabId ? (tabs[0]?.id ?? "") : pane.active };
    }
    if (pane.id === target) {
      const at = Math.min(index, pane.tabs.length);
      return { ...pane, tabs: [...pane.tabs.slice(0, at), tab, ...pane.tabs.slice(at)], active: tab.id };
    }
    return pane;
  });
  layout.set(tidy({ ...value, panes, activePane: target }));
}

/** Opens the active tab's page again in a new pane beside it. */
export function splitActive(edge: Edge) {
  const value = layout.get();
  const tab = activeTab(value);
  const copy: Tab = { ...tab, id: newId(), visits: tab.visits.length ? [tab.visits[tab.index]] : [], index: tab.visits.length ? 0 : -1 };
  const added: Pane = { id: newId(), tabs: [copy], active: copy.id };
  layout.set({ panes: [...value.panes, added], activePane: added.id, split: beside(splitOf(value), value.activePane, added.id, edge) });
}

/** Closes the active pane and its tabs, when there are others. */
export function closePane(id = layout.get().activePane) {
  const value = layout.get();
  if (value.panes.length === 1) return;
  layout.set(tidy({ ...value, panes: value.panes.map((pane) => (pane.id === id ? { ...pane, tabs: [] } : pane)) }));
}

/** The shares of a row or column, after its divider was dragged. `path` picks the split: part indexes from the top. */
export function resizeSplit(path: number[], sizes: number[]) {
  const value = layout.get();
  const change = (split: Split, rest: number[]): Split => {
    if ("pane" in split) return split;
    if (!rest.length) return { ...split, sizes };
    return { ...split, parts: split.parts.map((part, i) => (i === rest[0] ? change(part, rest.slice(1)) : part)) };
  };
  layout.set({ ...value, split: change(splitOf(value), path) });
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
