import { onNodesAdded, setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import type * as Y from "yjs";
import { syncIsOn } from "@/features/sync/runtime";
import { isDesktop } from "@/platform/platform";
import { getPref, setPref } from "@/platform/prefs";

// A page made in a browser while sync is off lives only in that browser, which
// may clear its storage. It keeps the time it was made as its "temporary"
// setting. The mark syncs like any setting, so after signing in the pages still
// say where they came from until someone keeps them.
const TEMPORARY = "temporary";
// Set once this browser has marked the pages it had before marks existed.
const MARKED_OLD = "temporaryMarkedOld";

export const isTemporary = (node: TreeNode) => typeof node.props[TEMPORARY] === "number";

/** True while a new page would live only in this browser. */
export const onlyHere = () => !isDesktop && !syncIsOn();

export function markTemporary(doc: Y.Doc, ids: string[]) {
  const now = Date.now();
  doc.transact(() => {
    for (const id of ids) {
      // Gone already, like a page made and deleted in one go.
      try {
        setProp(doc, id, TEMPORARY, now);
      } catch {}
    }
  });
}

/** Drops the mark: the pages become normal pages. */
export function keep(doc: Y.Doc, ids: string[]) {
  doc.transact(() => ids.forEach((id) => setProp(doc, id, TEMPORARY, null)));
}

/** Temporary pages that are not in the trash, oldest first. */
export function temporaryItems(tree: Tree): TreeItem[] {
  const out: TreeItem[] = [];
  for (const item of tree.items.values()) if (isTemporary(item) && tree.visible.has(item.id)) out.push(item);
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Marks the pages this browser already had the first time it runs this
 * version, then every page made here while sync is off. Returns a stop function.
 */
export function startMarking(doc: Y.Doc, tree: Tree): () => void {
  if (getPref(MARKED_OLD) === null) {
    if (onlyHere()) markTemporary(doc, [...tree.items.values()].filter((item) => !isTemporary(item)).map((item) => item.id));
    setPref(MARKED_OLD, "1");
  }
  return onNodesAdded(doc, (ids) => {
    // After the change that made the page has finished, so the mark is its own small edit.
    if (onlyHere()) queueMicrotask(() => markTemporary(doc, ids));
  });
}
