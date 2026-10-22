import type { User } from "@supabase/supabase-js";
import { createStore } from "@/platform/store";
import { SUPABASE_URL, accountsEnabled, isSignInRedirect } from "./config";

export type AccountView =
  | { state: "loading" }
  | { state: "out" }
  | { state: "in"; name: string; email: string; avatar?: string };

/** Who is signed in on this device, for the account bar and its window. */
export const accountView = createStore<AccountView>({ state: "loading" });

// Where supabase-js keeps the session by default. Reading it tells whether
// anyone ever signed in here without loading the library.
const sessionKey = () => (SUPABASE_URL ? `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token` : "");

function hasSavedSession(): boolean {
  try {
    return localStorage.getItem(sessionKey()) !== null;
  } catch {
    return false;
  }
}

const viewOf = (user: User | null | undefined): AccountView => {
  if (!user) return { state: "out" };
  const email = user.email ?? "";
  return {
    state: "in",
    name: (user.user_metadata.full_name as string | undefined) ?? email,
    email,
    avatar: user.user_metadata.avatar_url as string | undefined,
  };
};

let watching: Promise<void> | null = null;

/** Loads the Supabase library and follows sign-ins and sign-outs from then on. */
export function watchAccount(): Promise<void> {
  watching ??= import("./client").then(
    (client) => {
      // Fires right away with the saved session, then on every change.
      client.supabase.auth.onAuthStateChange((_event, session) => accountView.set(viewOf(session?.user)));
    },
    (err) => {
      watching = null;
      accountView.set({ state: "out" });
      throw err;
    },
  );
  return watching;
}

/**
 * Called once at startup. Someone who never signed in is shown as signed out
 * at once, and the library stays unloaded until they open the account window.
 */
export function startAccount() {
  if (!accountsEnabled) return;
  if (hasSavedSession() || isSignInRedirect()) void watchAccount().catch(() => {});
  else accountView.set({ state: "out" });
}
