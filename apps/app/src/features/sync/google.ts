import type { Session } from "@supabase/supabase-js";
import { getPref, removePref, setPref } from "@/platform/prefs";

// Google Drive access for sync. Signing in with Google (through Supabase) also
// asks for the drive.file scope, which lets Notemax see only the files it made.
// Google then hands over a refresh token once. It stays on this device, and a
// small Supabase function (supabase/functions/google-token) trades it for
// short-lived access tokens, so the Google client secret is never on a device.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const REFRESH_PREF = "googleRefreshToken";

let access: { token: string; expires: number } | null = null;

/** Keeps the Google tokens from a session that just signed in. Later sessions do not carry them. */
export function rememberGoogleTokens(session: Session | null | undefined) {
  if (!session?.provider_token) return;
  access = { token: session.provider_token, expires: Date.now() + 50 * 60_000 };
  if (session.provider_refresh_token) setPref(REFRESH_PREF, session.provider_refresh_token);
}

export const hasDriveAccess = () => getPref(REFRESH_PREF) !== null;

export function forgetDriveAccess() {
  access = null;
  removePref(REFRESH_PREF);
}

export class NeedsSignIn extends Error {
  constructor() {
    super("Sign in with Google again to give Notemax access to Google Drive.");
  }
}

/** An access token for Drive, fetching a new one when the last is about to run out. */
export async function driveToken(force = false): Promise<string> {
  if (!force && access && access.expires > Date.now() + 60_000) return access.token;
  const refresh = getPref(REFRESH_PREF);
  if (!refresh) throw new NeedsSignIn();
  const { supabase } = await import("@/features/account/client");
  const { data, error } = await supabase.functions.invoke<{ access_token?: string; expires_in?: number; error?: string }>("google-token", {
    body: { refresh_token: refresh },
  });
  if (error || !data?.access_token) {
    // A non-2xx answer comes back as an error whose body holds the reason.
    let reason = data?.error;
    const context = (error as { context?: Response } | null)?.context;
    if (!reason && context && typeof context.json === "function") {
      reason = await context.json().then((body: { error?: string }) => body.error, () => undefined);
    }
    const message = reason ?? error?.message ?? "no token";
    // Google refuses a refresh token the user took back, or one from a test app older than 7 days.
    if (/invalid_grant|revoked|expired/i.test(message)) {
      forgetDriveAccess();
      throw new NeedsSignIn();
    }
    throw new Error(`Could not reach Google Drive: ${message}`);
  }
  access = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return access.token;
}
