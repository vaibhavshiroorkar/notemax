import { useCallback, useEffect, useState } from "react";
import { MAIN_WORKSPACE, type WorkspaceInfo } from "@notemax/core";
import { accountsEnabled } from "@/features/account/config";
import { accountView } from "@/features/account/session";
import { LinkRow } from "@/features/share/ShareDialog";
import { nameOf, workspaceList } from "@/features/workspaces/list";
import type { AppContext } from "@/plugins/types";
import { ConfirmDialog, Dialog } from "@/ui/Dialog";
import { messageOf } from "@/ui/format";
import { Segmented } from "@/ui/Segmented";
import { atLeast, invite, setLinkAccess, spacePeople, uninvite, type LinkAccess, type Person, type Role, type SpaceInfo } from "./api";
import { COPY_HINT, copying, leaveWorkspace, linkTo, shareWorkspace, startCopy, stopSharingWorkspace } from "./actions";
import { refreshSpace, spaceViews } from "./runtime";
import "./spaces.css";
import { InfoTip } from "@/ui/InfoTip";
import { Loading, Spinner } from "@/ui/Spinner";

const ROLE_WORDS: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Can edit", viewer: "Can view" };
const ROLE_HINTS: Record<Person["role"], string> = {
  viewer: "Reads everything, changes nothing.",
  editor: "Reads and writes, adds and removes pages.",
  admin: "Edits, and also invites people and sets the link.",
};
const YOU: Record<Role, string> = {
  owner: "You own this workspace.",
  admin: "You can edit this workspace and choose who has it.",
  editor: "You can edit this workspace.",
  viewer: "You can view this workspace. Ask its owner to let you edit, or make your own copy to change.",
};
const LINK_HINTS: Record<LinkAccess, string> = {
  off: "Only the people below can open it.",
  view: "Anyone with the link can read it, without an account.",
  edit: "Anyone with the link can read it, and people signed in can also edit.",
};

/** Share a workspace with people by email and by link, see who has it, or stop. */
export function ShareWorkspaceDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const list = workspaceList.use();
  const account = accountView.use();
  const views = spaceViews.use();
  const workspace = list.find((w) => w.id === ((options.workspace as string | undefined) ?? app.workspace));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workspace) return null;
  const name = nameOf(workspace);
  const view = views[workspace.id];
  const email = account.state === "in" ? account.email.toLowerCase() : null;
  const act = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    work()
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };

  let body;
  if (!accountsEnabled) {
    body = <p className="dialog-message">Sharing needs the online part of Notemax, which this copy of the app was built without.</p>;
  } else if (!workspace.shared) {
    body = (
      <>
        <p className="dialog-message">
          Share <strong>{name}</strong> with people by email, or with a link.
          <InfoTip label="About sharing a workspace">
            Everyone sees the same pages, and changes reach the others within moments. You choose who can only view and who can edit. The workspace is kept on
            the Notemax server, encrypted, so people can open it while you are offline. Big files like long videos stay on your devices.
          </InfoTip>
        </p>
        {email ? null : <p className="share-people">Sign in first, so the workspace has an owner.</p>}
        <div className="dialog-actions">
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          {email ? (
            <button className="button button-primary" disabled={busy} onClick={() => act(() => shareWorkspace(workspace, account.state === "in" ? account.name : ""))}>
              {busy && <Spinner />}
              {busy ? "Sharing..." : "Share this workspace"}
            </button>
          ) : (
            <button className="button button-primary" onClick={() => app.openOverlay("account", {})}>
              Sign in
            </button>
          )}
        </div>
      </>
    );
  } else if (!view || view.state === "opening") {
    body = <Loading className="dialog-message">Connecting...</Loading>;
  } else if (view.state === "error") {
    body = (
      <>
        <p className="dialog-message">Could not reach the shared copy: {view.message}</p>
        <div className="dialog-actions">
          <button className="button" onClick={() => refreshSpace(workspace.id)}>
            Try again
          </button>
          <button className="button" onClick={onClose}>
            Done
          </button>
        </div>
      </>
    );
  } else if (view.state === "gone") {
    body = (
      <>
        <p className="dialog-message">
          <strong>{name}</strong> is no longer shared with you: its owner stopped sharing it, or took you off. The pages on this device stay until you remove them.
        </p>
        <Footer workspace={workspace} email={email} app={app} onClose={onClose} role={null} />
      </>
    );
  } else {
    body = <Settings workspace={workspace} info={view.info} email={email} app={app} onClose={onClose} />;
  }

  return (
    <Dialog label={`Share ${name}`} onClose={onClose} className="share-dialog space-dialog">
      <h2 className="dialog-title">Share "{name}"</h2>
      {body}
      {error && <p className="error">{error}</p>}
    </Dialog>
  );
}

function Settings({ workspace, info, email, app, onClose }: { workspace: WorkspaceInfo; info: SpaceInfo; email: string | null; app: AppContext; onClose(): void }) {
  const admin = atLeast(info.role, "admin");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState("");
  const [as, setAs] = useState<Person["role"]>("editor");

  const load = useCallback(() => {
    if (!email) return setPeople([]);
    spacePeople(workspace.shared!.space, workspace.shared!.token).then(setPeople, (err: unknown) => setError(messageOf(err)));
  }, [workspace.shared, email]);
  useEffect(load, [load]);

  const act = (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    work()
      .then(() => {
        after?.();
        load();
        refreshSpace(workspace.id);
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };
  const { space, token } = workspace.shared!;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.trim());
  const roles: Person["role"][] = info.role === "owner" ? ["viewer", "editor", "admin"] : ["viewer", "editor"];

  return (
    <>
      <p className="dialog-message">{YOU[info.role]}</p>

      <section className="space-section">
        <h3>
          Anyone with the link
          <InfoTip label="About the link">
            Off: only the people below can open it. Can view: anyone with the link can read it, without an account. Can edit: anyone with the link can read it,
            and people signed in can also edit. Make a new link to stop the old one working.
          </InfoTip>
        </h3>
        {admin ? (
          <Segmented<LinkAccess>
            label="What anyone with the link can do"
            value={info.linkAccess}
            options={[
              { value: "off", label: "Off" },
              { value: "view", label: "Can view" },
              { value: "edit", label: "Can edit" },
            ]}
            onChange={(access) => act(() => setLinkAccess(space, token, access))}
          />
        ) : null}
        {!admin && <p className="share-people">{LINK_HINTS[info.linkAccess]}</p>}
        {admin && info.linkAccess !== "off" && info.linkToken && (
          <>
            <LinkRow label="Link" hint={info.linkAccess === "view" ? "Opens it to read." : "Opens it to read, or to edit once signed in."} link={linkTo(space, info.linkToken)} />
            <button className="link-button" disabled={busy} onClick={() => act(() => setLinkAccess(space, token, info.linkAccess, true))}>
              Make a new link
            </button>
          </>
        )}
      </section>

      <section className="space-section">
        <h3>
          People
          <InfoTip label="About people and roles">
            People you invite find it on Home, under Shared with you, once they sign in with that email. Can view: {ROLE_HINTS.viewer} Can edit: {ROLE_HINTS.editor}{" "}
            Admin: {ROLE_HINTS.admin}
          </InfoTip>
        </h3>
        {admin && (
          <form
            className="space-invite"
            onSubmit={(event) => {
              event.preventDefault();
              if (emailOk) act(() => invite(space, token, who.trim(), as), () => setWho(""));
            }}
          >
            <input type="email" placeholder="Email address" aria-label="Email address to invite" value={who} onChange={(event) => setWho(event.target.value)} />
            <select aria-label="Role" value={as} onChange={(event) => setAs(event.target.value as Person["role"])} title={ROLE_HINTS[as]}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_WORDS[role]}
                </option>
              ))}
            </select>
            <button className="button button-primary" disabled={busy || !emailOk}>
              Invite
            </button>
          </form>
        )}
        {!email ? (
          <p className="share-people">Sign in to see who else has this workspace.</p>
        ) : (
          <ul className="space-people">
            <li>
              <span className="space-email">{info.owner ?? "The owner"}</span>
              <span className="space-role">Owner</span>
            </li>
            {people?.map((person) => {
              // Admins manage editors and viewers; only the owner manages admins.
              const manage = admin && (info.role === "owner" || person.role !== "admin");
              return (
                <li key={person.email}>
                  <span className="space-email">
                    {person.email}
                    {person.email === email && " (you)"}
                  </span>
                  {manage ? (
                    <>
                      <select aria-label={`Role of ${person.email}`} value={person.role} disabled={busy} onChange={(event) => act(() => invite(space, token, person.email, event.target.value as Person["role"]))}>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_WORDS[role]}
                          </option>
                        ))}
                      </select>
                      <button className="link-button danger" disabled={busy} onClick={() => act(() => uninvite(space, token, person.email))}>
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="space-role">{ROLE_WORDS[person.role]}</span>
                  )}
                </li>
              );
            })}
            {people === null && (
              <li className="share-people">
                <Loading>Loading...</Loading>
              </li>
            )}
          </ul>
        )}
      </section>
      {error && <p className="error">{error}</p>}
      <Footer workspace={workspace} email={email} app={app} onClose={onClose} role={info.role} />
    </>
  );
}

function Footer({ workspace, email, app, role, onClose }: { workspace: WorkspaceInfo; email: string | null; app: AppContext; role: Role | null; onClose(): void }) {
  const [asking, setAsking] = useState(false);
  const busyCopying = copying.use().has(workspace.id);
  const name = nameOf(workspace);
  const owner = role === "owner";
  // The first workspace is never removed, so leaving it is not offered; stopping is, to its owner.
  const canLeave = !owner && workspace.id !== MAIN_WORKSPACE;
  return (
    <div className="dialog-actions">
      {(owner || canLeave) && (
        <button className="link-button danger" onClick={() => setAsking(true)}>
          {owner ? "Stop sharing" : "Leave and remove from this device"}
        </button>
      )}
      {!owner && (
        <button className="button" disabled={busyCopying} title={COPY_HINT} onClick={() => startCopy(workspace)}>
          {busyCopying && <Spinner />}
          {busyCopying ? "Copying..." : "Make my own copy"}
        </button>
      )}
      <button className="button" onClick={onClose}>
        Done
      </button>
      {asking &&
        (owner ? (
          <ConfirmDialog
            title={`Stop sharing ${name}?`}
            message="The shared copy is erased from the server and everyone loses access. Pages already on their devices stay with them. Your workspace stays here as it is."
            confirmLabel="Stop sharing"
            onCancel={() => setAsking(false)}
            onConfirm={() => {
              setAsking(false);
              void stopSharingWorkspace(workspace).then(
                () => app.notify(`Stopped sharing ${name}`),
                (err: unknown) => app.notify(`Could not stop sharing: ${messageOf(err)}`),
              );
            }}
          />
        ) : (
          <ConfirmDialog
            title={`Leave ${name}?`}
            message="It goes from your list and its pages are erased from this device and your other devices. To come back, you need a new invitation or the link."
            confirmLabel="Leave"
            onCancel={() => setAsking(false)}
            onConfirm={() => {
              setAsking(false);
              onClose();
              void leaveWorkspace(workspace, email).then(
                () => app.notify(`Left ${name}`),
                (err: unknown) => app.notify(`Could not leave: ${messageOf(err)}`),
              );
            }}
          />
        ))}
    </div>
  );
}
