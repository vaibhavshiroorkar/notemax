import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { PINNED_ORDER, pinnedBars, type PinnedBars } from "@/platform/behavior";
import { phoneBar } from "@/ui/phoneBar";
import { replaceToast } from "@/ui/toast";

const SAY: Record<PinnedBars, string> = {
  0: "All bars scroll away with the page",
  peek: "The bottom bar comes back when you scroll up",
  1: "The bottom bar stays while you scroll",
  2: "Both bars stay while you scroll",
};

/** How many bars stay stuck at the top, counted from the bottom. "peek" sticks one, which hides while scrolling down. */
const stuckOf = (level: PinnedBars) => (level === "peek" ? 1 : level);

/** The top of a screen with its two bars; the ones that stay are drawn solid, and one that comes back on scrolling up as an outline. */
function PinnedGlyph({ level }: { level: PinnedBars }) {
  const stuck = stuckOf(level);
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="1.75" width="12" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      {[4.25, 7.75].map((y, i) =>
        level === "peek" && i === 1 ? (
          <rect key={y} x="4.4" y={y + 0.4} width="7.2" height="1.45" rx="0.3" fill="none" stroke="currentColor" strokeWidth="0.8" />
        ) : (
          <rect key={y} x="4" y={y} width="8" height="2.25" rx="0.5" fill="currentColor" opacity={i >= 2 - stuck ? 1 : 0.25} />
        ),
      )}
    </svg>
  );
}

/** Steps through how many bars stay: the bottom one, both, none, the bottom one on scrolling up, and round again. */
export function PinnedBarsButton() {
  const level = pinnedBars.use();
  const next = PINNED_ORDER[(PINNED_ORDER.indexOf(level) + 1) % PINNED_ORDER.length];
  return (
    <button
      className="icon-button pinned-bars-button"
      aria-label={`${SAY[level]}. Change which bars stay`}
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
 * A phone's page, with its bars at the top of what scrolls: the tabs, and
 * under them the formatting or reading tools when the page has some. The bars
 * that stay sit in one sticky box whose top is pulled up by the height of the
 * bars that go, so those scroll away and the rest stick. The page below gets
 * the screen's height less the bars, so a board or the graph still fits
 * without scrolling. At "peek" the bottom bar slides away while the page is
 * scrolled down and back as soon as it is scrolled up.
 */
export function PhoneScroll({ tabs, tools, children }: { tabs: ReactNode; tools: ReactNode; children: ReactNode }) {
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
      const going = heights.slice(0, rows.length - stuckOf(level)).reduce((a, b) => a + b, 0);
      box.style.top = `${-going}px`;
      page.style.setProperty("--bars-height", `${total}px`);
      page.style.setProperty("--pinned-height", `${total - going}px`);
    };
    measure();
    const watch = new ResizeObserver(measure);
    rows.forEach((row) => watch.observe(row));
    return () => watch.disconnect();
  }, [level]);

  useEffect(() => {
    const box = bars.current;
    const page = scroller.current;
    if (level !== "peek" || !box || !page) return;
    let last = page.scrollTop;
    let moved = 0;
    let touching = false;
    let inputAt = -Infinity;
    const hide = (hidden: boolean) => box.toggleAttribute("data-hidden", hidden);
    const input = () => (inputAt = performance.now());
    const touchStart = () => {
      touching = true;
      input();
    };
    const touchEnd = () => {
      touching = false;
      input();
    };
    const onScroll = () => {
      const top = page.scrollTop;
      const delta = top - last;
      last = top;
      // Near the top the bars are in their own place, not stuck over the page.
      if (top <= box.offsetHeight) return hide(false);
      // Only the reader's own scrolling, and the glide after a flick. Typing
      // that pulls the caret into view must not take the tools away.
      if (!touching && performance.now() - inputAt > 1000) return;
      // A few pixels the same way first, so a shaky finger does not flicker it.
      moved = Math.sign(moved) === Math.sign(delta) ? moved + delta : delta;
      if (moved > 12) hide(true);
      else if (moved < -12) hide(false);
    };
    // Starting to write brings the tools back.
    const focusIn = () => hide(false);
    page.addEventListener("scroll", onScroll, { passive: true });
    page.addEventListener("touchstart", touchStart, { passive: true });
    page.addEventListener("touchend", touchEnd, { passive: true });
    page.addEventListener("touchcancel", touchEnd, { passive: true });
    page.addEventListener("wheel", input, { passive: true });
    page.addEventListener("focusin", focusIn);
    return () => {
      hide(false);
      page.removeEventListener("scroll", onScroll);
      page.removeEventListener("touchstart", touchStart);
      page.removeEventListener("touchend", touchEnd);
      page.removeEventListener("touchcancel", touchEnd);
      page.removeEventListener("wheel", input);
      page.removeEventListener("focusin", focusIn);
    };
  }, [level]);

  return (
    <div className="page-scroll phone-scroll" ref={scroller}>
      <div className="phone-bars" ref={bars} data-pinned={level}>
        {tabs}
        <div className="phone-tools" ref={phoneBar.set}>
          <PinnedBarsButton />
          {tools}
        </div>
      </div>
      <div className="phone-page">{children}</div>
    </div>
  );
}
