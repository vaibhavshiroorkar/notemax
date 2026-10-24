import type { AppContext, Plugin } from "@/plugins/types";
import { MentionsPanel } from "./MentionsPanel";
import { startIndex } from "./text-index";
import "./search.css";

const onNote = (app: AppContext) => !!app.activeId && app.tree.byId.get(app.activeId)?.kind === "note";

export const searchPlugin: Plugin = {
  id: "search",
  name: "Full-text search",
  description: "Ctrl+K finds words inside notes too, and the right sidebar lists pages that mention a page without linking to it",
  sidePanels: [{ id: "search.mentions", title: "Mentioned in", order: 32, when: onNote, component: MentionsPanel }],
  workspaceStart: (app) => void startIndex(app.doc, app.workspace).catch((err) => console.warn("[notemax] could not build the search index", err)),
};
