import { isInside, trashNode, type TreeNode } from "@notemax/core";
import type { AppContext, ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { HomeView, QuickStart, RecentSection, RecentView, WorkspacesSection } from "./HomeView";
import { nameOf, switchTo, workspaceList } from "./list";
import { Switcher } from "./Switcher";
import { copyToWorkspace } from "./transfer";
import "./workspaces.css";

/** The pages a menu acts on. A page picked along with a folder it sits in goes with that folder. */
function pagesOf(target: ContextTarget, app: AppContext): TreeNode[] {
  const nodes = target.type === "page" ? [target.node] : target.type === "pages" ? target.nodes : [];
  return nodes.filter((node) => !nodes.some((other) => other.id !== node.id && isInside(app.tree, node.id, other.id)));
}

async function send(target: ContextTarget, app: AppContext, workspace: string, move: boolean) {
  const pages = pagesOf(target, app);
  const where = nameOf(workspaceList.get().find((w) => w.id === workspace)!);
  try {
    for (const page of pages) await copyToWorkspace(app.doc, page.id, workspace, app.workspace);
  } catch (error) {
    app.notify(`Could not ${move ? "move" : "copy"} to ${where}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  // Moving trashes the original only once the copy is safely stored.
  if (move) app.doc.transact(() => pages.forEach((page) => trashNode(app.doc, page.id)));
  const what = pages.length === 1 ? `"${pages[0].title || "Untitled"}"` : `${pages.length} pages`;
  app.notify(`${move ? "Moved" : "Copied"} ${what} to ${where}${move ? ". The original is in the trash here" : ""}.`, { label: `Go to ${where}`, run: () => switchTo(workspace) });
}

const sendItem = (move: boolean): ContextMenuItem => ({
  id: move ? "workspaces.move" : "workspaces.copy",
  title: move ? "Move to workspace" : "Copy to workspace",
  group: "duplicate",
  targets: ["page", "pages"],
  when: () => workspaceList.get().length > 1,
  submenu: (_target, app) =>
    workspaceList
      .get()
      .filter((w) => w.id !== app.workspace)
      .map((w) => ({
        id: `workspaces.${move ? "move" : "copy"}.${w.id}`,
        title: nameOf(w),
        group: "workspaces",
        targets: ["page", "pages"],
        run: (target, app) => void send(target, app, w.id, move),
      })),
});

export const workspacesPlugin: Plugin = {
  id: "workspaces",
  name: "Workspaces",
  description: "Separate sets of pages, like Work and Personal, switched from the top left, with a Home page to arrange them",
  required: true,
  // Above everything else in the left sidebar.
  sidebarSections: [{ id: "workspaces.switch", order: -30, component: Switcher }],
  views: [
    { id: "home", title: "Home", icon: "home", component: HomeView },
    { id: "recent", title: "Recent pages", icon: "clock", component: RecentView },
  ],
  homeSections: [
    { id: "home.quick", title: "Quick start", order: 10, component: QuickStart },
    { id: "home.recent", title: "Recent pages", order: 20, open: (app) => app.openView("recent"), component: RecentSection },
    { id: "home.workspaces", title: "Workspaces", order: 60, wide: true, component: WorkspacesSection },
  ],
  contextMenu: [sendItem(false), sendItem(true)],
  commands: [{ id: "workspaces.home", title: "Go Home: all workspaces", keywords: ["workspace", "switch", "home", "profile"], shortcut: "Mod+Alt+H", run: (app) => app.openView("home") }],
};
