import { useMemo } from "react";
import { accountsEnabled } from "@/features/account/config";
import { syncView } from "@/features/sync/runtime";
import { setupLater } from "@/features/setup/SetupDialog";
import { onlineMode } from "@/platform/mode";
import { savedStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { keep, temporaryItems } from "./temporary";

/** "Not now" on the notice. Remembered, since the marks on the rows still say it. */
const hidden = savedStore<boolean>("temporaryNoticeHidden", false);

/** At the top of the left sidebar while there are temporary pages: why they are at risk, and what keeps them. */
export function TemporaryNotice({ app }: { app: AppContext }) {
  const items = useMemo(() => temporaryItems(app.tree), [app.tree]);
  const synced = syncView.use().state !== "off";
  const isHidden = hidden.use();
  // The setup question asks first, and says the same with its Online choice.
  const undecided = onlineMode.use() === null && !setupLater.use();
  if (!items.length || undecided || (isHidden && !synced)) return null;

  return (
    <section className="temporary-notice" data-synced={synced || undefined} aria-label="Temporary pages">
      <p>
        <Icon name="clock" />
        <span>{synced ? "Temporary pages now sync." : "Saved in this browser only."}</span>
      </p>
      <div className="temporary-actions">
        {synced ? (
          <button className="button" onClick={() => keep(app.doc, items.map((item) => item.id))}>
            Keep all
          </button>
        ) : (
          <>
            {accountsEnabled && (
              <button className="button button-primary" onClick={() => app.openOverlay("account")}>
                Sign in
              </button>
            )}
            <button className="button" onClick={() => hidden.set(true)}>
              Not now
            </button>
          </>
        )}
      </div>
    </section>
  );
}
