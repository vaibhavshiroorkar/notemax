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

let storePromise: Promise<DocStore> | undefined;
export const getStore = () => (storePromise ??= openStore());

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
