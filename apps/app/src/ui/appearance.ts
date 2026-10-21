import { savedStore } from "@/platform/store";

export type Theme = "system" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";
export type PageWidth = "narrow" | "normal" | "wide" | "full";

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

export const PAGE_WIDTHS: Record<PageWidth, { label: string; css: string }> = {
  narrow: { label: "Narrow", css: "600px" },
  normal: { label: "Normal", css: "720px" },
  wide: { label: "Wide", css: "900px" },
  full: { label: "Full", css: "none" },
};
export const PAGE_WIDTH_ORDER: PageWidth[] = ["narrow", "normal", "wide", "full"];

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
export const font = savedStore<Font>("font", "sans", oneOf(Object.keys(FONTS) as Font[]));
export const pageWidth = savedStore<PageWidth>("pageWidth", "normal", oneOf(PAGE_WIDTH_ORDER));
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
  root.style.setProperty("--note-font", FONTS[font.get()].stack);
  root.style.setProperty("--note-size", `${textSize.get()}px`);
  root.style.setProperty("--page-width", PAGE_WIDTHS[pageWidth.get()].css);
}

/**
 * Applies the saved appearance now and after every change, including changes
 * made in another window, so the capture box always matches. Call before the
 * first render.
 */
export function initAppearance() {
  apply();
  for (const store of [theme, accent, font, pageWidth, textSize]) store.subscribe(apply);
}
