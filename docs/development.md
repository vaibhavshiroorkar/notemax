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
apps/desktop/    the Tauri v2 shell
apps/android/    the Android app's manifest (the rest is generated)
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

1. `pnpm version:set 0.N.0` sets the number everywhere, the Android manifest included.
2. Add a section to [CHANGELOG.md](../CHANGELOG.md) in plain words for the people who use the app.
3. Commit, and tag `v0.N.0`.

Commit messages are short and plain, like "Add [[links]] and backlinks", with a line or two on what changed for the user.

## Releases

The website is the hub: the desktop app and the Android app both get updates from it.

- **Desktop:** `pnpm desktop:release "<notes>"` builds and signs the Windows installer and writes `latest.json` into the site's `desktop/` folder. Installed apps check it and update themselves. The signing key lives outside the repo; losing it means installed apps stop accepting updates.
- **Android:** `pnpm android:release` builds and signs the APK with Bubblewrap into the site's `android/` folder. It is only needed when the Android manifest changes, since the app loads the website.
- **Website:** `pnpm build`, then deploy `apps/app/dist` to Cloudflare Pages. Check that the live build has the Supabase address in it, or the Account section stays hidden.

Never commit keys, passwords or `.env` files.
