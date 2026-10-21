import { createClient } from "@supabase/supabase-js";
import { isDesktop } from "@/platform/platform";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// Must match SIGN_IN_PORT in apps/desktop/src-tauri/src/lib.rs, and be listed
// under Redirect URLs in the Supabase dashboard.
const SIGN_IN_REDIRECT = "http://127.0.0.1:47820";

export const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: {
    // PKCE: the code that comes back is useless without a secret kept on this
    // device, so another program catching the redirect gains nothing.
    flowType: "pkce",
    // The desktop app gets its code from the local listener, never from its own URL.
    detectSessionInUrl: !isDesktop,
  },
});

const cancelled = () => new DOMException("Sign-in was cancelled", "AbortError");

/**
 * On the web the page goes to Google and comes back, so this does not return.
 * On desktop it opens the browser and resolves once the app has a session.
 */
export async function signInWithGoogle(signal: AbortSignal): Promise<void> {
  if (!isDesktop) {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: SIGN_IN_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  let stop = () => {};
  const redirect = new Promise<string>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(cancelled()), { once: true });
    // Listening starts before the browser opens, so the redirect cannot be missed.
    void listen<string>("sign-in-redirect", (event) => resolve(event.payload)).then((unlisten) => {
      stop = unlisten;
      if (signal.aborted) unlisten();
    });
  });
  try {
    await invoke("open_sign_in", { url: data.url });
    const params = new URLSearchParams(await redirect);
    const code = params.get("code");
    if (!code) throw new Error(params.get("error_description") ?? "Google sign-in did not finish.");
    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) throw exchange.error;
  } finally {
    stop();
  }
}

/**
 * Finishes a web sign-in after the redirect back. The client trades the code
 * for a session while it starts up. `params` must be read before this module
 * loads, because starting the client can clear them from the address bar.
 * Returns an error message, if any.
 */
export async function finishWebSignIn(params: URLSearchParams): Promise<string | undefined> {
  const { data, error } = await supabase.auth.getSession();
  // Drop the code from the address bar, so a reload does not try to use it twice.
  // The state is kept: it says which page this history entry is.
  history.replaceState(history.state, "", location.pathname + location.hash);
  if (params.get("error_description")) return params.get("error_description")!;
  if (error) return error.message;
  if (!data.session) return "Google sign-in did not finish.";
  return undefined;
}

/** Signs out on this device only. Other devices stay signed in. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
