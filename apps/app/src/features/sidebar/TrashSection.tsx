import { useState } from "react";
import type * as Y from "yjs";
import { deleteForever, descendantsOf, restoreNode, type Tree, type TreeNode } from "@notemax/core";
import { getStore } from "@/platform/platform";
import { ConfirmDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";

export function TrashSection({ tree, doc }: { tree: Tree; doc: Y.Doc }) {
  const [toDelete, setToDelete] = useState<TreeNode | null>(null);

  const confirmDelete = (node: TreeNode) => {
    setToDelete(null);
    const ids = deleteForever(doc, node.id);
    // The tree no longer lists them, so a failure here only leaves unreachable
    // text behind on disk. It never brings a deleted note back.
    getStore()
      .then((store) => Promise.all(ids.map((id) => store.remove(id))))
      .catch((err) => console.warn("[notemax] could not erase note bodies", err));
  };

  if (!tree.trash.length) return null;
  return (
    <>
      <details className="trash">
        <summary>Trash ({tree.trash.length})</summary>
        <ul>
          {tree.trash.map((node) => {
            const title = node.title || "Untitled";
            return (
              <li key={node.id} className="row">
                <span className="row-title">{title}</span>
                <button className="icon-button" aria-label={`Restore ${title}`} title="Restore" onClick={() => restoreNode(doc, node.id)}>
                  <Icon name="restore" />
                </button>
                <button className="icon-button danger" aria-label={`Delete ${title} forever`} title="Delete forever" onClick={() => setToDelete(node)}>
                  <Icon name="trash" />
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      {toDelete && (
        <DeleteDialog
          node={toDelete}
          inside={descendantsOf(doc, toDelete.id).length}
          onConfirm={() => confirmDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}

function DeleteDialog({ node, inside, onConfirm, onCancel }: { node: TreeNode; inside: number; onConfirm(): void; onCancel(): void }) {
  const title = node.title || "Untitled";
  return (
    <ConfirmDialog
      title="Delete forever?"
      message={
        <>
          <strong>{title}</strong>
          {inside > 0 && ` and the ${inside} ${inside === 1 ? "note" : "notes"} inside it`} will be erased from this device. This cannot be undone.
        </>
      }
      confirmLabel="Delete forever"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
