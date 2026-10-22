import { openedOnPage } from "@/app/history";
import { startAt } from "@/platform/mode";
import type { ContextMenuItem, Plugin } from "@/plugins/types";
import { ROLES, holder, setRole } from "./roles";
import { SpecialSection } from "./SpecialSection";

const useAs: ContextMenuItem = {
  id: "special.use-as",
  title: "Use as",
  group: "layout",
  targets: ["page"],
  when: (target) => target.type === "page" && ROLES.some((role) => role.kinds.includes(target.node.kind)),
  submenu: (target, app) => {
    if (target.type !== "page") return [];
    const node = target.node;
    return ROLES.filter((role) => role.kinds.includes(node.kind)).map((role) => {
      const has = node.props[role.id] === true;
      return {
        id: `special.${role.id}`,
        title: has ? `Stop being the ${role.title.toLowerCase()}` : role.title,
        group: "special",
        targets: ["page"],
        icon: role.icon,
        run: () => setRole(app.doc, app.tree, role.id, has ? null : node.id),
      };
    });
  },
};

export const specialPlugin: Plugin = {
  id: "special",
  name: "Special pages",
  description: "Pick the page for daily notes, their template, and the page a new window opens on",
  settings: [{ id: "special", order: 32, group: "Writing", title: "Special pages", icon: "star", keywords: ["daily", "journal", "template", "start", "home", "folder"], component: SpecialSection }],
  contextMenu: [useAs],
  rowMarks: ROLES.map((role) => ({ id: `special.${role.id}`, icon: role.icon, label: role.title, when: (node) => node.props[role.id] === true })),
  start(app) {
    // A page in the address, from a link or a reload, comes first.
    if (openedOnPage || startAt.get() !== "page") return;
    const page = holder(app.tree, "startPage");
    if (page && app.activeId !== page.id) app.open(page.id);
  },
};
