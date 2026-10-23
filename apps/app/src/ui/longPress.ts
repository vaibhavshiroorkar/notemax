// On a touch screen a long press belongs to the phone: it selects text in a
// note, and brings up the phone's own menu (Copy, Paste) on what it selected.
// The app's right-click menu is for a mouse or keyboard; page menus on a phone
// are behind each row's ... button.

let lastTouch = -Infinity;

/** True when the event being handled now came from a finger, not a mouse. */
export const fromTouch = () => performance.now() - lastTouch < 1500;

/** A screen with touch and no mouse. */
export const touchOnly = () => matchMedia("(pointer: coarse) and (hover: none)").matches;

/** Keeps the app's right-click menus away from a finger's long press, so the phone's own selection works. */
export function leaveLongPressToThePhone() {
  window.addEventListener("touchstart", () => (lastTouch = performance.now()), { capture: true, passive: true });
  // Before any handler of the app sees it, and without preventDefault, so the phone still does its part.
  window.addEventListener("contextmenu", (event) => fromTouch() && event.stopImmediatePropagation(), true);
  // A finger held on chosen text in a note would drag it, with a drop line that
  // jumps as the finger moves, instead of moving the phone's selection handles.
  // Text moves by cut and paste there. Sidebar rows still drag: they are outside notes.
  window.addEventListener("dragstart", (event) => {
    if (fromTouch() && event.target instanceof Node && (event.target instanceof Element ? event.target : event.target.parentElement)?.closest(".ProseMirror")) event.preventDefault();
  }, true);
}
