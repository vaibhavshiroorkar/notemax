import { useEffect, useState } from "react";

// Matches the sidebar transition in app.css.
const EXIT_MS = 180;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True while `open`, and for a moment after it turns false, so a closing
 * element stays on the page long enough to animate out.
 */
export function usePresence(open: boolean): boolean {
  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Adjusting state during render, as React recommends, so the element never
  // disappears for a frame between "closed" and "leaving".
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reducedMotion());
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return open || leaving;
}
