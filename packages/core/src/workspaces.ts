import * as Y from "yjs";
import { generateKeyBetween } from "fractional-indexing";
import type { DocStore } from "./store";

// Several workspaces share one store. The first one, "main", keeps its doc ids
// as they always were, so nothing stored before workspaces existed moves.
// Every other workspace puts "ws:<id>:" in front of its ids. Sync, which
// works on the store underneath, carries all of them without knowing.

export const MAIN_WORKSPACE = "main";
/** The list of workspaces: a doc of its own, outside every workspace, so it syncs too. */
export const WORKSPACES_DOC_ID = "workspaces";
/** Settings that follow the person to every device, like the theme. Outside every workspace too. */
export const SETTINGS_DOC_ID = "settings";
const OUTSIDE = new Set([WORKSPACES_DOC_ID, SETTINGS_DOC_ID]);

const PREFIX = "ws:";

/** The id a workspace's doc has in the shared store. */
export const scopedId = (workspace: string, docId: string) => (workspace === MAIN_WORKSPACE ? docId : `${PREFIX}${workspace}:${docId}`);

/** Which workspace a stored id belongs to, and its id inside that workspace. The list and the settings belong to none. */
export function splitScoped(stored: string): { workspace: string | null; docId: string } {
  if (OUTSIDE.has(stored)) return { workspace: null, docId: stored };
  if (!stored.startsWith(PREFIX)) return { workspace: MAIN_WORKSPACE, docId: stored };
  const end = stored.indexOf(":", PREFIX.length);
  if (end < 0) return { workspace: MAIN_WORKSPACE, docId: stored };
  return { workspace: stored.slice(PREFIX.length, end), docId: stored.slice(end + 1) };
}

/** The store as one workspace sees it: its own docs, under their plain ids. */
export function scopedStore(store: DocStore, workspace: string): DocStore {
  const id = (docId: string) => scopedId(workspace, docId);
  return {
    load: (docId) => store.load(id(docId)),
    append: (docId, update) => store.append(id(docId), update),
    compact: (docId, merged, upTo) => store.compact(id(docId), merged, upTo),
    remove: (docId) => store.remove(id(docId)),
    async list() {
      return (await store.list()).flatMap((stored) => {
        const { workspace: owner, docId } = splitScoped(stored);
        return owner === workspace ? [docId] : [];
      });
    },
  };
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  /** A color for its dot and card, like "#2f9e44". Empty for the plain one. */
  color: string;
  position: string;
  createdAt: number;
}

const listOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("workspaces");

/** Every workspace, in the order they were arranged. "main" is always there, even before it was ever named. */
export function readWorkspaces(doc: Y.Doc): WorkspaceInfo[] {
  const out: WorkspaceInfo[] = [];
  listOf(doc).forEach((fields, id) => {
    if (fields.get("deleted")) return;
    out.push({
      id,
      name: (fields.get("name") as string | undefined) ?? "",
      color: (fields.get("color") as string | undefined) ?? "",
      position: (fields.get("position") as string | undefined) ?? "a0",
      createdAt: (fields.get("createdAt") as number | undefined) ?? 0,
    });
  });
  if (!out.some((w) => w.id === MAIN_WORKSPACE)) out.push({ id: MAIN_WORKSPACE, name: "", color: "", position: "a0", createdAt: 0 });
  return out.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1));
}

function fieldsFor(doc: Y.Doc, id: string): Y.Map<unknown> {
  let fields = listOf(doc).get(id);
  if (!fields) {
    fields = new Y.Map<unknown>();
    listOf(doc).set(id, fields);
  }
  return fields;
}

/** Adds a workspace at the end. Returns its id. */
export function addWorkspace(doc: Y.Doc, name: string, color = "", id: string = crypto.randomUUID().slice(0, 8)): string {
  const last = readWorkspaces(doc).at(-1)?.position ?? null;
  doc.transact(() => {
    const fields = fieldsFor(doc, id);
    fields.set("name", name);
    fields.set("color", color);
    fields.set("position", generateKeyBetween(last, null));
    fields.set("createdAt", Date.now());
  });
  return id;
}

export function renameWorkspace(doc: Y.Doc, id: string, name: string) {
  doc.transact(() => {
    const fields = fieldsFor(doc, id);
    if (!fields.has("position")) fields.set("position", "a0");
    fields.set("name", name);
  });
}

export function setWorkspaceColor(doc: Y.Doc, id: string, color: string) {
  doc.transact(() => {
    const fields = fieldsFor(doc, id);
    if (!fields.has("position")) fields.set("position", "a0");
    fields.set("color", color);
  });
}

/** Puts a workspace at `index` in the arrangement. Only its own position changes. */
export function moveWorkspace(doc: Y.Doc, id: string, index: number) {
  const others = readWorkspaces(doc).filter((w) => w.id !== id);
  const at = Math.max(0, Math.min(index, others.length));
  const before = others[at - 1]?.position ?? null;
  const after = others[at]?.position ?? null;
  // Two with the same position (like a never-moved "main") need room made first.
  const position = before !== null && after !== null && before >= after ? generateKeyBetween(before, null) : generateKeyBetween(before, after);
  doc.transact(() => fieldsFor(doc, id).set("position", position));
}

/**
 * Takes a workspace off the list. A mark rather than a delete, so a device
 * that still has it open learns it is gone. Its pages are erased separately.
 */
export function removeWorkspace(doc: Y.Doc, id: string) {
  if (id === MAIN_WORKSPACE) throw new Error("the first workspace cannot be removed");
  doc.transact(() => fieldsFor(doc, id).set("deleted", true));
}
