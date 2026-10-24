import { useMemo } from "react";
import { HomeList } from "@/features/workspaces/HomeList";
import { PageListView } from "@/features/workspaces/PageListView";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { setStarred, starredItems } from "./star";

/** Bookmarked pages on Home. Folders stay in the sidebar, where they open. */
export function BookmarksHome({ app }: { app: AppContext }) {
  const items = useMemo(() => starredItems(app.tree).filter((item) => item.kind !== "folder"), [app.tree]);
  return <HomeList app={app} items={items} empty="Star a page from its menu or the star at its top right to keep it here." />;
}

/** Every bookmark as a page of its own, each with its star to take it out. */
export function BookmarksView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const items = useMemo(() => starredItems(app.tree).filter((item) => item.kind !== "folder"), [app.tree]);
  return (
    <PageListView
      app={app}
      title="Bookmarks"
      icon="star"
      items={items}
      empty="Star a page from its menu or the star at its top right to keep it here."
      action={(item) => (
        <button className="icon-button page-list-action" aria-label={`Take ${item.title || "Untitled"} out of Bookmarks`} title="Take out of Bookmarks" onClick={() => setStarred(app.doc, [item.id], false)}>
          <Icon name="star" />
        </button>
      )}
    />
  );
}
