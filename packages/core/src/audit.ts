import * as Y from "yjs";
import { historyDocId } from "./history";
import { openLocalDoc } from "./local-doc";
import type { DocStore } from "./store";

// Who did what to a page. Two parts, both kept in Yjs so they sync with
// everything else:
//
// - Each copy of a page that edits it writes who it is under its own Yjs
//   client id, in the page's "authors" map. Every edit carries its client id,
//   so a version can tell whose edits it holds that the one before did not,
//   even edits that came from someone else through a shared link.
// - Things done to a page that are not typing (a rename, a move, a restore)
//   go in a log beside its versions.
//
// It records what each copy says about itself. That is enough to follow your
// own devices and the people you share with; it is not proof against someone
// who edits the app to lie.

/** Who made a change: a name when signed in, and the device it was made on. */
export interface Author {
  /** The account's name, or "" when not signed in. */
  name: string;
  /** The device in words, like "Chrome on Android". */
  device: string;
  /** A device's own id, kept on it, to tell "you, here" from your other devices. */
  deviceId: string;
}

export type AuditAction =
  | "created"
  | "renamed"
  | "moved"
  | "trashed"
  | "untrashed"
  | "saved-version"
  | "restored-version"
  | "kept-conflict"
  | "shared"
  | "unshared"
  | "locked"
  | "unlocked";

export interface AuditEntry {
  id: string;
  time: number;
  who: Author;
  action: AuditAction;
  /** Words that say more, like the old and new title, or which version. */
  detail: string | null;
}

const AUTHORS = "authors";
/** The log is for following what happened lately, not a store of everything ever done. */
const KEEP_ENTRIES = 500;

const sameAuthor = (a: Author, b: Author) => a.name === b.name && a.device === b.device && a.deviceId === b.deviceId;

function readAuthor(value: unknown): Author | null {
  if (!value || typeof value !== "object") return null;
  const { name, device, deviceId } = value as Record<string, unknown>;
  return typeof name === "string" && typeof device === "string" && typeof deviceId === "string" ? { name, device, deviceId } : null;
}

/**
 * Writes who this copy of the page is, once, so its edits can be told apart.
 * Call it when the copy makes its first edit: reading a page writes nothing.
 */
export function stampAuthor(doc: Y.Doc, author: Author) {
  const authors = doc.getMap<unknown>(AUTHORS);
  const key = String(doc.clientID);
  const now = readAuthor(authors.get(key));
  if (!now || !sameAuthor(now, author)) authors.set(key, { ...author });
}

/** Who each Yjs client id in the page is. */
export function authorsOf(doc: Y.Doc): Map<number, Author> {
  const out = new Map<number, Author>();
  doc.getMap<unknown>(AUTHORS).forEach((value, key) => {
    const author = readAuthor(value);
    if (author) out.set(Number(key), author);
  });
  return out;
}

/** The client ids with edits in `after` that `before` lacks. Every client counts when there is no `before`. */
export function editorsSince(before: Uint8Array | null, after: Uint8Array): number[] {
  const then = before ? Y.decodeStateVector(Y.encodeStateVectorFromUpdate(before)) : new Map<number, number>();
  const now = Y.decodeStateVector(Y.encodeStateVectorFromUpdate(after));
  return [...now].filter(([client, clock]) => clock > (then.get(client) ?? 0)).map(([client]) => client);
}

/** The people behind some client ids, each once. Ids nobody stamped, like edits from before this, are left out. */
export function authorsFor(clients: readonly number[], authors: ReadonlyMap<number, Author>): Author[] {
  const out: Author[] = [];
  for (const client of clients) {
    const author = authors.get(client);
    if (author && !out.some((seen) => sameAuthor(seen, author))) out.push(author);
  }
  return out;
}

/** Joins two lists of authors, each person once. */
export function mergeAuthors(a: readonly Author[], b: readonly Author[]): Author[] {
  const out = [...a];
  for (const author of b) if (!out.some((seen) => sameAuthor(seen, author))) out.push(author);
  return out;
}

export const readAuthors = (value: unknown): Author[] | null => (Array.isArray(value) ? value.map(readAuthor).filter((a): a is Author => !!a) : null);

const logOf = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>("log");

function toEntry(entry: Y.Map<unknown>): AuditEntry | null {
  const who = readAuthor(entry.get("who"));
  const action = entry.get("action");
  const time = entry.get("time");
  if (!who || typeof action !== "string" || typeof time !== "number") return null;
  return { id: String(entry.get("id")), time, who, action: action as AuditAction, detail: (entry.get("detail") as string | null | undefined) ?? null };
}

/** Adds to a page's log. Past the last 500, the oldest go. */
export async function logEvent(store: DocStore, pageId: string, event: Omit<AuditEntry, "id" | "time"> & { time?: number }): Promise<void> {
  const local = await openLocalDoc(store, historyDocId(pageId));
  try {
    const log = logOf(local.doc);
    local.doc.transact(() => {
      const entry = new Y.Map<unknown>();
      log.push([entry]);
      entry.set("id", crypto.randomUUID());
      entry.set("time", event.time ?? Date.now());
      entry.set("who", { ...event.who });
      entry.set("action", event.action);
      entry.set("detail", event.detail);
      if (log.length > KEEP_ENTRIES) {
        // Oldest by time, not by place: two devices' entries interleave.
        const order = log.toArray().map((e, i) => ({ i, time: (e.get("time") as number) ?? 0 })).sort((a, b) => a.time - b.time);
        const drop = new Set(order.slice(0, log.length - KEEP_ENTRIES).map(({ i }) => i));
        for (let i = log.length - 1; i >= 0; i--) if (drop.has(i)) log.delete(i, 1);
      }
    });
    await local.flush();
  } finally {
    await local.close();
  }
}

/** A page's log, newest first. */
export async function listLog(store: DocStore, pageId: string): Promise<AuditEntry[]> {
  const local = await openLocalDoc(store, historyDocId(pageId));
  try {
    return logOf(local.doc)
      .toArray()
      .map(toEntry)
      .filter((entry): entry is AuditEntry => !!entry)
      .sort((a, b) => b.time - a.time);
  } finally {
    await local.close();
  }
}
