import type { Plugin } from "@/plugins/types";

export const palettePlugin: Plugin = {
  id: "palette",
  name: "Command palette",
  description: "Ctrl+K to find any page or command",
  commands: [{ id: "palette.open", title: "Search notes and commands", shortcut: "Mod+K", run: (app) => app.openPalette() }],
};
