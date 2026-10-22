# Changelog

Each finished step is a version, tagged in git as `v0.N.0`. Set a new number
with `pnpm version:set 0.N.0`.

## 0.38.0 (2026-10-22)

- Keep plain Markdown files: in Settings, Markdown files, choose a folder, and every note of the workspace is also a .md file there. Folders stay folders, books become folders of numbered chapters, pictures go in attachments/, and boards are .excalidraw files.
- Both ways: an edit made in another app comes back into the note, after the note as it was is kept as a version. A new .md file becomes a note, a renamed page renames its file, and a file deleted in the folder sends its page to the trash.
- A file another app wrote stays exactly as written until you edit that note in Notemax, so Obsidian-only syntax is not lost.
- Home: Open a folder turns a folder of Markdown files, like an Obsidian vault, into a workspace kept in step with it.
- Needs a browser that can keep folders (Chrome or Edge) or the desktop app.

## 0.37.0 (2026-10-22)

- A board's own tools no longer fade; they are the tools in hand.
- Open an .excalidraw file as a board: drop it on the app, right-click empty sidebar space, or Ctrl+K "Open an Excalidraw file as a board".
- Fonts: a searchable list with the presets, any font installed on your device by name (or listed, where the browser allows), and a font file you load.
- Page width is a slider in pixels, with a Full switch. Widths saved before still load.
- Zoom in the desktop app: Ctrl and the mouse wheel, or a slider in Appearance, separate from text size. In a browser, its own zoom does this.
- The default download format is a searchable list too.

## 0.36.0 (2026-10-22)

- Boards have tools like Miro's, in a row at the bottom: sticky notes in six colors, frames, and templates for Kanban, a retrospective, a brainstorm and SWOT.
- Vote on stickies: select them and press Vote, again to count up. Clear votes takes them all off.
- All of it is made of normal board shapes, so it saves, syncs, undoes and downloads like any drawing.

## 0.35.0 (2026-10-22)

- Share a note by link and write in it together. Right-click a note and pick Share..., or press Ctrl+K and type Share this page. Whoever opens the link gets the page in their own Notemax, no account needed.
- Edits go both ways live while the page is open on both sides, and the title follows a rename. Edits made apart meet up the next time both have it open.
- The line under a shared page's title says who else is there. Everything is sealed with a key that is only in the link, so the relay in between cannot read it.

## 0.34.0 (2026-10-22)

- Workspaces: separate sets of pages, like Work and Personal, each with its own tabs, recent pages and trash. Switch from the top left of the sidebar.
- Home lists every workspace as a card with its page count. Rename them, give them a color, drag them into order, start a new one, or delete one with its pages. Ctrl+K "Go Home" opens it too.
- Workspaces sync like everything else: the list and every workspace's pages reach your other devices.

## 0.33.0 (2026-10-22)

- Live updates: while sync is on, each edit also goes straight to your other open devices, sealed with your passphrase. An open note changes in place within a second, your cursor stays where it was, and a small notice says it was updated from another device.
- Because edits arrive almost at once, two devices rarely end up editing different versions of a note.
- Settings, Sync has a Live updates switch and shows whether it is connected. Drive stays the record, so anything missed live still arrives with the next sync.

## 0.32.0 (2026-10-22)

- Each sidebar row has a ... button that opens its menu, in place of the trash button. Move to trash is in that menu.
- On a touch screen a long press on a row no longer opens the menu, so it is free for dragging. The ... button shows all the time there.

## 0.31.0 (2026-10-22)

- When a note was edited on two devices before they synced, Notemax keeps both changes, says so with a toast and a line under the title, and asks: keep both, keep this device's, or keep the other device's. Review shows both sides next to each other.
- Each side is kept as a labelled version, and so is the merged note before you pick one side, so every choice can be taken back.

## 0.30.0 (2026-10-22)

- A Format section in the right sidebar of a note, like Word: paragraph style, font, size with - and +, bold, italic, underline, strikethrough, text color, highlight, alignment, line spacing, lists, indent and Clear formatting. It follows the cursor.
- Pasting from Word or Google Docs keeps headings, nested lists, bold, italic, links, sizes, colors and centering, and drops Office markup, bullet characters and empty lines.
- Copying out of a note hands Word the same: headings, lists, sizes and colors.
- Web page and Word downloads keep sizes, colors, fonts, alignment, spacing and indents.

## 0.29.0 (2026-10-22)

- The / menu groups its blocks (Basic, Lists, Blocks, Media), shows an icon and a short line for each, and finds them by initials or loose letters, like "bl" for Bulleted list. It fades in, and the pointer no longer steals the choice while you use the arrows.
- Typing "1) " starts a numbered list, like "1. ", at the number you typed.
- Tab indents a paragraph or heading and Shift+Tab pulls it back, as in Word. In a list they nest the item, and in a code block Tab types a tab. Tab no longer jumps out of the note.
- Graph dots are bigger the higher a page sits in the sidebar.

## 0.28.0 (2026-10-22)

- Version history for notes. Notemax keeps how a note was before you started editing, one version every 10 minutes of editing, and how you left it. Old versions thin out to one a day, then one a week.
- Versions sit in the right sidebar of a note. Click one to read it, then Restore it if you want. The note as it was before the restore is kept too.
- Versions sync and back up with your notes. Settings, History sets how often they are saved, or turns them off.
- Undo outside a note no longer steps through word counts and link lists.

## 0.27.0 (2026-10-22)

- The trash opens as a page of its own ("Open as a page" in the trash box, or Ctrl+K). It shows where each page was and when it was deleted, and has search, sorting, and Restore or Delete forever for several pages at once.
- Open a page from the trash to read it before restoring. A line under its title says it is in the trash, with Restore.
- Pages can leave the trash by themselves after 7, 30 or 90 days. By default they stay until you empty it.

## 0.26.0 (2026-10-22)

- When more tabs are open than fit, the rest fold into a "+N" button. Its menu switches to a hidden tab or closes it, and the open tab always stays in view.

## 0.25.0 (2026-10-22)

- Rename any page right in the sidebar: double-click its row, press F2 on it, or pick Rename from its menu.
- Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) undo and redo changes to your pages outside a note: new pages, moves, renames, tags and the trash. A note keeps its own undo while you type in it.
- No download button at the top right of a page. Right-click the page in the sidebar, or press Ctrl+Shift+E.

## 0.24.0 (2026-10-22)

- Pages can hold pages. Drop a note, board or book onto the middle of a note to put it inside, and the note keeps its icon with an arrow on hover.
- A "Pages inside" section in the right sidebar lists a page's sub-pages, with a button to add one.
- Books hold boards and other books. A book inside a book is a part: chapters number straight through the parts, and the book page and chapter panel show them a step in.
- Downloading a book puts each part in as a heading and each board in as a picture. Download everything keeps parts and sub-pages as folders.

## 0.23.0 (2026-10-22)

- Every row in the sidebar shows its icon where a folder shows its arrow, so all titles line up.
- Drop a page on the empty space below the list to put it last at the top level, even after an open folder.
- The Notemax logo is black and white, on the web and in the desktop app.

## 0.22.0 (2026-10-22)

- Bullet lists in notes show their bullets again.
- A shorter README with screenshots, and the code layout moved to docs/architecture.md.

## 0.21.0 (2026-10-22)

- Pages made in a browser before signing in are marked temporary, with a clock on their row and a line under the title, since only that browser has them.
- A notice at the top of the sidebar says why and offers sign-in. After sign-in the pages sync and keep the mark until you choose Keep or Keep all.
- Signing in on a new browser no longer throws away what you wrote in the Welcome note. It is kept as a page of its own.
- "Temporary only" in the sidebar filter panel, and a rowMarks slot for plugins.

## 0.20.0 (2026-10-22)

- Settings: switches stay on the right even when their text is long.
- Text size is a slider in Basics too, the same one as in Appearance.
- Settings fills a phone screen, and the close button has no ring on touch screens.
- The status bar stays between the sidebars and shortens its warning first.

## 0.19.0 (2026-10-22)

- "Linked from" moved from under the page to the right sidebar.
- A "This page" section in the right sidebar: what the page is, when it was made and last edited, its words and links, and a note's layout.
- The small graph sits at the bottom of the right sidebar.

## 0.18.0 (2026-10-22)

- Search page titles from the magnifier by +, or Ctrl+K "Search page titles". Matches inside folders show too.
- A funnel by + sorts the sidebar by title, newest or last edited, groups it by kind, and filters by tags or stars. The choice stays after a restart.
- Pages remember when they were last edited.
- The trash moved to a box at the bottom left, with its own search and Empty trash.

## 0.17.0 (2026-10-22)

- Pick several pages with Ctrl+click or Shift+click, then drag, star or trash them together. Esc lets go.
- Star pages to keep them at the top of the sidebar, from a right click, the star at the top right of a page, or Ctrl+K.
- Folder rows lose their icon and always show their arrow, with a guide line down each level.
- Middle-click a page in the sidebar to open it in a new tab.

## 0.16.0 (2026-10-22)

- An account bar at the bottom left: your name, how sync is going, a sync button and the Settings cog. A click opens sign-in and sync.
- Sync moves ten files at once, so a first sync takes seconds instead of minutes, and shows "Syncing 12 of 56".
- An edit made while its note was uploading is no longer skipped.
- Privacy and terms pages for the Google sign-in screen.
- Settings shows the version.

## 0.15.0 (2026-10-22)

- Sync through your own Google Drive, sealed with a passphrase.
- The web app installs on a phone, works offline, and has a phone layout.
- Tabs, boards, right-click menus, downloads, pictures and page layout. Mind maps are gone.

## 0.14.0 (2026-10-21)

- Tags, customization, Back and Undo, and faster big workspaces.

## 0.13.0 (2026-10-21)

- Plugins and the Ctrl+K palette.

## 0.12.0 (2026-10-21)

- Books get a chapters sidebar on the right.

## 0.11.0 (2026-10-20)

- The app's code is sorted into feature folders.

## 0.10.0 (2026-10-20)

- A / menu for headings, lists, to-dos and more.

## 0.9.0 (2026-10-20)

- Optional Google sign-in in Settings.

## 0.8.0 (2026-10-18)

- A README, CI and repo setup.

## 0.7.0 (2026-10-18)

- Books come back with their own page.

## 0.6.0 (2026-10-18)

- Settings, dark mode and delete forever. Folders replace the Inbox.

## 0.5.0 (2026-10-11)

- [[links]] between notes, and backlinks.

## 0.4.0 (2026-10-11)

- Quick capture and a tray icon.

## 0.3.0 (2026-10-11)

- The desktop app, with notes stored in SQLite.

## 0.2.0 (2026-10-11)

- The web app with an editor and a sidebar.

## 0.1.0 (2026-10-11)

- Core storage and the workspace tree.
