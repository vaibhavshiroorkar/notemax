// On a touch screen a long press belongs to the phone: it selects text in a
// note, and brings up the phone's own menu (Copy, Paste) on what it selected.
// The app's right-click menu is for a mouse or keyboard; page menus on a phone
// are behind each row's ... button.

let lastTouch = -Infinity;

/** True when the event being handled now came from a finger, not a mouse. */
export const fromTouch = () => performance.now() - lastTouch < 1500;

/** Keeps the app's right-click menus away from a finger's long press, so the phone's own selection works. */
export function leaveLongPressToThePhone() {
  let onSelection = false;
  window.addEventListener(
    "touchstart",
    (event) => {
      lastTouch = performance.now();
      const touch = event.touches[0];
      onSelection = !!touch && pointOnSelection(touch.clientX, touch.clientY);
    },
    { capture: true, passive: true },
  );
  // Before any handler of the app sees it, and without preventDefault, so the phone still does its part.
  window.addEventListener("contextmenu", (event) => fromTouch() && event.stopImmediatePropagation(), true);
  // A hold on words in a note selects them with the phone's handles. Dragging
  // them then would start at once, with a drop line jumping under the finger.
  // So a finger drags only text that was already selected before it touched
  // down: select first, then hold the selection and move it.
  window.addEventListener("dragstart", (event) => {
    if (fromTouch() && !onSelection && event.target instanceof Node && (event.target instanceof Element ? event.target : event.target.parentElement)?.closest(".ProseMirror")) event.preventDefault();
  }, true);
}

/** True when the point is on the text selected now. */
function pointOnSelection(x: number, y: number): boolean {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
  // A little slack around each line, since a fingertip is wider than a caret.
  const slack = 6;
  return [...selection.getRangeAt(0).getClientRects()].some((r) => x >= r.left - slack && x <= r.right + slack && y >= r.top - slack && y <= r.bottom + slack);
}
