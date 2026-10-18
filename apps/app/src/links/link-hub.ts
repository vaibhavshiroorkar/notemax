import type * as Y from "yjs";
import { ROOT, createNode, searchNodes, type Tree, type TreeNode } from "@notemax/core";

export type LinkMenuItem =
  | { kind: "existing"; node: TreeNode; where: string }
  | { kind: "create"; title: string };

/**
 * What links inside the editor need from the rest of the app: current titles,
 * search, creating a note, and opening one. The editor is built once per note,
 * so it holds this stable object instead of props that change on every edit.
 */
export class LinkHub {
  private tree?: Tree;
  private doc?: Y.Doc;
  private listeners = new Set<() => void>();

  constructor(private readonly openNote: (id: string) => void) {}

  update(doc: Y.Doc, tree: Tree) {
    this.doc = doc;
    this.tree = tree;
    this.listeners.forEach((listener) => listener());
  }

  /** Called whenever any title or the tree changes. Returns an unsubscribe function. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** The node, or undefined when it does not exist. Check `isOpenable` for trashed ones. */
  lookup(id: string): TreeNode | undefined {
    return this.tree?.byId.get(id);
  }

  isOpenable(id: string) {
    return this.tree?.visible.has(id) ?? false;
  }

  open(id: string) {
    if (this.isOpenable(id)) this.openNote(id);
  }

  /** The folder a note is in, or "" at the top level. Tells apart two notes with one title. */
  where(id: string): string {
    const parentId = this.tree?.items.get(id)?.parentId;
    if (!parentId || parentId === ROOT) return "";
    return this.tree?.items.get(parentId)?.title || "Untitled folder";
  }

  menuItems(query: string, currentId: string): LinkMenuItem[] {
    if (!this.tree) return [];
    const found = searchNodes(this.tree, query, { exclude: currentId });
    const items: LinkMenuItem[] = found.map((node) => ({ kind: "existing", node, where: this.where(node.id) }));
    const title = query.trim();
    const exact = found.some((node) => node.title.toLowerCase() === title.toLowerCase());
    if (title && !exact) items.push({ kind: "create", title });
    return items;
  }

  /** New notes from a link go to the top level, like every other quick note. */
  create(title: string): string {
    if (!this.doc) throw new Error("workspace is not open");
    return createNode(this.doc, "note", ROOT, title);
  }
}
