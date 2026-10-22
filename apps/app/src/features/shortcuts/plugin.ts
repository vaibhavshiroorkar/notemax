import type { Plugin } from "@/plugins/types";
import { ShortcutsSection } from "./ShortcutsSection";

export const shortcutsPlugin: Plugin = {
  id: "shortcuts",
  name: "Keyboard shortcuts",
  description: "The list of every shortcut, and changing them",
  required: true,
  settings: [{ id: "shortcuts", order: 70, title: "Keyboard shortcuts", icon: "keyboard", keywords: ["keys", "hotkeys"], component: ShortcutsSection }],
  commands: [
    { id: "shortcuts.help", title: "Show all keyboard shortcuts", keywords: ["keys", "hotkeys", "help"], shortcut: "Mod+/", run: (app) => app.openShortcuts() },
  ],
};
