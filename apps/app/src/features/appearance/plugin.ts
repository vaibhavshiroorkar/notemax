import type { Command, Plugin } from "@/plugins/types";
import { PAGE_WIDTH_ORDER, TEXT_SIZE, clampTextSize, font, pageWidth, textSize, theme, type Font, type Theme } from "@/ui/appearance";
import { AppearanceSection } from "./AppearanceSection";

const themeCommand = (value: Theme, title: string): Command => ({
  id: `appearance.theme-${value}`,
  title,
  keywords: ["theme", "appearance", "mode", "color"],
  run: () => theme.set(value),
});

const fontCommand = (value: Font, title: string): Command => ({
  id: `appearance.font-${value}`,
  title,
  keywords: ["font", "typeface", "appearance"],
  run: () => font.set(value),
});

const stepWidth = (step: number) => {
  const i = PAGE_WIDTH_ORDER.indexOf(pageWidth.get()) + step;
  pageWidth.set(PAGE_WIDTH_ORDER[Math.max(0, Math.min(PAGE_WIDTH_ORDER.length - 1, i))]);
};

export const appearancePlugin: Plugin = {
  id: "appearance",
  name: "Appearance",
  settings: [{ id: "appearance", order: 10, component: AppearanceSection }],
  commands: [
    themeCommand("light", "Use the light theme"),
    themeCommand("dark", "Use the dark theme"),
    themeCommand("system", "Match the system theme"),
    fontCommand("sans", "Use a sans-serif font"),
    fontCommand("serif", "Use a serif font"),
    fontCommand("mono", "Use a monospace font"),
    { id: "appearance.text-bigger", title: "Make text bigger", keywords: ["zoom", "font", "size"], shortcut: "Mod+=", run: () => textSize.set(clampTextSize(textSize.get() + 1)) },
    { id: "appearance.text-smaller", title: "Make text smaller", keywords: ["zoom", "font", "size"], shortcut: "Mod+-", run: () => textSize.set(clampTextSize(textSize.get() - 1)) },
    { id: "appearance.text-reset", title: "Reset text size", keywords: ["zoom", "font", "size"], shortcut: "Mod+0", run: () => textSize.set(TEXT_SIZE.normal) },
    { id: "appearance.page-wider", title: "Make the page wider", keywords: ["width", "layout"], run: () => stepWidth(1) },
    { id: "appearance.page-narrower", title: "Make the page narrower", keywords: ["width", "layout"], run: () => stepWidth(-1) },
  ],
};
