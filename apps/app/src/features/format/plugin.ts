import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import type { AppContext, Plugin } from "@/plugins/types";
import { FormatPanel } from "./FormatPanel";
import "./format.css";

const onNote = (app: AppContext) => !!app.activeId && app.tree.byId.get(app.activeId)?.kind === "note";

export const formatPlugin: Plugin = {
  id: "format",
  name: "Format",
  description: "Fonts, sizes, colors, highlight, alignment and spacing, like Word, in the right sidebar",
  // Loaded even while the plugin is off, so a note keeps its colors and sizes.
  contentExtensions: () => [
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    // Without its keys: Ctrl+Shift+E (center) is the download shortcut, and the panel has the buttons.
    TextAlign.extend({ addKeyboardShortcuts: () => ({}) }).configure({ types: ["paragraph", "heading"] }),
  ],
  sidePanels: [{ id: "format.panel", title: "Format", order: 15, when: onNote, component: FormatPanel }],
  shortcutHints: [{ title: "Highlight", keys: "Mod+Shift+H" }],
};
