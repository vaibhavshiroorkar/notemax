import type { TreeNode } from "@notemax/core";
import { clearSelection } from "@/features/sidebar/state";
import { syncIsOn } from "@/features/sync/runtime";
import { createStore } from "@/platform/store";
import type { AppContext, ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { TemporaryLine, TemporaryNotice } from "./TemporaryNotice";
import { isTemporary, keep, startMarking, temporaryItems } from "./temporary";
import "./temporary.css";

const pagesOf = (target: ContextTarget): TreeNode[] => (target.type === "page" ? [target.node] : target.type === "pages" ? target.nodes : []);

// Keeping a page that lives only in this browser would hide the risk without
// removing it, so Keep shows up once sync is on.
const keepItem: ContextMenuItem = {
  id: "temporary.keep",
  title: "Keep",
  group: "edit",
  icon: "clock",
  targets: ["page", "pages"],
  when: (target) => syncIsOn() && pagesOf(target).some(isTemporary),
  run(target, app) {
    keep(app.doc, pagesOf(target).filter(isTemporary).map((node) => node.id));
    if (target.type === "pages") clearSelection();
  },
};

/** "Temporary only" in the sidebar's filter panel, to sort them out after signing in. */
const temporaryOnly = createStore(false);

function TemporaryOnlyChoice({ app }: { app: AppContext }) {
  const on = temporaryOnly.use();
  if (!on && !temporaryItems(app.tree).length) return null;
  return (
    <label className="filter-choice">
      <input type="checkbox" checked={on} onChange={() => temporaryOnly.set(!on)} />
      Temporary only
    </label>
  );
}

export const temporaryPlugin: Plugin = {
  id: "temporary",
  // Pages kept only in this browser matter only to someone who means to sign in.
  online: true,
  name: "Temporary pages",
  description: "Marks pages made in a browser before signing in, since only that browser has them",
  required: true,
  rowMarks: [{ id: "temporary.mark", icon: "clock", label: "Temporary", when: isTemporary }],
  sidebarSections: [{ id: "temporary.notice", order: -20, component: TemporaryNotice }],
  pageHeader: [{ id: "temporary.line", component: TemporaryLine }],
  sidebarFilterChoices: [{ id: "temporary.only", component: TemporaryOnlyChoice }],
  useSidebarFilter() {
    const on = temporaryOnly.use();
    if (!on) return null;
    return { label: "temporary", matches: isTemporary, clear: () => temporaryOnly.set(false) };
  },
  contextMenu: [keepItem],
  commands: [
    {
      id: "temporary.keepAll",
      title: "Keep all temporary pages",
      keywords: ["temporary", "browser", "sign in"],
      when: (app) => syncIsOn() && temporaryItems(app.tree).length > 0,
      run: (app) => keep(app.doc, temporaryItems(app.tree).map((item) => item.id)),
    },
  ],
  start(app) {
    startMarking(app.doc, app.tree);
  },
};
