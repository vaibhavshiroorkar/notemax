import { useEffect } from "react";
import { isDesktop } from "@/platform/platform";
import { accountsEnabled, isSignInRedirect } from "./config";

/**
 * Back from Google on the web: finishes signing in, then calls `onDone` with
 * an error message, if any, so the caller can show the result in Settings.
 */
export function useSignInRedirect(onDone: (error: string | undefined) => void) {
  useEffect(() => {
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
