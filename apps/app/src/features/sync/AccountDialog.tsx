import { useEffect } from "react";
import { AccountSection } from "@/features/account/Account";
import { accountView, watchAccount } from "@/features/account/session";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { ProfileCard } from "@/features/community/ProfileCard";
import { registry } from "@/plugins/registry";
import { SyncSection } from "./SyncSection";
import { onlineMode, type Mode } from "@/platform/mode";
import { accountsEnabled } from "@/features/account/config";
import { Segmented } from "@/ui/Segmented";

/**
 * The window the account bar opens: sign in, then sync, without going
 * through Settings. A sign-in that came back with an error passes it in.
 */
export function AccountDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const account = accountView.use();
  const mode = onlineMode.use();
  const online = mode !== "offline";
  useEffect(() => {
    if (online && accountsEnabled) void watchAccount().catch(() => {});
  }, [online]);

  return (
    <Dialog label="Account" onClose={onClose} className="account-dialog">
      <header className="settings-header">
        <h2 className="dialog-title">Account</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="account-dialog-body">
      <section className="account-mode">
        <div>
          <h3>This device</h3>
          <p className="settings-description">{online ? "Online features are available. Sign in to sync and share." : "Online features are off. Your pages stay on this device."}</p>
        </div>
        <Segmented<Mode> label="Device mode" value={mode ?? "online"} options={[{ value: "offline", label: "Offline" }, { value: "online", label: "Online" }]} onChange={(value) => onlineMode.set(value)} />
      </section>
      {online && accountsEnabled && <section className="account-dialog-sync"><AccountSection accountError={typeof options.error === "string" ? options.error : undefined} compact /></section>}
      {online && account.state === "in" && registry.isOn("community") && (
        <section className="account-dialog-sync">
          <h3>Community profile</h3>
          <ProfileCard />
        </section>
      )}
      {online && account.state === "in" && registry.isOn("sync") && (
        <section className="account-dialog-sync">
          <h3>Sync</h3>
          <SyncSection />
        </section>
      )}
      </div>
      <button
        className="link-button"
        onClick={() => {
          onClose();
          app.openSettings();
        }}
      >
        <Icon name="gear" />
        All settings
      </button>
    </Dialog>
  );
}
