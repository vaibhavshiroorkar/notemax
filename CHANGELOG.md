# Changelog

Each finished step is a version, tagged in git as `v0.N.0`. Set a new number
with `pnpm version:set 0.N.0`.

## 0.57.0 (2026-10-23)

- A lighter start: the Word and EPUB writers and the Markdown reader load the first time they are needed, so the app downloads about 50 KB less before it opens.
- Tidied the code: helpers that nothing outside their file used are no longer exported, and an unused one is gone.

## 0.56.0 (2026-10-23)

- Sync no longer misses an edit when the app was closed by force right after typing: at start it looks for pages it never sent and pages edited around the last sync, and sends them.
- Edits go out as soon as the window is hidden or closed, instead of a few seconds later, so a phone that puts the app away still sends them.
- Quit from the desktop tray saves open pages and sends waiting edits before it closes (it never waits more than 8 seconds).

## 0.55.0 (2026-10-23)

- Settings, Setup: Keep pages on this device. Turn it off on a shared or borrowed computer: Notemax sends every waiting edit to your Google Drive, erases the pages from the device, and from then on gets them from Drive each time it opens and keeps them only in memory. Needs sync.
- Such a device sends edits within a second and asks before closing while one is still on its way. The search index stays in memory there too.
- Settings, Storage now says when sync keeps a copy in Drive, instead of "nothing leaves it".

## 0.54.0 (2026-10-23)

- Phones: search and menus no longer show keyboard shortcuts, so titles have room. Quick settings drop them too.
- Phones: opening Home or the account window from the sidebar puts the sidebar away first. Section titles in the right sidebar are easier to tap.

## 0.53.0 (2026-10-23)

- The right sidebar starts small: every section folded, and Format, Versions, Mentioned in, Graph and Pages inside off. The Sections button at its bottom turns any of them on or off.
- Drag a section by its title onto another to share that spot as tabs, or between two to give it a place of its own. The layout and what is open are kept, and follow you to your other devices.

## 0.52.0 (2026-10-23)

- Settings has a new look: a wider window, categories under headings (General, Writing, Account and sync, Your data, Advanced), and real on/off switches.
- On a phone, Settings opens on the list of categories. Tap one to open it, and Settings at the top goes back. Search shows its results right under the search box.

## 0.51.0 (2026-10-23)

- Special pages: give any page a job from its menu (Use as) or from Settings, Special pages. Daily notes can go into any folder, book or note, a note can be the template every new day starts from, and a start page can be where each new window opens.
- Daily notes can be titled 2026-10-23, Oct 23, 2026 or Friday, October 23, 2026. A day is still found by its date, so renaming one never loses it.

## 0.50.0 (2026-10-23)

- Videos in notes: paste or drop one, or pick it from `/` Video. It plays in place, can be set to a quarter, half, three quarters or the full width, and syncs with the note. Up to 200 MB each.
- Right-click a video to download it. Downloads of a note say where a video was; the Markdown files kept beside your notes keep the video itself.

## 0.49.0 (2026-10-23)

- Home opens over the whole window, from the house button at the top left, Ctrl+K "Go Home" or Ctrl+Alt+H. Esc, the close button or picking a page takes you back to where you were.
- On a phone, opening one sidebar closes the other, so they never cover each other.

## 0.48.0 (2026-10-23)

- The first start asks how you will use Notemax: on this device only (offline, no account) or on all your devices (online). Until you answer, everything stays on as before.
- Offline turns off sync, sharing and the account bar, even the parts that are normally always on. Settings, Setup changes it at any time and lists what each choice includes.
- A window can open on Home with all your workspaces instead of where you left off.
- Fixed: a middle click on a sidebar row did nothing when the list was long enough to scroll.

## 0.47.0 (2026-10-22)

- Settings follow you to every device with sync: theme, accent, fonts, text size, page width, paper, shortcuts, plugins, options, download format and the like. A change on one device shows on the others at once with live sync on.
- A new device starts with the settings you already made. Zoom, open sidebars, the workspace on show and sync itself stay with each device.

## 0.46.0 (2026-10-22)

- Copy or move pages to another workspace from the page menu (Copy to workspace, Move to workspace). What is inside them and their pictures go along, and links between them keep working.
- Moving puts the original in the trash here, only after the copy is stored, so nothing is lost if it fails.

## 0.45.0 (2026-10-22)

- Chapters have subtopics: pages inside a chapter, numbered 6.1, 6.2 and 6.2.1. The + on a chapter in the Chapters panel adds one, and the open chapter lists its subtopics there.
- Next and Previous at the end of every chapter and subtopic, and Ctrl+K "Next chapter" and "Previous chapter". The last one leads back to the book.
- A chapter can show its subtopics in its own page (This page, Subtopics: All in this page). Each one is still a page of its own, edited right there.
- The book page lists subtopics under their chapter, word counts include them, and book downloads carry them as headings under their chapter.

## 0.44.0 (2026-10-22)

- Phones: a hold in a note opens the menu and leaves the cursor and the keyboard where they were. A double tap selects a word. Lifting the finger after a hold no longer taps too.
- Phones: a hold on a sidebar row or a chapter only drags it; the ... button has the menu. Before, the hold also opened the sidebar's own menu.
- Chapters in a book's panel have a ... button with the page menu, in place of the trash button.
- The status bar at the bottom shows when something changes, then fades. Point at it to see it again. Trouble saving stays in view.
- Lists stay one list when a line between two parts is removed, so numbers keep counting and Tab can nest any item.

## 0.43.0 (2026-10-22)

- Code pages: write Python or JavaScript and press Run (or Ctrl+Enter). What it prints shows below, with how long it took. Stop ends code that runs forever.
- Code runs on its own, so a long loop never freezes the app. Python downloads once, the first time it runs.
- Download a code page as a .py or .js file.
- The + menu lists notes, folders and books. Boards and code pages sit under Others.

## 0.42.0 (2026-10-22)

- Voice typing: Ctrl+Shift+. (or Ctrl+K, or / Voice typing, or the mic above a phone's keyboard) writes what you say at the cursor. Words show while they are being heard and settle as each phrase ends. It keeps listening through pauses until you stop it.
- Works where the browser can turn speech into text: Chrome and Edge.

## 0.41.0 (2026-10-22)

- Ctrl+K finds words inside notes, not just titles, with the words around each match. Every word you type must be there, in any order.
- A Mentioned in section in the right sidebar lists pages that name the open page without linking to it, with the words around each mention.
- The search index builds in the background, updates as notes change here or on other devices, and is kept through a restart.

## 0.40.0 (2026-10-22)

- Split view: drag a tab to any edge of a page to open it in a new pane there, beside or below; the middle moves it into that pane. Ctrl+K "Split right" and "Split down" do it too, and a tab's menu has Move to a new pane.
- Each pane has its own tabs. A click in a pane makes it the one Back, Ctrl+W and opening pages act on. Drag the line between panes to resize them; a pane closes with its x or its last tab.
- The same note open in two panes stays in step as you type. The arrangement is kept through a restart. A phone shows one pane.

## 0.39.0 (2026-10-22)

- Daily notes: Ctrl+Alt+D (or Ctrl+K, Open today's note) opens the note for today, made in a Daily notes folder the first time. Yesterday's and tomorrow's too.
- A Calendar in the right sidebar: days with notes have a dot, pointing at a day lists its pages, and a click opens that day's note.
- Any page can have a date, set under This page, and it shows on the calendar.

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
