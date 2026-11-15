// Builds the web app for the Android app into apps/app/dist-phone. Run by
// `tauri android build` (tauri.android.conf.json). The site's own copies of
// the desktop installer and the Android app are left out: the APK would carry
// them for nothing, and Cloudflare serves files of at most 25 MiB. The drawing
// fonts and the Java runtime (19 MB) stay on the website, where the app loads
// them when a board or a Java page needs them (src/platform/bigFiles.ts).
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "app");
const out = join(app, "dist-phone");
// pnpm is a .cmd file on Windows, which needs a shell. The arguments are fixed.
execFileSync("pnpm", ["run", "build", "--outDir", "dist-phone", "--emptyOutDir"], { cwd: app, stdio: "inherit", shell: true });
for (const folder of ["desktop", "android", "excalidraw", "runtimes"]) rmSync(join(out, folder), { recursive: true, force: true });
