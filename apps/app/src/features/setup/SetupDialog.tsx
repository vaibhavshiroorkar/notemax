import { accountsEnabled } from "@/features/account/config";
import { onlineMode } from "@/platform/mode";
import { createStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";

/**
 * Browser checks drive a fresh profile each time, and a question over the
 * whole window would stop every one of them. On the dev server, under
 * automation, it waits unless a check asks for it. The built app always asks.
 */
function quietForChecks(): boolean {
  if (!import.meta.env.DEV || !navigator.webdriver) return false;
  try {
    return localStorage.getItem("notemax:checks:setup") !== "ask";
  } catch {
    return true;
  }
}

/** Set by "Not now": the question waits for the next start, and the rest of the app stops waiting for it. */
export const setupLater = createStore(quietForChecks());

/**
 * The first question on a first visit, over everything: offline on this
 * device, or online on all of them. It comes back at each start until it is
 * answered; Settings, Setup changes the answer later.
 */
export function SetupDialog({ app }: { app: AppContext }) {
  const mode = onlineMode.use();
  const later = setupLater.use();
  if (mode !== null || later) return null;
  return (
    <Dialog label="How will you use Notemax?" className="setup-dialog" onClose={() => setupLater.set(true)}>
      <h2 className="dialog-title">How will you use Notemax?</h2>
      <p className="setup-dialog-intro">You can change this any time in Settings, Setup.</p>
      <div className="setup-dialog-choices">
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
      </div>
      <div className="setup-dialog-actions">
        <button
          className="link-button"
          onClick={() => {
            setupLater.set(true);
            app.openSettings("setup");
          }}
        >
          More choices
        </button>
        <button className="link-button" onClick={() => setupLater.set(true)}>
          Not now
        </button>
      </div>
    </Dialog>
  );
}
