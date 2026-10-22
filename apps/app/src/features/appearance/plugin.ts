import type { Command, Plugin } from "@/plugins/types";
import { PAGE_WIDTH, TEXT_SIZE, clampPageWidth, clampTextSize, font, pageWidth, textSize, theme, type Font, type Theme } from "@/ui/appearance";
import { isDesktop } from "@/platform/platform";
import { ZOOM, startZoom, zoom, zoomBy } from "./zoom";
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

// Wider or narrower by a sixth of the normal width. From full width, narrower comes back to the widest size.
const stepWidth = (step: number) => {
  const now = pageWidth.get() || PAGE_WIDTH.max + 120;
  pageWidth.set(clampPageWidth(now + step * 120));
};

export const appearancePlugin: Plugin = {
  id: "appearance",
  name: "Appearance",
  description: "Theme, font, text size and colors",
  required: true,
  start: startZoom,
  options: [
    {
      id: "fadeControls",
      label: "Fade sidebars and buttons until you point at them",
      description: "Keeps the page in front. A board's own tools never fade.",
      section: "appearance",
      quick: true,
      default: true,
    },
  ],
  settings: [{ id: "appearance", order: 10, group: "General", title: "Appearance", icon: "contrast", keywords: ["theme", "dark", "light", "color", "colour", "scheme", "look", "font"], component: AppearanceSection }],
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
    { id: "appearance.zoom-in", title: "Zoom in on the whole app", keywords: ["zoom", "bigger", "scale"], when: () => isDesktop, run: () => zoomBy(1) },
    { id: "appearance.zoom-out", title: "Zoom out of the whole app", keywords: ["zoom", "smaller", "scale"], when: () => isDesktop, run: () => zoomBy(-1) },
    { id: "appearance.zoom-reset", title: "Reset the app zoom", keywords: ["zoom", "scale", "100"], when: () => isDesktop, run: () => zoom.set(ZOOM.normal) },
  ],
};
