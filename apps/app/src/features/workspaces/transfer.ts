import * as Y from "yjs";
import { WORKSPACE_DOC_ID, addWorkspace, assetDocId, copyNodesTo, scopedId, splitScoped, type DocStore } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { getSharedStore } from "@/platform/platform";
import { openList } from "./list";

/** A page's whole stored state, taken from memory when it is open, so the last keystrokes come along. */
async function stateOf(store: DocStore, docId: string, workspace: string): Promise<Uint8Array | null> {
  const open = peekDoc(docId, workspace);
  if (open) return Y.encodeStateAsUpdate(open.doc);
  const { updates } = await store.load(scopedId(workspace, docId));
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
export async function copyToWorkspace(workspaceDoc: Y.Doc, id: string, target: string, source: string): Promise<string> {
  const store = await getSharedStore();
  const treeId = scopedId(target, WORKSPACE_DOC_ID);
  const tree = new Y.Doc();
  try {
    const { updates } = await store.load(treeId);
    if (updates.length) Y.applyUpdate(tree, Y.mergeUpdates(updates));
    const before = Y.encodeStateVector(tree);
    const ids = copyNodesTo(workspaceDoc, id, tree);
    for (const [from, to] of ids) {
      const state = await stateOf(store, from, source);
      if (!state) continue;
      await store.append(scopedId(target, to), state);
      for (const asset of picturesIn(state)) {
        const picture = await stateOf(store, assetDocId(asset), source);
        if (picture) await store.append(scopedId(target, assetDocId(asset)), picture);
      }
    }
    const update = Y.encodeStateAsUpdate(tree, before);
    // A workspace whose tree is open, like one with a tab here, takes the
    // change in memory, which also saves it. Written only to storage, the
    // open tree would never see it.
    const open = peekDoc(WORKSPACE_DOC_ID, target);
    if (open) Y.applyUpdate(open.doc, update);
    else await store.append(treeId, update);
    return ids.get(id)!;
  } finally {
    tree.destroy();
  }
}

/**
 * Makes a new workspace holding every page of another, as they are on this
 * device. Page ids stay the same inside it, so links between its pages still
 * work. `tidy` gets the copied tree before it is stored, to take out what must
 * not come along. The tree is written last and the workspace listed after
 * that, so nobody opens it half full. Returns the new workspace's id.
 */
export async function copyWorkspace(source: string, name: string, color: string, tidy?: (tree: Y.Doc) => void): Promise<string> {
  const store = await getSharedStore();
  const id = crypto.randomUUID().slice(0, 8);
  const docIds = (await store.list()).flatMap((stored) => {
    const scoped = splitScoped(stored);
    return scoped.workspace === source && scoped.docId !== WORKSPACE_DOC_ID ? [scoped.docId] : [];
  });
  for (const docId of docIds) {
    const state = await stateOf(store, docId, source);
    if (state) await store.append(scopedId(id, docId), state);
  }
  const tree = new Y.Doc();
  try {
    const state = await stateOf(store, WORKSPACE_DOC_ID, source);
    if (state) Y.applyUpdate(tree, state);
    tidy?.(tree);
    await store.append(scopedId(id, WORKSPACE_DOC_ID), Y.encodeStateAsUpdate(tree));
  } finally {
    tree.destroy();
  }
  const list = await openList();
  addWorkspace(list.doc, name, color, id);
  await list.flush();
  return id;
}
