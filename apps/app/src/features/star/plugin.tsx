import type { TreeNode } from "@notemax/core";
import { clearSelection } from "@/features/sidebar/state";
import type { AppContext, ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { StarredSection } from "./StarredSection";
import { isStarred, setStarred } from "./star";
import "./star.css";

/** The star at the top right of a page. Filled when the page is starred. */
function StarButton({ node, app }: { node: TreeNode; app: AppContext }) {
  const on = isStarred(node);
  return (
    <button
      className="icon-button star-button"
      data-on={on || undefined}
      aria-pressed={on}
      aria-label={on ? "Unstar this page" : "Star this page"}
      title={on ? "Unstar" : "Star"}
      onClick={() => setStarred(app.doc, [node.id], !on)}
    >
      <Icon name="star" />
    </button>
  );
}

const pagesOf = (target: ContextTarget): TreeNode[] => (target.type === "page" ? [target.node] : target.type === "pages" ? target.nodes : []);

const menuItem = (on: boolean): ContextMenuItem => ({
  id: on ? "star.add" : "star.remove",
  title: on ? "Star" : "Unstar",
  group: "edit",
  icon: "star",
  targets: ["page", "pages"],
  // Several picked pages: Star while any of them is not starred, Unstar while any is.
  when: (target) => pagesOf(target).some((node) => isStarred(node) !== on),
  run(target, app) {
    setStarred(app.doc, pagesOf(target).filter((node) => isStarred(node) !== on).map((node) => node.id), on);
    if (target.type === "pages") clearSelection();
  },
});

const activeNode = (app: AppContext) => (app.activeId ? app.tree.byId.get(app.activeId) : undefined);

export const starPlugin: Plugin = {
  id: "star",
  name: "Starred",
  description: "Star pages to keep them at the top of the sidebar",
  sidebarSections: [{ id: "star.section", order: -10, component: StarredSection }],
  pageCorner: [{ id: "star.button", component: StarButton }],
  contextMenu: [menuItem(true), menuItem(false)],
  commands: [
    {
      id: "star.toggle",
      title: "Star or unstar this page",
      keywords: ["favorite", "favourite", "pin", "bookmark"],
      when: (app) => !!activeNode(app),
      run(app) {
        const node = activeNode(app)!;
        setStarred(app.doc, [node.id], !isStarred(node));
      },
    },
  ],
};
