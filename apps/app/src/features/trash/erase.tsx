import type * as Y from "yjs";
import { deleteForever, historyDocId, type TreeNode } from "@notemax/core";
import { forgetDoc } from "@/data/docCache";
import { getStore } from "@/platform/platform";
import { savedStore } from "@/platform/store";
import { ConfirmDialog } from "@/ui/Dialog";

/** Days a page stays in the trash before it is erased by itself. 0 keeps it until you empty the trash. */
export const keepDays = savedStore<number>("trashKeepDays", 0);

/** Erases nodes and their stored bodies. The tree stops listing them first, so a failure only leaves unreachable text on disk. */
export function eraseForever(doc: Y.Doc, nodes: TreeNode[]) {
  const ids: string[] = [];
  for (const node of nodes) {
    // A page trashed before its folder went with the folder already.
    if (!ids.includes(node.id)) ids.push(...deleteForever(doc, node.id));
  }
  // Any copy still open in memory goes first, so a late save cannot bring text back.
  Promise.all(ids.map((id) => forgetDoc(id)))
    .then(getStore)
    .then((store) => Promise.all(ids.flatMap((id) => [store.remove(id), store.remove(historyDocId(id))])))
    .catch((err) => console.warn("[notemax] could not erase note bodies", err));
}

/** Erases what has been in the trash longer than the setting allows. */
export function eraseOld(doc: Y.Doc, trash: readonly TreeNode[], now = Date.now()) {
  const days = keepDays.get();
  if (days <= 0) return;
  const old = trash.filter((node) => node.deletedAt !== null && now - node.deletedAt > days * 24 * 60 * 60 * 1000);
  if (old.length) eraseForever(doc, old);
}

export function DeleteDialog({ nodes, inside, onConfirm, onCancel }: { nodes: TreeNode[]; inside: number; onConfirm(): void; onCancel(): void }) {
  const what = nodes.length === 1 ? <strong>{nodes[0].title || "Untitled"}</strong> : <strong>{nodes.length} pages</strong>;
  return (
    <ConfirmDialog
      title={nodes.length === 1 ? "Delete forever?" : "Empty the trash?"}
      message={
        <>
          {what}
          {inside > 0 && ` and the ${inside} ${inside === 1 ? "note" : "notes"} inside ${nodes.length === 1 ? "it" : "them"}`} will be erased from this device. This cannot be undone.
        </>
      }
      confirmLabel="Delete forever"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
