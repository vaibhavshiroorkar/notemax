import { useEffect, useState, type FormEvent } from "react";
import { hasDriveAccess } from "./google";
import { liveOn, liveState, type LiveState } from "./live";
import { folderState, syncIsOn, syncNow, syncView, turnOffSync, turnOnSync, type SyncView } from "./runtime";
import "./sync.css";
import { messageOf } from "@/ui/format";
import { InfoTip } from "@/ui/InfoTip";
import { Loading } from "@/ui/Spinner";


/** "just now", "5 minutes ago", and so on. */
export function ago(time: number | null): string {
  if (time === null) return "not yet";
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return new Date(time).toLocaleString();
}

export function describe(view: SyncView): string {
  switch (view.state) {
    case "off":
      return "Off";
    case "elsewhere":
      return "Syncing in another tab of this app";
    case "syncing":
      // Counted only when there are enough files for the wait to be felt.
      return view.total && view.total > 3 ? `Syncing ${view.done ?? 0} of ${view.total}` : "Syncing...";
    case "idle":
      return `Synced ${ago(view.lastSynced)}`;
    case "offline":
      return `Offline. Edits are saved here and sync when you are back online. Last synced ${ago(view.lastSynced)}.`;
    case "error":
      return `Sync stopped: ${view.message}`;
  }
}

/**
 * The Sync part of Settings: sign in with Google, pick or enter the
 * passphrase, then see how sync is going.
 */
const LIVE_WORDS: Record<LiveState, string> = {
  off: "Off",
  connecting: "Connecting...",
  live: "Connected",
  error: "Could not connect. Edits still sync through Drive.",
};

/** Live updates on or off, and how they are doing. */
function LiveSwitch() {
  const on = liveOn.use();
  const state = liveState.use();
  return (
    <label className="settings-row settings-check">
      <span>
        Live updates
        <InfoTip label="About live updates">
          Each edit goes straight to your other open devices, within a second. Drive still keeps the record, so anything missed arrives with the next sync. Off, edits go through Drive only, within a few seconds.
        </InfoTip>
        <span className="settings-description">{on ? LIVE_WORDS[state] : "Off"}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(event) => liveOn.set(event.target.checked)} />
    </label>
  );
}

export function SyncSection() {
  const view = syncView.use();
  const [on, setOn] = useState(syncIsOn);
  const [signedIn, setSignedIn] = useState<boolean>();
  const [folder, setFolder] = useState<{ hasPassphrase: boolean }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState<AbortController | null>(null);

  // Signed in, and Google gave Drive access on this device.
  useEffect(() => {
    let stop = () => {};
    let closed = false;
    void import("@/features/account/client").then((client) => {
      if (closed) return;
      const { data } = client.supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session && hasDriveAccess()));
      stop = () => data.subscription.unsubscribe();
    });
    return () => {
      closed = true;
      stop();
    };
  }, []);

  // Whether Drive already has a passphrase, so the form asks for the right thing.
  useEffect(() => {
    if (!signedIn || on) return;
    folderState().then(
      (state) => setFolder({ hasPassphrase: state.hasPassphrase }),
      (err) => setError(messageOf(err)),
    );
  }, [signedIn, on]);

  const signIn = async () => {
    const controller = new AbortController();
    setWaiting(controller);
    setError(undefined);
    try {
      const client = await import("@/features/account/client");
      await client.signInWithGoogle(controller.signal);
      setSignedIn(hasDriveAccess());
    } catch (err) {
      if (!controller.signal.aborted) setError(messageOf(err));
    } finally {
      setWaiting(null);
    }
  };

  const start = async (passphrase: string) => {
    setBusy(folder?.hasPassphrase ? "Checking the passphrase and reading your notes..." : "Setting up the Notemax folder in your Drive...");
    setError(undefined);
    try {
      const result = await turnOnSync(passphrase);
      if (result === "reload") location.reload();
      else setOn(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(null);
    }
  };

  if (on) {
    return (
      <>
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Sync is on</strong>
            <span data-state={view.state} className="sync-state">
              {describe(view)}
            </span>
          </div>
          <button className="button" onClick={syncNow} disabled={view.state === "syncing" || view.state === "elsewhere"}>
            Sync now
          </button>
        </div>
        {view.state === "error" && view.signIn && (
          <button className="button" onClick={signIn}>
            Sign in with Google again
          </button>
        )}
        <LiveSwitch />
        <div className="settings-row">
          <div className="settings-row-text">
            <strong>
              Turn off sync on this device
              <InfoTip label="About turning off sync">Notes stay on this device, and the copies in Drive stay for your other devices.</InfoTip>
            </strong>
          </div>
          <button
            className="button"
            onClick={() => {
              void turnOffSync();
              setOn(false);
            }}
          >
            Turn off
          </button>
        </div>
        {error && <p className="warning">{error}</p>}
      </>
    );
  }

  return (
    <>
      {signedIn === undefined ? (
        <Loading>Loading...</Loading>
      ) : !signedIn ? (
        waiting ? (
          <>
            <p>Finish signing in with Google, then come back here.</p>
            <button className="button" onClick={() => waiting.abort()}>
              Cancel
            </button>
          </>
        ) : (
          <button className="button button-primary" onClick={signIn}>
            Continue with Google
          </button>
        )
      ) : busy ? (
        <Loading>{busy}</Loading>
      ) : folder ? (
        <PassphraseForm existing={folder.hasPassphrase} onSubmit={start} />
      ) : (
        <Loading>Looking at your Drive...</Loading>
      )}
      {error && <p className="warning">{error}</p>}
    </>
  );
}

function PassphraseForm({ existing, onSubmit }: { existing: boolean; onSubmit(passphrase: string): void }) {
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");
  const tooShort = passphrase.length < 8;
  const mismatch = !existing && again !== passphrase;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (tooShort || mismatch) return;
    onSubmit(passphrase);
  };

  return (
    <form className="sync-form" onSubmit={submit}>
      {existing ? (
        <p>Your Drive already has Notemax notes. Enter the passphrase you chose on your other device.</p>
      ) : (
        <p>
          Choose a passphrase. Every device you sync needs it. <strong>If you forget it, the copies in Drive cannot be read</strong>, though the notes on each device stay as they are.
        </p>
      )}
      <label className="sync-field">
        <span>Passphrase</span>
        <input type="password" autoComplete={existing ? "current-password" : "new-password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} data-autofocus />
      </label>
      {!existing && (
        <label className="sync-field">
          <span>Type it again</span>
          <input type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} />
        </label>
      )}
      {passphrase && tooShort && <p className="settings-note">At least 8 characters. A few words in a row work well.</p>}
      {!tooShort && again && mismatch && <p className="settings-note">The two do not match yet.</p>}
      <button className="button button-primary" type="submit" disabled={tooShort || mismatch}>
        {existing ? "Unlock and sync" : "Turn on sync"}
      </button>
    </form>
  );
}
