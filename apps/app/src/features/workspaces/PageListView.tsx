import type { ReactNode } from "react";
import type { TreeItem } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon, type IconName } from "@/ui/Icon";
import { editedAgo } from "./HomeList";

/**
 * A Home card opened as a page of its own: every page it holds, each with
 * where it sits and when it was last edited, and room for a button of the
 * card's own on each row.
 */
export function PageListView({ app, title, icon, items, empty, action }: { app: AppContext; title: string; icon: IconName; items: TreeItem[]; empty: string; action?(item: TreeItem): ReactNode }) {
  return (
    <article className="note page-list-view">
      <h1 className="page-list-title">
        <Icon name={icon} /> {title}
      </h1>
      {items.length ? (
        <ul className="page-list">
          {items.map((item) => {
            const where = app.hub.where(item.id);
            return (
              <li key={item.id} onContextMenu={pageMenu(item)}>
                <button className="page-list-open" onClick={() => app.open(item.id)}>
                  <Icon name={registry.iconOf(item.kind)} />
                  <span className="page-list-name">{item.title || "Untitled"}</span>
                  {where && <span className="page-list-where">{where}</span>}
                  <span className="page-list-when">{editedAgo(item.editedAt)}</span>
                </button>
                {action?.(item)}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="home-empty">{empty}</p>
      )}
    </article>
  );
}
