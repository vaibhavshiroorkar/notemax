// The landing page lives in index.html and public/boot.js chooses it before the
// first paint. This file holds the app back while it shows, so a visit that
// only reads the landing page never creates a workspace or opens storage.

const root = document.documentElement;

export const showingLanding = () => root.dataset.start === "landing";

/**
 * Runs `start` now, or once the visitor opens the app from the landing page.
 * The open links point to "/?app", which also works before this code loads:
 * boot.js then opens the app after a normal page load. Here it happens in place.
 */
export function startWhenOpened(start: () => void): void {
  if (!showingLanding()) {
    start();
    return;
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-open-app]")) {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!showingLanding()) return;
      // Any "notemax:" key sends this browser straight to the app next time (boot.js).
      try {
        localStorage.setItem("notemax:opened", "1");
      } catch {
        // Storage is blocked; the app says so once it starts.
      }
      root.dataset.start = "app";
      window.scrollTo(0, 0);
      start();
    });
  }
}
