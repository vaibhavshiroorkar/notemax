// Per-device UI preferences (selected note, collapsed rows, appearance) and the
// unsent capture draft. Saved notes never go here.
// localStorage can throw in private windows or when site data is blocked, so every
// access is guarded and the app works without it.
const PREFIX = "notemax:";

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * The workspace this window shows. Chosen before anything else loads, and
 * switching reloads the window, so it never changes while the app runs.
 */
export const currentWorkspace = read("workspace") ?? "main";

// What belongs to one workspace: its open tabs, the pages last opened, the
// folders closed, and its waiting sync questions. Everything else, like the
// theme, is the same in all of them.
const PER_WORKSPACE = new Set(["tabs", "selectedId", "recentPages", "collapsed", "syncConflicts"]);
const keyOf = (key: string) => PREFIX + (PER_WORKSPACE.has(key) && currentWorkspace !== "main" ? `${key}@${currentWorkspace}` : key);

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(keyOf(key));
  } catch {
    return null;
  }
}

/**
 * Settings that follow the person to every device, through the synced
 * settings doc. A list of what may go, so nothing else ever does: what fits
 * one screen (zoom, open sidebars), sync and its keys, and the workspace on
 * show all stay on the device.
 */
export const SYNCED_PREFS: ReadonlySet<string> = new Set([
  "theme",
  "accent",
  "font",
  "fontFile",
  "textSize",
  "pageWidth",
  "paperSize",
  "options",
  "pluginsOff",
  "shortcuts",
  "downloadFormat",
  "trashKeepDays",
  "versionEvery",
  "graphChoices",
  "graphPanelChoices",
  "panelLayout",
  "panelOpen",
  "temporaryNoticeHidden",
  "startAt",
  "dailyTitle",
]);

let outbox: ((key: string, value: string | null) => void) | null = null;

/** Where synced settings changed here go: the settings doc, once it is open. */
export function sendPrefsTo(send: (key: string, value: string | null) => void) {
  outbox = send;
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(keyOf(key));
    else localStorage.setItem(keyOf(key), value);
  } catch {
    // Not critical: the app falls back to defaults next time.
  }
}

export function setPref(key: string, value: string) {
  write(key, value);
  if (SYNCED_PREFS.has(key)) outbox?.(key, value);
}

export function removePref(key: string) {
  write(key, null);
  if (SYNCED_PREFS.has(key)) outbox?.(key, null);
}

const watchers = new Map<string, Set<() => void>>();

/** Calls `listener` when another window, like the capture box, or another device changes `key`. */
export function onPrefChangedElsewhere(key: string, listener: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key === keyOf(key)) listener();
  });
  if (!watchers.has(key)) watchers.set(key, new Set());
  watchers.get(key)!.add(listener);
}

/** Keeps a setting that came from another device, and tells everything watching it. */
export function receivePref(key: string, value: string | null) {
  write(key, value);
  watchers.get(key)?.forEach((listener) => listener());
}
