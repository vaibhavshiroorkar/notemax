# Features

Everything Notemax does, grouped by what you do with it. The [changelog](../CHANGELOG.md) says when each part arrived.

## Pages

A workspace holds pages of these kinds:

| Kind | What it is |
| --- | --- |
| Note | Rich text. Can hold other pages and show them on its own page as subtopics. |
| Folder | Only for sorting. It has no page of its own. |
| Book | A description and chapters in reading order, with word counts. |
| Journal | A note with one entry per day, newest first. Made from Create, Others. |
| Board | A drawing canvas (Excalidraw). A smaller one also fits inside any note, from the `/` menu. |
| Code | Code that runs: Python, JavaScript, TypeScript, SQL, C++ and Java. |
| Browser | A web page inside a page. A real web view in the desktop app. |

What may sit inside what is one rule in `packages/core/src/workspace.ts` (`holds`): any known kind can hold pages, except that a book holds no folders and no books directly. The sidebar adds that folders only go at the top or in other folders.

**Create** (the + in the sidebar, or right-click) makes pages. **Open** (the folder button, or right-click) opens files from the computer as pages: Markdown, text, Word, web pages, code files, pictures and Excalidraw files.

## Writing

- Headings, lists, to-dos, quotes, code blocks with colors, dividers, pictures and videos. Type `/` for blocks, or use Markdown shortcuts.
- A Format section in the right sidebar: style, font, size, bold and the rest, colors, highlight, alignment, spacing and lists. Pasting from Word or Google Docs keeps the formatting.
- `[[Links]]` by page id, so renames never break them. Backlinks and unlinked mentions in the right sidebar.
- Find and replace in a note: Ctrl+F, Ctrl+H, or the button in the right sidebar's tools.
- Alt+Up and Alt+Down move a block. Voice typing writes what you say.
- One long page, or A4 or Letter sheets with page numbers.
- The word count sits at the bottom right of the right sidebar. On a chapter it shows that chapter's share of the book.

## Books

- A book page lists its chapters four ways: Chapters, Outline, Previews or Full text (the whole book as one page to read or write).
- Chapters hold numbered subtopics (6.1, 6.2.1) written inside the chapter's page.
- A book chooses what to call its chapters (Part, Lesson, or no word) and how to number them (1 2 3, I II III, or none).
- A single page can go without a number, like a prologue or an interlude, from its menu: Leave without a number. The chapters around it count on as if it were not there.
- Next and Previous at the top and end of each chapter. Downloads as Word, PDF, EPUB, Markdown or HTML.

## Subtopics and journals

- Any note can show the pages inside it as numbered subtopics on its own page (right sidebar, This page, Subtopics).
- **Newest on top:** a note can list its newest subtopic first. Numbers count down, so each keeps its number when a new one arrives, and Add subtopic moves above the list.
- **Journals** list days newest first, without numbers. Instead of Add subtopic they offer **Next date** (the day after the latest entry, or today when there is none) and **Choose date**. A day that already has an entry opens instead of being made twice.
- The calendar in the right sidebar picks a day; Ctrl+Alt+D opens today's entry in the Journal used for daily notes.

## To-dos and reminders

- To-dos in any note can carry a day, a time, a repeat and a priority, typed in plain words like "water plants every monday".
- The Tasks page groups them into Overdue, Today, Upcoming and more. Home shows Today.
- Reminders ring on time, as system notifications in the desktop app.

## Organizing

- One sidebar for every kind of page. Drag to sort or nest, pick several with Ctrl or Shift, rename in place with F2.
- Each row's marks (locked, bookmarked, sorted, special) sit in one column at the right; pointing at a row shows its + and ... buttons there.
- Sort a folder or note by title, newest, oldest or day.
- Tags, bookmarks (stars), filters, and title search.
- Tabs, split view up to four panes, Back and Forward.
- Ctrl+K finds pages, words inside notes and commands.
- Special pages: the place for daily notes, a template for them, and a start page.

## Workspaces

- Separate sets of pages, like Work and Personal, each with its own tabs and trash. Switch from the top left.
- Home lists them as cards to open, rename, color, drag into order, lock or delete.
- **Lock a workspace** from the top-left menu or its card. Its list, pages and Home cards stay hidden until the lock password is typed. The same password opens locked pages.
- **Delete a workspace** from the top-left menu or its card. You type its name to confirm. The open one makes way for another first. The first workspace always stays.
- Copy or move pages between workspaces.

## Keeping things safe

- A status bar that says whether work is saved, and shows save errors.
- Version history with colored comparisons, and Activity: who edited, renamed, moved, trashed, shared or locked a page, and when.
- Undo for page changes, a trash you can search and restore from.
- Page lock and workspace lock. The lock keeps out casual eyes; it is not encryption.
- Optional sync through your own Google Drive, end-to-end encrypted. See [data-and-sync.md](data-and-sync.md).

## Sharing and community

- Share any note by link: Can edit to write together live, Can view to read it as it changes.
- Share a whole workspace from the workspace menu. Invite people by email as Viewer, Editor or Admin, and set what anyone with the link can do: nothing, view without an account, or edit once signed in. People you invite find it on Home, under Shared with you. The shared copy lives on the Notemax server, encrypted, so it opens while you are offline.
- The community: post notes and books, follow writers, search, comment, direct messages and rooms, and private reader notes on chosen lines.

## Making it yours

- Light and dark themes, accent colors, fonts, text size, page width and app zoom.
- A right sidebar you arrange from Sections at its bottom: turn boxes on and off, and drag them into tabs.
- Change any shortcut, switch features off, or add [plugins](plugins.md).
- Settings follow you to every device with sync.

## Apps

- The website installs as an app and works offline.
- The Windows app keeps pages in one SQLite file, has quick capture and a tray icon, and updates itself.
- The Android app opens the website full screen and gets new versions with it.
