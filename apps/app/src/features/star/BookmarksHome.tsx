import { useMemo } from "react";
import { HomeList } from "@/features/workspaces/HomeList";
import type { AppContext } from "@/plugins/types";
import { starredItems } from "./star";

/** Bookmarked pages on Home. Folders stay in the sidebar, where they open. */
export function BookmarksHome({ app }: { app: AppContext }) {
  const items = useMemo(() => starredItems(app.tree).filter((item) => item.kind !== "folder"), [app.tree]);
  return <HomeList app={app} items={items} empty="Star a page from its menu or the star at its top right to keep it here." />;
}
