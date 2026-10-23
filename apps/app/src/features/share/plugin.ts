import { ROOT, createNode } from "@notemax/core";
import type { AppContext, Plugin } from "@/plugins/types";
import { ShareDialog, ShareLine } from "./ShareDialog";
import { keepShare, shareFromLink, shareOf } from "./share";
import "./share.css";

const openNote = (app: AppContext) => (app.activeId && app.tree.byId.get(app.activeId)?.kind === "note" ? app.activeId : null);

/** Opens the page a link was for: the one already here, or a new one that fills in from the people who have it. */
function openFromLink(app: AppContext) {
  if (!shareFromLink) return;
  const { share, title } = shareFromLink;
  const here = [...app.tree.byId.values()].find((node) => node.deletedAt === null && shareOf(node)?.room === share.room);
  if (here) return app.open(here.id);
  const id = createNode(app.doc, "note", ROOT, title || "Shared page");
  keepShare(app.doc, id, share);
  app.open(id);
  app.notify("Opened a shared page. Its text arrives from the people who have it open.");
}

export const sharePlugin: Plugin = {
  id: "share",
  online: true,
  name: "Sharing",
  description: "Share a note by link and write in it together, live",
  pageHeader: [{ id: "share.line", kinds: ["note"], component: ShareLine }],
  overlays: [{ id: "share", component: ShareDialog }],
  contextMenu: [
    {
      id: "share.open",
      inside: "share",
      title: "Share...",
      group: "share",
      icon: "link",
      targets: ["page"],
      when: (target) => target.type === "page" && target.node.kind === "note",
      run: (target, app) => target.type === "page" && app.openOverlay("share", { pageId: target.node.id }),
    },
  ],
  commands: [
    {
      id: "share.page",
      title: "Share this page",
      keywords: ["collaborate", "together", "link", "invite"],
      when: (app) => openNote(app) !== null,
      run: (app) => app.openOverlay("share", { pageId: openNote(app)! }),
    },
  ],
  start: openFromLink,
};
