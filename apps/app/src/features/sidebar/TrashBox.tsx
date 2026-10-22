import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { deleteForever, descendantsOf, restoreNode, type Tree, type TreeNode } from "@notemax/core";
import { forgetDoc } from "@/data/docCache";
import { getStore } from "@/platform/platform";
import { ConfirmDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";

/** Erases nodes and their stored bodies. The tree stops listing them first, so a failure only leaves unreachable text on disk. */
function eraseForever(doc: Y.Doc, nodes: TreeNode[]) {
  const ids: string[] = [];
  for (const node of nodes) {
    // A page trashed before its folder went with the folder already.
    if (!ids.includes(node.id)) ids.push(...deleteForever(doc, node.id));
  }
  // Any copy still open in memory goes first, so a late save cannot bring text back.
  Promise.all(ids.map(forgetDoc))
    .then(getStore)
    .then((store) => Promise.all(ids.map((id) => store.remove(id))))
    .catch((err) => console.warn("[notemax] could not erase note bodies", err));
}

const matches = (node: TreeNode, query: string) => {
  const title = (node.title || "Untitled").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => title.includes(word));
};

/** The trash at the bottom of the sidebar: a button with a count that opens a list upward, with its own search. */
export function TrashBox({ tree, doc }: { tree: Tree; doc: Y.Doc }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<TreeNode[] | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const count = tree.trash.length;

  useEffect(() => {
    if (!open) return;
    // The confirm dialog is inside the wrapper too, so answering it keeps the box open.
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.querySelector("dialog[open]") && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = query.trim() ? tree.trash.filter((node) => matches(node, query)) : tree.trash;

  return (
    <div className="trash-wrap" ref={wrapper}>
      <button
        className="footer-icon trash-button"
        aria-label={`Trash (${count})`}
        aria-expanded={open}
        title={count ? `Trash: ${count} ${count === 1 ? "page" : "pages"}` : "Trash"}
        onClick={() => setOpen(!open)}
      >
        <Icon name="trash" />
        {count > 0 && <span className="trash-count">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="trash-box" role="dialog" aria-label="Trash">
          <header className="trash-box-header">
            <strong>Trash</strong>
            {count > 0 && (
              <button className="link-button danger" onClick={() => setToDelete(tree.trash)}>
                Empty trash
              </button>
            )}
          </header>
          {count > 0 && (
            <label className="settings-search trash-search">
              <Icon name="search" />
              <input type="search" placeholder="Search the trash" aria-label="Search the trash" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          )}
          {shown.length ? (
            <ul>
              {shown.map((node) => {
                const title = node.title || "Untitled";
                return (
                  <li key={node.id} className="row">
                    <span className="row-title">{title}</span>
                    <button className="icon-button" aria-label={`Restore ${title}`} title="Restore" onClick={() => restoreNode(doc, node.id)}>
                      <Icon name="restore" />
                    </button>
                    <button className="icon-button danger" aria-label={`Delete ${title} forever`} title="Delete forever" onClick={() => setToDelete([node])}>
                      <Icon name="trash" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">{count ? "Nothing in the trash matches." : "The trash is empty."}</p>
          )}
          {toDelete && (
            <DeleteDialog
              nodes={toDelete}
              inside={toDelete.reduce((sum, node) => sum + descendantsOf(doc, node.id).length, 0)}
              onConfirm={() => {
                setToDelete(null);
                eraseForever(doc, toDelete);
              }}
              onCancel={() => setToDelete(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DeleteDialog({ nodes, inside, onConfirm, onCancel }: { nodes: TreeNode[]; inside: number; onConfirm(): void; onCancel(): void }) {
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
