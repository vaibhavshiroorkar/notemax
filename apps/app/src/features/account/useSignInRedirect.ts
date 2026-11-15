import { useEffect } from "react";
import { isDesktop, isPhoneApp } from "@/platform/platform";
import { accountsEnabled, isSignInRedirect } from "./config";

/**
 * Back from Google on the web: finishes signing in, then calls `onDone` with
 * an error message, if any, so the caller can show the result in Settings.
 */
export function useSignInRedirect(onDone: (error: string | undefined) => void) {
  useEffect(() => {
    if (isPhoneApp && accountsEnabled) {
      void finishOnPhone().then((error) => error !== null && onDone(error), (err) => onDone(String(err)));
      return;
    }
    if (isDesktop || !accountsEnabled || !isSignInRedirect()) return;
    // Read before the client loads, since starting it can clear the address bar.
    const params = new URLSearchParams(location.search);
    import("./client")
      .then((client) => client.finishWebSignIn(params))
      .then(onDone, (err) => onDone(String(err)));
    // Runs once, on the page load that came back from Google.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * The phone app started by a sign-in link: Android closed it while the browser
 * was open. Null when it started any other way. A link is used once, so a
 * reload of the same start does not try the spent code again.
 */
async function finishOnPhone(): Promise<string | undefined | null> {
  const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
  const client = await import("./client");
  const url = (await getCurrent())?.find((u) => u.startsWith(client.PHONE_REDIRECT));
  if (!url || sessionStorage.getItem("notemax:signInLink") === url) return null;
  sessionStorage.setItem("notemax:signInLink", url);
  return client.finishPhoneSignIn(url);
}
