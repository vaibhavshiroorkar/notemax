# Working on Notemax

## Setup

You need Node 22 or newer and [pnpm](https://pnpm.io). The desktop app also needs Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
pnpm install
pnpm dev             # web app at http://localhost:5173
pnpm desktop         # desktop app (starts its own dev server on 5173)
pnpm test            # core package tests
pnpm typecheck
pnpm build           # production build of the web app
pnpm desktop:build   # desktop installer
```

Accounts and sync are optional. To try them, copy `apps/app/.env.example` to `apps/app/.env` and fill in your own Supabase project's address and publishable key. Never put a secret key in the app.

Run `pnpm typecheck` without `-s`: the silent flag hides the compiler's errors. Unused imports fail the typecheck on purpose.

## The repo

```
apps/app/        the editor app (Vite, React, Tiptap, Yjs), for the web and the desktop
apps/desktop/    the Tauri v2 shell, for Windows and Android
packages/core/   storage, the tree, sync, history, links; no UI, with tests
supabase/        database migrations and the Google token function
examples/        a sample plugin
scripts/         version, release and runtime download scripts
docs/            these docs
```

See [architecture.md](architecture.md) for how the app's code is laid out.

## Checks

- `packages/core` has unit tests (Vitest). Add one for every change to core behavior.
- The app is checked in a real browser with Puppeteer scripts, kept outside the repo. Each feature has one, and each run checks the features a change touches.
- CI runs the typecheck, the tests and the build on every push.

## Versions

Each finished step is a version:

1. `pnpm version:set 0.N.0` sets the number everywhere. The Android app takes its version from the Tauri config.
2. Add a section to [CHANGELOG.md](../CHANGELOG.md) in plain words for the people who use the app.
3. Commit, and tag `v0.N.0`.

Commit messages are short and plain, like "Add [[links]] and backlinks", with a line or two on what changed for the user.

## Releases

The website is the hub: the desktop app and the Android app both get updates from it.

- **Release:** `pnpm release "<notes>"` releases one version to Windows, Android and the website, in that order, and stops at the first failure. Always release this way: every platform must run the same version, since they share one sync format. Set the version with `pnpm version:set`, commit and tag first; the script refuses a dirty tree or an untagged commit. The three commands below are its steps, for retrying one that failed.
- **Desktop:** `pnpm desktop:release "<notes>"` builds and signs the Windows installer and writes `latest.json` into the site's `desktop/` folder. Installed apps check it and update themselves. The signing key lives outside the repo; losing it means installed apps stop accepting updates.
- **Android:** `pnpm android:release` builds the Tauri app for Android, signs the APK and puts it with `latest.json` into the site's `android/` folder. It needs the Android SDK with the NDK, and on Windows, Developer Mode. The app carries the web app inside it, so every release that changes the app needs a new APK. The app tells people when one is out. The APK must stay under Cloudflare's 25 MiB per file, so the drawing fonts and the Java runtime load from the website (`src/platform/bigFiles.ts`).
- **Website:** `pnpm site:deploy` builds the app and uploads `apps/app/dist` to the Cloudflare Pages project `notemax` with Wrangler. Run `pnpm exec wrangler login` once per machine first. It uploads from this machine, not from GitHub, because the installers, the APK and `.env` are gitignored and only exist here. Every release step first runs `scripts/check-env.mjs`, which stops it when `apps/app/.env` lacks the Supabase address or publishable key: the app builds fine without them but hides sign-in and sync. A fresh clone has no `.env`; copy `apps/app/.env.example` and fill it in. (The name is not `deploy` because `pnpm deploy` is a built-in pnpm command.)

Never commit keys, passwords or `.env` files.
