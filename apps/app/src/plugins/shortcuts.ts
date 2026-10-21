const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Splits "Mod+Shift+K" into its modifiers and the key. */
function parse(shortcut: string) {
  const parts = shortcut.split("+");
  // "Mod++" means the + key: the last part is empty, so put the + back.
  const key = parts.pop() || "+";
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  return { key: key.toLowerCase(), mod: mods.has("mod"), shift: mods.has("shift"), alt: mods.has("alt") };
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const want = parse(shortcut);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  return mod === want.mod && event.shiftKey === want.shift && event.altKey === want.alt && event.key.toLowerCase() === want.key;
}

/** "Mod+K" becomes "Ctrl+K", or "Cmd+K" on a Mac. */
export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/\bMod\b/, isMac ? "Cmd" : "Ctrl");
}
