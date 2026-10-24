import { MAIN_WORKSPACE, createMemoryStore, createSqlStore, openIdbStore, scopedStore, type DocStore } from "@notemax/core";
import { getPref, workspaceNow } from "./prefs";

/** True inside the Tauri desktop app, false in a normal browser. */
export const isDesktop = "__TAURI_INTERNALS__" in window;

/** Where windows of one workspace post their saved edits, so the others stay current. */
export const docChannelFor = (workspace: string) => (workspace === MAIN_WORKSPACE ? "notemax-docs" : `notemax-docs@${workspace}`);
/** Where the list of workspaces is shared between windows. */
export const WORKSPACES_CHANNEL = "notemax-workspaces";

// Must match DB_URL in apps/desktop/src-tauri/src/lib.rs, which creates the tables.
const DESKTOP_DB_URL = "sqlite:notemax.db";

/**
 * A device set not to keep pages (Settings, Setup) holds them in memory only,
 * filled from Drive at start. It needs sync, so without it pages stay on disk.
 * Fixed for the session: changing it reloads the app.
 */
export const memoryOnly = getPref("keepLocal") === "0" && getPref("syncOn") === "1";

async function openDiskStore(): Promise<DocStore> {
  if (!isDesktop) return openIdbStore();
  // Loaded only on desktop, so the web build never pulls in Tauri code.
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load(DESKTOP_DB_URL);
  return createSqlStore({
    execute: (sql, params) => db.execute(sql, params),
    select: <T,>(sql: string, params?: unknown[]) => db.select<T[]>(sql, params),
  });
}

let fill: ((store: DocStore) => Promise<void>) | null = null;
/** How a memory-only device gets its pages at start. Sync sets it, so this file needs no sync code. */
export function setMemoryFill(fillFrom: (store: DocStore) => Promise<void>) {
  fill = fillFrom;
}

async function openStore(): Promise<DocStore> {
  if (!memoryOnly) return openDiskStore();
  const store = createMemoryStore();
  if (!fill) throw new Error("This device keeps no pages, and sync is not here to bring them.");
  try {
    await fill(store);
  } catch (error) {
    throw new Error(`Could not get your pages from Google Drive (${error instanceof Error ? error.message : String(error)}). This device keeps no copy of them; check the connection and reload.`);
  }
  return store;
}

/**
 * Erases every page kept on this device's disk, for a device that stops
 * keeping them. The search index goes too, since it holds their text.
 */
export async function eraseDiskStore() {
  const disk = await openDiskStore();
  for (const docId of await disk.list()) await disk.remove(docId);
  if (isDesktop) {
    // SQLite keeps deleted rows in free pages until the file is rebuilt.
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    await (await Database.load(DESKTOP_DB_URL)).execute("VACUUM");
  } else {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("notemax-search");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
}

/** Copies every page from memory to this device's disk, for a device that starts keeping them again. */
export async function keepOnDisk() {
  const memory = await getRawStore();
  const disk = await openDiskStore();
  for (const docId of await memory.list()) {
    const { updates } = await memory.load(docId);
    for (const update of updates) await disk.append(docId, update);
  }
}

let rawPromise: Promise<DocStore> | undefined;
/** The store itself. Sync writes edits from other devices here, so they are not sent back out. */
export const getRawStore = () => (rawPromise ??= openStore());

/** One saved edit: the doc, and the update itself (none when the doc was erased). */
export interface LocalWrite {
  docId: string;
  update?: Uint8Array;
}

const writeListeners = new Set<(write: LocalWrite) => void>();
// Other windows and tabs say what they saved here, so the one that syncs hears of every edit.
const WRITES_CHANNEL = "notemax-writes";
let writes: BroadcastChannel | undefined;

/**
 * Calls `listener` with every edit saved in any window of this app on this
 * device. Sync uses it to know what to send, and live updates send the edit itself.
 */
export function onLocalWrite(listener: (write: LocalWrite) => void): () => void {
  if (!writes) {
    writes = new BroadcastChannel(WRITES_CHANNEL);
    // A window still on an older version posts the doc id alone.
    writes.onmessage = ({ data }: MessageEvent<LocalWrite | string>) => {
      const write = typeof data === "string" ? { docId: data } : data;
      writeListeners.forEach((l) => l(write));
    };
  }
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

function tracked(store: DocStore): DocStore {
  const channel = new BroadcastChannel(WRITES_CHANNEL);
  const tell = (write: LocalWrite) => {
    writeListeners.forEach((listener) => listener(write));
    channel.postMessage(write);
  };
  return {
    load: (docId) => store.load(docId),
    list: () => store.list(),
    // Compaction rewrites what is already there, so it is not an edit.
    compact: (docId, merged, upTo) => store.compact(docId, merged, upTo),
    async append(docId, update) {
      await store.append(docId, update);
      tell({ docId, update });
    },
    async remove(docId) {
      await store.remove(docId);
      tell({ docId });
    },
  };
}

let sharedPromise: Promise<DocStore> | undefined;
/** Every workspace's docs under their stored ids, with edits reported for sync. For the list of workspaces. */
export const getSharedStore = () => (sharedPromise ??= getRawStore().then(tracked));

const scoped = new Map<string, Promise<DocStore>>();
/** One workspace's docs, under the ids the app uses. */
export function storeFor(workspace: string): Promise<DocStore> {
  let store = scoped.get(workspace);
  if (!store) scoped.set(workspace, (store = getSharedStore().then((shared) => scopedStore(shared, workspace))));
  return store;
}

/**
 * The shown workspace's docs, for what acts on the workspace in the sidebar,
 * like making a page. A page from another workspace, open in a tab, uses
 * storeFor with its own workspace instead.
 */
export const getStore = () => storeFor(workspaceNow());

/**
 * Browsers may delete a site's storage when the disk runs low, unless the site
 * asks to keep it. Returns false when the browser refuses. The desktop app
 * writes a normal file on disk, so this risk does not apply there.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (isDesktop) return true;
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}
