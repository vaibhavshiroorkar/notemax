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
 * A folder sorts things and has no body. Notes, boards (drawings), code and
 * browser pages are pages: each has a body of its own, kept in its own document under the
 * node's id, and can hold sub-pages, as in a wiki. A book is something being
 * written: it holds its chapters in reading order, which may be notes or boards.
 * A chapter holds its subtopics. Nothing inside a book is a book or a folder,
 * so a book reads as one list of chapters with no parts.
 *
 * A kind read from storage may be one this version no longer has, like the
 * mind maps that were removed. It is read as a page that holds nothing, so old
 * data is never lost or rewritten.
 */
export type NodeKind = "folder" | "book" | "note" | "board" | "code" | "browser";

export const KINDS: readonly NodeKind[] = ["folder", "book", "note", "board", "code", "browser"];

/** Kinds that hold other items rather than a body of their own. */
export const isContainer = (kind: NodeKind) => kind === "folder" || kind === "book";

/**
 * Whether a `parent` may hold a `child`. ROOT holds everything. A book holds
 * no folders, since it is read from start to end, and no books. A kind this
 * version does not know holds nothing. A book or folder deeper inside a book,
 * in a chapter, is refused by canMove and createNode, which see the whole chain.
 */
export function holds(parent: NodeKind, child: NodeKind): boolean {
  if (!KINDS.includes(parent)) return false;
  return parent !== "book" || (child !== "folder" && child !== "book");
}

export interface TreeNode {
  id: string;
  kind: NodeKind;
  /** ROOT or the node that holds it. */
  parentId: string;
  title: string;
  /** Fractional index: siblings sort by plain string comparison. */
  position: string;
  createdAt: number;
  /** When its title or body last changed, to the minute. The created time until then. */
  editedAt: number;
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
  /**
   * Small settings of one page, like its layout or a chapter's status. Each is
   * its own `prop:` field, so changes to different ones on two devices merge.
   */
  props: Readonly<Record<string, PropValue>>;
}

export type PropValue = string | number | boolean;

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

/**
 * The origin of changes that Undo skips: indexes the app keeps current, like
 * word counts, links and edited times, and erasing forever, which cannot come
 * back. Nobody chose to make the first kind, so undoing them would surprise.
 */
export const UNTRACKED = "notemax:untracked";

const TAG_PREFIX = "tag:";
const PROP_PREFIX = "prop:";
const NO_PROPS: Readonly<Record<string, PropValue>> = Object.freeze({});

const kindOf = (fields: Y.Map<unknown>) => fields.get("kind") as NodeKind;
const parentOf = (fields: Y.Map<unknown>): string => {
  const parentId = fields.get("parentId") as string;
  return parentId === OLD_INBOX ? ROOT : parentId;
};

function toNode(id: string, fields: Y.Map<unknown>): TreeNode {
  const tags: string[] = [];
  let props: Record<string, PropValue> | null = null;
  for (const key of fields.keys()) {
    if (key.startsWith(TAG_PREFIX)) tags.push(key.slice(TAG_PREFIX.length));
    else if (key.startsWith(PROP_PREFIX)) (props ??= {})[key.slice(PROP_PREFIX.length)] = fields.get(key) as PropValue;
  }
  return {
    id,
    kind: kindOf(fields),
    parentId: parentOf(fields),
    title: (fields.get("title") as string | undefined) ?? "",
    position: fields.get("position") as string,
    createdAt: fields.get("createdAt") as number,
    editedAt: (fields.get("editedAt") as number | undefined) ?? (fields.get("createdAt") as number),
    deletedAt: (fields.get("deletedAt") as number | null | undefined) ?? null,
    links: (fields.get("links") as string[] | undefined) ?? [],
    words: (fields.get("words") as number | undefined) ?? null,
    tags: tags.sort(),
    props: props ?? NO_PROPS,
  };
}

// Two devices can pick the same position for different nodes; the id breaks the tie
// so every device shows the same order.
function byPosition(a: TreeNode, b: TreeNode) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * How a page or folder may order what is in it, set as its "sort" prop. With
 * none, the order is the one people dragged. Books always keep theirs: it is
 * the reading order. "days" is a journal's: the newest day first, by a page's
 * "daily" or "date" setting, then pages with no day, newest first.
 */
export const SORTS = ["title", "title-desc", "newest", "oldest", "days"] as const;
export type SortOrder = (typeof SORTS)[number];

// Numbers inside titles count as numbers, so "Day 2" comes before "Day 10" and dates sort as dates.
const titles = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** The order a node gives its children, or byPosition when it sets none. */
export function sorterFor(parent: TreeNode | undefined): (a: TreeNode, b: TreeNode) => number {
  if (!parent || parent.kind === "book") return byPosition;
  switch (parent.props.sort) {
    case "title":
      return (a, b) => titles.compare(a.title, b.title) || byPosition(a, b);
    case "title-desc":
      return (a, b) => titles.compare(b.title, a.title) || byPosition(a, b);
    case "newest":
      return (a, b) => b.createdAt - a.createdAt || byPosition(a, b);
    case "oldest":
      return (a, b) => a.createdAt - b.createdAt || byPosition(a, b);
    case "days":
      return (a, b) => {
        const x = dayOf(a);
        const y = dayOf(b);
        if (x !== y) return x === null ? 1 : y === null ? -1 : x < y ? 1 : -1;
        return b.createdAt - a.createdAt || byPosition(a, b);
      };
    default:
      return byPosition;
  }
}

const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const dayOf = (node: TreeNode) => (isDay(node.props.daily) ? node.props.daily : isDay(node.props.date) ? node.props.date : null);

const sameList = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function sameProps(a: Readonly<Record<string, PropValue>>, b: Readonly<Record<string, PropValue>>) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameNode(a: TreeNode, b: TreeNode): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.parentId === b.parentId &&
    a.title === b.title &&
    a.position === b.position &&
    a.createdAt === b.createdAt &&
    a.editedAt === b.editedAt &&
    a.deletedAt === b.deletedAt &&
    a.words === b.words &&
    sameList(a.links, b.links) &&
    sameList(a.tags, b.tags) &&
    sameProps(a.props, b.props)
  );
}

/**
 * Pass the tree from the last call as `previous`, and every node, item and
 * child list that did not change is the same object as before. React can then
 * skip redrawing the parts of the sidebar that a change did not touch: typing
 * in one note changes that note's item, its parents and nothing else.
 *
 * `changed` names the nodes touched since `previous` was read. With it, the
 * others are taken from `previous` without reading their fields again, which
 * was most of the time a keystroke took in a big workspace.
 */
export function readTree(doc: Y.Doc, previous?: Tree, changed?: ReadonlySet<string>): Tree {
  const byId = new Map<string, TreeNode>();
  nodesOf(doc).forEach((fields, id) => {
    const old = previous?.byId.get(id);
    if (old && changed && !changed.has(id)) return byId.set(id, old);
    const node = toNode(id, fields);
    byId.set(id, old && sameNode(old, node) ? old : node);
  });

  // A node whose parent may not hold it is shown in the nearest node above
  // that may, or at the top. That covers a folder put in a book while books
  // were read as folders, and pages under a kind this version does not know. Undefined means the chain is broken or loops, handled further down.
  const nearestHolder = (kind: NodeKind, from: string): string | undefined => {
    const seen = new Set<string>();
    for (let parentId = from; parentId !== ROOT; ) {
      const parent = byId.get(parentId);
      if (!parent || seen.has(parentId)) return undefined;
      if (holds(parent.kind, kind)) return parentId;
      seen.add(parentId);
      parentId = parent.parentId;
    }
    return ROOT;
  };
  const shownIn = (node: TreeNode): string | undefined => {
    if (node.kind === "book" || node.kind === "folder") {
      // Books once held books as parts, and a chapter could hold a folder.
      // Such a book or folder now shows beside the outermost book above it,
      // with what is in it, and nothing is rewritten.
      let outer: TreeNode | undefined;
      const seen = new Set([node.id]);
      for (let cur = byId.get(node.parentId); cur; cur = byId.get(cur.parentId)) {
        // A loop, as two devices moving at once can make: placed further down.
        if (seen.has(cur.id)) return undefined;
        seen.add(cur.id);
        if (cur.kind === "book") outer = cur;
      }
      // The outermost book has no book above it, so this walk ends without coming back here.
      if (outer) return nearestHolder(outer.kind, outer.parentId);
    }
    return nearestHolder(node.kind, node.parentId);
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
      .sort(sorterFor(byId.get(parentId)))
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

/**
 * Calls back with the tree now and after every change to it, reading again
 * only the nodes each change touched. Returns a function that stops watching.
 */
export function watchTree(doc: Y.Doc, onTree: (tree: Tree) => void): () => void {
  const nodes = nodesOf(doc);
  let tree = readTree(doc);
  onTree(tree);
  const onChange = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
    const changed = new Set<string>();
    for (const event of events) {
      // Nodes added or deleted, or fields changed inside one node.
      if (event.target === nodes) for (const id of (event as Y.YMapEvent<unknown>).keysChanged) changed.add(id);
      else changed.add(event.path[0] as string);
    }
    tree = readTree(doc, tree, changed);
    onTree(tree);
  };
  nodes.observeDeep(onChange);
  return () => nodes.unobserveDeep(onChange);
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

/** True when `id` is a book or sits somewhere inside one, like a chapter or a subtopic. */
function withinBook(tree: Tree, id: string): boolean {
  const seen = new Set<string>();
  for (let cur = tree.items.get(id); cur && !seen.has(cur.id); cur = tree.items.get(cur.parentId)) {
    if (cur.kind === "book") return true;
    seen.add(cur.id);
  }
  return false;
}

/** The first book or folder in `item` or under it: neither may go anywhere inside a book. */
const sortsInside = (item: TreeItem): TreeItem | undefined =>
  item.kind === "book" || item.kind === "folder" ? item : item.children.map(sortsInside).find(Boolean);

/** Whether `id` may be moved under `parentId`. Returns the reason when it may not. */
export function canMove(tree: Tree, id: string, parentId: string): string | null {
  if (!tree.items.has(id)) return "this note is not in the tree";
  if (parentId === ROOT) return null;
  const target = tree.items.get(parentId);
  if (!target) return "the target is not in the tree";
  const item = tree.items.get(id)!;
  if (!holds(target.kind, item.kind)) return target.kind === "book" ? `a book cannot hold a ${item.kind}` : `a ${target.kind} cannot hold pages`;
  const sorter = withinBook(tree, parentId) ? sortsInside(item) : undefined;
  if (sorter) return `a book cannot hold a ${sorter.kind}`;
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

/**
 * Moves several nodes under `parentId`, together and in the order given, just
 * before `nextId` (or at the end when it is null). A node inside another one
 * being moved goes along with it, and a node that may not go there is skipped.
 */
export function moveNodes(doc: Y.Doc, ids: string[], parentId: string, nextId: string | null) {
  const tree = readTree(doc);
  const moving = ids.filter((id) => !ids.some((other) => other !== id && isInside(tree, id, other)) && !canMove(tree, id, parentId));
  const set = new Set(moving);
  // When the target is moving too, the block goes before the next sibling that stays.
  const siblings = childrenOf(tree, parentId);
  const from = nextId === null ? siblings.length : siblings.findIndex((item) => item.id === nextId);
  const anchor = from < 0 ? null : (siblings.slice(from).find((item) => !set.has(item.id))?.id ?? null);
  doc.transact(() => {
    for (const id of moving) {
      const rest = childrenOf(readTree(doc), parentId).filter((item) => item.id !== id);
      const at = anchor === null ? rest.length : rest.findIndex((item) => item.id === anchor);
      moveNode(doc, id, parentId, at);
    }
  });
}

/** Adds a node at the end of ROOT or of a node that may hold it. */
export function createNode(doc: Y.Doc, kind: NodeKind, parentId: string, title = "", id: string = crypto.randomUUID()): string {
  if (!KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
  if (parentId !== ROOT) {
    const parent = nodesOf(doc).get(parentId);
    if (!parent) throw new Error(`no page or folder with id ${parentId}`);
    if (!holds(kindOf(parent), kind)) throw new Error(`a ${kindOf(parent)} cannot hold a ${kind}`);
    // Judged by where pages show, like canMove, so an old folder shown beside its book still takes new folders.
    if ((kind === "book" || kind === "folder") && withinBook(readTree(doc), parentId)) throw new Error(`a book cannot hold a ${kind}`);
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
 * Changes what a page is, like a folder into a note, keeping everything inside
 * it where it is. Throws when the place it is in could not hold the new kind,
 * or the new kind could not hold what it has inside.
 */
export function setKind(doc: Y.Doc, id: string, kind: NodeKind) {
  if (!KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
  const fields = fieldsOf(doc, id);
  const tree = readTree(doc);
  const parentId = parentOf(fields);
  if (parentId !== ROOT) {
    const parent = tree.byId.get(parentId);
    if (parent && !holds(parent.kind, kind)) throw new Error(`a ${parent.kind} cannot hold a ${kind}`);
    if (isContainer(kind) && withinBook(tree, parentId)) throw new Error(`a book cannot hold a ${kind}`);
  }
  for (const child of tree.items.get(id)?.children ?? []) {
    if (!holds(kind, child.kind)) throw new Error(`a ${kind} cannot hold a ${child.kind}`);
    const sorter = kind === "book" ? sortsInside(child) : undefined;
    if (sorter) throw new Error(`a book cannot hold a ${sorter.kind}`);
  }
  fields.set("kind", kind);
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
      if (key === "links" || key === "words" || key.startsWith(TAG_PREFIX) || key.startsWith(PROP_PREFIX)) copy.set(key, Array.isArray(value) ? [...value] : value);
    }
    if (item) moveNode(doc, copyId, parentId, childrenOf(tree, parentId).indexOf(item) + 1);
  });
  return copyId;
}

/**
 * Copies a page and everything inside it from one workspace's tree to the end
 * of another's top level. Trashed pages stay behind. Ids stay the same, so
 * links between the copied pages keep working, unless the other workspace
 * already uses one; that page gets a new id and links to it follow. Returns
 * the ids, old to new. Bodies are stored apart, so the caller copies those.
 */
export function copyNodesTo(from: Y.Doc, id: string, to: Y.Doc): Map<string, string> {
  const alive = (nodeId: string) => fieldsOf(from, nodeId).get("deletedAt") == null;
  const ids = [id, ...descendantsOf(from, id)].filter(alive);
  const kept = new Set(ids);
  // A page inside a trashed one is left behind with it.
  const copied = ids.filter((nodeId) => {
    for (let at = nodeId; at !== id; at = parentOf(fieldsOf(from, at))) if (!kept.has(at)) return false;
    return true;
  });
  const map = new Map(copied.map((nodeId) => [nodeId, nodesOf(to).has(nodeId) ? crypto.randomUUID() : nodeId]));

  let last: string | null = null;
  nodesOf(to).forEach((fields) => {
    const position = fields.get("position") as string;
    if (parentOf(fields) === ROOT && (last === null || position > last)) last = position;
  });

  to.transact(() => {
    for (const nodeId of copied) {
      const source = fieldsOf(from, nodeId);
      const copy = new Y.Map<unknown>();
      nodesOf(to).set(map.get(nodeId)!, copy);
      for (const [key, value] of source.entries()) copy.set(key, Array.isArray(value) ? [...value] : value);
      copy.set("parentId", nodeId === id ? ROOT : map.get(parentOf(source))!);
      if (nodeId === id) copy.set("position", generateKeyBetween(last, null));
      const links = source.get("links") as string[] | undefined;
      if (links) copy.set("links", links.map((target) => map.get(target) ?? target));
    }
  });
  return map;
}

/**
 * The pages a new workspace starts with. The ids are fixed, so two new
 * devices that later sync together end up with one set, not two.
 */
export const STARTER = {
  folder: "starter-folder",
  welcome: WELCOME_ID,
  journal: "journal",
  book: "welcome-book",
  chapter: "welcome-chapter",
  subtopic: "welcome-subtopic",
} as const;

/** Starter pages of earlier versions, so a device that only has those still counts as new. */
const PAST_STARTER = ["welcome-board"];

export const STARTER_IDS: ReadonlySet<string> = new Set([...Object.values(STARTER), ...PAST_STARTER]);

/**
 * Fills a brand-new workspace with a Notemax folder holding a Welcome note, a
 * Journal page for the calendar's daily notes, and a small book to show how
 * chapters and subtopics work. Does nothing to a workspace that has anything.
 * With welcomeOnly, just the Welcome note at the top, as workspaces started before.
 */
export function ensureStarter(doc: Y.Doc, { welcomeOnly = false } = {}) {
  if (nodesOf(doc).size !== 0) return;
  doc.transact(() => {
    if (welcomeOnly) {
      createNode(doc, "note", ROOT, "Welcome", STARTER.welcome);
      return;
    }
    createNode(doc, "folder", ROOT, "Notemax", STARTER.folder);
    createNode(doc, "note", STARTER.folder, "Welcome", STARTER.welcome);
    // One page with each day inside it as a subtopic, the newest day first.
    // dailyFolder is the role prop the app reads for where daily notes go.
    createNode(doc, "note", STARTER.folder, "Journal", STARTER.journal);
    setProp(doc, STARTER.journal, "dailyFolder", true);
    setProp(doc, STARTER.journal, "subtopics", "inline");
    setProp(doc, STARTER.journal, "sort", "days");
    createNode(doc, "book", STARTER.folder, "My first book", STARTER.book);
    createNode(doc, "note", STARTER.book, "Getting started", STARTER.chapter);
    createNode(doc, "note", STARTER.chapter, "A subtopic", STARTER.subtopic);
  });
}

function fieldsOf(doc: Y.Doc, id: string) {
  const fields = nodesOf(doc).get(id);
  if (!fields) throw new Error(`no node with id ${id}`);
  return fields;
}

export function renameNode(doc: Y.Doc, id: string, title: string) {
  doc.transact(() => {
    fieldsOf(doc, id).set("title", title);
    touchNode(doc, id);
  });
}

// The edited time is kept to the minute: writing it on every keystroke would
// grow the workspace and send a sync for each one.
const EDITED_STEP_MS = 60_000;

/** Records that a page was just edited. Writes at most once a minute per page. */
export function touchNode(doc: Y.Doc, id: string, now = Date.now()) {
  const fields = fieldsOf(doc, id);
  const last = (fields.get("editedAt") as number | undefined) ?? (fields.get("createdAt") as number | undefined) ?? 0;
  if (now - last >= EDITED_STEP_MS) doc.transact(() => fields.set("editedAt", now), UNTRACKED);
}

/** Sets one of a page's small settings. Null removes it, so the page goes back to the default. */
export function setProp(doc: Y.Doc, id: string, key: string, value: PropValue | null) {
  const fields = fieldsOf(doc, id);
  const field = PROP_PREFIX + key;
  if (value === null) {
    if (fields.has(field)) fields.delete(field);
  } else if (fields.get(field) !== value) fields.set(field, value);
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
  doc.transact(() => fields.set("links", next), UNTRACKED);
}

/** Records the body's word count. Writes only when it changed, like setLinks. */
export function setWords(doc: Y.Doc, id: string, words: number) {
  const fields = fieldsOf(doc, id);
  if (fields.get("words") !== words) doc.transact(() => fields.set("words", words), UNTRACKED);
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
  doc.transact(() => ids.forEach((nodeId) => nodesOf(doc).delete(nodeId)), UNTRACKED);
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

/**
 * Calls `listener` with the ids of nodes this device adds, like a new page.
 * Nodes merged in from another window or device are left out, so a listener
 * can mark what was made here without marking everyone else's pages too.
 */
export function onNodesAdded(doc: Y.Doc, listener: (ids: string[]) => void): () => void {
  const observer = (event: Y.YMapEvent<Y.Map<unknown>>, transaction: Y.Transaction) => {
    if (!transaction.local) return;
    const added = [...event.keysChanged].filter((id) => event.changes.keys.get(id)?.action === "add");
    if (added.length) listener(added);
  };
  nodesOf(doc).observe(observer);
  return () => nodesOf(doc).unobserve(observer);
}

/**
 * Undo and redo for changes to the tree made on this device: new pages, moves,
 * renames, tags, the trash. Edits merged in from elsewhere and UNTRACKED
 * bookkeeping are left out. Typing that comes fast is one step.
 */
export function treeUndo(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager(nodesOf(doc), { trackedOrigins: new Set([null]), captureTimeout: 600 });
}
