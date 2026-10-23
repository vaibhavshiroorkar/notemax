import { useEffect } from "react";
import { AccountSection } from "@/features/account/Account";
import { accountView, watchAccount } from "@/features/account/session";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { ProfileCard } from "@/features/community/ProfileCard";
import { registry } from "@/plugins/registry";
import { SyncSection } from "./SyncSection";

/**
 * The window the account bar opens: sign in, then sync, without going
 * through Settings. A sign-in that came back with an error passes it in.
 */
export function AccountDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const account = accountView.use();
  useEffect(() => {
    void watchAccount().catch(() => {});
  }, []);

  return (
    <Dialog label="Account" onClose={onClose} className="account-dialog">
      <header className="settings-header">
        <h2 className="dialog-title">Account</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <AccountSection accountError={typeof options.error === "string" ? options.error : undefined} compact />
      {account.state === "in" && registry.isOn("community") && (
        <section className="account-dialog-sync">
          <h3>Community profile</h3>
          <ProfileCard />
        </section>
      )}
      {account.state === "in" && (
        <section className="account-dialog-sync">
          <h3>Sync</h3>
          <SyncSection />
        </section>
      )}
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
