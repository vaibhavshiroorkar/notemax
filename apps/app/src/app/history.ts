import { createStore } from "@/platform/store";

// Pages are browser history entries, so the mouse's back and forward buttons,
// Alt+Left in a browser, and the app's own Back command all move through the
// same list. The open page is also in the address, as #id.

interface Entry {
  page: string;
  /** How many app entries come before this one. Back stops at 0, so it never leaves the app. */
  depth: number;
}

const isEntry = (state: unknown): state is Entry => typeof (state as Entry | null)?.page === "string";

let depth = 0;
// The deepest entry seen, so Forward knows when there is nothing ahead.
let furthest = 0;

export const canGo = createStore({ back: false, forward: false });
const update = () => canGo.set({ back: depth > 0, forward: depth < furthest });

const addressOf = (id: string) => `${location.pathname}${location.search}#${encodeURIComponent(id)}`;

/** The page named in the address, as left by a reload or a bookmark. */
export function pageInAddress(): string | null {
  return decodeURIComponent(location.hash.slice(1)) || null;
}

/** Marks the current entry as `id` and calls `onPage` whenever Back or Forward lands on another page. */
export function startHistory(id: string, onPage: (id: string) => void): () => void {
  const state: unknown = history.state;
  if (isEntry(state) && state.page === id) depth = state.depth;
  else history.replaceState({ page: id, depth: 0 } satisfies Entry, "", addressOf(id));
  furthest = depth;
  update();

  const onPop = (event: PopStateEvent) => {
    if (!isEntry(event.state)) return;
    depth = event.state.depth;
    furthest = Math.max(furthest, depth);
    update();
    onPage(event.state.page);
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}

/** Records a newly opened page. Forward history after the current page is dropped, as in a browser. */
export function pushPage(id: string) {
  if (isEntry(history.state) && history.state.page === id) return;
  depth += 1;
  furthest = depth;
  history.pushState({ page: id, depth } satisfies Entry, "", addressOf(id));
  update();
}

export function goBack() {
  if (depth > 0) history.back();
}

export function goForward() {
  if (depth < furthest) history.forward();
}
