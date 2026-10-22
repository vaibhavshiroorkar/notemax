import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// Letters and digits in any language, plus the joiners inside words like
// "don't" (straight or curly) and "well-known".
const WORD = /[\p{L}\p{N}_'’-]/u;

/** The word under a point on the screen, as a document range. */
export function wordAt(view: EditorView, x: number, y: number): { from: number; to: number } | null {
  const hit = view.posAtCoords({ left: x, top: y });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  if (!$pos.parent.isTextblock) return null;
  // One character per inline picture or line break, so offsets match positions.
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, "￼");
  let start = $pos.parentOffset;
  let end = start;
  while (start > 0 && WORD.test(text[start - 1])) start--;
  while (end < text.length && WORD.test(text[end])) end++;
  if (start === end) return null;
  return { from: $pos.start() + start, to: $pos.start() + end };
}

const TAP_MS = 300;
const DOUBLE_TAP_MS = 350;
const TAP_SLOP = 10;
const DOUBLE_TAP_SLOP = 24;

/**
 * A double tap selects the word under the finger, the same on every phone.
 * The browsers differ here: some zoom, some select, some just move the cursor.
 */
export function doubleTapSelects(view: EditorView) {
  let down: { x: number; y: number; t: number } | null = null;
  let last: { x: number; y: number; t: number } | null = null;

  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    down = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY, t: event.timeStamp } : null;
  };
  const onEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!down || !touch) return;
    const tap = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
    const quick = tap.t - down.t < TAP_MS && Math.hypot(tap.x - down.x, tap.y - down.y) < TAP_SLOP;
    down = null;
    if (!quick) return void (last = null);
    if (!last || tap.t - last.t > DOUBLE_TAP_MS || Math.hypot(tap.x - last.x, tap.y - last.y) > DOUBLE_TAP_SLOP) return void (last = tap);
    last = null;
    const word = wordAt(view, tap.x, tap.y);
    if (!word) return;
    // Otherwise the tap's click would put the cursor back in the middle of the word.
    event.preventDefault();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, word.from, word.to)));
    view.focus();
  };

  view.dom.addEventListener("touchstart", onStart, { passive: true });
  view.dom.addEventListener("touchend", onEnd);
  return () => {
    view.dom.removeEventListener("touchstart", onStart);
    view.dom.removeEventListener("touchend", onEnd);
  };
}
