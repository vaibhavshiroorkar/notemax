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
}

const LOADING = Symbol("loading");

export async function openLocalDoc(
  store: DocStore,
  docId: string,
  { batchMs = 200, compactAbove = 100, retryMs = 2000 }: LocalDocOptions = {},
): Promise<LocalDoc> {
  const doc = new Y.Doc();
  const { updates, lastSeq } = await store.load(docId);
  if (updates.length) Y.applyUpdate(doc, Y.mergeUpdates(updates), LOADING);

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
        await store.append(docId, Y.mergeUpdates(batch));
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
    if (origin === LOADING) return;
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
        doc.destroy();
      }
    },
  };
}
