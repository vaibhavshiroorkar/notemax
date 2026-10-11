import { useEffect, useState } from "react";
import { createSqlStore, openIdbStore, openLocalDoc, type DocStore, type LocalDoc, type SaveStatus } from "@notemax/core";

/** True inside the Tauri desktop app, false in a normal browser. */
export const isDesktop = "__TAURI_INTERNALS__" in window;

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
const getStore = () => (storePromise ??= openStore());

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

export function useLocalDoc(docId: string) {
  const [local, setLocal] = useState<LocalDoc | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const [openError, setOpenError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let opened: LocalDoc | undefined;
    let unsubscribe = () => {};

    getStore()
      .then((store) => openLocalDoc(store, docId))
      .then((doc) => {
        // React may unmount before the doc finishes opening (StrictMode does this on purpose).
        if (cancelled) return void doc.close();
        opened = doc;
        unsubscribe = doc.onStatus(setStatus);
        setLocal(doc);
      })
      .catch((err) => setOpenError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      unsubscribe();
      void opened?.close();
      setLocal(null);
    };
  }, [docId]);

  useEffect(() => {
    if (!local) return;
    // Write pending edits right away when the tab is hidden or closed, instead of
    // waiting for the batch timer.
    const flushNow = () => void local.flush().catch(() => {});
    const onVisibility = () => document.visibilityState === "hidden" && flushNow();
    // Ask the browser to confirm closing the tab while edits are not on disk yet.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (local.status().state !== "saved") event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [local]);

  return { local, status, openError };
}
