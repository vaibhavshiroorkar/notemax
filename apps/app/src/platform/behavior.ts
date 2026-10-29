import { savedStore } from "./store";

// How Notemax behaves, where people differ. Each starts the way the app
// always worked, and Settings, How it works changes it.

const oneOf = <T extends string>(choices: readonly T[], fallback: T) => ({
  decode: (raw: string) => (choices.includes(raw as T) ? (raw as T) : fallback),
  encode: (value: T) => value,
});

export type Where = "here" | "new-tab";
const WHERE = ["here", "new-tab"] as const;

/** Clicking a page in the sidebar. A middle click always opens a new tab. */
export const sidebarOpens = savedStore<Where>("sidebarOpens", "here", oneOf(WHERE, "here"));

/** Clicking a [[link]] or a backlink. */
export const linksOpen = savedStore<Where>("linksOpen", "here", oneOf(WHERE, "here"));

export type NewTabShows = "home" | "search" | "note";
/** What a new tab starts with: Home, the search box, or a new note. */
export const newTabShows = savedStore<NewTabShows>("newTabShows", "home", oneOf(["home", "search", "note"] as const, "home"));

/** Where a new page lands among the pages beside it. */
export const newPagesAt = savedStore<"end" | "top">("newPagesAt", "end", oneOf(["end", "top"] as const, "end"));

/** On by default: the website switches at its next start, the desktop app downloads and installs on restart. */
export const autoUpdate = savedStore<boolean>("autoUpdate", true);

/** A Welcome tab for each new, empty workspace. */
export const showWelcome = savedStore<boolean>("showWelcome", true);
