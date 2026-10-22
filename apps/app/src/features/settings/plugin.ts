import type { Plugin } from "@/plugins/types";
import { BasicsSection } from "./BasicRows";
import { PluginOptionsSection } from "./PluginOptionsSection";
import { StorageSection } from "./sections";

export const settingsPlugin: Plugin = {
  id: "settings",
  name: "Settings",
  description: "This window",
  required: true,
  settings: [
    { id: "basics", order: 0, title: "Basics", icon: "settings", keywords: ["common", "main", "general"], component: BasicsSection },
    { id: "plugins", order: 80, title: "Plugins", icon: "plug", component: PluginOptionsSection },
    { id: "storage", order: 90, title: "Storage", icon: "storage", keywords: ["database", "disk", "data"], component: StorageSection },
  ],
  commands: [
    { id: "settings.open", title: "Open settings", keywords: ["preferences", "options"], shortcut: "Mod+,", run: (app) => app.openSettings() },
    { id: "settings.quick", title: "Quick settings", keywords: ["theme", "toggle", "switch"], shortcut: "Mod+.", run: (app) => app.toggleQuickSettings() },
  ],
};
