# Notemax

A note app for writing that grows into books.

Notes live on your device first. Folders keep them sorted, books hold chapters in order, and `[[links]]` tie everything together. The long-term goal is to publish a book from your notes as a clean public site, without copying anything out.

It's early and built as a personal tool first, so things change often.

## What works now

- A rich text editor with headings, lists, code and Markdown shortcuts.
- Notes, folders and books in one sidebar. Drag to sort or to nest.
- A page for each book, with its chapters in order and word counts.
- `[[` links between notes, and a "Linked from" list under each note. Renaming a note never breaks links to it.
- Trash, with restore and delete forever.
- Light and dark themes.
- A desktop app with a tray icon and quick capture: press Ctrl+Alt+N in any app to jot a note down.
- Edits are saved to disk within a fraction of a second, and the status bar always tells you whether they are.

The desktop app is built with Tauri, so it should build on Windows, macOS and Linux. So far it has only been tested on Windows.

## How it's built

Each note is a [Yjs](https://yjs.dev) document, saved as an append-only log of changes. The sidebar tree is one more Yjs document. That's what will let two devices edit offline and merge later without losing text.

```
apps/
  app/       The editor (Vite + React + Tiptap). Runs in the browser and inside the desktop shell.
  desktop/   Tauri v2 shell: SQLite storage, tray icon, global shortcut, capture window.
packages/
  core/      Storage, the workspace tree, links and word counts. No UI code, and covered by tests.
```

Inside `apps/app/src`, each feature has its own folder with its components and styles:

```
app/         the window: layout, shortcuts, which page is open
features/    one folder per feature: editor, links, slash, sidebar, books, settings, ...
ui/          shared pieces: icons, dialogs, menus, theme
platform/    desktop or web, and saved preferences
data/        hooks that open notes and the workspace
```

Imports between folders use `@/`, like `@/ui/Icon`. Imports inside a feature stay relative.

In the browser, notes are stored in IndexedDB. The desktop app keeps them in one SQLite file, `notemax.db`, in the app's config folder. Both sit behind the same `DocStore` interface in `packages/core`, so the rest of the app doesn't care which one it gets.

## Getting started

You need Node 22 or newer and pnpm. For the desktop app you also need Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system.

```sh
pnpm install
pnpm dev             # web app on http://localhost:5173
pnpm desktop         # desktop app
pnpm test            # core tests
pnpm typecheck
pnpm build           # production build of the web app
pnpm desktop:build   # desktop installer
```

Accounts are optional, and the app works fully without them. To try Google sign-in, copy `apps/app/.env.example` to `apps/app/.env` and fill in your own Supabase project.

## Roadmap

Roughly in this order:

1. Editing: a `/` command menu, a Ctrl+K switcher, better paste, and images.
2. Desktop polish: installer, app icon, start with the system.
3. Keeping data safe: version history, Markdown export, importers and backups.
4. Finding things: full-text search, unlinked mentions and a graph view.
5. Sync between devices, encrypted, through your own Google Drive.
6. Writing tools for books: outline view, word count goals, chapter navigation.
7. Publishing books as fast public sites.

## License

Not chosen yet. Until then, all rights are reserved.
