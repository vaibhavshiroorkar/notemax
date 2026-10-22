import { useMemo, useState } from "react";
import { ROOT, descendantsOf, restoreNode, type Tree, type TreeNode } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { DeleteDialog, eraseForever, keepDays } from "./erase";

const DAY = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "5 days ago", then the date. */
function agoOf(time: number, now: number): string {
  const days = Math.floor((now - time) / DAY);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(time).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Where the page was before it went to the trash, like "Research / Drafts". */
function placeOf(tree: Tree, node: TreeNode): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (let id = node.parentId; id !== ROOT && !seen.has(id); ) {
    seen.add(id);
    const parent = tree.byId.get(id);
    if (!parent) break;
    names.unshift(parent.title || "Untitled");
    id = parent.parentId;
  }
  return names.join(" / ");
}

const matches = (node: TreeNode, query: string) => {
  const title = (node.title || "Untitled").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => title.includes(word));
};

const KEEP_CHOICES: [number, string][] = [
  [0, "Until I empty it"],
  [7, "7 days"],
  [30, "30 days"],
  [90, "90 days"],
];

/** The trash as a page of its own: search, sort, pick several, restore or erase them, and how long pages stay. */
export function TrashView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const { tree, doc } = app;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"deleted" | "title">("deleted");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [toDelete, setToDelete] = useState<TreeNode[] | null>(null);
  const keep = keepDays.use();
  const now = Date.now();

  const shown = useMemo(() => {
    const list = query.trim() ? tree.trash.filter((node) => matches(node, query)) : [...tree.trash];
    return sort === "title" ? list.sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled")) : list;
  }, [tree.trash, query, sort]);
  // Pages restored or erased elsewhere drop out of the picked ones by themselves.
  const pickedNodes = tree.trash.filter((node) => picked.has(node.id));
  const allShownPicked = shown.length > 0 && shown.every((node) => picked.has(node.id));

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const restore = (nodes: TreeNode[]) => {
    doc.transact(() => nodes.forEach((node) => restoreNode(doc, node.id)));
    setPicked(new Set());
  };

  return (
    <div className="trash-page">
      <header className="trash-page-header">
        <h1>Trash</h1>
        {tree.trash.length > 0 && (
          <button className="button button-danger" onClick={() => setToDelete(tree.trash)}>
            Empty trash
          </button>
        )}
      </header>
      <label className="trash-keep">
        <span>Keep pages in the trash</span>
        <select className="settings-select" value={keep} onChange={(event) => keepDays.set(Number(event.target.value))}>
          {KEEP_CHOICES.map(([days, label]) => (
            <option key={days} value={days}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {tree.trash.length > 0 && (
        <div className="trash-tools">
          <label className="settings-search">
            <Icon name="search" />
            <input type="search" placeholder="Search the trash" aria-label="Search the trash" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="settings-select" aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as "deleted" | "title")}>
            <option value="deleted">Newest first</option>
            <option value="title">Title</option>
          </select>
        </div>
      )}

      {pickedNodes.length > 0 && (
        <div className="trash-picked" role="toolbar" aria-label="Picked pages">
          <span>{pickedNodes.length} picked</span>
          <button className="button" onClick={() => restore(pickedNodes)}>
            <Icon name="restore" />
            Restore
          </button>
          <button className="button button-danger" onClick={() => setToDelete(pickedNodes)}>
            Delete forever
          </button>
          <button className="link-button" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      )}

      {shown.length > 0 ? (
        <ul className="trash-list">
          <li className="trash-all">
            <label>
              <input type="checkbox" checked={allShownPicked} onChange={() => setPicked(allShownPicked ? new Set() : new Set(shown.map((node) => node.id)))} />
              Pick all
            </label>
          </li>
          {shown.map((node) => {
            const title = node.title || "Untitled";
            const place = placeOf(tree, node);
            const inside = descendantsOf(doc, node.id).length;
            const meta = [place && `From ${place}`, `deleted ${agoOf(node.deletedAt!, now)}`, inside > 0 && `${inside} ${inside === 1 ? "page" : "pages"} inside`].filter(Boolean);
            return (
              <li key={node.id} className="trash-item" aria-selected={picked.has(node.id) || undefined}>
                <input type="checkbox" aria-label={`Pick ${title}`} checked={picked.has(node.id)} onChange={() => toggle(node.id)} />
                <Icon name={node.kind === "note" ? "note" : registry.iconOf(node.kind)} />
                <div className="trash-item-text">
                  {/* A folder has no page of its own to look at. */}
                  {node.kind === "folder" ? (
                    <span className="trash-item-title">{title}</span>
                  ) : (
                    <button className="trash-item-title" title="Open it to look before restoring" onClick={() => app.open(node.id, { fromTrash: true })}>
                      {title}
                    </button>
                  )}
                  <span className="trash-item-meta">{meta.join(", ")}</span>
                </div>
                <button className="icon-button" aria-label={`Restore ${title}`} title="Restore" onClick={() => restore([node])}>
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
        <p className="empty trash-empty">{tree.trash.length ? "Nothing in the trash matches." : "The trash is empty."}</p>
      )}

      {toDelete && (
        <DeleteDialog
          nodes={toDelete}
          inside={toDelete.reduce((sum, node) => sum + descendantsOf(doc, node.id).length, 0)}
          onConfirm={() => {
            eraseForever(doc, toDelete);
            setToDelete(null);
            setPicked(new Set());
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
