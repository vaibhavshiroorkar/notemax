import * as Y from "yjs";
import { generateKeyBetween } from "fractional-indexing";
import { normalizeTag } from "./tags";

/** Parent id of everything at the top level of the sidebar. */
export const ROOT = "root";
/** The note created on first run. It reuses the id of the single note from before the sidebar existed. */
export const WELCOME_ID = "welcome";
/** Doc id of the workspace tree itself. Note docs use random UUIDs, so this cannot clash. */
export const WORKSPACE_DOC_ID = "workspace";

// Older workspaces kept loose notes under an "inbox" parent. They are read as
// top-level notes. The stored value changes only when a note is next moved, so
// old data is never rewritten in bulk.
const OLD_INBOX = "inbox";

/**
 * A folder sorts things and holds anything but itself. A book is something
 * being written: it holds only notes, its chapters, in reading order.
 */
export type NodeKind = "folder" | "book" | "note";

/** Whether a `parent` may hold a `child`. ROOT holds everything. */
export function holds(parent: NodeKind, child: NodeKind): boolean {
  return parent === "folder" || (parent === "book" && child === "note");
}

export interface TreeNode {
  id: string;
  kind: NodeKind;
  /** ROOT, a folder or a book. Notes from before folders may still point at a note. */
  parentId: string;
  title: string;
  /** Fractional index: siblings sort by plain string comparison. */
  position: string;
  createdAt: number;
  /** Set when the node is in the trash. It stays there until deleted forever. */
  deletedAt: number | null;
  /**
   * Ids this node's body links to, sorted. Copied from the body by setLinks, so
   * backlinks never need every note body loaded.
   */
  links: string[];
  /** Words in the body, or null until the note is next opened. Kept here for the same reason as links. */
  words: number | null;
  /** Sorted. Each one is its own `tag:` field, so tags added on two devices at once both survive. */
  tags: string[];
}

export interface TagCount {
  tag: string;
  /** Visible items with this tag. */
  count: number;
}

export interface TreeItem extends TreeNode {
  /** Placed items only. For an item, parentId is where it is shown: ROOT, a folder or a book. */
  children: TreeItem[];
}

export interface Tree {
  /** Notes, folders and books at the top level, in one list. */
  top: TreeItem[];
  /** Trashed nodes, most recently trashed first. Their children are hidden with them. */
  trash: TreeNode[];
  byId: Map<string, TreeNode>;
  /** Placed items by id. */
  items: Map<string, TreeItem>;
  /** Ids shown in the sidebar. */
  visible: Set<string>;
  /** For each target id, the visible nodes that link to it, sorted by title. */
  backlinks: Map<string, TreeNode[]>;
  /** Every tag on a visible item, most used first. */
  tags: TagCount[];
}

// Each node is its own Y.Map so that fields merge independently: a rename on one
// device and a move on another both survive, instead of one overwriting the other.
const nodesOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("nodes");

const TAG_PREFIX = "tag:";

const kindOf = (fields: Y.Map<unknown>) => fields.get("kind") as NodeKind;
const parentOf = (fields: Y.Map<unknown>): string => {
  const parentId = fields.get("parentId") as string;
  return parentId === OLD_INBOX ? ROOT : parentId;
};

function toNode(id: string, fields: Y.Map<unknown>): TreeNode {
  const tags: string[] = [];
  for (const key of fields.keys()) if (key.startsWith(TAG_PREFIX)) tags.push(key.slice(TAG_PREFIX.length));
  return {
    id,
    kind: kindOf(fields),
    parentId: parentOf(fields),
    title: (fields.get("title") as string | undefined) ?? "",
    position: fields.get("position") as string,
    createdAt: fields.get("createdAt") as number,
    deletedAt: (fields.get("deletedAt") as number | null | undefined) ?? null,
    links: (fields.get("links") as string[] | undefined) ?? [],
    words: (fields.get("words") as number | undefined) ?? null,
    tags: tags.sort(),
  };
}

// Two devices can pick the same position for different nodes; the id breaks the tie
// so every device shows the same order.
function byPosition(a: TreeNode, b: TreeNode) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const sameList = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function sameNode(a: TreeNode, b: TreeNode): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.parentId === b.parentId &&
    a.title === b.title &&
    a.position === b.position &&
    a.createdAt === b.createdAt &&
    a.deletedAt === b.deletedAt &&
    a.words === b.words &&
    sameList(a.links, b.links) &&
    sameList(a.tags, b.tags)
  );
}

/**
 * Pass the tree from the last call as `previous`, and every node, item and
 * child list that did not change is the same object as before. React can then
 * skip redrawing the parts of the sidebar that a change did not touch: typing
 * in one note changes that note's item, its parents and nothing else.
 */
export function readTree(doc: Y.Doc, previous?: Tree): Tree {
  const byId = new Map<string, TreeNode>();
  nodesOf(doc).forEach((fields, id) => {
    const node = toNode(id, fields);
    const old = previous?.byId.get(id);
    byId.set(id, old && sameNode(old, node) ? old : node);
  });

  // A node whose parent may not hold it is shown in the nearest container
  // above that may, or at the top. That covers a note under a note (allowed
  // before folders existed) and a folder put in a book while books were read
  // as folders. Undefined means the chain is broken or loops, handled further down.
  const shownIn = (node: TreeNode): string | undefined => {
    const seen = new Set<string>();
    for (let parentId = node.parentId; parentId !== ROOT; ) {
      const parent = byId.get(parentId);
      if (!parent || seen.has(parentId)) return undefined;
      if (holds(parent.kind, node.kind)) return parentId;
      seen.add(parentId);
      parentId = parent.parentId;
    }
    return ROOT;
  };
  // Uses the stored chain, so a note stays hidden while any note or folder above it is trashed.
  const hiddenByTrash = (node: TreeNode) => {
    const seen = new Set<string>();
    for (let cur: TreeNode | undefined = node; cur && !seen.has(cur.id); cur = byId.get(cur.parentId)) {
      if (cur.deletedAt !== null) return true;
      seen.add(cur.id);
    }
    return false;
  };

  const childrenOf = new Map<string, TreeNode[]>();
  for (const node of byId.values()) {
    const container = shownIn(node);
    if (container === undefined) continue;
    const siblings = childrenOf.get(container) ?? [];
    siblings.push(node);
    childrenOf.set(container, siblings);
  }

  const visible = new Set<string>();
  const items = new Map<string, TreeItem>();
  const place = (node: TreeNode, parentId: string): TreeItem => {
    visible.add(node.id);
    const children = build(node.id);
    const old = previous?.items.get(node.id);
    // An item is reused only when it and everything below it are unchanged.
    const item: TreeItem =
      old && old.parentId === parentId && sameNode({ ...old, parentId: node.parentId }, node) && sameList(old.children, children)
        ? old
        : { ...node, parentId, children };
    items.set(node.id, item);
    return item;
  };
  const build = (parentId: string): TreeItem[] =>
    (childrenOf.get(parentId) ?? [])
      // `visible` doubles as a cycle guard: a node is placed at most once.
      .filter((node) => !visible.has(node.id) && !hiddenByTrash(node))
      .sort(byPosition)
      .map((node) => place(node, parentId));

  const built = build(ROOT);

  // Two devices can make a loop by moving folder A into B and B into A at the
  // same time. Neither is then reachable from the top, so the sidebar would
  // silently lose them. Show them at the top instead. This is display only, so
  // every device computes the same result; the next real move fixes the data.
  const stranded = [...byId.values()].filter((node) => !visible.has(node.id) && !hiddenByTrash(node)).sort(byPosition);
  for (const node of stranded) if (!visible.has(node.id)) built.push(place(node, ROOT));
  const top = previous && sameList(previous.top, built) ? previous.top : built;

  const trash = [...byId.values()].filter((node) => node.deletedAt !== null).sort((a, b) => b.deletedAt! - a.deletedAt!);

  // Notes in the trash do not count: their links come back if they are restored.
  const backlinks = new Map<string, TreeNode[]>();
  for (const id of visible) {
    const source = byId.get(id)!;
    for (const target of source.links) {
      const sources = backlinks.get(target) ?? [];
      sources.push(source);
      backlinks.set(target, sources);
    }
  }
  for (const sources of backlinks.values()) sources.sort((a, b) => a.title.localeCompare(b.title));

  const tagCounts = new Map<string, number>();
  for (const id of visible) for (const tag of byId.get(id)!.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const tags = [...tagCounts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return { top, trash, byId, items, visible, backlinks, tags };
}

/** The placed children of ROOT or of a visible folder or book. */
export function childrenOf(tree: Tree, parentId: string): TreeItem[] {
  if (parentId === ROOT) return tree.top;
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
  if (!tree.items.has(id)) return "this note is not in the tree";
  if (parentId === ROOT) return null;
  const target = tree.items.get(parentId);
  if (!target) return "the target is not in the tree";
  if (target.kind === "note") return "only folders and books can hold notes";
  if (!holds(target.kind, tree.items.get(id)!.kind)) return "a book holds only notes";
  if (isInside(tree, parentId, id)) return "a folder cannot go inside itself";
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

/** Adds a node at the end of ROOT or of a folder or book that may hold it. */
export function createNode(doc: Y.Doc, kind: NodeKind, parentId: string, title = "", id: string = crypto.randomUUID()): string {
  if (kind !== "note" && kind !== "folder" && kind !== "book") throw new Error(`unknown kind ${kind}`);
  if (parentId !== ROOT) {
    const parent = nodesOf(doc).get(parentId);
    if (!parent) throw new Error(`no folder or book with id ${parentId}`);
    if (!holds(kindOf(parent), kind)) throw new Error(`a ${kindOf(parent)} cannot hold a ${kind}`);
  }

  let last: string | null = null;
  nodesOf(doc).forEach((fields) => {
    const position = fields.get("position") as string;
    if (parentOf(fields) === parentId && (last === null || position > last)) last = position;
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

/**
 * Copies a note into the place right after it, with " copy" on its title and
 * the same tags, links and word count. Returns the new id. The body is stored
 * apart from the tree, so the caller copies it.
 */
export function duplicateNote(doc: Y.Doc, id: string, copyId: string = crypto.randomUUID()): string {
  const source = fieldsOf(doc, id);
  if (kindOf(source) !== "note") throw new Error("only notes can be duplicated");
  const tree = readTree(doc);
  const item = tree.items.get(id);
  const parentId = item?.parentId ?? ROOT;
  const title = (source.get("title") as string | undefined) ?? "";
  doc.transact(() => {
    createNode(doc, "note", parentId, title ? `${title} copy` : "", copyId);
    const copy = fieldsOf(doc, copyId);
    for (const [key, value] of source.entries()) {
      if (key === "links" || key === "words" || key.startsWith(TAG_PREFIX)) copy.set(key, Array.isArray(value) ? [...value] : value);
    }
    if (item) moveNode(doc, copyId, parentId, childrenOf(tree, parentId).indexOf(item) + 1);
  });
  return copyId;
}

/** Creates the welcome note on a brand-new workspace. Does nothing otherwise. */
export function ensureWelcome(doc: Y.Doc) {
  if (nodesOf(doc).size === 0) createNode(doc, "note", ROOT, "Welcome", WELCOME_ID);
}

function fieldsOf(doc: Y.Doc, id: string) {
  const fields = nodesOf(doc).get(id);
  if (!fields) throw new Error(`no node with id ${id}`);
  return fields;
}

export function renameNode(doc: Y.Doc, id: string, title: string) {
  fieldsOf(doc, id).set("title", title);
}

/**
 * Records which nodes `id` links to. Writes only when the list changed, so
 * calling it on every edit of the body costs nothing extra in storage.
 */
export function setLinks(doc: Y.Doc, id: string, targets: Iterable<string>) {
  const fields = fieldsOf(doc, id);
  const next = [...new Set(targets)].filter((target) => target !== id).sort();
  const current = (fields.get("links") as string[] | undefined) ?? [];
  if (next.length === current.length && next.every((target, i) => target === current[i])) return;
  fields.set("links", next);
}

/** Records the body's word count. Writes only when it changed, like setLinks. */
export function setWords(doc: Y.Doc, id: string, words: number) {
  const fields = fieldsOf(doc, id);
  if (fields.get("words") !== words) fields.set("words", words);
}

/** Tags a node. Returns the tag as stored, or null when `raw` had nothing usable in it. */
export function addTag(doc: Y.Doc, id: string, raw: string): string | null {
  const tag = normalizeTag(raw);
  if (!tag) return null;
  const fields = fieldsOf(doc, id);
  if (!fields.has(TAG_PREFIX + tag)) fields.set(TAG_PREFIX + tag, true);
  return tag;
}

export function removeTag(doc: Y.Doc, id: string, tag: string) {
  fieldsOf(doc, id).delete(TAG_PREFIX + tag);
}

export function trashNode(doc: Y.Doc, id: string) {
  fieldsOf(doc, id).set("deletedAt", Date.now());
}

/**
 * Ids of every node inside `id`, at any depth, trashed or not. Cycles left by
 * two devices moving folders at once are cut off rather than looped over.
 */
export function descendantsOf(doc: Y.Doc, id: string): string[] {
  const children = new Map<string, string[]>();
  nodesOf(doc).forEach((fields, childId) => {
    const parentId = fields.get("parentId") as string;
    children.set(parentId, [...(children.get(parentId) ?? []), childId]);
  });
  const found = new Set<string>();
  const walk = (parentId: string) => {
    for (const child of children.get(parentId) ?? []) {
      if (child === id || found.has(child)) continue;
      found.add(child);
      walk(child);
    }
  };
  walk(id);
  return [...found];
}

/**
 * Erases a trashed node and everything inside it from the tree. Returns the
 * erased ids, whose bodies the caller then removes from storage. Only trashed
 * nodes qualify, so nothing can be erased without passing through the Trash.
 */
export function deleteForever(doc: Y.Doc, id: string): string[] {
  if (fieldsOf(doc, id).get("deletedAt") == null) throw new Error("only notes in the trash can be deleted forever");
  const ids = [id, ...descendantsOf(doc, id)];
  doc.transact(() => ids.forEach((nodeId) => nodesOf(doc).delete(nodeId)));
  return ids;
}

/** Takes a node out of the trash. One whose folder or book is still trashed goes to the top level, so it is not hidden. */
export function restoreNode(doc: Y.Doc, id: string) {
  const fields = fieldsOf(doc, id);
  doc.transact(() => {
    fields.set("deletedAt", null);
    const tree = readTree(doc);
    if (tree.visible.has(id)) return;
    fields.set("parentId", ROOT);
    fields.set("position", generateKeyBetween(tree.top.at(-1)?.position ?? null, null));
  });
}
