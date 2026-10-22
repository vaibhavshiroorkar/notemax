import { createNode } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";

/** The open page's sub-pages, so they are a click away even where the left sidebar does not list them, like inside a chapter. */
export function SubPages({ app }: { app: AppContext }) {
  const item = app.activeId ? app.tree.items.get(app.activeId) : undefined;
  if (!item) return null;
  return (
    <div className="sub-pages">
      <ul>
        {item.children.map((child) => (
          <li key={child.id}>
            <button className="row-title icon-title" onClick={() => app.open(child.id)} onContextMenu={pageMenu(app.tree.byId.get(child.id))}>
              <Icon name={child.kind === "note" ? "note" : registry.iconOf(child.kind)} />
              <span>{child.title || "Untitled"}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="footer-button" onClick={() => app.open(createNode(app.doc, "note", item.id))}>
        <Icon name="plus" />
        <span>Add a page inside</span>
      </button>
    </div>
  );
}
