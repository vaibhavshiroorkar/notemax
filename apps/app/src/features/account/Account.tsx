import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { SettingsContext } from "@/plugins/types";
import "./account.css";

type Client = typeof import("./client");

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * The Account part of Settings. The Supabase library loads only when this
 * opens, so people who never sign in never load it or touch the network.
 */
export function AccountSection({ accountError, compact }: Pick<SettingsContext, "accountError"> & { compact?: boolean }) {
  const [client, setClient] = useState<Client>();
  // Undefined while loading, null when signed out.
  const [user, setUser] = useState<User | null>();
  const [waiting, setWaiting] = useState<AbortController | null>(null);
  const [error, setError] = useState(accountError);

  useEffect(() => {
    let stop = () => {};
    let closed = false;
    import("./client")
      .then((mod) => {
        if (closed) return;
        setClient(mod);
        // Fires right away with the saved session, then on every change.
        const { data } = mod.supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        stop = () => data.subscription.unsubscribe();
      })
      .catch((err) => {
        setError(messageOf(err));
        setUser(null);
      });
    return () => {
      closed = true;
      stop();
    };
  }, []);

  const signIn = async () => {
    if (!client) return;
    const controller = new AbortController();
    setWaiting(controller);
    setError(undefined);
    try {
      await client.signInWithGoogle(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setError(messageOf(err));
    } finally {
      setWaiting(null);
    }
  };

  const signOut = () => {
    setError(undefined);
    client?.signOut().catch((err) => setError(messageOf(err)));
  };

  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email;
  const avatar = user?.user_metadata.avatar_url as string | undefined;

  return (
    <>
      {user === undefined ? (
        <p>Loading...</p>
      ) : user ? (
        <>
          <div className="account">
            {avatar && <img className="account-avatar" src={avatar} alt="" referrerPolicy="no-referrer" />}
            <div className="account-name">
              <strong>{name}</strong>
              {name !== user.email && <span>{user.email}</span>}
            </div>
            <button className="button" onClick={signOut}>
              Sign out
            </button>
          </div>
          {!compact && <p>To keep your notes on all your devices, turn on Sync in the Sync section.</p>}
        </>
      ) : waiting ? (
        <>
          <p>Finish signing in with Google in your browser, then come back here.</p>
          <button className="button" onClick={() => waiting.abort()}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <p>{compact ? "Sign in to sync your notes and use the community." : "Notemax works without an account. Sign in to sync through Google Drive, share pages, and use the community."}</p>
          <button className="button" onClick={signIn} disabled={!client}>
            Continue with Google
          </button>
        </>
      )}
      {error && <p className="warning">{error}</p>}
    </>
  );
}
