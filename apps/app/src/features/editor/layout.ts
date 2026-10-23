import { setProp, type TreeNode } from "@notemax/core";
import { getOption } from "@/plugins/options";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";

/** The note a page menu or a right click inside a note is about. */
function noteOf(target: ContextTarget, app: AppContext): TreeNode | null {
  const node = target.type === "page" ? target.node : target.type === "editor" ? app.tree.byId.get(target.noteId) : undefined;
  return node?.kind === "note" ? node : null;
}

/** "pages" or "infinite": the note's own choice, or the setting. */
export const layoutOf = (node: TreeNode) =>
  node.props.layout === "pages" || node.props.layout === "infinite" ? node.props.layout : getOption("notes", "pages") ? "pages" : "infinite";

export function toggleLayout(app: AppContext, node: TreeNode) {
  const next = layoutOf(node) === "pages" ? "infinite" : "pages";
  // Back to following the setting when the choice matches it, so changing the setting later still applies.
  const byDefault = getOption("notes", "pages") ? "pages" : "infinite";
  setProp(app.doc, node.id, "layout", next === byDefault ? null : next);
}

const choice = (id: string, title: string, value: "pages" | "infinite" | null): ContextMenuItem => ({
  id: `notes.layout.${id}`,
  title,
  group: "layout",
  targets: ["page", "editor"],
  disabled: (target, app) => {
    const node = noteOf(target, app)!;
    return value === null ? node.props.layout === undefined : node.props.layout === value;
  },
  run: (target, app) => setProp(app.doc, noteOf(target, app)!.id, "layout", value),
});

export const LAYOUT_MENU: ContextMenuItem = {
  id: "notes.layout",
  inside: "options",
  title: "Layout",
  group: "layout",
  icon: "page",
  targets: ["page", "editor"],
  when: (target, app) => !!noteOf(target, app),
  submenu: () => [choice("infinite", "One long page", "infinite"), choice("pages", "Pages, like a printed document", "pages"), choice("default", "Follow the setting", null)],
};
