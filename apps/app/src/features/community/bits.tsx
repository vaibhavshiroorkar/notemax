import { useEffect, useState, type ReactNode } from "react";
import type { Profile } from "./api";

// Small parts the community screens share.

/** Where the community screen is: a place and what it needs to show it. */
export type Place =
  | { view: "feed"; following: boolean }
  | { view: "search"; words: string }
  | { view: "profile"; username: string }
  | { view: "post"; id: string }
  | { view: "me" }
  | { view: "messages" }
  | { view: "chat"; other: Profile }
  | { view: "rooms" }
  | { view: "room"; slug: string };

export const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
/** Today's messages by their time, older ones by their day. */
export const whenSent = (iso: string) => {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : when(iso);
};
export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
export const nameOf = (profile?: Profile) => profile?.display_name || profile?.username || "Someone";
export const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

/** A loader's result, with its error in words, and a way to load again. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error?: string; loading: boolean; reload(): void } {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    setState((old) => ({ data: old.data, loading: true }));
    load().then(
      (data) => live && setState({ data, loading: false }),
      (error: unknown) => live && setState({ error: messageOf(error), loading: false }),
    );
    return () => {
      live = false;
    };
    // The caller names what the load depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, round]);
  return { ...state, reload: () => setRound((n) => n + 1) };
}

export function Avatar({ profile, size = 28 }: { profile?: Profile; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (profile?.avatar_url && !broken) return <img className="community-avatar" src={profile.avatar_url} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className="community-avatar" data-initial style={{ width: size, height: size }} aria-hidden="true">
      {nameOf(profile).slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Status({ error, loading, children }: { error?: string; loading: boolean; children: ReactNode }) {
  if (error) return <p className="community-error">{error}</p>;
  if (loading) return <p className="community-empty" aria-busy="true">Loading...</p>;
  return <>{children}</>;
}
