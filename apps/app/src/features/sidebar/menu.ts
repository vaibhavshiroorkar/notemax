import { ROOT, createNode, holds, setProp, type SortOrder, type TreeNode } from "@notemax/core";
import { openBeside } from "@/app/tabs";
import { OPEN_FILE_ITEMS } from "@/features/open-files/plugin";
import { isDesktop } from "@/platform/platform";
import { registry } from "@/plugins/registry";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";
import { clearSelection, editingId, expand } from "./state";

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

/** In a New flyout, "New note" reads "Note". */
const kindTitle = (label: string) => label.replace(/^New (\w)/, (_, first: string) => first.toUpperCase());

/** New, on empty space: every kind of page, made at the end of the top level and opened. */
function newKinds(): ContextMenuItem[] {
  return registry.kinds().map(({ kind, label, icon }) => ({
    id: `sidebar.new.${kind}`,
    inside: "new" as const,
    title: kindTitle(label),
    icon,
    group: "create",
    targets: ["sidebar" as const],
    run(_target: ContextTarget, app: AppContext) {
      // A folder has no page; it is named in its row instead.
      if (kind === "folder") editingId.set(createNode(app.doc, "folder", ROOT));
      else app.create(kind);
    },
  }));
}

const copy = (app: AppContext, text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => app.notify(`Copied ${what}`),
    () => app.notify("Could not reach the clipboard"),
  );

/** What a right click on a page in a list, or empty space in the sidebar, offers. */
export const SORT_CHOICES: { value: SortOrder | null; title: string }[] = [
  { value: null, title: "The order you drag" },
  { value: "title", title: "Title, A to Z" },
  { value: "title-desc", title: "Title, Z to A" },
  { value: "newest", title: "Newest first" },
  { value: "oldest", title: "Oldest first" },
  { value: "days", title: "Newest day first" },
];

/** How a folder or page orders what is in it, on its menu where it is easy to find. Books keep their reading order. The current choice shows greyed out. */
const SORT_MENU: ContextMenuItem = {
  id: "page.sort",
  title: "Sort by",
  group: "layout",
  icon: "sort",
  targets: ["page"],
  when: (target, app) => {
    const node = nodeOf(target);
    if (!node || node.kind === "book") return false;
    return node.kind === "folder" || (app.tree.items.get(node.id)?.children.length ?? 0) > 0;
  },
  submenu: (target) =>
    SORT_CHOICES.map(({ value, title }) => ({
      id: `page.sort.${value ?? "manual"}`,
      title,
      group: "layout",
      targets: ["page"],
      disabled: () => (nodeOf(target)?.props.sort ?? null) === value,
      run: (_target, app) => setProp(app.doc, nodeOf(target)!.id, "sort", value),
    })),
};

export const PAGE_MENU: ContextMenuItem[] = [
  SORT_MENU,
  ...OPEN_FILE_ITEMS,
  {
    id: "page.open",
    inside: "open-in",
    title: "This tab",
    group: "open",
    targets: ["page"],
    when: (target, app) => isPage(target) && app.activeId !== nodeOf(target)!.id,
    run: (target, app) => app.open(nodeOf(target)!.id),
  },
  {
    id: "page.open-tab",
    inside: "open-in",
    title: "A new tab",
    group: "open",
    targets: ["page"],
    when: isPage,
    run: (target, app) => app.open(nodeOf(target)!.id, { newTab: true }),
  },
  {
    id: "page.open-right",
    inside: "open-in",
    title: "To the right",
    group: "open",
    targets: ["page"],
    when: isPage,
    run: (target) => openBeside(nodeOf(target)!.id, "right"),
  },
  {
    id: "page.open-below",
    inside: "open-in",
    title: "Below",
    group: "open",
    targets: ["page"],
    when: isPage,
    run: (target) => openBeside(nodeOf(target)!.id, "bottom"),
  },
  {
    // Every kind the page can hold. Folders only go in folders: a folder inside a note has nothing to sort.
    id: "page.new",
    title: "New inside",
    group: "create",
    targets: ["page"],
    items(target) {
      const parent = nodeOf(target);
      if (!parent) return [];
      return registry
        .kinds()
        .filter(({ kind }) => holds(parent.kind, kind) && (kind !== "folder" || parent.kind === "folder"))
        .map(({ kind, label, icon }) => ({
          id: `page.new.${kind}`,
          inside: "new-inside" as const,
          title: kindTitle(label),
          icon,
          group: "create",
          targets: ["page" as const],
          run(_target: ContextTarget, app: AppContext) {
            expand(parent.id);
            const id = createNode(app.doc, kind, parent.id);
            // A folder has no page; it is named in its row instead.
            if (kind === "folder") editingId.set(id);
            else app.open(id);
          },
        }));
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
      // In the sidebar when the page has a row there, else in the page's own title, like a chapter.
      if (node.kind === "folder" || document.querySelector(`.sidebar .row[data-id="${CSS.escape(node.id)}"]`)) editingId.set(node.id);
      else renamePage(app, node.id);
    },
  },
  {
    id: "page.copy-title",
    inside: "copy",
    title: "Copy title",
    group: "edit",
    icon: "copy",
    targets: ["page"],
    run: (target, app) => void copy(app, nodeOf(target)!.title || "Untitled", "the title"),
  },
  {
    // A link that opens the page in this browser. The desktop app has no address to share.
    id: "page.copy-link",
    inside: "copy",
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
    id: "pages.trash",
    title: "Move to trash",
    group: "danger",
    targets: ["pages"],
    // Made when the menu opens, so the title can say how many.
    items: (target) =>
      target.type !== "pages"
        ? []
        : [
            {
              id: "pages.trash.all",
              title: `Move ${target.nodes.length} pages to trash`,
              group: "danger",
              icon: "trash",
              danger: true,
              targets: ["pages"],
              run(_target: ContextTarget, app: AppContext) {
                app.trash(target.nodes.map((node) => node.id));
                clearSelection();
              },
            },
          ],
  },
  {
    id: "sidebar.new",
    title: "New",
    group: "create",
    targets: ["sidebar"],
    items: newKinds,
  },
];
