import { useState } from "react";
import type { SettingsContext } from "@/plugins/types";
import { hasPassword, relock, setPassword, unlock, unlocked } from "./lock";

/** Settings, Privacy: the lock password, and locking every locked page at once. */
export function LockSection({ app }: SettingsContext) {
  const set = hasPassword.use();
  const open = unlocked.use();
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");

  const change = async () => {
    if (next.length < 4) return setMessage("Use at least 4 characters.");
    if (set && !(await unlock(current))) return setMessage("The current password is not right.");
    await setPassword(next);
    setChanging(false);
    setCurrent("");
    setNext("");
    setMessage("The lock password is changed.");
  };

  return (
    <>
      <div className="settings-row">
        <div className="settings-row-text">
          <strong>Lock password</strong>
          <span>{set ? (open ? "Set. Locked pages are open right now." : "Set. Locked pages are closed.") : "Not set yet. Locking a page asks for one."}</span>
        </div>
        {set && open && (
          <button className="button" onClick={() => relock(app)}>
            Lock now
          </button>
        )}
        {!changing && (
          <button className="button" onClick={() => setChanging(true)}>
            {set ? "Change" : "Set"}
          </button>
        )}
      </div>
      {changing && (
        <div className="settings-row lock-change">
          {set && <input className="lock-input" type="password" placeholder="Current password" aria-label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          <input className="lock-input" type="password" placeholder="New password" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} />
          <button className="button" onClick={() => void change()}>
            Save
          </button>
        </div>
      )}
      {message && <p className="settings-note">{message}</p>}
      <p className="settings-note">
        Lock a page from its menu, under Page options. A locked page asks for the password before it shows, and stays hidden from search, previews and the Tasks list. Pages lock again after 5 minutes without a key press, or when the app closes. Forgot the password? Open a locked page and choose Forgot the password. This lock keeps out casual eyes; it is not encryption.
      </p>
    </>
  );
}
