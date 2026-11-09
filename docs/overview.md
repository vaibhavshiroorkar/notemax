# What Notemax is

Notemax is a note app for writing that grows into books. You write linked notes, gather them into chapters, and the result can be read as a book, downloaded, or posted to the community.

It started as a personal tool. Its author uses it every day, so it is built for long daily use first, and for other people second.

## Who it is for

People who write a lot and want their notes and their long writing in one place:

- notes that link to each other, with backlinks,
- books with chapters and numbered subtopics,
- journals with one entry per day,
- to-dos with dates and reminders inside notes,
- boards for sketching and code pages that run.

## The gap it aims at

Other tools each cover part of the path from thinking to publishing:

- Obsidian is good for linked notes, but publishing costs extra per site and syncing is paid.
- Notion is slow offline and loses detail on export.
- Substack is for posting, not drafting.
- Scrivener has no links and no web publishing.

Notemax aims to cover the whole loop in one app: linked notes, then chapters, then a book, then readers. The author owns every step.

## Rules it keeps

These came from common complaints about other note apps. New features follow them.

1. **Sync never deletes text silently.** Edits merge, every note keeps versions, and the app always shows whether work is saved.
2. **It is fast.** Editable in under a second at launch, no typing lag, tested with 5,000 notes.
3. **Offline is the default, not a mode.** The desktop app needs no account at all.
4. **Capture opens before the workspace finishes loading.** Quick capture (Ctrl+Alt+N) works from any app.
5. **Finding things matters as much as writing them.** Full-text search, backlinks, unlinked mentions and a graph.
6. **No filing at capture time.** Sorting happens later.
7. **Export keeps everything.** Markdown, Word, PDF, EPUB and more, plus a folder of plain .md files kept in step.
8. **The local core is free.**

## Where it runs

- **Web:** [notemax.pages.dev](https://notemax.pages.dev). Installs as an app and works offline.
- **Windows:** a desktop app built with Tauri. It stores pages in one SQLite file, sits in the tray and updates itself.
- **Android:** an APK that opens the website full screen (a Trusted Web Activity), so it gets new versions without a reinstall.

See [history.md](history.md) for how it got here and [features.md](features.md) for what it does.
