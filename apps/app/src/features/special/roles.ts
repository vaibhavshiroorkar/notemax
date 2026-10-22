import type * as Y from "yjs";
import { setProp, type NodeKind, type Tree, type TreeItem } from "@notemax/core";
import { startAt } from "@/platform/mode";
import type { IconName } from "@/ui/Icon";

/**
 * Jobs one page in a workspace can have, like being where daily notes go.
 * Each is a page setting (a prop holding true), so it syncs with the tree and
 * stays with the page through renames and moves. Only one page has each job.
 */
export interface Role {
  id: "dailyFolder" | "dailyTemplate" | "startPage";
  /** In the page menu, "Use as ...". */
  title: string;
  /** In Settings and on the row's mark. */
  label: string;
  description: string;
  icon: IconName;
  kinds: NodeKind[];
}

export const ROLES: Role[] = [
  {
    id: "dailyFolder",
    title: "Place for daily notes",
    label: "Daily notes go in",
    description: "Each day's note is made inside it. A folder, a book (each day a chapter) or a note.",
    icon: "calendar",
    kinds: ["folder", "book", "note"],
  },
  {
    id: "dailyTemplate",
    title: "Template for daily notes",
    label: "Daily note template",
    description: "A new day's note starts as a copy of this note.",
    icon: "page",
    kinds: ["note"],
  },
  {
    id: "startPage",
    title: "Start page",
    label: "Start page",
    description: "A new window opens on this page.",
    icon: "home",
    kinds: ["note", "book", "board", "code"],
  },
];


/** The page doing a job, if any. A page in the trash does not count. */
export function holder(tree: Tree, role: Role["id"]): TreeItem | undefined {
  for (const item of tree.items.values()) if (item.props[role] === true) return item;
  return undefined;
}

/** Gives the job to one page, or to none, taking it from any other. */
export function setRole(doc: Y.Doc, tree: Tree, role: Role["id"], id: string | null) {
  doc.transact(() => {
    for (const node of tree.byId.values()) if (node.props[role] === true && node.id !== id) setProp(doc, node.id, role, null);
    if (id) setProp(doc, id, role, true);
  });
  // Choosing a start page means wanting to start there; taking it away goes back to where you left off.
  if (role === "startPage" && id) startAt.set("page");
  else if (role === "startPage" && startAt.get() === "page") startAt.set("last");
}
