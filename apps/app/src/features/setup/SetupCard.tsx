import { accountsEnabled } from "@/features/account/config";
import { onlineMode } from "@/platform/mode";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";

/** At the top of the left sidebar until it is answered: offline on this device, or online on all of them. */
export function SetupCard({ app }: { app: AppContext }) {
  if (onlineMode.use() !== null) return null;
  return (
    <section className="setup-card" aria-label="Set up Notemax">
      <p className="setup-card-title">How will you use Notemax?</p>
      <button className="setup-choice" onClick={() => onlineMode.set("offline")}>
        <strong>
          <Icon name="storage" />
          On this device only
        </strong>
        <span>Offline. No account, and nothing leaves this device.</span>
      </button>
      <button
        className="setup-choice"
        onClick={() => {
          onlineMode.set("online");
          if (accountsEnabled) app.openOverlay("account");
        }}
      >
        <strong>
          <Icon name="sync" />
          On all my devices
        </strong>
        <span>Online. Sign in to sync, share and work together.</span>
      </button>
      <button className="link-button" onClick={() => app.openSettings("setup")}>
        More choices
      </button>
    </section>
  );
}
