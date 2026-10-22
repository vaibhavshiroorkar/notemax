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

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(keyOf(key), value);
  } catch {
    // Not critical: the app falls back to defaults next time.
  }
}

/** Calls `listener` when another window, like the capture box, changes `key`. */
export function onPrefChangedElsewhere(key: string, listener: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key === keyOf(key)) listener();
  });
}

export function removePref(key: string) {
  try {
    localStorage.removeItem(keyOf(key));
  } catch {
    // Nothing to remove when storage is blocked.
  }
}
