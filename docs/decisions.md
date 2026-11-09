# Decisions

The choices that shaped Notemax, with the reason for each. Where a later choice replaced an earlier one, both are here.

## Stack

- **One app for web and desktop.** A Vite and React app runs in the browser and inside a Tauri shell, so every feature is written once. Tauri over Electron for a small installer and a native SQLite store.
- **Tiptap for writing, Yjs for data.** Yjs merges edits without losing text, which makes offline use, sync and live sharing safe. Tiptap's ProseMirror core binds to Yjs directly.
- **Plain CSS with theme tokens**, no Tailwind or component kit. Each feature keeps its own stylesheet.
- **A core package with no UI.** Storage, the tree, sync and history live in `packages/core` with unit tests, so the risky parts are tested apart from the screen.

## Data

- **Local first.** Pages save to the device within a fraction of a second, and the desktop app needs no account. Sync is an addition, never a requirement.
- **Sync through the person's own Google Drive** instead of a Notemax server. No server ever holds private pages, and the files are sealed with a passphrase. Each device writes only its own files, so nothing is overwritten.
- **Accounts only in Settings, never prompted.** People who stay offline are never asked to sign in.
- **On the web, online by default.** A browser may clear its storage, so the website starts online; the desktop app asks once.
- **Shared things go to Supabase, private things never do.** Shared pages, posts and messages need a server; private pages do not.

## Layout

- **One flat sidebar.** The Inbox was removed as extra structure. Notes and folders sit together; folders only sort. Books came back as their own kind because chapters need an order and a page.
- **Pages can hold pages.** A note can show its pages inside as subtopics, the way a chapter does.
- **Create and Open are different menus.** Create makes pages; Open opens files from the computer. Mixing them confused people.
- **Page tools live in the right sidebar**, so the top bar stays clear. The word count sits at its bottom right, on every page with words.
- **The right sidebar starts small.** Its sections are boxes you turn on from Sections and drag into tabs.
- **Marks line up.** A row's marks sit in one column at the right, and its buttons take their place while pointed at, so rows with more buttons do not push their marks around.

## Journals and books

- **The Journal is one page**, each day a subtopic, newest first, so a week of entries reads top to bottom. Since v0.110 any number of journals can be made from Create, Others; each adds days with Next date and Choose date.
- **Next date follows the latest entry**, not the calendar, so a journal kept day after day fills the next day; an empty one starts today.
- **Numbers that do not move.** A note with its newest subtopics on top counts down, so an entry keeps its number when a new one arrives. A book page left without a number does not shift the others.

## Safety

- **Never lose text silently.** Conflicts keep both sides and ask. Versions and Activity record what changed and who changed it. Save errors show in the status bar.
- **Locks are gates, not encryption.** A page or workspace lock keeps out casual eyes; a forgotten password can be reset by typing the workspace's name. Real secrecy comes from the encrypted sync.
- **Deleting a workspace asks for its name.** Nothing brings it back, so a stray click must not do it.

## Plugins

- **Every feature is a plugin**, built on the same API community plugins use. A feature never needs changes elsewhere, and outside plugins can do what built-in ones do. See [plugins.md](plugins.md).

## Apps

- **The Android app is the website** in a Trusted Web Activity. It gets every change without a reinstall.
- **The desktop app updates itself** from the website, with signed installers.
