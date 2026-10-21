import { openLocalDoc, type LocalDoc } from "@notemax/core";
import { DOC_CHANNEL, getStore } from "@/platform/platform";

// Opening a doc means reading it from storage, which takes tens of milliseconds
// even for a short note. Docs stay open for a while after their page closes, so
// going back to a note is instant, and a note can start loading while the
// pointer rests on it. An idle doc still gets edits from other windows through
// the channel, so it never goes stale.

interface Entry {
  promise: Promise<LocalDoc>;
  /** Set once the promise resolves. */
  doc?: LocalDoc;
  /** Pages showing this doc right now. At zero it is idle and may be closed. */
  users: number;
}

// Kept in use order, oldest first, so the first idle entries are the ones to close.
const entries = new Map<string, Entry>();
const KEEP_IDLE = 8;

function open(docId: string): Entry {
  const entry: Entry = {
    promise: getStore().then((store) => openLocalDoc(store, docId, { broadcast: DOC_CHANNEL })),
    users: 0,
  };
  entry.promise.then(
    (doc) => (entry.doc = doc),
    // A failed open is not kept, so the next try reads storage again.
    () => entries.get(docId) === entry && entries.delete(docId),
  );
  return entry;
}

function touch(docId: string): Entry {
  const entry = entries.get(docId) ?? open(docId);
  entries.delete(docId);
  entries.set(docId, entry);
  return entry;
}

function closeExtraIdle() {
  const idle = [...entries].filter(([, entry]) => entry.users === 0);
  for (const [docId, entry] of idle.slice(0, Math.max(0, idle.length - KEEP_IDLE))) {
    entries.delete(docId);
    void entry.promise.then((doc) => doc.close()).catch(() => {});
  }
}

/** Opens a doc for a page. Pair every call with releaseDoc. */
export function acquireDoc(docId: string): Promise<LocalDoc> {
  const entry = touch(docId);
  entry.users += 1;
  return entry.promise;
}

export function releaseDoc(docId: string) {
  const entry = entries.get(docId);
  if (!entry) return;
  entry.users -= 1;
  closeExtraIdle();
}

/** Starts loading a doc that is likely to open soon. */
export function prefetchDoc(docId: string) {
  if (entries.has(docId)) return;
  touch(docId);
  closeExtraIdle();
}

/** The doc, if it is open now. */
export function peekDoc(docId: string): LocalDoc | undefined {
  return entries.get(docId)?.doc;
}

/** Closes a doc for good, before its stored body is erased, so no late save brings any of it back. */
export async function forgetDoc(docId: string) {
  const entry = entries.get(docId);
  if (!entry) return;
  entries.delete(docId);
  await entry.promise.then((doc) => doc.close()).catch(() => {});
}

// Idle docs may still hold the last batch of keystrokes from a page that just closed.
const flushAll = () => entries.forEach((entry) => void entry.doc?.flush().catch(() => {}));
addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushAll());
