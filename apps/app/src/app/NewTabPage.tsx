import { recentPages } from "@/data/recent";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";

/** What an empty tab shows: the last pages opened, and ways to start something. */
export function NewTabPage({ app }: { app: AppContext }) {
  const recent = recentPages
    .use()
    .map((id) => app.tree.items.get(id))
    .filter((item) => item && item.kind !== "folder")
    .slice(0, 8);

  return (
    <div className="new-tab">
      <h1 className="new-tab-title">New tab</h1>
      <div className="new-tab-actions">
        <button className="button" onClick={() => app.create("note")}>
          <Icon name="note" />
          New note
        </button>
        <button className="button" onClick={app.openPalette}>
          <Icon name="search" />
          Find a page
        </button>
      </div>
      {recent.length > 0 && (
        <>
          <h2 className="new-tab-heading">Recent</h2>
          <ul className="new-tab-list">
            {recent.map((item) => (
              <li key={item!.id}>
                <button className="row-title icon-title" onClick={() => app.open(item!.id)}>
                  <Icon name={registry.iconOf(item!.kind)} />
                  <span>{item!.title || "Untitled"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
