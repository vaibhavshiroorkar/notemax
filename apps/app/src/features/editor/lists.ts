import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

const LISTS = ["bulletList", "orderedList", "taskList"];

/** Places in `doc` around `pos` where two lists of the same kind sit side by side. */
function touchingLists(doc: Node, pos: number): number[] {
  const $pos = doc.resolve(pos);
  const found: number[] = [];
  for (let depth = 0; depth <= $pos.depth; depth++) {
    const parent = $pos.node(depth);
    const index = $pos.index(depth);
    for (const i of [index - 1, index]) {
      if (i < 0 || i + 1 >= parent.childCount) continue;
      const a = parent.child(i);
      const b = parent.child(i + 1);
      if (a.type === b.type && LISTS.includes(a.type.name)) found.push($pos.posAtIndex(i + 1, depth));
    }
  }
  return found;
}

/**
 * Two lists of the same kind that end up side by side become one list, the
 * way word processors do it. Without this, deleting the line between two
 * parts of a numbered list leaves the second part counting from 1 again, and
 * its first item can't be nested with Tab.
 */
export const JoinLists = Extension.create({
  name: "joinLists",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("joinLists"),
        appendTransaction(transactions: readonly Transaction[], _old, state) {
          // Edits from another device were joined there already; joining again
          // here would make two copies of the same change.
          const local = transactions.filter((tr) => tr.docChanged && !tr.getMeta(ySyncPluginKey));
          if (!local.length) return null;
          const points = new Set<number>();
          for (const tr of local) {
            // Map each changed spot to the final document.
            const later = local.slice(local.indexOf(tr) + 1);
            tr.mapping.maps.forEach((map, i) =>
              map.forEach((_a, _b, start, end) => {
                for (const pos of [start, end]) {
                  let mapped = tr.mapping.slice(i + 1).map(pos);
                  for (const next of later) mapped = next.mapping.map(mapped);
                  for (const at of touchingLists(state.doc, Math.min(mapped, state.doc.content.size))) points.add(at);
                }
              }),
            );
          }
          if (!points.size) return null;
          const tr = state.tr;
          // From the end, so joining one pair never moves the next one.
          for (const pos of [...points].sort((a, b) => b - a)) if (canJoin(tr.doc, pos)) tr.join(pos);
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});
