import { ROOT, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import type { SidebarFilter } from "@/plugins/types";
import { Icon } from "@/ui/Icon";

/** Every visible item, chapters included, in the order the sidebar shows them. */
function inOrder(items: TreeItem[], out: TreeItem[] = []): TreeItem[] {
  for (const item of items) {
    out.push(item);
    inOrder(item.children, out);
  }
  return out;
}

const whereOf = (tree: Tree, item: TreeItem) => (item.parentId === ROOT ? "" : tree.items.get(item.parentId)?.title || "Untitled");

/** Replaces the tree while a filter is on: one flat list, so matches deep in folders are not hidden. */
export function FilteredList({
  tree,
  filters,
  activeId,
  onSelect,
}: {
  tree: Tree;
  filters: SidebarFilter[];
  activeId: string | null;
  onSelect(id: string): void;
}) {
  const matches = inOrder(tree.top).filter((item) => filters.every((filter) => filter.matches(item as TreeNode)));

  return (
    <>
      <div className="filter-bar" role="status">
        <span>
          {matches.length} {matches.length === 1 ? "item" : "items"} with {filters.map((filter) => filter.label).join(" ")}
        </span>
        <button className="icon-button" aria-label="Clear filter" title="Show everything" onClick={() => filters.forEach((filter) => filter.clear())}>
          <Icon name="close" />
        </button>
      </div>
      {matches.length ? (
        <ul>
          {matches.map((item) => {
            const title = item.title || "Untitled";
            const where = whereOf(tree, item);
            return (
              <li key={item.id}>
                <div className="row" data-kind={item.kind} aria-current={item.id === activeId ? "page" : undefined}>
                  {item.kind === "folder" ? (
                    // Folders have no page to open.
                    <span className="row-title icon-title">
                      <Icon name="folder" />
                      <span>{title}</span>
                    </span>
                  ) : (
                    <button className="row-title icon-title" onClick={() => onSelect(item.id)}>
                      <Icon name={item.kind === "book" ? "book" : "note"} />
                      <span>{title}</span>
                    </button>
                  )}
                  {where && <span className="row-where">{where}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">Nothing matches.</p>
      )}
    </>
  );
}
