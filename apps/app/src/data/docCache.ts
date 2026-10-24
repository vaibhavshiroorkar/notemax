import { openLocalDoc, type LocalDoc } from "@notemax/core";
import { docChannelFor, storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { beforeQuit } from "@/platform/quit";

// Opening a doc means reading it from storage, which takes tens of milliseconds
// even for a short note. Docs stay open for a while after their page closes, so
// going back to a note is instant, and a note can start loading while the
// pointer rests on it. An idle doc still gets edits from other windows through
// the channel, so it never goes stale.
//
// Docs of different workspaces can share an id, like "workspace", so each is
// kept under its workspace and id. The workspace defaults to the shown one; a
// page from another workspace names its own.

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

const keyOf = (docId: string, workspace: string) => `${workspace}
${docId}`;

function open(docId: string, workspace: string): Entry {
  const key = keyOf(docId, workspace);
  const entry: Entry = {
    promise: storeFor(workspace).then((store) => openLocalDoc(store, docId, { broadcast: docChannelFor(workspace) })),
    users: 0,
  };
  entry.promise.then(
    (doc) => (entry.doc = doc),
    // A failed open is not kept, so the next try reads storage again.
    () => entries.get(key) === entry && entries.delete(key),
  );
  return entry;
}

function touch(docId: string, workspace: string): Entry {
  const key = keyOf(docId, workspace);
  const entry = entries.get(key) ?? open(docId, workspace);
  entries.delete(key);
  entries.set(key, entry);
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
export function acquireDoc(docId: string, workspace = workspaceNow()): Promise<LocalDoc> {
  const entry = touch(docId, workspace);
  entry.users += 1;
  return entry.promise;
}

export function releaseDoc(docId: string, workspace = workspaceNow()) {
  const entry = entries.get(keyOf(docId, workspace));
  if (!entry) return;
  entry.users -= 1;
  closeExtraIdle();
}

/** Starts loading a doc that is likely to open soon. */
export function prefetchDoc(docId: string, workspace = workspaceNow()) {
  if (entries.has(keyOf(docId, workspace))) return;
  touch(docId, workspace);
  closeExtraIdle();
}

/** The doc, if it is open now. */
export function peekDoc(docId: string, workspace = workspaceNow()): LocalDoc | undefined {
  return entries.get(keyOf(docId, workspace))?.doc;
}

/** Closes a doc for good, before its stored body is erased, so no late save brings any of it back. */
export async function forgetDoc(docId: string, workspace = workspaceNow()) {
  const key = keyOf(docId, workspace);
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  await entry.promise.then((doc) => doc.close()).catch(() => {});
}

// Idle docs may still hold the last batch of keystrokes from a page that just closed.
const flushAll = () => entries.forEach((entry) => void entry.doc?.flush().catch(() => {}));
addEventListener("pagehide", flushAll);
beforeQuit(async () => {
  await Promise.all([...entries.values()].map((entry) => entry.doc?.flush().catch(() => {})));
  // The tree and other docs save in batches a fifth of a second apart; let the last one land.
  await new Promise((resolve) => setTimeout(resolve, 300));
});
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushAll());
