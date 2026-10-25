import { useMemo } from "react";
import type { TreeNode } from "@notemax/core";
import { accountsEnabled } from "@/features/account/config";
import { syncView } from "@/features/sync/runtime";
import { setupLater } from "@/features/setup/SetupDialog";
import { onlineMode } from "@/platform/mode";
import { savedStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { isTemporary, keep, temporaryItems } from "./temporary";

/** "Not now" on the notice. Remembered, since the marks on the rows still say it. */
const hidden = savedStore<boolean>("temporaryNoticeHidden", false);

const pages = (n: number) => (n === 1 ? "1 page is" : `${n} pages are`);

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
        {synced ? (
          <span>{pages(items.length)} from a browser without sign-in. They sync now. Keep them to drop the mark.</span>
        ) : (
          <span>
            {pages(items.length)} saved only in this browser. Clearing site data can erase {items.length === 1 ? "it" : "them"}.
          </span>
        )}
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
                Sign in to keep {items.length === 1 ? "it" : "them"}
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

/** Under the title of a temporary page. */
export function TemporaryLine({ node, app }: { node: TreeNode; app: AppContext }) {
  const synced = syncView.use().state !== "off";
  if (!isTemporary(node)) return null;
  return (
    <p className="temporary-line">
      <Icon name="clock" />
      {synced ? (
        <>
          <span>Temporary page, made in a browser without sign-in.</span>
          <button className="link-button" onClick={() => keep(app.doc, [node.id])}>
            Keep
          </button>
        </>
      ) : (
        <>
          <span>Temporary: saved only in this browser.</span>
          {accountsEnabled && (
            <button className="link-button" onClick={() => app.openOverlay("account")}>
              Sign in to keep it
            </button>
          )}
        </>
      )}
    </p>
  );
}
