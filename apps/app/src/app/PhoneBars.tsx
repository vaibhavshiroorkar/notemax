import { useLayoutEffect, useRef, type ReactNode } from "react";
import { pinnedBars, type PinnedBars } from "@/platform/behavior";
import { phoneBar } from "@/ui/phoneBar";
import { replaceToast } from "@/ui/toast";

const SAY: Record<PinnedBars, string> = {
  0: "All bars scroll away with the page",
  1: "The bottom bar stays while you scroll",
  2: "The bottom two bars stay while you scroll",
  3: "All three bars stay while you scroll",
};

/** The top of a screen with its three bars; the ones that stay are drawn solid. */
function PinnedGlyph({ level }: { level: PinnedBars }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="1.75" width="12" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      {[4.25, 7, 9.75].map((y, i) => (
        <rect key={y} x="4" y={y} width="8" height="1.75" rx="0.5" fill="currentColor" opacity={i >= 3 - level ? 1 : 0.25} />
      ))}
    </svg>
  );
}

/** Steps through how many bars stay: one, two, all three, none, and round again. */
export function PinnedBarsButton() {
  const level = pinnedBars.use();
  const next = ((level + 1) % 4) as PinnedBars;
  return (
    <button
      className="icon-button pinned-bars-button"
      aria-label={`Bars that stay while scrolling: ${level}. Change`}
      title="Bars that stay while scrolling"
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        pinnedBars.set(next);
        replaceToast("pinned-bars", SAY[next]);
      }}
    >
      <PinnedGlyph level={level} />
    </button>
  );
}

/**
 * A phone's page, with its three bars at the top of what scrolls. The bars
 * that stay sit in one sticky box whose top is pulled up by the height of the
 * bars that go, so those scroll away and the rest stick. The page below gets
 * the screen's height less the bars, so a board or the graph still fits
 * without scrolling.
 */
export function PhoneScroll({ tabs, navigation, tools, children }: { tabs: ReactNode; navigation: ReactNode; tools: ReactNode; children: ReactNode }) {
  const level = pinnedBars.use();
  const scroller = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = bars.current;
    const page = scroller.current;
    if (!box || !page) return;
    const rows = [...box.children] as HTMLElement[];
    const measure = () => {
      const heights = rows.map((row) => row.offsetHeight);
      const total = heights.reduce((a, b) => a + b, 0);
      const going = heights.slice(0, 3 - level).reduce((a, b) => a + b, 0);
      box.style.top = `${-going}px`;
      page.style.setProperty("--bars-height", `${total}px`);
      page.style.setProperty("--pinned-height", `${total - going}px`);
    };
    measure();
    const watch = new ResizeObserver(measure);
    rows.forEach((row) => watch.observe(row));
    return () => watch.disconnect();
  }, [level]);

  return (
    <div className="page-scroll phone-scroll" ref={scroller}>
      <div className="phone-bars" ref={bars} data-pinned={level}>
        {tabs}
        {navigation}
        <div className="phone-tools" ref={phoneBar.set}>
          <PinnedBarsButton />
          {tools}
        </div>
      </div>
      <div className="phone-page">{children}</div>
    </div>
  );
}
