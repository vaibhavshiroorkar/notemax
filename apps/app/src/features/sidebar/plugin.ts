import type { Plugin } from "@/plugins/types";
import { SIDEBAR, SIDE_PANEL, sidePanelWidth, sidebarWidth } from "@/ui/layout";
import { PAGE_MENU } from "./menu";
import { titleQuery } from "./state";

/** True when every word of the query is somewhere in the title, in any case. */
const titleMatches = (title: string, query: string) => {
  const text = (title || "Untitled").toLowerCase();
  return query
    .toLowerCase()
    .split(/s+/)
    .every((word) => text.includes(word));
};

export const sidebarPlugin: Plugin = {
  id: "sidebar",
  name: "Sidebar",
  required: true,
  kinds: [{ kind: "folder", label: "New folder", icon: "folder" }],
  contextMenu: PAGE_MENU,
  useSidebarFilter() {
    const query = titleQuery.use()?.trim();
    if (!query) return null;
    return { label: `"${query}" in the title`, matches: (node) => titleMatches(node.title, query), clear: () => titleQuery.set(null) };
  },
  commands: [
    { id: "sidebar.toggle", title: "Show or hide the sidebar", keywords: ["sidebar", "panel"], shortcut: "Mod+\\", run: (app) => app.toggleSidebar() },
    { id: "sidebar.toggle-right", title: "Show or hide the right sidebar", keywords: ["chapters", "panel", "graph"], shortcut: "Mod+Shift+\\", run: (app) => app.toggleSidePanel() },
    {
      id: "sidebar.reset-widths",
      title: "Reset sidebar widths",
      keywords: ["resize", "size", "default"],
      when: () => sidebarWidth.get() !== SIDEBAR.default || sidePanelWidth.get() !== SIDE_PANEL.default,
      run() {
        sidebarWidth.set(SIDEBAR.default);
        sidePanelWidth.set(SIDE_PANEL.default);
      },
    },
    {
      id: "sidebar.search",
      title: "Search page titles in the sidebar",
      keywords: ["find", "filter", "search"],
      run(app) {
        app.showSidebar();
        titleQuery.set(titleQuery.get() ?? "");
      },
    },
    {
      id: "sidebar.trash",
      title: "Move the open page to trash",
      keywords: ["delete", "remove"],
      when: (app) => app.activeId !== null,
      run: (app) => app.trash(app.activeId!),
    },
  ],
};
