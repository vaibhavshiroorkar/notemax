import type { Plugin } from "@/plugins/types";
import { setTheme, type Theme } from "@/ui/theme";
import { AppearanceSection, StorageSection } from "./sections";

const themeCommand = (theme: Theme, title: string) => ({
  id: `settings.theme-${theme}`,
  title,
  keywords: ["theme", "appearance", "mode", "color"],
  run: () => setTheme(theme),
});

export const settingsPlugin: Plugin = {
  id: "settings",
  name: "Settings",
  settings: [
    { id: "appearance", order: 10, component: AppearanceSection },
    { id: "storage", order: 90, component: StorageSection },
  ],
  commands: [
    { id: "settings.open", title: "Open settings", keywords: ["preferences", "options"], shortcut: "Mod+,", run: (app) => app.openSettings() },
    themeCommand("light", "Use the light theme"),
    themeCommand("dark", "Use the dark theme"),
    themeCommand("system", "Match the system theme"),
  ],
};
