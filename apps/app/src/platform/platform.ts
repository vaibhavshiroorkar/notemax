import { createSqlStore, openIdbStore, type DocStore } from "@notemax/core";

/** True inside the Tauri desktop app, false in a normal browser. */
export const isDesktop = "__TAURI_INTERNALS__" in window;

/** Every window and tab posts its saved edits here, so the others stay current. */
export const DOC_CHANNEL = "notemax-docs";

// Must match DB_URL in apps/desktop/src-tauri/src/lib.rs, which creates the tables.
const DESKTOP_DB_URL = "sqlite:notemax.db";

async function openStore(): Promise<DocStore> {
  if (!isDesktop) return openIdbStore();
  // Loaded only on desktop, so the web build never pulls in Tauri code.
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load(DESKTOP_DB_URL);
  return createSqlStore({
    execute: (sql, params) => db.execute(sql, params),
    select: <T,>(sql: string, params?: unknown[]) => db.select<T[]>(sql, params),
  });
}

let rawPromise: Promise<DocStore> | undefined;
/** The store itself. Sync writes edits from other devices here, so they are not sent back out. */
export const getRawStore = () => (rawPromise ??= openStore());

const writeListeners = new Set<(docId: string) => void>();
// Other windows and tabs say what they saved here, so the one that syncs hears of every edit.
const WRITES_CHANNEL = "notemax-writes";
let writes: BroadcastChannel | undefined;

/**
 * Calls `listener` with the doc id of every edit saved in any window of this
 * app on this device. Sync uses it to know what to send.
 */
export function onLocalWrite(listener: (docId: string) => void): () => void {
  if (!writes) {
    writes = new BroadcastChannel(WRITES_CHANNEL);
    writes.onmessage = ({ data }: MessageEvent<string>) => writeListeners.forEach((l) => l(data));
  }
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

function tracked(store: DocStore): DocStore {
  const channel = new BroadcastChannel(WRITES_CHANNEL);
  const tell = (docId: string) => {
    writeListeners.forEach((listener) => listener(docId));
    channel.postMessage(docId);
  };
  return {
    load: (docId) => store.load(docId),
    list: () => store.list(),
    // Compaction rewrites what is already there, so it is not an edit.
    compact: (docId, merged, upTo) => store.compact(docId, merged, upTo),
    async append(docId, update) {
      await store.append(docId, update);
      tell(docId);
    },
    async remove(docId) {
      await store.remove(docId);
      tell(docId);
    },
  };
}

let storePromise: Promise<DocStore> | undefined;
/** The store everything in the app saves to. */
export const getStore = () => (storePromise ??= getRawStore().then(tracked));

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
