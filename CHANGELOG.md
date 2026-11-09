# Changelog

Each release is tagged in git as `v0.N.0`.

## 0.113.0 (2026-11-10)

- Faster sync. Through Google Drive an edit now reaches your other devices in about 2 to 3 seconds, down from about 8. One too big for live updates, like a long paste, takes about 3 seconds instead of 12.
- Sending and fetching run at the same time, so a slow fetch no longer holds an edit back, and a failed one no longer stops it going out.
- When an edit could not go live, your other devices get a nudge and fetch it at once instead of at their next check. Without live updates they check every 5 seconds instead of 10.
- Starting the app no longer waits for a new Google Drive key when the last one is under an hour old.
- Shared workspaces send edits after 0.6 seconds instead of 1.
- On a weak connection the web app opens from the copy it keeps after 1.5 seconds, instead of waiting on the network.

## 0.112.0 (2026-11-09)

- Share a whole workspace. From the workspace menu, Share this workspace. Invite people by email as Viewer, Editor or Admin. Admins invite and remove people too; only the owner adds admins or stops sharing.
- Anyone with the link: Off, Can view (no account needed) or Can edit (signed in). Make a new link to stop the old one working.
- People you invite find the workspace on Home, under Shared with you, once they sign in with that email.
- Changes reach everyone within moments. The shared copy is kept on the Notemax server, encrypted, so it opens while the owner is offline. Files over 6 MB, like long videos, stay on your devices.
- Viewers see View only next to the workspace name. Its pages and boards take no edits, and anything changed anyway is put back.
- Needs the new database migration, supabase/migrations/20261109000000_shared_workspaces.sql.

## 0.111.0 (2026-11-09)

- Drawings inside notes. Type `/drawing` (or `/draw`, `/sketch`) in any note, chapter or journal entry for a small Excalidraw board right in the page. It opens ready to draw; Done or a click elsewhere puts it down, and it then shows as a picture that scrolls like text. S, M and L set its height, and Full screen gives it the whole window.
- The drawing is kept in the note itself, so copying the block, duplicating the note, templates, version history and the Markdown folder all carry it.
- Boards are plain Excalidraw again: the sticky note, frame, template and vote buttons are gone. Shapes already made with them stay on the board as ordinary shapes.

## 0.110.0 (2026-11-09)

- Journals. Create, Others, New journal makes a page that holds one entry per day, newest first and without numbers. Instead of Add subtopic it has Next date, the day after the latest entry (or today when there is none), and Choose date. A day that already has an entry opens instead of being made twice. The Journal for daily notes works the same way.
- Any note can put its newest subtopics on top: This page, Order, Newest on top, or Page options. Numbers count down, so each subtopic keeps its number, and Add subtopic moves above them.
- A page in a book can go without a number, like a prologue or an interlude, anywhere in the book: Leave without a number in its menu. The chapters around it count on as if it were not there.
- Workspaces are on Home, in place of Quick start. Each card can lock its workspace or delete it.
- Lock a whole workspace from the top-left menu. Its list, pages and Home cards stay hidden until the lock password is typed, the same password as locked pages.
- Delete a workspace from the top-left menu too. You type its name first, and the open one makes way for another. The first workspace stays.
- Find and replace has a button in the right sidebar's tools.
- The word count sits at the bottom right of the right sidebar, for every note and book, with the reading time when you point at it. The status bar no longer repeats it.
- Sections has its own icon. Sidebar rows keep their marks in one column at the right, and their buttons take the marks' place while pointed at. The Temporary clock shows only once sync is on.
- Sync is quicker: edits go out about a second after typing stops, and while the window is on screen it checks for other devices' edits every 10 seconds. At start it syncs before its slower search for edits that were never sent.
- Every button lines up its icon and words the same way, and many empty and intro texts are shorter.
- New docs in the docs folder: an overview, the project's history, every feature, how data and sync work, development and releases, and the decisions behind it all.

## 0.109.0 (2026-11-01)

- Notemax for Android. Get the app now has a Download for Android button with an APK (about 1 MB, Android 7 or newer, with Chrome). It opens Notemax full screen, with sign-in, sync, offline pages and reminders working as they do on the website, and it gets each new version of the site without a reinstall.
- `pnpm android:release` builds and signs the APK. The site now carries /.well-known/assetlinks.json, which lets Chrome show the app without an address bar.

## 0.108.0 (2026-11-01)

- The downloads are now a tab inside Notemax, Get the app, instead of a separate web page. The corner card, the palette and notemax.pages.dev/download all open it.
- Home has a Get the app card with a Download button.
- In the tab, the card for your own device comes first. Windows gets the newest installer with its version and size. Android gets the app file once it is out, and the browser install steps meanwhile.
- The desktop app has the tab too, for getting Notemax on your phone.

## 0.107.0 (2026-11-01)

- The browser version offers the app. On Windows and Android, a card in the corner says so once, after a short wait. "See the downloads" opens a new page; "Not now" or the close button puts it away for good.
- The new page, /download, has the Windows installer (always the newest, with its version and size) and the steps to install Notemax on an Android phone. Chrome on Android gets a one-tap Install button there. An APK is still to come.
- The palette has "Get the Windows or Android app" for later.

## 0.106.0 (2026-10-30)

- Who did what to a page. Each version says whose changes it holds ("by Ana", "by You"), including edits from people you share a page with. Under Versions, a new Activity list puts it all in order, newest first: who edited the page, and who renamed it (one entry, from the old title to the new), moved it, trashed it or took it out, restored a version, settled a conflict between devices, shared it or locked it. Each line has the time and the device.
- A name shows when that person was signed in; otherwise the device does, like "Chrome on Android". Your own changes on this device say "You".
- Boards, code and other pages have the Activity list too. Only notes have versions.
- The log keeps the last 500 things done to each page, and it syncs and backs up with the page's versions. When old versions thin out, the names in them move to the next version kept, so nobody drops out of the record.

## 0.105.0 (2026-10-30)

- Phones: the chapter bar is gone. A chapter shows its book, its place and the arrows at the top of the page, as on a computer. Two bars are left: the tabs and the formatting bar.
- Phones: a new choice for the bars, "Bottom, scrolling up". The formatting bar slides away while you scroll down and comes back as soon as you scroll up, or when you start writing. The page moving by itself as you type does not hide it.
- Clear formatting with nothing picked is the way out of Bold, a bigger size and the rest: what you type next is plain, and the words already written keep their formatting.
- Books choose what to call their chapters (Part, Lesson, or no word at all) and how to number them: 1 2 3, I II III, or none. The button is beside the book's views. Subtopics follow, as II.1 or unnumbered, and so do the Add button, the count and the line at the top of each chapter.
- Icon buttons no longer squeeze their icons: a button's own padding had left a 16px icon 12px wide. The left sidebar's icons now sit on one line down each side, on a computer and a phone, and the phone's bars start their icons at the same place.

## 0.104.0 (2026-10-30)

- Phones: the button that picks which bars stay while scrolling sits at the start of the formatting bar (or the reading tools). On a page with no tools bar, like a board, it stays in the bar above. A note outside a book no longer shows an empty bar there.
- Clear formatting has its own icon, a T with a small x, instead of a close cross. With nothing picked it clears the line the cursor is in. Phone and desktop clear the same things: marks, size, font, alignment and line spacing.
- Indent and Outdent do what Tab does, on phones and in the Format panel: nest list items, or indent a line. The phone's align button reaches justify too.
- A double-click on a sidebar's edge eases it back to its usual width, with the edge, the column and the sidebar moving together. Opening and closing a sidebar ease the same way.
- New pages go at the top everywhere when Settings, How it works says so: from a row's menu, from a [[link]], from Sub-pages, a dated page, a shared page, and pages of another workspace.
- Smaller, shared pieces behind the scenes: one check for phone width and touch, one for the Mac's Cmd key (Ctrl+Z on a Mac no longer undoes page moves), one for typing in a field, one for closing menus on a click outside or Esc, and one way to say what went wrong.

## 0.103.0 (2026-10-30)

Keeping pages safe, from a review of how Notemax saves and syncs.

- Search page titles in the sidebar works again for words with an "s" in them; it split the search on the letter s.
- Turning on sync no longer clears the other workspaces of a device whose main workspace held only the starter pages. Any workspace of its own means its pages are merged with the account's.
- Markdown folder: a file renamed in another app renames its page, instead of sending it to the trash and bringing it back as a copy. Two pages of the same name that swap places keep their files. A new file is never brought in twice, and edits made while files are written go out on the next look.
- A device that keeps no pages reads back the files only it sent to Drive, instead of starting empty and writing over them. Only one tab can hold its pages; a second says it is open elsewhere.
- "Saved" now means every page on screen is saved, subtopics included, and a subtopic that cannot save says so.
- A page closed while saving fails keeps trying until it is saved, without saving twice. Erasing pages, or a workspace, stops every window's copy first.
- Quitting with an update waiting saves and sends everything before the update installs; Install now does the same.
- Old pages leave the trash only after this device has synced, so a page restored on another device is not erased here.
- Stopping keeping pages on this device saves the last keystrokes first, and asks to close other tabs before erasing.
- Errors that were silent now show: a version that could not be restored, a conflict that could not be kept, a sync that could not start, a link that could not be copied.
- The browser's database is asked to write to disk before a save counts, and is opened again if the browser closes it.
- Supabase: supabase/migrations/20261030000000_rate_limit_indexes.sql adds indexes the community's limits read on every message and comment. Run it once in the SQL Editor.

## 0.102.0 (2026-10-29)

- Phones: the tabs, the chapter bar and the formatting bar ride at the top of the page. By default only the formatting bar stays while you scroll. The button with a small screen on it, under the tabs, steps through none, bottom, bottom two and all three; Settings, How it works has the same choice.
- Phones: a post's reading tools sit in that bottom bar, and picked lines put Note to author and Comment there, clear of the phone's own menu.
- Zoom and the bar choice replace their last message instead of piling up toasts.

## 0.101.0 (2026-10-29)

- Phones: selected text in a note drags again. Select it first, then hold the selection and move it. A hold on words not yet selected still only selects them.

## 0.100.0 (2026-10-29)

- Ctrl+= and Ctrl+- zoom the whole app, and Ctrl+0 resets it. In the desktop app, Ctrl++ and the keypad's + and - work too, and a toast says the size. In a browser these keys are the browser's own zoom again.
- Text size moves to Ctrl+Shift+. and Ctrl+Shift+, (Ctrl+> and Ctrl+<, as in Word). Voice typing moves to Ctrl+Shift+M.
- New keys: Ctrl+N for a new note in the desktop app (Alt+N on the web), Alt+S to star the open page, Ctrl+Delete to move it to the trash (outside text, with Undo), and Alt+PageDown and Alt+PageUp for the next and previous chapter.
- Books: the separate Chapters only button is gone. The book page offers Chapters (titles only), Outline (chapters and subtopics), Previews and Full text.

## 0.99.0 (2026-10-29)

- Private notes to the author: pick lines in a post and choose Note to author, or send a note about the whole post. Only the author and the reader see it. The author finds them in Notes from readers, in the right sidebar of the page they posted; clicking the lines opens the page with them found.
- Pick lines and choose Comment to quote them in a public comment.
- Reading: text size, serif or not, a wide column, a line showing how far you have read, the reading time, Contents for books, and each post opens where you left off.
- Security: posts may only use the classes they are written with; the site sends HSTS and a stricter opener policy; new limits on the server (30 new posts a day, lengths for page ids and picture links); reader notes count toward the 20-a-minute limit.
- Find closes with its note, and Esc closes it from anywhere.
- Needs supabase/migrations/20261029000000_reader_notes.sql run once in Supabase; until then private notes stay hidden.

## 0.98.0 (2026-10-29)

- Settings, Help: the common questions with short answers, searched as you type, each with a button to the setting it talks about. The Welcome tab links to it.
- Settings, Updates: the version, Check for updates, and Update automatically (on at first). The website switches to a new version at its next start. The desktop app downloads signed updates from notemax.pages.dev/desktop and installs them when it restarts or quits.
- Settings, How it works: whether sidebar pages and links open in this tab or a new one, what a new tab shows (Home, Search or a new note), whether new pages go at the end or the top, and the Welcome tab.
- `pnpm desktop:release` builds and signs the Windows installer and writes latest.json for the updater. The signing key stays outside the repo.

## 0.97.0 (2026-10-29)

- A new workspace starts empty: no starter notes. It opens a Welcome tab once instead, which is not a page and leaves nothing in the sidebar.
- The website starts online without asking. The desktop app still asks once.
- Rename the workspace at the top left: double-click its name, or Rename in its menu.
- The Community button is back at the top left, beside the workspace. Share has an icon of its own.
- The chapter list in the right sidebar follows the book's view: in Previews and Full text it scrolls the book's page instead of leaving it, and in Full text it marks the chapter being read.
- Less text on screen: shorter empty states, no storage warning in the status bar, no line under temporary pages, no greeting on Home.

## 0.96.0 (2026-10-29)

- Back and Forward buttons beside the sidebar button, and Alt+Left and Alt+Right (the mouse's side buttons and Ctrl+[ and Ctrl+] already worked).
- Find in a note with Ctrl+F, and replace with Ctrl+H: match count, next and previous, match case, replace one or all (one Undo puts them back).
- Keys from other apps: Ctrl+1 to Ctrl+9 for tabs, Ctrl+PageUp and Ctrl+PageDown, Ctrl+P to search, Ctrl+O to open files, Ctrl+S says it is saved, F11 for full screen in the desktop app.
- Arrow keys move between rows in the sidebar; Right and Left open and close.

## 0.95.0 (2026-10-27)

- Community chat: direct messages with an unread count on the Messages button, topic rooms anyone signed in can start (three a day) and write in, and comments with one level of replies under posts. Profiles have a Message button.
- Blocking someone stops their messages and their comments under your posts. A post's author can delete comments under it.
- Needs supabase/migrations/20261025000000_community_chat.sql run once in Supabase; until then chat says it is not set up and posts show no comments.

## 0.94.0 (2026-10-25)

- The page's tools (word count, star, copy all, share, links, split layout) sit in the right sidebar's top row with search and one settings gear. The top bar keeps only the right sidebar button.
- The sidebar's + is now Create, and an Open button beside it opens files from the computer. Open's file kinds say "files", so none reads like a new note.
- No more "Create inside": Create from a row's right-click goes after the row, and from its ... button, inside it.
- Subtopics drag in "On this page" and in the subtopic box: drop on the top or bottom of one to go before or after it, in the middle to go inside it.
- In a heading, Bold shows as on and can't be pressed, since heading text is bold already.

## 0.93.0 (2026-10-25)

- Search, copy all, sharing, community, and settings live in the right sidebar. Home ends at Bookmarks, and starred pages keep their row markers without a second sidebar list.
- Phone navigation stays put while editing. An arrow hides or reveals the tabs, chapter navigation stays above formatting, and font sizes have a number menu.
- Back dismisses a page's More menu without changing its address.
- The account window has an online/offline switch and stays available in either mode. Its content fits and scrolls on phones.
- Versions scroll after five rows. History settings control saving frequency, age, and count limits. Recovery snapshots remain available.
- Sync conflicts show a single Review button, with recovery choices inside the dialog.
- Browser pages run in the desktop app. Saved browser pages on the website offer a link to open the site separately.
- Desktop browser views keep their size and position when switching workspaces or zooming.
- Right-click menus: Open opens files from the computer, Create makes pages. On a page's row Create puts the new page right after it.
- The word count sits left of the star in the top right.

## 0.92.0 (2026-10-25)

- Right-click Open now opens files from the computer as pages: notes (Markdown with its front matter title, text, Word .docx, saved web pages), code files as code pages in their language, pictures as a note holding the picture, and Excalidraw drawings as boards. On a page's row they go right after it; on empty space, at the end. The files themselves are only read.
- Making a new page is back under New, on empty space, and New inside on a page's row.
- The Delete key moves the picked rows, or the row the keyboard is on, to the trash, with Undo. It never does while you type.

## 0.91.0 (2026-10-25)

- Desktop app, browser pages: when the web view steps aside for a dialog or menu, the space shows the page's own colors and the site's name instead of a white sheet.

## 0.90.0 (2026-10-25)

- Desktop app, browser pages: the web view steps aside whenever anything of Notemax is drawn over it, like a dialog, a menu, the palette, quick settings or a reminder, found by looking at what is on top across its box rather than by a fixed list. Toasts go under it instead of blanking it.
- The view hides while a tab is dragged, so a tab can be dropped on a browser page to make a split.
- The view is told to move only when its place changes, at most once a frame, which stops it flickering while dialogs open and close.

## 0.89.0 (2026-10-25)

- Google opens in browser pages on the website too. Google refuses to show inside other pages unless the address carries igu=1, so Google's home and search pages get it. Typed searches go to Google instead of Bing.

## 0.88.0 (2026-10-25)

- Phones: note text is a step smaller (15px instead of 16), and so is the title.
- Phones: the formatting bar sits at the top, under the tabs, and stays while a note is open. When the top bar slides away on scroll, the formatting bar moves up and stays. It now also has underline, strikethrough, highlight, smaller and bigger text, alignment, quote, code block and clear formatting, scrolls sideways, and works in subtopics too.
- Phones: a Share button joins search, copy all and settings in the top bar. The red storage warning no longer covers the page.
- Format shows real values instead of "Default": the note's font by name, and the size of the text at the cursor. Line spacing says Normal.
- Books: "Chapters only" on the book page leaves the subtopics out of the chapter list. Each book keeps the choice.
- Splits: clicking into a pane that was not the active one no longer redraws its page, so the click and the typing land. Notes, code, browser pages, boards and books all work side by side.

## 0.87.0 (2026-10-25)

- In the desktop app, a browser page is a real web view instead of a frame, so Google and other sites that refuse frames open. Searches typed in the address bar go to Google there.
- Links and buttons that would open a new window open in the same view, so you stay in the page. Back, Forward and Reload use the view's own history, and the address bar follows where it goes.
- The view steps aside while a menu, dialog or the palette is open, and follows its box as the window and splits change.
- The address bar shows the address after Enter, not the words typed.
- On the website, Google still cannot show inside a page: it forbids other sites from framing it. Searches there go to Bing.

## 0.86.0 (2026-10-25)

- Alt+Up and Alt+Down move the paragraph, heading or list item the cursor is in, up or down, and the cursor goes with it. A list item moves within its list. Code pages move the line, as before. Both are in the shortcut list.

## 0.85.0 (2026-10-25)

- A first visit asks "How will you use Notemax?" in a window over everything: on this device only, or on all your devices. "Not now" puts it off until the next start. It used to sit at the top of the left sidebar.
- A new workspace starts with a Notemax folder holding Welcome, Journal and My first book. The drawing board is gone from the starter set.
- Subtopics stay a choice per note; the Journal is a note with it turned on.
- Signing in to an account that already has pages takes the account's pages and adds none of the starter pages to it, unless you wrote in one: that one is kept.

## 0.84.0 (2026-10-24)

- A page's subtopics show in one sidebar at a time. While "On this page" lists them on the right, the left sidebar leaves them out; close the right sidebar and they are back on the left.
- A line above each subtopic parts it from the text before it.

## 0.83.0 (2026-10-24)

- Home is calmer: each card is a section with a plain title and a line above it, instead of a boxed card with a capitalised label.
- Card titles open their full view as a page: Today opens Tasks, Recent pages and Bookmarks open full lists (with where each page sits and when it changed), and Journal opens the Journal.
- A new This week card shows the seven days with how much each holds. Its title opens the calendar as a page: a whole month, each day with its journal entry, dated pages and to-dos. The sidebar calendar has a button to open it too, and so does "Open the calendar".
- The Bookmarks page takes a page out with its star.

## 0.82.0 (2026-10-24)

- Browser pages: a web page inside a page, from + Others or Open. Type an address, or words to search Bing. Back, Forward and Reload, and a button to open the site in a new window.
- The address syncs with the page, so it opens at the same place on every device. A page with no name takes the site's.
- Put one beside a note with Open in, To the right, to read and write side by side.
- Some sites refuse to show inside other pages; the page says so and offers the new window. Notemax's own pages are never framed.
- The desktop app uses the same frame for now. A separate desktop web view is left for later.

## 0.81.0 (2026-10-24)

- C++ runs in code pages. Clang, built for WebAssembly by YoWASP, comes from jsdelivr the first time (about 23 MB, with a download bar) and the browser keeps it. Input feeds std::cin. A mistake shows Clang's message with its line.
- Java runs too, on TeaVM's build of javac for WebAssembly (about 7 MB the first time). The app serves those files itself, under /runtimes/teavm/, with their licences in NOTICE.txt. A mistake names its line.
- scripts/fetch-runtimes.mjs downloads the Java files before dev and build, checked against fixed hashes, and keeps them out of git.

## 0.80.0 (2026-10-24)

- Code pages use a real code editor (CodeMirror): line numbers, colors, auto-indent, matching and closing brackets, folding, search, and Tab to indent. It syncs and merges like a note.
- New languages: TypeScript, SQL, C++ and Java, beside Python and JavaScript. TypeScript and SQL run too. C++ and Java are colored for now.
- SQL runs on SQLite in the page. Each page keeps its tables for as long as the app is open; "Run from empty" starts over. Results show as tables.
- An Input box feeds input() in Python and input() or prompt() in JavaScript, a line at a time.
- Downloads of a code page in every language: .py, .js, .ts, .sql, .cpp, .java.
- Code blocks in notes are colored by their language, with a language picker and a copy button.

## 0.79.0 (2026-10-24)

- Lock a page from its menu (Page options, Lock page). A locked page asks for the lock password before it shows. One password opens every locked page, on all your devices.
- While locked, its text stays out of search, Mentioned in, the Tasks list, inline subtopics, a book's Previews and Full text, and its versions. Its menu leaves out Copy all text, downloads, sharing and posting.
- Locked pages close again with "Lock again" under the title, "Lock pages now", after 5 minutes without a key press, or when the app closes.
- Settings, Privacy: set or change the lock password. A forgotten one can be let go by typing the workspace's name; locked pages stay locked for the next password.
- This lock keeps out casual eyes. It is not encryption: the text stays on the device as it was.

## 0.78.0 (2026-10-24)

- Reminders. A to-do with a time rings at that time. Its date chip can ring earlier (5 minutes to a day before), on a day with no time (at 9:00), or not at all.
- A reminder shows as a card at the bottom right with Done and Later (10 min, 1 hour, tomorrow), and as a system notification when allowed. The desktop app shows them through Windows, even with its window closed to the tray.
- One missed while Notemax was closed rings when it opens, if it is less than a day old. Each rings once.
- Settings has a Reminders section, with a button to allow notifications in the browser.

## 0.77.0 (2026-10-24)

- To-dos can have a day, a time, a repeat and a priority. Type them in plain words, like "call mum tomorrow 5pm", "water plants every monday" or "fix the leak !!". The words are marked while you type, and leaving the line turns them into a small chip. Click the chip to change the day, time, repeat or priority.
- A new Tasks page (Ctrl+Alt+T, or "Open tasks") lists every to-do in the workspace: Overdue, Today, Upcoming, No date, and Done folded away. Ticking one there ticks it in its note.
- Ticking a repeating to-do moves it to its next day instead, in the note or on the Tasks page.
- Home has a Today card with what is overdue and due today. The calendar marks days with to-dos due and lists them under the picked day.
- Quick capture: lines that start with [ ] go to an Inbox note as to-dos, with their dates read.
- Markdown keeps a to-do's date as tags, like "@due(2026-10-25 17:00) @repeat(week) !!", and a Markdown folder reads them back.

## 0.76.0 (2026-10-24)

- Right-click Open lists the kinds of page: Note, Folder, Book, Board, Code page. Each makes that page and opens it. On a page's row it goes right after that page; on empty space, at the end.
- The tab choices moved to Open in: This tab, A new tab, To the right, Below.
- A book's page shows its chapters as Titles (at first), Previews (the first lines of each chapter) or Full text (every chapter written out). Each book keeps its choice.

## 0.75.0 (2026-10-24)

- The Journal is one page now, with each day inside it as a subtopic, newest first. A new workspace's Journal starts with today's entry.
- A day's entry gets its id from the date, so two devices that both start today's note end up with one note, not two.
- The calendar picks a day on a click instead of opening it. Below the month it shows that day's journal entry (or Write in journal), the pages dated that day, and "+ Add a page for this day". A double click or Enter opens the entry.
- A folder's Page options has "Turn into one page": it becomes a note that shows what was in it as subtopics. Nothing moves. An old Journal folder keeps its days newest first.
- Sort by has "Newest day first".

## 0.74.0 (2026-10-24)

- Any note can show the pages inside it as numbered subtopics on its own page, the way a book chapter does. Turn it on from the page menu (Page options) or the right sidebar's This page. It is off at first.
- In the left sidebar, a note with more than five subtopics lists them in a box of their own, with a filter and a scroll. A click goes to that subtopic on the note's page.
- The right sidebar has "On this page" for such a note, to jump between its subtopics or add one.
- In a book's chapter list on the right, only the chapter you are reading shows its subtopics. The others are folded, and an arrow opens any of them.

## 0.73.0 (2026-10-24)

- Switching workspace is instant and no longer reloads the window.
- Open tabs stay open when you switch. A tab from another workspace shows its name beside the title, and its page still works: you can write in it, add pictures, keep versions and use its menus, and everything saves in its own workspace. A line above the page says where it is from, with a button to show that workspace in the sidebar.
- Copying or moving a page to a workspace that has a tab open shows up there at once.

## 0.72.0 (2026-10-24)

- Split view has a layout button at the top right: one pane, two side by side, two stacked, three (one left, two right) or four in a two by two grid. Tabs from panes that no longer fit move into the last pane, so nothing open is lost.
- A page menu can open a page to the right or below, next to what is open. Notes, code and boards work in any pane.
- Four panes is the most. With four, dropping a tab on an edge moves it into that pane, and Open to the right uses a tab of the next pane.

## 0.71.0 (2026-10-24)

- Two versions of a note show what differs, in color: red for what went, yellow for a line worded differently with the changed words marked inside it, and green for what came. A legend counts each.
- Reviewing a sync conflict opens on the differences between this device and the other one. Side by side is a click away.
- A version in history has "Changes since", which shows what was erased, changed and written after it.

## 0.70.0 (2026-10-24)

- A sync conflict can be settled from the line under the title in one click: keep what you see, keep this device's side, or keep the other's. Review still shows both sides first.
- The Others flyout of the + menu shows in full beside the menu. The sidebar used to cut it off and scroll sideways.
- Right-click menus gather what a page can do into flyouts: Open (in a new tab), New inside (every kind the page can hold), Share, and Download with the formats right inside. Empty sidebar space has a New flyout with every kind.
- The trash count sits beside the bin instead of on it, and the trash box says less: Empty, an open-as-page button and a shorter search.
- Typing in a big workspace is faster: the sidebar tree now rereads only the pages a change touched. With 5,000 pages, typing in a title went from about 38 ms a key to 16.

## 0.69.0 (2026-10-24)

- Sort by sits right on a folder's menu: title A to Z or Z to A, newest or oldest first, or the order you drag. A sorted folder shows a small mark on its row that says how. New folders keep the order you drag; the starter Journal sorts A to Z.
- The community rules migration can run again safely: each part replaces what an earlier run made.

## 0.68.0 (2026-10-24)

- Home is a page of cards: Quick start, Recent pages with when each was edited, Bookmarks, Books with their chapters and words, Journal with today's note and the last few days, and Workspaces.
- Customize on Home turns cards off and on, moves them up and down, and picks one column or two. The arrangement follows you to your other devices. A phone always shows one column.
- Plugins can add Home cards of their own.

## 0.67.0 (2026-10-24)

- Sharing a page makes two links: Can edit, to write in it together, and Can view, to read it as it changes. Edits are signed with a key only edit links carry, so every copy refuses changes from a view link, even ones forced in by hand.
- A page opened from a view link is read-only and says it is shared to read. Pages shared before keep their link, which lets everyone edit; the share window can replace it with a new pair of links.

## 0.66.0 (2026-10-24)

- Your community username is in the account window and in Settings (Community profile): pick one there, or change it and your name and bio.
- On a phone, holding a finger on text in a note selects it with the phone's own handles instead of starting a drag with a jumping drop line. Text moves by cut and paste there; a mouse still drags.
- Each workspace's tabs are saved the moment you switch away or close the window, so they all come back when you return.

## 0.65.0 (2026-10-24)

- A list started with "1) " keeps its parenthesis: it counts 1), 2), 3) in the note, in downloads and in community posts, instead of turning into 1.
- Backspace right after any typing shortcut (a list, heading, quote, code block, bold and the rest) gives back exactly what was typed. It used to be lost when the shortcut was on the last line.

## 0.64.0 (2026-10-24)

- A new workspace starts with Welcome, a Journal folder where the calendar puts daily notes, a Drawing board, and My first book with a chapter and a subtopic, each with a few words on how it works. Two new devices that sync end up with one set.
- Folders can sort what is in them: by title either way, newest or oldest first, or the order you drag. The Journal sorts by title, so dated notes read in date order.
- Page menus are shorter: Copy, Page options, and Share and download open as flyouts. A flyout opens beside its menu, flips left near the edge of the screen, and on a phone takes the menu's place with a Back row.
- The right sidebar is a column of boxes. Each section shows open in its box; drop one on another to make tabs there. The Sections tray at the bottom adds and hides them, and new sidebars start with only what a page needs.
- Fixes from a review: a loop in the page tree that includes a book no longer stops the workspace opening, community posts are cleaned more strictly, the community gives plain errors and asks for a username before following, and the desktop sign-in ignores requests web pages send.
- The built app has a Content Security Policy, so text from other people cannot run as a script.
- Dependency advisories in the board library's packages are fixed by pinning newer versions.

## 0.63.0 (2026-10-24)

- Subtopics live inside their chapter: 7.1, 7.2 and 7.3 show in chapter 7's page, each with its number, title and text. The right sidebar lists every chapter's subtopics, and clicking one, or a link to it, opens the chapter and scrolls there.
- Each subtopic has its own ... menu, with Move to trash, Move out of book and a new Make it a chapter. Every chapter ends with Add subtopic.
- Books no longer hold parts, and nothing inside a book can be a book or a folder. Old parts show beside their book with everything in them.
- Dropping a page on the middle of a chapter in the right sidebar makes it a subtopic.

## 0.62.0 (2026-10-23)

- The Community page opens on a welcome and the latest posts instead of a search box. The newest post is featured, and each card shows its reading time and whether it is a book.
- A side column shows you (or a way to sign in or pick a username), how to post, popular tags and writers to follow. On narrow screens it follows the feed.
- Search is a button at the top that opens a box when you need it.

## 0.61.0 (2026-10-23)

- Bookmarks: starred pages sit in a Bookmarks section below your notes, and show a filled star there and in the notes list.
- Home and Community each open as a page of their own from the two buttons at the top left. With every tab closed, Home shows in the middle.
- Copy all: a button at the top right of a note (on phones too), in its menu and in Ctrl+K, copies the whole note with its formatting.
- Phones: a long press in a note selects text the phone's own way again; the app's long-press menu is gone. The ... menu no longer picks an item with the tap that opened it.
- A little less space between paragraphs.
- Community setup fixed: the tags search column now builds on Postgres.

## 0.60.0 (2026-10-23)

- Three-dot menus beside chapters, parts and subtopics on book pages, in Whole book and in the chapter sidebar.
- Move out of book returns a page to Notes with its text and children intact. Existing page actions are available from the same menu.

## 0.59.0 (2026-10-23)

- Community: a people button beside Home opens it over the whole window. Read everyone's posts, or only the people you follow, and search posts and people.
- Post a note or book from its menu (Post to community...). Readers see it as it was when you posted; later edits stay private until you update the post, and you can take it down any time. The first time, you pick a unique username and confirm the work is yours to post.
- Profiles show the name, a few words, posts, followers and following, with Follow and Edit profile.
- Someone else's post can never run code in your app: only plain formatting, web links and https pictures show.
- Needs the community tables on the server (supabase/migrations/20261023000000_community.sql). Off on devices set up to work offline.

## 0.58.0 (2026-10-23)

- A book has text of its own: write a description above its chapters. Parts (books inside a book) have one too. Downloads of the book start with it.
- Whole book: switch a book page from Chapters to Whole book to see every part, chapter and subtopic on one page, in order, and write in any of them right there. Chapters further down load as you scroll near them.
- Previous and Next show arrows pointing their way, at the end of each chapter and as arrow buttons in the book line at the top of each chapter.
- Phones: the top bar slides away while you read down and comes back as soon as you scroll up a little, with the book line and its arrows, so going back is always near.
- The Home button sits to the left of the workspace name, and is no longer in the workspace menu.

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
