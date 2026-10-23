import { useState } from "react";
import type { TreeNode } from "@notemax/core";
import { accountsEnabled } from "@/features/account/config";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { canEdit, linkOf, shareOf, startSharing, stopSharing } from "./share";
import { joinedRooms, roomPeople } from "./useShare";

const namesOf = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** One link with what it lets people do, and a button that copies it. */
function LinkRow({ label, hint, link }: { label: string; hint: string; link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="share-link-row">
      <span className="share-link-label">
        <strong>{label}</strong>
        <span className="share-link-hint">{hint}</span>
      </span>
      <div className="share-link">
        <input readOnly aria-label={`${label} link`} value={link} onFocus={(event) => event.target.select()} />
        <button
          className="button"
          onClick={() => {
            void navigator.clipboard.writeText(link).catch(() => {});
            setCopied(true);
          }}
        >
          <Icon name="copy" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Share a page by link, to edit or only to read, see who has it open, or stop. */
export function ShareDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const pageId = options.pageId as string;
  const node = app.tree.byId.get(pageId);
  const people = roomPeople.use()[pageId] ?? [];
  const [busy, setBusy] = useState(false);
  if (!node) return null;
  const share = shareOf(node);
  const title = node.title || "Untitled";
  const create = () => {
    setBusy(true);
    void startSharing(app.doc, pageId).finally(() => setBusy(false));
  };

  return (
    <Dialog label={`Share ${title}`} onClose={onClose} className="share-dialog">
      <h2 className="dialog-title">Share "{title}"</h2>
      {!accountsEnabled ? (
        <p className="dialog-message">Sharing needs the online part of Notemax, which this copy of the app was built without.</p>
      ) : share ? (
        <>
          <p className="dialog-message">Edits go straight between the people who have it open, sealed with a key that is only in the links.</p>
          {canEdit(share) && <LinkRow label="Can edit" hint="Reads and writes in it, live." link={linkOf(share, node.title, "edit")} />}
          {share.verify ? (
            <LinkRow label="Can view" hint="Reads it as it changes, and cannot change it." link={linkOf(share, node.title, "view")} />
          ) : (
            <p className="share-people">
              This link lets everyone edit.{" "}
              <button className="link-button" disabled={busy} onClick={create}>
                Make new links, with one to only view
              </button>
              . The link above stops working.
            </p>
          )}
          {!canEdit(share) && <p className="share-people">You can read this page. Ask for an edit link to write in it.</p>}
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
          <p className="dialog-message">Make links to share this page: one to write in it together, one to only read it. People open them in the web app without an account.</p>
          <div className="dialog-actions">
            <button className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" disabled={busy} onClick={create}>
              Create links
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
      <span>
        {shareOf(node) && !canEdit(shareOf(node)!) ? "Shared with you to read. " : "Shared. "}
        {people.length ? `Here now: ${namesOf(people.map((p) => p.name))}.` : joined ? "Nobody else has it open." : "Connecting..."}
      </span>
      <button className="link-button" onClick={() => app.openOverlay("share", { pageId: node.id })}>
        Share settings
      </button>
    </p>
  );
}
