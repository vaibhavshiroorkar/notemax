import { openLocalDoc, type LocalDoc, type SaveStatus } from "@notemax/core";
import { docChannelFor, storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { beforeQuit } from "@/platform/quit";
import { createStore } from "@/platform/store";

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
  workspace: string;
  docId: string;
  promise: Promise<LocalDoc>;
  /** Set once the promise resolves. */
  doc?: LocalDoc;
  /** Pages showing this doc right now. At zero it is idle and may be closed. */
  users: number;
}

// Kept in use order, oldest first, so the first idle entries are the ones to close.
const entries = new Map<string, Entry>();
const KEEP_IDLE = 8;

/**
 * The least saved of every doc open in this window. A page shows subtopics
 * and other pages' text in editors of their own, so the page's own doc
 * saying Saved is not enough: one of those may still be saving, or failing.
 */
export const openDocsStatus = createStore<SaveStatus>({ state: "saved" });
const severity: Record<SaveStatus["state"], number> = { saved: 0, saving: 1, error: 2 };

function recount() {
  let worst: SaveStatus = { state: "saved" };
  for (const entry of entries.values()) {
    const status = entry.doc?.status();
    if (status && severity[status.state] > severity[worst.state]) worst = status;
  }
  const now = openDocsStatus.get();
  if (worst.state !== now.state || (worst.state === "error" && now.state === "error" && worst.message !== now.message)) openDocsStatus.set(worst);
}

type OpenHook = (workspace: string, docId: string, doc: LocalDoc) => void;
const openHooks = new Set<OpenHook>();

/** Calls `hook` for every doc open now and every doc opened from now on, until the returned function is called. */
export function onDocOpen(hook: OpenHook): () => void {
  openHooks.add(hook);
  for (const entry of entries.values()) if (entry.doc) hook(entry.workspace, entry.docId, entry.doc);
  return () => openHooks.delete(hook);
}

const keyOf = (docId: string, workspace: string) => `${workspace}
${docId}`;

function open(docId: string, workspace: string): Entry {
  const key = keyOf(docId, workspace);
  const entry: Entry = {
    workspace,
    docId,
    promise: storeFor(workspace).then((store) => openLocalDoc(store, docId, { broadcast: docChannelFor(workspace) })),
    users: 0,
  };
  entry.promise.then(
    (doc) => {
      entry.doc = doc;
      doc.onStatus(recount);
      openHooks.forEach((hook) => hook(workspace, docId, doc));
    },
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
  // A doc still saving, or failing to, stays open until its edits are on disk.
  const idle = [...entries].filter(([, entry]) => entry.users === 0 && (entry.doc?.status().state ?? "saved") === "saved");
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

/** True when the doc is open, or opening, in this window. */
export const isCached = (docId: string, workspace = workspaceNow()) => entries.has(keyOf(docId, workspace));

/** The doc, if it is open now. */
export function peekDoc(docId: string, workspace = workspaceNow()): LocalDoc | undefined {
  return entries.get(keyOf(docId, workspace))?.doc;
}

/** Closes a doc and lets go of it, as locking does to keep its text out of memory. Its edits are saved first. */
export async function forgetDoc(docId: string, workspace = workspaceNow()) {
  const key = keyOf(docId, workspace);
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  await entry.promise.then((doc) => doc.close()).catch(() => {});
  recount();
}

/** Docs about to be erased: some of one workspace, or all of it when `docIds` is null. */
interface Erased {
  workspace: string;
  docIds: string[] | null;
}

function dropHere({ workspace, docIds }: Erased) {
  for (const [key, entry] of entries) {
    if (entry.workspace !== workspace || (docIds && !docIds.includes(entry.docId))) continue;
    entries.delete(key);
    void entry.promise.then((doc) => doc.discard()).catch(() => {});
  }
  recount();
}

// Every window stops its copies, or a late save in one of them would bring erased text back.
const erasing = new BroadcastChannel("notemax-erasing");
erasing.onmessage = ({ data }: MessageEvent<Erased>) => dropHere(data);

/**
 * Stops every open copy of these docs at once, in this window and the others,
 * dropping what they had not saved, before their stored bodies are erased.
 */
export function discardDocs(workspace: string, docIds: readonly string[] | null) {
  const erased: Erased = { workspace, docIds: docIds && [...docIds] };
  dropHere(erased);
  erasing.postMessage(erased);
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
