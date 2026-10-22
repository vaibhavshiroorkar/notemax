// Trades a Google refresh token for a short-lived access token, so the app can
// reach the user's Google Drive for sync. The Google client secret lives only
// here, as a secret of this function, never in the app.
//
// Secrets to set in Supabase (Edge Functions, Secrets): GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET, the same pair as Authentication, Providers, Google.
// Keep "Verify JWT" on: only signed-in users of this project can call it.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  let refreshToken: unknown;
  try {
    refreshToken = (await req.json()).refresh_token;
  } catch {
    return reply({ error: "send JSON with refresh_token" }, 400);
  }
  if (typeof refreshToken !== "string" || !refreshToken) return reply({ error: "missing refresh_token" }, 400);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) return reply({ error: data.error === "invalid_grant" ? "invalid_grant" : (data.error_description ?? data.error ?? "refresh failed") }, 400);
  return reply({ access_token: data.access_token, expires_in: data.expires_in });
});
