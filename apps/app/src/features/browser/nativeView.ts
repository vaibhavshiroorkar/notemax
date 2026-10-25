import { useEffect, useRef, type RefObject } from "react";
import { isDesktop } from "@/platform/platform";

// In the desktop app a browser page is a real web view laid over the page,
// where the frame would be. It sits above everything in the window, so it
// steps aside whenever something of the app is drawn over its box, like a
// dialog, a menu or the palette, and while a tab is being dragged, so the
// tab can be dropped there. It follows the box it stands in as the window
// and splits change, and is only told to move when its place changed.

/** Small notes that may go under the view rather than blank it. */
const UNDER_IT = ".toasts, .status-bar";
/** Where across the box to look for something drawn over it. */
const SAMPLES = [0.02, 0.25, 0.5, 0.75, 0.98];

async function invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface NativeView {
  step(step: "back" | "forward" | "reload"): void;
}

/** Desktop only: true when browser pages use a real web view instead of a frame. */
export const usesNativeView = isDesktop;

/**
 * Keeps a web view over `box` showing `url`. Calls `onVisit` with where the
 * view went after a link inside it, and `onTitle` with the site's title.
 */
export function useNativeView(
  box: RefObject<HTMLDivElement | null>,
  label: string,
  url: string,
  { onVisit, onTitle }: { onVisit(url: string): void; onTitle(title: string): void },
): NativeView {
  const latest = useRef({ onVisit, onTitle, url });
  latest.current = { onVisit, onTitle, url };
  // Set while the view is on screen, so a new address can go straight to it.
  const showAt = useRef<((url: string) => void) | null>(null);

  // The view lives as long as the page is open here.
  useEffect(() => {
    if (!usesNativeView) return;
    let live = true;
    let shown = false;
    let dragging = false;
    // What the view was last told, so the same place is never sent twice.
    let sent = "";
    let frame = 0;
    const zoom = () => Number(getComputedStyle(document.documentElement).zoom) || 1;
    const where = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return null;
      const z = zoom();
      return { x: r.left * z, y: r.top * z, width: r.width * z, height: r.height * z };
    };
    /** True when anything of the app is drawn over some of the box, or the box is out of sight. */
    const covered = () => {
      const el = box.current;
      if (dragging || document.visibilityState === "hidden" || !el || el.offsetParent === null) return true;
      const r = el.getBoundingClientRect();
      for (const fx of SAMPLES)
        for (const fy of SAMPLES) {
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          if (hit && hit !== el && !el.contains(hit) && !hit.closest(UNDER_IT)) return true;
        }
      return false;
    };
    const syncNow = () => {
      frame = 0;
      if (!live || !latest.current.url) return;
      const place = where();
      if (!place || covered() || place.width < 2 || place.height < 2) {
        if (shown) void invoke("browser_hide", { label }).catch(() => {});
        shown = false;
        sent = "";
        return;
      }
      const at = `${Math.round(place.x)},${Math.round(place.y)},${Math.round(place.width)},${Math.round(place.height)}`;
      if (shown && at === sent) return;
      sent = at;
      // Showing also goes to the address when the view is somewhere else, so it is used for both.
      void invoke(shown ? "browser_place" : "browser_show", shown ? { label, ...place } : { label, url: latest.current.url, ...place }).catch((err) => console.warn("[notemax] browser view", err));
      shown = true;
    };
    // At most once a frame, however many changes come in.
    const sync = () => {
      if (!frame) frame = requestAnimationFrame(syncNow);
    };
    const dragStart = () => {
      dragging = true;
      sync();
    };
    const dragEnd = () => {
      dragging = false;
      sync();
    };
    showAt.current = (url) => {
      const place = where();
      if (!place || covered()) return;
      void invoke("browser_show", { label, url, ...place }).catch((err) => console.warn("[notemax] browser view", err));
      shown = true;
      sent = `${Math.round(place.x)},${Math.round(place.y)},${Math.round(place.width)},${Math.round(place.height)}`;
    };
    syncNow();
    const resize = new ResizeObserver(sync);
    if (box.current) resize.observe(box.current);
    const watch = new MutationObserver(sync);
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "class", "style"] });
    addEventListener("resize", sync);
    addEventListener("scroll", sync, true);
    document.addEventListener("visibilitychange", sync);
    // A tab dragged to make a split must be able to land on the page under the view.
    addEventListener("dragstart", dragStart, true);
    addEventListener("dragend", dragEnd, true);
    addEventListener("drop", dragEnd, true);
    // Popups that open and close without changing the page, like a dialog's backdrop, are caught on the next pointer move.
    addEventListener("pointermove", sync, true);

    const stops: (() => void)[] = [];
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const visit = await listen<{ label: string; url: string }>("browser-visited", ({ payload }) => payload.label === label && latest.current.onVisit(payload.url));
      const title = await listen<{ label: string; title: string }>("browser-titled", ({ payload }) => payload.label === label && latest.current.onTitle(payload.title));
      if (live) stops.push(visit, title);
      else {
        visit();
        title();
      }
    });

    return () => {
      live = false;
      showAt.current = null;
      resize.disconnect();
      watch.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("resize", sync);
      removeEventListener("scroll", sync, true);
      document.removeEventListener("visibilitychange", sync);
      removeEventListener("dragstart", dragStart, true);
      removeEventListener("dragend", dragEnd, true);
      removeEventListener("drop", dragEnd, true);
      removeEventListener("pointermove", sync, true);
      stops.forEach((stop) => stop());
      void invoke("browser_hide", { label }).catch(() => {});
    };
  }, [box, label]);

  // A new address typed in the bar, or Back and Forward through the ones typed.
  // One the view reached by a link is already there, and showing it again does nothing.
  useEffect(() => {
    if (usesNativeView && url) showAt.current?.(url);
  }, [url]);

  return { step: (step) => void invoke("browser_step", { label, step }).catch(() => {}) };
}
