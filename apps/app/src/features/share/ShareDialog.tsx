import { useState } from "react";
import type { TreeNode } from "@notemax/core";
import { accountsEnabled } from "@/features/account/config";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { linkOf, shareOf, startSharing, stopSharing } from "./share";
import { joinedRooms, roomPeople } from "./useShare";

const namesOf = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Share a page by link, see who has it open, or stop. */
export function ShareDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const pageId = options.pageId as string;
  const node = app.tree.byId.get(pageId);
  const people = roomPeople.use()[pageId] ?? [];
  const [copied, setCopied] = useState(false);
  if (!node) return null;
  const share = shareOf(node);
  const title = node.title || "Untitled";
  const link = share ? linkOf(share, node.title) : "";

  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
  };

  return (
    <Dialog label={`Share ${title}`} onClose={onClose} className="share-dialog">
      <h2 className="dialog-title">Share "{title}"</h2>
      {!accountsEnabled ? (
        <p className="dialog-message">Sharing needs the online part of Notemax, which this copy of the app was built without.</p>
      ) : share ? (
        <>
          <p className="dialog-message">Anyone with this link can read and edit the page. Edits go straight between the people who have it open, sealed with a key that is only in the link.</p>
          <div className="share-link">
            <input readOnly aria-label="Link to this page" value={link} onFocus={(event) => event.target.select()} />
            <button className="button button-primary" onClick={() => void copy()}>
              <Icon name="copy" />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="share-people">{people.length ? `Here now: ${namesOf(people.map((p) => p.name))}.` : "Nobody else has it open right now. Edits made apart meet up the next time you both have it open."}</p>
          <div className="dialog-actions">
            <button
              className="link-button danger"
              onClick={() => {
                stopSharing(app.doc, pageId);
                onClose();
                app.notify(`Stopped sharing "${title}" from here. People who have the link keep their copy.`);
              }}
            >
              Stop sharing
            </button>
            <button className="button" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="dialog-message">Make a link to write in this page together with someone. They can open it in the web app without an account.</p>
          <div className="dialog-actions">
            <button className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" onClick={() => startSharing(app.doc, pageId)}>
              Create a link
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Under the title of a shared page: who is here, and the way to the link. */
export function ShareLine({ node, app }: { node: TreeNode; app: AppContext }) {
  const people = roomPeople.use()[node.id] ?? [];
  const joined = joinedRooms.use().has(node.id);
  if (!shareOf(node)) return null;
  return (
    <p className="share-line">
      <Icon name="link" />
      <span>{people.length ? `Shared. Here now: ${namesOf(people.map((p) => p.name))}.` : joined ? "Shared. Nobody else has it open." : "Shared. Connecting..."}</span>
      <button className="link-button" onClick={() => app.openOverlay("share", { pageId: node.id })}>
        Share settings
      </button>
    </p>
  );
}
