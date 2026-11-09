# How Notemax grew

Notemax started from an empty repository on 2026-10-11. Each finished step became a version, tagged `v0.N.0` in git. This page tells the story in phases. The [changelog](../CHANGELOG.md) has every release in full.

## 1. The core (2026-10-11, v0.1 to v0.5)

The first day built the base everything else stands on.

- **Storage and the tree (v0.1).** Each note is a Yjs document saved as an append-only log. The sidebar tree is one more Yjs document, so moves made on two devices merge. Listing 5,000 notes takes about 0.2 ms.
- **The web app (v0.2).** A Tiptap editor with headings, lists and Markdown shortcuts, a sidebar, and a save status.
- **The desktop app (v0.3).** A Tauri shell that keeps every page in one SQLite file.
- **Quick capture and the tray (v0.4).** Ctrl+Alt+N opens a small capture window from any app.
- **Links (v0.5).** `[[` links a note by its id, so renaming never breaks a link. Each page lists what links to it.

## 2. Shape of the app (2026-10-18 to 10-21, v0.6 to v0.14)

- Settings, dark mode and a trash. Folders replaced the Inbox, which was extra structure nobody used.
- **Books (v0.7)** came back as their own kind, with a page that lists chapters and word counts, and later a chapters sidebar on the right (v0.12).
- The repo went public on GitHub with CI (v0.8).
- Optional Google sign-in (v0.9), the `/` menu (v0.10), and feature folders for the code (v0.11).
- **Plugins and the Ctrl+K palette (v0.13).** Every feature became a plugin built on the same API outside plugins use.
- Tags, customization, Back and Undo, and a faster tree for big workspaces (v0.14).

## 3. Sync and the everyday comforts (2026-10-22 to 10-23, v0.15 to v0.62)

A long run of releases, many in a single day.

- **Sync through Google Drive (v0.15)**, sealed with a passphrase so Google cannot read the files. Each device writes only its own files, so two devices editing offline both keep their text. Live updates between open devices followed (v0.33), and conflict handling that asks which side to keep (v0.31).
- **Version history (v0.28)** with versions that thin out over time.
- The sidebar grew: multi-select, drag to nest pages inside pages (v0.24), rename in place (v0.25), a ... menu per row (v0.32).
- **Workspaces (v0.34)**, sharing a note by link to write in it together (v0.35), Miro-like board tools (v0.36), a Markdown folder kept in step both ways (v0.38), daily notes (v0.39), split view (v0.40), full-text search (v0.41), voice typing (v0.42) and code pages that run (v0.43).
- Chapters gained numbered subtopics (v0.45). Settings started to follow you to every device (v0.47).
- A first-start question (online or offline), Home, videos, special pages, a new Settings look, and the community with posts and follows (v0.48 to v0.62).

## 4. A wishlist, step by step (2026-10-24, v0.63 to v0.84)

- Subtopics moved inside their chapter's page (v0.63). Any note can show its pages inside as subtopics (v0.74).
- Home became a page of cards (v0.68). Two versions of a note can be compared in color (v0.71). Split view gained layouts up to four panes (v0.72). Switching workspace stopped reloading the window (v0.73).
- **The Journal (v0.75):** one page with each day inside it, newest first.
- **To-dos with dates, repeats and priorities (v0.77)**, typed in plain words like "call mum tomorrow 5pm", then **reminders (v0.78)**.
- **Page lock (v0.79):** a password before chosen pages show.
- **Code pages** got a real code editor (v0.80), then C++ and Java running in the browser through WebAssembly (v0.81).
- **Browser pages (v0.82)**, and a calmer Home (v0.83).

## 5. Polish, phones and the desktop browser (2026-10-25 to 10-27, v0.85 to v0.95)

- The setup question became a dialog (v0.85). Alt+Up and Alt+Down move blocks (v0.86).
- In the desktop app, browser pages became real web views (v0.87 to v0.91).
- Opening files from the computer as pages (v0.92). Page tools moved into the right sidebar (v0.93, v0.94). The Create and Open menus were split: Create makes pages, Open opens files.
- Community chat: direct messages, rooms and comments (v0.95).

## 6. Help, updates, safety and apps (2026-10-29 to 11-01, v0.96 to v0.109)

- Back and Forward, find and replace, and everyday keys (v0.96). New workspaces start empty with a Welcome tab (v0.97).
- **Help and auto updates (v0.98):** the desktop app updates itself from the website.
- Private reader notes on posts (v0.99), app zoom and more keys (v0.100), phone fixes (v0.101, v0.102, v0.104, v0.105).
- **A data safety review (v0.103)** fixed the ways pages could be lost or trashed and made silent save errors visible.
- Books can name and number their chapters (v0.105).
- **Activity (v0.106):** who did what to each page, beside its versions.
- **Get the app (v0.107 to v0.109):** the website offers the Windows and Android apps, and the Android APK arrived.

## 7. Layout, workspaces and journals (2026-11-09, v0.110)

- The word count moved to the bottom right of the right sidebar, for every page with words. Find and replace has a button.
- Sidebar rows line up their marks in one column.
- Workspaces show on Home, can be locked with the lock password, and can be deleted from the top left by typing their name.
- **Journal became its own entry under Create, Others.** Its page has Next date and Choose date instead of Add subtopic.
- Any note can put its newest subtopics on top. A book page can go without a number, anywhere in the book.
- Sync sends and checks for edits sooner.
