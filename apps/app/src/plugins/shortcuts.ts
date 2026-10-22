import { savedStore } from "@/platform/store";
import type { Command } from "./types";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Shortcuts the user picked in Settings, by command id. They replace the
 * plugin's default. "" means the user removed the shortcut.
 */
export const shortcutOverrides = savedStore<Record<string, string>>("shortcuts", {}, {
  decode(raw) {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not a map");
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string"));
  },
});

/** The shortcut a command answers to now, or "" for none. */
export function shortcutFor(command: Command, overrides = shortcutOverrides.get()): string {
  return overrides[command.id] ?? command.shortcut ?? "";
}

/** Pass null to go back to the plugin's default. */
export function setShortcut(commandId: string, shortcut: string | null) {
  const next = { ...shortcutOverrides.get() };
  if (shortcut === null) delete next[commandId];
  else next[commandId] = shortcut;
  shortcutOverrides.set(next);
}

/** Splits "Mod+Shift+K" into its modifiers and the key. */
function parse(shortcut: string) {
  const parts = shortcut.split("+");
  // "Mod++" means the + key: the last part is empty, so put the + back.
  const key = parts.pop() || "+";
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  return { key: key.toLowerCase(), mod: mods.has("mod"), shift: mods.has("shift"), alt: mods.has("alt") };
}

/**
 * The key a press means, ignoring modifiers. Letters and digits come from
 * `code` when `key` is something else: Shift+1 gives "!", Option+K on a Mac
 * gives a symbol, and a Cyrillic layout gives Cyrillic letters.
 */
function keyOf(event: KeyboardEvent): string {
  if (event.key === " ") return "Space";
  if (/^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase();
  const code = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code);
  if (code) return code[1] ?? code[2];
  // Shift turns \ into | and [ into {, so a shortcut like Mod+Shift+\ reads the key itself.
  if (event.shiftKey && PUNCTUATION[event.code]) return PUNCTUATION[event.code];
  return event.key;
}

const PUNCTUATION: Record<string, string> = {
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Slash: "/",
  Period: ".",
  Comma: ",",
  Semicolon: ";",
  Quote: "'",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
};

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const want = parse(shortcut);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  return mod === want.mod && event.shiftKey === want.shift && event.altKey === want.alt && keyOf(event).toLowerCase() === want.key;
}

/**
 * The shortcut a key press would make, or null when it cannot be one. A
 * shortcut needs Ctrl (Cmd on a Mac) or Alt, or a function key, so that it
 * never takes over plain typing.
 */
export function shortcutFromEvent(event: KeyboardEvent): string | null {
  if (["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"].includes(event.key)) return null;
  const mod = isMac ? event.metaKey : event.ctrlKey;
  if (!mod && !event.altKey && !/^F\d{1,2}$/.test(event.key)) return null;
  return [mod && "Mod", event.altKey && "Alt", event.shiftKey && "Shift", keyOf(event)].filter(Boolean).join("+");
}

/** True when both strings name the same keys, whatever order or case they are written in. */
export function sameShortcut(a: string, b: string): boolean {
  if (!a || !b) return false;
  const [x, y] = [parse(a), parse(b)];
  return x.key === y.key && x.mod === y.mod && x.shift === y.shift && x.alt === y.alt;
}

/** "Mod+K" becomes "Ctrl+K", or "Cmd+K" on a Mac. */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/\bMod\b/, isMac ? "Cmd" : "Ctrl")
    .replace(/\bAlt\b/, isMac ? "Option" : "Alt")
    // A lone letter key is shown in capitals, like on the keyboard. Names like Enter stay as they are.
    .replace(/(^|\+)([a-z])$/, (_, before: string, letter: string) => before + letter.toUpperCase());
}
