import { useEffect, type RefObject } from "react";

/** How far a finger must scroll one way before the bars move, so small jitters do nothing. */
const HIDE_AFTER = 24;
const SHOW_AFTER = 12;
/** Near the top of a page the bars always show. */
const TOP = 48;

/**
 * Phones: the top bar (and a chapter's book line) slides away while reading
 * down a page and comes back on a small scroll up, so the way back is always
 * one flick away. Writes `data-bars` on the app element straight away instead
 * of through React, so scrolling never redraws the app.
 */
export function useHidingBars(frame: RefObject<HTMLElement | null>, page: string | null) {
  useEffect(() => {
    const narrow = matchMedia("(max-width: 700px)");
    const last = new WeakMap<Element, number>();
    let travel = 0;
    const set = (hidden: boolean) => {
      const app = frame.current;
      if (!app) return;
      // An open side needs its button, so the bar stays while one is open.
      const sideOpen = app.dataset.sidebar === "open" || app.dataset.sidePanel === "open";
      if (hidden && !sideOpen) app.dataset.bars = "hidden";
      else delete app.dataset.bars;
    };
    const onScroll = (event: Event) => {
      const scroller = event.target;
      if (!narrow.matches || !(scroller instanceof Element) || !scroller.classList.contains("page-scroll")) return;
      const top = scroller.scrollTop;
      const delta = top - (last.get(scroller) ?? top);
      last.set(scroller, top);
      if (top < TOP) {
        travel = 0;
        return set(false);
      }
      // Distance moved in one direction; turning around starts the count again.
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > HIDE_AFTER) set(true);
      else if (travel < -SHOW_AFTER) set(false);
    };
    const onResize = () => !narrow.matches && set(false);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    narrow.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      narrow.removeEventListener("change", onResize);
    };
  }, [frame]);

  // A new page starts with the bars showing.
  useEffect(() => {
    if (frame.current) delete frame.current.dataset.bars;
  }, [frame, page]);
}
