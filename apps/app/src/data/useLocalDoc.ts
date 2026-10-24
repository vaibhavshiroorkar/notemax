import { useEffect, useState } from "react";
import type { LocalDoc, SaveStatus } from "@notemax/core";
import { acquireDoc, releaseDoc } from "./docCache";
import { usePageWorkspace } from "./scope";

/** Opens a doc while the component is on screen: of the page's workspace, unless one is named. */
export function useLocalDoc(docId: string, named?: string) {
  const scoped = usePageWorkspace();
  const workspace = named ?? scoped;
  const [local, setLocal] = useState<LocalDoc | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const [openError, setOpenError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    acquireDoc(docId, workspace)
      .then((doc) => {
        // React may unmount before the doc finishes opening (StrictMode does this on purpose).
        if (cancelled) return;
        unsubscribe = doc.onStatus(setStatus);
        setStatus(doc.status());
        setLocal(doc);
      })
      .catch((err) => !cancelled && setOpenError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      unsubscribe();
      // The cache keeps the doc open a while, so coming back to it is instant.
      releaseDoc(docId, workspace);
      setLocal(null);
    };
  }, [docId, workspace]);

  // Ask the browser to confirm closing the tab while edits are not on disk yet.
  // The cache writes them right away when the tab is hidden or closed.
  useEffect(() => {
    if (!local) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (local.status().state !== "saved") event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [local]);

  return { local, status, openError };
}
