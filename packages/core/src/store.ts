/**
 * Where each document's Yjs updates are kept on this device.
 * The browser uses IndexedDB and the desktop app will use SQLite; both follow
 * this contract so the rest of the app does not care which one it gets.
 *
 * Updates are append-only. Nothing is ever overwritten in place, so a failed
 * or interrupted write can lose at most that one write, never older text.
 * The only way to erase a doc is `remove`, used when a note is deleted forever.
 */
export interface DocStore {
  /** All stored updates for a doc, oldest first, plus the seq of the newest one (0 if none). */
  load(docId: string): Promise<{ updates: Uint8Array[]; lastSeq: number }>;

  /** Append one update. The data is on disk once the promise resolves. */
  append(docId: string, update: Uint8Array): Promise<void>;

  /**
   * Replace the updates with seq <= upToSeq by one merged update.
   * Updates appended after `upToSeq` (for example by another tab) are kept,
   * which is what makes compaction safe to run while edits are still arriving.
   */
  compact(docId: string, merged: Uint8Array, upToSeq: number): Promise<void>;

  /** Erase every update of a doc. */
  remove(docId: string): Promise<void>;
}
