// Builds the Windows installer, signs it for the desktop app's updater, and
// puts it with latest.json in apps/app/public/desktop/. The next web build
// copies them into the site, so the deploy that follows publishes the update
// at https://notemax.pages.dev/desktop/latest.json, where the app looks.
//
// The signing key lives outside the repo, in ~/.tauri/notemax-updater.key
// (made with `tauri signer generate`). Its public half is in tauri.conf.json.
// Without the key no app will accept an update, so keep a copy of it safe.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ?? join(homedir(), ".tauri", "notemax-updater.key");
if (!existsSync(key)) throw new Error(`no signing key at ${key}`);

const { version } = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
const notes = process.argv.slice(2).join(" ") || `Notemax ${version}`;

// Emptied first: the app is built from the web build, and an installer left
// here would end up inside the next installer.
const out = join(root, "apps/app/public/desktop");
rmSync(out, { recursive: true, force: true });

// The Android app has no place inside the Windows one, so it waits outside public/ during the build.
const android = join(root, "apps/app/public/android");
const androidAside = join(root, "apps/app/android-aside");
if (existsSync(android)) renameSync(android, androidAside);
try {
  // A fixed command with nothing from outside in it. pnpm is a .cmd file on Windows, which needs a shell.
  execSync("pnpm --filter ./apps/desktop exec tauri build --bundles nsis", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: readFileSync(key, "utf8").trim(), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "" },
  });
} finally {
  if (existsSync(androidAside)) renameSync(androidAside, android);
}

const bundle = join(root, "apps/desktop/src-tauri/target/release/bundle/nsis");
const installer = `Notemax_${version}_x64-setup.exe`;
const signature = readFileSync(join(bundle, `${installer}.sig`), "utf8").trim();

// Cloudflare Pages serves files up to 25 MiB.
const size = statSync(join(bundle, installer)).size;
if (size > 25 * 1024 * 1024) throw new Error(`${installer} is ${(size / 1048576).toFixed(1)} MiB, over the 25 MiB a page file may be`);
mkdirSync(out, { recursive: true });
copyFileSync(join(bundle, installer), join(out, installer));
writeFileSync(
  join(out, "latest.json"),
  JSON.stringify(
    {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: { "windows-x86_64": { signature, url: `https://notemax.pages.dev/desktop/${installer}` } },
    },
    null,
    2,
  ),
);
console.log(`ready in apps/app/public/desktop: ${installer} and latest.json for ${version}`);
