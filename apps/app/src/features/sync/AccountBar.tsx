import { accountView } from "@/features/account/session";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { ago } from "./SyncSection";
import { syncNow, syncView, type SyncView } from "./runtime";
import "./account-bar.css";

/** The second line under the name: how sync is going, in a few words. */
function syncLine(view: SyncView): string {
  switch (view.state) {
    case "off":
      return "Sync is off";
    case "elsewhere":
      return "Syncing in another tab";
    case "syncing":
      return view.total && view.total > 3 ? `Syncing ${view.done ?? 0} of ${view.total}` : "Syncing...";
    case "idle":
      return `Synced ${ago(view.lastSynced)}`;
    case "offline":
      return "Offline";
    case "error":
      return "Sync stopped";
  }
}

/**
 * The account at the bottom left, like Discord's: who is signed in and how
 * sync is going. A click opens the account window, the arrows sync at once.
 */
export function AccountBar({ app }: { app: AppContext }) {
  const account = accountView.use();
  const view = syncView.use();
  const open = () => app.openOverlay("account");

  if (account.state !== "in") {
    return (
      <button className="account-bar" onClick={open} disabled={account.state === "loading"}>
        <span className="account-bar-avatar">
          <Icon name="user" />
        </span>
        <span className="account-bar-text">
          <strong>Sign in</strong>
          <span>Sync your devices</span>
        </span>
      </button>
    );
  }

  const busy = view.state === "syncing" || view.state === "elsewhere";
  return (
    <>
      <button className="account-bar" onClick={open} title={account.email}>
        <span className="account-bar-avatar" data-sync={view.state}>
          {account.avatar ? <img src={account.avatar} alt="" referrerPolicy="no-referrer" /> : account.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-bar-text">
          <strong>{account.name}</strong>
          <span data-state={view.state}>{syncLine(view)}</span>
        </span>
      </button>
      {view.state !== "off" && (
        <button className="footer-icon sync-now" aria-label="Sync now" title="Sync now" onClick={syncNow} disabled={busy} data-busy={busy || undefined}>
          <Icon name="sync" />
        </button>
      )}
    </>
  );
}
