# How Notemax is built

## Storage

Each note is a [Yjs](https://yjs.dev) document, saved as an append-only log of changes. The sidebar tree is one more Yjs document. Two devices can edit offline and merge later without losing text.

In the browser, notes are stored in IndexedDB. The desktop app keeps them in one SQLite file, `notemax.db`, in the app's config folder. Both sit behind the same `DocStore` interface in `packages/core`, so the rest of the app does not care which one it gets.

Sync is optional. Each device writes its changes as encrypted files to a folder in the user's own Google Drive and reads the files of the other devices. The engine lives in `packages/core/src/sync.ts`. [data-and-sync.md](data-and-sync.md) explains storage, sync, versions and locks in full.

## Layout

```
apps/
  app/       The editor (Vite, React, Tiptap). Runs in the browser and inside the desktop shell.
  desktop/   Tauri v2 shell: SQLite storage, tray icon, global shortcut, capture window, updates.
  android/   The Android app's manifest. Bubblewrap generates the rest.
packages/
  core/      Storage, the workspace tree, sync, history, links and word counts. No UI code, and covered by tests.
supabase/    Database migrations for shared pages and the community, and the function that trades a Google sign-in for a Drive token.
examples/    A sample plugin.
scripts/     Repo tools: setting the version, releasing the desktop and Android apps.
```

Inside `apps/app/src`, each feature has its own folder with its components and styles:

```
app/         the window: layout, tabs, which page is open
plugins/     the plugin API and the list of built-in plugins
features/    one folder per feature: editor, links, sidebar, books, sync, ...
ui/          shared pieces: icons, dialogs, menus, theme and appearance
platform/    desktop or web, and saved preferences
data/        hooks that open notes and the workspace
```

Imports between folders use `@/`, like `@/ui/Icon`. Imports inside a feature stay relative.

## Plugins

Every feature plugs in the same way: it exports a plugin object from its `plugin.ts`, and `plugins/builtin.ts` registers it. A plugin can add editor extensions, `/` menu items, commands with shortcuts, kinds of page, sidebar sections and filters, right sidebar panels, Settings categories, right-click menu items, download formats and more. `plugins/types.ts` describes each slot. The app reads all of them from the registry, so a new feature never needs changes elsewhere.

Plugins written by other people use the same API, described in [plugins.md](plugins.md).

## Versions

Each finished step gets a version number, set everywhere at once with `pnpm version:set 0.N.0` and listed in [CHANGELOG.md](../CHANGELOG.md). [development.md](development.md) covers checks and releases.
