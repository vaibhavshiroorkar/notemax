import * as Y from "yjs";
import { onDocOpen } from "@/data/docCache";
import { showToast } from "@/ui/toast";

// A workspace shared with you to view: its pages are locked, but the sidebar
// and other places can still change the tree or a page here and there. Those
// changes would never reach anyone, so each one is taken back as it happens.
// Only changes made in this window count; what comes from storage, sync or
// other windows arrives through updates, which are not local.

const guards = new Map<Y.Doc, () => void>();
const docsOf = new Map<string, Set<Y.Doc>>();
const viewOnly = new Set<string>();

/** A set of origins that holds every origin, so every change made here counts. */
class Every extends Set<unknown> {
  has() {
    return true;
  }
}

let toldAt = 0;
const tell = () => {
  if (Date.now() - toldAt < 8000) return;
  toldAt = Date.now();
  showToast("This workspace is shared with you to view, so changes are not kept.");
};

function guard(doc: Y.Doc) {
  if (guards.has(doc)) return;
  const undo: Y.UndoManager = new Y.UndoManager([...doc.share.values()], {
    captureTimeout: 0,
    trackedOrigins: new Every(),
    captureTransaction: (transaction) => transaction.local && transaction.origin !== undo,
  });
  undo.on("stack-item-added", (event: { type: "undo" | "redo" }) => {
    if (event.type !== "undo") return;
    tell();
    // After the change's own transaction has finished.
    queueMicrotask(() => {
      undo.undo();
      undo.clear();
    });
  });
  // Parts of a doc made after it opened, like a page's text arriving from the others.
  const widen = () => {
    for (const type of doc.share.values()) if (!undo.scope.includes(type)) undo.addToScope(type);
  };
  doc.on("afterTransaction", widen);
  guards.set(doc, () => {
    doc.off("afterTransaction", widen);
    undo.destroy();
  });
}

function unguard(doc: Y.Doc) {
  guards.get(doc)?.();
  guards.delete(doc);
}

onDocOpen((workspace, _docId, local) => {
  let docs = docsOf.get(workspace);
  if (!docs) docsOf.set(workspace, (docs = new Set()));
  docs.add(local.doc);
  local.doc.on("destroy", () => {
    docs.delete(local.doc);
    unguard(local.doc);
  });
  if (viewOnly.has(workspace)) guard(local.doc);
});

/** Turns the guard on or off for a workspace, for its open docs and the ones it opens later. */
export function setViewOnly(workspace: string, on: boolean) {
  if (on === viewOnly.has(workspace)) return;
  if (on) viewOnly.add(workspace);
  else viewOnly.delete(workspace);
  for (const doc of docsOf.get(workspace) ?? []) (on ? guard : unguard)(doc);
}
