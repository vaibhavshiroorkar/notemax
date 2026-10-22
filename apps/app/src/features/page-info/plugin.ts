import type { AppContext, Plugin } from "@/plugins/types";
import { PagePanel } from "./PagePanel";
import { SubPages } from "./SubPages";
import "./page-info.css";

// Folders list their contents in the left sidebar, and books in their chapter panel.
const hasSubPages = (app: AppContext) => {
  const item = app.activeId ? app.tree.items.get(app.activeId) : undefined;
  return !!item && item.kind !== "folder" && item.kind !== "book" && item.children.length > 0;
};

export const pageInfoPlugin: Plugin = {
  id: "page-info",
  name: "This page",
  description: "The open page's dates, words and links, its own settings, and the pages inside it, in the right sidebar",
  sidePanels: [
    { id: "page-info.panel", title: "This page", order: 20, when: (app) => app.activeId !== null, component: PagePanel },
    { id: "page-info.inside", title: "Pages inside", order: 25, when: hasSubPages, component: SubPages },
  ],
};
