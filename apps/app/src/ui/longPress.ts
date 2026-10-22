// A long press opens the right-click menu on touch screens. Android sends a
// contextmenu event for it on its own; iPhones and iPads do not, so this sends
// one when the browser did not. Text in a note is left alone: there a long
// press selects words, which phones do well already.

const HOLD_MS = 500;
/** A finger that moves farther than this is scrolling, not pressing. */
const SLOP = 10;

export function enableLongPress() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let nativeMenu = false;
  let swallowClick = false;

  const cancel = () => {
    clearTimeout(timer);
    start = null;
  };

  window.addEventListener("contextmenu", () => (nativeMenu = true), true);

  window.addEventListener(
    "touchstart",
    (event) => {
      cancel();
      if (event.touches.length !== 1) return;
      const target = event.target as Element;
      if (target.closest?.('[contenteditable="true"], input, textarea')) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      nativeMenu = false;
      timer = setTimeout(() => {
        if (!start || nativeMenu) return;
        swallowClick = true;
        target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: start.x, clientY: start.y }));
        start = null;
      }, HOLD_MS);
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > SLOP) cancel();
    },
    { passive: true },
  );
  window.addEventListener("touchend", cancel, { passive: true });
  window.addEventListener("touchcancel", cancel, { passive: true });

  // Lifting the finger after the menu opened must not also tap what was under it.
  window.addEventListener(
    "click",
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
