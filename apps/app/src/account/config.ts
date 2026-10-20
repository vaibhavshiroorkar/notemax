// Read from apps/app/.env. Kept apart from client.ts so that checking whether
// accounts are set up never loads the Supabase library.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False in builds made without Supabase settings. The Account section is then hidden. */
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** True when this page load is Supabase sending the browser back after sign-in. */
export function isSignInRedirect(): boolean {
  const params = new URLSearchParams(location.search);
  return params.has("code") || params.has("error_description");
}
