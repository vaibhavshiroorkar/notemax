import { createClient } from "@supabase/supabase-js";
import { DRIVE_SCOPE, forgetDriveAccess, rememberGoogleTokens } from "@/features/sync/google";
import { isDesktop, isPhoneApp } from "@/platform/platform";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// Must match SIGN_IN_PORT in apps/desktop/src-tauri/src/lib.rs, and be listed
// under Redirect URLs in the Supabase dashboard.
const SIGN_IN_REDIRECT = "http://127.0.0.1:47820";
// The phone app's way back from the browser. Android opens notemax:// links in
// the app (tauri.android.conf.json), even when it had closed meanwhile. Listed
// under Redirect URLs in the Supabase dashboard too.
export const PHONE_REDIRECT = "notemax://auth/callback";

export const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: {
    // PKCE: the code that comes back is useless without a secret kept on this
    // device, so another program catching the redirect gains nothing.
    flowType: "pkce",
    // We explicitly exchange the code in finishWebSignIn to guarantee capturing provider tokens.
    detectSessionInUrl: false,
  },
});

// Drive access for sync, and a refresh token (offline, and consent so Google sends it again).
const GOOGLE_OPTIONS = { scopes: DRIVE_SCOPE, queryParams: { access_type: "offline", prompt: "consent" } };

const cancelled = () => new DOMException("Sign-in was cancelled", "AbortError");

/**
 * On the web the page goes to Google and comes back, so this does not return.
 * On desktop it opens the browser and resolves once the app has a session.
 */
export async function signInWithGoogle(signal: AbortSignal): Promise<void> {
  if (isPhoneApp) return signInOnPhone(signal);
  if (!isDesktop) {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { ...GOOGLE_OPTIONS, redirectTo: location.origin } });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { ...GOOGLE_OPTIONS, redirectTo: SIGN_IN_REDIRECT, skipBrowserRedirect: true },
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
    rememberGoogleTokens(exchange.data.session);
  } finally {
    stop();
  }
}

/**
 * The phone app: Google refuses to sign in inside the app's web view, so the
 * browser opens, and the notemax:// link it ends on comes back to the app.
 */
async function signInOnPhone(signal: AbortSignal): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { ...GOOGLE_OPTIONS, redirectTo: PHONE_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  let stop = () => {};
  const back = new Promise<string>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(cancelled()), { once: true });
    // Listening starts before the browser opens, so the link cannot be missed.
    void onOpenUrl((urls) => {
      const url = urls.find((u) => u.startsWith(PHONE_REDIRECT));
      if (url) resolve(url);
    }).then((unlisten) => {
      stop = unlisten;
      if (signal.aborted) unlisten();
    });
  });
  try {
    await openUrl(data.url);
    const url = await back;
    // So a reload, which still sees the link that opened the app, does not use the spent code again.
    sessionStorage.setItem("notemax:signInLink", url);
    const failed = await finishPhoneSignIn(url);
    if (failed) throw new Error(failed);
  } finally {
    stop();
  }
}

/**
 * Trades the code in a notemax://auth/callback link for a session. Also used
 * at start, when Android closed the app while the browser was open and the
 * link started it again. Returns an error message, if any.
 */
export async function finishPhoneSignIn(url: string): Promise<string | undefined> {
  const params = new URL(url).searchParams;
  const failed = params.get("error_description");
  if (failed) return failed;
  const code = params.get("code");
  if (!code) return "Google sign-in did not finish.";
  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) return exchange.error.message;
  rememberGoogleTokens(exchange.data.session);
  return undefined;
}

/**
 * Finishes a web sign-in after the redirect back. The client trades the code
 * for a session while it starts up. `params` must be read before this module
 * loads, because starting the client can clear them from the address bar.
 * Returns an error message, if any.
 */
export async function finishWebSignIn(params: URLSearchParams): Promise<string | undefined> {
  const errorDescription = params.get("error_description");
  const code = params.get("code");
  // Drop the code from the address bar, so a reload does not try to use it twice.
  // The state is kept: it says which page this history entry is.
  history.replaceState(history.state, "", location.pathname + location.hash);
  if (errorDescription) return errorDescription;

  let session = null;
  if (code) {
    try {
      const exchange = await supabase.auth.exchangeCodeForSession(code);
      if (exchange.error) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      } else {
        session = exchange.data.session;
      }
    } catch {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }
  } else {
    const { data, error } = await supabase.auth.getSession();
    if (error) return error.message;
    session = data.session;
  }
  if (!session) return "Google sign-in did not finish.";
  rememberGoogleTokens(session);
  return undefined;
}

/** Signs out on this device only. Other devices stay signed in. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
  // Sync on this device stops with the account. Notes stay here.
  forgetDriveAccess();
}
