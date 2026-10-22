// Back and Forward belong to each tab (see tabs.ts), not to the browser. This
// file connects the two: the address shows the open page as #id, so a reload
// or a bookmark opens it, and the mouse's side buttons and the browser's own
// Back move through the open tab's pages.

/** The page named in the address, as left by a reload or a bookmark. */
export function pageInAddress(): string | null {
  const hash = decodeURIComponent(location.hash.slice(1));
  // A shared page's link, which the share feature reads instead.
  return hash && !hash.startsWith("share=") ? hash : null;
}

const addressOf = (page: string | null) => `${location.pathname}${location.search}${page ? `#${encodeURIComponent(page)}` : ""}`;

/** Puts the open page in the address without adding a browser history entry. */
export function showInAddress(page: string | null) {
  const address = addressOf(page);
  if (address !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, "", address);
}

interface Marker {
  notemax: "base" | "top";
}
const isMarker = (state: unknown, which: Marker["notemax"]) => (state as Marker | null)?.notemax === which;

/**
 * Starts listening. The app keeps two browser entries: a base and a top. The
 * browser's Back lands on the base, which the app turns into the tab's Back and
 * then steps up to the top again, so the browser never leaves the app.
 */
export function startBrowserNavigation(back: () => void, forward: () => void): () => void {
  if (!isMarker(history.state, "top")) {
    history.replaceState({ notemax: "base" } satisfies Marker, "", location.href);
    history.pushState({ notemax: "top" } satisfies Marker, "", location.href);
  }

  // A side button is handled here directly. If the browser also goes back for
  // it, the Back that follows is the same press and is skipped.
  let handledAt = 0;
  const onMouse = (event: MouseEvent) => {
    if (event.button !== 3 && event.button !== 4) return;
    event.preventDefault();
    if (event.type !== "mouseup") return;
    handledAt = performance.now();
    if (event.button === 3) back();
    else forward();
  };
  const onPop = (event: PopStateEvent) => {
    if (!isMarker(event.state, "base")) return;
    if (performance.now() - handledAt > 500) back();
    history.pushState({ notemax: "top" } satisfies Marker, "", location.href);
  };
  window.addEventListener("mousedown", onMouse);
  window.addEventListener("mouseup", onMouse);
  window.addEventListener("popstate", onPop);
  return () => {
    window.removeEventListener("mousedown", onMouse);
    window.removeEventListener("mouseup", onMouse);
    window.removeEventListener("popstate", onPop);
  };
}
