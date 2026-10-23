import { useMemo } from "react";
import { ROOT, type Tree, type TreeItem } from "@notemax/core";
import { expand } from "@/features/sidebar/state";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { setStarred, starredItems } from "./star";

/** The folders above an item, so a starred folder can be shown open in the tree. */
function foldersAbove(tree: Tree, id: string): string[] {
  const out: string[] = [];
  for (let parentId = tree.items.get(id)?.parentId; parentId && parentId !== ROOT; parentId = tree.items.get(parentId)?.parentId) out.push(parentId);
  return out;
}

/** Starred pages, below the notes in the left sidebar, each with its star to take it out. Hidden while nothing is starred. */
export function BookmarksSection({ app }: { app: AppContext }) {
  const items = useMemo(() => starredItems(app.tree), [app.tree]);
  if (!items.length) return null;

  // A folder has no page: it opens in the tree below instead.
  const show = (item: TreeItem) => {
    if (item.kind !== "folder") return app.open(item.id);
    expand(item.id, ...foldersAbove(app.tree, item.id));
    requestAnimationFrame(() => document.querySelector(`.sidebar .row[data-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ block: "nearest" }));
  };

  return (
    <section className="section starred" aria-label="Bookmarks">
      <header className="section-header">
        <span>Bookmarks</span>
      </header>
      <ul>
        {items.map((item) => {
          const title = item.title || "Untitled";
          return (
            <li key={item.id}>
              <div className="row" data-kind={item.kind} aria-current={item.id === app.activeId ? "page" : undefined} onContextMenu={pageMenu(item)}>
                <button
                  className="row-title icon-title"
                  onClick={() => show(item)}
                  onMouseDown={(event) => event.button === 1 && event.preventDefault()}
                  onAuxClick={(event) => event.button === 1 && item.kind !== "folder" && app.open(item.id, { newTab: true })}
                >
                  <Icon name={item.kind === "note" ? "note" : registry.iconOf(item.kind)} />
                  <span>{title}</span>
                </button>
                <button className="icon-button star-button" data-on aria-label={`Unstar ${title}`} title="Unstar" onClick={() => setStarred(app.doc, [item.id], false)}>
                  <Icon name="star" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
