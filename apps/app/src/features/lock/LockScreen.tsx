import { useState, type FormEvent } from "react";
import type { TreeNode } from "@notemax/core";
import { nameOf, workspaceList } from "@/features/workspaces/list";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { forgetPassword, hasPassword, setPassword, unlock } from "./lock";

/** What a locked page shows in place of itself until the password is typed. */
export function LockScreen({ node, app }: { node: TreeNode; app: AppContext }) {
  const set = hasPassword.use();
  const [password, setValue] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [forgetting, setForgetting] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const workspaces = workspaceList.use();
  const here = workspaces.find((w) => w.id === app.workspace);
  const workspaceName = here ? nameOf(here) : "My notes";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!set) {
      if (password.length < 4) return setError("Use at least 4 characters.");
      if (password !== again) return setError("The two passwords are not the same.");
      setBusy(true);
      await setPassword(password);
      setBusy(false);
      return;
    }
    setBusy(true);
    const ok = await unlock(password);
    setBusy(false);
    if (!ok) {
      setError("That is not the lock password.");
      setValue("");
    }
  };

  if (forgetting)
    return (
      <div className="lock-screen">
        <Icon name="lock" />
        <h2>Forget the lock password?</h2>
        <p>Locked pages stay locked, and the next password you set opens them. Type the name of this workspace, {workspaceName}, to go on.</p>
        <input className="lock-input" value={name} aria-label="Workspace name" autoFocus onChange={(event) => setName(event.target.value)} />
        <div className="lock-actions">
          <button className="link-button" onClick={() => setForgetting(false)}>
            Cancel
          </button>
          <button
            className="button danger"
            disabled={name.trim().toLowerCase() !== workspaceName.toLowerCase()}
            onClick={() => {
              forgetPassword();
              setForgetting(false);
              setName("");
            }}
          >
            Forget it
          </button>
        </div>
      </div>
    );

  return (
    <form className="lock-screen" onSubmit={(event) => void submit(event)}>
      <Icon name="lock" />
      <h2>{node.title || "Untitled"} is locked</h2>
      <p>{set ? "Type the lock password to open it." : "Set a lock password. The same one opens every locked page, on all your devices."}</p>
      <input className="lock-input" type="password" value={password} aria-label="Lock password" placeholder="Password" autoFocus onChange={(event) => setValue(event.target.value)} />
      {!set && <input className="lock-input" type="password" value={again} aria-label="Password again" placeholder="Password again" onChange={(event) => setAgain(event.target.value)} />}
      {error && (
        <p className="lock-error" role="alert">
          {error}
        </p>
      )}
      <div className="lock-actions">
        {set && (
          <button type="button" className="link-button" onClick={() => setForgetting(true)}>
            Forgot the password?
          </button>
        )}
        <button className="button" type="submit" disabled={busy || !password}>
          {set ? "Open" : "Set and open"}
        </button>
      </div>
      <p className="lock-note">This lock keeps out casual eyes. It is not encryption: the text is still on this device as it was.</p>
    </form>
  );
}
