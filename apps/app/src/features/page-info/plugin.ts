import type { Plugin } from "@/plugins/types";
import { PagePanel } from "./PagePanel";
import "./page-info.css";

export const pageInfoPlugin: Plugin = {
  id: "page-info",
  name: "This page",
  description: "The open page's dates, words and links, and its own settings, in the right sidebar",
  sidePanels: [{ id: "page-info.panel", title: "This page", order: 20, when: (app) => app.activeId !== null, component: PagePanel }],
};
