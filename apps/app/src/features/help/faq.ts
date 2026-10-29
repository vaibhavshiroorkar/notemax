import { formatShortcut } from "@/plugins/shortcuts";

export interface Question {
  q: string;
  a: string;
  /** Other words people search with, like "backup" for exporting. */
  words?: string;
  /** The Settings section that does it, offered as a button under the answer. */
  section?: string;
}

const key = formatShortcut;

/** The common questions, in the order a new person meets them. */
export const QUESTIONS: Question[] = [
  {
    q: "Where are my notes kept?",
    a: "On this device: in the browser's storage on the web, and in one file in the desktop app. Nothing leaves the device unless you turn on sync, share a page or post it.",
    words: "storage local data save disk",
    section: "storage",
  },
  {
    q: "Do I need an account?",
    a: "No. Everything works without one. Sign in only to sync between devices, share pages or use the community.",
    words: "sign in login register google",
    section: "account",
  },
  {
    q: "How do I use Notemax on more than one device?",
    a: "Sign in, then turn on Sync. Your pages sync through your own Google Drive, encrypted with a passphrase only you know.",
    words: "sync drive phone laptop devices google encrypted passphrase",
    section: "sync",
  },
  {
    q: "Can I work offline?",
    a: "Yes. Every page opens and saves with no network. Changes sync the next time you are online. Settings, Setup can also turn off everything online on a device.",
    words: "offline internet network airplane",
    section: "setup",
  },
  {
    q: "How do I make a note, a book or a folder?",
    a: "Use Create (the +) at the top of the sidebar, or right-click a row and pick Create. The ... button on a row makes the new page inside it.",
    words: "new create add page folder book board code",
  },
  {
    q: "How do I open files from my computer?",
    a: `Use Open (the folder button) at the top of the sidebar, or ${key("Mod+O")}. Markdown, text, Word, web pages, code files, pictures and Excalidraw drawings open as pages. The file on your computer is not changed.`,
    words: "import open file markdown word docx txt html picture",
  },
  {
    q: "How do books, chapters and subtopics work?",
    a: "A book holds chapters in order. A chapter can hold subtopics, numbered 1.1, 1.2 and so on, read on the chapter's own page. The right sidebar lists the chapters; drag them to reorder. A book's page shows its chapters as titles, previews or the full text.",
    words: "book chapter subtopic order numbering whole full text",
    section: "books",
  },
  {
    q: "How do I link pages together?",
    a: "Type [[ in a note and pick a page. The link keeps working when the page is renamed. Pages that link to the open one are listed in the right sidebar.",
    words: "link backlink wiki reference",
  },
  {
    q: "How do I find something?",
    a: `${key("Mod+K")} (or ${key("Mod+P")}) searches every page's title and text, and every command. ${key("Mod+F")} finds words in the open note, and ${key("Mod+H")} replaces them.`,
    words: "search find replace look palette",
  },
  {
    q: "What keyboard shortcuts are there?",
    a: `${key("Mod+/")} lists them all. You can change any of them in Settings, Keyboard shortcuts. Alt+Left and Alt+Right go back and forward, and so do the mouse's side buttons.`,
    words: "keys hotkeys shortcuts keyboard mouse back forward",
    section: "shortcuts",
  },
  {
    q: "How do I get back a page I deleted?",
    a: "Deleted pages go to the Trash at the bottom of the left sidebar. Open it and pick Restore. Right after deleting, Undo in the message at the bottom works too.",
    words: "trash delete restore undo recover bin",
  },
  {
    q: "How do I go back to an earlier version of a page?",
    a: "Open the page's Versions in the right sidebar, pick a time, and restore it. Settings, History sets how often versions are kept and for how long.",
    words: "version history restore older revert",
    section: "history",
  },
  {
    q: "How do I back up or export my notes?",
    a: "Settings, Downloads saves one page or everything, as Markdown, Word, web pages, plain text or EPUB. A page's menu has Download too.",
    words: "backup export download markdown word pdf epub save",
    section: "downloads",
  },
  {
    q: "How do I share a page?",
    a: "Use Share in the right sidebar's top row, or Share in the page's menu. A view link lets people read; an edit link lets them write with you, live. Stop sharing ends the link.",
    words: "share collaborate link together invite",
  },
  {
    q: "How do I post to the community?",
    a: "Make a username in Settings, Community profile, then pick Post to community in a note's or book's menu. Readers can comment publicly and send you private notes on the lines they highlight.",
    words: "community post publish public readers profile comments",
    section: "community.profile",
  },
  {
    q: "How do I keep a page private on a shared computer?",
    a: "Settings, Privacy sets a lock. Locked pages hide their text until the lock is opened, and lock again after a while away.",
    words: "lock password private hide privacy",
    section: "privacy",
  },
  {
    q: "How do workspaces work?",
    a: "A workspace is a separate set of pages, like Work and Personal. Switch at the top left. Double-click the name to rename it. Settings, Workspaces colors, orders and deletes them.",
    words: "workspace switch rename separate",
    section: "workspaces",
  },
  {
    q: "How do daily notes work?",
    a: "The calendar opens a note for any day. They gather in a Journal page, newest first. Settings, Special pages picks where they go and what each starts with.",
    words: "daily journal calendar today diary",
    section: "special",
  },
  {
    q: "How do to-dos and reminders work?",
    a: "Type [ ] at the start of a line for a to-do. Click its date chip to set a day, a time, a repeat and a reminder. All to-dos are listed in the Tasks view.",
    words: "task todo reminder due date repeat checklist",
    section: "reminders",
  },
  {
    q: "Can I see two pages side by side?",
    a: "Yes. Right-click a tab and move it to a new pane, or use the layout button in the right sidebar for up to four panes.",
    words: "split side by side pane layout two",
  },
  {
    q: "How do I change the look?",
    a: "Settings, Appearance has the theme, fonts, text size and accent color. Ctrl+= and Ctrl+- change the text size.",
    words: "theme dark light font size color appearance zoom",
    section: "appearance",
  },
  {
    q: "How do updates work?",
    a: "Settings, Updates checks for a new version. With Update automatically on, the website switches at its next start, and the desktop app downloads it and installs when you restart.",
    words: "update version new upgrade install",
    section: "updates",
  },
  {
    q: "How do I turn features on or off?",
    a: "Settings, Plugins lists every feature with a switch. Settings, How it works sets how opening pages, links and new tabs behave.",
    words: "plugins features turn off disable customize behavior",
    section: "plugins",
  },
  {
    q: "Is my data safe?",
    a: "Your pages stay on your device unless you sync, share or post them. Sync is end-to-end encrypted. Shared and posted pages live on the Notemax server, protected so only the right people can change them.",
    words: "security privacy safe encryption secure",
  },
];

/** Words of the question, its answer and its extra words, all lower case. */
const haystack = (question: Question) => `${question.q} ${question.a} ${question.words ?? ""}`.toLowerCase();

/** The questions holding every word typed, in any order. */
export function searchQuestions(query: string): Question[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return QUESTIONS;
  return QUESTIONS.filter((question) => words.every((word) => haystack(question).includes(word)));
}
