import * as Y from "yjs";
import type { DocStore } from "./store";

export type SaveStatus =
  | { state: "saved" }
  | { state: "saving" }
  | { state: "error"; message: string };

export interface LocalDoc {
  doc: Y.Doc;
  status(): SaveStatus;
  onStatus(listener: (status: SaveStatus) => void): () => void;
  /** Resolves once every edit made so far is on disk. */
  flush(): Promise<void>;
  /** Flushes, then stops saving. The Y.Doc is destroyed. */
  close(): Promise<void>;
}

export interface LocalDocOptions {
  /** How long to gather keystrokes into one write. Also the most a hard crash can lose. */
  batchMs?: number;
  /** Merge stored updates into one when a doc is opened with more than this many. */
  compactAbove?: number;
  /** Delay before retrying a failed write. */
  retryMs?: number;
  /**
   * BroadcastChannel name shared by every window and tab using the same store.
   * Each saved batch is posted on it, so other copies of the doc update live.
   * Leave it out to work alone.
   */
  broadcast?: string;
}

interface DocMessage {
  docId: string;
  update: Uint8Array;
}

const LOADING = Symbol("loading");
// Edits that another window already saved. Applying them must not save them again.
const REMOTE = Symbol("remote");

export async function openLocalDoc(
  store: DocStore,
  docId: string,
  { batchMs = 200, compactAbove = 100, retryMs = 2000, broadcast }: LocalDocOptions = {},
): Promise<LocalDoc> {
  const doc = new Y.Doc();

  // Listen before loading. A batch saved while we read the store might
  // otherwise be in neither the load nor the channel. Overlap is harmless,
  // because Yjs skips edits it already has.
  const channel = broadcast ? new BroadcastChannel(broadcast) : undefined;
  let early: Uint8Array[] | undefined = [];
  if (channel) {
    channel.onmessage = ({ data }: MessageEvent<DocMessage>) => {
      if (data.docId !== docId) return;
      if (early) early.push(data.update);
      else Y.applyUpdate(doc, data.update, REMOTE);
    };
  }

  let loaded: Awaited<ReturnType<DocStore["load"]>>;
  try {
    loaded = await store.load(docId);
  } catch (err) {
    channel?.close();
    throw err;
  }
  const { updates, lastSeq } = loaded;
  if (updates.length) Y.applyUpdate(doc, Y.mergeUpdates(updates), LOADING);
  early.forEach((update) => Y.applyUpdate(doc, update, REMOTE));
  early = undefined;

  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();
  let status: SaveStatus = { state: "saved" };
  const listeners = new Set<(s: SaveStatus) => void>();

  const setStatus = (next: SaveStatus) => {
    status = next;
    listeners.forEach((listener) => listener(next));
  };

  // Writes run one at a time, so batches reach the disk in the order they were typed.
  const writeBatch = () => {
    timer = undefined;
    writing = writing.then(async () => {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      try {
        const merged = Y.mergeUpdates(batch);
        await store.append(docId, merged);
        // Only after the write: others must never build on edits that could still be lost.
        channel?.postMessage({ docId, update: merged } satisfies DocMessage);
        setStatus(pending.length ? { state: "saving" } : { state: "saved" });
      } catch (err) {
        // Keep the edits in memory and try again. Never drop them.
        pending = [...batch, ...pending];
        setStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
        timer ??= setTimeout(writeBatch, retryMs);
      }
    });
    return writing;
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === LOADING || origin === REMOTE) return;
    pending.push(update);
    if (status.state !== "error") setStatus({ state: "saving" });
    timer ??= setTimeout(writeBatch, batchMs);
  };
  doc.on("update", onUpdate);

  // Compaction runs after the doc is usable, so it never slows down opening.
  if (updates.length > compactAbove) {
    store.compact(docId, Y.mergeUpdates(updates), lastSeq).catch((err) => {
      console.warn(`[notemax] compaction of ${docId} failed, will retry next open`, err);
    });
  }

  const flush = async () => {
    if (timer) clearTimeout(timer);
    await writeBatch();
    if (pending.length) throw new Error(status.state === "error" ? status.message : "unsaved edits remain");
  };

  return {
    doc,
    status: () => status,
    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush,
    async close() {
      doc.off("update", onUpdate);
      try {
        await flush();
      } finally {
        channel?.close();
        doc.destroy();
      }
    },
  };
}
