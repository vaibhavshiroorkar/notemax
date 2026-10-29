import { accountsEnabled } from "@/features/account/config";
import { accountView } from "@/features/account/session";
import { sidePanelsChanged } from "@/plugins/registry";
import type { Plugin } from "@/plugins/types";
import { CommunityPage } from "./CommunityPage";
import { PostDialog } from "./PostDialog";
import { ProfileCard } from "./ProfileCard";
import { ReaderNotesPanel, loadPostedSources, postedSources, sourceOf } from "./ReaderNotesPanel";
import "./community.css";

export const communityPlugin: Plugin = {
  id: "community",
  name: "Community",
  description: "Post notes and books for everyone to read, follow people, and search what they post",
  // Needs the Notemax server, so it is off on a device set up to work offline.
  online: true,
  settings: [{ id: "community.profile", order: 42, group: "Account and sync", title: "Community profile", icon: "people", keywords: ["username", "name", "bio", "handle"], when: () => accountsEnabled, component: ProfileCard }],
  switcherButtons: [{ id: "community.open", label: "Community", icon: "people", when: () => accountsEnabled, run: (app) => app.openView("community") }],
  views: [{ id: "community", title: "Community", icon: "people", component: CommunityPage }],
  // Private notes readers left on a page you posted, beside the page.
  sidePanels: [{ id: "community.notes", title: "Notes from readers", order: 70, when: (app) => accountsEnabled && postedSources.get().has(sourceOf(app) ?? ""), component: ReaderNotesPanel }],
  start() {
    if (!accountsEnabled) return;
    postedSources.subscribe(() => sidePanelsChanged.set(sidePanelsChanged.get() + 1));
    // Again whenever someone signs in or out.
    let last = "";
    const look = () => {
      const state = accountView.get().state;
      if (state === last || state === "loading") return;
      last = state;
      if (state === "in") void loadPostedSources().catch(() => {});
      else postedSources.set(new Set());
    };
    accountView.subscribe(look);
    look();
  },
  overlays: [{ id: "community.post", component: PostDialog }],
  contextMenu: [
    {
      id: "community.post",
      inside: "share",
      readsText: true,
      title: "Post to community...",
      group: "share",
      targets: ["page"],
      icon: "people",
      when: (target) => accountsEnabled && target.type === "page" && (target.node.kind === "note" || target.node.kind === "book"),
      run: (target, app) => target.type === "page" && app.openOverlay("community.post", { pageId: target.node.id }),
    },
  ],
  commands: [
    { id: "community.open", title: "Open the community", keywords: ["people", "posts", "public", "follow", "profile"], when: () => accountsEnabled, run: (app) => app.openView("community") },
    {
      id: "community.post",
      title: "Post this page to the community",
      readsText: true,
      keywords: ["publish", "public", "share"],
      when: (app) => accountsEnabled && !!app.activeId && ["note", "book"].includes(app.tree.byId.get(app.activeId)?.kind ?? ""),
      run: (app) => app.openOverlay("community.post", { pageId: app.activeId }),
    },
    { id: "community.profile", title: "Edit my community profile", keywords: ["username", "bio", "name"], when: () => accountsEnabled, run: (app) => app.openView("community", { place: "me" }) },
  ],
};
