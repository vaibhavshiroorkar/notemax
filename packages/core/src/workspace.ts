import * as Y from "yjs";
import { generateKeyBetween } from "fractional-indexing";

/** Parent id of every book. */
export const ROOT = "root";
/** Parent id of notes not filed in a book yet. */
export const INBOX = "inbox";
/** The note created on first run. It reuses the id of the single note from before the sidebar existed. */
export const WELCOME_ID = "welcome";
/** Doc id of the workspace tree itself. Note docs use random UUIDs, so this cannot clash. */
export const WORKSPACE_DOC_ID = "workspace";

export type NodeKind = "book" | "note";

export interface TreeNode {
  id: string;
  kind: NodeKind;
  parentId: string;
  title: string;
  /** Fractional index: siblings sort by plain string comparison. */
  position: string;
  createdAt: number;
  /** Set when the node is in the trash. Nodes are never erased. */
  deletedAt: number | null;
}

export interface TreeItem extends TreeNode {
  children: TreeItem[];
}

export interface Tree {
  inbox: TreeItem[];
  books: TreeItem[];
  /** Trashed nodes, most recently trashed first. Their children are hidden with them. */
  trash: TreeNode[];
  byId: Map<string, TreeNode>;
  /** Placed items by id, as shown in the inbox or books sections. */
  items: Map<string, TreeItem>;
  /** Ids shown in the inbox or books sections. */
  visible: Set<string>;
}

// Each node is its own Y.Map so that fields merge independently: a rename on one
// device and a move on another both survive, instead of one overwriting the other.
const nodesOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("nodes");

function toNode(id: string, fields: Y.Map<unknown>): TreeNode {
  return {
    id,
    kind: fields.get("kind") as NodeKind,
    parentId: fields.get("parentId") as string,
    title: (fields.get("title") as string | undefined) ?? "",
    position: fields.get("position") as string,
    createdAt: fields.get("createdAt") as number,
    deletedAt: (fields.get("deletedAt") as number | null | undefined) ?? null,
  };
}

// Two devices can pick the same position for different nodes; the id breaks the tie
// so every device shows the same order.
function byPosition(a: TreeNode, b: TreeNode) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function readTree(doc: Y.Doc): Tree {
  const byId = new Map<string, TreeNode>();
  nodesOf(doc).forEach((fields, id) => byId.set(id, toNode(id, fields)));

  const childrenOf = new Map<string, TreeNode[]>();
  for (const node of byId.values()) {
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node);
    childrenOf.set(node.parentId, siblings);
  }

  const visible = new Set<string>();
  const items = new Map<string, TreeItem>();
  const place = (node: TreeNode, parentId = node.parentId): TreeItem => {
    visible.add(node.id);
    const item: TreeItem = { ...node, parentId, children: [] };
    items.set(node.id, item);
    item.children = build(node.id);
    return item;
  };
  const build = (parentId: string): TreeItem[] =>
    (childrenOf.get(parentId) ?? [])
      // `visible` doubles as a cycle guard: a node is placed at most once.
      .filter((node) => node.deletedAt === null && !visible.has(node.id))
      .sort(byPosition)
      .map((node) => place(node));

  const books = build(ROOT);
  const inbox = build(INBOX);

  // Two devices can make a loop by moving A into B and B into A at the same time.
  // Neither is then reachable from the top, so the sidebar would silently lose them.
  // Show such notes in the inbox instead. This is display only, so every device
  // computes the same result; the next real move fixes the stored data.
  const hiddenByTrash = (node: TreeNode) => {
    const seen = new Set<string>();
    for (let cur: TreeNode | undefined = node; cur && !seen.has(cur.id); cur = byId.get(cur.parentId)) {
      if (cur.deletedAt !== null) return true;
      seen.add(cur.id);
    }
    return false;
  };
  const stranded = [...byId.values()]
    .filter((node) => node.deletedAt === null && !visible.has(node.id) && !hiddenByTrash(node))
    .sort(byPosition);
  for (const node of stranded) if (!visible.has(node.id)) inbox.push(place(node, INBOX));

  const trash = [...byId.values()]
    .filter((node) => node.deletedAt !== null)
    .sort((a, b) => b.deletedAt! - a.deletedAt!);
  return { inbox, books, trash, byId, items, visible };
}

/** The placed children of a parent: ROOT, INBOX or a visible node. */
export function childrenOf(tree: Tree, parentId: string): TreeItem[] {
  if (parentId === ROOT) return tree.books;
  if (parentId === INBOX) return tree.inbox;
  return tree.items.get(parentId)?.children ?? [];
}

/** True when `id` is `ancestorId` or sits somewhere inside it. */
export function isInside(tree: Tree, id: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  for (let cur = tree.items.get(id); cur && !seen.has(cur.id); cur = tree.items.get(cur.parentId)) {
    if (cur.id === ancestorId) return true;
    seen.add(cur.id);
  }
  return false;
}

/** Whether `id` may be moved under `parentId`. Returns the reason when it may not. */
export function canMove(tree: Tree, id: string, parentId: string): string | null {
  const node = tree.items.get(id);
  if (!node) return "this note is not in the tree";
  if (node.kind === "book") return parentId === ROOT ? null : "books stay at the top level";
  if (parentId === ROOT) return "notes go in the inbox, a book, or another note";
  if (parentId === INBOX) return null;
  if (!tree.items.has(parentId)) return "the target is not in the tree";
  if (isInside(tree, parentId, id)) return "a note cannot go inside itself";
  return null;
}

/**
 * Moves a node under `parentId` at `index`, counted among that parent's children
 * without the moved node. Only the moved node changes; siblings keep their positions.
 */
export function moveNode(doc: Y.Doc, id: string, parentId: string, index: number) {
  const tree = readTree(doc);
  const reason = canMove(tree, id, parentId);
  if (reason) throw new Error(reason);

  const siblings = childrenOf(tree, parentId).filter((item) => item.id !== id);
  const at = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[at - 1]?.position ?? null;
  const after = siblings[at]?.position ?? null;
  // Two siblings can share a position after concurrent inserts; there is no key
  // strictly between equal keys, so place it right after `before` instead.
  const position = before !== null && after !== null && before >= after
    ? generateKeyBetween(before, null)
    : generateKeyBetween(before, after);

  const fields = fieldsOf(doc, id);
  doc.transact(() => {
    fields.set("parentId", parentId);
    fields.set("position", position);
  });
}

export function createNode(doc: Y.Doc, kind: NodeKind, parentId: string, title = "", id: string = crypto.randomUUID()): string {
  if (kind === "book" && parentId !== ROOT) throw new Error("books can only be created at the top level");
  if (kind === "note" && parentId === ROOT) throw new Error("notes go in the inbox, a book, or another note");

  let last: string | null = null;
  nodesOf(doc).forEach((fields) => {
    const position = fields.get("position") as string;
    if (fields.get("parentId") === parentId && (last === null || position > last)) last = position;
  });

  doc.transact(() => {
    const fields = new Y.Map<unknown>();
    nodesOf(doc).set(id, fields);
    fields.set("kind", kind);
    fields.set("parentId", parentId);
    fields.set("title", title);
    fields.set("position", generateKeyBetween(last, null));
    fields.set("createdAt", Date.now());
    fields.set("deletedAt", null);
  });
  return id;
}

/** Creates the welcome note on a brand-new workspace. Does nothing otherwise. */
export function ensureWelcome(doc: Y.Doc) {
  if (nodesOf(doc).size === 0) createNode(doc, "note", INBOX, "Welcome", WELCOME_ID);
}

function fieldsOf(doc: Y.Doc, id: string) {
  const fields = nodesOf(doc).get(id);
  if (!fields) throw new Error(`no node with id ${id}`);
  return fields;
}

export function renameNode(doc: Y.Doc, id: string, title: string) {
  fieldsOf(doc, id).set("title", title);
}

export function trashNode(doc: Y.Doc, id: string) {
  fieldsOf(doc, id).set("deletedAt", Date.now());
}

/** Takes a node out of the trash. A note whose parent is still trashed goes to the inbox, so it is not hidden. */
export function restoreNode(doc: Y.Doc, id: string) {
  const fields = fieldsOf(doc, id);
  doc.transact(() => {
    fields.set("deletedAt", null);
    const parentId = fields.get("parentId") as string;
    if (parentId === ROOT || parentId === INBOX) return;
    const tree = readTree(doc);
    if (!tree.visible.has(parentId)) {
      fields.set("parentId", INBOX);
      fields.set("position", generateKeyBetween(tree.inbox.at(-1)?.position ?? null, null));
    }
  });
}
