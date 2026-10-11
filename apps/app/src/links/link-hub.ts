import type * as Y from "yjs";
import { INBOX, createNode, searchNodes, type Tree, type TreeNode } from "@notemax/core";

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

  /** Where a node sits: its book's title, or "Inbox". Tells apart two notes with one title. */
  where(id: string): string {
    const tree = this.tree;
    if (!tree) return "";
    const seen = new Set<string>();
    let top = tree.items.get(id);
    while (top && top.kind !== "book" && top.parentId !== INBOX && !seen.has(top.id)) {
      seen.add(top.id);
      top = tree.items.get(top.parentId);
    }
    if (!top) return "";
    if (top.kind === "book") return top.id === id ? "Book" : top.title || "Untitled book";
    return "Inbox";
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

  /** New notes from a link go to the Inbox, like every other quick note. */
  create(title: string): string {
    if (!this.doc) throw new Error("workspace is not open");
    return createNode(this.doc, "note", INBOX, title);
  }
}
