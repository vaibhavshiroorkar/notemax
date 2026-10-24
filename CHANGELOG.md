# Changelog

Each finished step is a version, tagged in git as `v0.N.0`. Set a new number
with `pnpm version:set 0.N.0`.

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
