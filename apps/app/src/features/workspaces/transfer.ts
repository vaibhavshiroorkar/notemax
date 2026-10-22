import * as Y from "yjs";
import { WORKSPACE_DOC_ID, assetDocId, copyNodesTo, scopedId, type DocStore } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { getSharedStore } from "@/platform/platform";
import { currentWorkspace } from "@/platform/prefs";

/** A page's whole stored state, taken from memory when it is open, so the last keystrokes come along. */
async function stateOf(store: DocStore, docId: string): Promise<Uint8Array | null> {
  const open = peekDoc(docId);
  if (open) return Y.encodeStateAsUpdate(open.doc);
  const { updates } = await store.load(scopedId(currentWorkspace, docId));
  return updates.length ? Y.mergeUpdates(updates) : null;
}

/** The pictures and videos a note shows, by asset id. Other pages keep theirs inside their own doc. */
function picturesIn(state: Uint8Array): string[] {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    const found = new Set<string>();
    for (const node of doc.getXmlFragment("content").createTreeWalker((n) => n instanceof Y.XmlElement && (n.nodeName === "image" || n.nodeName === "video"))) {
      const asset = (node as Y.XmlElement).getAttribute("asset");
      if (typeof asset === "string") found.add(asset);
    }
    return [...found];
  } finally {
    doc.destroy();
  }
}

/**
 * Copies a page, with everything inside it and the pictures they show, to the
 * end of another workspace's top level. Returns the copy's id there. That
 * workspace's tree is written last, so it never lists a page whose text has
 * not arrived yet.
 */
export async function copyToWorkspace(workspaceDoc: Y.Doc, id: string, target: string): Promise<string> {
  const store = await getSharedStore();
  const treeId = scopedId(target, WORKSPACE_DOC_ID);
  const tree = new Y.Doc();
  try {
    const { updates } = await store.load(treeId);
    if (updates.length) Y.applyUpdate(tree, Y.mergeUpdates(updates));
    const before = Y.encodeStateVector(tree);
    const ids = copyNodesTo(workspaceDoc, id, tree);
    for (const [from, to] of ids) {
      const state = await stateOf(store, from);
      if (!state) continue;
      await store.append(scopedId(target, to), state);
      for (const asset of picturesIn(state)) {
        const picture = await stateOf(store, assetDocId(asset));
        if (picture) await store.append(scopedId(target, assetDocId(asset)), picture);
      }
    }
    await store.append(treeId, Y.encodeStateAsUpdate(tree, before));
    return ids.get(id)!;
  } finally {
    tree.destroy();
  }
}
