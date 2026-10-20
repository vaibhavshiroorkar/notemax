import { useEffect, useState } from "react";
import { openLocalDoc, type LocalDoc, type SaveStatus } from "@notemax/core";
import { DOC_CHANNEL, getStore } from "@/platform/platform";

export function useLocalDoc(docId: string) {
  const [local, setLocal] = useState<LocalDoc | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const [openError, setOpenError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let opened: LocalDoc | undefined;
    let unsubscribe = () => {};

    getStore()
      .then((store) => openLocalDoc(store, docId, { broadcast: DOC_CHANNEL }))
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
