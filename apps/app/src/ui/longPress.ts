// A long press opens the right-click menu on touch screens. Android sends a
// contextmenu event for it on its own; iPhones and iPads do not, so this sends
// one when the browser did not. That includes text in a note: there a hold
// opens the menu and a double tap selects a word. Text boxes keep the phone's
// own menu.

const HOLD_MS = 500;
/** A finger that moves farther than this is scrolling, not pressing. */
const SLOP = 10;

let lastTouch = -Infinity;

/** True when the event being handled now came from a finger, not a mouse. */
export const fromTouch = () => performance.now() - lastTouch < 1500;

/** A screen with touch and no mouse, where a long press is the only right click. */
export const touchOnly = () => matchMedia("(pointer: coarse) and (hover: none)").matches;

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
      lastTouch = performance.now();
      if (event.touches.length !== 1) return;
      const target = event.target as Element;
      if (target.closest?.("input, textarea")) return;
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
  // Lifting the finger after the menu opened must not also tap what was under
  // it. Cancelling the touchend stops the tap's mouse events and click, so the
  // cursor in a note stays where it was.
  window.addEventListener(
    "touchend",
    (event) => {
      if (swallowClick) {
        swallowClick = false;
        if (event.cancelable) event.preventDefault();
        else swallowClick = true;
      }
      cancel();
    },
    { passive: false },
  );
  window.addEventListener("touchcancel", cancel, { passive: true });

  // In case the touchend could not be cancelled.
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
