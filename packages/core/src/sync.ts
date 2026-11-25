import * as Y from "yjs";
import { open, seal } from "./crypt";
import { isHistoryDocId } from "./history";
import type { DocStore } from "./store";
import { WORKSPACE_DOC_ID } from "./workspace";
import { splitScoped } from "./workspaces";

// Sync through a folder of files that every device can read, like a folder in
// the user's Google Drive. Each device writes only its own files: one per doc,
// holding everything that device has of the doc. Others read those files and
// merge them in with Yjs. Since no device ever overwrites another's file, two
// devices editing the same note offline both keep their text.

/** One device's file for one doc, as the remote lists it. */
export interface RemoteEntry {
  docId: string;
  device: string;
  /** Whatever the remote needs to read the file again, like a Drive file id. */
  ref: string;
}

export interface SyncRemote {
  /** Files written since `cursor`, or every file when it is null, and the cursor for next time. */
  changes(cursor: string | null): Promise<{ entries: RemoteEntry[]; cursor: string }>;
  read(ref: string): Promise<Uint8Array>;
  /** Writes this device's file for a doc, replacing its last one. */
  write(docId: string, data: Uint8Array): Promise<void>;
  /** Removes this device's file for a doc. */
  remove(docId: string): Promise<void>;
  /** The docs this device has a file for. Lets a device find docs it never sent. */
  listMine?(): Promise<string[]>;
}

/** What a device keeps between runs. */
export interface SyncState {
  /** Where reading the remote's changes left off. */
  cursor: string | null;
  /** Docs with edits made here that have not reached the remote yet. */
  dirty: string[];
  /**
   * Later docs other devices wrote that are not downloaded yet, by doc: the
   * newest file of each device. They come down when asked for, with fetch.
   */
  waiting?: Record<string, RemoteEntry[]>;
}

export type SyncStatus =
  | { state: "idle"; lastSynced: number | null }
  /** `done` of `total` files read or sent so far, while there are any. */
  | { state: "syncing"; lastSynced: number | null; done?: number; total?: number }
  | { state: "error"; lastSynced: number | null; message: string };

export interface SyncEngineOptions {
  /** The local store, written to directly so that merged-in edits are not sent back out. */
  store: DocStore;
  remote: SyncRemote;
  key: CryptoKey;
  device: string;
  loadState(): SyncState;
  saveState(state: SyncState): void;
  /** Called with each update that came in, so pages that are open merge it at once. */
  onRemoteUpdate(docId: string, update: Uint8Array): void;
  /**
   * A page this device edited and had not sent yet was edited on another
   * device too. Both edits are merged and kept; `mine` and `theirs` are each
   * side as it was, so the person can be asked which to keep.
   */
  onConflict?(docId: string, mine: Uint8Array, theirs: Uint8Array): void;
  onStatus?(status: SyncStatus): void;
  /**
   * Docs that can wait, like version history: an ordinary run neither sends
   * nor downloads them, so edits to pages go out without waiting behind them.
   */
  isLater?(docId: string): boolean;
}

export interface SyncEngine {
  /** A doc changed on this device. It is sent on the next sync. */
  markDirty(docId: string): void;
  /** Marks every local doc as changed, so all of them are sent. Used when sync is turned on. */
  markAllDirty(): Promise<void>;
  /**
   * Marks for sending the docs this device has that the remote has no file of
   * its for, plus `also`. Finds edits whose mark was lost, as when the app was
   * closed by force right after an edit, before the mark was saved.
   */
  catchUp(also?: string[]): Promise<void>;
  /**
   * Reads what other devices wrote, then sends this device's edits. Runs one
   * at a time. Later docs are sent only with `later`.
   */
  sync(options?: { later?: boolean }): Promise<void>;
  /** Downloads a later doc that waits on the remote. False when none waited. */
  fetch(docId: string): Promise<boolean>;
  /** Whether a later doc has edits that are not sent yet. */
  hasLater(): boolean;
  status(): SyncStatus;
}

// Only page bodies can clash in a way worth asking about. The tree merges
// field by field, pictures never change, and versions only add up.
// The list of workspaces belongs to none of them, and is no page either.
const isPageBody = (stored: string) => {
  const { workspace, docId } = splitScoped(stored);
  return workspace !== null && docId !== WORKSPACE_DOC_ID && !docId.startsWith("asset:") && !isHistoryDocId(docId);
};

/** How many files move at once. Each Drive request takes a second or two however small, and ten at once take about as long as one. */
const PARALLEL = 10;

interface Counter {
  add(n: number): void;
  tick(): void;
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { store, remote, key, device } = options;
  const isLater = options.isLater ?? (() => false);
  // Reading and sending share one limit, so running both never doubles the requests in flight.
  const gate = limiter(PARALLEL);
  let state = options.loadState();
  // Docs edited again since their send started. They stay dirty after it.
  const edited = new Set<string>();
  let status: SyncStatus = { state: "idle", lastSynced: null };
  let running: Promise<void> = Promise.resolve();

  const setStatus = (next: SyncStatus) => {
    status = next;
    options.onStatus?.(next);
  };
  const progress = (done: number, total: number) => setStatus({ state: "syncing", lastSynced: status.lastSynced, done, total });
  const save = (next: SyncState) => {
    state = next;
    options.saveState(next);
  };

  /** Everything the store has of a doc as one update, or null when it has nothing. */
  async function localUpdate(docId: string): Promise<Uint8Array | null> {
    const { updates } = await store.load(docId);
    return updates.length ? Y.mergeUpdates(updates) : null;
  }

  /**
   * Reads what other devices wrote. `wasDirty` is what this device had unsent
   * when the run began: sending runs alongside, so by the time a file comes in
   * its own edits may already be out, and they still count for the question.
   */
  async function pull(wasDirty: ReadonlySet<string>, count: Counter) {
    const { entries, cursor } = await remote.changes(state.cursor);
    // One question per page per sync, however many files came in for it.
    const reported = new Set<string>();
    // Docs in parallel, but one doc's files from several devices in turn, so each diff sees the last.
    const byDoc = new Map<string, RemoteEntry[]>();
    // A read from the start takes this device's own files too: a device that
    // keeps no pages, or lost its store, would otherwise miss what only it
    // wrote, then send its empty state over that file.
    const fromStart = state.cursor === null;
    // Later docs are only noted, not downloaded.
    const noted: RemoteEntry[] = [];
    for (const entry of entries) {
      if (entry.device === device && !fromStart) continue;
      if (isLater(entry.docId)) noted.push(entry);
      else byDoc.set(entry.docId, [...(byDoc.get(entry.docId) ?? []), entry]);
    }
    const docs = [...byDoc.values()];
    count.add(docs.length);
    await inParallel(docs, async (files) => {
      await merge(files, (docId) => wasDirty.has(docId) || state.dirty.includes(docId), reported);
      count.tick();
    });
    // Only after every file was merged: a failure part way reads them all again next time,
    // which is harmless because merging the same edits twice changes nothing.
    // Onto the waiting list as it is now, since a send may have fetched some meanwhile.
    const waiting = { ...state.waiting };
    for (const entry of noted) {
      // A device's newer file holds all of its older one.
      waiting[entry.docId] = [...(waiting[entry.docId] ?? []).filter((e) => e.device !== entry.device), entry];
    }
    save({ ...state, cursor, waiting });
  }

  /**
   * Downloads one doc's files from one or more devices and merges them in
   * turn, so each diff sees the last. `dirty` says whether this device has
   * unsent edits to the doc, which makes a clash worth asking about.
   */
  async function merge(files: RemoteEntry[], dirty: (docId: string) => boolean, reported = new Set<string>()) {
    // Downloaded side by side, since each request mostly waits on the network. Merged in turn.
    const sealed = await Promise.all(files.map((entry) => gate(() => remote.read(entry.ref))));
    for (const [i, entry] of files.entries()) {
      const incoming = await open(key, sealed[i]);
      const local = await localUpdate(entry.docId);
      // Only what this device lacks, so the store does not grow by a whole copy on every sync.
      const fresh = local ? Y.diffUpdate(incoming, Y.encodeStateVectorFromUpdate(local)) : incoming;
      if (local && isEmptyUpdate(fresh, local)) continue;
      // This device's own file is an older copy of its own edits, never a conflict.
      if (local && entry.device !== device && isPageBody(entry.docId) && dirty(entry.docId) && !reported.has(entry.docId)) {
        reported.add(entry.docId);
        options.onConflict?.(entry.docId, local, incoming);
      }
      await store.append(entry.docId, fresh);
      options.onRemoteUpdate(entry.docId, fresh);
    }
  }

  /** Merges what waits of a later doc and forgets it. False when nothing waited. */
  async function fetchWaiting(docId: string): Promise<boolean> {
    const files = state.waiting?.[docId];
    if (!files?.length) return false;
    await merge(files, () => false);
    // Read again: a run may have noted a newer file while these downloaded.
    const left = (state.waiting?.[docId] ?? []).filter((e) => !files.some((f) => f.ref === e.ref && f.device === e.device));
    const waiting = { ...state.waiting };
    if (left.length) waiting[docId] = left;
    else delete waiting[docId];
    save({ ...state, waiting });
    return true;
  }

  async function push(count: Counter, later: boolean) {
    const dirty = state.dirty.filter((docId) => later || !isLater(docId));
    count.add(dirty.length);
    await inParallel(dirty, async (docId) => {
      // This device's file replaces its last one, so it must hold all that one did,
      // even when that was never downloaded here, as after a reinstall.
      // Any doc with files waiting, since an engine that sends versions at once may follow one that left them.
      if (state.waiting?.[docId]?.length) await fetchWaiting(docId);
      edited.delete(docId);
      const update = await localUpdate(docId);
      if (update) {
        const sealed = await seal(key, update);
        await gate(() => remote.write(docId, sealed));
      } else await gate(() => remote.remove(docId));
      if (!edited.has(docId)) save({ ...state, dirty: state.dirty.filter((id) => id !== docId) });
      count.tick();
    });
  }

  /** One count of files for a whole run, so reading and sending side by side show one number. */
  const counter = (): Counter => {
    let done = 0;
    let total = 0;
    return {
      add(n) {
        if (!n) return;
        total += n;
        progress(done, total);
      },
      tick: () => progress(++done, total),
    };
  };

  return {
    markDirty(docId) {
      edited.add(docId);
      if (!state.dirty.includes(docId)) save({ ...state, dirty: [...state.dirty, docId] });
    },
    async markAllDirty() {
      const all = await store.list();
      save({ ...state, dirty: [...new Set([...state.dirty, ...all])] });
    },
    async catchUp(also = []) {
      const sent = remote.listMine ? new Set(await remote.listMine()) : null;
      const unsent = sent ? (await store.list()).filter((docId) => !sent.has(docId)) : [];
      const marks = [...unsent, ...also].filter((docId) => !state.dirty.includes(docId));
      if (marks.length) save({ ...state, dirty: [...state.dirty, ...new Set(marks)] });
    },
    sync({ later = false } = {}) {
      // After the last run, whether it worked or not: a failed run must not stop every later one.
      running = running.catch(() => {}).then(async () => {
        setStatus({ state: "syncing", lastSynced: status.lastSynced });
        try {
          const count = counter();
          const wasDirty = new Set(state.dirty);
          if (state.cursor === null) {
            // From nothing, this device's own files must come back before it
            // sends: a store that lost a page would otherwise erase its file.
            await pull(wasDirty, count);
            await push(count, later);
          } else {
            // Both mostly wait on the network, so an edit goes out without
            // waiting for the read, and a failed read does not hold it back.
            const results = await Promise.allSettled([pull(wasDirty, count), push(count, later)]);
            const failed = results.find((result) => result.status === "rejected");
            if (failed) throw failed.reason;
          }
          setStatus({ state: "idle", lastSynced: Date.now() });
        } catch (err) {
          setStatus({ state: "error", lastSynced: status.lastSynced, message: err instanceof Error ? err.message : String(err) });
          throw err;
        }
      });
      return running;
    },
    fetch(docId) {
      // In line with the runs, so a send never starts from half of what is downloading.
      const result = running.catch(() => {}).then(() => fetchWaiting(docId));
      running = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    hasLater: () => state.dirty.some(isLater),
    status: () => status,
  };
}

/** Runs each task given to it, at most `slots` at a time, the rest in the order they came. */
function limiter(slots: number) {
  let busy = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (busy >= slots) await new Promise<void>((resolve) => waiting.push(resolve));
    else busy++;
    try {
      return await task();
    } finally {
      // The slot passes straight to the next task, so busy only drops when none waits.
      const next = waiting.shift();
      if (next) next();
      else busy--;
    }
  };
}

/**
 * Runs `work` on every item, up to `limit` at a time. After a failure it starts
 * no more, waits for the ones running, and throws the first error.
 */
export async function inParallel<T>(items: T[], work: (item: T) => Promise<void>, limit = PARALLEL) {
  let next = 0;
  let failure: { error: unknown } | null = null;
  const worker = async () => {
    while (!failure && next < items.length) {
      try {
        await work(items[next++]);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw (failure as { error: unknown }).error;
}

/**
 * Whether merging `update` into a doc whose state is `local` would change
 * nothing: no new items and no deletions it does not already have.
 */
function isEmptyUpdate(update: Uint8Array, local: Uint8Array): boolean {
  const before = new Y.Doc();
  Y.applyUpdate(before, local);
  const vector = Y.encodeStateVector(before);
  let changed = false;
  before.on("update", () => (changed = true));
  Y.applyUpdate(before, update);
  // A state vector only counts items. Deletions show up as an update event.
  return !changed && sameBytes(vector, Y.encodeStateVector(before));
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
