import * as Y from "yjs";
import { WORKSPACE_DOC_ID, plainText, readTree, splitScoped, type Tree } from "@notemax/core";
import { remoteEdit } from "@/features/sync/live";
import { getStore, onLocalWrite } from "@/platform/platform";
import { currentWorkspace } from "@/platform/prefs";
import { createStore } from "@/platform/store";

// Every note's text, for searching inside notes and for finding pages that
// mention a title without linking to it. Kept in IndexedDB with the time the
// note was last edited, so a restart reads only notes that changed since.

const DB = "notemax-search";
interface Saved {
  text: string;
  edited: number;
}

const texts = new Map<string, string>();
/** Goes up as the index fills or changes, so searches shown on screen run again. */
export const indexVersion = createStore(0);
const bump = () => indexVersion.set(indexVersion.get() + 1);

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("texts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}
const key = (id: string) => `${currentWorkspace}:${id}`;

async function loadSaved(): Promise<Map<string, Saved>> {
  const tx = (await db()).transaction("texts", "readonly");
  const store = tx.objectStore("texts");
  const prefix = `${currentWorkspace}:`;
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
  const [keys, values] = await Promise.all([
    new Promise<IDBValidKey[]>((resolve, reject) => {
      const r = store.getAllKeys(range);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }),
    new Promise<Saved[]>((resolve, reject) => {
      const r = store.getAll(range);
      r.onsuccess = () => resolve(r.result as Saved[]);
      r.onerror = () => reject(r.error);
    }),
  ]);
  return new Map(keys.map((k, i) => [String(k).slice(prefix.length), values[i]]));
}

async function save(id: string, saved: Saved | null) {
  const tx = (await db()).transaction("texts", "readwrite");
  if (saved) tx.objectStore("texts").put(saved, key(id));
  else tx.objectStore("texts").delete(key(id));
}

/** A note's text, read from storage. Nothing is written to the note. */
async function readText(id: string): Promise<string> {
  const { updates } = await (await getStore()).load(id);
  const body = new Y.Doc();
  try {
    if (updates.length) Y.applyUpdate(body, Y.mergeUpdates(updates));
    return plainText(body.getXmlFragment("content"));
  } finally {
    body.destroy();
  }
}

async function refresh(id: string, edited: number) {
  const text = await readText(id);
  texts.set(id, text);
  await save(id, { text, edited });
}

/**
 * Fills the index, a few notes at a time so typing never waits on it, then
 * keeps it current as notes change here or on other devices.
 */
export async function startIndex(doc: Y.Doc) {
  const saved = await loadSaved();
  const tree = readTree(doc);
  const notes = [...tree.items.values()].filter((item) => item.kind === "note");
  const stale: { id: string; edited: number }[] = [];
  for (const note of notes) {
    const known = saved.get(note.id);
    if (known) texts.set(note.id, known.text);
    if (!known || known.edited < note.editedAt) stale.push({ id: note.id, edited: note.editedAt });
  }
  // Gone from the workspace since: out of the index too.
  for (const id of saved.keys()) if (!tree.byId.has(id)) void save(id, null);
  bump();

  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const soon = (id: string) => {
    clearTimeout(pending.get(id));
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        const node = readTree(doc).byId.get(id);
        if (node?.kind === "note") void refresh(id, Date.now()).then(bump);
      }, 1000),
    );
  };
  onLocalWrite(({ docId }) => {
    const { workspace, docId: id } = splitScoped(docId);
    if (workspace === currentWorkspace && id !== WORKSPACE_DOC_ID) soon(id);
  });
  remoteEdit.subscribe(() => {
    const edit = remoteEdit.get();
    if (edit) soon(edit.docId);
  });

  for (let i = 0; i < stale.length; i += 20) {
    await Promise.all(stale.slice(i, i + 20).map(({ id, edited }) => refresh(id, edited).catch(() => {})));
    bump();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The words around a match, on one line. */
function snippetAt(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + length + 80);
  return `${start > 0 ? "..." : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "..." : ""}`;
}

export interface TextMatch {
  id: string;
  snippet: string;
}

/** Notes whose text has every word of the query, most mentions first. */
export function searchText(tree: Tree, query: string, limit = 20): TextMatch[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length >= 2);
  if (!words.length) return [];
  const found: (TextMatch & { score: number })[] = [];
  for (const [id, text] of texts) {
    if (!tree.visible.has(id)) continue;
    const lower = text.toLowerCase();
    if (!words.every((word) => lower.includes(word))) continue;
    const score = words.reduce((sum, word) => sum + lower.split(word).length - 1, 0);
    found.push({ id, snippet: snippetAt(text, lower.indexOf(words[0]), words[0].length), score });
  }
  return found.sort((a, b) => b.score - a.score).slice(0, limit);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pages that say a title in their text but do not link to it: links waiting to be made. */
export function mentionsOf(tree: Tree, id: string): TextMatch[] {
  const title = tree.byId.get(id)?.title.trim();
  if (!title || title.length < 3) return [];
  const linking = new Set((tree.backlinks.get(id) ?? []).map((node) => node.id));
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(title)}(?=$|[^\\p{L}\\p{N}])`, "iu");
  const out: TextMatch[] = [];
  for (const [other, text] of texts) {
    if (other === id || linking.has(other) || !tree.visible.has(other)) continue;
    const match = pattern.exec(text);
    if (match) out.push({ id: other, snippet: snippetAt(text, match.index + match[1].length, title.length) });
  }
  return out;
}
