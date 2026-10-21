// Per-device UI preferences (selected note, collapsed rows, appearance) and the
// unsent capture draft. Saved notes never go here.
// localStorage can throw in private windows or when site data is blocked, so every
// access is guarded and the app works without it.
const PREFIX = "notemax:";

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not critical: the app falls back to defaults next time.
  }
}

/** Calls `listener` when another window, like the capture box, changes `key`. */
export function onPrefChangedElsewhere(key: string, listener: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key === PREFIX + key) listener();
  });
}
