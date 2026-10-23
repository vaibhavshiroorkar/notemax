import type { TreeItem } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";

/** Pages on a Home card: each with its icon and title, an optional note on the right, and its menu. */
export function HomeList({ app, items, note, empty }: { app: AppContext; items: TreeItem[]; note?(item: TreeItem): string; empty?: string }) {
  if (!items.length) return empty ? <p className="home-empty">{empty}</p> : null;
  return (
    <ul className="home-list">
      {items.map((item) => (
        <li key={item.id} onContextMenu={pageMenu(item)}>
          <button className="row-title icon-title" onClick={() => app.open(item.id)}>
            <Icon name={registry.iconOf(item.kind)} />
            <span>{item.title || "Untitled"}</span>
            {note && <span className="home-list-note">{note(item)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "3 min ago", "Yesterday", "12 Oct": when a page was last edited, short. */
export function editedAgo(at: number, now = Date.now()): string {
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
