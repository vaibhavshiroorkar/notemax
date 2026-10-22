import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Draws its children once they come near the screen, and keeps them after.
 * Until then a box of `height` holds their place, so a long list of editors
 * opens fast and the scrollbar stays honest.
 */
export function LazyMount({ children, height = 160 }: { children: ReactNode; height?: number }) {
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown || !box.current) return;
    const watcher = new IntersectionObserver((seen) => seen.some((entry) => entry.isIntersecting) && setShown(true), { rootMargin: "800px 0px" });
    watcher.observe(box.current);
    return () => watcher.disconnect();
  }, [shown]);
  if (shown) return <>{children}</>;
  return <div ref={box} className="lazy-mount" style={{ minHeight: height }} aria-busy="true" />;
}
