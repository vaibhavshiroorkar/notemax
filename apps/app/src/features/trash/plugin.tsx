import { restoreNode, type TreeNode } from "@notemax/core";
import type { AppContext, Plugin } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { eraseOld } from "./erase";
import { TrashView } from "./TrashView";
import "./trash.css";

/** Under the title of a page opened from the trash, so nobody writes in it by mistake. */
function TrashedLine({ node, app }: { node: TreeNode; app: AppContext }) {
  if (app.tree.visible.has(node.id)) return null;
  const own = node.deletedAt !== null;
  return (
    <p className="trashed-line">
      <Icon name="trash" />
      <span>{own ? "This page is in the trash." : "This page is in the trash with the page or folder it is in."}</span>
      <button className="link-button" onClick={() => restoreNode(app.doc, node.id)}>
        Restore
      </button>
      <button className="link-button" onClick={() => app.openView("trash")}>
        Open the trash
      </button>
    </p>
  );
}

export const trashPlugin: Plugin = {
  id: "trash",
  name: "Trash",
  description: "The trash as a page: search, restore or erase several at once, and erase old pages by themselves",
  required: true,
  views: [{ id: "trash", title: "Trash", icon: "trash", component: TrashView }],
  pageHeader: [{ id: "trash.line", component: TrashedLine }],
  commands: [{ id: "trash.open", title: "Open the trash", keywords: ["deleted", "restore", "bin", "recycle"], run: (app) => app.openView("trash") }],
  start(app) {
    eraseOld(app.doc, app.tree.trash);
  },
};
