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

let shown = read("workspace") ?? "main";
const workspaceListeners = new Set<() => void>();

/**
 * The workspace the sidebar shows. It changes while the app runs: switching
 * no longer reloads the window, and tabs from other workspaces stay open.
 */
export const workspaceNow = () => shown;

/** Calls `listener` after the shown workspace changes. Returns a function that stops it. */
export function onWorkspaceChange(listener: () => void): () => void {
  workspaceListeners.add(listener);
  return () => workspaceListeners.delete(listener);
}

// What belongs to one workspace: the page last opened, the pages opened
// recently, the folders closed, and its waiting sync questions. Everything
// else, like the theme and the open tabs, is the same in all of them.
const PER_WORKSPACE = new Set(["selectedId", "recentPages", "collapsed", "syncConflicts"]);
/** A setting's key in storage. Per-workspace ones carry the workspace, except in the main one. */
const keyIn = (key: string, workspace: string) => PREFIX + (PER_WORKSPACE.has(key) && workspace !== "main" ? `${key}@${workspace}` : key);
const keyOf = (key: string) => keyIn(key, shown);

/** A setting as one workspace keeps it, whichever is shown. */
export const getPrefIn = (key: string, workspace: string): string | null => {
  try {
    return localStorage.getItem(keyIn(key, workspace));
  } catch {
    return null;
  }
};

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
  "homeLayout",
  "versionEvery",
  "graphChoices",
  "graphPanelChoices",
  "panelLayout",
  "temporaryNoticeHidden",
  "startAt",
  "dailyTitle",
  "lockCheck",
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

/**
 * Shows another workspace. Saved settings that belong to one workspace, like
 * the closed folders, read again from the new one's keys.
 */
export function setWorkspace(id: string) {
  if (id === shown) return;
  shown = id;
  write("workspace", id);
  for (const key of PER_WORKSPACE) watchers.get(key)?.forEach((listener) => listener());
  workspaceListeners.forEach((listener) => listener());
}

/** Keeps a setting that came from another device, and tells everything watching it. */
export function receivePref(key: string, value: string | null) {
  write(key, value);
  watchers.get(key)?.forEach((listener) => listener());
}
