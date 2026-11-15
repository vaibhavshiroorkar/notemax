// Where the Android app gets the drawing fonts and the Java runtime: from the
// website. The APK leaves them out (scripts/phone-web.mjs), since together they
// are 19 MB that only boards and Java pages need, and Cloudflare serves files
// of at most 25 MiB. Everywhere else they come from the app itself, so "".
// The Android app runs at tauri.localhost like the desktop app, so the user
// agent tells them apart. Workers import this too, so it checks no window.
export const BIG_FILES_FROM = self.location.hostname === "tauri.localhost" && /Android/i.test(navigator.userAgent) ? "https://notemax.pages.dev" : "";
