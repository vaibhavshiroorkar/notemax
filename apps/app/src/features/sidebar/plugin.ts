import { trashNode } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { Plugin } from "@/plugins/types";

export const sidebarPlugin: Plugin = {
  id: "sidebar",
  name: "Sidebar",
  kinds: [{ kind: "folder", label: "New folder", icon: "folder" }],
  commands: [
    { id: "sidebar.toggle", title: "Show or hide the sidebar", keywords: ["sidebar", "panel"], shortcut: "Mod+\\", run: (app) => app.toggleSidebar() },
    { id: "sidebar.toggle-right", title: "Show or hide the right sidebar", keywords: ["chapters", "panel"], when: (app) => !!registry.sidePanel(app), run: (app) => app.toggleSidePanel() },
    {
      id: "sidebar.trash",
      title: "Move the open page to trash",
      keywords: ["delete", "remove"],
      when: (app) => app.activeId !== null,
      run: (app) => trashNode(app.doc, app.activeId!),
    },
  ],
};
