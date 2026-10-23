import { useEffect } from "react";
import { createStore } from "@/platform/store";

/**
 * A page that shows inside another page, like a subtopic in its chapter, waiting
 * to be scrolled to. The host page marks the part with data-reveal set to its id.
 */
export const revealing = createStore<string | null>(null);

// The host page loads its text after it shows, which moves the part down, so look again for a while.
const KEEP_LOOKING_MS = 1500;

/** Scrolls to the part being revealed once it is on screen, and lights it up a moment. */
export function useReveal() {
  const id = revealing.use();
  useEffect(() => {
    if (!id) return;
    const started = performance.now();
    let frame = 0;
    let found: HTMLElement | null = null;
    const look = () => {
      const part = document.querySelector<HTMLElement>(`[data-reveal="${CSS.escape(id)}"]`);
      if (part && part !== found) {
        found = part;
        part.dataset.flash = "";
        setTimeout(() => delete part.dataset.flash, 1200);
        const title = part.querySelector<HTMLInputElement>("input");
        // A new subtopic is named first, as a new page would be.
        if (title && !title.value) title.focus({ preventScroll: true });
      }
      if (found) found.scrollIntoView({ block: "start" });
      if (performance.now() - started < KEEP_LOOKING_MS) frame = requestAnimationFrame(look);
      else revealing.set(null);
    };
    frame = requestAnimationFrame(look);
    // Scrolling or typing in the meantime means the reader has taken over.
    const stop = () => {
      cancelAnimationFrame(frame);
      revealing.set(null);
    };
    const opts = { capture: true, passive: true } as const;
    addEventListener("wheel", stop, opts);
    addEventListener("touchmove", stop, opts);
    addEventListener("keydown", stop, opts);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("wheel", stop, opts);
      removeEventListener("touchmove", stop, opts);
      removeEventListener("keydown", stop, opts);
    };
  }, [id]);
}
