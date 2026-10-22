import { accountsEnabled } from "@/features/account/config";
import { getPref } from "@/platform/prefs";
import type { AppContext, Plugin } from "@/plugins/types";
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

export const syncPlugin: Plugin = {
  id: "sync",
  name: "Sync",
  description: "Your notes on every device, through your own Google Drive",
  settings: [{ id: "sync", order: 45, title: "Sync", icon: "upload", keywords: ["google drive", "devices", "backup", "passphrase", "phone"], when: () => accountsEnabled, component: SyncSection }],
  statusItems: [{ id: "sync.status", component: SyncStatus }],
  commands: [{ id: "sync.now", title: "Sync now", keywords: ["drive", "upload", "devices"], when: () => syncView.get().state !== "off", run: syncNow }],
  start() {
    // Only the main window syncs. Quick capture hands its notes over through the doc channel.
    if (accountsEnabled && getPref("syncOn") === "1") startSync();
  },
};
