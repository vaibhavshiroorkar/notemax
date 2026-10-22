# Notemax

A note app for writing that grows into books.

Notes live on your device first. Folders keep them sorted, books hold chapters in order, and `[[links]]` tie everything together. The long-term goal is to publish a book from your notes as a clean public site, without copying anything out.

It's early and built as a personal tool first, so things change often.

## What works now

- A rich text editor with headings, lists, to-dos, code and Markdown shortcuts. Type `/` to pick a block.
- Ctrl+K to jump to any note or book, or to run any command. It opens on your recent pages. Type `#tag` there to search by tag.
- Back and forward between pages (Ctrl+[ and Ctrl+], or the mouse side buttons). Each note opens where you left it, with the same scroll and cursor.
- Tags on notes and books. Click a tag to see everything that has it.
- Boards for drawing, made with Excalidraw and saved like notes. A graph of how your pages link, for everything or around one page.
- Pictures: paste or drop them into a note, drag the handles to resize, and place them left, center or right with text flowing beside.
- Notes can show as one long page or as A4 or Letter sheets with page numbers, for all notes or per note.
- Download any page as plain text, Markdown, a web page, Word, PDF, or an EPUB for books. Boards download as PNG or SVG. "Download everything" gives a folder of Markdown files you can open in other apps.
- Right-click menus on pages, in notes and in the sidebar, with the keys for each action.
- Notes, folders and books in one sidebar, with guide lines down each folder. Drag to sort or to nest. Ctrl+click or Shift+click to pick several, then drag, star or trash them together.
- Star pages to keep them at the top of the sidebar.
- Search page titles from the sidebar, sort by title, created or edited time, group by kind, and filter by tags or stars.
- Tabs: middle-click a page or press Ctrl+T for a new one, Ctrl+W to close, and each tab has its own Back and Forward.
- A page for each book, with its chapters in order and word counts. The word count also sits at the top right of a book and each of its chapters. While a book is open, its chapters sit in a panel on the right, where you can add, reorder and trash them.
- `[[` links between notes, and a "Linked from" list in the right sidebar. Renaming a note never breaks links to it.
- Trash with Undo, in a box at the bottom left with its own search, restore, delete forever and empty trash. Duplicate a note, rename with F2.
- Make it yours: light or dark theme, accent color, font, text size and page width. Drag the sidebars to resize them. Focus mode hides everything but the page. Sidebars and buttons fade until you point at them (you can turn that off). Change any keyboard shortcut, and turn plugin options on or off.
- A right sidebar on every page: "This page" with its dates, words, links and layout, the pages that link to it, and a small graph around it. Books add their chapters to it.
- Plugins: switch built-in features off if you don't use them, or install plugins written by others (off until you allow them). See [docs/plugins.md](docs/plugins.md).
- Settings sorted into categories, with a search box. Quick settings (Ctrl+.) for the switches you flip often, and a list of every shortcut (Ctrl+/).
- Stays fast with thousands of notes: typing, switching pages and startup are tested with 5,000 notes.
- A desktop app with a tray icon and quick capture: press Ctrl+Alt+N in any app to jot a note down.
- Edits are saved to disk within a fraction of a second, and the status bar always tells you whether they are.
- Optional sync between your devices through your own Google Drive, sealed with a passphrase so Google cannot read it. Sign in and sync from the account bar at the bottom left.
- The web app installs on a phone, works offline, and has a phone layout with a formatting bar above the keyboard. It runs at [notemax.pages.dev](https://notemax.pages.dev).

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
app/         the window: layout, which page is open
plugins/     the plugin API and the list of built-in plugins
features/    one folder per feature: editor, links, slash, sidebar, books, settings, ...
ui/          shared pieces: icons, dialogs, menus, theme and appearance
platform/    desktop or web, and saved preferences
data/        hooks that open notes and the workspace
```

Imports between folders use `@/`, like `@/ui/Icon`. Imports inside a feature stay relative.

Every feature plugs in the same way: it exports a plugin object from its `plugin.ts`, and `plugins/builtin.ts` registers it. A plugin can add editor extensions, `/` menu items, commands with shortcuts, kinds for the + menu, the page for a kind, things under a page title or at its top right, sidebar sections and filters, a right sidebar, Settings categories, on or off options (which can also show in quick settings) shortcut hints for keys they handle themselves, and full-window views like the graph, right-click menu items and download formats. `plugins/types.ts` describes each one. The app reads all of these from the registry, so a new feature never needs changes elsewhere. Plugins written by other people use the same API, described in [docs/plugins.md](docs/plugins.md).

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

1. Sidebar and layout: tabs, multi-select, starred pages, search and filter, folder guide lines.
2. Board and settings polish.
3. Keeping data safe: version history, plain Markdown files kept next to the database (two-way), backups, and sync through your own Google Drive.
4. Split view, daily notes and a calendar.
5. New tools: code pages, voice typing, full-text search, unlinked mentions.
6. Several workspaces.
7. Writing tools for books, and publishing books as fast public sites.

## License

Not chosen yet. Until then, all rights are reserved.
