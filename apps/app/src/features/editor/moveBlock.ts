import { Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

const ITEMS = ["listItem", "taskItem"];

/**
 * Swaps the block the cursor is in with the one above or below, keeping the
 * cursor where it was in it: a list item among its list, anything else among
 * the blocks around it. Returns false at the top or bottom, so the key does
 * its usual thing there.
 */
export function moveBlock(state: EditorState, dir: -1 | 1, dispatch?: (tr: Transaction) => void): boolean {
  const { $from, $to } = state.selection;
  let depth = 0;
  for (let d = $from.depth; d > 0; d--) {
    if (ITEMS.includes($from.node(d).type.name)) {
      depth = d;
      break;
    }
  }
  // Outside a list, the block right under the note.
  if (!depth) depth = 1;
  if ($from.depth < depth || $to.depth < depth || $from.before(depth) !== $to.before(depth)) return false;

  const parent = $from.node(depth - 1);
  const index = $from.index(depth - 1);
  const other = index + dir;
  if (other < 0 || other >= parent.childCount) return false;
  if (!dispatch) return true;

  const node = parent.child(index);
  const neighbor = parent.child(other);
  const here = $from.before(depth);
  const start = dir < 0 ? here - neighbor.nodeSize : here;
  const tr = state.tr.replaceWith(start, start + node.nodeSize + neighbor.nodeSize, Fragment.from(dir < 0 ? [node, neighbor] : [neighbor, node]));
  const shift = dir * neighbor.nodeSize;
  tr.setSelection(TextSelection.create(tr.doc, state.selection.anchor + shift, state.selection.head + shift));
  dispatch(tr.scrollIntoView());
  return true;
}

/** Alt+Up and Alt+Down move the paragraph, heading or list item the cursor is in. */
export const MoveBlock = Extension.create({
  name: "moveBlock",
  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => moveBlock(this.editor.state, -1, (tr) => this.editor.view.dispatch(tr)),
      "Alt-ArrowDown": () => moveBlock(this.editor.state, 1, (tr) => this.editor.view.dispatch(tr)),
    };
  },
});
