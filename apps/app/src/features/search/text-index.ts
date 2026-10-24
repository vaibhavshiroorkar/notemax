import * as Y from "yjs";
import { WORKSPACE_DOC_ID, plainText, readTree, splitScoped, tasksIn, type Task, type Tree } from "@notemax/core";
import { remoteEdit } from "@/features/sync/live";
import { memoryOnly, onLocalWrite, storeFor } from "@/platform/platform";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";

// Every note's text, for searching inside notes and for finding pages that
// mention a title without linking to it, and every note's to-dos, for the
// Tasks view. Kept in IndexedDB with the time the
// note was last edited, so a restart reads only notes that changed since.
// It covers the workspace in the sidebar, and starts over when that changes.

const DB = "notemax-search";
interface Saved {
  text: string;
  edited: number;
  /** Missing in what older versions saved, which makes the note read again. */
  tasks?: Task[];
}

const texts = new Map<string, string>();
const taskLists = new Map<string, Task[]>();
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
const key = (workspace: string, id: string) => `${workspace}:${id}`;

async function loadSaved(workspace: string): Promise<Map<string, Saved>> {
  // A device that keeps no pages keeps no copy of their text either; the index lives in memory.
  if (memoryOnly) return new Map();
  const tx = (await db()).transaction("texts", "readonly");
  const store = tx.objectStore("texts");
  const prefix = `${workspace}:`;
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

async function save(workspace: string, id: string, saved: Saved | null) {
  if (memoryOnly) return;
  const tx = (await db()).transaction("texts", "readwrite");
  if (saved) tx.objectStore("texts").put(saved, key(workspace, id));
  else tx.objectStore("texts").delete(key(workspace, id));
}

/** A note's text and to-dos, read from storage. Nothing is written to the note. */
async function readNote(workspace: string, id: string): Promise<{ text: string; tasks: Task[] }> {
  const { updates } = await (await storeFor(workspace)).load(id);
  const body = new Y.Doc();
  try {
    if (updates.length) Y.applyUpdate(body, Y.mergeUpdates(updates));
    const content = body.getXmlFragment("content");
    return { text: plainText(content), tasks: tasksIn(content) };
  } finally {
    body.destroy();
  }
}

function keep(id: string, tasks: Task[]) {
  if (tasks.length) taskLists.set(id, tasks);
  else taskLists.delete(id);
}

async function refresh(workspace: string, id: string, edited: number) {
  const { text, tasks } = await readNote(workspace, id);
  // Switched away while reading: this text belongs to the other workspace.
  if (indexed?.workspace !== workspace) return;
  texts.set(id, text);
  keep(id, tasks);
  await save(workspace, id, { text, edited, tasks });
}

/** What the index covers now. */
let indexed: { doc: Y.Doc; workspace: string } | null = null;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** Reads a note again a second after its last change. */
function soon(id: string) {
  clearTimeout(pending.get(id));
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      const now = indexed;
      if (!now) return;
      const node = readTree(now.doc).byId.get(id);
      if (node?.kind === "note") void refresh(now.workspace, id, Date.now()).then(bump);
    }, 1000),
  );
}

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  onLocalWrite(({ docId }) => {
    const { workspace, docId: id } = splitScoped(docId);
    if (workspace === indexed?.workspace && id !== WORKSPACE_DOC_ID) soon(id);
  });
  remoteEdit.subscribe(() => {
    const edit = remoteEdit.get();
    if (edit) soon(edit.docId);
  });
}

/**
 * Fills the index for a workspace, a few notes at a time so typing never
 * waits on it, then keeps it current as notes change here or on other
 * devices. Called again for the next workspace when the sidebar switches.
 */
export async function startIndex(doc: Y.Doc, workspace: string) {
  indexed = { doc, workspace };
  texts.clear();
  taskLists.clear();
  pending.forEach((timer) => clearTimeout(timer));
  pending.clear();
  listen();
  bump();
  const saved = await loadSaved(workspace);
  if (indexed.workspace !== workspace) return;
  const tree = readTree(doc);
  const notes = [...tree.items.values()].filter((item) => item.kind === "note");
  const stale: { id: string; edited: number }[] = [];
  for (const note of notes) {
    const known = saved.get(note.id);
    if (known) texts.set(note.id, known.text);
    if (known?.tasks) keep(note.id, known.tasks);
    if (!known || !known.tasks || known.edited < note.editedAt) stale.push({ id: note.id, edited: note.editedAt });
  }
  // Gone from the workspace since: out of the index too.
  for (const id of saved.keys()) if (!tree.byId.has(id)) void save(workspace, id, null);
  bump();

  for (let i = 0; i < stale.length; i += 20) {
    if (indexed.workspace !== workspace) return;
    await Promise.all(stale.slice(i, i + 20).map(({ id, edited }) => refresh(workspace, id, edited).catch(() => {})));
    bump();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The to-dos of every note in the shown workspace, by note id. Notes with none are left out. */
export const allTasks = (): ReadonlyMap<string, Task[]> => taskLists;

/** Reads a note again now, as after an edit, so a list that just ticked a task shows it at once. */
export function readAgain(id: string) {
  const now = indexed;
  if (now) void refresh(now.workspace, id, Date.now()).then(bump);
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
    if (!tree.visible.has(id) || registry.hidesText(tree.byId.get(id))) continue;
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
    if (other === id || linking.has(other) || !tree.visible.has(other) || registry.hidesText(tree.byId.get(other))) continue;
    const match = pattern.exec(text);
    if (match) out.push({ id: other, snippet: snippetAt(text, match.index + match[1].length, title.length) });
  }
  return out;
}
