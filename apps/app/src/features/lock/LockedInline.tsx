import { useState, type FormEvent } from "react";
import type { TreeNode } from "@notemax/core";
import { registry } from "@/plugins/registry";
import { Icon } from "@/ui/Icon";
import { hasPassword, unlock, unlocked } from "./lock";

/** Whether a page's text is hidden now. Redraws when locked pages open or close. */
export function useHidden(node: TreeNode | undefined): boolean {
  unlocked.use();
  return registry.hidesText(node);
}

/** In place of a locked page's text inside another page, like a subtopic: a password box to open it. */
export function LockedInline() {
  const set = hasPassword.use();
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await unlock(password);
    setWrong(!ok);
    if (!ok) setPassword("");
  };
  return (
    <form className="locked-inline" onSubmit={(event) => void submit(event)}>
      <Icon name="lock" />
      <span>Locked</span>
      {set && (
        <>
          <input className="lock-input" type="password" placeholder="Lock password" aria-label="Lock password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="button" type="submit" disabled={!password}>
            Open
          </button>
        </>
      )}
      {wrong && <span className="lock-error">Not the lock password.</span>}
    </form>
  );
}
