import { setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import type * as Y from "yjs";

// A starred page keeps the time it was starred as its "starred" setting, so the
// Starred list keeps that order and a star syncs like any other page setting.
const STARRED = "starred";

export const isStarred = (node: TreeNode) => typeof node.props[STARRED] === "number";

export function setStarred(doc: Y.Doc, ids: string[], on: boolean) {
  const now = Date.now();
  // A few milliseconds apart, so pages starred together keep their order.
  doc.transact(() => ids.forEach((id, i) => setProp(doc, id, STARRED, on ? now + i : null)));
}

/** Starred pages that are not in the trash, in the order they were starred. */
export function starredItems(tree: Tree): TreeItem[] {
  const out: TreeItem[] = [];
  for (const item of tree.items.values()) if (isStarred(item) && tree.visible.has(item.id)) out.push(item);
  return out.sort((a, b) => (a.props[STARRED] as number) - (b.props[STARRED] as number));
}
