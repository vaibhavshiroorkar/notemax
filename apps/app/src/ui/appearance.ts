import { useSyncExternalStore } from "react";
import { loadAsset } from "@notemax/core";
import { getSharedStore } from "@/platform/platform";
import { savedStore } from "@/platform/store";

export type Theme = "system" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";

/** Each accent has a darker shade for light backgrounds and a lighter one for dark. */
export const ACCENTS = {
  blue: { label: "Blue", light: "#2f6fdd", dark: "#6ea0ff" },
  green: { label: "Green", light: "#2e7d4f", dark: "#5cc28a" },
  teal: { label: "Teal", light: "#0f7c80", dark: "#4fc3c7" },
  purple: { label: "Purple", light: "#7048c8", dark: "#a58bff" },
  pink: { label: "Pink", light: "#c2387a", dark: "#f27bb0" },
  orange: { label: "Orange", light: "#c4581b", dark: "#f0955a" },
  gray: { label: "Gray", light: "#5c5c5c", dark: "#b0b0b0" },
};
export type AccentName = keyof typeof ACCENTS;

export const FONTS: Record<Font, { label: string; stack: string }> = {
  sans: { label: "Sans", stack: "system-ui, sans-serif" },
  serif: { label: "Serif", stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  mono: { label: "Mono", stack: 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace' },
};

/** The page's width in pixels. 0 means as wide as the window. */
export const PAGE_WIDTH = { min: 480, max: 1600, step: 20, normal: 720 };
// Names the width was saved as before it was a number.
const OLD_WIDTHS: Record<string, number> = { narrow: 600, normal: 720, wide: 900, full: 0 };

/** The family name a loaded font file is known by. */
const FILE_FONT = "Notemax Custom";

/** The CSS font list for a font setting: a preset, "custom:<family>" for one on this device, or "file". */
export function fontStack(value: string): string {
  if (value in FONTS) return FONTS[value as Font].stack;
  const family = value === "file" ? FILE_FONT : value.slice("custom:".length).replace(/["\\]/g, "");
  return `"${family}", system-ui, sans-serif`;
}

/** What to call a font setting in a list. */
export function fontLabel(value: string): string {
  if (value in FONTS) return FONTS[value as Font].label;
  if (value === "file") return fontFile.get()?.name ?? "Font file";
  return value.slice("custom:".length);
}

export const TEXT_SIZE = { min: 14, max: 22, normal: 16 };
// Defined before the stores below, which call it while reading saved values.
export const clampTextSize = (size: number) => Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, size));

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Accepts only the listed values, so an old or hand-edited pref falls back to the default. */
const oneOf = <T extends string>(values: readonly T[]) => ({
  decode(raw: string): T {
    if (!values.includes(raw as T)) throw new Error(`unknown value ${raw}`);
    return raw as T;
  },
  encode: (value: T) => value,
});

// Plain text, not JSON, because the theme was saved that way before these settings existed.
export const theme = savedStore<Theme>("theme", "system", oneOf(["system", "light", "dark"]));
/** A name from ACCENTS, or a custom color like "#c2387a". */
export const accent = savedStore<string>("accent", "blue", {
  decode(raw) {
    if (!(raw in ACCENTS) && !isHex(raw)) throw new Error(`unknown accent ${raw}`);
    return raw;
  },
  encode: (value) => value,
});
/** A preset from FONTS, "custom:<family>" for a font installed on this device, or "file" for one loaded from a file. */
export const font = savedStore<string>("font", "sans", {
  decode(raw) {
    if (raw in FONTS || raw === "file" || /^custom:.+/.test(raw)) return raw;
    throw new Error(`unknown font ${raw}`);
  },
  encode: (value) => value,
});
/** The loaded font file: its name, and the picture-style asset that keeps its bytes. */
export const fontFile = savedStore<{ name: string; asset: string } | null>("fontFile", null);
export const clampPageWidth = (width: number) => (width === 0 ? 0 : Math.min(PAGE_WIDTH.max, Math.max(PAGE_WIDTH.min, Math.round(width))));
// Plain text, like the names it was saved as before it became a number.
export const pageWidth = savedStore<number>("pageWidth", PAGE_WIDTH.normal, {
  decode(raw) {
    if (raw in OLD_WIDTHS) return OLD_WIDTHS[raw];
    const width = Number(raw);
    if (!Number.isFinite(width)) throw new Error(`bad page width ${raw}`);
    return clampPageWidth(width);
  },
  encode: String,
});
export const textSize = savedStore<number>("textSize", TEXT_SIZE.normal, {
  decode(raw) {
    const size = Number(raw);
    if (!Number.isInteger(size)) throw new Error(`bad text size ${raw}`);
    return clampTextSize(size);
  },
  encode: String,
});


function accentColors(value: string) {
  if (value in ACCENTS) return ACCENTS[value as AccentName];
  // A custom color has no hand-picked dark shade, so lighten it for dark backgrounds.
  return { light: value, dark: `color-mix(in srgb, ${value} 70%, white)` };
}

/** Everything lands on <html> as data-theme and CSS variables, which theme.css and the page styles read. */
function apply() {
  const root = document.documentElement;
  const mode = theme.get();
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
  const colors = accentColors(accent.get());
  root.style.setProperty("--accent-light", colors.light);
  root.style.setProperty("--accent-dark", colors.dark);
  root.style.setProperty("--note-font", fontStack(font.get()));
  root.style.setProperty("--note-size", `${textSize.get()}px`);
  root.style.setProperty("--page-width", pageWidth.get() ? `${pageWidth.get()}px` : "none");
  if (font.get() === "file") void loadFontFile();
}

let loadedFont: string | null = null;
/** Makes a loaded font file usable, once per file. */
async function loadFontFile() {
  const file = fontFile.get();
  if (!file || loadedFont === file.asset) return;
  const asset = await loadAsset(await getSharedStore(), file.asset);
  if (!asset) return;
  const face = await new FontFace(FILE_FONT, asset.bytes as BufferSource).load();
  document.fonts.add(face);
  loadedFont = file.asset;
}

/**
 * Applies the saved appearance now and after every change, including changes
 * made in another window, so the capture box always matches. Call before the
 * first render.
 */
export function initAppearance() {
  apply();
  for (const store of [theme, accent, font, fontFile, pageWidth, textSize]) store.subscribe(apply);
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/** "light" or "dark" as shown right now: the user's choice, or the system's when they chose System. */
export function useShownTheme(): "light" | "dark" {
  const chosen = theme.use();
  const system = useSyncExternalStore(
    (listener) => {
      const query = darkQuery();
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => darkQuery().matches,
  );
  return chosen === "system" ? (system ? "dark" : "light") : chosen;
}
