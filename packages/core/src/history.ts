import * as Y from "yjs";
import { openLocalDoc } from "./local-doc";
import type { DocStore } from "./store";

/**
 * Past versions of a page, kept in a Yjs doc of their own next to it. Being a
 * Yjs doc, it is saved, synced and backed up like the page itself, and
 * versions saved on two devices both survive.
 */
export const historyDocId = (pageId: string) => `history:${pageId}`;
export const isHistoryDocId = (docId: string) => docId.startsWith("history:");

export interface Version {
  id: string;
  time: number;
  /** Words in the page then, or null when it was not counted. */
  words: number | null;
  /** The page's whole Yjs state at that time. */
  state: Uint8Array;
}

const DAY = 24 * 60 * 60 * 1000;
/** The newest ones are always kept, however close together. */
const KEEP_RECENT = 20;
const KEEP_MOST = 100;

/**
 * Which versions to keep, newest first: the last 20, then one a day for a
 * month, then one a week, and never more than 100. Long-lived pages keep
 * their old shape without the history growing without end.
 */
export function versionsToKeep(times: readonly number[], now = Date.now()): Set<number> {
  const order = times.map((time, i) => ({ time, i })).sort((a, b) => b.time - a.time);
  const keep = new Set<number>();
  const buckets = new Set<string>();
  for (const [rank, { time, i }] of order.entries()) {
    if (keep.size >= KEEP_MOST) break;
    if (rank < KEEP_RECENT) {
      keep.add(i);
      continue;
    }
    const age = now - time;
    const bucket = age < 30 * DAY ? `d${Math.floor(time / DAY)}` : `w${Math.floor(time / (7 * DAY))}`;
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    keep.add(i);
  }
  return keep;
}

const versionsOf = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>("versions");

function toVersion(entry: Y.Map<unknown>): Version {
  return {
    id: entry.get("id") as string,
    time: entry.get("time") as number,
    words: (entry.get("words") as number | null | undefined) ?? null,
    state: entry.get("state") as Uint8Array,
  };
}

/** Saves a page's state (Y.encodeStateAsUpdate of its doc) as a version, then thins out old ones. */
export async function saveVersion(store: DocStore, pageId: string, state: Uint8Array, { words = null, time = Date.now() }: { words?: number | null; time?: number } = {}) {
  const local = await openLocalDoc(store, historyDocId(pageId));
  try {
    const versions = versionsOf(local.doc);
    local.doc.transact(() => {
      const entry = new Y.Map<unknown>();
      versions.push([entry]);
      entry.set("id", crypto.randomUUID());
      entry.set("time", time);
      entry.set("words", words);
      entry.set("state", state);
      const keep = versionsToKeep(versions.toArray().map((v) => v.get("time") as number), time);
      // From the end, so the indexes still to visit do not move.
      for (let i = versions.length - 1; i >= 0; i--) if (!keep.has(i)) versions.delete(i, 1);
    });
    await local.flush();
  } finally {
    await local.close();
  }
}

/** A page's versions, newest first. */
export async function listVersions(store: DocStore, pageId: string): Promise<Version[]> {
  const local = await openLocalDoc(store, historyDocId(pageId));
  try {
    return versionsOf(local.doc)
      .toArray()
      .map(toVersion)
      .sort((a, b) => b.time - a.time);
  } finally {
    await local.close();
  }
}

/** The body a version had, as a doc of its own to read from. */
export function versionDoc(version: Version): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, version.state);
  return doc;
}

/**
 * Makes `page`'s body what it was in `version`. It is written as a new edit,
 * so it syncs like typing, and the state before it can be saved and restored too.
 */
export function restoreBody(page: Y.Doc, version: Version, field = "content") {
  const old = versionDoc(version);
  try {
    const from = old.getXmlFragment(field);
    const to = page.getXmlFragment(field);
    page.transact(() => {
      to.delete(0, to.length);
      to.insert(
        0,
        from.toArray().map((child) => (child as Y.XmlElement | Y.XmlText).clone()),
      );
    });
  } finally {
    old.destroy();
  }
}
