import { accountsEnabled } from "@/features/account/config";
import { startAccount } from "@/features/account/session";
import { getPref } from "@/platform/prefs";
import type { AppContext, Plugin } from "@/plugins/types";
import { AccountBar } from "./AccountBar";
import { AccountDialog } from "./AccountDialog";
import { useEffect, useRef } from "react";
import { ConflictDialog, ConflictLine, conflicts } from "./conflicts";
import { remoteEdit } from "./live";
import { SyncSection, describe } from "./SyncSection";
import { startSync, syncNow, syncView } from "./runtime";

/** "Synced just now" in the status bar. A click opens the Sync settings. */
function SyncStatus({ app }: { app: AppContext }) {
  const view = syncView.use();
  if (view.state === "off") return null;
  const label = view.state === "offline" ? "Offline" : view.state === "error" ? "Sync stopped" : describe(view);
  return (
    <button className="status-sync" data-state={view.state} title={describe(view)} onClick={() => app.openSettings("sync")}>
      {label}
    </button>
  );
}

// Once in a while is enough: a steady stream of toasts while someone types elsewhere would only distract.
const NOTICE_EVERY_MS = 20_000;

/**
 * A small notice when another device changes the open page. The page itself
 * merges the edit in place, with the cursor where it was, so there is nothing
 * to do but know.
 */
function RemoteEditNotice({ app }: { app: AppContext }) {
  const latest = useRef(app);
  latest.current = app;
  useEffect(() => {
    let last = 0;
    return remoteEdit.subscribe(() => {
      const edit = remoteEdit.get();
      if (!edit || edit.docId !== latest.current.activeId || edit.at - last < NOTICE_EVERY_MS) return;
      last = edit.at;
      latest.current.notify("Updated from another device");
    });
  }, []);
  return null;
}

export const syncPlugin: Plugin = {
  id: "sync",
  name: "Sync",
  online: true,
  description: "Your notes on every device, through your own Google Drive",
  settings: [{ id: "sync", order: 45, title: "Sync", icon: "upload", keywords: ["google drive", "devices", "backup", "passphrase", "phone"], when: () => accountsEnabled, component: SyncSection }],
  statusItems: [
    { id: "sync.status", component: SyncStatus },
    { id: "sync.notice", component: RemoteEditNotice },
  ],
  // A build without Supabase settings has no accounts, so the footer keeps its plain Settings button.
  sidebarFooter: accountsEnabled ? [{ id: "sync.account", component: AccountBar }] : [],
  overlays: [
    { id: "account", component: AccountDialog },
    { id: "sync.conflict", component: ConflictDialog },
  ],
  pageHeader: [{ id: "sync.conflict", kinds: ["note"], component: ConflictLine }],
  commands: [
    { id: "sync.now", title: "Sync now", keywords: ["drive", "upload", "devices"], when: () => syncView.get().state !== "off", run: syncNow },
    { id: "sync.account", title: "Account and sync", keywords: ["sign in", "google", "drive", "devices"], when: () => accountsEnabled, run: (app) => app.openOverlay("account") },
  ],
  start(app) {
    startAccount();
    // A new question gets a toast; the line under the note's title stays until it is answered.
    let known = new Set(conflicts.get().map((c) => c.pageId + c.time));
    conflicts.subscribe(() => {
      for (const c of conflicts.get()) {
        if (known.has(c.pageId + c.time)) continue;
        const title = app.tree.byId.get(c.pageId)?.title || "Untitled";
        app.notify(`"${title}" changed on two devices. Both changes are kept.`, { label: "Review", run: () => app.openOverlay("sync.conflict", { pageId: c.pageId }) });
      }
      known = new Set(conflicts.get().map((c) => c.pageId + c.time));
    });
    // Only the main window syncs. Quick capture hands its notes over through the doc channel.
    if (accountsEnabled && getPref("syncOn") === "1") startSync();
  },
};
