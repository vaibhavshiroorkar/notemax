import { ROOT, createNode, isContainer, type TreeNode } from "@notemax/core";
import { isDesktop } from "@/platform/platform";
import { registry } from "@/plugins/registry";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";
import { editingId, expand } from "./state";

const nodeOf = (target: ContextTarget): TreeNode | null => (target.type === "page" ? target.node : null);
const isPage = (target: ContextTarget) => !!nodeOf(target) && nodeOf(target)!.kind !== "folder";

/** Focuses the open page's title with the text selected, once the page has drawn. */
function renamePage(app: AppContext, id: string) {
  app.open(id);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const title = document.querySelector<HTMLInputElement>(".note-title, .board-title");
      title?.focus();
      title?.select();
    }),
  );
}

const copy = (app: AppContext, text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => app.notify(`Copied ${what}`),
    () => app.notify("Could not reach the clipboard"),
  );

/** What a right click on a page in a list, or empty space in the sidebar, offers. */
export const PAGE_MENU: ContextMenuItem[] = [
  {
    id: "page.open",
    title: "Open",
    group: "open",
    targets: ["page"],
    when: (target, app) => isPage(target) && app.activeId !== nodeOf(target)!.id,
    run: (target, app) => app.open(nodeOf(target)!.id),
  },
  {
    id: "page.new-note",
    title: "New note inside",
    group: "create",
    icon: "note",
    targets: ["page"],
    when: (target) => !!nodeOf(target) && isContainer(nodeOf(target)!.kind),
    run(target, app) {
      const parent = nodeOf(target)!;
      expand(parent.id);
      app.open(createNode(app.doc, "note", parent.id));
    },
  },
  {
    id: "page.new-folder",
    title: "New folder inside",
    group: "create",
    icon: "folder",
    targets: ["page"],
    when: (target) => nodeOf(target)?.kind === "folder",
    run(target, app) {
      const parent = nodeOf(target)!;
      expand(parent.id);
      editingId.set(createNode(app.doc, "folder", parent.id));
    },
  },
  {
    id: "page.rename",
    title: "Rename",
    group: "edit",
    icon: "pencil",
    keys: "F2",
    targets: ["page"],
    run(target, app) {
      const node = nodeOf(target)!;
      if (node.kind === "folder") editingId.set(node.id);
      else renamePage(app, node.id);
    },
  },
  {
    id: "page.copy-title",
    title: "Copy title",
    group: "edit",
    icon: "copy",
    targets: ["page"],
    run: (target, app) => void copy(app, nodeOf(target)!.title || "Untitled", "the title"),
  },
  {
    // A link that opens the page in this browser. The desktop app has no address to share.
    id: "page.copy-link",
    title: "Copy link",
    group: "edit",
    icon: "link",
    targets: ["page"],
    when: (target) => isPage(target) && !isDesktop,
    run: (target, app) => void copy(app, `${location.origin}${location.pathname}#${encodeURIComponent(nodeOf(target)!.id)}`, "the link"),
  },
  {
    id: "page.trash",
    title: "Move to trash",
    group: "danger",
    icon: "trash",
    danger: true,
    targets: ["page"],
    run: (target, app) => app.trash(nodeOf(target)!.id),
  },
  {
    id: "sidebar.new",
    title: "New",
    group: "create",
    targets: ["sidebar"],
    items: () =>
      registry.kinds().map(({ kind, label, icon }) => ({
        id: `sidebar.new.${kind}`,
        title: label,
        icon,
        group: "create",
        targets: ["sidebar"],
        run(_target: ContextTarget, app: AppContext) {
          // A folder has no page; it is named in its row instead.
          if (kind === "folder") editingId.set(createNode(app.doc, "folder", ROOT));
          else app.create(kind);
        },
      })),
  },
];
