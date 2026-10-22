import { useEffect, useRef } from "react";

/** How far from the left edge a swipe must start to open the sidebar. */
const EDGE = 24;
/** How far a finger must travel sideways, more than up or down, to count. */
const DISTANCE = 60;

/**
 * Phone gestures: a swipe in from the left edge opens the sidebar, and a swipe
 * back toward its edge closes an open side. Only on phone-sized screens.
 */
export function useEdgeSwipe(open: () => void, close: () => void) {
  const actions = useRef({ open, close });
  actions.current = { open, close };

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 700px)");
    let start: { x: number; y: number; fromEdge: boolean; side: "left" | "right" | null } | null = null;

    const onStart = (event: TouchEvent) => {
      if (!narrow.matches || event.touches.length !== 1) return (start = null);
      const touch = event.touches[0];
      const target = event.target as Element;
      const side = target.closest?.(".side-panel") ? "right" : target.closest?.(".sidebar, .scrim") ? "left" : null;
      start = { x: touch.clientX, y: touch.clientY, fromEdge: touch.clientX < EDGE, side };
    };
    const onEnd = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0 && start.fromEdge && !start.side) actions.current.open();
        else if ((dx < 0 && start.side === "left") || (dx > 0 && start.side === "right")) actions.current.close();
      }
      start = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);
}
